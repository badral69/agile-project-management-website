import { Router } from "express";
import { z } from "zod";
import { generatePlan, parseVoice, searchAssistant } from "../controllers/assistant.controller";
import { authenticate } from "../middleware/auth";
import { authenticateOptional } from "../middleware/auth-optional";
import { validate } from "../middleware/validate";

const router = Router();

router.post(
  "/search",
  authenticateOptional,
  validate(
    z.object({
      body: z.object({
        query: z.string().min(2).max(280),
        pathname: z.string().optional(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  searchAssistant,
);

router.post(
  "/generate-plan",
  authenticate,
  validate(
    z.object({
      body: z.object({
        projectId: z.string().min(1),
        projectName: z.string().min(1).max(120),
        description: z.string().min(10).max(800),
        teamSize: z.number().int().min(1).max(50),
        durationDays: z.number().int().min(3).max(365),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  generatePlan,
);

router.post(
  "/parse-voice",
  authenticate,
  validate(
    z.object({
      body: z.object({
        transcript: z.string().min(3).max(500),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  parseVoice,
);

export default router;
