import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../config/prisma";
import { TestClient, loginClient } from "./helpers/client";
import { makeUser, makeProject, makeTask, testPassword } from "./helpers/factories";
import { resetDatabase } from "./setup";

beforeEach(async () => {
  await resetDatabase();
});

describe("GET /api/users/me/export", () => {
  it("returns a JSON file with the user's data", async () => {
    const user = await makeUser({ email: "export@gdpr.com" });
    const project = await makeProject(user.id);
    await makeTask(project.id, user.id, { title: "My exported task" });
    const client = await loginClient({ email: user.email, password: testPassword });

    const res = await client.get("/users/me/export");

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.exportedAt).toBeTruthy();
  });

  it("does not expose passwordHash or emailVerificationToken in export", async () => {
    const user = await makeUser({ email: "safe@gdpr.com" });
    const client = await loginClient({ email: user.email, password: testPassword });

    const res = await client.get("/users/me/export");

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty("passwordHash");
    expect(res.body.data).not.toHaveProperty("passwordResetCodeHash");
    expect(res.body.data).not.toHaveProperty("emailVerificationToken");
  });

  it("returns 401 for unauthenticated requests", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.get("/users/me/export");

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/users/me", () => {
  it("permanently deletes the account and all associated data", async () => {
    const user = await makeUser({ email: "delete@gdpr.com" });
    const project = await makeProject(user.id);
    await makeTask(project.id, user.id);
    const client = await loginClient({ email: user.email, password: testPassword });

    const res = await client.del("/users/me");

    expect(res.status).toBe(200);

    const deleted = await prisma.user.findUnique({ where: { id: user.id } });
    expect(deleted).toBeNull();

    // Cascade: tasks and projects owned by this user should also be gone
    const projects = await prisma.project.findMany({ where: { ownerId: user.id } });
    expect(projects.length).toBe(0);
  });

  it("after account deletion, subsequent requests return 401", async () => {
    const user = await makeUser({ email: "delete2@gdpr.com" });
    const client = await loginClient({ email: user.email, password: testPassword });
    await client.del("/users/me");

    const res = await client.get("/auth/me");
    expect(res.status).toBe(401);
  });
});
