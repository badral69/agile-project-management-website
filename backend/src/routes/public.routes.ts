import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { submitContactMessage } from "../controllers/public.controller";
import { validate } from "../middleware/validate";

const router = Router();

const contactRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { message: "Too many contact submissions, please try again later." } });

router.post(
  "/contact",
  contactRateLimit,
  validate(
    z.object({
      body: z.object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        company: z.string().max(120).optional().or(z.literal("")),
        teamSize: z.string().max(40).optional().or(z.literal("")),
        message: z.string().min(10).max(2500),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  submitContactMessage,
);

export default router;
