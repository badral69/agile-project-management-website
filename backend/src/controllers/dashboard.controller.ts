import { Role, TaskStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/async-handler";

export const getDashboardOverview = asyncHandler(async (request: Request, response: Response) => {
  const { id, role } = request.user!;
  const taskStatuses = Object.values(TaskStatus);

  const projectWhere =
    role === Role.ADMIN || role === Role.MODERATOR
      ? {}
      : {
          OR: [
            {
              members: {
                some: { userId: id },
              },
            },
            {
              company: {
                members: {
                  some: { userId: id },
                },
              },
            },
          ],
        };

  const taskWhere =
    role === Role.ADMIN || role === Role.MODERATOR
      ? {}
      : {
          OR: [
            { assigneeId: id },
            { reporterId: id },
            { project: { members: { some: { userId: id } } } },
            { project: { company: { members: { some: { userId: id } } } } },
          ],
        };

  const [projectCount, taskCount, overdueTasks, recentProjects, statusBreakdownCounts, myTasks, userCount] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.task.count({ where: taskWhere }),
    prisma.task.count({
      where: {
        ...taskWhere,
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
      },
    }),
    prisma.project.findMany({
      where: projectWhere,
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { tasks: true, members: true },
        },
      },
    }),
    Promise.all(
      taskStatuses.map(async (status) => ({
        status,
        _count: {
          status: await prisma.task.count({
            where: {
              ...taskWhere,
              status,
            },
          }),
        },
      })),
    ),
    prisma.task.findMany({
      where: {
        assigneeId: id,
      },
      take: 6,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      include: {
        project: {
          select: { id: true, name: true, key: true },
        },
      },
    }),
    role === Role.ADMIN ? prisma.user.count() : Promise.resolve(undefined),
  ]);

  const statusBreakdown = statusBreakdownCounts.filter((item) => item._count.status > 0);

  response.json({
    stats: {
      projectCount,
      taskCount,
      overdueTasks,
      userCount,
    },
    recentProjects,
    statusBreakdown,
    myTasks,
  });
});
