import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Send, ShieldCheck, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { DirectoryUser, PaginatedResponse, Role, Task } from "../types";

type MeetingRecord = {
  id: string;
  title: string;
  scheduledAt: string;
  recurring: boolean;
  participantIds: string[];
  creatorId: string;
};

const meetingsStorageKey = "sprintflow-meetings";
type TeamSection = "members" | "meetings" | "shared";

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingParticipants, setMeetingParticipants] = useState<string[]>([]);
  const [meetingError, setMeetingError] = useState("");
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<TeamSection>("members");

  useEffect(() => {
    const storedValue = window.localStorage.getItem(meetingsStorageKey);
    if (storedValue) {
      setMeetings(JSON.parse(storedValue) as MeetingRecord[]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(meetingsStorageKey, JSON.stringify(meetings));
  }, [meetings]);

  const membersQuery = useQuery({
    queryKey: ["team-directory", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const response = await api.get<{ items: DirectoryUser[] }>(`/users/directory?${params.toString()}`);
      return response.data.items;
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["team-tasks"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Task>>("/tasks?page=1&limit=120");
      return response.data.items;
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: async () => {
      toast.success(t("toast.roleUpdated"));
      await queryClient.invalidateQueries({ queryKey: ["team-directory"] });
      await queryClient.invalidateQueries({ queryKey: ["directory-users"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setMeetingError(msg);
      toast.error(msg);
    },
  });

  const members = membersQuery.data || [];
  const tasks = tasksQuery.data || [];

  useEffect(() => {
    if (!members.length) {
      setSelectedMemberId(null);
      return;
    }

    setSelectedMemberId((current) => {
      if (current && members.some((member) => member.id === current)) return current;
      return null;
    });
  }, [members]);

  const visibleMeetings = useMemo(() => {
    if (!user?.id) return [];
    return [...meetings]
      .filter((m) => m.creatorId === user.id || m.participantIds.includes(user.id))
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
      .slice(0, 5);
  }, [meetings, user?.id]);

  const teamTasks = useMemo(() => {
    return tasks
      .filter((task) => task.assigneeId === user?.id || task.reporterId === user?.id)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .slice(0, 6);
  }, [tasks, user?.id]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const selectedMemberTasks = useMemo(() => {
    if (!selectedMember) return [];
    return tasks
      .filter((task) => task.assigneeId === selectedMember.id || task.reporterId === selectedMember.id)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .slice(0, 4);
  }, [tasks, selectedMember]);

  const createMeeting = () => {
    if (!meetingTitle.trim() || !meetingDate || !user?.id) {
      setMeetingError(t("team.meetings.errorEmpty"));
      return;
    }
    const next: MeetingRecord = {
      id: crypto.randomUUID(),
      title: meetingTitle.trim(),
      scheduledAt: meetingDate,
      recurring: false,
      participantIds: meetingParticipants,
      creatorId: user.id,
    };
    setMeetings((curr) => [next, ...curr]);
    setMeetingTitle("");
    setMeetingDate("");
    setMeetingParticipants([]);
    setMeetingError("");
  };

  const getParticipantNames = (ids: string[]) =>
    ids.map((id) => members.find((m) => m.id === id)?.fullName || id).join(", ");

  return (
    <section className="page team-page">
      <PageHeader eyebrow={t("team.eyebrow")} title={t("team.title")} description={t("team.description")} />

      <div className="team-section-tabs" role="tablist" aria-label="Team sections">
        {([
          ["members", t("team.sections.members")],
          ["meetings", t("team.sections.meetings")],
          ["shared", t("team.sections.shared")],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={activeSection === key ? "team-section-tab active" : "team-section-tab"}
            aria-selected={activeSection === key}
            onClick={() => setActiveSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="team-layout-grid team-layout-grid-single">
        {activeSection === "members" ? (
          <div className="panel workspace-flat-card">
          <div className="panel-header">
            <h3>{t("team.members.title")}</h3>
            <span className="eyebrow">{t("team.members.eyebrow")}</span>
          </div>

          <div className="toolbar team-members-toolbar">
            <label className="search-field">
              <Users size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("team.members.searchPlaceholder")} />
            </label>
          </div>

          {members.length ? (
            <div className="team-members-shell">
              <div className="team-member-list-shell">
                <div className="team-member-list-head">
                  <span>{t("team.members.table.member")}</span>
                  <span>{t("team.members.table.role")}</span>
                </div>

                <div className="team-member-list team-member-list-compact">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`team-member-row ${selectedMemberId === member.id ? "active" : ""}`}
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    <div className="team-member-main">
                      <UserAvatar fullName={member.fullName} avatarColor={member.avatarColor} avatarUrl={member.avatarUrl} />
                      <div className="team-member-row-copy">
                        <strong>{member.fullName}</strong>
                      </div>
                    </div>
                    <span className="team-member-col">
                      <span className={`badge team-role-badge team-role-${member.role.toLowerCase()}`}>{member.role}</span>
                    </span>
                  </button>
                ))}
              </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">{t("team.members.empty")}</div>
          )}
          </div>
        ) : null}

        {activeSection === "meetings" ? (
          <div className="panel workspace-flat-card team-section-panel">
            <div className="panel-header">
              <h3>{t("team.meetings.title")}</h3>
              <span className="eyebrow">{visibleMeetings.length} scheduled</span>
            </div>
            <div className="team-inline-form">
              <label>
                {t("team.meetings.titleLabel")}
                <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder={t("team.meetings.titlePlaceholder")} />
              </label>
              <label>
                {t("team.meetings.dateLabel")}
                <input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
              </label>
              <label>
                {t("team.meetings.inviteLabel")}
                <select value="" onChange={(e) => {
                  const val = e.target.value;
                  if (val && !meetingParticipants.includes(val)) {
                    setMeetingParticipants((curr) => [...curr, val]);
                  }
                }}>
                  <option value="">{t("team.meetings.chooseAttendees")}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
              </label>

              <div className="selected-chip-row">
                {meetingParticipants.map((id) => {
                  const p = members.find((m) => m.id === id);
                  return p ? (
                    <button key={id} type="button" className="selected-chip"
                      onClick={() => setMeetingParticipants((curr) => curr.filter((c) => c !== id))}>
                      {p.fullName}
                    </button>
                  ) : null;
                })}
              </div>

              {meetingError ? <div className="form-error">{meetingError}</div> : null}

              <button className="primary-button" type="button" onClick={createMeeting}>
                <Plus size={16} /> {t("team.meetings.createButton")}
              </button>
            </div>

            <div className="stack-list team-section-list">
              {visibleMeetings.length ? (
                visibleMeetings.map((meeting) => (
                  <article
                    key={meeting.id}
                    className="list-card team-meeting-card team-clickable-card"
                    onClick={() => setSelectedMeeting(meeting)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedMeeting(meeting)}
                  >
                    <div>
                      <strong>{meeting.title}</strong>
                      <p>{formatDate(meeting.scheduledAt)}</p>
                    </div>
                    <div className="list-metadata">
                      <span>
                        <CalendarDays size={13} />
                        {t("team.meetings.invited", { count: String(meeting.participantIds.length) })}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state compact-empty-state">{t("team.meetings.empty")}</div>
              )}
            </div>
          </div>
        ) : null}

        {activeSection === "shared" ? (
          <div className="panel workspace-flat-card team-section-panel">
            <div className="panel-header">
              <h3>{t("team.sharedWork.title")}</h3>
              <span className="eyebrow">{teamTasks.length} items</span>
            </div>
            <div className="stack-list team-section-list">
              {teamTasks.length ? (
                teamTasks.map((task) => (
                  <article
                    key={task.id}
                    className="list-card team-work-card team-clickable-card"
                    onClick={() => setSelectedTask(task)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedTask(task)}
                  >
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.project?.key ? `${task.project.key} · ${task.project.name}` : t("common.noProject")}</p>
                    </div>
                    <div className="list-metadata">
                      <span className={`status-pill status-${task.status.toLowerCase()}`}>
                        <i className="status-dot" />
                        {task.status.replaceAll("_", " ")}
                      </span>
                      <span>
                        <Send size={13} />
                        {task.assignee?.fullName || t("team.sharedWork.unassigned")}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state compact-empty-state">{t("team.sharedWork.empty")}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Meeting detail modal ── */}
      {selectedMeeting ? (
        <div className="confirm-overlay" onClick={() => setSelectedMeeting(null)}>
          <div className="confirm-modal team-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="team-detail-modal-header">
              <h3>{selectedMeeting.title}</h3>
              <button className="ghost-button icon-button" type="button" onClick={() => setSelectedMeeting(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="team-detail-rows">
              <div className="team-detail-row">
                <span className="eyebrow">{t("common.date")}</span>
                <strong>{formatDate(selectedMeeting.scheduledAt)}</strong>
              </div>
              <div className="team-detail-row">
                <span className="eyebrow">{t("common.participants")}</span>
                <strong>
                  {selectedMeeting.participantIds.length
                    ? getParticipantNames(selectedMeeting.participantIds)
                    : t("common.noParticipants")}
                </strong>
              </div>
            </div>
            <div className="confirm-modal-actions">
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  setMeetings((curr) => curr.filter((m) => m.id !== selectedMeeting.id));
                  setSelectedMeeting(null);
                }}
              >
                {t("team.deleteMeeting")}
              </button>
              <button className="ghost-button" type="button" onClick={() => setSelectedMeeting(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Member detail modal ── */}
      {selectedMember ? (
        <div className="confirm-overlay" onClick={() => setSelectedMemberId(null)}>
          <div className="confirm-modal team-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="team-detail-modal-header">
              <div className="identity-row">
                <UserAvatar fullName={selectedMember.fullName} avatarColor={selectedMember.avatarColor} avatarUrl={selectedMember.avatarUrl} />
                <div>
                  <h3>{selectedMember.fullName}</h3>
                  <p>{selectedMember.email}</p>
                </div>
              </div>
              <button className="ghost-button icon-button" type="button" onClick={() => setSelectedMemberId(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="team-member-meta team-member-detail-badges">
              <span className={`badge team-role-badge team-role-${selectedMember.role.toLowerCase()}`}>{selectedMember.role}</span>
              {selectedMember.role === "ADMIN" ? (
                <span className="project-admin-pill">
                  <ShieldCheck size={14} /> Admin
                </span>
              ) : null}
            </div>

            <div className="team-member-stats">
              <div className="team-member-stat">
                <span className="eyebrow">{t("team.member.projects", { count: String(selectedMember._count?.memberships || 0) })}</span>
                <strong>{selectedMember._count?.memberships || 0}</strong>
              </div>
              <div className="team-member-stat">
                <span className="eyebrow">{t("team.member.tasks", { count: String(selectedMember._count?.assignedTasks || 0) })}</span>
                <strong>{selectedMember._count?.assignedTasks || 0}</strong>
              </div>
              <div className="team-member-stat">
                <span className="eyebrow">{t("team.member.companies")}</span>
                <strong>{selectedMember._count?.companyMemberships || 0}</strong>
              </div>
            </div>

            <div className="team-member-detail-list">
              <div className="team-member-detail-row">
                <span className="eyebrow">{t("team.member.email")}</span>
                <strong>{selectedMember.email}</strong>
              </div>
              <div className="team-member-detail-row">
                <span className="eyebrow">{t("team.member.accountRole")}</span>
                <strong>{selectedMember.role}</strong>
              </div>
            </div>

            <div className="team-member-recent">
              <div className="panel-header compact">
                <h4>{t("team.member.recentWork")}</h4>
                <span className="eyebrow">{selectedMemberTasks.length}</span>
              </div>
              {selectedMemberTasks.length ? (
                <div className="team-member-recent-list">
                  {selectedMemberTasks.map((task) => (
                    <article key={task.id} className="team-member-recent-item">
                      <div>
                        <strong>{task.title}</strong>
                        <p>{task.project?.key ? `${task.project.key} · ${task.project.name}` : t("common.noProject")}</p>
                      </div>
                      <div className="list-metadata">
                        <span className={`status-pill status-${task.status.toLowerCase()}`}>
                          <i className="status-dot" />
                          {task.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty-state">{t("team.member.noRecentWork")}</div>
              )}
            </div>

            {user?.role === "ADMIN" ? (
              <label className="team-role-editor">
                <span className="eyebrow">{t("team.role.label")}</span>
                <select value={selectedMember.role} onChange={(e) => promoteMutation.mutate({ id: selectedMember.id, role: e.target.value as Role })}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MODERATOR">MODERATOR</option>
                  <option value="USER">USER</option>
                </select>
              </label>
            ) : null}

            <div className="confirm-modal-actions">
              <button className="ghost-button" type="button" onClick={() => setSelectedMemberId(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Task detail modal ── */}
      {selectedTask ? (
        <div className="confirm-overlay" onClick={() => setSelectedTask(null)}>
          <div className="confirm-modal team-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="team-detail-modal-header">
              <h3>{selectedTask.title}</h3>
              <button className="ghost-button icon-button" type="button" onClick={() => setSelectedTask(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="team-detail-rows">
              <div className="team-detail-row">
                <span className="eyebrow">{t("common.project")}</span>
                <strong>{selectedTask.project?.key ? `${selectedTask.project.key} · ${selectedTask.project.name}` : "—"}</strong>
              </div>
              <div className="team-detail-row">
                <span className="eyebrow">{t("common.status")}</span>
                <span className={`status-pill status-${selectedTask.status.toLowerCase()}`}>
                  <i className="status-dot" /> {selectedTask.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="team-detail-row">
                <span className="eyebrow">{t("common.priority")}</span>
                <strong>{selectedTask.priority}</strong>
              </div>
              <div className="team-detail-row">
                <span className="eyebrow">{t("common.assignee")}</span>
                <strong>{selectedTask.assignee?.fullName || t("common.unassigned")}</strong>
              </div>
              {selectedTask.dueDate ? (
                <div className="team-detail-row">
                  <span className="eyebrow">{t("common.due")}</span>
                  <strong>{formatDate(selectedTask.dueDate)}</strong>
                </div>
              ) : null}
              {selectedTask.description ? (
                <div className="team-detail-row team-detail-row-full">
                  <span className="eyebrow">{t("common.description")}</span>
                  <p>{selectedTask.description}</p>
                </div>
              ) : null}
            </div>
            <div className="confirm-modal-actions">
              <button className="ghost-button" type="button" onClick={() => setSelectedTask(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
