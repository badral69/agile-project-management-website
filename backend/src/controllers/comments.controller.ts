import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { canAccessProject } from "../utils/project-permissions";
import { sanitizePlainText } from "../utils/sanitize";

export const createComment = asyncHandler(async (request: Request, response: Response) => {
  const taskId = String(request.params.id);
  const task = await prisma.task.findUnique({ where: { id: taskId } });

  if (!task) {
    throw new AppError("Task not found.", StatusCodes.NOT_FOUND);
  }

  const hasAccess = await canAccessProject(task.projectId, request.user!.id, request.user!.role);
  if (!hasAccess) {
    throw new AppError("You do not have permission to comment on this task.", StatusCodes.FORBIDDEN);
  }

  const comment = await prisma.comment.create({
    data: {
      taskId: task.id,
      authorId: request.user!.id,
      body: sanitizePlainText(request.body.body),
    },
    include: {
      author: {
        select: { id: true, fullName: true, avatarColor: true, avatarUrl: true, role: true },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      actorId: request.user!.id,
      projectId: task.projectId,
      taskId: task.id,
      action: "COMMENT_ADDED",
      entityType: "comment",
      entityId: comment.id,
    },
  });

  response.status(StatusCodes.CREATED).json({ message: "Comment added.", item: comment });
});
