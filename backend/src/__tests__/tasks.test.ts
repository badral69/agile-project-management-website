import { describe, it, expect, beforeEach } from "vitest";
import { loginClient, TestClient } from "./helpers/client";
import { makeUser, makeProject, makeTask, testPassword } from "./helpers/factories";
import { resetDatabase } from "./setup";

beforeEach(async () => {
  await resetDatabase();
});

describe("POST /api/tasks", () => {
  it("creates a task and returns 201", async () => {
    const owner = await makeUser({ email: "owner@tasks.com" });
    const project = await makeProject(owner.id);
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post("/tasks", {
      title: "Implement login",
      description: "Build the login flow",
      projectId: project.id,
      status: "TODO",
      priority: "HIGH",
      type: "TASK",
    });

    expect(res.status).toBe(201);
    expect(res.body.item.title).toBe("Implement login");
    expect(res.body.item.projectId).toBe(project.id);
  });

  it("returns 401 when not authenticated", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner.id);
    const client = new TestClient();
    await client.init();

    const res = await client.post("/tasks", {
      title: "Unauthorised task",
      description: "Should fail",
      projectId: project.id,
      type: "TASK",
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const owner = await makeUser({ email: "owner2@tasks.com" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post("/tasks", { description: "no title or project" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/tasks", () => {
  it("returns tasks filtered by projectId", async () => {
    const owner = await makeUser({ email: "list@tasks.com" });
    const project = await makeProject(owner.id);
    await makeTask(project.id, owner.id, { title: "Task A" });
    await makeTask(project.id, owner.id, { title: "Task B" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.get(`/tasks?projectId=${project.id}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe("PATCH /api/tasks/:id", () => {
  it("updates task status", async () => {
    const owner = await makeUser({ email: "update@tasks.com" });
    const project = await makeProject(owner.id);
    const task = await makeTask(project.id, owner.id);
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.patch(`/tasks/${task.id}`, { status: "IN_PROGRESS" });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe("IN_PROGRESS");
  });

  it("returns 403 when user is not a project member", async () => {
    const owner = await makeUser({ email: "owner3@tasks.com" });
    const outsider = await makeUser({ email: "outsider@tasks.com" });
    const project = await makeProject(owner.id);
    const task = await makeTask(project.id, owner.id);
    const client = await loginClient({ email: outsider.email, password: testPassword });

    const res = await client.patch(`/tasks/${task.id}`, { status: "DONE" });

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/tasks/bulk", () => {
  it("updates status of multiple tasks at once", async () => {
    const owner = await makeUser({ email: "bulk@tasks.com" });
    const project = await makeProject(owner.id);
    const t1 = await makeTask(project.id, owner.id);
    const t2 = await makeTask(project.id, owner.id);
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.patch("/tasks/bulk", {
      ids: [t1.id, t2.id],
      status: "REVIEW",
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
  });
});

describe("POST /api/tasks/:taskId/timelogs", () => {
  it("logs hours against a task", async () => {
    const owner = await makeUser({ email: "timelog@tasks.com" });
    const project = await makeProject(owner.id);
    const task = await makeTask(project.id, owner.id);
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post(`/tasks/${task.id}/timelogs`, { hours: 3.5, note: "Worked on API" });

    expect(res.status).toBe(201);
    expect(res.body.item.hours).toBe(3.5);
  });

  it("returns the total hours logged for a task", async () => {
    const owner = await makeUser({ email: "timelog2@tasks.com" });
    const project = await makeProject(owner.id);
    const task = await makeTask(project.id, owner.id);
    const client = await loginClient({ email: owner.email, password: testPassword });
    await client.post(`/tasks/${task.id}/timelogs`, { hours: 2 });
    await client.post(`/tasks/${task.id}/timelogs`, { hours: 1.5 });

    const res = await client.get(`/tasks/${task.id}/timelogs`);

    expect(res.status).toBe(200);
    expect(res.body.totalHours).toBeCloseTo(3.5);
    expect(res.body.items.length).toBe(2);
  });
});
