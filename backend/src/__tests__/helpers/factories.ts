import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma";

let counter = 0;
const uid = () => `${Date.now()}${++counter}`;

export const makeUser = async (overrides: { email?: string; password?: string; role?: "ADMIN" | "MODERATOR" | "USER"; emailVerified?: boolean } = {}) => {
  const password = overrides.password ?? "Password1!";
  return prisma.user.create({
    data: {
      fullName: `Test User ${uid()}`,
      email: overrides.email ?? `user${uid()}@test.com`,
      passwordHash: await bcrypt.hash(password, 4),
      emailVerified: overrides.emailVerified ?? true,
      role: overrides.role ?? "USER",
    },
  });
};

export const makeProject = async (ownerId: string, overrides: { name?: string } = {}) => {
  const id = uid();
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const project = await prisma.project.create({
    data: {
      name: overrides.name ?? `Project ${id}`,
      key: `P${randomSuffix}`,
      description: "Test project",
      ownerId,
    },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: ownerId, memberRole: "OWNER" },
  });
  return project;
};

export const makeTask = async (projectId: string, reporterId: string, overrides: Partial<{ title: string; assigneeId: string }> = {}) => {
  return prisma.task.create({
    data: {
      title: overrides.title ?? `Task ${uid()}`,
      description: "Test task",
      projectId,
      reporterId,
      assigneeId: overrides.assigneeId,
    },
  });
};

export const makeSprint = async (projectId: string) => {
  return prisma.sprint.create({
    data: {
      name: `Sprint ${uid()}`,
      projectId,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
};

export const testPassword = "Password1!";
