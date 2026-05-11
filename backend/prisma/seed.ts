import bcrypt from "bcryptjs";
import { PrismaClient, ProjectMemberRole, ProjectStatus, Role, TaskPriority, TaskStatus, TaskType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const [admin, moderator, user] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@agilepm.local" },
      update: {},
      create: {
        fullName: "System Admin",
        email: "admin@agilepm.local",
        passwordHash,
        role: Role.ADMIN,
        avatarColor: "#0f172a",
      },
    }),
    prisma.user.upsert({
      where: { email: "moderator@agilepm.local" },
      update: {},
      create: {
        fullName: "Delivery Moderator",
        email: "moderator@agilepm.local",
        passwordHash,
        role: Role.MODERATOR,
        avatarColor: "#0f766e",
      },
    }),
    prisma.user.upsert({
      where: { email: "user@agilepm.local" },
      update: {},
      create: {
        fullName: "Project User",
        email: "user@agilepm.local",
        passwordHash,
        role: Role.USER,
        avatarColor: "#b45309",
      },
    }),
  ]);

  const project = await prisma.project.upsert({
    where: { key: "AGILE" },
    update: {},
    create: {
      key: "AGILE",
      name: "Agile Transformation Portal",
      description: "OpenProject-inspired diploma showcase for planning, tracking, and collaborative delivery.",
      status: ProjectStatus.ACTIVE,
      ownerId: admin.id,
      startDate: new Date(),
      members: {
        create: [
          { userId: admin.id, memberRole: ProjectMemberRole.OWNER },
          { userId: moderator.id, memberRole: ProjectMemberRole.MANAGER },
          { userId: user.id, memberRole: ProjectMemberRole.CONTRIBUTOR },
        ],
      },
    },
  });

  const task = await prisma.task.upsert({
    where: { id: "seed-task-1" },
    update: {},
    create: {
      id: "seed-task-1",
      projectId: project.id,
      reporterId: admin.id,
      assigneeId: moderator.id,
      title: "Design sprint planning workflow",
      description: "Create sprint planning flow, define work package states, and align the board experience.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      type: TaskType.STORY,
      storyPoints: 8,
      position: 1,
    },
  });

  await prisma.comment.deleteMany({
    where: { taskId: task.id },
  });

  await prisma.comment.createMany({
    data: [
      {
        taskId: task.id,
        authorId: admin.id,
        body: "Kickoff approved. Keep the structure aligned with portfolio-level reporting.",
      },
      {
        taskId: task.id,
        authorId: moderator.id,
        body: "Board columns are ready for review once filtering is connected to the API.",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.activityLog.deleteMany({
    where: {
      OR: [{ projectId: project.id }, { taskId: task.id }],
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        actorId: admin.id,
        projectId: project.id,
        action: "PROJECT_CREATED",
        entityType: "project",
        entityId: project.id,
        metadata: { key: "AGILE" },
      },
      {
        actorId: moderator.id,
        projectId: project.id,
        taskId: task.id,
        action: "TASK_UPDATED",
        entityType: "task",
        entityId: task.id,
        metadata: { status: TaskStatus.IN_PROGRESS },
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
