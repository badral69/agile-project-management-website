import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowLeft, CalendarClock, ChevronRight, GanttChartSquare, Kanban, Link2, MailSearch, MessageSquare, Plus, Save, Trash2, UserPlus, Users, UsersRound, X, Zap } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { AiPlannerPanel } from "../components/ai/AiPlannerPanel";
import { VoiceTaskButton } from "../components/ai/VoiceTaskButton";
import { GanttChart } from "../components/charts/GanttChart";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { ProjectDetail, ProjectMemberRole, Sprint, SprintStatus, Task, TaskDetail, TaskPriority, TaskStatus, TaskType, User } from "../types";

const statuses: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const defaultTaskDraft = {
  title: "",
  description: "",
  type: "TASK" as TaskType,
  status: "TODO" as TaskStatus,
  priority: "MEDIUM" as TaskPriority,
  storyPoints: "",
  assigneeId: "",
  dueDate: "",
};

const defaultSprintDraft = {
  name: "",
  goal: "",
  startDate: "",
  endDate: "",
};

type TFn = (key: import("../features/i18n/I18nContext").TranslationKey, vars?: Record<string, string | number>) => string;

function SprintBurndown({ sprint, t }: { sprint: Sprint; t: TFn }) {
  const total = sprint.tasks.length;
  if (total === 0 || !sprint.startDate || !sprint.endDate) return null;

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const dayMs = 86400000;
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);

  const doneSoFar = sprint.tasks.filter(({ task }) => task.status === "DONE").length;

  const days = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(start.getTime() + i * dayMs);
    const done = i === dayCount - 1 ? doneSoFar : Math.round(doneSoFar * (i / (dayCount - 1)));
    return {
      day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      remaining: total - done,
      ideal: Math.round(total * (1 - i / (dayCount - 1))),
    };
  });

  return (
    <div className="sprint-burndown">
      <div className="sprint-burndown-header">
        <strong>{t("project.burndown.title")}</strong>
        <span className="eyebrow">{t("project.burndown.eyebrow")}</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={days} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, padding: "4px 8px" }}
            formatter={(val, name) => [val, name === "remaining" ? t("project.burndown.remaining") : t("project.burndown.ideal")]}
          />
          <ReferenceLine y={0} stroke="var(--line, #e2e8f0)" />
          <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="4 3" dot={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey="remaining" stroke="#6366f1" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SprintProgress({ tasks, t }: { tasks: Sprint["tasks"]; t: TFn }) {
  const total = tasks.length;
  if (total === 0) return <p className="sprint-empty">{t("project.sprint.noTasks")}</p>;
  const done = tasks.filter((st) => st.task.status === "DONE").length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="sprint-progress-wrap">
      <div className="sprint-progress-bar">
        <div className="sprint-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sprint-progress-label">{t("project.sprint.progress", { done, total, pct })}</span>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [sprintOpen, setSprintOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectMemberRole>("CONTRIBUTOR");
  const [taskDraft, setTaskDraft] = useState(defaultTaskDraft);
  const [taskEditDraft, setTaskEditDraft] = useState(defaultTaskDraft);
  const [sprintDraft, setSprintDraft] = useState(defaultSprintDraft);
  const [blockerTaskId, setBlockerTaskId] = useState("");
  const [boardView, setBoardView] = useState<"board" | "gantt">("board");
  const [error, setError] = useState("");
  const [retroModal, setRetroModal] = useState<{ sprintId: string; sprint: Sprint } | null>(null);
  const [retroText, setRetroText] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const response = await api.get<{ item: ProjectDetail }>(`/projects/${id}`);
      return response.data.item;
    },
    enabled: Boolean(id),
  });

  const sprintsQuery = useQuery({
    queryKey: ["sprints", id],
    queryFn: async () => {
      const res = await api.get<{ items: Sprint[] }>(`/sprints/projects/${id}/sprints`);
      return res.data.items;
    },
    enabled: Boolean(id),
  });

  const membership = useMemo(
    () => projectQuery.data?.members.find((member) => member.user.id === user?.id),
    [projectQuery.data?.members, user?.id],
  );
  const canManageProject =
    user?.role === "ADMIN" ||
    user?.role === "MODERATOR" ||
    membership?.memberRole === "OWNER" ||
    membership?.memberRole === "MANAGER";

  const taskQuery = useQuery({
    queryKey: ["task", selectedTaskId],
    queryFn: async () => {
      const response = await api.get<{ item: TaskDetail }>(`/tasks/${selectedTaskId}`);
      return response.data.item;
    },
    enabled: Boolean(selectedTaskId),
  });

  const memberCandidatesQuery = useQuery({
    queryKey: ["project-member-candidates", id, memberSearch],
    queryFn: async () => {
      const response = await api.get<{ items: User[] }>(`/projects/${id}/member-candidates?search=${encodeURIComponent(memberSearch.trim())}`);
      return response.data.items;
    },
    enabled: Boolean(id) && Boolean(canManageProject) && memberSearch.trim().length >= 2,
  });

  const addComment = useMutation({
    mutationFn: async () => api.post(`/tasks/${selectedTaskId}/comments`, { body: commentBody }),
    onSuccess: async () => {
      setCommentBody("");
      setError("");
      toast.success(t("toast.commentAdded"));
      await queryClient.invalidateQueries({ queryKey: ["task", selectedTaskId] });
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e) => {
      const msg = getErrorMessage(e);
      setError(msg);
      toast.error(msg);
    },
  });

  const addMember = useMutation({
    mutationFn: async (member: User) =>
      api.post(`/projects/${id}/members`, { userId: member.id, memberRole }),
    onSuccess: async () => {
      setError("");
      setMemberSearch("");
      toast.success(t("toast.memberAdded"));
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
      await queryClient.invalidateQueries({ queryKey: ["project-member-candidates", id] });
    },
    onError: (e) => {
      const msg = getErrorMessage(e);
      setError(msg);
      toast.error(msg);
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => api.delete(`/projects/${id}/members/${memberId}`),
    onSuccess: async () => {
      setError("");
      toast.success(t("toast.memberRemoved"));
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e) => {
      const msg = getErrorMessage(e);
      setError(msg);
      toast.error(msg);
    },
  });

  const createTask = useMutation({
    mutationFn: async () =>
      api.post("/tasks", {
        projectId: id,
        title: taskDraft.title,
        description: taskDraft.description,
        type: taskDraft.type,
        status: taskDraft.status,
        priority: taskDraft.priority,
        storyPoints: taskDraft.storyPoints ? Number(taskDraft.storyPoints) : undefined,
        assigneeId: taskDraft.assigneeId || undefined,
        dueDate: taskDraft.dueDate || undefined,
      }),
    onSuccess: async () => {
      setError("");
      setTaskDraft(defaultTaskDraft);
      setCreateOpen(false);
      toast.success(t("toast.taskCreated"));
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => {
      const msg = getErrorMessage(e);
      setError(msg);
      toast.error(msg);
    },
  });

  const updateTask = useMutation({
    mutationFn: async () =>
      api.put(`/tasks/${selectedTaskId}`, {
        projectId: id,
        title: taskEditDraft.title,
        description: taskEditDraft.description,
        type: taskEditDraft.type,
        status: taskEditDraft.status,
        priority: taskEditDraft.priority,
        storyPoints: taskEditDraft.storyPoints ? Number(taskEditDraft.storyPoints) : undefined,
        assigneeId: taskEditDraft.assigneeId || undefined,
        dueDate: taskEditDraft.dueDate || undefined,
      }),
    onSuccess: async () => {
      setError("");
      toast.success(t("toast.taskUpdated"));
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
      await queryClient.invalidateQueries({ queryKey: ["task", selectedTaskId] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => {
      const msg = getErrorMessage(e);
      setError(msg);
      toast.error(msg);
    },
  });

  const moveTask = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const task = projectQuery.data?.tasks.find((t) => t.id === taskId);
      if (!task) return;
      await api.put(`/tasks/${taskId}`, {
        projectId: id,
        title: task.title,
        description: task.description,
        type: task.type,
        status,
        priority: task.priority,
        storyPoints: task.storyPoints ?? undefined,
        assigneeId: task.assigneeId ?? undefined,
        dueDate: task.dueDate ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createSprint = useMutation({
    mutationFn: async () =>
      api.post(`/sprints/projects/${id}/sprints`, {
        name: sprintDraft.name,
        goal: sprintDraft.goal || undefined,
        startDate: sprintDraft.startDate,
        endDate: sprintDraft.endDate,
      }),
    onSuccess: async () => {
      setError("");
      setSprintDraft(defaultSprintDraft);
      setSprintOpen(false);
      toast.success(t("toast.sprintCreated"));
      await queryClient.invalidateQueries({ queryKey: ["sprints", id] });
    },
    onError: (e) => {
      const msg = getErrorMessage(e);
      setError(msg);
      toast.error(msg);
    },
  });

  const updateSprintStatus = useMutation({
    mutationFn: async ({ sprintId, status, sprint, retrospective }: { sprintId: string; status: SprintStatus; sprint: Sprint; retrospective?: string }) =>
      api.put(`/sprints/sprints/${sprintId}`, { ...sprint, status, retrospective }),
    onSuccess: () => {
      setRetroModal(null);
      setRetroText("");
      queryClient.invalidateQueries({ queryKey: ["sprints", id] });
    },
  });

  const deleteSprint = useMutation({
    mutationFn: async (sprintId: string) => api.delete(`/sprints/sprints/${sprintId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", id] }),
  });

  const addTaskToSprint = useMutation({
    mutationFn: async ({ sprintId, taskId }: { sprintId: string; taskId: string }) =>
      api.post(`/sprints/sprints/${sprintId}/tasks`, { taskId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", id] }),
    onError: (e) => setError(getErrorMessage(e)),
  });

  const removeTaskFromSprint = useMutation({
    mutationFn: async ({ sprintId, taskId }: { sprintId: string; taskId: string }) =>
      api.delete(`/sprints/sprints/${sprintId}/tasks/${taskId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", id] }),
  });

  const addBlocker = useMutation({
    mutationFn: async (blockerId: string) =>
      api.post(`/tasks/${selectedTaskId}/blockers`, { blockerId }),
    onSuccess: async () => {
      setBlockerTaskId("");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["task", selectedTaskId] });
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const removeBlocker = useMutation({
    mutationFn: async (blockerId: string) =>
      api.delete(`/tasks/${selectedTaskId}/blockers/${blockerId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", selectedTaskId] }),
  });

  const groupedTasks = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: (projectQuery.data?.tasks || []).filter((task) => task.status === status),
    }));
  }, [projectQuery.data?.tasks]);

  const activeSprint = useMemo(
    () => sprintsQuery.data?.find((s) => s.status === "ACTIVE") ?? sprintsQuery.data?.[0] ?? null,
    [sprintsQuery.data],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedTaskId) { setSelectedTaskId(null); return; }
      if (createOpen) { setCreateOpen(false); return; }
      if (memberOpen) { setMemberOpen(false); return; }
      if (sprintOpen) { setSprintOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedTaskId, createOpen, memberOpen, sprintOpen]);

  useEffect(() => {
    const selectedTask = taskQuery.data;
    if (!selectedTask) return;
    setTaskEditDraft({
      title: selectedTask.title,
      description: selectedTask.description,
      type: selectedTask.type,
      status: selectedTask.status,
      priority: selectedTask.priority,
      storyPoints: selectedTask.storyPoints ? String(selectedTask.storyPoints) : "",
      assigneeId: selectedTask.assigneeId || "",
      dueDate: selectedTask.dueDate ? selectedTask.dueDate.slice(0, 10) : "",
    });
  }, [taskQuery.data]);

  if (projectQuery.isLoading) {
    return <div className="page-loader">Loading project workspace...</div>;
  }

  if (projectQuery.isError || !projectQuery.data) {
    const is429 = (projectQuery.error as { response?: { status?: number } })?.response?.status === 429;
    return (
      <div className="page-loader" style={{ flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          {is429 ? "Too many requests — please wait a moment and refresh." : "Failed to load project. Please try again."}
        </p>
        <button className="ghost-button" type="button" onClick={() => projectQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const project = projectQuery.data;
  const selectedTask = taskQuery.data;
  const manageableMembers = project.members.filter((member) => member.memberRole !== "VIEWER");
  const allProjectTasks: Task[] = project.tasks;

  return (
    <section className="page project-detail-page">
      <div className="detail-page-topbar">
        <div className="detail-breadcrumbs">
          <Link to="/workspace/dashboard">{t("common.workspace")}</Link>
          <ChevronRight size={14} />
          <Link to="/workspace/projects">{t("sidebar.projects")}</Link>
          <ChevronRight size={14} />
          <span>{project.key}</span>
        </div>
        <Link className="ghost-button detail-back-button" to="/workspace/projects">
          <ArrowLeft size={14} />
          {t("common.back")}
        </Link>
      </div>

      <PageHeader
        eyebrow={`Project ${project.key}`}
        title={project.name}
        description={project.description}
        actions={
          <div className="header-pill-row">
            {canManageProject && user?.role === "ADMIN" ? (
              <Link className="ghost-button" to={`/workspace/performance?projectId=${project.id}`}>
                Performance
              </Link>
            ) : null}
            {canManageProject && user?.aiEntitlements?.voiceTasks ? (
              <VoiceTaskButton
                defaultProjectId={project.id}
                projects={[{ id: project.id, key: project.key, name: project.name }]}
                onCreated={() => queryClient.invalidateQueries({ queryKey: ["project", project.id] })}
              />
            ) : null}
            <span className={`badge badge-${project.status.toLowerCase()}`}>{project.status.replaceAll("_", " ")}</span>
            <span className="badge">{project._count.tasks} tasks</span>
            <span className="badge">{project._count.members} members</span>
          </div>
        }
      />

      <div className="project-workspace-layout">
        {/* ── Board ── */}
        <div className="panel project-board-panel">
          <div className="panel-header">
            <div className="board-view-toggle">
              <button
                type="button"
                className={`ghost-button${boardView === "board" ? " active" : ""}`}
                onClick={() => setBoardView("board")}
              >
                <Kanban size={14} /> Board
              </button>
              <button
                type="button"
                className={`ghost-button${boardView === "gantt" ? " active" : ""}`}
                onClick={() => setBoardView("gantt")}
              >
                <GanttChartSquare size={14} /> Gantt
              </button>
            </div>
            <div className="header-pill-row">
              {canManageProject ? (
                <button className="ghost-button" type="button" onClick={() => setSprintOpen(true)}>
                  <Zap size={14} /> Sprints
                </button>
              ) : null}
              {canManageProject ? (
                <button className="ghost-button" type="button" onClick={() => setTeamOpen(true)}>
                  <UsersRound size={14} /> Team
                </button>
              ) : null}
              {canManageProject ? (
                <button className="ghost-button" type="button" onClick={() => setMemberOpen(true)}>
                  <UserPlus size={14} /> Add member
                </button>
              ) : null}
              {canManageProject ? (
                <button className="primary-button" type="button" onClick={() => setCreateOpen(true)}>
                  <Plus size={14} /> New task
                </button>
              ) : null}
            </div>
          </div>
          {project.company ? <div className="mini-text">Company: {project.company.name}</div> : null}

          {/* ── Gantt view ── */}
          {boardView === "gantt" ? (
            <GanttChart
              sprints={sprintsQuery.data ?? []}
              tasks={allProjectTasks}
              onAssignToSprint={canManageProject ? (taskId, sprintId) => addTaskToSprint.mutate({ sprintId, taskId }) : undefined}
              onClickTask={setSelectedTaskId}
            />
          ) : null}

          {/* ── Active sprint banner ── */}
          {boardView === "board" && activeSprint ? (
            <div className="sprint-banner">
              <div className="sprint-banner-left">
                <Zap size={14} />
                <strong>{activeSprint.name}</strong>
                {activeSprint.goal ? <span className="sprint-goal">{activeSprint.goal}</span> : null}
              </div>
              <div className="sprint-banner-right">
                <span className="sprint-dates">
                  {formatDate(activeSprint.startDate)} → {formatDate(activeSprint.endDate)}
                </span>
                <span className={`badge badge-sprint-${activeSprint.status.toLowerCase()}`}>
                  {activeSprint.status}
                </span>
              </div>
              <SprintProgress tasks={activeSprint.tasks} t={t} />
            </div>
          ) : null}

          <div className="board-grid" style={{ display: boardView === "gantt" ? "none" : undefined }}>
            {groupedTasks.map((column) => (
              <section
                key={column.status}
                className="board-column"
                data-status={column.status}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("drag-over"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("drag-over");
                  const taskId = e.dataTransfer.getData("taskId");
                  if (taskId) moveTask.mutate({ taskId, status: column.status });
                }}
              >
                <header>
                  <strong>{column.status.replaceAll("_", " ")}</strong>
                  <span className="board-column-count">{column.tasks.length}</span>
                </header>
                <div className="board-column-body">
                  {column.tasks.map((task) => {
                    const isOverdue = task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();
                    return (
                      <button
                        type="button"
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("taskId", task.id);
                          e.currentTarget.classList.add("dragging");
                        }}
                        onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); }}
                        className={`task-card compact board-task-card${selectedTaskId === task.id ? " active" : ""}${isOverdue ? " board-task-overdue" : ""}`}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="task-topline">
                          <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                          <span className="mini-text">{task.type}</span>
                        </div>
                        <strong className="board-task-title">{task.title}</strong>
                        {task.dueDate ? (
                          <span className={`board-task-due${isOverdue ? " overdue" : ""}`}>
                            {formatDate(task.dueDate)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {boardView === "board" && canManageProject && user?.aiEntitlements?.aiPlanner ? (
            <AiPlannerPanel projectId={project.id} projectName={project.name} />
          ) : boardView === "board" && canManageProject ? (
            <div className="empty-state compact-empty-state">AI planning is available on Professional and Enterprise plans.</div>
          ) : null}
        </div>
      </div>

      {/* ── Sprints modal ── */}
      {sprintOpen ? createPortal(
        <div className="task-detail-overlay" onClick={() => setSprintOpen(false)}>
          <aside className="task-detail-drawer sprint-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-drawer-header">
              <div>
                <span className="eyebrow">Sprint management</span>
                <h3>Sprints</h3>
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setSprintOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Create sprint form */}
            {canManageProject ? (
              <form
                className="stack-form sprint-create-form"
                onSubmit={async (e) => { e.preventDefault(); await createSprint.mutateAsync(); }}
              >
                <div className="panel-header">
                  <h4>New sprint</h4>
                  <Zap size={14} />
                </div>
                <label>
                  Sprint name
                  <input
                    value={sprintDraft.name}
                    onChange={(e) => setSprintDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Sprint 1 – Core features"
                  />
                </label>
                <label>
                  Sprint goal (optional)
                  <input
                    value={sprintDraft.goal}
                    onChange={(e) => setSprintDraft((d) => ({ ...d, goal: e.target.value }))}
                    placeholder="Ship the login flow"
                  />
                </label>
                <div className="meta-grid">
                  <label>
                    Start date
                    <input
                      type="date"
                      value={sprintDraft.startDate}
                      onChange={(e) => setSprintDraft((d) => ({ ...d, startDate: e.target.value }))}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      value={sprintDraft.endDate}
                      onChange={(e) => setSprintDraft((d) => ({ ...d, endDate: e.target.value }))}
                    />
                  </label>
                </div>
                {error ? <div className="form-error">{error}</div> : null}
                <button
                  className="primary-button"
                  type="submit"
                  disabled={!sprintDraft.name.trim() || !sprintDraft.startDate || !sprintDraft.endDate || createSprint.isPending}
                >
                  {createSprint.isPending ? "Creating..." : "Create sprint"}
                </button>
              </form>
            ) : null}

            {/* Sprint list */}
            <div className="sprint-list">
              {sprintsQuery.isLoading ? (
                <div className="empty-state compact">Loading sprints...</div>
              ) : (sprintsQuery.data ?? []).length === 0 ? (
                <div className="empty-state compact">No sprints yet. Create your first sprint above.</div>
              ) : (
                (sprintsQuery.data ?? []).map((sprint) => (
                  <div key={sprint.id} className="sprint-card">
                    <div className="sprint-card-header">
                      <div className="sprint-card-title">
                        <Zap size={13} />
                        <strong>{sprint.name}</strong>
                        <span className={`badge badge-sprint-${sprint.status.toLowerCase()}`}>{sprint.status}</span>
                      </div>
                      <div className="sprint-card-actions">
                        {sprint.status === "PLANNING" && canManageProject ? (
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={() => updateSprintStatus.mutate({ sprintId: sprint.id, status: "ACTIVE", sprint })}
                          >
                            Start
                          </button>
                        ) : sprint.status === "ACTIVE" && canManageProject ? (
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={() => { setRetroModal({ sprintId: sprint.id, sprint }); setRetroText(""); }}
                          >
                            Complete
                          </button>
                        ) : null}
                        {canManageProject ? (
                          <button
                            type="button"
                            className="ghost-button icon-button"
                            onClick={() => deleteSprint.mutate(sprint.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {sprint.goal ? <p className="sprint-goal">{sprint.goal}</p> : null}
                    {sprint.retrospective ? (
                      <div className="sprint-retro-block">
                        <span className="eyebrow">Retrospective</span>
                        <p>{sprint.retrospective}</p>
                      </div>
                    ) : null}
                    <div className="sprint-dates-row">
                      <CalendarClock size={12} />
                      {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                    </div>
                    <SprintProgress tasks={sprint.tasks} t={t} />
                    <SprintBurndown sprint={sprint} t={t} />

                    {/* Task assignment to sprint */}
                    {canManageProject && sprint.status !== "COMPLETED" ? (
                      <div className="sprint-task-assign">
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              addTaskToSprint.mutate({ sprintId: sprint.id, taskId: e.target.value });
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">+ Add task to sprint</option>
                          {allProjectTasks
                            .filter((t) => !sprint.tasks.some((st) => st.taskId === t.id))
                            .map((t) => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                      </div>
                    ) : null}

                    {/* Tasks in sprint */}
                    {sprint.tasks.length > 0 ? (
                      <div className="sprint-task-list">
                        {sprint.tasks.map(({ taskId, task }) => (
                          <div key={taskId} className="sprint-task-row">
                            <span className={`status-dot status-dot-${task.status.toLowerCase()}`} />
                            <span className="sprint-task-title">{task.title}</span>
                            <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                            {canManageProject ? (
                              <button
                                type="button"
                                className="ghost-button icon-button"
                                onClick={() => removeTaskFromSprint.mutate({ sprintId: sprint.id, taskId })}
                              >
                                <X size={12} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      , document.body) : null}

      {/* ── Add member modal ── */}
      {memberOpen ? createPortal(
        <div className="task-detail-overlay" onClick={() => setMemberOpen(false)}>
          <aside className="task-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-drawer-header">
              <div>
                <span className="eyebrow">Project members</span>
                <h3>Add member</h3>
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setMemberOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="stack-form project-management-form">
              <label>
                Member role
                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as ProjectMemberRole)}>
                  <option value="MANAGER">Manager</option>
                  <option value="CONTRIBUTOR">Contributor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </label>
              <label className="search-field">
                <MailSearch size={16} />
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search users by email or name"
                />
              </label>
            </div>
            <div className="member-search-results">
              {memberSearch.trim().length < 2 ? (
                <div className="empty-state compact">Type at least 2 letters to search.</div>
              ) : memberCandidatesQuery.isLoading ? (
                <div className="empty-state compact">Searching...</div>
              ) : memberCandidatesQuery.data?.length ? (
                memberCandidatesQuery.data.map((candidate) => (
                  <div key={candidate.id} className="identity-card border-card member-search-card">
                    <UserAvatar fullName={candidate.fullName} avatarColor={candidate.avatarColor} avatarUrl={candidate.avatarUrl} />
                    <div>
                      <strong>{candidate.fullName}</strong>
                      <p>{candidate.email}</p>
                    </div>
                    <button className="secondary-button" type="button" disabled={addMember.isPending} onClick={() => addMember.mutate(candidate)}>
                      <UserPlus size={14} /> Add
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">No matching users found.</div>
              )}
            </div>
          </aside>
        </div>
      , document.body) : null}

      {/* ── Team & activity modal ── */}
      {teamOpen ? createPortal(
        <div className="task-detail-overlay" onClick={() => setTeamOpen(false)}>
          <aside className="task-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-drawer-header">
              <div>
                <span className="eyebrow">Project pulse</span>
                <h3>Team and activity</h3>
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setTeamOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="meta-grid wide">
              <span><Users size={14} /> Owner: {project.owner.fullName}</span>
              <span>Start: {formatDate(project.startDate)}</span>
              <span>End: {formatDate(project.endDate)}</span>
              <span>Status: {project.status.replaceAll("_", " ")}</span>
            </div>
            <div className="member-list">
              {project.members.map((member) => (
                <div key={member.id} className="identity-card border-card">
                  <UserAvatar fullName={member.user.fullName} avatarColor={member.user.avatarColor} avatarUrl={member.user.avatarUrl} />
                  <div>
                    <strong>{member.user.fullName}</strong>
                    <p>{member.user.email}</p>
                    <p>{member.memberRole} · {member.user.role}</p>
                  </div>
                  {canManageProject && member.memberRole !== "OWNER" ? (
                    <button className="ghost-button icon-button" type="button" onClick={() => removeMember.mutate(member.id)}>
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="activity-list">
              {project.activities.map((activity) => (
                <div key={activity.id} className="activity-row">
                  <Activity size={16} />
                  <div>
                    <strong>{activity.action.replaceAll("_", " ")}</strong>
                    <p>{activity.actor?.fullName || "System"} · {formatDate(activity.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      , document.body) : null}

      {/* ── Create task modal ── */}
      {createOpen ? createPortal(
        <div className="task-detail-overlay" onClick={() => setCreateOpen(false)}>
          <aside className="task-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-drawer-header">
              <div>
                <span className="eyebrow">New work package</span>
                <h3>Assign new task</h3>
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form
              className="stack-form project-management-form"
              onSubmit={async (e) => { e.preventDefault(); await createTask.mutateAsync(); }}
            >
              <label>
                Title
                <input value={taskDraft.title} onChange={(e) => setTaskDraft((c) => ({ ...c, title: e.target.value }))} />
              </label>
              <label>
                Description
                <textarea rows={3} value={taskDraft.description} onChange={(e) => setTaskDraft((c) => ({ ...c, description: e.target.value }))} />
              </label>
              <label>
                Assignee
                <select value={taskDraft.assigneeId} onChange={(e) => setTaskDraft((c) => ({ ...c, assigneeId: e.target.value }))}>
                  <option value="">Choose a project member</option>
                  {manageableMembers.map((member) => (
                    <option key={member.id} value={member.user.id}>{member.user.fullName} · {member.user.email}</option>
                  ))}
                </select>
              </label>
              <div className="meta-grid">
                <label>
                  Deadline
                  <input type="date" value={taskDraft.dueDate} onChange={(e) => setTaskDraft((c) => ({ ...c, dueDate: e.target.value }))} />
                </label>
                <label>
                  Story points
                  <input type="number" min="1" max="21" value={taskDraft.storyPoints} onChange={(e) => setTaskDraft((c) => ({ ...c, storyPoints: e.target.value }))} />
                </label>
              </div>
              <div className="meta-grid">
                <label>
                  Status
                  <select value={taskDraft.status} onChange={(e) => setTaskDraft((c) => ({ ...c, status: e.target.value as TaskStatus }))}>
                    {statuses.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
                <label>
                  Priority
                  <select value={taskDraft.priority} onChange={(e) => setTaskDraft((c) => ({ ...c, priority: e.target.value as TaskPriority }))}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </label>
              </div>
              <label>
                Type
                <select value={taskDraft.type} onChange={(e) => setTaskDraft((c) => ({ ...c, type: e.target.value as TaskType }))}>
                  <option value="TASK">Task</option>
                  <option value="STORY">Story</option>
                  <option value="BUG">Bug</option>
                  <option value="EPIC">Epic</option>
                </select>
              </label>
              {error ? <div className="form-error">{error}</div> : null}
              <button
                className="primary-button"
                type="submit"
                disabled={!taskDraft.title.trim() || !taskDraft.description.trim() || createTask.isPending}
              >
                {createTask.isPending ? "Assigning..." : "Create and assign task"}
              </button>
            </form>
          </aside>
        </div>
      , document.body) : null}

      {/* ── Task detail modal drawer ── */}
      {selectedTaskId ? createPortal(
        <div className="task-detail-overlay" onClick={() => setSelectedTaskId(null)}>
          <aside className="task-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-drawer-header">
              <div>
                <span className="eyebrow">Work package</span>
                {selectedTask ? <h3>{selectedTask.title}</h3> : <h3 className="loading-shimmer-text">Loading…</h3>}
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setSelectedTaskId(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="task-detail-drawer-body">
            {taskQuery.isLoading ? (
              <div className="page-loader" style={{ minHeight: 120 }}>Loading…</div>
            ) : selectedTask ? (
              <>
                <div className="task-topline">
                  <span className={`badge badge-${selectedTask.status.toLowerCase()}`}>{selectedTask.status.replaceAll("_", " ")}</span>
                  <span className={`badge badge-priority-${selectedTask.priority.toLowerCase()}`}>{selectedTask.priority}</span>
                  <span className="badge">{selectedTask.type}</span>
                </div>

                {selectedTask.description ? <p className="task-detail-desc">{selectedTask.description}</p> : null}

                <div className="meta-grid">
                  <span>Assignee: {selectedTask.assignee?.fullName || "Unassigned"}</span>
                  <span>Reporter: {selectedTask.reporter?.fullName}</span>
                  <span>Due date: {formatDate(selectedTask.dueDate)}</span>
                  <span>Story points: {selectedTask.storyPoints ?? "Not estimated"}</span>
                </div>

                {/* ── Blockers ── */}
                <div className="blockers-block">
                  <div className="panel-header">
                    <h3>Blockers</h3>
                    <AlertTriangle size={15} />
                  </div>
                  {selectedTask.blockedBy.length > 0 ? (
                    <div className="blocker-list">
                      {selectedTask.blockedBy.map((b) => (
                        <div key={b.id} className="blocker-row">
                          <AlertTriangle size={13} className="blocker-icon" />
                          <span className="blocker-title">{b.title}</span>
                          <span className={`badge badge-priority-${b.priority.toLowerCase()}`}>{b.priority}</span>
                          <span className={`status-pill status-${b.status.toLowerCase()}`}>
                            <i className="status-dot" />{b.status.replaceAll("_", " ")}
                          </span>
                          <button
                            type="button"
                            className="ghost-button icon-button"
                            onClick={() => removeBlocker.mutate(b.id)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="blocker-empty">No blockers. This task is free to proceed.</p>
                  )}

                  {selectedTask.blocking.length > 0 ? (
                    <div className="blocking-notice">
                      <Link2 size={13} />
                      <span>This task is blocking: {selectedTask.blocking.map((b) => b.title).join(", ")}</span>
                    </div>
                  ) : null}

                  {canManageProject ? (
                    <div className="blocker-add-row">
                      <select
                        value={blockerTaskId}
                        onChange={(e) => setBlockerTaskId(e.target.value)}
                      >
                        <option value="">Select a blocking task…</option>
                        {allProjectTasks
                          .filter((t) => t.id !== selectedTaskId && !selectedTask.blockedBy.some((b) => b.id === t.id))
                          .map((t) => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={!blockerTaskId || addBlocker.isPending}
                        onClick={() => addBlocker.mutate(blockerTaskId)}
                      >
                        Add blocker
                      </button>
                    </div>
                  ) : null}
                </div>

                {canManageProject ? (
                  <div className="stack-form project-management-form">
                    <div className="panel-header">
                      <h3>Edit work package</h3>
                      <Save size={16} />
                    </div>
                    <label>
                      Assignee
                      <select value={taskEditDraft.assigneeId} onChange={(e) => setTaskEditDraft((c) => ({ ...c, assigneeId: e.target.value }))}>
                        <option value="">Unassigned</option>
                        {manageableMembers.map((member) => (
                          <option key={member.id} value={member.user.id}>{member.user.fullName} · {member.user.email}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Deadline
                      <input type="date" value={taskEditDraft.dueDate} onChange={(e) => setTaskEditDraft((c) => ({ ...c, dueDate: e.target.value }))} />
                    </label>
                    <label>
                      Status
                      <select value={taskEditDraft.status} onChange={(e) => setTaskEditDraft((c) => ({ ...c, status: e.target.value as TaskStatus }))}>
                        {statuses.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                      </select>
                    </label>
                    {error ? <div className="form-error">{error}</div> : null}
                    <button className="primary-button" type="button" disabled={updateTask.isPending} onClick={() => updateTask.mutate()}>
                      {updateTask.isPending ? "Saving..." : "Save task changes"}
                    </button>
                  </div>
                ) : null}

                <div className="comment-block">
                  <div className="panel-header">
                    <h3>Comments</h3>
                    <MessageSquare size={16} />
                  </div>
                  <div className="comment-list">
                    {selectedTask.comments.map((comment) => (
                      <article key={comment.id} className="comment-card">
                        <div className="identity-row">
                          <UserAvatar fullName={comment.author.fullName} avatarColor={comment.author.avatarColor} avatarUrl={comment.author.avatarUrl} />
                          <div>
                            <strong>{comment.author.fullName}</strong>
                            <p>{formatDate(comment.createdAt)}</p>
                          </div>
                        </div>
                        <p>{comment.body}</p>
                      </article>
                    ))}
                  </div>
                  <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={3} placeholder="Add a comment…" />
                  <button className="primary-button" disabled={!commentBody.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                    {addComment.isPending ? "Posting..." : "Add comment"}
                  </button>
                </div>
              </>
            ) : null}
            </div>
          </aside>
        </div>
      , document.body) : null}

      {retroModal ? createPortal(
        <div className="task-detail-overlay" onClick={() => setRetroModal(null)}>
          <div className="retro-modal" onClick={(e) => e.stopPropagation()}>
            <div className="retro-modal-header">
              <div>
                <span className="eyebrow">Sprint Complete</span>
                <h3>{retroModal.sprint.name}</h3>
              </div>
              <button type="button" className="ghost-button icon-button" onClick={() => setRetroModal(null)}><X size={18} /></button>
            </div>
            <div className="retro-modal-body">
              <p className="retro-hint">Write a quick retrospective before closing this sprint. What went well? What to improve?</p>
              <textarea
                className="retro-textarea"
                rows={6}
                placeholder="What went well, what didn't, and what will we do differently next sprint…"
                value={retroText}
                onChange={(e) => setRetroText(e.target.value)}
              />
            </div>
            <div className="retro-modal-footer">
              <button type="button" className="ghost-button" onClick={() => setRetroModal(null)}>Cancel</button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => updateSprintStatus.mutate({ sprintId: retroModal.sprintId, status: "COMPLETED", sprint: retroModal.sprint })}
                disabled={updateSprintStatus.isPending}
              >
                Skip retro & complete
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={updateSprintStatus.isPending}
                onClick={() => updateSprintStatus.mutate({ sprintId: retroModal.sprintId, status: "COMPLETED", sprint: retroModal.sprint, retrospective: retroText || undefined })}
              >
                {updateSprintStatus.isPending ? "Completing…" : "Save & complete sprint"}
              </button>
            </div>
          </div>
        </div>
      , document.body) : null}
    </section>
  );
}
