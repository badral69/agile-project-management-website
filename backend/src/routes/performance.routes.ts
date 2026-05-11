import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { getPerformanceOverview } from "../controllers/performance.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

router.get(
  "/overview",
  validate(
    z.object({
      query: z.object({
        projectId: z.string().optional(),
      }),
      params: z.object({}).optional(),
      body: z.object({}).optional(),
    }),
  ),
  getPerformanceOverview,
);

export default router;
