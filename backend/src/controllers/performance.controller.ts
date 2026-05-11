import { ProjectMemberRole, Role, TaskStatus } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/async-handler";

const leadershipRoles = [ProjectMemberRole.OWNER, ProjectMemberRole.MANAGER];
const lastThirtyDays = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
};

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

const percentage = (numerator: number, denominator: number) => {
  if (!denominator) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
};

const hoursBetween = (start: Date | string, end: Date | string) => {
  return (new Date(end).getTime() - new Date(start).getTime()) / 36e5;
};

export const getPerformanceOverview = asyncHandler(async (request: Request, response: Response) => {
  const { id, role } = request.user!;
  const requestedProjectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  const isOrganizationLead = role === Role.ADMIN || role === Role.MODERATOR;

  const accessibleProjects = isOrganizationLead
    ? await prisma.project.findMany({
        select: { id: true, key: true, name: true, status: true },
        orderBy: [{ updatedAt: "desc" }],
      })
    : (
        await prisma.projectMember.findMany({
          where: {
            userId: id,
            memberRole: { in: leadershipRoles },
          },
          select: {
            project: {
              select: { id: true, key: true, name: true, status: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      ).map((entry) => entry.project);

  if (!accessibleProjects.length) {
    return response.status(StatusCodes.FORBIDDEN).json({
      message: "Performance evaluation is available only to admins and project leaders.",
    });
  }

  const selectedProjectId = requestedProjectId || accessibleProjects[0]!.id;
  if (!accessibleProjects.some((project) => project.id === selectedProjectId)) {
    return response.status(StatusCodes.FORBIDDEN).json({
      message: "You can only review performance for projects you lead.",
    });
  }

  const scopedProjectIds = requestedProjectId ? [selectedProjectId] : accessibleProjects.map((project) => project.id);
  const scopedProjects = accessibleProjects.filter((project) => scopedProjectIds.includes(project.id));

  const [memberships, tasks, activityEvents] = await Promise.all([
    prisma.projectMember.findMany({
      where: {
        projectId: { in: scopedProjectIds },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatarColor: true,
            avatarUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        projectId: { in: scopedProjectIds },
      },
      include: {
        project: {
          select: { id: true, key: true, name: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.activityLog.findMany({
      where: {
        projectId: { in: scopedProjectIds },
        actorId: { not: null },
        createdAt: { gte: lastThirtyDays() },
      },
      select: {
        actorId: true,
        createdAt: true,
      },
    }),
  ]);

  const workerMap = new Map<
    string,
    {
      id: string;
      fullName: string;
      email: string;
      role: Role;
      avatarColor: string;
      avatarUrl: string | null;
      projectMemberships: number;
      leadershipProjects: number;
      managedProjectLabels: string[];
      assignedTaskCount: number;
      completedTaskCount: number;
      openTaskCount: number;
      overdueOpenTaskCount: number;
      dueTrackedCompletedCount: number;
      completedOnTimeCount: number;
      onTimeCompletionRate: number;
      averageTaskCycleHours: number;
      averageTaskAgeHours: number;
      activityEventsLast30Days: number;
      activeContributionDaysLast30Days: number;
      completionSpeed: "High" | "Steady" | "Needs support";
    }
  >();

  memberships.forEach((membership) => {
    if (!workerMap.has(membership.user.id)) {
      workerMap.set(membership.user.id, {
        id: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
        role: membership.user.role,
        avatarColor: membership.user.avatarColor,
        avatarUrl: membership.user.avatarUrl,
        projectMemberships: 0,
        leadershipProjects: 0,
        managedProjectLabels: [],
        assignedTaskCount: 0,
        completedTaskCount: 0,
        openTaskCount: 0,
        overdueOpenTaskCount: 0,
        dueTrackedCompletedCount: 0,
        completedOnTimeCount: 0,
        onTimeCompletionRate: 0,
        averageTaskCycleHours: 0,
        averageTaskAgeHours: 0,
        activityEventsLast30Days: 0,
        activeContributionDaysLast30Days: 0,
        completionSpeed: "Steady",
      });
    }

    const worker = workerMap.get(membership.user.id)!;
    worker.projectMemberships += 1;

    if (membership.memberRole === ProjectMemberRole.OWNER || membership.memberRole === ProjectMemberRole.MANAGER) {
      worker.leadershipProjects += 1;
      worker.managedProjectLabels.push(`${membership.project.key} · ${membership.project.name}`);
    }
  });

  const now = new Date();
  const activityByActor = new Map<string, { count: number; days: Set<string> }>();
  activityEvents.forEach((entry) => {
    if (!entry.actorId) {
      return;
    }

    const current = activityByActor.get(entry.actorId) || { count: 0, days: new Set<string>() };
    current.count += 1;
    current.days.add(new Date(entry.createdAt).toISOString().slice(0, 10));
    activityByActor.set(entry.actorId, current);
  });

  workerMap.forEach((worker, workerId) => {
    const assignedTasks = tasks.filter((task) => task.assigneeId === workerId);
    const completedTasks = assignedTasks.filter((task) => task.status === TaskStatus.DONE);
    const openTasks = assignedTasks.filter((task) => task.status !== TaskStatus.DONE);
    const dueTrackedCompleted = completedTasks.filter((task) => Boolean(task.dueDate));
    const completedOnTime = dueTrackedCompleted.filter((task) => task.dueDate && new Date(task.updatedAt) <= new Date(task.dueDate));
    const overdueOpenTasks = openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < now);
    const averageTaskCycleHours = average(completedTasks.map((task) => hoursBetween(task.createdAt, task.updatedAt)));
    const averageTaskAgeHours = average(assignedTasks.map((task) => hoursBetween(task.createdAt, task.status === TaskStatus.DONE ? task.updatedAt : now)));
    const recentActivity = activityByActor.get(workerId);
    const onTimeCompletionRate = percentage(completedOnTime.length, dueTrackedCompleted.length || completedTasks.length || 0);

    worker.assignedTaskCount = assignedTasks.length;
    worker.completedTaskCount = completedTasks.length;
    worker.openTaskCount = openTasks.length;
    worker.overdueOpenTaskCount = overdueOpenTasks.length;
    worker.dueTrackedCompletedCount = dueTrackedCompleted.length;
    worker.completedOnTimeCount = completedOnTime.length;
    worker.onTimeCompletionRate = onTimeCompletionRate;
    worker.averageTaskCycleHours = averageTaskCycleHours;
    worker.averageTaskAgeHours = averageTaskAgeHours;
    worker.activityEventsLast30Days = recentActivity?.count || 0;
    worker.activeContributionDaysLast30Days = recentActivity?.days.size || 0;
    worker.completionSpeed =
      onTimeCompletionRate >= 85 && worker.overdueOpenTaskCount === 0
        ? "High"
        : onTimeCompletionRate >= 60 && worker.overdueOpenTaskCount <= 1
          ? "Steady"
          : "Needs support";
  });

  const workers = [...workerMap.values()].sort((left, right) => {
    return right.onTimeCompletionRate - left.onTimeCompletionRate || right.completedTaskCount - left.completedTaskCount;
  });

  const completedTasksTotal = workers.reduce((sum, worker) => sum + worker.completedTaskCount, 0);
  const overdueOpenTasksTotal = workers.reduce((sum, worker) => sum + worker.overdueOpenTaskCount, 0);
  const dueTrackedCompletedTotal = workers.reduce((sum, worker) => sum + worker.dueTrackedCompletedCount, 0);
  const completedOnTimeTotal = workers.reduce((sum, worker) => sum + worker.completedOnTimeCount, 0);
  const activityEventsTotal = workers.reduce((sum, worker) => sum + worker.activityEventsLast30Days, 0);

  response.json({
    visibility: isOrganizationLead ? "ADMIN" : "PROJECT_LEADER",
    scopeNote: "SprintFlow evaluates in-app project delivery only. It does not capture keyboard, cursor, or whole-device activity.",
    selectedProjectId,
    projects: accessibleProjects,
    summary: {
      memberCount: workers.length,
      completedTasks: completedTasksTotal,
      overdueOpenTasks: overdueOpenTasksTotal,
      onTimeCompletionRate: percentage(completedOnTimeTotal, dueTrackedCompletedTotal || completedTasksTotal || 0),
      averageTaskCycleHours: average(workers.filter((worker) => worker.completedTaskCount > 0).map((worker) => worker.averageTaskCycleHours)),
      activityEventsLast30Days: activityEventsTotal,
      activeContributors: workers.filter((worker) => worker.activityEventsLast30Days > 0).length,
      projectCount: scopedProjects.length,
    },
    workers,
  });
});
