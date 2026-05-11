import { CompanyMemberRole, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { addCompanyMember, createCompany, getCompany, getCompanyTasks, listCompanies, removeCompanyMember, updateCompanyMember } from "../controllers/companies.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

router.get("/", listCompanies);
router.get("/:id", getCompany);
router.get("/:id/tasks", getCompanyTasks);

// Company creation is admin-only
router.post(
  "/",
  authorize(Role.ADMIN),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(2).max(120),
        slug: z.string().min(2).max(40).optional(),
        description: z.string().max(400).optional().nullable(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  createCompany,
);

// Member management: admin or supervisor of that company
router.post(
  "/:id/members",
  validate(
    z.object({
      body: z.object({
        userId: z.string().min(1),
        memberRole: z.nativeEnum(CompanyMemberRole),
      }),
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  addCompanyMember,
);

router.patch(
  "/:id/members/:memberId",
  validate(
    z.object({
      body: z.object({
        memberRole: z.nativeEnum(CompanyMemberRole),
      }),
      params: z.object({
        id: z.string().min(1),
        memberId: z.string().min(1),
      }),
      query: z.object({}).optional(),
    }),
  ),
  updateCompanyMember,
);

router.delete(
  "/:id/members/:memberId",
  validate(
    z.object({
      body: z.object({}).optional(),
      params: z.object({
        id: z.string().min(1),
        memberId: z.string().min(1),
      }),
      query: z.object({}).optional(),
    }),
  ),
  removeCompanyMember,
);

export default router;
