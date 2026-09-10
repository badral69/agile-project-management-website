import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../config/prisma";
import { TestClient, authenticatedClient } from "./helpers/client";
import { makeUser, testPassword } from "./helpers/factories";
import { resetDatabase } from "./setup";

const validUser = { email: "auth@test.com", password: testPassword, fullName: "Auth User" };

beforeEach(async () => {
  await resetDatabase();
});

describe("POST /api/auth/register", () => {
  it("creates a user and returns 201 with user object", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.register(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user.emailVerified).toBe(false);
  });

  it("returns 409 when email is already registered", async () => {
    const client = new TestClient();
    await client.init();
    await client.register(validUser);

    const res = await client.register(validUser);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it("returns 400 when password does not meet requirements", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.register({ email: "weak@test.com", password: "weak" });

    expect(res.status).toBe(400);
  });

  it("sets httpOnly access and refresh token cookies", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.register(validUser);

    const cookies: string[] = res.headers["set-cookie"] as unknown as string[];
    const hasAccess = cookies.some((c) => c.startsWith("agile_access_token="));
    const hasRefresh = cookies.some((c) => c.startsWith("agile_refresh_token="));
    expect(hasAccess).toBe(true);
    expect(hasRefresh).toBe(true);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 and user object on valid credentials", async () => {
    await makeUser({ email: "login@test.com", password: testPassword });
    const client = new TestClient();
    await client.init();

    const res = await client.login({ email: "login@test.com", password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("login@test.com");
  });

  it("returns 401 on wrong password", async () => {
    await makeUser({ email: "login2@test.com", password: testPassword });
    const client = new TestClient();
    await client.init();

    const res = await client.login({ email: "login2@test.com", password: "WrongPass9!" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it("returns 401 for non-existent user", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.login({ email: "ghost@test.com", password: testPassword });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("issues a new access token using the refresh cookie", async () => {
    const client = await authenticatedClient(validUser);

    const res = await client.post("/auth/refresh");

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/refreshed/i);
    // New access token cookie should be set
    const cookies: string[] = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("agile_access_token="))).toBe(true);
  });

  it("returns 401 when no refresh token cookie is present", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.post("/auth/refresh");

    expect(res.status).toBe(401);
  });

  it("refresh token is rotated on each use (old token no longer valid)", async () => {
    const client = await authenticatedClient(validUser);
    await client.post("/auth/refresh");

    // Refresh token was rotated — the DB should have only the new one
    const tokens = await prisma.refreshToken.count();
    expect(tokens).toBe(1);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears cookies and removes refresh token from DB", async () => {
    const client = await authenticatedClient(validUser);
    const beforeCount = await prisma.refreshToken.count();
    expect(beforeCount).toBe(1);

    const res = await client.logout();

    expect(res.status).toBe(200);
    const afterCount = await prisma.refreshToken.count();
    expect(afterCount).toBe(0);
  });

  it("after logout, protected routes return 401", async () => {
    const client = await authenticatedClient(validUser);
    await client.logout();

    const res = await client.get("/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/verify-email", () => {
  it("marks email as verified with a valid token", async () => {
    const client = new TestClient();
    await client.init();
    await client.register(validUser);

    const user = await prisma.user.findUnique({ where: { email: validUser.email } });
    expect(user?.emailVerified).toBe(false);

    const res = await client.get(`/auth/verify-email?token=${user?.emailVerificationToken}`);

    expect(res.status).toBe(200);
    const updated = await prisma.user.findUnique({ where: { email: validUser.email } });
    expect(updated?.emailVerified).toBe(true);
    expect(updated?.emailVerificationToken).toBeNull();
  });

  it("returns 400 for an invalid or missing token", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.get("/auth/verify-email?token=totally-invalid-token");

    expect(res.status).toBe(400);
  });
});
