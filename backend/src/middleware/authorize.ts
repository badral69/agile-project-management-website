import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export const authorize = (...roles: Role[]) => {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) {
      return response.status(StatusCodes.UNAUTHORIZED).json({ message: "Authentication required." });
    }

    if (!roles.includes(request.user.role)) {
      return response.status(StatusCodes.FORBIDDEN).json({ message: "You do not have permission for this action." });
    }

    next();
  };
};
