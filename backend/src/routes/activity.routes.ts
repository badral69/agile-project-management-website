import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { listUserActivity } from "../controllers/activity.controller";

const router = Router();

router.get("/", authenticate, listUserActivity);

export default router;
