import { CompanyMemberRole, ProjectMemberRole, ProjectStatus, Role, TaskStatus } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { getPagination } from "../utils/pagination";
import { canAccessProject, canManageProject } from "../utils/project-permissions";
import { sanitizePlainText } from "../utils/sanitize";

const buildProjectWhere = (request: Request) => {
  const search = String(request.query.search || "").trim();
  const status = String(request.query.status || "").trim() as ProjectStatus | "";

  return {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { key: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(request.user!.role === Role.ADMIN || request.user!.role === Role.MODERATOR
      ? {}
      : {
          OR: [
            {
              members: {
                some: {
                  userId: request.user!.id,
                },
              },
            },
            {
              company: {
                members: {
                  some: {
                    userId: request.user!.id,
                  },
                },
              },
            },
          ],
        }),
  };
};

export const listProjects = asyncHandler(async (request: Request, response: Response) => {
  const { page, limit, skip } = getPagination(String(request.query.page || ""), String(request.query.limit || ""));
  const where = buildProjectWhere(request);

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        owner: { select: { id: true, fullName: true, role: true } },
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { tasks: true, members: true } },
      },
    }),
    prisma.project.count({ where }),
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

export const getProjectById = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const hasAccess = await canAccessProject(id, request.user!.id, request.user!.role);

  if (!hasAccess) {
    throw new AppError("Project not found or access denied.", StatusCodes.NOT_FOUND);
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, fullName: true, email: true, role: true } },
      company: { select: { id: true, name: true, slug: true } },
      members: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, role: true, avatarColor: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
        include: {
          assignee: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } },
          reporter: { select: { id: true, fullName: true } },
          _count: { select: { comments: true } },
        },
      },
      activities: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, fullName: true, role: true } },
        },
      },
      _count: { select: { tasks: true, members: true } },
    },
  });

  if (!project) {
    throw new AppError("Project not found.", StatusCodes.NOT_FOUND);
  }

  response.json({ item: project });
});

export const createProject = asyncHandler(async (request: Request, response: Response) => {
  const name = sanitizePlainText(request.body.name);
  const key = sanitizePlainText(request.body.key).toUpperCase();
  const description = sanitizePlainText(request.body.description);
  const companyId = typeof request.body.companyId === "string" && request.body.companyId.trim() ? String(request.body.companyId) : null;

  if (companyId && request.user!.role !== Role.ADMIN && request.user!.role !== Role.MODERATOR) {
    const membership = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: request.user!.id,
        },
      },
    });

    if (!membership || membership.memberRole !== CompanyMemberRole.SUPERVISOR) {
      throw new AppError("Only admins or company supervisors can create projects for that company.", StatusCodes.FORBIDDEN);
    }
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name,
        key,
        description,
        status: request.body.status || ProjectStatus.PLANNING,
        startDate: request.body.startDate ? new Date(request.body.startDate) : null,
        endDate: request.body.endDate ? new Date(request.body.endDate) : null,
        companyId,
        ownerId: request.user!.id,
        members: {
          create: {
            userId: request.user!.id,
            memberRole: ProjectMemberRole.OWNER,
          },
        },
      },
      include: {
        owner: { select: { id: true, fullName: true, role: true } },
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { tasks: true, members: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: request.user!.id,
        projectId: created.id,
        action: "PROJECT_CREATED",
        entityType: "project",
        entityId: created.id,
        metadata: { key: created.key },
      },
    });

    return created;
  });

  response.status(StatusCodes.CREATED).json({ message: "Project created.", item: project });
});

export const updateProject = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const canManage = await canManageProject(id, request.user!.id, request.user!.role);

  if (!canManage) {
    throw new AppError("You do not have permission to update this project.", StatusCodes.FORBIDDEN);
  }

  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: {
        name: sanitizePlainText(request.body.name),
        key: sanitizePlainText(request.body.key).toUpperCase(),
        description: sanitizePlainText(request.body.description),
        status: request.body.status,
        startDate: request.body.startDate ? new Date(request.body.startDate) : null,
        endDate: request.body.endDate ? new Date(request.body.endDate) : null,
        companyId: typeof request.body.companyId === "string" && request.body.companyId.trim() ? String(request.body.companyId) : null,
      },
      include: {
        owner: { select: { id: true, fullName: true, role: true } },
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { tasks: true, members: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: request.user!.id,
        projectId: id,
        action: "PROJECT_UPDATED",
        entityType: "project",
        entityId: id,
        metadata: { status: updated.status },
      },
    });

    return updated;
  });

  response.json({ message: "Project updated.", item: project });
});

export const deleteProject = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const canManage = await canManageProject(id, request.user!.id, request.user!.role);

  if (!canManage) {
    throw new AppError("You do not have permission to delete this project.", StatusCodes.FORBIDDEN);
  }

  await prisma.project.delete({ where: { id } });
  response.json({ message: "Project deleted." });
});

export const getProjectBoard = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const hasAccess = await canAccessProject(id, request.user!.id, request.user!.role);

  if (!hasAccess) {
    throw new AppError("Project not found or access denied.", StatusCodes.NOT_FOUND);
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: id },
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
    include: {
      assignee: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } },
    },
  });

  const columns = Object.values(TaskStatus).map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));

  response.json({ columns });
});
