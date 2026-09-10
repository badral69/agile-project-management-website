import bcrypt from "bcryptjs";
import crypto from "crypto";
import { BillingPlan, Role } from "@prisma/client";
import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { signToken } from "../utils/jwt";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/mailer";
import { getAiEntitlements } from "../utils/plan-entitlements";
import { sanitizePlainText } from "../utils/sanitize";
import { getCsrfTokenFromResponse, setCsrfCookie } from "../middleware/csrf";

const ACCESS_COOKIE = "agile_access_token";
const REFRESH_COOKIE = "agile_refresh_token";

const accessCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const issueRefreshToken = async (userId: string): Promise<string> => {
  const raw = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
};

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const serializeUser = (user: {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarColor: string;
  avatarUrl: string | null;
  googleId?: string | null;
  billingPlan: BillingPlan;
  subscriptionStatus: string | null;
  emailVerified?: boolean;
  companyMemberships?: Array<{
    companyId: string;
    companyName: string;
    companySlug: string;
    memberRole: "SUPERVISOR" | "WORKER";
  }>;
  createdAt: Date;
}) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatarColor: user.avatarColor,
  avatarUrl: user.avatarUrl,
  googleConnected: Boolean(user.googleId),
  billingPlan: user.billingPlan,
  subscriptionStatus: user.subscriptionStatus,
  emailVerified: user.emailVerified ?? true,
  aiEntitlements: getAiEntitlements(user.billingPlan, user.role),
  companies: user.companyMemberships || [],
  createdAt: user.createdAt,
});

const requireGoogleClient = () => {
  if (!googleClient || !env.GOOGLE_CLIENT_ID) {
    throw new AppError("Google sign-in is not configured yet.", StatusCodes.SERVICE_UNAVAILABLE);
  }

  return googleClient;
};

const verifyGoogleCredential = async (credential: string) => {
  let ticket;

  try {
    ticket = await requireGoogleClient().verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch (_error) {
    throw new AppError("Invalid Google sign-in credential.", StatusCodes.UNAUTHORIZED);
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified === false) {
    throw new AppError("Google account verification failed.", StatusCodes.UNAUTHORIZED);
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    fullName: payload.name?.trim() || payload.email.split("@")[0],
    avatarUrl: payload.picture || null,
  };
};

const issueAuthenticatedResponse = async (response: Response, user: Parameters<typeof serializeUser>[0], statusCode = StatusCodes.OK, message = "Login successful.") => {
  const accessToken = signToken({ id: user.id, email: user.email, role: user.role });
  const rawRefresh = await issueRefreshToken(user.id);
  setCsrfCookie(response);
  response.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
  response.cookie(REFRESH_COOKIE, rawRefresh, refreshCookieOptions);

  response.status(statusCode).json({
    message,
    csrfToken: getCsrfTokenFromResponse(response),
    user: serializeUser(user),
  });
};

export const register = asyncHandler(async (request: Request, response: Response) => {
  const email = String(request.body.email).toLowerCase().trim();
  const fullName = request.body.fullName
    ? sanitizePlainText(request.body.fullName)
    : email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const password = request.body.password as string;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError("Email is already registered.", StatusCodes.CONFLICT);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      emailVerificationToken: tokenHash,
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const origin = env.CLIENT_URL || "https://sprintflow-web-badralmunh.fly.dev";
  void sendVerificationEmail({
    recipientEmail: email,
    recipientName: fullName,
    verifyUrl: `${origin}/verify-email?token=${rawToken}`,
  });

  await issueAuthenticatedResponse(response, user, StatusCodes.CREATED, "Registration successful. Please check your email to verify your account.");
});

export const login = asyncHandler(async (request: Request, response: Response) => {
  const email = String(request.body.email).toLowerCase().trim();
  const password = request.body.password as string;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password.", StatusCodes.UNAUTHORIZED);
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError("Invalid email or password.", StatusCodes.UNAUTHORIZED);
  }

  await issueAuthenticatedResponse(response, user);
});

