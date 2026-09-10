import { Router } from "express";
import { z } from "zod";
import {
  addTaskToSprint,
  createSprint,
  deleteSprint,
  listSprints,
  removeTaskFromSprint,
  updateSprint,
} from "../controllers/sprints.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

const isoDateTime = z.string().refine((v) => !isNaN(Date.parse(v)), {
  message: "Must be a valid ISO 8601 date-time string.",
});

const sprintCreateBody = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(500).optional(),
  startDate: isoDateTime,
  endDate: isoDateTime,
});

const sprintUpdateBody = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(500).optional().nullable(),
  startDate: isoDateTime,
  endDate: isoDateTime,
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED"]),
  retrospective: z.string().max(2000).optional().nullable(),
});

const addTaskBody = z.object({
  taskId: z.string().min(1),
});

router.get(
  "/projects/:projectId/sprints",
  validate(z.object({ params: z.object({ projectId: z.string().min(1) }) })),
  listSprints,
);

router.post(
  "/projects/:projectId/sprints",
  validate(
    z.object({
      body: sprintCreateBody,
      params: z.object({ projectId: z.string().min(1) }),
    }),
  ),
  createSprint,
);

router.put(
  "/sprints/:id",
  validate(
    z.object({
      body: sprintUpdateBody,
      params: z.object({ id: z.string().min(1) }),
    }),
  ),
  updateSprint,
);

router.delete(
  "/sprints/:id",
  validate(z.object({ params: z.object({ id: z.string().min(1) }) })),
  deleteSprint,
);

router.post(
  "/sprints/:id/tasks",
  validate(
    z.object({
      body: addTaskBody,
      params: z.object({ id: z.string().min(1) }),
    }),
  ),
  addTaskToSprint,
);

router.delete(
  "/sprints/:id/tasks/:taskId",
  validate(
    z.object({
      params: z.object({ id: z.string().min(1), taskId: z.string().min(1) }),
    }),
  ),
  removeTaskFromSprint,
);

export default router;
