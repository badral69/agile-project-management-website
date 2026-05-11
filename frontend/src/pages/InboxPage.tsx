import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarClock, FolderKanban, RefreshCw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HexSpinner } from "../components/ui/HexSpinner";
import { PageHeader } from "../components/ui/PageHeader";
import { useI18n } from "../features/i18n/I18nContext";
import { UserAvatar } from "../components/ui/UserAvatar";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { ActivityLog } from "../types";

type ActivityItem = ActivityLog & {
  actor?: { id: string; fullName: string; role: string; avatarColor: string; avatarUrl?: string | null } | null;
  project?: { id: string; key: string; name: string } | null;
  task?: { id: string; title: string } | null;
};

const ACTION_LABEL_KEYS: Record<string, "inbox.action.taskCreated" | "inbox.action.taskUpdated" | "inbox.action.projectCreated" | "inbox.action.projectUpdated" | "inbox.action.sprintCreated" | "inbox.action.memberAdded" | "inbox.action.memberRemoved"> = {
  TASK_CREATED: "inbox.action.taskCreated",
  TASK_UPDATED: "inbox.action.taskUpdated",
  PROJECT_CREATED: "inbox.action.projectCreated",
  PROJECT_UPDATED: "inbox.action.projectUpdated",
  SPRINT_CREATED: "inbox.action.sprintCreated",
  MEMBER_ADDED: "inbox.action.memberAdded",
  MEMBER_REMOVED: "inbox.action.memberRemoved",
};

const ACTION_COLORS: Record<string, string> = {
  TASK_CREATED: "#6366f1",
  TASK_UPDATED: "#0ea5e9",
  PROJECT_CREATED: "#2563eb",
  PROJECT_UPDATED: "#7c3aed",
  SPRINT_CREATED: "#059669",
  MEMBER_ADDED: "#10b981",
  MEMBER_REMOVED: "#dc2626",
};

function ActionIcon({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? "#64748b";
  if (action.startsWith("SPRINT")) return <Zap size={14} style={{ color }} />;
  if (action.startsWith("PROJECT")) return <FolderKanban size={14} style={{ color }} />;
  return <Activity size={14} style={{ color }} />;
}

const LAST_READ_KEY = "sprintflow-activity-last-read";
const PAGE_SIZE = 30;

export default function InboxPage() {
  const { t } = useI18n();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lastRead, setLastRead] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem(LAST_READ_KEY);
      return stored ? new Date(stored) : null;
    } catch { return null; }
  });
  const markedOnMount = useRef(false);

  const markAllRead = () => {
    const now = new Date();
    try { localStorage.setItem(LAST_READ_KEY, now.toISOString()); } catch { /* */ }
    setLastRead(now);
  };

  useEffect(() => {
    if (!markedOnMount.current) {
      markedOnMount.current = true;
      try { localStorage.setItem(LAST_READ_KEY, new Date().toISOString()); } catch { /* */ }
    }
  }, []);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: async () => {
      const res = await api.get<{ items: ActivityItem[] }>("/activity?limit=200");
      return res.data.items;
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const activities = data ?? [];
  const visible = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;
  const unreadCount = lastRead
    ? activities.filter((a) => new Date(a.createdAt) > lastRead).length
    : activities.length;
  const isUnread = (item: ActivityItem) =>
    lastRead ? new Date(item.createdAt) > lastRead : false;

  return (
    <section className="page inbox-page">
      <PageHeader
        eyebrow={t("inbox.eyebrow")}
        title={t("inbox.title")}
        description={t("inbox.description")}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unreadCount > 0 ? (
              <button type="button" className="ghost-button" onClick={markAllRead}>
                {t("inbox.markAllRead")} ({unreadCount})
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-button"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw size={14} className={isRefetching ? "spin" : ""} />
              {t("inbox.refresh")}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="page-hex-loader">
          <HexSpinner size={48} label={t("inbox.loading")} />
        </div>
      ) : error ? (
        <div className="empty-state">
          <Activity size={32} />
          <p>{getErrorMessage(error)}</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <Activity size={32} />
          <p>{t("inbox.empty")}</p>
        </div>
      ) : (
        <div className="inbox-feed">
          {visible.map((item) => (
            <article key={item.id} className={`inbox-item${isUnread(item) ? " inbox-item-unread" : ""}`}>
              <div className="inbox-item-avatar">
                {item.actor ? (
                  <UserAvatar
                    fullName={item.actor.fullName}
                    avatarColor={item.actor.avatarColor}
                    avatarUrl={item.actor.avatarUrl}
                  />
                ) : (
                  <div className="inbox-system-icon">
                    <Activity size={14} />
                  </div>
                )}
              </div>

              <div className="inbox-item-body">
                <div className="inbox-item-headline">
                  <ActionIcon action={item.action} />
                  <span className="inbox-item-actor">
                    {item.actor?.fullName ?? t("inbox.system")}
                  </span>
                  <span className="inbox-item-verb">
                    {ACTION_LABEL_KEYS[item.action]
                      ? t(ACTION_LABEL_KEYS[item.action])
                      : item.action.replaceAll("_", " ").toLowerCase()}
                  </span>
                  {item.task && (
                    <span className="inbox-item-entity">"{item.task.title}"</span>
                  )}
                </div>

                <div className="inbox-item-meta">
                  {item.project && (
                    <Link
                      to={`/workspace/projects/${item.project.id}`}
                      className="inbox-project-link"
                    >
                      <FolderKanban size={12} />
                      {item.project.key} · {item.project.name}
                    </Link>
                  )}
                  <span className="inbox-item-time">
                    <CalendarClock size={12} />
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            </article>
          ))}
          {hasMore ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                {t("inbox.loadMore")}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
