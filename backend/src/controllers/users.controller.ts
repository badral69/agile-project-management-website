import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/async-handler";
import { getPagination } from "../utils/pagination";

export const listUsers = asyncHandler(async (request: Request, response: Response) => {
  const { page, limit, skip } = getPagination(String(request.query.page || ""), String(request.query.limit || ""));
  const search = String(request.query.search || "").trim();
  const role = String(request.query.role || "").trim() as Role | "";

  const where = {
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role ? { role } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        avatarColor: true,
        avatarUrl: true,
        createdAt: true,
        companyMemberships: {
          select: {
            id: true,
            memberRole: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            memberships: true,
            assignedTasks: true,
            companyMemberships: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
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

export const listDirectoryUsers = asyncHandler(async (request: Request, response: Response) => {
  const search = String(request.query.search || "").trim();

  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const items = await prisma.user.findMany({
    where,
    orderBy: [{ fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: {
          memberships: true,
          assignedTasks: true,
          companyMemberships: true,
        },
      },
    },
    take: 200,
  });

  response.json({ items });
});

export const updateUserRole = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);
  const { role } = request.body as { role: Role };

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role },
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

  response.json({ message: "User role updated.", user: updatedUser });
});

export const deleteOwnAccount = asyncHandler(async (request: Request, response: Response) => {
  const userId = request.user!.id;

  // FK cascades handle cleanup automatically:
  // - RefreshToken, TimeLog, ProjectMember, CompanyMember, Comment, Attachment → Cascade (deleted)
  // - ActivityLog, Task.reporter, Project.owner, Company.createdBy → SetNull (preserved)
  await prisma.user.delete({ where: { id: userId } });

  response.clearCookie("agile_access_token");
  response.clearCookie("agile_refresh_token");
  response.json({ message: "Account deleted. Your projects and tasks have been preserved." });
});

export const exportOwnData = asyncHandler(async (request: Request, response: Response) => {
  const userId = request.user!.id;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      ownedProjects: { select: { id: true, name: true, key: true, status: true, createdAt: true } },
      memberships: { include: { project: { select: { id: true, name: true, key: true } } } },
      assignedTasks: { select: { id: true, title: true, status: true, priority: true, createdAt: true } },
      reportedTasks: { select: { id: true, title: true, status: true, createdAt: true } },
      comments: { select: { id: true, body: true, createdAt: true } },
      timeLogs: { select: { id: true, hours: true, note: true, loggedAt: true } },
      activities: { select: { id: true, action: true, entityType: true, createdAt: true } },
    },
  });

  const { passwordHash, passwordResetCodeHash, emailVerificationToken, ...safeUser } = user as typeof user & { passwordHash: string; passwordResetCodeHash: string | null; emailVerificationToken: string | null };

  response.setHeader("Content-Disposition", `attachment; filename="sprintflow-data-${userId}.json"`);
  response.json({ exportedAt: new Date().toISOString(), data: safeUser });
});

export const deleteUser = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);

  if (request.user!.id === id) {
    return response.status(StatusCodes.BAD_REQUEST).json({ message: "You cannot delete your own account." });
  }

  await prisma.user.delete({ where: { id } });
  response.json({ message: "User deleted." });
});