export const requestPasswordReset = asyncHandler(async (request: Request, response: Response) => {
  const email = String(request.body.email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const passwordResetCodeHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const passwordResetCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetCodeHash, passwordResetCodeExpiresAt },
    });

    const origin = env.CLIENT_URL || "https://sprintflow-web-badralmunh.fly.dev";
    await sendPasswordResetEmail({
      recipientEmail: user.email,
      recipientName: user.fullName,
      resetUrl: `${origin}/forgot-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`,
    });
  }

  response.json({
    message: "If an account with that email exists, a reset link has been sent.",
  });
});

export const confirmPasswordReset = asyncHandler(async (request: Request, response: Response) => {
  const email = String(request.body.email).toLowerCase().trim();
  const rawToken = String(request.body.token).trim();
  const newPassword = request.body.newPassword as string;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordResetCodeHash || !user.passwordResetCodeExpiresAt) {
    throw new AppError("Invalid or expired reset link.", StatusCodes.BAD_REQUEST);
  }

  if (user.passwordResetCodeExpiresAt.getTime() < Date.now()) {
    throw new AppError("Invalid or expired reset link.", StatusCodes.BAD_REQUEST);
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  if (tokenHash !== user.passwordResetCodeHash) {
    throw new AppError("Invalid or expired reset link.", StatusCodes.BAD_REQUEST);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetCodeHash: null, passwordResetCodeExpiresAt: null },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  response.json({
    message: "Password updated successfully. You can sign in with your new password.",
  });
});

export const logout = asyncHandler(async (request: Request, response: Response) => {
  const rawRefresh = request.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (rawRefresh) {
    const tokenHash = crypto.createHash("sha256").update(rawRefresh).digest("hex");
    await prisma.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => undefined);
  }
  response.clearCookie(ACCESS_COOKIE);
  response.clearCookie(REFRESH_COOKIE);
  setCsrfCookie(response);
  response.json({
    message: "Logout successful.",
    csrfToken: getCsrfTokenFromResponse(response),
  });
});

export const refresh = asyncHandler(async (request: Request, response: Response) => {
  const rawRefresh = request.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!rawRefresh) {
    throw new AppError("No refresh token.", StatusCodes.UNAUTHORIZED);
  }

  const tokenHash = crypto.createHash("sha256").update(rawRefresh).digest("hex");
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError("Refresh token expired. Please log in again.", StatusCodes.UNAUTHORIZED);
  }

  // Rotate: delete old token, issue new one
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const accessToken = signToken({ id: stored.user.id, email: stored.user.email, role: stored.user.role });
  const newRawRefresh = await issueRefreshToken(stored.user.id);

  response.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
  response.cookie(REFRESH_COOKIE, newRawRefresh, refreshCookieOptions);
  response.json({ message: "Token refreshed." });
});

export const verifyEmail = asyncHandler(async (request: Request, response: Response) => {
  const raw = String(request.query.token || "").trim();
  if (!raw) {
    throw new AppError("Verification token is required.", StatusCodes.BAD_REQUEST);
  }

  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const user = await prisma.user.findUnique({ where: { emailVerificationToken: tokenHash } });
  if (!user || !user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
    throw new AppError("Invalid or expired verification link.", StatusCodes.BAD_REQUEST);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
  });

  response.json({ message: "Email verified successfully." });
});

export const csrf = (_request: Request, response: Response) => {
  response.json({ csrfToken: getCsrfTokenFromResponse(response) });
};

