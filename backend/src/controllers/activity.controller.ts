import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/async-handler";

export const listUserActivity = asyncHandler(async (request: Request, response: Response) => {
  const limit = Math.min(Number(request.query.limit) || 50, 100);

  let projectFilter: { projectId: { in: string[] } } | Record<string, never> = {};

  if (request.user!.role !== Role.ADMIN && request.user!.role !== Role.MODERATOR) {
    const accessibleProjects = await prisma.project.findMany({
      where: {
        OR: [
          { members: { some: { userId: request.user!.id } } },
          { company: { members: { some: { userId: request.user!.id } } } },
        ],
      },
      select: { id: true },
    });
    projectFilter = { projectId: { in: accessibleProjects.map((p) => p.id) } };
  }

  const activities = await prisma.activityLog.findMany({
    where: projectFilter,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, fullName: true, role: true, avatarColor: true, avatarUrl: true } },
      project: { select: { id: true, key: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  response.json({ items: activities });
});
