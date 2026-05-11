import { CompanyMemberRole, Role } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { getPagination } from "../utils/pagination";
import { sanitizePlainText } from "../utils/sanitize";

const buildSlug = (value: string) =>
  sanitizePlainText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const listCompanies = asyncHandler(async (request: Request, response: Response) => {
  const search = String(request.query.search || "").trim();
  const { page, limit, skip } = getPagination(
    String(request.query.page || ""),
    String(request.query.limit || ""),
  );

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(request.user!.role === Role.ADMIN
      ? {}
      : {
          members: {
            some: {
              userId: request.user!.id,
            },
          },
        }),
  };

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                avatarColor: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
      skip,
      take: limit,
    }),
    prisma.company.count({ where }),
  ]);

  response.json({
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

export const createCompany = asyncHandler(async (request: Request, response: Response) => {
  const name = sanitizePlainText(String(request.body.name || ""));
  const description = request.body.description ? sanitizePlainText(String(request.body.description)) : null;
  const slugInput = String(request.body.slug || "").trim();
  const slug = buildSlug(slugInput || name);

  if (!slug) {
    throw new AppError("Company slug is required.", StatusCodes.BAD_REQUEST);
  }

  const company = await prisma.company.create({
    data: {
      name,
      description,
      slug,
      createdById: request.user!.id,
    },
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatarColor: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  response.status(StatusCodes.CREATED).json({ message: "Company created.", item: company });
});

const assertCanManageCompany = async (companyId: string, requestUser: { id: string; role: string }) => {
  if (requestUser.role === Role.ADMIN) return;
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: requestUser.id } },
  });
  if (!membership || membership.memberRole !== CompanyMemberRole.SUPERVISOR) {
    throw new AppError("Only admins or supervisors of this company can manage members.", StatusCodes.FORBIDDEN);
  }
};

export const addCompanyMember = asyncHandler(async (request: Request, response: Response) => {
  const companyId = String(request.params.id);
  const userId = String(request.body.userId);
  const memberRole = request.body.memberRole as CompanyMemberRole;

  await assertCanManageCompany(companyId, request.user!);

  const existing = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });

  if (existing) {
    throw new AppError("This user is already in the company.", StatusCodes.CONFLICT);
  }

  const item = await prisma.companyMember.create({
    data: {
      companyId,
      userId,
      memberRole,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          avatarColor: true,
          avatarUrl: true,
        },
      },
    },
  });

  response.status(StatusCodes.CREATED).json({ message: "Company member added.", item });
});

export const updateCompanyMember = asyncHandler(async (request: Request, response: Response) => {
  const companyId = String(request.params.id);
  const memberId = String(request.params.memberId);
  const memberRole = request.body.memberRole as CompanyMemberRole;

  await assertCanManageCompany(companyId, request.user!);

  const existing = await prisma.companyMember.findUnique({ where: { id: memberId } });
  if (!existing || existing.companyId !== companyId) {
    throw new AppError("Company member not found.", StatusCodes.NOT_FOUND);
  }

  const item = await prisma.companyMember.update({
    where: { id: memberId },
    data: { memberRole },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          avatarColor: true,
          avatarUrl: true,
        },
      },
    },
  });

  response.json({ message: "Company member updated.", item });
});

export const removeCompanyMember = asyncHandler(async (request: Request, response: Response) => {
  const companyId = String(request.params.id);
  const memberId = String(request.params.memberId);

  await assertCanManageCompany(companyId, request.user!);

  const existing = await prisma.companyMember.findUnique({ where: { id: memberId } });
  if (!existing || existing.companyId !== companyId) {
    throw new AppError("Company member not found.", StatusCodes.NOT_FOUND);
  }

  await prisma.companyMember.delete({ where: { id: memberId } });
  response.json({ message: "Company member removed." });
});

export const getCompany = asyncHandler(async (request: Request, response: Response) => {
  const id = String(request.params.id);

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true, projects: true } },
      members: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, role: true, avatarColor: true, avatarUrl: true },
          },
        },
        orderBy: [{ memberRole: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!company) throw new AppError("Company not found.", StatusCodes.NOT_FOUND);

  if (request.user!.role !== Role.ADMIN) {
    const isMember = company.members.some((m) => m.userId === request.user!.id);
    if (!isMember) throw new AppError("Not authorized.", StatusCodes.FORBIDDEN);
  }

  response.json({ item: company });
});

export const getCompanyTasks = asyncHandler(async (request: Request, response: Response) => {
  const companyId = String(request.params.id);
  const user = request.user!;

  const membership = user.role !== Role.ADMIN
    ? await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: user.id } },
      })
    : null;

  if (user.role !== Role.ADMIN && !membership) {
    throw new AppError("Not authorized.", StatusCodes.FORBIDDEN);
  }

  const workerIds = (
    await prisma.companyMember.findMany({
      where: { companyId, memberRole: CompanyMemberRole.WORKER },
      select: { userId: true },
    })
  ).map((m) => m.userId);

  const tasks = await prisma.task.findMany({
    where: workerIds.length ? { assigneeId: { in: workerIds } } : { id: "__none__" },
    include: {
      assignee: { select: { id: true, fullName: true, avatarColor: true, avatarUrl: true } },
      project: { select: { id: true, key: true, name: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  response.json({ items: tasks });
});
