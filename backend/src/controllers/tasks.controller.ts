import { Role, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { sendTaskAssignmentEmail } from "../utils/mailer";
import { getPagination } from "../utils/pagination";
import { canAccessProject, canManageProject } from "../utils/project-permissions";
import { sanitizePlainText } from "../utils/sanitize";

const getProjectAssignee = async (projectId: string, assigneeId: string) => {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: assigneeId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarColor: true,
        },
      },
    },
  });

  if (!membership) {
    throw new AppError("Assignee must be a member of this project.", StatusCodes.BAD_REQUEST);
  }

  return membership.user;
};

export const listTasks = asyncHandler(async (request: Request, response: Response) => {
  const { page, limit, skip } = getPagination(String(request.query.page || ""), String(request.query.limit || ""));
  const search = String(request.query.search || "").trim();
  const status = String(request.query.status || "").trim() as TaskStatus | "";
  const priority = String(request.query.priority || "").trim() as TaskPriority | "";
  const projectId = String(request.query.projectId || "").trim();
  const assigneeId = String(request.query.assigneeId || "").trim();
  const type = String(request.query.type || "").trim() as TaskType | "";

  const scopedProjectIds =
    request.user!.role === Role.ADMIN || request.user!.role === Role.MODERATOR
      ? undefined
      : (
          await prisma.project.findMany({
            where: {
              OR: [
                { members: { some: { userId: request.user!.id } } },
                { company: { members: { some: { userId: request.user!.id } } } },
              ],
            },
            select: { id: true },
          })
        ).map((project) => project.id);

  const resolvedProjectFilter = projectId
    ? scopedProjectIds
      ? scopedProjectIds.includes(projectId)
        ? projectId
        : "__blocked__"
      : projectId
    : scopedProjectIds
      ? { in: scopedProjectIds }
      : undefined;

  const where = {
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(resolvedProjectFilter ? { projectId: resolvedProjectFilter } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(type ? { type } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } },
        reporter: { select: { id: true, fullName: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  response.json({
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const getTaskById = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, key: true } },
      assignee: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } },
      reporter: { select: { id: true, fullName: true } },
      comments: {
        include: {
          author: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      blockedBy: { select: { id: true, title: true, status: true, priority: true } },
      blocking: { select: { id: true, title: true, status: true, priority: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!task) {
    throw new AppError("Task not found.", StatusCodes.NOT_FOUND);
  }

  const hasAccess = await canAccessProject(task.projectId, request.user!.id, request.user!.role);
  if (!hasAccess) {
    throw new AppError("Task not found or access denied.", StatusCodes.NOT_FOUND);
  }

  response.json({ item: task });
});

export const createTask = asyncHandler(async (request: Request, response: Response) => {
  const projectId = request.body.projectId as string;
  const hasAccess = await canAccessProject(projectId, request.user!.id, request.user!.role);
  const canManage = await canManageProject(projectId, request.user!.id, request.user!.role);
  const requestedAssigneeId = (request.body.assigneeId as string | undefined) || null;
  const requestedDueDate = request.body.dueDate ? new Date(request.body.dueDate) : null;

  if (!hasAccess) {
    throw new AppError("You do not have permission to create tasks in this project.", StatusCodes.FORBIDDEN);
  }

  if ((requestedAssigneeId || requestedDueDate) && !canManage) {
    throw new AppError("Only project owners and managers can assign tasks with deadlines.", StatusCodes.FORBIDDEN);
  }

  const [assignee, assigner, project] = await Promise.all([
    requestedAssigneeId ? getProjectAssignee(projectId, requestedAssigneeId) : Promise.resolve(null),
    prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, key: true, name: true },
    }),
  ]);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        projectId,
        title: sanitizePlainText(request.body.title),
        description: sanitizePlainText(request.body.description),
        status: request.body.status,
        priority: request.body.priority,
        type: request.body.type,
        storyPoints: request.body.storyPoints,
        assigneeId: requestedAssigneeId,
        reporterId: request.user!.id,
        dueDate: requestedDueDate,
        position: request.body.position || 0,
      },
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } },
        reporter: { select: { id: true, fullName: true } },
        _count: { select: { comments: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: request.user!.id,
        projectId,
        taskId: created.id,
        action: "TASK_CREATED",
        entityType: "task",
        entityId: created.id,
        metadata: { status: created.status, priority: created.priority },
      },
    });

    return created;
  });

  if (assignee) {
    await sendTaskAssignmentEmail({
      assigneeEmail: assignee.email,
      assigneeName: assignee.fullName,
      assignerEmail: assigner.email,
      assignerName: assigner.fullName,
      projectKey: project.key,
      projectName: project.name,
      taskTitle: task.title,
      taskStatus: task.status,
      taskPriority: task.priority,
      dueDate: task.dueDate,
    });
  }

  response.status(StatusCodes.CREATED).json({ message: "Task created.", item: task });
});

