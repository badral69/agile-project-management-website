import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import supertest from "supertest";
import bcrypt from "bcryptjs";

vi.mock("../../config/env", () => ({
  env: {
    NODE_ENV: "production",
    JWT_SECRET: "unit-test-secret-not-for-deployment",
    JWT_EXPIRES_IN: "15m",
    COOKIE_SECURE: false,
    CLIENT_URL: "http://localhost:5173",
  },
}));

vi.mock("../../config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("../../utils/mailer", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

import { prisma } from "../../config/prisma";
import { signToken } from "../../utils/jwt";
import { sendPasswordResetEmail } from "../../utils/mailer";
import authRoutes from "../../routes/auth.routes";
import { ensureCsrfCookie, requireCsrfProtection } from "../../middleware/csrf";
import { errorHandler } from "../../middleware/error-handler";

const app = express();
app.use(express.json(), cookieParser(), ensureCsrfCookie, requireCsrfProtection);
app.use("/api/auth", authRoutes);
app.use(errorHandler);

const demoEmails = ["admin@agilepm.local", "moderator@agilepm.local", "user@agilepm.local"];
const password = "TestPassword9!";
const regularUser = {
  id: "registered-user",
  email: "registered@example.com",
  fullName: "Registered User",
  role: "USER" as const,
  billingPlan: "STARTER" as const,
  avatarColor: "#2563eb",
  avatarUrl: null,
  subscriptionStatus: null,
  createdAt: new Date(),
};

async function client() {
  const agent = supertest.agent(app);
  const csrf = await agent.get("/api/auth/csrf");
  return { agent, csrf: csrf.body.csrfToken as string };
}

beforeEach(() => vi.resetAllMocks());

describe("production demo-account restrictions", () => {
  it.each(demoEmails)("rejects login for %s before checking credentials", async (email) => {
    const { agent, csrf } = await client();
    const response = await agent.post("/api/auth/login").set("x-csrf-token", csrf).send({ email, password });
    expect(response.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("normalizes demo email casing", async () => {
    const { agent, csrf } = await client();
    const response = await agent.post("/api/auth/login").set("x-csrf-token", csrf)
      .send({ email: "ADMIN@AGILEPM.LOCAL", password });
    expect(response.status).toBe(401);
  });

  it.each(demoEmails)("rejects existing access tokens for %s", async (email) => {
    const token = signToken({ id: "demo", email, role: "ADMIN" });
    const response = await supertest(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(demoEmails)("rejects and removes refresh tokens for %s", async (email) => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: "demo-refresh", expiresAt: new Date(Date.now() + 60_000), user: { ...regularUser, email },
    } as never);
    const { agent, csrf } = await client();
    const response = await agent.post("/api/auth/refresh").set("x-csrf-token", csrf)
      .set("Cookie", `agile_csrf_token=${csrf}; agile_refresh_token=old-demo-token`);
    expect(response.status).toBe(401);
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: "demo-refresh" } });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("prevents registering a reserved demo address", async () => {
    const { agent, csrf } = await client();
    const response = await agent.post("/api/auth/register").set("x-csrf-token", csrf)
      .send({ email: demoEmails[0], password });
    expect(response.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("does not send password reset links for demo accounts", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...regularUser, email: demoEmails[0] } as never);
    const { agent, csrf } = await client();
    const response = await agent.post("/api/auth/forgot-password").set("x-csrf-token", csrf)
      .send({ email: demoEmails[0] });
    expect(response.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows registered users to log in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...regularUser, passwordHash: await bcrypt.hash(password, 4),
    } as never);
    const { agent, csrf } = await client();
    const response = await agent.post("/api/auth/login").set("x-csrf-token", csrf)
      .send({ email: regularUser.email, password });
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(regularUser.email);
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });

  it("allows new visitors to register their own accounts", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(regularUser as never);
    const { agent, csrf } = await client();
    const response = await agent.post("/api/auth/register").set("x-csrf-token", csrf)
      .send({ email: regularUser.email, password, fullName: regularUser.fullName });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(regularUser.email);
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });
});
