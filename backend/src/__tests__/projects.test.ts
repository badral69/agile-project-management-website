import { describe, it, expect, beforeEach } from "vitest";
import { loginClient } from "./helpers/client";
import { makeUser, makeProject, makeSprint, testPassword } from "./helpers/factories";
import { resetDatabase } from "./setup";

beforeEach(async () => {
  await resetDatabase();
});

describe("POST /api/projects", () => {
  it("creates a project and returns 201 with the owner as a member", async () => {
    const owner = await makeUser({ email: "owner@proj.com" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post("/projects", {
      name: "Alpha Project",
      key: "ALPHA",
      description: "First project description here",
      status: "ACTIVE",
    });

    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe("Alpha Project");
    expect(res.body.item.key).toBe("ALPHA");
  });

  it("returns 400 when key is missing", async () => {
    const owner = await makeUser({ email: "owner2@proj.com" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post("/projects", {
      name: "No Key Project",
      description: "Missing key description here",
      status: "ACTIVE",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/projects", () => {
  it("returns only projects the user is a member of", async () => {
    const owner = await makeUser({ email: "list@proj.com" });
    const other = await makeUser({ email: "other@proj.com" });
    await makeProject(owner.id, { name: "Mine" });
    await makeProject(other.id, { name: "Not Mine" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.get("/projects");

    expect(res.status).toBe(200);
    const names = (res.body.items as Array<{ name: string }>).map((p) => p.name);
    expect(names).toContain("Mine");
    expect(names).not.toContain("Not Mine");
  });
});

describe("GET /api/projects/:id", () => {
  it("returns 404 when user is not a project member", async () => {
    const owner = await makeUser({ email: "owner3@proj.com" });
    const outsider = await makeUser({ email: "outsider@proj.com" });
    const project = await makeProject(owner.id);
    const client = await loginClient({ email: outsider.email, password: testPassword });

    const res = await client.get(`/projects/${project.id}`);

    expect(res.status).toBe(404);
  });
});

describe("Sprints", () => {
  it("creates a sprint for a project", async () => {
    const owner = await makeUser({ email: "sprint@proj.com" });
    const project = await makeProject(owner.id);
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post(`/sprints/projects/${project.id}/sprints`, {
      name: "Sprint 1",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe("Sprint 1");
  });

  it("saves retrospective note when sprint is completed", async () => {
    const owner = await makeUser({ email: "retro@proj.com" });
    const project = await makeProject(owner.id);
    const sprint = await makeSprint(project.id);
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.put(`/sprints/sprints/${sprint.id}`, {
      name: sprint.name,
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      status: "COMPLETED",
      retrospective: "Great sprint, improved velocity by 20%.",
    });

    expect(res.status).toBe(200);
    expect(res.body.item.retrospective).toBe("Great sprint, improved velocity by 20%.");
  });
});
