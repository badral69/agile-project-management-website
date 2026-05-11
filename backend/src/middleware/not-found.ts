import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export const notFound = (_request: Request, response: Response) => {
  response.status(StatusCodes.NOT_FOUND).json({ message: "Route not found." });
};
