import { ProjectMemberRole } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { canManageProject } from "../utils/project-permissions";

export const searchAvailableProjectUsers = asyncHandler(async (request: Request, response: Response) => {
  const projectId = String(request.params.id);
  const search = String(request.query.search || "").trim();
  const canManage = await canManageProject(projectId, request.user!.id, request.user!.role);

  if (!canManage) {
    throw new AppError("You do not have permission to search project members.", StatusCodes.FORBIDDEN);
  }

  if (search.length < 2) {
    return response.json({ items: [] });
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });

  const items = await prisma.user.findMany({
    where: {
      id: { notIn: members.map((member) => member.userId) },
      ...(project?.companyId
        ? {
            companyMemberships: {
              some: {
                companyId: project.companyId,
              },
            },
          }
        : {}),
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    take: 8,
    orderBy: [{ fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  response.json({ items });
});

export const addProjectMember = asyncHandler(async (request: Request, response: Response) => {
  const projectId = String(request.params.id);
  const canManage = await canManageProject(projectId, request.user!.id, request.user!.role);

  if (!canManage) {
    throw new AppError("You do not have permission to manage project members.", StatusCodes.FORBIDDEN);
  }

  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: String(request.body.userId),
      },
    },
  });

  if (existingMember) {
    throw new AppError("This user is already a member of the project.", StatusCodes.CONFLICT);
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: String(request.body.userId),
      memberRole: request.body.memberRole as ProjectMemberRole,
    },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, role: true, avatarColor: true, avatarUrl: true },
      },
    },
  });

  response.status(StatusCodes.CREATED).json({ message: "Member added.", item: member });
});

export const removeProjectMember = asyncHandler(async (request: Request, response: Response) => {
  const projectId = String(request.params.id);
  const memberId = String(request.params.memberId);
  const canManage = await canManageProject(projectId, request.user!.id, request.user!.role);

  if (!canManage) {
    throw new AppError("You do not have permission to manage project members.", StatusCodes.FORBIDDEN);
  }

  const member = await prisma.projectMember.findUnique({
    where: { id: memberId },
  });

  if (!member || member.projectId !== projectId) {
    throw new AppError("Project member not found.", StatusCodes.NOT_FOUND);
  }

  if (member.memberRole === ProjectMemberRole.OWNER) {
    throw new AppError("The project owner cannot be removed from the project.", StatusCodes.BAD_REQUEST);
  }

  await prisma.projectMember.delete({
    where: { id: memberId },
  });

  response.json({ message: "Member removed." });
});
