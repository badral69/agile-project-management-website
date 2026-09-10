import { Role, TaskStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/async-handler";

export const getDashboardOverview = asyncHandler(async (request: Request, response: Response) => {
  const { id, role } = request.user!;

  // ADMINs and MODERATORs can view all projects/tasks for platform oversight.
  // MODERATORs deliberately cannot see the user count — that is admin-only.
  const isElevated = role === Role.ADMIN || role === Role.MODERATOR;

  const projectWhere = isElevated
    ? {}
    : {
        OR: [
          { members: { some: { userId: id } } },
          { company: { members: { some: { userId: id } } } },
        ],
      };

  const taskWhere = isElevated
    ? {}
    : {
        OR: [
          { assigneeId: id },
          { reporterId: id },
          { project: { members: { some: { userId: id } } } },
          { project: { company: { members: { some: { userId: id } } } } },
        ],
      };

  // Individual counts per status run in parallel — groupBy with nested relation
  // filters causes a PostgreSQL "column reference is ambiguous" error on joined tables.
  const statusCountsPromise = Promise.all(
    Object.values(TaskStatus).map((status) =>
      prisma.task.count({ where: { ...taskWhere, status } }).then((count) => ({ status, count })),
    ),
  );

  const [projectCount, taskCount, overdueTasks, recentProjects, statusCounts, myTasks, userCount] =
    await Promise.all([
      prisma.project.count({ where: projectWhere }),
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({
        where: { ...taskWhere, dueDate: { lt: new Date() }, status: { not: TaskStatus.DONE } },
      }),
      prisma.project.findMany({
        where: projectWhere,
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { tasks: true, members: true } } },
      }),
      statusCountsPromise,
      prisma.task.findMany({
        where: { assigneeId: id },
        take: 6,
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        include: { project: { select: { id: true, name: true, key: true } } },
      }),
      // User count is admin-only — MODERATORs do not need platform-level user metrics
      role === Role.ADMIN ? prisma.user.count() : Promise.resolve(undefined),
    ]);

  const statusBreakdown = statusCounts
    .filter((g) => g.count > 0)
    .map((g) => ({ status: g.status, _count: { status: g.count } }));

  response.json({
    stats: { projectCount, taskCount, overdueTasks, userCount },
    recentProjects,
    statusBreakdown,
    myTasks,
  });
});
