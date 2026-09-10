import { Router } from "express";
import { z } from "zod";
import { confirmPasswordReset, csrf, googleAuth, linkGoogleAccount, login, logout, me, refresh, register, requestPasswordReset, updateProfile, verifyEmail } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const passwordSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

router.get("/csrf", csrf);
router.post(
  "/google",
  validate(
    z.object({
      body: z.object({
        credential: z.string().min(10),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  googleAuth,
);

router.post(
  "/register",
  validate(
    z.object({
      body: z.object({
        fullName: z.string().min(2).max(80).optional(),
        email: z.string().email(),
        password: passwordSchema,
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  register,
);
router.post(
  "/login",
  validate(
    z.object({
      body: z.object({
        email: z.string().email(),
        password: z.string().min(8).max(64),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  login,
);
router.post(
  "/forgot-password",
  validate(
    z.object({
      body: z.object({
        email: z.string().email(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  requestPasswordReset,
);
router.post(
  "/reset-password",
  validate(
    z.object({
      body: z.object({
        email: z.string().email(),
        token: z.string().length(64).regex(/^[a-f0-9]{64}$/),
        newPassword: passwordSchema,
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  confirmPasswordReset,
);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/verify-email", verifyEmail);
router.get("/me", authenticate, me);
router.post(
  "/google/link",
  authenticate,
  validate(
    z.object({
      body: z.object({
        credential: z.string().min(10),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  linkGoogleAccount,
);
router.patch(
  "/profile",
  authenticate,
  validate(
    z.object({
      body: z.object({
        fullName: z.string().min(2).max(80).optional(),
        avatarColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
        avatarUrl: z
          .union([
            z.literal(""),
            z.null(),
            z.string().regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/).max(3_000_000),
          ])
          .optional(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    }),
  ),
  updateProfile,
);

export default router;
