import { Request, Response } from "express";
import { generateProjectPlan, parseVoiceToTask } from "../services/ai.service";
import { prisma } from "../config/prisma";
import { getAiEntitlements } from "../utils/plan-entitlements";

type AssistantSuggestion = {
  id: string;
  title: string;
  description: string;
  to: string;
  section: string;
  keywords: string[];
  requiresAuth?: boolean;
  requiresRole?: "ADMIN" | "MODERATOR" | "USER";
};

const suggestions: AssistantSuggestion[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Open the main workspace overview.",
    to: "/workspace/dashboard",
    section: "Workspace",
    keywords: ["dashboard", "overview", "workspace"],
    requiresAuth: true,
  },
  {
    id: "projects",
    title: "Projects",
    description: "Browse the project portfolio.",
    to: "/workspace/projects",
    section: "Workspace",
    keywords: ["projects", "portfolio", "project list"],
    requiresAuth: true,
  },
  {
    id: "projects-create",
    title: "Create project",
    description: "Open the project creation screen.",
    to: "/workspace/projects?view=create",
    section: "Workspace",
    keywords: ["create project", "new project", "project setup"],
    requiresAuth: true,
  },
  {
    id: "projects-overdue",
    title: "Overdue projects",
    description: "Show projects with late deadlines.",
    to: "/workspace/projects?deadline=overdue",
    section: "Workspace",
    keywords: ["overdue projects", "late projects", "deadline"],
    requiresAuth: true,
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Open the main task list.",
    to: "/workspace/tasks",
    section: "Workspace",
    keywords: ["tasks", "task list", "delivery work"],
    requiresAuth: true,
  },
  {
    id: "tasks-assigned",
    title: "Assigned tasks",
    description: "Show tasks assigned to you.",
    to: "/workspace/tasks?scope=assigned",
    section: "Workspace",
    keywords: ["assigned tasks", "my tasks", "assigned to me"],
    requiresAuth: true,
  },
  {
    id: "tasks-overdue",
    title: "Overdue tasks",
    description: "Show late tasks that need attention.",
    to: "/workspace/tasks?scope=overdue",
    section: "Workspace",
    keywords: ["overdue tasks", "late tasks", "deadline"],
    requiresAuth: true,
  },
  {
    id: "team",
    title: "Team",
    description: "Open members, meetings, and shared work.",
    to: "/workspace/team",
    section: "Workspace",
    keywords: ["team", "members", "meetings", "shared work"],
    requiresAuth: true,
    requiresRole: "ADMIN",
  },
  {
    id: "performance",
    title: "Performance",
    description: "Open the performance review page.",
    to: "/workspace/performance",
    section: "Workspace",
    keywords: ["performance", "evaluation", "report"],
    requiresAuth: true,
    requiresRole: "ADMIN",
  },
  {
    id: "settings",
    title: "Settings",
    description: "Update profile and billing settings.",
    to: "/workspace/settings",
    section: "Workspace",
    keywords: ["settings", "profile", "billing", "account"],
    requiresAuth: true,
  },
  {
    id: "pricing",
    title: "Pricing",
    description: "Review the public pricing plans.",
    to: "/#pricing",
    section: "Public",
    keywords: ["pricing", "plans", "subscription", "free trial"],
  },
  {
    id: "login",
    title: "Login",
    description: "Sign in to access protected pages.",
    to: "/login",
    section: "Public",
    keywords: ["login", "sign in", "authenticate"],
  },
  {
    id: "register",
    title: "Register",
    description: "Create a SprintFlow account.",
    to: "/register",
    section: "Public",
    keywords: ["register", "sign up", "create account"],
  },
  {
    id: "admin-users",
    title: "Admin users",
    description: "Manage roles and users from the admin page.",
    to: "/workspace/admin/users",
    section: "Admin",
    keywords: ["admin", "users", "roles", "access"],
    requiresAuth: true,
    requiresRole: "ADMIN",
  },
];

const normalize = (value: string) => value.trim().toLowerCase();

const pickSuggestions = (ids: string[], role?: string) => {
  const seen = new Set<string>();

  return ids
    .map((id) => suggestions.find((option) => option.id === id))
    .filter((option): option is AssistantSuggestion => Boolean(option))
    .filter((option) => {
      if (option.requiresRole && option.requiresRole !== role) {
        return false;
      }

      if (seen.has(option.id)) {
        return false;
      }

      seen.add(option.id);
      return true;
    });
};

const matchAny = (query: string, keywords: string[]) => keywords.some((keyword) => query.includes(keyword));

