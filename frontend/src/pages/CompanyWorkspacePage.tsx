import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, Circle, Clock, FolderKanban, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { VoiceTaskButton } from "../components/ai/VoiceTaskButton";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";

type Member = {
  id: string;
  memberRole: "SUPERVISOR" | "WORKER";
  user: { id: string; fullName: string; email: string; avatarColor: string; avatarUrl?: string };
};

type Company = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  members: Member[];
  _count: { members: number; projects: number };
};

type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  dueDate: string | null;
  assignee: { id: string; fullName: string; avatarColor: string } | null;
  project: { id: string; key: string; name: string } | null;
  _count: { comments: number };
};

type Project = { id: string; key: string; name: string };

const statusIcon = (s: string) => {
  if (s === "DONE") return <CheckCircle2 size={14} className="status-icon done" />;
  if (s === "IN_PROGRESS") return <Clock size={14} className="status-icon in-progress" />;
  return <Circle size={14} className="status-icon" />;
};

const priorityColor: Record<string, string> = {
  LOW: "#64748b", MEDIUM: "#0ea5e9", HIGH: "#f59e0b", CRITICAL: "#dc2626",
};

export default function CompanyWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskDue, setTaskDue] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskError, setTaskError] = useState("");
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerUserId, setNewWorkerUserId] = useState("");
  const [newWorkerRole, setNewWorkerRole] = useState<"SUPERVISOR" | "WORKER">("WORKER");
  const [workerError, setWorkerError] = useState("");
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<string | null>(null);

  const tPriority = (priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") => {
    const map = {
      LOW: t("common.priority.low"),
      MEDIUM: t("common.priority.medium"),
      HIGH: t("common.priority.high"),
      CRITICAL: t("common.priority.critical"),
    };

    return map[priority];
  };

  const companyQuery = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const res = await api.get<{ item: Company }>(`/companies/${id}`);
      return res.data.item;
    },
    enabled: !!id,
  });

  const tasksQuery = useQuery({
    queryKey: ["company-tasks", id],
    queryFn: async () => {
      const res = await api.get<{ items: Task[] }>(`/companies/${id}/tasks`);
      return res.data.items;
    },
    enabled: !!id,
  });

  const projectsQuery = useQuery({
    queryKey: ["task-projects"],
    queryFn: async () => {
      const res = await api.get<{ items: Project[] }>("/projects?page=1&limit=100");
      return res.data.items;
    },
  });

  const isSupervisorCheck = user?.role === "ADMIN" ||
    (companyQuery.data?.members.find((m) => m.user.id === user?.id)?.memberRole === "SUPERVISOR");

  const usersQuery = useQuery({
    queryKey: ["admin-company-users"],
    queryFn: async () => {
      const res = await api.get<{ items: Array<{ id: string; fullName: string; email: string }> }>("/users/directory");
      return res.data.items;
    },
    enabled: !!isSupervisorCheck,
  });

  const addWorkerMutation = useMutation({
    mutationFn: async () =>
      api.post(`/companies/${id}/members`, { userId: newWorkerUserId, memberRole: newWorkerRole }),
    onSuccess: () => {
      toast.success(t("toast.memberAdded"));
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-companies"] });
      setNewWorkerUserId(""); setWorkerError(""); setShowAddWorker(false);
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setWorkerError(msg);
      toast.error(msg);
    },
  });

  const removeWorkerMutation = useMutation({
    mutationFn: async (memberId: string) => api.delete(`/companies/${id}/members/${memberId}`),
    onSuccess: () => {
      toast.success(t("toast.memberRemoved"));
      setConfirmRemoveMemberId(null);
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-companies"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () =>
      api.post("/tasks", {
        projectId: taskProjectId,
        title: taskTitle,
        description: taskDesc || taskTitle,
        priority: taskPriority,
        status: "TODO",
        type: "TASK",
        assigneeId: selectedWorkerId || undefined,
        dueDate: taskDue || undefined,
      }),
    onSuccess: () => {
      toast.success(t("toast.taskCreated"));
      queryClient.invalidateQueries({ queryKey: ["company-tasks", id] });
      setTaskTitle(""); setTaskDesc(""); setTaskDue(""); setTaskError("");
      setShowCreateTask(false);
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setTaskError(msg);
      toast.error(msg);
    },
  });

  if (companyQuery.isLoading) return <div className="page-loader">{t("company.loading")}</div>;
  if (!companyQuery.data) return <div className="page-loader">{t("company.notFound")}</div>;

  const company = companyQuery.data;
  const tasks = tasksQuery.data || [];
  const projects = projectsQuery.data || [];

  const isSupervisor = isSupervisorCheck ?? false;
  const workers = company.members.filter((m) => m.memberRole === "WORKER");
  const supervisors = company.members.filter((m) => m.memberRole === "SUPERVISOR");
  const backTarget = user?.role === "ADMIN" ? "/workspace/admin/companies" : "/workspace/dashboard";
  const backLabel = user?.role === "ADMIN" ? t("admin.companies.title") : t("sidebar.dashboard");

  const visibleTasks = isSupervisor
    ? selectedWorkerId
      ? tasks.filter((t) => t.assignee?.id === selectedWorkerId)
      : tasks
    : tasks.filter((t) => t.assignee?.id === user?.id);

  return (
    <section className="page company-workspace-page">
      <div className="detail-page-topbar">
        <div className="detail-breadcrumbs">
          <Link to="/workspace/dashboard">{t("common.workspace")}</Link>
          <ChevronRight size={14} />
          <Link to={backTarget}>{backLabel}</Link>
          <ChevronRight size={14} />
          <span>{company.name}</span>
        </div>
        <Link className="ghost-button detail-back-button" to={backTarget}>
          <ArrowLeft size={14} />
          {t("common.back")}
        </Link>
      </div>

      <PageHeader
        eyebrow={isSupervisor ? t("company.eyebrow.supervisor") : t("company.eyebrow.mine")}
        title={company.name}
        description={company.description || t("company.memberCount", { count: String(company._count.members) })}
        actions={
          isSupervisor ? (
            <div className="header-pill-row">
              <VoiceTaskButton
                projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
                onCreated={() => queryClient.invalidateQueries({ queryKey: ["company-tasks", id] })}
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowCreateTask(true)}
              >
                <Plus size={15} /> {t("company.assignTask")}
              </button>
            </div>
          ) : null
        }
      />

      <div className="company-workspace-grid">
        {isSupervisor ? (
          <aside className="panel company-sidebar">
            <div className="panel-header">
              <h3>{t("company.team")}</h3>
              <button type="button" className="ghost-button" onClick={() => setShowAddWorker((v) => !v)} title={t("company.addMember")}>
                <UserPlus size={14} />
              </button>
            </div>

            {showAddWorker ? (
              <div className="company-add-member-form">
                <label>
                  {t("company.form.user")}
                  <select value={newWorkerUserId} onChange={(e) => setNewWorkerUserId(e.target.value)}>
                    <option value="">{t("company.form.selectUser")}</option>
                    {(usersQuery.data || [])
                      .filter((u) => !company.members.some((m) => m.user.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("company.form.role")}
                  <select value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value as "SUPERVISOR" | "WORKER")}>
                    <option value="WORKER">{t("company.role.worker")}</option>
                    <option value="SUPERVISOR">{t("company.role.supervisor")}</option>
                  </select>
                </label>
                {workerError ? <div className="form-error">{workerError}</div> : null}
                <div className="form-actions">
                  <button type="button" className="ghost-button" onClick={() => { setShowAddWorker(false); setWorkerError(""); }}>
                    <X size={13} /> {t("admin.common.cancel")}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!newWorkerUserId || addWorkerMutation.isPending}
                    onClick={() => addWorkerMutation.mutate()}
                  >
                    {addWorkerMutation.isPending ? t("admin.common.adding") : t("company.addMember")}
                  </button>
                </div>
              </div>
            ) : null}

            {supervisors.length > 0 ? (
              <div className="company-role-section">
                <span className="company-role-label">{t("company.role.supervisors")}</span>
                {supervisors.map((m) => (
                  <div key={m.id} className="company-member-pill supervisor">
                    <div className="avatar-circle small" style={{ background: m.user.avatarColor }}>{m.user.fullName[0]}</div>
                    <span>{m.user.fullName}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="company-role-section">
              <span className="company-role-label">{t("company.role.workers")}</span>
              <button
                type="button"
                className={`company-worker-btn ${!selectedWorkerId ? "active" : ""}`}
                onClick={() => setSelectedWorkerId(null)}
              >
                <Users size={14} />
                {t("company.allWorkers")}
                <span className="worker-task-count">{tasks.length}</span>
              </button>
              {workers.map((m) => {
                const count = tasks.filter((t) => t.assignee?.id === m.user.id).length;
                return (
                  <div key={m.id} className="company-worker-row">
                    <button
                      type="button"
                      className={`company-worker-btn ${selectedWorkerId === m.user.id ? "active" : ""}`}
                      onClick={() => setSelectedWorkerId(m.user.id)}
                    >
                      <div className="avatar-circle tiny" style={{ background: m.user.avatarColor }}>{m.user.fullName[0]}</div>
                      {m.user.fullName}
                      <span className="worker-task-count">{count}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title={t("company.removeMember")}
                      onClick={() => setConfirmRemoveMemberId(m.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        ) : null}

        <div className="company-main">
          {showCreateTask && isSupervisor ? (
            <div className="panel company-create-task-panel">
              <div className="panel-header">
                <h3>{t("company.assignTask")}</h3>
              </div>
              <div className="company-task-form">
                <label>
                  {t("company.form.title")}
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={t("company.form.taskTitlePlaceholder")} />
                </label>
                <label>
                  {t("company.form.description")}
                  <textarea rows={2} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder={t("company.form.optionalDetails")} />
                </label>
                <div className="dual-form-row">
                  <label>
                    {t("company.form.project")}
                    <select value={taskProjectId} onChange={(e) => setTaskProjectId(e.target.value)}>
                      <option value="">{t("company.form.selectProject")}</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
                    </select>
                  </label>
                  <label>
                    {t("company.form.assignTo")}
                    <select value={selectedWorkerId || ""} onChange={(e) => setSelectedWorkerId(e.target.value || null)}>
                      <option value="">{t("common.unassigned")}</option>
                      {workers.map((m) => <option key={m.id} value={m.user.id}>{m.user.fullName}</option>)}
                    </select>
                  </label>
                </div>
                <div className="dual-form-row">
                  <label>
                    {t("tasks.form.priority")}
                    <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                      <option value="LOW">{t("common.priority.low")}</option>
                      <option value="MEDIUM">{t("common.priority.medium")}</option>
                      <option value="HIGH">{t("common.priority.high")}</option>
                      <option value="CRITICAL">{t("common.priority.critical")}</option>
                    </select>
                  </label>
                  <label>
                    {t("tasks.form.dueDate")}
                    <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                  </label>
                </div>
                {taskError ? <div className="form-error">{taskError}</div> : null}
                <div className="form-actions">
                  <button type="button" className="ghost-button" onClick={() => { setShowCreateTask(false); setTaskError(""); }}>{t("admin.common.cancel")}</button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!taskTitle.trim() || !taskProjectId || createTaskMutation.isPending}
                    onClick={() => createTaskMutation.mutate()}
                  >
                    {createTaskMutation.isPending ? t("admin.common.creating") : t("company.createTask")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="panel">
              <div className="panel-header">
                <h3>
                  {isSupervisor
                    ? selectedWorkerId
                      ? t("company.workerTasks", { name: workers.find((w) => w.user.id === selectedWorkerId)?.user.fullName || "" })
                      : t("company.allWorkerTasks")
                    : t("company.myTasks")}
                </h3>
              <span className="eyebrow">{t("company.taskCount", { count: String(visibleTasks.length) })}</span>
            </div>

            {visibleTasks.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={24} />
                <div>
                  <strong>{isSupervisor ? t("company.empty.supervisorTitle") : t("company.empty.workerTitle")}</strong>
                  <p>{isSupervisor ? t("company.empty.supervisorDescription") : t("company.empty.workerDescription")}</p>
                </div>
              </div>
            ) : (
              <div className="company-task-list">
                {visibleTasks.map((task) => (
                  <div key={task.id} className="company-task-row">
                    <div className="company-task-status">{statusIcon(task.status)}</div>
                    <div className="company-task-body">
                      <strong>{task.title}</strong>
                      {task.project ? (
                        <span className="company-task-meta">
                          <FolderKanban size={12} /> {task.project.key}
                        </span>
                      ) : null}
                    </div>
                    <div className="company-task-right">
                      {task.dueDate ? (
                        <span className="company-task-due">
                          <CalendarClock size={12} /> {formatDate(task.dueDate)}
                        </span>
                      ) : null}
                      <span
                        className="company-task-priority"
                        style={{ color: priorityColor[task.priority] }}
                      >
                        {tPriority(task.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
                      </span>
                      {task.assignee && isSupervisor ? (
                        <div
                          className="avatar-circle tiny"
                          style={{ background: task.assignee.avatarColor }}
                          title={task.assignee.fullName}
                        >
                          {task.assignee.fullName[0]}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmRemoveMemberId ? (
        <div className="confirm-overlay" onClick={() => setConfirmRemoveMemberId(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("company.confirmRemove.title")}</h3>
            <p>{t("company.confirmRemove.desc")}</p>
            <div className="confirm-modal-actions">
              <button className="ghost-button" type="button" onClick={() => setConfirmRemoveMemberId(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={removeWorkerMutation.isPending}
                onClick={() => removeWorkerMutation.mutate(confirmRemoveMemberId)}
              >
                {t("common.remove")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
