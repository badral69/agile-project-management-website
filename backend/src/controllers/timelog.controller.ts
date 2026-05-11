import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { canAccessProject } from "../utils/project-permissions";

export const listTimeLogs = asyncHandler(async (request: Request, response: Response) => {
  const taskId = String(request.params.taskId);
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) throw new AppError("Task not found.", StatusCodes.NOT_FOUND);

  const canAccess = await canAccessProject(task.projectId, request.user!.id, request.user!.role);
  if (!canAccess) throw new AppError("Access denied.", StatusCodes.FORBIDDEN);

  const logs = await prisma.timeLog.findMany({
    where: { taskId },
    orderBy: { loggedAt: "desc" },
    include: { user: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } } },
  });

  const totalHours = logs.reduce((sum, l) => sum + l.hours, 0);
  response.json({ items: logs, totalHours });
});

export const createTimeLog = asyncHandler(async (request: Request, response: Response) => {
  const taskId = String(request.params.taskId);
  const { hours, note } = request.body as { hours: number; note?: string };

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) throw new AppError("Task not found.", StatusCodes.NOT_FOUND);

  const canAccess = await canAccessProject(task.projectId, request.user!.id, request.user!.role);
  if (!canAccess) throw new AppError("Access denied.", StatusCodes.FORBIDDEN);

  const log = await prisma.timeLog.create({
    data: { taskId, userId: request.user!.id, hours, note: note || null },
    include: { user: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } } },
  });

  response.status(StatusCodes.CREATED).json({ item: log });
});

export const deleteTimeLog = asyncHandler(async (request: Request, response: Response) => {
  const logId = String(request.params.logId);
  const log = await prisma.timeLog.findUnique({ where: { id: logId } });
  if (!log) throw new AppError("Time log not found.", StatusCodes.NOT_FOUND);
  if (log.userId !== request.user!.id && request.user!.role !== "ADMIN" && request.user!.role !== "MODERATOR") {
    throw new AppError("You can only delete your own time logs.", StatusCodes.FORBIDDEN);
  }
  await prisma.timeLog.delete({ where: { id: logId } });
  response.json({ message: "Time log deleted." });
});
