import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BarChart2, Building2, CalendarClock, ClipboardList, FolderKanban, Plus, Search, TriangleAlert, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { TaskStatusChart } from "../components/charts/TaskStatusChart";
import { HexSpinner } from "../components/ui/HexSpinner";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { DashboardData, PaginatedResponse, Task, TaskDetail, TaskPriority, TaskStatus } from "../types";

type DashboardView =
  | "distribution"
  | "deadlines"
  | "activity"
  | "assigned"
  | "projects"
  | "companies"
  | null;

const sortByUpdated = (tasks: Task[]) =>
  [...tasks].sort((l, r) => +new Date(r.updatedAt) - +new Date(l.updatedAt));

const MODULE_ACCENT: Record<string, string> = {
  distribution: "#6366f1",
  deadlines:    "#f97316",
  activity:     "#0ea5e9",
  assigned:     "#7c3aed",
  projects:     "#2563eb",
  companies:    "#059669",
};

const TASK_STATUSES: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const getStatusLabel = (status: TaskStatus, t: ReturnType<typeof useI18n>["t"]) => {
  switch (status) {
    case "BACKLOG":
      return t("common.status.backlog");
    case "TODO":
      return t("common.status.todo");
    case "IN_PROGRESS":
      return t("common.status.inProgress");
    case "REVIEW":
      return t("common.status.review");
    case "DONE":
      return t("common.status.done");
  }
};

