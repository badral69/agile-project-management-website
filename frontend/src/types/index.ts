export type Role = "ADMIN" | "MODERATOR" | "USER";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
export type ProjectMemberRole = "OWNER" | "MANAGER" | "CONTRIBUTOR" | "VIEWER";
export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TaskType = "EPIC" | "STORY" | "TASK" | "BUG";
export type BillingPlan = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
export type CompanyMemberRole = "SUPERVISOR" | "WORKER";
export type SprintStatus = "PLANNING" | "ACTIVE" | "COMPLETED";

export type AiEntitlements = {
  aiSearch: boolean;
  aiPlanner: boolean;
  voiceTasks: boolean;
  usageLabel: string;
};

export type CompanySummary = {
  companyId: string;
  companyName: string;
  companySlug: string;
  memberRole: CompanyMemberRole;
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarColor: string;
  avatarUrl?: string | null;
  googleConnected?: boolean;
  billingPlan?: BillingPlan;
  subscriptionStatus?: string | null;
  aiEntitlements?: AiEntitlements;
  companies?: CompanySummary[];
  createdAt: string;
};

export type DirectoryUser = User & {
  _count?: {
    memberships: number;
    assignedTasks: number;
    companyMemberships: number;
  };
};

export type DashboardData = {
  stats: {
    projectCount: number;
    taskCount: number;
    overdueTasks: number;
    userCount?: number;
  };
  recentProjects: Array<Project & { _count: { tasks: number; members: number } }>;
  statusBreakdown: Array<{ status: TaskStatus; _count: { status: number } }>;
  myTasks: Array<Task & { project: Pick<Project, "id" | "name" | "key"> }>;
};

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  owner?: Pick<User, "id" | "fullName" | "role">;
  _count?: {
    tasks: number;
    members: number;
  };
};

export type ProjectMember = {
  id: string;
  memberRole: ProjectMemberRole;
  createdAt: string;
  user: User;
};

export type ActivityLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  actor?: Pick<User, "id" | "fullName" | "role"> | null;
};

export type Task = {
  id: string;
  projectId: string;
  assigneeId?: string | null;
  reporterId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  storyPoints?: number | null;
  dueDate?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, "id" | "name" | "key">;
  assignee?: Pick<User, "id" | "fullName" | "avatarColor" | "avatarUrl"> | null;
  reporter?: Pick<User, "id" | "fullName">;
  _count?: {
    comments: number;
  };
};

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, "id" | "fullName" | "avatarColor" | "avatarUrl" | "role">;
};

export type ProjectDetail = Project & {
  owner: Pick<User, "id" | "fullName" | "email" | "role">;
  members: ProjectMember[];
  tasks: Task[];
  activities: ActivityLog[];
  _count: {
    tasks: number;
    members: number;
  };
};

export type TaskBlocker = Pick<Task, "id" | "title" | "status" | "priority">;

export type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
};

export type TaskDetail = Task & {
  project: Pick<Project, "id" | "name" | "key">;
  assignee?: Pick<User, "id" | "fullName" | "avatarColor" | "avatarUrl"> | null;
  reporter?: Pick<User, "id" | "fullName">;
  comments: Comment[];
  blockedBy: TaskBlocker[];
  blocking: TaskBlocker[];
  attachments: Attachment[];
};

export type SprintTask = {
  sprintId: string;
  taskId: string;
  task: Pick<Task, "id" | "title" | "status" | "priority" | "assigneeId">;
};

export type Sprint = {
  id: string;
  projectId: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  retrospective?: string | null;
  createdAt: string;
  updatedAt: string;
  tasks: SprintTask[];
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PerformanceWorker = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarColor: string;
  avatarUrl?: string | null;
  projectMemberships: number;
  leadershipProjects: number;
  managedProjectLabels: string[];
  assignedTaskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
  overdueOpenTaskCount: number;
  dueTrackedCompletedCount: number;
  completedOnTimeCount: number;
  onTimeCompletionRate: number;
  averageTaskCycleHours: number;
  averageTaskAgeHours: number;
  activityEventsLast30Days: number;
  activeContributionDaysLast30Days: number;
  completionSpeed: "High" | "Steady" | "Needs support";
};

export type PerformanceOverview = {
  visibility: "ADMIN" | "PROJECT_LEADER";
  scopeNote: string;
  selectedProjectId: string;
  projects: Array<Pick<Project, "id" | "key" | "name" | "status">>;
  summary: {
    memberCount: number;
    completedTasks: number;
    overdueOpenTasks: number;
    onTimeCompletionRate: number;
    averageTaskCycleHours: number;
    activityEventsLast30Days: number;
    activeContributors: number;
    projectCount: number;
  };
  workers: PerformanceWorker[];
};

export type CompanyMember = {
  id: string;
  memberRole: CompanyMemberRole;
  createdAt: string;
  user: User;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  members: CompanyMember[];
  _count: {
    members: number;
    projects: number;
  };
};
