import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/app-error";
import { logger } from "../utils/logger";

export const errorHandler = (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return response.status(StatusCodes.BAD_REQUEST).json({ message: "Database request failed.", code: error.code });
  }

  if (error instanceof Error) {
    logger.error(error.message, error.stack);
    return response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: process.env.NODE_ENV === "development" ? error.message || "Unexpected server error." : "Unexpected server error.",
    });
  }

  logger.error("Unknown error thrown", error);
  return response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Unexpected server error." });
};
