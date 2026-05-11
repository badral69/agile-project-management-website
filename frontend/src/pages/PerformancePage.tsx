import { useQuery } from "@tanstack/react-query";
import { Clock3, Gauge, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useI18n } from "../features/i18n/I18nContext";
import { api, getErrorMessage } from "../lib/api";
import type { PerformanceOverview } from "../types";

const formatHours = (value: number) => `${value.toFixed(1)}h`;
const speedBadgeClass = {
  High: "badge-done",
  Steady: "badge-review",
  "Needs support": "badge-backlog",
} as const;

export default function PerformancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const selectedProjectId = searchParams.get("projectId") || "";

  const performanceQuery = useQuery({
    queryKey: ["performance-overview", selectedProjectId],
    queryFn: async () => {
      const query = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
      const response = await api.get<PerformanceOverview>(`/performance/overview${query}`);
      return response.data;
    },
  });

  const stats = useMemo(() => {
    if (!performanceQuery.data) {
      return [];
    }

    return [
      { label: t("perf.stats.people"), value: performanceQuery.data.summary.memberCount },
      { label: t("perf.stats.onTime"), value: `${performanceQuery.data.summary.onTimeCompletionRate}%` },
      { label: t("perf.stats.avgCycle"), value: formatHours(performanceQuery.data.summary.averageTaskCycleHours) },
      { label: t("perf.stats.overdueOpen"), value: performanceQuery.data.summary.overdueOpenTasks },
    ];
  }, [performanceQuery.data, t]);

  useEffect(() => {
    const data = performanceQuery.data;
    if (!data) return;
    if (!selectedProjectId && data.selectedProjectId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("projectId", data.selectedProjectId);
      setSearchParams(nextParams, { replace: true });
    }
  }, [performanceQuery.data, searchParams, selectedProjectId, setSearchParams]);

  if (performanceQuery.isLoading) {
    return <div className="page-loader">{t("perf.loading")}</div>;
  }

  if (performanceQuery.error) {
    return <div className="page-loader">{getErrorMessage(performanceQuery.error)}</div>;
  }

  if (!performanceQuery.data) {
    return <div className="page-loader">{t("perf.unavailable")}</div>;
  }

  const data = performanceQuery.data;

  return (
    <section className="page performance-page">
      <PageHeader
        eyebrow={data.visibility === "ADMIN" ? t("perf.eyebrow.admin") : t("perf.eyebrow.leader")}
        title={t("perf.title")}
        actions={
          <div className="page-actions performance-actions">
            {data.projects.length > 1 ? (
              <select
                value={data.selectedProjectId}
                onChange={(event) => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set("projectId", event.target.value);
                  setSearchParams(nextParams);
                }}
              >
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.key} · {project.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        }
      />

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>{t("perf.workerEval.title")}</h3>
          <span className="eyebrow">{t("perf.workerEval.projectScope", { count: String(data.summary.projectCount) })}</span>
        </div>

        <div className="performance-worker-grid">
          {data.workers.map((worker) => (
            <article key={worker.id} className="performance-worker-card" data-speed={worker.completionSpeed}>
              <div className="performance-worker-topline">
                <div className="identity-row">
                  <UserAvatar fullName={worker.fullName} avatarColor={worker.avatarColor} avatarUrl={worker.avatarUrl} />
                  <div>
                    <strong>{worker.fullName}</strong>
                    <p>{worker.email}</p>
                  </div>
                </div>
                <div className="header-pill-row">
                  <span className={`badge ${speedBadgeClass[worker.completionSpeed]}`}>{worker.completionSpeed}</span>
                  <span className="badge">{worker.role}</span>
                </div>
              </div>

              <div className="mini-stats-grid">
                <div className="mini-stat-card">
                  <Gauge size={16} />
                  <strong>{worker.onTimeCompletionRate}%</strong>
                  <span>{t("perf.worker.onTime")}</span>
                </div>
                <div className="mini-stat-card">
                  <Clock3 size={16} />
                  <strong>{formatHours(worker.averageTaskCycleHours)}</strong>
                  <span>{t("perf.worker.avgCycle")}</span>
                </div>
                <div className="mini-stat-card">
                  <TriangleAlert size={16} />
                  <strong>{worker.overdueOpenTaskCount}</strong>
                  <span>{t("perf.worker.overdue")}</span>
                </div>
                <div className="mini-stat-card">
                  <ShieldCheck size={16} />
                  <strong>{worker.completedTaskCount}</strong>
                  <span>{t("perf.worker.completed")}</span>
                </div>
              </div>

              {worker.managedProjectLabels.length ? (
                <div className="performance-worker-tags">
                  {worker.managedProjectLabels.slice(0, 4).map((label) => (
                    <span key={label} className="badge">
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {!data.workers.length ? <div className="empty-state compact">{t("perf.worker.empty")}</div> : null}
      </div>
    </section>
  );
}
