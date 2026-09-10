import { CompanyMemberRole, ProjectMemberRole, Role } from "@prisma/client";
import { prisma } from "../config/prisma";

export type ProjectPermissions = { canAccess: boolean; canManage: boolean };

/**
 * Single-query implementation: fetches the caller's project membership AND company
 * membership in one round trip, then derives both access and manage rights from the result.
 *
 * Permission matrix:
 *   ADMIN     → canAccess: true, canManage: true  (full platform control)
 *   MODERATOR → canAccess: true, canManage: membership-based only
 *               (can read any project for platform moderation, but cannot
 *                mutate projects unless they hold OWNER/MANAGER/SUPERVISOR)
 *   USER      → both rights require explicit project or company membership
 */
export const getProjectPermissions = async (
  projectId: string,
  userId: string,
  role: Role,
): Promise<ProjectPermissions> => {
  if (role === Role.ADMIN) return { canAccess: true, canManage: true };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      members: {
        where: { userId },
        select: { memberRole: true },
        take: 1,
      },
      company: {
        select: {
          members: {
            where: { userId },
            select: { memberRole: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) return { canAccess: false, canManage: false };

  const projectMember = project.members[0];
  const companyMember = project.company?.members[0];

  const canManage =
    projectMember?.memberRole === ProjectMemberRole.OWNER ||
    projectMember?.memberRole === ProjectMemberRole.MANAGER ||
    companyMember?.memberRole === CompanyMemberRole.SUPERVISOR;

  const membershipExists = Boolean(projectMember || companyMember);

  // MODERATORs always get read access; manage requires an actual membership role
  if (role === Role.MODERATOR) return { canAccess: true, canManage };

  return { canAccess: membershipExists, canManage };
};

/** Convenience wrappers for call sites that only need one right. */
export const canAccessProject = async (projectId: string, userId: string, role: Role): Promise<boolean> => {
  const { canAccess } = await getProjectPermissions(projectId, userId, role);
  return canAccess;
};

export const canManageProject = async (projectId: string, userId: string, role: Role): Promise<boolean> => {
  const { canManage } = await getProjectPermissions(projectId, userId, role);
  return canManage;
};