const buildAssistantResponse = (query: string, role?: string) => {
  const normalizedQuery = normalize(query);
  const loginHint = role ? "" : " Login is required before protected workspace pages open.";

  if (matchAny(normalizedQuery, ["overdue", "deadline", "late"])) {
    return {
      answer: `Use the overdue filters to focus on tasks or projects that are slipping behind schedule.${loginHint}`,
      suggestions: pickSuggestions(["tasks-overdue", "projects-overdue"], role),
    };
  }

  if (matchAny(normalizedQuery, ["assigned", "my task", "my work", "personal"])) {
    return {
      answer: `Open Assigned tasks to focus on the work that belongs to you right now.${loginHint}`,
      suggestions: pickSuggestions(["tasks-assigned", "dashboard"], role),
    };
  }

  if (matchAny(normalizedQuery, ["project", "portfolio"])) {
    return {
      answer: `Projects is the main portfolio area. It is the best place to browse active work or create a new project.${loginHint}`,
      suggestions: pickSuggestions(["projects", "projects-create", "projects-overdue"], role),
    };
  }

  if (matchAny(normalizedQuery, ["task", "story", "bug", "work"])) {
    return {
      answer: `Tasks is the simplified delivery list. Use it for search, filtering, and quick task creation without switching between duplicate pages.${loginHint}`,
      suggestions: pickSuggestions(["tasks", "tasks-assigned", "tasks-overdue"], role),
    };
  }

  if (matchAny(normalizedQuery, ["team", "member", "meeting", "people"])) {
    return {
      answer:
        role === "ADMIN"
          ? `Team combines members, meetings, and shared work in one place so you do not have to jump across several similar pages.${loginHint}`
          : `Team visibility is restricted to system admins.${loginHint}`,
      suggestions: pickSuggestions(role === "ADMIN" ? ["team"] : ["dashboard", "tasks"], role),
    };
  }

  if (matchAny(normalizedQuery, ["performance", "evaluation", "report"])) {
    return {
      answer:
        role === "ADMIN"
          ? `Performance is the admin-only review page for delivery metrics and worker evaluation.${loginHint}`
          : `Performance evaluation is restricted to system admins.${loginHint}`,
      suggestions: pickSuggestions(role === "ADMIN" ? ["performance"] : ["dashboard", "tasks-overdue"], role),
    };
  }

  if (matchAny(normalizedQuery, ["billing", "payment", "plan", "pricing", "subscription"])) {
    return {
      answer: `Pricing is public on the landing page, while billing details live inside Settings for signed-in users.${loginHint}`,
      suggestions: pickSuggestions(["pricing", "settings"], role),
    };
  }

  if (matchAny(normalizedQuery, ["google", "oauth", "profile", "settings"])) {
    return {
      answer: `Settings is where profile, billing, and connected account controls live.${loginHint}`,
      suggestions: pickSuggestions(["settings"], role),
    };
  }

  if (matchAny(normalizedQuery, ["admin", "role", "rbac", "user management"])) {
    return {
      answer:
        role === "ADMIN"
          ? "Admins can manage user roles from the admin users page."
          : `Role management is restricted to admins.${loginHint}`,
      suggestions: pickSuggestions(["admin-users", "dashboard"], role),
    };
  }

  if (matchAny(normalizedQuery, ["login", "sign in", "register", "sign up", "account"])) {
    return {
      answer: role
        ? "You are already signed in, so protected workspace options can open directly."
        : "Use Login to enter the workspace or Register to create a new SprintFlow account first.",
      suggestions: pickSuggestions(["login", "register", "dashboard"], role),
    };
  }

  return {
    answer:
      role === "ADMIN"
        ? `I can help you open the dashboard, projects, tasks, team, performance, settings, or pricing.${loginHint}`
        : `I can help you open the dashboard, projects, tasks, settings, or pricing.${loginHint}`,
    suggestions: pickSuggestions(role === "ADMIN" ? ["dashboard", "projects", "tasks", "team", "pricing"] : ["dashboard", "projects", "tasks", "pricing"], role),
  };
};

export const searchAssistant = (req: Request, res: Response) => {
  const body = req.body as { query: string };
  const role = req.user?.role;
  return res.json({
    mode: "guided",
    ...buildAssistantResponse(body.query, role),
  });
};

export const generatePlan = async (req: Request, res: Response) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { billingPlan: true, role: true },
    });

    if (!currentUser || !getAiEntitlements(currentUser.billingPlan, currentUser.role).aiPlanner) {
      return res.status(403).json({ message: "Your current plan does not include AI planning. Upgrade to Professional or Enterprise." });
    }

    const body = req.body as {
      projectId: string;
      projectName: string;
      description: string;
      teamSize: number;
      durationDays: number;
    };

    const tasks = await generateProjectPlan(body.projectName, body.description, body.teamSize, body.durationDays);
    return res.json({ projectId: body.projectId, tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI planning is unavailable right now.";
    return res.status(503).json({ message });
  }
};

export const parseVoice = async (req: Request, res: Response) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { billingPlan: true, role: true },
    });

    if (!currentUser || !getAiEntitlements(currentUser.billingPlan, currentUser.role).voiceTasks) {
      return res.status(403).json({ message: "Your current plan does not include AI voice tasks. Upgrade to Professional or Enterprise." });
    }

    const body = req.body as { transcript: string };
    const task = await parseVoiceToTask(body.transcript);
    return res.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice parsing is unavailable right now.";
    return res.status(503).json({ message });
  }
};
