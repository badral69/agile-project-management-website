import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createCheckoutSession, getCheckoutSession, stripeWebhook } from "../controllers/billing.controller";
import { authenticate } from "../middleware/auth";
import { authenticateOptional } from "../middleware/auth-optional";
import { validate } from "../middleware/validate";

const router = Router();

const billingRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { message: "Too many billing requests, please try again later." } });

router.post("/webhook", stripeWebhook);

router.post(
  "/checkout-session",
  billingRateLimit,
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

router.get("/:id", billingRateLimit, authenticate, getCheckoutSession);

export default router;
