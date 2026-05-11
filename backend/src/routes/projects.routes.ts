import { Router } from "express";
import { z } from "zod";
import { addProjectMember, removeProjectMember, searchAvailableProjectUsers } from "../controllers/project-members.controller";
import { createProject, deleteProject, getProjectBoard, getProjectById, listProjects, updateProject } from "../controllers/projects.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const projectBody = z.object({
  name: z.string().min(3).max(120),
  key: z.string().min(2).max(10),
  description: z.string().min(10).max(600),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
});

router.use(authenticate);
router.get("/", listProjects);
router.get("/:id", getProjectById);
router.get("/:id/board", getProjectBoard);
router.get("/:id/member-candidates", searchAvailableProjectUsers);
router.post(
  "/",
  validate(
    z.object({
      body: projectBody,
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  createProject,
);
router.put(
  "/:id",
  validate(
    z.object({
      body: projectBody,
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  updateProject,
);
router.delete("/:id", deleteProject);
router.post(
  "/:id/members",
  validate(
    z.object({
      body: z.object({
        userId: z.string().min(1),
        memberRole: z.enum(["OWNER", "MANAGER", "CONTRIBUTOR", "VIEWER"]),
      }),
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  addProjectMember,
);
router.delete("/:id/members/:memberId", removeProjectMember);

export default router;
