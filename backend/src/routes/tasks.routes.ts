import { Router } from "express";
import { z } from "zod";
import { createComment } from "../controllers/comments.controller";
import { addBlocker, bulkUpdateTasks, createTask, deleteTask, getTaskById, listTasks, removeBlocker, updateTask } from "../controllers/tasks.controller";
import { createTimeLog, deleteTimeLog, listTimeLogs } from "../controllers/timelog.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const taskBody = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3).max(140),
  description: z.string().min(3).max(1200),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  type: z.enum(["EPIC", "STORY", "TASK", "BUG"]),
  storyPoints: z.number().int().min(1).max(21).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  position: z.number().int().optional(),
});

const taskUpdateBody = taskBody
  .omit({ projectId: true })
  .partial()
  .extend({
    title: z.string().min(3).max(140).optional(),
    description: z.string().min(3).max(1200).optional(),
    status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    type: z.enum(["EPIC", "STORY", "TASK", "BUG"]).optional(),
  });

router.use(authenticate);
router.patch(
  "/bulk",
  validate(
    z.object({
      body: z.object({
        ids: z.array(z.string().min(1)).min(1).max(100),
        status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        assigneeId: z.string().nullable().optional(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  bulkUpdateTasks,
);
router.get("/", listTasks);
router.get("/:id", getTaskById);
router.post(
  "/",
  validate(
    z.object({
      body: taskBody,
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  createTask,
);
router.put(
  "/:id",
  validate(
    z.object({
      body: taskUpdateBody,
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  updateTask,
);
router.patch(
  "/:id",
  validate(
    z.object({
      body: taskUpdateBody,
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  updateTask,
);
router.delete("/:id", deleteTask);
router.post("/:id/blockers", addBlocker);
router.delete("/:id/blockers/:blockerId", removeBlocker);
router.post(
  "/:id/comments",
  validate(
    z.object({
      body: z.object({
        body: z.string().min(2).max(800),
      }),
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  createComment,
);
router.get("/:taskId/timelogs", listTimeLogs);
router.post(
  "/:taskId/timelogs",
  validate(
    z.object({
      body: z.object({
        hours: z.number().positive().max(24),
        note: z.string().max(200).optional(),
      }),
      params: z.object({ taskId: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  createTimeLog,
);
router.delete("/:taskId/timelogs/:logId", deleteTimeLog);

export default router;
