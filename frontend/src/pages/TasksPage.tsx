import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { AlertCircle, Bot, CalendarClock, CheckSquare, Clock, ClipboardList, Filter, Loader2, MessageSquare, Pencil, Plus, Search, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { VoiceTaskButton } from "../components/ai/VoiceTaskButton";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { DirectoryUser, PaginatedResponse, Project, Task, TaskDetail, TaskPriority } from "../types";

type GeneratedTask = {
  title: string;
  description: string;
  type: "EPIC" | "STORY" | "TASK" | "BUG";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "BACKLOG";
  storyPoints: number | null;
  daysFromNow: number | null;
};

const typeColor = { EPIC: "#ea580c", STORY: "#2563eb", TASK: "#0f766e", BUG: "#dc2626" };
const priorityColor = { LOW: "#64748b", MEDIUM: "#0ea5e9", HIGH: "#f59e0b", CRITICAL: "#dc2626" };

const taskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3).max(140),
  description: z.string().min(3).max(1200),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  type: z.enum(["EPIC", "STORY", "TASK", "BUG"]),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

type TaskForm = z.infer<typeof taskSchema>;
type TaskScope = "all" | "assigned" | "overdue";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [createMode, setCreateMode] = useState<"manual" | "ai">("manual");
  const [aiProjectId, setAiProjectId] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiTeamSize, setAiTeamSize] = useState(3);
  const [aiDuration, setAiDuration] = useState(14);
  const [aiTasks, setAiTasks] = useState<GeneratedTask[]>([]);
  const [aiEditIndex, setAiEditIndex] = useState<number | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiCreating, setAiCreating] = useState(false);
  const [aiCreated, setAiCreated] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedTaskId) { setSelectedTaskId(null); return; }
      if (createOpen) setCreateOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedTaskId, createOpen]);

  const scope = (["all", "assigned", "overdue"] as TaskScope[]).includes(searchParams.get("scope") as TaskScope)
    ? (searchParams.get("scope") as TaskScope)
    : "all";

  const scopeLabels: Record<TaskScope, string> = {
    all: t("tasks.scope.all"),
    assigned: t("tasks.scope.assigned"),
    overdue: t("tasks.scope.overdue"),
  };

  const emptyStateCopy: Record<TaskScope, { title: string; description: string }> = {
    all: { title: t("tasks.empty.all.title"), description: t("tasks.empty.all.description") },
    assigned: { title: t("tasks.empty.assigned.title"), description: t("tasks.empty.assigned.description") },
    overdue: { title: t("tasks.empty.overdue.title"), description: t("tasks.empty.overdue.description") },
  };

  const tStatus = (status: string) => {
    const map: Record<string, string> = {
      BACKLOG: t("common.status.backlog"),
      TODO: t("common.status.todo"),
      IN_PROGRESS: t("common.status.inProgress"),
      REVIEW: t("common.status.review"),
      DONE: t("common.status.done"),
    };
    return map[status] ?? status.replaceAll("_", " ");
  };

  const tPriority = (priority: TaskPriority | GeneratedTask["priority"]) => {
    const map: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", string> = {
      LOW: t("common.priority.low"),
      MEDIUM: t("common.priority.medium"),
      HIGH: t("common.priority.high"),
      CRITICAL: t("common.priority.critical"),
    };

    return map[priority];
  };

  const tasksQuery = useQuery({
    queryKey: ["workspace-tasks", projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "150" });
      if (projectId) {
        params.set("projectId", projectId);
      }

      const response = await api.get<PaginatedResponse<Task>>(`/tasks?${params.toString()}`);
      return response.data.items;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["task-projects"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Project>>("/projects?page=1&limit=100");
      return response.data.items;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["task-directory"],
    queryFn: async () => {
      const response = await api.get<{ items: DirectoryUser[] }>("/users/directory");
      return response.data.items;
    },
    enabled: user?.role === "ADMIN",
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: "TODO",
      priority: "MEDIUM",
      type: "TASK",
    },
  });

  const createTask = useMutation({
    mutationFn: async (payload: TaskForm) =>
      api.post("/tasks", {
        ...payload,
        assigneeId: payload.assigneeId || undefined,
      }),
    onSuccess: async () => {
      reset();
      setError("");
      toast.success(t("toast.taskCreated"));
      await queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["team-tasks"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async (payload: { status?: string; priority?: string }) =>
      api.patch("/tasks/bulk", { ids: [...selectedTaskIds], ...payload }),
    onSuccess: async () => {
      toast.success(`${selectedTaskIds.size} task${selectedTaskIds.size > 1 ? "s" : ""} updated`);
      setSelectedTaskIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const taskDetailQuery = useQuery({
    queryKey: ["task-detail", selectedTaskId],
    queryFn: async () => {
      const res = await api.get<{ item: TaskDetail }>(`/tasks/${selectedTaskId}`);
      return res.data.item;
    },
    enabled: Boolean(selectedTaskId),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const project = projectsQuery.data?.find((p) => p.id === aiProjectId);
      const res = await api.post<{ tasks: GeneratedTask[] }>("/assistant/generate-plan", {
        projectId: aiProjectId,
        projectName: project?.name ?? "",
        description: aiDescription,
        teamSize: aiTeamSize,
        durationDays: aiDuration,
      });
      return res.data.tasks;
    },
    onSuccess: (data) => { setAiTasks(data); setAiEditIndex(null); setAiError(""); setAiCreated(false); },
    onError: (err) => setAiError(getErrorMessage(err)),
  });

  const createAllAiTasks = async () => {
    setAiCreating(true);
    setAiError("");
    try {
      for (const task of aiTasks) {
        const dueDate = task.daysFromNow ? format(addDays(new Date(), task.daysFromNow), "yyyy-MM-dd") : undefined;
        await api.post("/tasks", { projectId: aiProjectId, title: task.title, description: task.description, type: task.type, priority: task.priority, status: task.status, storyPoints: task.storyPoints ?? undefined, dueDate });
      }
      await queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("AI tasks created");
      setAiCreated(true);
      setAiTasks([]);
    } catch (err) {
      setAiError(getErrorMessage(err as Error));
    } finally {
      setAiCreating(false);
    }
  };

  const tasks = tasksQuery.data || [];
  const assigneeOptions = useMemo(() => {
    const fromDirectory = (usersQuery.data || []).map((member) => ({
      id: member.id,
      label: member.fullName,
    }));

    const fromTasks = tasks.reduce<Array<{ id: string; label: string }>>((acc, task) => {
      if (!task.assignee?.id || acc.some((item) => item.id === task.assignee?.id)) {
        return acc;
      }

      acc.push({ id: task.assignee.id, label: task.assignee.fullName });
      return acc;
    }, []);

    return (fromDirectory.length ? fromDirectory : fromTasks).sort((left, right) => left.label.localeCompare(right.label));
  }, [tasks, usersQuery.data]);

  const visibleTasks = useMemo(() => {
    const normalizedSearch = search.trim().normalize("NFC").toLowerCase();
    const now = Date.now();
    const fromTimestamp = dueFrom ? +new Date(`${dueFrom}T00:00:00`) : null;
    const toTimestamp = dueTo ? +new Date(`${dueTo}T23:59:59`) : null;

    return tasks
      .filter((task) => {
        if (scope === "assigned") return task.assigneeId === user?.id;
        if (scope === "overdue") return Boolean(task.dueDate && +new Date(task.dueDate) < now && task.status !== "DONE");
        return true;
      })
      .filter((task) => statusFilter === "all" || task.status === statusFilter)
      .filter((task) => selectedAssigneeIds.length === 0 || (task.assigneeId ? selectedAssigneeIds.includes(task.assigneeId) : false))
      .filter((task) => selectedPriorities.length === 0 || selectedPriorities.includes(task.priority))
      .filter((task) => {
        if (!task.dueDate) {
          return !fromTimestamp && !toTimestamp;
        }

        const dueTime = +new Date(task.dueDate);
        if (fromTimestamp && dueTime < fromTimestamp) return false;
        if (toTimestamp && dueTime > toTimestamp) return false;
        return true;
      })
      .filter((task) => {
        if (!normalizedSearch) return true;
        return [task.title, task.description, task.project?.key, task.project?.name, task.assignee?.fullName]
          .filter(Boolean)
          .some((value) => String(value).normalize("NFC").toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt));
  }, [dueFrom, dueTo, scope, search, selectedAssigneeIds, selectedPriorities, statusFilter, tasks, user?.id]);

  const assignedTasks = tasks.filter((task) => task.assigneeId === user?.id);
  const overdueTasks = tasks.filter((task) => task.dueDate && +new Date(task.dueDate) < Date.now() && task.status !== "DONE");

  const summary = [
    { label: t("tasks.summary.all"), value: tasks.length },
    { label: t("tasks.summary.assigned"), value: assignedTasks.length },
    { label: t("tasks.summary.overdue"), value: overdueTasks.length },
  ];

  const [timeHours, setTimeHours] = useState("");
  const [timeNote, setTimeNote] = useState("");

  const timeLogsQuery = useQuery({
    queryKey: ["timelogs", selectedTaskId],
    queryFn: async () => {
      const res = await api.get<{ items: Array<{ id: string; hours: number; note: string | null; loggedAt: string; user: { id: string; fullName: string } }>; totalHours: number }>(`/tasks/${selectedTaskId}/timelogs`);
      return res.data;
    },
    enabled: Boolean(selectedTaskId),
  });

  const logTimeMutation = useMutation({
    mutationFn: async () => api.post(`/tasks/${selectedTaskId}/timelogs`, { hours: Number(timeHours), note: timeNote || undefined }),
    onSuccess: async () => {
      toast.success("Time logged");
      setTimeHours("");
      setTimeNote("");
      await queryClient.invalidateQueries({ queryKey: ["timelogs", selectedTaskId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteTimeLogMutation = useMutation({
    mutationFn: async (logId: string) => api.delete(`/tasks/${selectedTaskId}/timelogs/${logId}`),
    onSuccess: async () => {
      toast.success("Time log deleted");
      await queryClient.invalidateQueries({ queryKey: ["timelogs", selectedTaskId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const detail = taskDetailQuery.data;

  return (
    <section className="page tasks-page">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={scopeLabels[scope]}
        description={t("tasks.description")}
        actions={
          <div className="header-pill-row">
            {user?.aiEntitlements?.voiceTasks ? (
              <VoiceTaskButton
                projects={(projectsQuery.data || []).map((p) => ({ id: p.id, key: p.key, name: p.name }))}
                onCreated={async () => {
                  await queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
                  await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                }}
              />
            ) : null}
            {user?.aiEntitlements?.aiPlanner ? (
              <button className="ghost-button" type="button" onClick={() => { setCreateMode("ai"); setCreateOpen(true); }}>
                <Bot size={14} /> {t("tasks.generateWithAi")}
              </button>
            ) : null}
            <button className="primary-button" type="button" onClick={() => { setCreateMode("manual"); setCreateOpen(true); }}>
              <Plus size={14} /> {t("tasks.create.title")}
            </button>
          </div>
        }
      />

      <div className="tasks-full-panel">
        <div className="panel workspace-flat-card tasks-list-panel">
          <div className="toolbar tasks-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("tasks.search.placeholder")} />
            </label>

            <label className="inline-filter">
              <Filter size={14} />
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">{t("tasks.filter.allProjects")}</option>
                {projectsQuery.data?.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.key} · {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-filter">
              <AlertCircle size={14} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">{t("common.allStatuses")}</option>
                <option value="BACKLOG">{t("common.status.backlog")}</option>
                <option value="TODO">{t("common.status.todo")}</option>
                <option value="IN_PROGRESS">{t("common.status.inProgress")}</option>
                <option value="REVIEW">{t("common.status.review")}</option>
                <option value="DONE">{t("common.status.done")}</option>
              </select>
            </label>
          </div>

          <div className="task-filter-groups">
            <div className="task-filter-group">
              <span className="eyebrow">{t("tasks.filter.assignees")}</span>
              <div className="task-chip-row">
                {assigneeOptions.length ? (
                  assigneeOptions.map((assignee) => (
                    <button
                      key={assignee.id}
                      type="button"
                      className={selectedAssigneeIds.includes(assignee.id) ? "scope-chip active" : "scope-chip"}
                      onClick={() =>
                        setSelectedAssigneeIds((current) =>
                          current.includes(assignee.id)
                            ? current.filter((value) => value !== assignee.id)
                            : [...current, assignee.id],
                        )
                      }
                    >
                      {assignee.label}
                    </button>
                  ))
                ) : (
                  <span className="muted-text">{t("tasks.filter.noAssignees")}</span>
                )}
              </div>
            </div>

            <div className="task-filter-group">
              <span className="eyebrow">{t("tasks.filter.priorityMulti")}</span>
              <div className="task-chip-row">
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    className={selectedPriorities.includes(priority) ? "scope-chip active" : "scope-chip"}
                    onClick={() =>
                      setSelectedPriorities((current) =>
                        current.includes(priority)
                          ? current.filter((value) => value !== priority)
                          : [...current, priority],
                      )
                    }
                  >
                    {tPriority(priority)}
                  </button>
                ))}
              </div>
            </div>

            <div className="task-filter-group task-date-range-group">
              <span className="eyebrow">{t("tasks.filter.dateRange")}</span>
              <div className="dual-form-row">
                <label className="inline-filter">
                  <CalendarClock size={14} />
                  <input type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} />
                </label>
                <label className="inline-filter">
                  <CalendarClock size={14} />
                  <input type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} />
                </label>
              </div>
            </div>
          </div>

          <div className="task-scope-row">
            {(["all", "assigned", "overdue"] as TaskScope[]).map((item) => (
              <button
                key={item}
                type="button"
                className={scope === item ? "scope-chip active" : "scope-chip"}
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  if (item === "all") {
                    nextParams.delete("scope");
                  } else {
                    nextParams.set("scope", item);
                  }
                  setSearchParams(nextParams, { replace: true });
                }}
              >
                {scopeLabels[item]}
              </button>
            ))}
          </div>

          <div className="task-summary-strip">
            {summary.map((item) => (
              <div key={item.label} className="task-summary-item">
                <span className="eyebrow">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {selectedTaskIds.size > 0 ? (
            <div className="bulk-action-bar">
              <span className="bulk-action-count"><CheckSquare size={14} />{selectedTaskIds.size} selected</span>
              <div className="bulk-action-controls">
                <select
                  className="bulk-select"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { bulkUpdate.mutate({ status: e.target.value }); e.target.value = ""; } }}
                  disabled={bulkUpdate.isPending}
                >
                  <option value="" disabled>Set status…</option>
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REVIEW">Review</option>
                  <option value="DONE">Done</option>
                </select>
                <select
                  className="bulk-select"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { bulkUpdate.mutate({ priority: e.target.value }); e.target.value = ""; } }}
                  disabled={bulkUpdate.isPending}
                >
                  <option value="" disabled>Set priority…</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
                <button type="button" className="ghost-button" onClick={() => setSelectedTaskIds(new Set())}>
                  <X size={13} /> Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="task-list-shell">
            {visibleTasks.length ? (
              <div className="task-list-table">
                <div className="task-list-head task-list-head-bulk">
                  <span className="task-check-col">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={visibleTasks.length > 0 && visibleTasks.every((t) => selectedTaskIds.has(t.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTaskIds(new Set(visibleTasks.map((t) => t.id)));
                        } else {
                          setSelectedTaskIds(new Set());
                        }
                      }}
                    />
                  </span>
                  <span>{t("tasks.table.task")}</span>
                  <span>{t("tasks.table.status")}</span>
                  <span>{t("tasks.table.assignee")}</span>
                  <span>{t("tasks.table.due")}</span>
                  <span>{t("tasks.table.project")}</span>
                </div>

                {visibleTasks.map((task) => (
                  <article
                    key={task.id}
                    className={`task-list-row priority-row-${task.priority.toLowerCase()} task-list-row-clickable${selectedTaskId === task.id ? " task-list-row-active" : ""}${task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date() ? " task-row-overdue" : ""}${selectedTaskIds.has(task.id) ? " task-list-row-checked" : ""}`}
                    onClick={() => setSelectedTaskId(task.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedTaskId(task.id)}
                  >
                    <span className="task-check-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${task.title}`}
                        checked={selectedTaskIds.has(task.id)}
                        onChange={(e) => {
                          setSelectedTaskIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(task.id); else next.delete(task.id);
                            return next;
                          });
                        }}
                      />
                    </span>
                    <div className="task-list-title">
                      <div className="task-list-title-row">
                        <span className={`task-type-badge type-${task.type.toLowerCase()}`}>{task.type}</span>
                        <strong>{task.title}</strong>
                      </div>
                    </div>
                    <span className={`status-pill status-${task.status.toLowerCase()}`}>
                      <i className="status-dot" />
                      {tStatus(task.status)}
                    </span>
                    <span className="task-list-meta">
                      <UserRound size={13} />
                      {task.assignee?.fullName || t("common.unassigned")}
                    </span>
                    <span className="task-list-meta">
                      <CalendarClock size={13} />
                      {formatDate(task.dueDate)}
                    </span>
                    <span className="task-list-meta">
                      <ClipboardList size={13} />
                      {task.project?.key ?? t("common.noProject")}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state workspace-empty-state">
                <ClipboardList size={28} />
                <div>
                  <strong>{emptyStateCopy[scope].title}</strong>
                  <p>{emptyStateCopy[scope].description}</p>
                </div>
                <Link className="primary-button" to="/workspace/projects?view=create">
                  {t("tasks.createFirstProject")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create / AI drawer ── */}
      {createOpen ? createPortal(
        <div className="task-detail-overlay" onClick={() => setCreateOpen(false)}>
          <aside className="task-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-drawer-header">
              <div className="tasks-mode-tabs">
                <button type="button" className={createMode === "manual" ? "scope-chip active" : "scope-chip"} onClick={() => setCreateMode("manual")}>
                  <Plus size={13} /> {t("tasks.create.title")}
                </button>
                {user?.aiEntitlements?.aiPlanner ? (
                  <button type="button" className={createMode === "ai" ? "scope-chip active" : "scope-chip"} onClick={() => setCreateMode("ai")}>
                    <Bot size={13} /> {t("tasks.generateWithAi")}
                  </button>
                ) : null}
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setCreateOpen(false)}><X size={18} /></button>
            </div>

            {createMode === "manual" ? (
              <form className="stack-form" onSubmit={handleSubmit(async (values) => { await createTask.mutateAsync(values); })}>
                <label>{t("tasks.form.project")}
                  <select {...register("projectId")}>
                    <option value="">{t("tasks.form.chooseProject")}</option>
                    {projectsQuery.data?.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
                  </select>
                  {errors.projectId ? <small>{errors.projectId.message}</small> : null}
                </label>
                <label>{t("tasks.form.title")}
                  <input placeholder={t("tasks.form.titlePlaceholder")} {...register("title")} />
                  {errors.title ? <small>{errors.title.message}</small> : null}
                </label>
                <label>{t("tasks.form.description")}
                  <textarea rows={4} placeholder={t("tasks.form.descPlaceholder")} {...register("description")} />
                  {errors.description ? <small>{errors.description.message}</small> : null}
                </label>
                <div className="dual-form-row">
                  <label>{t("tasks.form.type")}
                    <select {...register("type")}>
                      <option value="TASK">{t("common.type.task")}</option>
                      <option value="STORY">{t("common.type.story")}</option>
                      <option value="BUG">{t("common.type.bug")}</option>
                      <option value="EPIC">{t("common.type.epic")}</option>
                    </select>
                  </label>
                  <label>{t("tasks.form.status")}
                    <select {...register("status")}>
                      <option value="BACKLOG">{t("common.status.backlog")}</option>
                      <option value="TODO">{t("common.status.todo")}</option>
                      <option value="IN_PROGRESS">{t("common.status.inProgress")}</option>
                      <option value="REVIEW">{t("common.status.review")}</option>
                      <option value="DONE">{t("common.status.done")}</option>
                    </select>
                  </label>
                </div>
                <div className="dual-form-row">
                  <label>{t("tasks.form.priority")}
                    <select {...register("priority")}>
                      <option value="LOW">{t("common.priority.low")}</option>
                      <option value="MEDIUM">{t("common.priority.medium")}</option>
                      <option value="HIGH">{t("common.priority.high")}</option>
                      <option value="CRITICAL">{t("common.priority.critical")}</option>
                    </select>
                  </label>
                  <label>{t("tasks.form.dueDate")}<input type="date" {...register("dueDate")} /></label>
                </div>
                <label>{t("tasks.form.assignee")}
                  <select {...register("assigneeId")}>
                    <option value="">{t("tasks.form.leaveUnassigned")}</option>
                    {usersQuery.data?.map((m) => <option key={m.id} value={m.id}>{m.fullName} · {m.email}</option>)}
                  </select>
                </label>
                {error ? <div className="form-error">{error}</div> : null}
                <button className="primary-button" type="submit" disabled={isSubmitting || createTask.isPending}>
                  <Plus size={16} /> {createTask.isPending ? t("common.creating") : t("tasks.form.submit")}
                </button>
              </form>
            ) : (
              <div className="ai-planner-body">
                {!user?.aiEntitlements?.aiPlanner ? (
                  <div className="empty-state compact-empty-state">
                    {t("tasks.ai.upgradeText")}{" "}
                    <Link className="eyebrow" to="/workspace/settings">{t("tasks.ai.upgradeLink")}</Link>
                  </div>
                ) : aiCreated ? (
                  <div className="ai-planner-success">
                    <Sparkles size={18} /> {t("tasks.ai.tasksCreated")}
                    <button type="button" className="ghost-button" onClick={() => { setAiCreated(false); setAiDescription(""); }}>{t("tasks.ai.generateAnother")}</button>
                  </div>
                ) : aiTasks.length ? (
                  <>
                    <div className="ai-planner-preview-header">
                      <strong>{t("tasks.ai.tasksReady", { count: String(aiTasks.length) })}</strong>
                      <button type="button" className="ghost-button" onClick={() => { setAiTasks([]); setAiEditIndex(null); }}>{t("tasks.ai.startOver")}</button>
                    </div>
                    <div className="ai-task-preview-list">
                      {aiTasks.map((task, i) => aiEditIndex === i ? (
                        <div key={i} className="ai-task-edit-row">
                          <label>{t("tasks.ai.editTitle")}<input value={task.title} onChange={(e) => setAiTasks((prev) => prev.map((t, idx) => idx === i ? { ...t, title: e.target.value } : t))} /></label>
                          <label>{t("tasks.ai.editDescription")}<textarea rows={2} value={task.description} onChange={(e) => setAiTasks((prev) => prev.map((t, idx) => idx === i ? { ...t, description: e.target.value } : t))} /></label>
                          <div className="dual-form-row">
                            <label>{t("tasks.ai.editType")}<select value={task.type} onChange={(e) => setAiTasks((prev) => prev.map((t, idx) => idx === i ? { ...t, type: e.target.value as GeneratedTask["type"] } : t))}>
                              <option value="EPIC">EPIC</option><option value="STORY">STORY</option><option value="TASK">TASK</option><option value="BUG">BUG</option>
                            </select></label>
                            <label>{t("tasks.ai.editPriority")}<select value={task.priority} onChange={(e) => setAiTasks((prev) => prev.map((t, idx) => idx === i ? { ...t, priority: e.target.value as GeneratedTask["priority"] } : t))}>
                              <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option>
                            </select></label>
                          </div>
                          <div className="ai-task-edit-actions">
                            <button type="button" className="ghost-button" onClick={() => setAiEditIndex(null)}><X size={13} /> {t("tasks.ai.cancel")}</button>
                            <button type="button" className="primary-button" onClick={() => setAiEditIndex(null)}>{t("tasks.ai.done")}</button>
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="ai-task-preview-row">
                          <div className="ai-task-preview-info">
                            <span className="ai-task-type-badge" style={{ color: typeColor[task.type] }}>{task.type}</span>
                            <strong>{task.title}</strong>
                            <p>{task.description}</p>
                          </div>
                          <div className="ai-task-preview-meta">
                            <span style={{ color: priorityColor[task.priority], fontWeight: 600, fontSize: "0.78rem" }}>{task.priority}</span>
                            {task.storyPoints ? <span className="ai-sp-badge">{task.storyPoints}sp</span> : null}
                            {task.daysFromNow ? <span className="ai-due-label">Due {format(addDays(new Date(), task.daysFromNow), "MMM d")}</span> : null}
                            <button type="button" className="ai-edit-btn" onClick={() => setAiEditIndex(i)}><Pencil size={12} /></button>
                            <button type="button" className="ai-remove-btn" onClick={() => setAiTasks((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {aiError ? <div className="form-error">{aiError}</div> : null}
                    <button type="button" className="primary-button" onClick={createAllAiTasks} disabled={aiCreating || !aiTasks.length}>
                      {aiCreating ? <><Loader2 size={15} className="spin" /> {t("tasks.ai.creating", { count: String(aiTasks.length) })}</> : <><Sparkles size={15} /> {t("tasks.ai.createTasks", { count: String(aiTasks.length) })}</>}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="ai-planner-form">
                      <label>{t("tasks.ai.project")}
                        <select value={aiProjectId} onChange={(e) => setAiProjectId(e.target.value)}>
                          <option value="">{t("tasks.ai.chooseProject")}</option>
                          {projectsQuery.data?.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
                        </select>
                      </label>
                      <label>{t("tasks.ai.describe")}
                        <textarea rows={4} placeholder={t("tasks.ai.descPlaceholder")} value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} />
                      </label>
                      <div className="dual-form-row">
                        <label>{t("tasks.ai.teamSize")}<input type="number" min={1} max={20} value={aiTeamSize} onChange={(e) => setAiTeamSize(Number(e.target.value))} /></label>
                        <label>{t("tasks.ai.sprintDays")}<input type="number" min={3} max={90} value={aiDuration} onChange={(e) => setAiDuration(Number(e.target.value))} /></label>
                      </div>
                    </div>
                    {aiError ? <div className="form-error">{aiError}</div> : null}
                    <div className="ai-planner-actions">
                      <button type="button" className="primary-button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || aiDescription.trim().length < 10 || !aiProjectId}>
                        {generateMutation.isPending ? <><Loader2 size={15} className="spin" /> {t("tasks.ai.generating")}</> : <><Bot size={15} /> {t("tasks.ai.generatePlan")}</>}
                      </button>
                      {generateMutation.isPending ? (
                        <button type="button" className="ghost-button" onClick={() => generateMutation.reset()}>
                          {t("tasks.ai.cancelGeneration")}
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      , document.body) : null}

      {/* ── Task detail drawer ── */}
      {selectedTaskId ? createPortal(
        <div className="task-detail-overlay" onClick={() => setSelectedTaskId(null)}>
          <aside className="task-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-drawer-header">
              <div>
                <span className="eyebrow">{t("tasks.detail.eyebrow")}</span>
                {detail ? <h3>{detail.title}</h3> : <h3 style={{ opacity: 0.4 }}>{t("tasks.detail.loading")}</h3>}
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setSelectedTaskId(null)}><X size={18} /></button>
            </div>
            <div className="task-detail-drawer-body">
            {taskDetailQuery.isLoading ? (
              <div className="page-loader" style={{ minHeight: 80 }}>{t("tasks.detail.loading")}</div>
            ) : detail ? (
              <>
                <div className="task-topline">
                  <span className={`badge badge-${detail.status.toLowerCase()}`}>{detail.status.replaceAll("_", " ")}</span>
                  <span className={`badge badge-priority-${detail.priority.toLowerCase()}`}>{detail.priority}</span>
                  <span className="badge">{detail.type}</span>
                </div>
                {detail.description ? <p className="task-detail-desc">{detail.description}</p> : null}
                <div className="meta-grid">
                  <span><UserRound size={13} /> {detail.assignee?.fullName || t("common.unassigned")}</span>
                  <span>{t("tasks.detail.reporter")}: {detail.reporter?.fullName ?? "—"}</span>
                  <span><CalendarClock size={13} /> {formatDate(detail.dueDate)}</span>
                  <span>{t("tasks.detail.project")}: {detail.project?.key} · {detail.project?.name}</span>
                </div>
                {detail.comments?.length ? (
                  <div className="comment-block">
                    <div className="panel-header">
                      <h3>{t("tasks.detail.comments")}</h3>
                      <MessageSquare size={16} />
                    </div>
                    <div className="comment-list">
                      {detail.comments.map((comment) => (
                        <article key={comment.id} className="comment-card">
                          <div className="identity-row">
                            <div>
                              <strong>{comment.author.fullName}</strong>
                              <p>{formatDate(comment.createdAt)}</p>
                            </div>
                          </div>
                          <p>{comment.body}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="timelog-block">
                  <div className="panel-header">
                    <h3>Time Tracking</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Clock size={15} />
                      {timeLogsQuery.data ? (
                        <span className="timelog-total">{timeLogsQuery.data.totalHours.toFixed(1)}h logged</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="timelog-form">
                    <input
                      type="number"
                      className="timelog-hours-input"
                      placeholder="Hours"
                      min="0.1"
                      max="24"
                      step="0.25"
                      value={timeHours}
                      onChange={(e) => setTimeHours(e.target.value)}
                    />
                    <input
                      className="timelog-note-input"
                      placeholder="Note (optional)"
                      value={timeNote}
                      onChange={(e) => setTimeNote(e.target.value)}
                    />
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!timeHours || Number(timeHours) <= 0 || logTimeMutation.isPending}
                      onClick={() => logTimeMutation.mutate()}
                    >
                      <Plus size={13} /> Log
                    </button>
                  </div>
                  {timeLogsQuery.data?.items.length ? (
                    <div className="timelog-list">
                      {timeLogsQuery.data.items.map((log) => (
                        <div key={log.id} className="timelog-row">
                          <Clock size={12} />
                          <span className="timelog-hours">{log.hours}h</span>
                          <span className="timelog-user">{log.user.fullName}</span>
                          {log.note ? <span className="timelog-note">{log.note}</span> : null}
                          {log.user.id === user?.id ? (
                            <button
                              type="button"
                              className="timelog-delete"
                              onClick={() => deleteTimeLogMutation.mutate(log.id)}
                              disabled={deleteTimeLogMutation.isPending}
                            >
                              <X size={11} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-text" style={{ fontSize: "0.82rem" }}>No time logged yet.</p>
                  )}
                </div>
              </>
            ) : null}
            </div>
          </aside>
        </div>
      , document.body) : null}
    </section>
  );
}
