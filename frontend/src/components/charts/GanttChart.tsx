import { useMemo, useRef, useState } from "react";
import type { Sprint, Task, TaskStatus } from "../../types";

const DAY_W    = 38;
const ROW_H    = 36;
const NAME_W   = 220;
const SPRINT_H = 26;
const TASK_H   = 20;
const HDR_H    = 80;

const DAY_ABBR = ["SU","MO","TU","WE","TH","FR","SA"];
const MON_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Row =
  | { kind: "sprint";     id: string; label: string; status: string;     col: number; span: number }
  | { kind: "task";       id: string; label: string; status: TaskStatus;  col: number; span: number }
  | { kind: "group";      id: string; label: string;                      col: number; span: number };

function toMidnight(iso: string) {
  // Accept both "YYYY-MM-DD" and full ISO timestamps — take only the date part
  const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
  const d = new Date(datePart + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date)  { return Math.round((b.getTime() - a.getTime()) / 86_400_000); }

function isoWeek(d: Date) {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return Math.ceil((diffDays(jan4, d) + jan4.getDay() + 1) / 7);
}

const SPRINT_CLR: Record<string, string> = {
  ACTIVE: "#e07b39",
  PLANNING: "#64748b",
  COMPLETED: "#059669",
};
const TASK_CLR: Record<string, string> = {
  DONE: "#059669",
  IN_PROGRESS: "#2563eb",
  REVIEW: "#7c3aed",
  TODO: "#475569",
  BACKLOG: "#94a3b8",
};

export function GanttChart({
  sprints,
  tasks,
  onAssignToSprint,
  onClickTask,
}: {
  sprints: Sprint[];
  tasks: Task[];
  onAssignToSprint?: (taskId: string, sprintId: string) => void;
  onClickTask?: (taskId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragOverSprintId, setDragOverSprintId] = useState<string | null>(null);

  const { days, months, weeks, rows, todayCol } = useMemo(() => {
    const empty = {
      days: [] as Date[],
      months: [] as { label: string; col: number; span: number }[],
      weeks:  [] as { label: string; col: number; span: number }[],
      rows: [] as Row[],
      todayCol: 0,
    };

    // Gather all date anchors
    const sprintDates = sprints.flatMap(s => [toMidnight(s.startDate), toMidnight(s.endDate)]);
    const taskDueDates = tasks.filter(t => t.dueDate).map(t => toMidnight(t.dueDate!));
    const allDates = [...sprintDates, ...taskDueDates];
    if (allDates.length === 0) return empty;

    const minD = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...allDates.map(d => d.getTime())));

    const origin = addDays(minD, -5);
    const finish = addDays(maxD, 7);
    const n = diffDays(origin, finish) + 1;
    const days = Array.from({ length: n }, (_, i) => addDays(origin, i));

    // Month groups
    const months: { label: string; col: number; span: number }[] = [];
    days.forEach((d, i) => {
      const key = d.getMonth();
      const last = months[months.length - 1];
      if (!last || new Date(last.label).getMonth() !== key) {
        if (last) last.span = i - last.col;
        months.push({ label: `${MON_ABBR[d.getMonth()]} ${d.getFullYear()}`, col: i, span: 0 });
      }
    });
    if (months.length) months[months.length - 1].span = days.length - months[months.length - 1].col;

    // Week groups
    const weeks: { label: string; col: number; span: number }[] = [];
    days.forEach((d, i) => {
      const w = isoWeek(d);
      const last = weeks[weeks.length - 1];
      if (!last || last.label !== `W${w}`) {
        if (last) last.span = i - last.col;
        weeks.push({ label: `W${w}`, col: i, span: 0 });
      }
    });
    if (weeks.length) weeks[weeks.length - 1].span = days.length - weeks[weeks.length - 1].col;

    // Build rows: sprints + their tasks
    const assignedTaskIds = new Set(sprints.flatMap(s => s.tasks.map(st => st.taskId)));
    const rows: Row[] = [];

    for (const sprint of sprints) {
      const sS  = toMidnight(sprint.startDate);
      const sE  = toMidnight(sprint.endDate);
      const col  = diffDays(origin, sS);
      const span = diffDays(sS, sE) + 1;
      rows.push({ kind: "sprint", id: sprint.id, label: sprint.name, status: sprint.status, col, span });
      for (const st of sprint.tasks) {
        rows.push({ kind: "task", id: st.taskId, label: st.task.title, status: st.task.status, col, span });
      }
    }

    // Unassigned tasks
    const unassigned = tasks.filter(t => !assignedTaskIds.has(t.id));
    if (unassigned.length > 0) {
      // group header spans full timeline
      const groupSpan = days.length;
      rows.push({ kind: "group", id: "__unassigned__", label: "Unassigned tasks", col: 0, span: groupSpan });
      for (const task of unassigned) {
        let col: number;
        let span: number;
        if (task.dueDate) {
          const due = toMidnight(task.dueDate);
          col  = Math.max(0, diffDays(origin, due));
          span = 1;
        } else {
          // no date info — place across first 3 days of timeline
          col  = 0;
          span = groupSpan;
        }
        rows.push({
          kind: "task",
          id: task.id,
          label: task.title,
          status: task.status as TaskStatus,
          col,
          span,
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCol = diffDays(origin, today);

    return { days, months, weeks, rows, todayCol };
  }, [sprints, tasks]);

  const totalW = days.length * DAY_W;
  const totalH = rows.length * ROW_H;

  if (!sprints.length && !tasks.length) {
    return <div className="gantt-empty">Create a sprint or task to see the Gantt chart.</div>;
  }
  if (!days.length) {
    return <div className="gantt-empty">Add dates to sprints or tasks to see them on the Gantt chart.</div>;
  }

  return (
    <div className="gantt-root">
      {/* Fixed name column */}
      <div className="gantt-names" style={{ width: NAME_W }}>
        <div className="gantt-name-header" style={{ height: HDR_H }} />
        {rows.map((row, i) => {
          const isUnassignedTask = row.kind === "task" && rows.some((r, j) => j < i && r.kind === "group" && r.id === "__unassigned__");
          const isSprintRow = row.kind === "sprint";
          const isDragOver = isSprintRow && dragOverSprintId === row.id;
          return (
            <div
              key={row.id + i}
              className={`gantt-name-row gantt-name-${row.kind}${isDragOver ? " gantt-name-drop-target" : ""}`}
              style={{ height: ROW_H }}
              draggable={isUnassignedTask && !!onAssignToSprint}
              onDragStart={isUnassignedTask ? (e) => {
                e.dataTransfer.setData("gantt-task-id", row.id);
                e.dataTransfer.effectAllowed = "move";
              } : undefined}
              onDragOver={isSprintRow && onAssignToSprint ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverSprintId(row.id);
              } : undefined}
              onDragLeave={isSprintRow ? () => setDragOverSprintId(null) : undefined}
              onDrop={isSprintRow && onAssignToSprint ? (e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("gantt-task-id");
                if (taskId) onAssignToSprint(taskId, row.id);
                setDragOverSprintId(null);
              } : undefined}
            >
              <span className="gantt-name-label">{row.label}</span>
              {isUnassignedTask && onAssignToSprint && (
                <span className="gantt-drag-hint" title="Drag to a sprint to assign">⠿</span>
              )}
              {isDragOver && <span className="gantt-drop-label">Drop to assign</span>}
            </div>
          );
        })}
      </div>

      {/* Scrollable timeline */}
      <div className="gantt-scroll" ref={scrollRef}>
        <div style={{ width: totalW, position: "relative" }}>

          {/* Sticky header */}
          <div className="gantt-header" style={{ height: HDR_H }}>
            <div className="gantt-hdr-row" style={{ height: 26 }}>
              {months.map((m, i) => (
                <div key={i} className="gantt-hdr-cell gantt-month" style={{ left: m.col * DAY_W, width: m.span * DAY_W }}>
                  {m.label}
                </div>
              ))}
            </div>
            <div className="gantt-hdr-row" style={{ height: 26 }}>
              {weeks.map((w, i) => (
                <div key={i} className="gantt-hdr-cell gantt-week" style={{ left: w.col * DAY_W, width: w.span * DAY_W }}>
                  {w.label}
                </div>
              ))}
            </div>
            <div className="gantt-hdr-row" style={{ height: 28 }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={`gantt-hdr-cell gantt-day${d.getDay() === 0 || d.getDay() === 6 ? " gantt-weekend" : ""}${i === todayCol ? " gantt-today-hdr" : ""}`}
                  style={{ left: i * DAY_W, width: DAY_W }}
                >
                  <span className="gantt-d-num">{d.getDate()}</span>
                  <span className="gantt-d-lbl">{DAY_ABBR[d.getDay()]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grid body */}
          <div style={{ position: "relative", height: totalH }}>
            {days.map((d, i) => (
              <div
                key={i}
                className={`gantt-col${d.getDay() === 0 || d.getDay() === 6 ? " gantt-col-weekend" : ""}`}
                style={{ left: i * DAY_W, width: DAY_W, height: totalH }}
              />
            ))}

            {rows.map((_, i) => (
              <div key={i} className="gantt-row-div" style={{ top: i * ROW_H, width: totalW }} />
            ))}

            {todayCol >= 0 && todayCol < days.length && (
              <div className="gantt-today-line" style={{ left: todayCol * DAY_W + DAY_W / 2, height: totalH }} />
            )}

            {rows.map((row, i) => {
              if (row.kind === "group") {
                const barTop = i * ROW_H + (ROW_H - SPRINT_H) / 2;
                const isDropTarget = dragOverSprintId === row.id;
                return (
                  <div
                    key={row.id + i}
                    className={`gantt-bar gantt-bar-group${isDropTarget ? " gantt-bar-drop-target" : ""}`}
                    style={{ left: 2, top: barTop, width: totalW - 4, height: SPRINT_H, background: "transparent", border: "1px dashed #94a3b8" }}
                    title={row.label}
                  >
                    <span className="gantt-bar-txt" style={{ color: "#64748b" }}>{row.label}</span>
                  </div>
                );
              }

              const isSprint = row.kind === "sprint";
              const isTask   = row.kind === "task";
              const barH     = isSprint ? SPRINT_H : TASK_H;
              const barTop   = i * ROW_H + (ROW_H - barH) / 2;
              const barLeft  = row.col * DAY_W + 2;
              const barW     = Math.max(row.span * DAY_W - 4, 6);
              const color    = isSprint
                ? (SPRINT_CLR[row.status] ?? "#e07b39")
                : (TASK_CLR[row.status] ?? "#475569");
              const isDropTarget = isSprint && dragOverSprintId === row.id;

              return (
                <div
                  key={row.id + i}
                  className={`gantt-bar gantt-bar-${row.kind}${isDropTarget ? " gantt-bar-drop-target" : ""}${isTask && onClickTask ? " gantt-bar-clickable" : ""}`}
                  style={{ left: barLeft, top: barTop, width: barW, height: barH, background: color }}
                  title={row.label}
                  onClick={isTask && onClickTask ? () => onClickTask(row.id) : undefined}
                  onDragOver={isSprint && onAssignToSprint ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverSprintId(row.id);
                  } : undefined}
                  onDragLeave={isSprint ? () => setDragOverSprintId(null) : undefined}
                  onDrop={isSprint && onAssignToSprint ? (e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData("gantt-task-id");
                    if (taskId) onAssignToSprint(taskId, row.id);
                    setDragOverSprintId(null);
                  } : undefined}
                >
                  <span className="gantt-bar-txt">{row.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
