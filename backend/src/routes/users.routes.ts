import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { deleteOwnAccount, deleteUser, exportOwnData, listDirectoryUsers, listUsers, updateUserRole } from "../controllers/users.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.delete("/me", deleteOwnAccount);
router.get("/me/export", exportOwnData);
router.get("/directory", authorize(Role.ADMIN), listDirectoryUsers);

router.use(authorize(Role.ADMIN));

router.get("/", listUsers);
router.patch(
  "/:id/role",
  validate(
    z.object({
      body: z.object({
        role: z.enum(["ADMIN", "MODERATOR", "USER"]),
      }),
      params: z.object({
        id: z.string().min(1),
      }),
      query: z.object({}).optional(),
    }),
  ),
  updateUserRole,
);
router.delete(
  "/:id",
  validate(
    z.object({
      body: z.object({}).optional(),
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
    }),
  ),
  deleteUser,
);

export default router;
