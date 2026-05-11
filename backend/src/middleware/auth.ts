import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { verifyToken } from "../utils/jwt";

const parseBearerToken = (authorization?: string) => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7);
};

export const authenticate = (request: Request, response: Response, next: NextFunction) => {
  const token = request.cookies.agile_access_token || parseBearerToken(request.headers.authorization);

  if (!token) {
    return response.status(StatusCodes.UNAUTHORIZED).json({ message: "Authentication required." });
  }

  try {
    request.user = verifyToken(token);
    next();
  } catch (_error) {
    return response.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid or expired token." });
  }
};
