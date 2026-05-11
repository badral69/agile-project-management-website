import type { Role } from "../types";

export type SearchOption = {
  id: string;
  title: string;
  description: string;
  to: string;
  section: string;
  keywords: string[];
  requiresAuth?: boolean;
  requiresRole?: Role;
  quick?: boolean;
};

const allSearchOptions: SearchOption[] = [
  {
    id: "home",
    title: "Home",
    description: "Open the SprintFlow landing page.",
    to: "/",
    section: "Public",
    keywords: ["home", "landing", "welcome"],
    quick: true,
  },
  {
    id: "pricing",
    title: "Pricing",
    description: "Review free trial and paid SprintFlow plans.",
    to: "/#pricing",
    section: "Public",
    keywords: ["pricing", "plans", "billing", "subscription", "free trial"],
    quick: true,
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Open the frequently asked questions section.",
    to: "/#faq",
    section: "Public",
    keywords: ["faq", "help", "questions"],
  },
  {
    id: "contact",
    title: "Contact",
    description: "Jump to the SprintFlow contact form.",
    to: "/#contact",
    section: "Public",
    keywords: ["contact", "support", "message"],
  },
  {
    id: "login",
    title: "Login",
    description: "Sign in to access the workspace.",
    to: "/login",
    section: "Public",
    keywords: ["login", "sign in", "access"],
    quick: true,
  },
  {
    id: "register",
    title: "Register",
    description: "Create a SprintFlow account.",
    to: "/register",
    section: "Public",
    keywords: ["register", "sign up", "join"],
    quick: true,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Open the main workspace overview.",
    to: "/workspace/dashboard",
    section: "Workspace",
    keywords: ["dashboard", "overview", "workspace"],
    requiresAuth: true,
    quick: true,
  },
  {
    id: "projects",
    title: "Projects",
    description: "Browse the full project portfolio.",
    to: "/workspace/projects",
    section: "Workspace",
    keywords: ["projects", "portfolio", "project list"],
    requiresAuth: true,
    quick: true,
  },
  {
    id: "projects-create",
    title: "Create project",
    description: "Open the project creation form.",
    to: "/workspace/projects?view=create",
    section: "Workspace",
    keywords: ["create project", "new project", "project setup"],
    requiresAuth: true,
  },
  {
    id: "projects-active",
    title: "Active projects",
    description: "Show projects that are currently active.",
    to: "/workspace/projects?status=ACTIVE",
    section: "Workspace",
    keywords: ["active projects", "running projects"],
    requiresAuth: true,
  },
  {
    id: "projects-overdue",
    title: "Overdue projects",
    description: "Focus on projects with missed deadlines.",
    to: "/workspace/projects?deadline=overdue",
    section: "Workspace",
    keywords: ["overdue projects", "late projects", "deadlines"],
    requiresAuth: true,
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Open the delivery task list.",
    to: "/workspace/tasks",
    section: "Workspace",
    keywords: ["tasks", "task list", "delivery work"],
    requiresAuth: true,
    quick: true,
  },
  {
    id: "tasks-assigned",
    title: "Assigned tasks",
    description: "Show tasks assigned directly to you.",
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
    quick: true,
  },
  {
    id: "performance",
    title: "Performance",
    description: "Open the performance evaluation view.",
    to: "/workspace/performance",
    section: "Workspace",
    keywords: ["performance", "evaluation", "reports"],
    requiresAuth: true,
    requiresRole: "ADMIN",
  },
  {
    id: "settings",
    title: "Settings",
    description: "Update profile, billing, and account settings.",
    to: "/workspace/settings",
    section: "Workspace",
    keywords: ["settings", "profile", "billing", "account"],
    requiresAuth: true,
  },
  {
    id: "admin-users",
    title: "Admin users",
    description: "Manage users and roles from the admin page.",
    to: "/workspace/admin/users",
    section: "Admin",
    keywords: ["admin", "users", "roles", "rbac"],
    requiresAuth: true,
    requiresRole: "ADMIN",
  },
];

const normalize = (value: string) => value.trim().toLowerCase();

export const getSearchOptions = (role?: Role | null) =>
  allSearchOptions.filter((option) => !option.requiresRole || option.requiresRole === role);

export const searchOptionsByQuery = (query: string, role?: Role | null) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }

  return getSearchOptions(role)
    .map((option) => {
      const haystack = [option.title, option.description, option.section, ...option.keywords].map(normalize);
      const score = haystack.reduce((total, value) => {
        if (value === normalizedQuery) {
          return total + 10;
        }

        if (value.startsWith(normalizedQuery)) {
          return total + 6;
        }

        if (value.includes(normalizedQuery)) {
          return total + 3;
        }

        return total;
      }, 0);

      return { option, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.option.title.localeCompare(right.option.title))
    .map((entry) => entry.option);
};

export const getQuickSearchOptions = (role?: Role | null) => getSearchOptions(role).filter((option) => option.quick);
