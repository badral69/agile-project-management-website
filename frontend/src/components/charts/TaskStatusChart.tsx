import { BarChart2 } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "../../features/i18n/I18nContext";
import type { DashboardData } from "../../types";

const colors: Record<string, string> = {
  BACKLOG: "#94a3b8",
  TODO: "#2563eb",
  IN_PROGRESS: "#f97316",
  REVIEW: "#facc15",
  DONE: "#16a34a",
};

export function TaskStatusChart({ data }: { data: DashboardData["statusBreakdown"] }) {
  const { t } = useI18n();
  const chartData = data.map((item) => ({
    name: item.status.replaceAll("_", " "),
    value: item._count.status,
    color: colors[item.status],
  }));

  if (chartData.length === 0 || chartData.every((d) => d.value === 0)) {
    return (
      <div className="panel chart-panel">
        <div className="panel-header">
          <h3>{t("dashboard.chart.title")}</h3>
          <span className="eyebrow">{t("dashboard.chart.eyebrow")}</span>
        </div>
        <div className="empty-state" style={{ minHeight: 200 }}>
          <BarChart2 size={28} style={{ opacity: 0.4 }} />
          <p style={{ opacity: 0.5 }}>{t("dashboard.deadlinesEmpty.title")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <h3>{t("dashboard.chart.title")}</h3>
        <span className="eyebrow">{t("dashboard.chart.eyebrow")}</span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={104} paddingAngle={3}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="legend-row">
        {chartData.map((entry) => (
          <span key={entry.name}>
            <i style={{ background: entry.color }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  );
}
