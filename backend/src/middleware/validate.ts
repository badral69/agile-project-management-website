import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export const validate = (schema: z.ZodTypeAny) => {
  return (request: Request, response: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    if (!result.success) {
      return response.status(StatusCodes.BAD_REQUEST).json({
        message: "Validation failed.",
        issues: result.error.flatten(),
      });
    }

    const data = result.data as {
      body: Request["body"];
      params: Request["params"];
      query: Request["query"];
    };

    request.body = data.body;

    if (data.params && typeof data.params === "object") {
      Object.assign(request.params, data.params);
    }

    if (data.query && typeof data.query === "object") {
      Object.assign(request.query as Record<string, unknown>, data.query);
    }

    next();
  };
};