export const updateTask = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const existingTask = await prisma.task.findUnique({ where: { id } });

  if (!existingTask) {
    throw new AppError("Task not found.", StatusCodes.NOT_FOUND);
  }

  const hasAccess = await canAccessProject(existingTask.projectId, request.user!.id, request.user!.role);
  const canManage = await canManageProject(existingTask.projectId, request.user!.id, request.user!.role);

  if (!hasAccess) {
    throw new AppError("You do not have permission to update this task.", StatusCodes.FORBIDDEN);
  }

  const resolvedTitle =
    typeof request.body.title === "string" ? sanitizePlainText(request.body.title) : existingTask.title;
  const resolvedDescription =
    typeof request.body.description === "string"
      ? sanitizePlainText(request.body.description)
      : existingTask.description;
  const resolvedStatus = (request.body.status as TaskStatus | undefined) ?? existingTask.status;
  const resolvedPriority = (request.body.priority as TaskPriority | undefined) ?? existingTask.priority;
  const resolvedType = (request.body.type as TaskType | undefined) ?? existingTask.type;
  const resolvedStoryPoints =
    request.body.storyPoints === undefined ? existingTask.storyPoints : request.body.storyPoints;
  const requestedAssigneeId =
    request.body.assigneeId === undefined ? existingTask.assigneeId : (request.body.assigneeId as string | null);
  const requestedDueDate =
    request.body.dueDate === undefined
      ? existingTask.dueDate
      : request.body.dueDate
        ? new Date(request.body.dueDate)
        : null;
  const resolvedPosition =
    typeof request.body.position === "number" ? request.body.position : existingTask.position;

  const dueDateChanged = (existingTask.dueDate?.toISOString() || null) !== (requestedDueDate?.toISOString() || null);
  const assigneeChanged = existingTask.assigneeId !== requestedAssigneeId;

  if ((assigneeChanged || dueDateChanged) && !canManage) {
    throw new AppError("Only project owners and managers can change task assignments or deadlines.", StatusCodes.FORBIDDEN);
  }

  const [assignee, assigner, project] = await Promise.all([
    requestedAssigneeId ? getProjectAssignee(existingTask.projectId, requestedAssigneeId) : Promise.resolve(null),
    prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.project.findUniqueOrThrow({
      where: { id: existingTask.projectId },
      select: { id: true, key: true, name: true },
    }),
  ]);

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        title: resolvedTitle,
        description: resolvedDescription,
        status: resolvedStatus,
        priority: resolvedPriority,
        type: resolvedType,
        storyPoints: resolvedStoryPoints,
        assigneeId: requestedAssigneeId,
        dueDate: requestedDueDate,
        position: resolvedPosition,
      },
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } },
        reporter: { select: { id: true, fullName: true } },
        _count: { select: { comments: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: request.user!.id,
        projectId: existingTask.projectId,
        taskId: updated.id,
        action: "TASK_UPDATED",
        entityType: "task",
        entityId: updated.id,
        metadata: { status: updated.status, priority: updated.priority },
      },
    });

    return updated;
  });

  if (assigneeChanged && assignee) {
    await sendTaskAssignmentEmail({
      assigneeEmail: assignee.email,
      assigneeName: assignee.fullName,
      assignerEmail: assigner.email,
      assignerName: assigner.fullName,
      projectKey: project.key,
      projectName: project.name,
      taskTitle: task.title,
      taskStatus: task.status,
      taskPriority: task.priority,
      dueDate: task.dueDate,
    });
  }

  response.json({ message: "Task updated.", item: task });
});

export const addBlocker = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const blockerId = String(request.body.blockerId);

  if (id === blockerId) throw new AppError("A task cannot block itself.", StatusCodes.BAD_REQUEST);

  const [task, blocker] = await Promise.all([
    prisma.task.findUnique({ where: { id } }),
    prisma.task.findUnique({ where: { id: blockerId } }),
  ]);

  if (!task || !blocker) throw new AppError("Task not found.", StatusCodes.NOT_FOUND);
  if (task.projectId !== blocker.projectId) throw new AppError("Both tasks must belong to the same project.", StatusCodes.BAD_REQUEST);

  const hasAccess = await canAccessProject(task.projectId, request.user!.id, request.user!.role);
  if (!hasAccess) throw new AppError("Access denied.", StatusCodes.FORBIDDEN);

  await prisma.task.update({
    where: { id },
    data: { blockedBy: { connect: { id: blockerId } } },
  });

  response.json({ message: "Blocker added." });
});

export const removeBlocker = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const blockerId = String(request.params.blockerId);

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new AppError("Task not found.", StatusCodes.NOT_FOUND);

  const hasAccess = await canAccessProject(task.projectId, request.user!.id, request.user!.role);
  if (!hasAccess) throw new AppError("Access denied.", StatusCodes.FORBIDDEN);

  await prisma.task.update({
    where: { id },
    data: { blockedBy: { disconnect: { id: blockerId } } },
  });

  response.json({ message: "Blocker removed." });
});

export const deleteTask = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const existingTask = await prisma.task.findUnique({ where: { id } });

  if (!existingTask) {
    throw new AppError("Task not found.", StatusCodes.NOT_FOUND);
  }

  const canManage = await canManageProject(existingTask.projectId, request.user!.id, request.user!.role);
  const canDeleteOwn = request.user!.role === Role.USER && existingTask.reporterId === request.user!.id;
  if (!canManage && !canDeleteOwn) {
    throw new AppError("You do not have permission to delete this task.", StatusCodes.FORBIDDEN);
  }

  await prisma.task.delete({ where: { id } });
  response.json({ message: "Task deleted." });
});

export const bulkUpdateTasks = asyncHandler(async (request: Request, response: Response) => {
  const { ids, status, priority, assigneeId } = request.body as {
    ids: string[];
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string | null;
  };

  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true },
  });

  const projectIds = [...new Set(tasks.map((t) => t.projectId))];
  for (const projectId of projectIds) {
    const canManage = await canManageProject(projectId, request.user!.id, request.user!.role);
    if (!canManage) {
      throw new AppError("You do not have permission to update tasks in one or more of these projects.", StatusCodes.FORBIDDEN);
    }
  }

  const data: { status?: TaskStatus; priority?: TaskPriority; assigneeId?: string | null } = {};
  if (status) data.status = status;
  if (priority) data.priority = priority;
  if (assigneeId !== undefined) data.assigneeId = assigneeId;

  await prisma.task.updateMany({ where: { id: { in: ids } }, data });
  response.json({ updated: ids.length });
});
