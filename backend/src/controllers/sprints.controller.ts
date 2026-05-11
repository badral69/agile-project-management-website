import { SprintStatus } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { canAccessProject, canManageProject } from "../utils/project-permissions";
import { sanitizePlainText } from "../utils/sanitize";

export const listSprints = asyncHandler(async (request: Request, response: Response) => {
  const projectId = String(request.params.projectId);
  const hasAccess = await canAccessProject(projectId, request.user!.id, request.user!.role);
  if (!hasAccess) throw new AppError("Project not found or access denied.", StatusCodes.NOT_FOUND);

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { startDate: "asc" },
    include: {
      tasks: {
        include: {
          task: {
            select: { id: true, title: true, status: true, priority: true, assigneeId: true },
          },
        },
      },
    },
  });

  response.json({ items: sprints });
});

export const createSprint = asyncHandler(async (request: Request, response: Response) => {
  const projectId = String(request.params.projectId);
  const canManage = await canManageProject(projectId, request.user!.id, request.user!.role);
  if (!canManage) throw new AppError("Only project managers can create sprints.", StatusCodes.FORBIDDEN);

  const sprint = await prisma.sprint.create({
    data: {
      projectId,
      name: sanitizePlainText(request.body.name),
      goal: request.body.goal ? sanitizePlainText(request.body.goal) : null,
      startDate: new Date(request.body.startDate),
      endDate: new Date(request.body.endDate),
      status: SprintStatus.PLANNING,
    },
    include: { tasks: true },
  });

  await prisma.activityLog.create({
    data: {
      actorId: request.user!.id,
      projectId,
      action: "SPRINT_CREATED",
      entityType: "sprint",
      entityId: sprint.id,
      metadata: { name: sprint.name },
    },
  });

  response.status(StatusCodes.CREATED).json({ message: "Sprint created.", item: sprint });
});

export const updateSprint = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) throw new AppError("Sprint not found.", StatusCodes.NOT_FOUND);

  const canManage = await canManageProject(sprint.projectId, request.user!.id, request.user!.role);
  if (!canManage) throw new AppError("Only project managers can update sprints.", StatusCodes.FORBIDDEN);

  const updated = await prisma.sprint.update({
    where: { id },
    data: {
      name: sanitizePlainText(request.body.name),
      goal: request.body.goal ? sanitizePlainText(request.body.goal) : null,
      startDate: new Date(request.body.startDate),
      endDate: new Date(request.body.endDate),
      status: request.body.status as SprintStatus,
      retrospective: request.body.retrospective ? sanitizePlainText(request.body.retrospective) : undefined,
    },
    include: {
      tasks: {
        include: {
          task: { select: { id: true, title: true, status: true, priority: true, assigneeId: true } },
        },
      },
    },
  });

  response.json({ message: "Sprint updated.", item: updated });
});

export const deleteSprint = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) throw new AppError("Sprint not found.", StatusCodes.NOT_FOUND);

  const canManage = await canManageProject(sprint.projectId, request.user!.id, request.user!.role);
  if (!canManage) throw new AppError("Only project managers can delete sprints.", StatusCodes.FORBIDDEN);

  await prisma.sprint.delete({ where: { id } });
  response.json({ message: "Sprint deleted." });
});

export const addTaskToSprint = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const taskId = String(request.body.taskId);

  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) throw new AppError("Sprint not found.", StatusCodes.NOT_FOUND);

  const canManage = await canManageProject(sprint.projectId, request.user!.id, request.user!.role);
  if (!canManage) throw new AppError("Only project managers can assign tasks to sprints.", StatusCodes.FORBIDDEN);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== sprint.projectId) {
    throw new AppError("Task not found or belongs to a different project.", StatusCodes.BAD_REQUEST);
  }

  await prisma.sprintTask.upsert({
    where: { sprintId_taskId: { sprintId: id, taskId } },
    create: { sprintId: id, taskId },
    update: {},
  });

  response.json({ message: "Task added to sprint." });
});

export const removeTaskFromSprint = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const taskId = String(request.params.taskId);

  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) throw new AppError("Sprint not found.", StatusCodes.NOT_FOUND);

  const canManage = await canManageProject(sprint.projectId, request.user!.id, request.user!.role);
  if (!canManage) throw new AppError("Only project managers can remove tasks from sprints.", StatusCodes.FORBIDDEN);

  await prisma.sprintTask.deleteMany({ where: { sprintId: id, taskId } });
  response.json({ message: "Task removed from sprint." });
});
