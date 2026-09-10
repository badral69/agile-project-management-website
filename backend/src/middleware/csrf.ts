import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env";

const CSRF_COOKIE_NAME = "agile_csrf_token";

const csrfCookieOptions = {
  httpOnly: false,
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const generateCsrfToken = () => crypto.randomBytes(32).toString("hex");

const isValidTokenShape = (value: unknown): value is string => {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
};

export const setCsrfCookie = (response: Response) => {
  const token = generateCsrfToken();
  response.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
  response.locals.csrfToken = token;
  return token;
};

export const ensureCsrfCookie = (request: Request, response: Response, next: NextFunction) => {
  const existingToken = request.cookies[CSRF_COOKIE_NAME];

  if (isValidTokenShape(existingToken)) {
    response.locals.csrfToken = existingToken;
    return next();
  }

  const token = setCsrfCookie(response);
  request.cookies[CSRF_COOKIE_NAME] = token;
  next();
};

export const requireCsrfProtection = (request: Request, response: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return next();
  }

  // Stripe webhooks carry their own signature — CSRF does not apply
  if (request.path.endsWith("/billing/webhook")) {
    return next();
  }

  const cookieToken = request.cookies[CSRF_COOKIE_NAME];
  const headerToken = request.headers["x-csrf-token"];
  const requestToken = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (!isValidTokenShape(cookieToken) || !isValidTokenShape(requestToken)) {
    return response.status(StatusCodes.FORBIDDEN).json({ message: "CSRF validation failed." });
  }

  const cookieBuffer = Buffer.from(cookieToken, "utf8");
  const requestBuffer = Buffer.from(requestToken, "utf8");

  if (cookieBuffer.length !== requestBuffer.length || !crypto.timingSafeEqual(cookieBuffer, requestBuffer)) {
    return response.status(StatusCodes.FORBIDDEN).json({ message: "CSRF validation failed." });
  }

  next();
};

export const getCsrfTokenFromResponse = (response: Response) => {
  return response.locals.csrfToken as string | undefined;
};
