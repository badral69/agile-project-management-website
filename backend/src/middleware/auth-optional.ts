import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";

const parseBearerToken = (authorization?: string) => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7);
};

export const authenticateOptional = (request: Request, _response: Response, next: NextFunction) => {
  const token = request.cookies.agile_access_token || parseBearerToken(request.headers.authorization);

  if (!token) {
    next();
    return;
  }

  try {
    request.user = verifyToken(token);
  } catch (_error) {
    request.user = undefined;
  }

  next();
};
