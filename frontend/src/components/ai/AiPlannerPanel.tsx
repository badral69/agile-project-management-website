import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Bot, ChevronDown, ChevronUp, Loader2, Pencil, Sparkles, Trash2, X, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../features/i18n/I18nContext";
import { api, getErrorMessage } from "../../lib/api";

type GeneratedTask = {
  title: string;
  description: string;
  type: "EPIC" | "STORY" | "TASK" | "BUG";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "BACKLOG";
  storyPoints: number | null;
  daysFromNow: number | null;
};

type Props = {
  projectId: string;
  projectName: string;
};

const typeColor = { EPIC: "#ea580c", STORY: "#2563eb", TASK: "#0f766e", BUG: "#dc2626" };
const priorityColor = { LOW: "#64748b", MEDIUM: "#0ea5e9", HIGH: "#f59e0b", CRITICAL: "#dc2626" };

function TaskEditRow({ task, onSave, onCancel }: { task: GeneratedTask; onSave: (t: GeneratedTask) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<GeneratedTask>({ ...task });
  return (
    <div className="ai-task-edit-row">
      <label>
        Title
        <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
      </label>
      <label>
        Description
        <textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
      </label>
      <div className="dual-form-row">
        <label>
          Type
          <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as GeneratedTask["type"] }))}>
            <option value="EPIC">EPIC</option>
            <option value="STORY">STORY</option>
            <option value="TASK">TASK</option>
            <option value="BUG">BUG</option>
          </select>
        </label>
        <label>
          Priority
          <select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as GeneratedTask["priority"] }))}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </label>
      </div>
      <div className="dual-form-row">
        <label>
          Story points
          <input type="number" min={1} max={21} value={draft.storyPoints ?? ""} onChange={(e) => setDraft((d) => ({ ...d, storyPoints: e.target.value ? Number(e.target.value) : null }))} />
        </label>
        <label>
          Days until due
          <input type="number" min={1} value={draft.daysFromNow ?? ""} onChange={(e) => setDraft((d) => ({ ...d, daysFromNow: e.target.value ? Number(e.target.value) : null }))} />
        </label>
      </div>
      <div className="ai-task-edit-actions">
        <button type="button" className="ghost-button" onClick={onCancel}><X size={13} /> Cancel</button>
        <button type="button" className="primary-button" onClick={() => onSave(draft)}>Save</button>
      </div>
    </div>
  );
}

export function AiPlannerPanel({ projectId, projectName }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [durationDays, setDurationDays] = useState(14);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ tasks: GeneratedTask[] }>("/assistant/generate-plan", {
        projectId,
        projectName,
        description,
        teamSize,
        durationDays,
      });
      return res.data.tasks;
    },
    onSuccess: (data) => {
      setTasks(data);
      setEditingIndex(null);
      setError("");
      setCreated(false);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const saveTask = (index: number, updated: GeneratedTask) => {
    setTasks((prev) => prev.map((t, i) => (i === index ? updated : t)));
    setEditingIndex(null);
  };

  const createAll = async () => {
    setCreating(true);
    setError("");
    const today = new Date();
    try {
      for (const task of tasks) {
        const dueDate = task.daysFromNow ? format(addDays(today, task.daysFromNow), "yyyy-MM-dd") : undefined;
        await api.post("/tasks", {
          projectId,
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          status: task.status,
          storyPoints: task.storyPoints ?? undefined,
          dueDate,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setCreated(true);
      setTasks([]);
    } catch (err) {
      setError(getErrorMessage(err as Error));
    } finally {
      setCreating(false);
    }
  };

  if (!user?.aiEntitlements?.aiPlanner) {
    return (
      <div className="ai-planner-panel ai-planner-upgrade">
        <div className="ai-upgrade-content">
          <Zap size={18} className="ai-upgrade-icon" />
          <div>
            <strong>{t("ai.upgradeTitle")}</strong>
            <p>{t("ai.upgradeDesc")}</p>
          </div>
        </div>
        <Link to="/workspace/settings?view=billing" className="ghost-button ai-upgrade-btn">
          {t("common.upgradePro")}
        </Link>
      </div>
    );
  }

  return (
    <div className="ai-planner-panel">
      <button className="ai-planner-toggle" type="button" onClick={() => setOpen((v) => !v)}>
        <span className="ai-planner-toggle-left">
          <Bot size={16} />
          Generate tasks with AI
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open ? (
        <div className="ai-planner-body">
          {created ? (
            <div className="ai-planner-success">
              <Sparkles size={18} />
              Tasks created successfully! Check the board above.
              <button type="button" className="ghost-button" onClick={() => { setCreated(false); setDescription(""); }}>
                Generate another plan
              </button>
            </div>
          ) : tasks.length ? (
            <>
              <div className="ai-planner-preview-header">
                <strong>{tasks.length} tasks ready to create</strong>
                <button type="button" className="ghost-button" onClick={() => { setTasks([]); setEditingIndex(null); }}>
                  Start over
                </button>
              </div>
              <div className="ai-task-preview-list">
                {tasks.map((task, i) =>
                  editingIndex === i ? (
                    <TaskEditRow
                      key={i}
                      task={task}
                      onSave={(updated) => saveTask(i, updated)}
                      onCancel={() => setEditingIndex(null)}
                    />
                  ) : (
                    <div key={i} className="ai-task-preview-row">
                      <div className="ai-task-preview-info">
                        <span className="ai-task-type-badge" style={{ color: typeColor[task.type] }}>
                          {task.type}
                        </span>
                        <strong>{task.title}</strong>
                        <p>{task.description}</p>
                      </div>
                      <div className="ai-task-preview-meta">
                        <span style={{ color: priorityColor[task.priority], fontWeight: 600, fontSize: "0.78rem" }}>
                          {task.priority}
                        </span>
                        {task.storyPoints ? <span className="ai-sp-badge">{task.storyPoints}sp</span> : null}
                        {task.daysFromNow ? (
                          <span className="ai-due-label">
                            Due {format(addDays(new Date(), task.daysFromNow), "MMM d")}
                          </span>
                        ) : null}
                        <button type="button" className="ai-edit-btn" onClick={() => setEditingIndex(i)}>
                          <Pencil size={12} />
                        </button>
                        <button type="button" className="ai-remove-btn" onClick={() => removeTask(i)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
              {error ? <div className="form-error">{error}</div> : null}
              <button
                type="button"
                className="primary-button"
                onClick={createAll}
                disabled={creating || !tasks.length}
              >
                {creating ? <><Loader2 size={15} className="spin" /> Creating {tasks.length} tasks...</> : <><Sparkles size={15} /> Create {tasks.length} tasks</>}
              </button>
            </>
          ) : (
            <>
              <div className="ai-planner-form">
                <label>
                  Describe what this project needs to deliver
                  <textarea
                    rows={3}
                    placeholder="e.g. Build a user authentication system with email/password and Google OAuth, JWT tokens, and a profile page."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <div className="dual-form-row">
                  <label>
                    Team size
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={teamSize}
                      onChange={(e) => setTeamSize(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Sprint length (days)
                    <input
                      type="number"
                      min={3}
                      max={90}
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>
              {error ? <div className="form-error">{error}</div> : null}
              <button
                type="button"
                className="primary-button"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || description.trim().length < 10}
              >
                {generateMutation.isPending
                  ? <><Loader2 size={15} className="spin" /> Generating plan...</>
                  : <><Bot size={15} /> Generate sprint plan</>}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
