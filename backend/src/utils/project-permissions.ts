import { CompanyMemberRole, ProjectMemberRole, Role } from "@prisma/client";
import { prisma } from "../config/prisma";

export const getProjectMembership = async (projectId: string, userId: string) => {
  return prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });
};

export const canManageProject = async (projectId: string, userId: string, role: Role) => {
  if (role === Role.ADMIN || role === Role.MODERATOR) {
    return true;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });

  const membership = await getProjectMembership(projectId, userId);
  if (membership?.memberRole === ProjectMemberRole.OWNER || membership?.memberRole === ProjectMemberRole.MANAGER) {
    return true;
  }

  if (!project?.companyId) {
    return false;
  }

  const companyMembership = await prisma.companyMember.findUnique({
    where: {
      companyId_userId: {
        companyId: project.companyId,
        userId,
      },
    },
  });

  return companyMembership?.memberRole === CompanyMemberRole.SUPERVISOR;
};

export const canAccessProject = async (projectId: string, userId: string, role: Role) => {
  if (role === Role.ADMIN || role === Role.MODERATOR) {
    return true;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });

  const membership = await getProjectMembership(projectId, userId);
  if (membership) {
    return true;
  }

  if (!project?.companyId) {
    return false;
  }

  const companyMembership = await prisma.companyMember.findUnique({
    where: {
      companyId_userId: {
        companyId: project.companyId,
        userId,
      },
    },
  });

  return Boolean(companyMembership);
};
