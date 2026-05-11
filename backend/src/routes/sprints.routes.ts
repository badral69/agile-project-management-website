import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  addTaskToSprint,
  createSprint,
  deleteSprint,
  listSprints,
  removeTaskFromSprint,
  updateSprint,
} from "../controllers/sprints.controller";

const router = Router();

router.get("/projects/:projectId/sprints", authenticate, listSprints);
router.post("/projects/:projectId/sprints", authenticate, createSprint);
router.put("/sprints/:id", authenticate, updateSprint);
router.delete("/sprints/:id", authenticate, deleteSprint);
router.post("/sprints/:id/tasks", authenticate, addTaskToSprint);
router.delete("/sprints/:id/tasks/:taskId", authenticate, removeTaskFromSprint);

export default router;