const getPriorityLabel = (priority: TaskPriority, t: ReturnType<typeof useI18n>["t"]) => {
  switch (priority) {
    case "LOW":
      return t("common.priority.low");
    case "MEDIUM":
      return t("common.priority.medium");
    case "HIGH":
      return t("common.priority.high");
    case "CRITICAL":
      return t("common.priority.critical");
  }
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<DashboardView>("distribution");
  const [overdueDismissed, setOverdueDismissed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ status: TaskStatus; priority: TaskPriority } | null>(null);
  const [dashSearch, setDashSearch] = useState("");

  useEffect(() => {
    if (!activeView) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveView(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "deadlines" && activeView !== "activity") {
      setSelectedTaskId(null);
      setTaskDraft(null);
      setDashSearch("");
    }
  }, [activeView]);

  const companiesQuery = useQuery({
    queryKey: ["sidebar-companies"],
    queryFn: async () => {
      const res = await api.get<{ items: Array<{ id: string; name: string }> }>("/companies");
      return res.data.items;
    },
  });

  const { data, error, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await api.get<DashboardData>("/dashboard/overview");
      return response.data;
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Task>>("/tasks?page=1&limit=80");
      return response.data.items;
    },
  });

  const selectedTaskQuery = useQuery({
    queryKey: ["dashboard", "task", selectedTaskId],
    enabled: Boolean(selectedTaskId),
    queryFn: async () => {
      const response = await api.get<{ item: TaskDetail }>(`/tasks/${selectedTaskId}`);
      return response.data.item;
    },
  });

  useEffect(() => {
    if (!selectedTaskQuery.data) return;
    setTaskDraft({
      status: selectedTaskQuery.data.status,
      priority: selectedTaskQuery.data.priority,
    });
  }, [selectedTaskQuery.data]);

  const updateTaskMutation = useMutation({
    mutationFn: async (payload: { status: TaskStatus; priority: TaskPriority }) => {
      if (!selectedTaskId) {
        throw new Error("No task selected.");
      }

      const response = await api.patch<{ item: TaskDetail }>(`/tasks/${selectedTaskId}`, payload);
      return response.data.item;
    },
    onSuccess: async (item) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "task", item.id] }),
      ]);
    },
  });

  const allTasks = tasksQuery.data || [];

  const upcomingDeadlines = useMemo(() => {
    const now = Date.now();
    return [...allTasks]
      .filter((t) => t.dueDate && t.status !== "DONE" && +new Date(t.dueDate) >= now)
      .sort((l, r) => +new Date(l.dueDate || l.updatedAt) - +new Date(r.dueDate || r.updatedAt));
  }, [allTasks]);

  const recentActivity = useMemo(() => sortByUpdated(allTasks), [allTasks]);

  const close = () => {
    setActiveView(null);
    setSelectedTaskId(null);
    setTaskDraft(null);
    setDashSearch("");
  };

  const filterBySearch = (tasks: Task[]) => {
    const q = dashSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        task.project?.name?.toLowerCase().includes(q) ||
        task.project?.key?.toLowerCase().includes(q),
    );
  };

  if (isLoading) {
    return (
      <div className="page-hex-loader">
        <HexSpinner size={56} label={t("common.loadingDashboard")} />
      </div>
    );
  }

  if (error) return <div className="page-loader">{getErrorMessage(error)}</div>;
  if (!data)  return <div className="page-loader">{t("common.dashboardUnavailable")}</div>;

  const assignedTasks  = data.myTasks;
  const recentProjects = data.recentProjects;
  const companies      = companiesQuery.data ?? [];

  const modules: { id: DashboardView; label: string; icon: typeof BarChart2; count?: number }[] = [
    { id: "distribution", label: t("dashboard.module.distribution"), icon: BarChart2 },
    { id: "deadlines",    label: t("dashboard.module.deadlines"),    icon: CalendarClock, count: upcomingDeadlines.length },
    { id: "activity",     label: t("dashboard.module.activity"),     icon: Activity,      count: recentActivity.length },
    { id: "assigned",     label: t("dashboard.module.assigned"),     icon: ClipboardList, count: assignedTasks.length },
    { id: "projects",     label: t("dashboard.module.projects"),     icon: FolderKanban,  count: recentProjects.length },
    ...(user?.role === "ADMIN" && companies.length > 0
      ? [{ id: "companies" as DashboardView, label: t("dashboard.module.companies"), icon: Building2, count: companies.length }]
      : []),
  ];

  const modalTitle = modules.find((m) => m.id === activeView)?.label ?? "";
  const canShowTaskDetail = activeView === "deadlines" || activeView === "activity";
  const selectedTask = selectedTaskQuery.data;

  return (
    <section className="page dashboard-page">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={user?.role === "ADMIN" ? t("dashboard.adminTitle") : t("dashboard.userTitle")}
        description={t("dashboard.description")}
        actions={
          <Link className="primary-button" to="/workspace/tasks">
            <Plus size={15} /> {t("dashboard.newTask")}
          </Link>
        }
      />

      {/* ── Stats ── */}
      <div className="stats-grid">
        <StatCard label={t("dashboard.projects")}      value={data.stats.projectCount}                                icon={<FolderKanban size={20} />} accent="#2563eb" hint={t("dashboard.projectsHint")} />
        <StatCard label={t("dashboard.workPackages")}  value={data.stats.taskCount}                                  icon={<ClipboardList size={20} />} accent="#7c3aed" hint={t("dashboard.workPackagesHint")} />
        <StatCard label={t("dashboard.overdue")}       value={data.stats.overdueTasks}                               icon={<TriangleAlert size={20} />} accent="#dc2626" hint={t("dashboard.overdueHint")} />
        <StatCard label={t("dashboard.people")}        value={data.stats.userCount ?? t("dashboard.peopleRestricted")} icon={<Users size={20} />} accent="#059669" hint={user?.role === "ADMIN" ? t("dashboard.peopleHintAdmin") : t("dashboard.peopleHintUser")} />
      </div>

      {/* ── Overdue banner ── */}
      {!overdueDismissed && data.stats.overdueTasks > 0 ? (
        <div className="overdue-banner" role="alert">
          <TriangleAlert size={16} />
          <span>{t("dashboard.overdueBanner", { count: data.stats.overdueTasks })}</span>
          <button
            type="button"
            className="overdue-banner-review"
            onClick={() => setActiveView("deadlines")}
          >
            {t("dashboard.overdueReview")}
          </button>
          <button
            type="button"
            className="overdue-banner-dismiss"
            aria-label={t("dashboard.overdueDismiss")}
            onClick={() => setOverdueDismissed(true)}
          >
            ×
          </button>
        </div>
      ) : null}

      {/* ── Module buttons ── */}
      <div className="dash-modules-row">
        {modules.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            className={`dash-module-btn${activeView === id ? " active" : ""}`}
            style={{ "--mod-accent": MODULE_ACCENT[id!] } as CSSProperties}
            onClick={() => setActiveView(activeView === id ? null : id)}
          >
            <Icon size={15} />
            <span>{label}</span>
            {count !== undefined && count > 0 ? (
              <span className="dash-module-count">{count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Inline panel — expands below module buttons ── */}
      {activeView ? (
        <div
          className="dash-inline-panel"
          style={{ "--mod-accent": MODULE_ACCENT[activeView] } as CSSProperties}
        >
          <div className="dash-modal-header">
            <h3>{modalTitle}</h3>
            <button type="button" className="dash-modal-close" onClick={close} aria-label="Close">
              <X size={18} />
            </button>
          </div>
            {(activeView === "deadlines" || activeView === "activity") ? (
              <div className="dash-modal-search">
                <Search size={13} />
                <input
                  type="text"
                  placeholder={t("dashboard.searchPlaceholder")}
                  value={dashSearch}
                  onChange={(e) => setDashSearch(e.target.value)}
                />
                {dashSearch ? (
                  <button type="button" className="ghost-button icon-button" onClick={() => setDashSearch("")}>
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="dash-modal-body">

              {activeView === "distribution" && (
                <TaskStatusChart data={data.statusBreakdown} />
              )}

              {activeView === "deadlines" && (
                tasksQuery.isLoading ? (
                  <div className="panel-spinner-row"><HexSpinner size={36} /></div>
                ) : filterBySearch(upcomingDeadlines).length ? (
                  <div className={`dash-modal-detail-layout${selectedTaskId ? " has-selection" : ""}`}>
                    <div className="stack-list">
                      {filterBySearch(upcomingDeadlines).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className={`list-card dashboard-list-card dashboard-selectable-card${selectedTaskId === task.id ? " selected" : ""}`}
                          onClick={() => setSelectedTaskId((current) => (current === task.id ? null : task.id))}
                        >
                          <div>
                            <strong>{task.title}</strong>
                            <p>{task.project?.key} · {task.project?.name}</p>
                          </div>
                          <div className="list-metadata">
                            <span><CalendarClock size={14} />{formatDate(task.dueDate)}</span>
                            <span className={`status-pill status-${task.status.toLowerCase()}`}>
                              <i className="status-dot" />{getStatusLabel(task.status, t)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {canShowTaskDetail ? (
                      <DashboardTaskDetailPanel
                        t={t}
                        task={selectedTask}
                        taskDraft={taskDraft}
                        isLoading={selectedTaskQuery.isLoading}
                        error={selectedTaskQuery.error}
                        isSaving={updateTaskMutation.isPending}
                        onDraftChange={setTaskDraft}
                        onSave={() => taskDraft && updateTaskMutation.mutate(taskDraft)}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="empty-state"><CalendarClock size={28} /><p>{t("dashboard.deadlinesEmpty.title")}</p></div>
                )
              )}

              {activeView === "activity" && (
                tasksQuery.isLoading ? (
                  <div className="panel-spinner-row"><HexSpinner size={36} /></div>
                ) : filterBySearch(recentActivity).length ? (
                  <div className={`dash-modal-detail-layout${selectedTaskId ? " has-selection" : ""}`}>
                    <div className="stack-list">
                      {filterBySearch(recentActivity).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className={`list-card dashboard-list-card dashboard-selectable-card${selectedTaskId === task.id ? " selected" : ""}`}
                          onClick={() => setSelectedTaskId((current) => (current === task.id ? null : task.id))}
                        >
                          <div>
                            <strong>{task.title}</strong>
                            <p>{task.assignee?.fullName || task.reporter?.fullName || t("common.workspaceUpdate")} · {task.project?.key}</p>
                          </div>
                          <div className="list-metadata">
                            <span><Activity size={14} />{formatDate(task.updatedAt)}</span>
                            <span className={`status-pill status-${task.status.toLowerCase()}`}>
                              <i className="status-dot" />{getStatusLabel(task.status, t)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {canShowTaskDetail ? (
                      <DashboardTaskDetailPanel
                        t={t}
                        task={selectedTask}
                        taskDraft={taskDraft}
                        isLoading={selectedTaskQuery.isLoading}
                        error={selectedTaskQuery.error}
                        isSaving={updateTaskMutation.isPending}
                        onDraftChange={setTaskDraft}
                        onSave={() => taskDraft && updateTaskMutation.mutate(taskDraft)}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="empty-state"><Activity size={28} /><p>{t("dashboard.activityEmpty.title")}</p></div>
                )
              )}

              {activeView === "assigned" && (
                assignedTasks.length ? (
                  <div className="stack-list">
                    {assignedTasks.map((task) => (
                      <Link
                        key={task.id}
                        to={task.project?.id ? `/workspace/projects/${task.project.id}` : "/workspace/tasks"}
                        className="task-card compact dashboard-task-card dashboard-task-link"
                        onClick={close}
                      >
                        <div className="task-topline">
                          <span className={`status-pill status-${task.status.toLowerCase()}`}>
                            <i className="status-dot" />{task.status.replaceAll("_", " ")}
                          </span>
                          <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                        </div>
                        <strong>{task.title}</strong>
                        <div className="list-metadata">
                          <span><CalendarClock size={13} />{t("dashboard.due")} {formatDate(task.dueDate)}</span>
                          <span>{task.project?.key}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><ClipboardList size={28} /><p>{t("dashboard.assignedEmpty.title")}</p></div>
                )
              )}

              {activeView === "projects" && (
                recentProjects.length ? (
                  <div className="stack-list">
                    {recentProjects.map((project) => (
                      <article key={project.id} className="list-card dashboard-project-card">
                        <div>
                          <strong>{project.key} · {project.name}</strong>
                          <p>{project.description}</p>
                        </div>
                        <div className="list-metadata">
                          <span><FolderKanban size={14} />{project._count.tasks} {t("dashboard.tasks")}</span>
                          <span><Users size={14} />{project._count.members} {t("dashboard.members")}</span>
                          <Link className="ghost-button dashboard-inline-link" to={`/workspace/projects/${project.id}`} onClick={close}>
                            {t("common.open")}
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><FolderKanban size={28} /><p>{t("dashboard.projectsEmpty.title")}</p></div>
                )
              )}

              {activeView === "companies" && (
                <div className="dashboard-companies-row">
                  {companies.map((company) => (
                    <Link
                      key={company.id}
                      to={`/workspace/companies/${company.id}`}
                      className="dashboard-company-card"
                      onClick={close}
                    >
                      <div className="dashboard-company-icon"><Building2 size={18} /></div>
                      <span>{company.name}</span>
                    </Link>
                  ))}
                </div>
              )}

            </div>
        </div>
      ) : null}
    </section>
  );
}

type DashboardTaskDetailPanelProps = {
  t: ReturnType<typeof useI18n>["t"];
  task?: TaskDetail;
  taskDraft: { status: TaskStatus; priority: TaskPriority } | null;
  isLoading: boolean;
  error: unknown;
  isSaving: boolean;
  onDraftChange: (draft: { status: TaskStatus; priority: TaskPriority } | null) => void;
  onSave: () => void;
};

function DashboardTaskDetailPanel({
  t,
  task,
  taskDraft,
  isLoading,
  error,
  isSaving,
  onDraftChange,
  onSave,
}: DashboardTaskDetailPanelProps) {
  if (isLoading) {
    return (
      <aside className="dashboard-task-detail-panel">
        <div className="panel-spinner-row"><HexSpinner size={32} /></div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="dashboard-task-detail-panel">
        <p className="dashboard-task-detail-empty">{getErrorMessage(error)}</p>
      </aside>
    );
  }

  if (!task || !taskDraft) {
    return (
      <aside className="dashboard-task-detail-panel">
        <p className="dashboard-task-detail-empty">{t("dashboard.taskDetailEmpty")}</p>
      </aside>
    );
  }

  const hasChanges = taskDraft.status !== task.status || taskDraft.priority !== task.priority;

  return (
    <aside className="dashboard-task-detail-panel">
      <div className="dashboard-task-detail-head">
        <div>
          <p className="dashboard-task-detail-kicker">{t("dashboard.taskDetail")}</p>
          <h4>{task.title}</h4>
        </div>
        <span className={`status-pill status-${taskDraft.status.toLowerCase()}`}>
          <i className="status-dot" />
          {getStatusLabel(taskDraft.status, t)}
        </span>
      </div>

      <div className="dashboard-task-detail-grid">
        <label className="stack-form">
          <span>{t("tasks.form.status")}</span>
          <select
            value={taskDraft.status}
            onChange={(event) =>
              onDraftChange({
                ...taskDraft,
                status: event.target.value as TaskStatus,
              })
            }
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status, t)}
              </option>
            ))}
          </select>
        </label>

        <label className="stack-form">
          <span>{t("tasks.form.priority")}</span>
          <select
            value={taskDraft.priority}
            onChange={(event) =>
              onDraftChange({
                ...taskDraft,
                priority: event.target.value as TaskPriority,
              })
            }
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {getPriorityLabel(priority, t)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="dashboard-task-detail-meta">
        <div>
          <span>{t("dashboard.taskProject")}</span>
          <strong>{task.project.key} · {task.project.name}</strong>
        </div>
        <div>
          <span>{t("dashboard.taskAssignee")}</span>
          <strong>{task.assignee?.fullName || t("common.unassigned")}</strong>
        </div>
        <div>
          <span>{t("dashboard.taskReporter")}</span>
          <strong>{task.reporter?.fullName || "—"}</strong>
        </div>
        <div>
          <span>{t("dashboard.due")}</span>
          <strong>{formatDate(task.dueDate)}</strong>
        </div>
        <div>
          <span>{t("dashboard.taskComments")}</span>
          <strong>{task.comments.length}</strong>
        </div>
        <div>
          <span>{t("dashboard.taskAttachments")}</span>
          <strong>{task.attachments.length}</strong>
        </div>
      </div>

      <div className="dashboard-task-detail-copy">
        <p>{task.description || t("dashboard.taskDescriptionEmpty")}</p>
      </div>

      {(task.blockedBy.length > 0 || task.blocking.length > 0) && (
        <div className="dashboard-task-dependency-grid">
          {task.blockedBy.length > 0 ? (
            <div className="dashboard-task-dependency">
              <span>{t("dashboard.taskBlockedBy")}</span>
              <strong>{task.blockedBy.map((item) => item.title).join(", ")}</strong>
            </div>
          ) : null}
          {task.blocking.length > 0 ? (
            <div className="dashboard-task-dependency">
              <span>{t("dashboard.taskBlocking")}</span>
              <strong>{task.blocking.map((item) => item.title).join(", ")}</strong>
            </div>
          ) : null}
        </div>
      )}

      <div className="dashboard-task-detail-actions">
        <button type="button" className="primary-button" onClick={onSave} disabled={isSaving || !hasChanges}>
          {isSaving ? t("dashboard.updatingTask") : t("dashboard.updateTask")}
        </button>
      </div>
    </aside>
  );
}
