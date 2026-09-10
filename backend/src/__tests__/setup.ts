import { config } from "dotenv";
import path from "path";

// Load test env before any module that reads process.env
config({ path: path.resolve(process.cwd(), ".env.test"), override: true });

import { prisma } from "../config/prisma";

// Truncate all tables in dependency order before each test file
beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export async function resetDatabase() {
  const tables = [
    "RefreshToken",
    "TimeLog",
    "ActivityLog",
    "Comment",
    "SprintTask",
    "Sprint",
    "Attachment",
    "Task",
    "ProjectMember",
    "Project",
    "CompanyMember",
    "Company",
    "User",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }
}