export const me = asyncHandler(async (request: Request, response: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user!.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      googleId: true,
      billingPlan: true,
      subscriptionStatus: true,
      companyMemberships: {
        select: {
          memberRole: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found.", StatusCodes.NOT_FOUND);
  }

  response.json({
    user: serializeUser({
      ...user,
      companyMemberships: user.companyMemberships.map((membership) => ({
        companyId: membership.company.id,
        companyName: membership.company.name,
        companySlug: membership.company.slug,
        memberRole: membership.memberRole,
      })),
    }),
  });
});

export const updateProfile = asyncHandler(async (request: Request, response: Response) => {
  const updateData: {
    fullName?: string;
    avatarColor?: string;
    avatarUrl?: string | null;
  } = {};

  if (typeof request.body.fullName === "string") {
    updateData.fullName = sanitizePlainText(request.body.fullName);
  }

  if (typeof request.body.avatarColor === "string") {
    updateData.avatarColor = sanitizePlainText(request.body.avatarColor);
  }

  if (Object.prototype.hasOwnProperty.call(request.body, "avatarUrl")) {
    updateData.avatarUrl = request.body.avatarUrl ? String(request.body.avatarUrl) : null;
  }

  const user = await prisma.user.update({
    where: { id: request.user!.id },
    data: updateData,
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      googleId: true,
      billingPlan: true,
      subscriptionStatus: true,
      companyMemberships: {
        select: {
          memberRole: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      createdAt: true,
    },
  });

  response.json({
    message: "Profile updated.",
    user: serializeUser({
      ...user,
      companyMemberships: user.companyMemberships.map((membership) => ({
        companyId: membership.company.id,
        companyName: membership.company.name,
        companySlug: membership.company.slug,
        memberRole: membership.memberRole,
      })),
    }),
  });
});

export const googleAuth = asyncHandler(async (request: Request, response: Response) => {
  const credential = String(request.body.credential || "").trim();
  if (!credential) {
    throw new AppError("Google credential is required.", StatusCodes.BAD_REQUEST);
  }

  const profile = await verifyGoogleCredential(credential);

  let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: profile.googleId,
          avatarUrl: existingByEmail.avatarUrl || profile.avatarUrl,
          fullName: existingByEmail.fullName || profile.fullName,
        },
      });
    } else {
      const passwordHash = await bcrypt.hash(crypto.randomUUID() + crypto.randomBytes(16).toString("hex"), 10);
      user = await prisma.user.create({
        data: {
          fullName: profile.fullName,
          email: profile.email,
          googleId: profile.googleId,
          passwordHash,
          avatarUrl: profile.avatarUrl,
          emailVerified: true,
        },
      });
    }
  } else if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }

  await issueAuthenticatedResponse(response, user, StatusCodes.OK, "Google sign-in successful.");
});

export const linkGoogleAccount = asyncHandler(async (request: Request, response: Response) => {
  const credential = String(request.body.credential || "").trim();
  if (!credential) {
    throw new AppError("Google credential is required.", StatusCodes.BAD_REQUEST);
  }

  const profile = await verifyGoogleCredential(credential);
  const conflict = await prisma.user.findUnique({ where: { googleId: profile.googleId } });

  if (conflict && conflict.id !== request.user!.id) {
    throw new AppError("That Google account is already connected to another user.", StatusCodes.CONFLICT);
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: request.user!.id },
    select: { email: true, avatarUrl: true, fullName: true },
  });

  if (!currentUser) {
    throw new AppError("User not found.", StatusCodes.NOT_FOUND);
  }

  const user = await prisma.user.update({
    where: { id: request.user!.id },
    data: {
      googleId: profile.googleId,
      avatarUrl: currentUser.avatarUrl || profile.avatarUrl,
      fullName: currentUser.fullName || profile.fullName,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      googleId: true,
      billingPlan: true,
      subscriptionStatus: true,
      companyMemberships: {
        select: {
          memberRole: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      createdAt: true,
    },
  });

  response.json({
    message: currentUser.email === profile.email ? "Google account connected." : "Google account connected with a different email address.",
    user: serializeUser({
      ...user,
      emailVerified: true,
      companyMemberships: user.companyMemberships.map((membership) => ({
        companyId: membership.company.id,
        companyName: membership.company.name,
        companySlug: membership.company.slug,
        memberRole: membership.memberRole,
      })),
    }),
  });
});
