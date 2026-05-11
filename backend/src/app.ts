import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { swaggerSpec } from "./config/swagger";
import { ensureCsrfCookie, requireCsrfProtection } from "./middleware/csrf";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import authRoutes from "./routes/auth.routes";
import assistantRoutes from "./routes/assistant.routes";
import activityRoutes from "./routes/activity.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import billingRoutes from "./routes/billing.routes";
import companiesRoutes from "./routes/companies.routes";
import performanceRoutes from "./routes/performance.routes";
import publicRoutes from "./routes/public.routes";
import projectsRoutes from "./routes/projects.routes";
import sprintsRoutes from "./routes/sprints.routes";
import tasksRoutes from "./routes/tasks.routes";
import usersRoutes from "./routes/users.routes";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again later." },
  skipSuccessfulRequests: true,
});
app.use(hpp());
app.use(compression());
app.use(morgan("dev", { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(ensureCsrfCookie);
app.use(requireCsrfProtection);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "agilepm-backend" });
});

app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/sprints", sprintsRoutes);
app.use("/api/tasks", tasksRoutes);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "SprintFlow API Docs",
  customCss: ".swagger-ui .topbar { display: none }",
}));
app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

export default app;
