import { Router } from "express";
import { z } from "zod";
import { createCheckoutSession, getCheckoutSession } from "../controllers/billing.controller";
import { authenticateOptional } from "../middleware/auth-optional";
import { validate } from "../middleware/validate";

const router = Router();

router.post(
  "/checkout-session",
  authenticateOptional,
  validate(
    z.object({
      body: z.object({
        plan: z.enum(["starter", "professional", "enterprise"]),
        seats: z.number().int().min(5).max(200).optional(),
        supportLevel: z.enum(["standard", "priority"]).optional(),
        analyticsPack: z.boolean().optional(),
        guidedOnboarding: z.boolean().optional(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  createCheckoutSession,
);

router.get("/:id", getCheckoutSession);

export default router;
