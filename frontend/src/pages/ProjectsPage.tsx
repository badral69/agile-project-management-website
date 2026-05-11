import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { PageHeader } from "../components/ui/PageHeader";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { PaginatedResponse, Project } from "../types";

const projectSchema = z.object({
  key: z.string().min(2).max(10),
  name: z.string().min(3).max(120),
  description: z.string().min(10).max(600),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  companyId: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

const statusBandClass: Record<Project["status"], string> = {
  PLANNING: "project-band-planning",
  ACTIVE: "project-band-active",
  ON_HOLD: "project-band-on_hold",
  COMPLETED: "project-band-completed",
};

const statusProgress: Record<Project["status"], number> = {
  PLANNING: 20,
  ACTIVE: 68,
  ON_HOLD: 46,
  COMPLETED: 100,
};

const getProjectProgress = (project: Project) => {
  if (project.status === "COMPLETED") {
    return 100;
  }

  if (project.startDate && project.endDate) {
    const start = +new Date(project.startDate);
    const end = +new Date(project.endDate);

    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const elapsed = ((Date.now() - start) / (end - start)) * 100;
      return Math.max(10, Math.min(Math.round(elapsed), 96));
    }
  }

  return statusProgress[project.status];
};

const formatRole = (role: string) =>
  role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const status = searchParams.get("status") || "";
  const deadlineFilter = searchParams.get("deadline") || "all";
  const activeView = searchParams.get("view") || "list";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmDeleteId(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const tProjectStatus = (s: string) => {
    const map: Record<string, string> = {
      PLANNING: t("common.project.status.planning"),
      ACTIVE: t("common.project.status.active"),
      ON_HOLD: t("common.project.status.onHold"),
      COMPLETED: t("common.project.status.completed"),
    };
    return map[s] ?? s;
  };

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "6" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return params.toString();
  }, [page, search, status]);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", queryString],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Project>>(`/projects?${queryString}`);
      return response.data;
    },
  });

  const companiesQuery = useQuery({
    queryKey: ["companies-project-form"],
    queryFn: async () => {
      const response = await api.get<{ items: Array<{ id: string; name: string; slug: string }> }>("/companies");
      return response.data.items;
    },
  });

  const filteredProjects = useMemo(() => {
    if (!data?.items) {
      return [];
    }

    const now = new Date();

    return data.items.filter((project) => {
      if (deadlineFilter === "all") {
        return true;
      }

      if (deadlineFilter === "without-deadline") {
        return !project.endDate;
      }

      if (!project.endDate) {
        return false;
      }

      const endDate = new Date(project.endDate);

      if (deadlineFilter === "overdue") {
        return endDate < now;
      }

      if (deadlineFilter === "this-month") {
        return endDate.getMonth() === now.getMonth() && endDate.getFullYear() === now.getFullYear();
      }

      return false;
    });
  }, [data?.items, deadlineFilter]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      status: "PLANNING",
    },
  });

  const createProject = useMutation({
    mutationFn: async (payload: ProjectForm) => api.post("/projects", payload),
    onSuccess: async () => {
      reset();
      setError("");
      toast.success(t("toast.projectCreated"));
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const updateProject = useMutation({
    mutationFn: async (project: Project) =>
      api.put(`/projects/${project.id}`, {
        key: project.key,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate || undefined,
        endDate: project.endDate || undefined,
      }),
    onSuccess: async () => {
      setError("");
      toast.success(t("toast.projectUpdated"));
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["project"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => api.delete(`/projects/${projectId}`),
    onSuccess: async () => {
      setError("");
      toast.success(t("toast.projectDeleted"));
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <section className="page projects-page">
      <PageHeader
        eyebrow={t("projects.eyebrow")}
        title={activeView === "create" ? t("projects.title.create") : t("projects.title.portfolio")}
        description={activeView === "create" ? t("projects.desc.create") : t("projects.desc.portfolio")}
        actions={
          activeView !== "create" ? (
            <Link className="primary-button" to="/workspace/projects?view=create">
              <Plus size={16} />
              {t("projects.createButton")}
            </Link>
          ) : null
        }
      />

      <div className={activeView === "create" ? "project-create-layout" : "project-portfolio-layout"}>
        {activeView !== "create" ? (
          <div className="panel project-portfolio-panel">
            <div className="toolbar">
              <label className="search-field">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder={t("projects.search.placeholder")}
                />
              </label>
              <select
                value={status}
                onChange={(event) => {
                  setPage(1);
                  const nextParams = new URLSearchParams(searchParams);
                  if (event.target.value) {
                    nextParams.set("status", event.target.value);
                  } else {
                    nextParams.delete("status");
                  }
                  setSearchParams(nextParams, { replace: true });
                }}
              >
                <option value="">{t("common.allStatuses")}</option>
                <option value="PLANNING">{t("common.project.status.planning")}</option>
                <option value="ACTIVE">{t("common.project.status.active")}</option>
                <option value="ON_HOLD">{t("common.project.status.onHold")}</option>
                <option value="COMPLETED">{t("common.project.status.completed")}</option>
              </select>
              <select
                value={deadlineFilter}
                onChange={(event) => {
                  const nextParams = new URLSearchParams(searchParams);
                  if (event.target.value === "all") {
                    nextParams.delete("deadline");
                  } else {
                    nextParams.set("deadline", event.target.value);
                  }
                  setSearchParams(nextParams, { replace: true });
                }}
              >
                <option value="all">{t("projects.filter.allDeadlines")}</option>
                <option value="this-month">{t("projects.filter.endingThisMonth")}</option>
                <option value="overdue">{t("projects.filter.deadlineOverdue")}</option>
                <option value="without-deadline">{t("projects.filter.withoutDeadline")}</option>
              </select>
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            {isLoading || !data ? (
              <div className="page-loader">{t("projects.loading")}</div>
            ) : (
              <>
                <div className="project-grid project-grid-enhanced">
                  {filteredProjects.map((project) => {
                    const progress = getProjectProgress(project);
                    const memberCount = project._count?.members ?? 0;

                    return (
                      <article key={project.id} className="project-card project-card-enhanced">
                        <div className={`project-status-band ${statusBandClass[project.status]}`} />
                        <div className="project-card-header">
                          <span className="project-key">{project.key}</span>
                          <span className={`badge badge-${project.status.toLowerCase()}`}>{tProjectStatus(project.status)}</span>
                        </div>

                        <div className="project-card-body">
                          <div>
                            <h3>{project.name}</h3>
                            <p>{project.description}</p>
                          </div>

                          <div className="project-progress-block">
                            <div className="project-progress-topline">
                              <strong>{progress}%</strong>
                              <span>{t("projects.deliveryProgress")}</span>
                            </div>
                            <div className="project-progress-track">
                              <span className={`project-progress-fill ${statusBandClass[project.status]}`} style={{ width: `${progress}%` }} />
                            </div>
                          </div>

                          <div className="project-card-meta-grid">
                            <span>{project._count?.tasks ?? 0} {t("projects.tasks")}</span>
                            <span>{t("projects.start")} {formatDate(project.startDate)}</span>
                            <span>{t("projects.end")} {formatDate(project.endDate)}</span>
                            <span>{project.company?.name || t("common.noCompany")}</span>
                          </div>

                          <div className="project-card-bottom">
                            <div className="project-member-stack">
                              {project.owner ? <UserAvatar fullName={project.owner.fullName} className="project-member-avatar" /> : null}
                              {memberCount > 1 ? <span className="project-member-more">+{memberCount - 1}</span> : null}
                              <span className="project-member-label">
                                <Users size={14} />
                                {memberCount} {t("projects.members")}
                              </span>
                            </div>

                            <div className="project-actions">
                              <select
                                value={project.status}
                                onChange={(event) => updateProject.mutate({ ...project, status: event.target.value as Project["status"] })}
                              >
                                <option value="PLANNING">{t("common.project.status.planning")}</option>
                                <option value="ACTIVE">{t("common.project.status.active")}</option>
                                <option value="ON_HOLD">{t("common.project.status.onHold")}</option>
                                <option value="COMPLETED">{t("common.project.status.completed")}</option>
                              </select>
                              <button className="secondary-button" type="button" onClick={() => setConfirmDeleteId(project.id)}>
                                {t("common.delete")}
                              </button>
                            </div>
                          </div>
                        </div>

                        <Link className="ghost-button" to={`/workspace/projects/${project.id}`}>
                          {t("projects.openWorkspace")}
                        </Link>
                      </article>
                    );
                  })}
                </div>

                {!filteredProjects.length ? (
                  <div className="empty-state workspace-empty-state">
                    <FolderKanban size={28} />
                    <div>
                      <strong>{t("projects.empty.title")}</strong>
                      <p>{t("projects.empty.description")}</p>
                    </div>
                    <Link className="primary-button" to="/workspace/projects?view=create">
                      {t("projects.empty.createFirst")}
                    </Link>
                  </div>
                ) : null}

                <div className="pagination">
                  <button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                    {t("common.previous")}
                  </button>
                  <span>
                    {t("common.pageOf", { page: String(data.meta.page), total: String(data.meta.totalPages) })}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={page >= data.meta.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {t("common.next")}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeView === "create" ? (
          <>
            <div className="panel form-panel project-create-panel">
              <div className="panel-header">
                <h3>{t("projects.title.create")}</h3>
                <span className="eyebrow">{t("projects.createAction", { role: formatRole(user?.role || "Admin") })}</span>
              </div>
              <form
                className="stack-form"
                onSubmit={handleSubmit(async (values) => {
                  await createProject.mutateAsync(values);
                })}
              >
                <label>
                  {t("projects.form.key")}
                  <input placeholder={t("projects.form.keyPlaceholder")} {...register("key")} />
                  {errors.key ? <small>{errors.key.message}</small> : null}
                </label>
                <label>
                  {t("projects.form.name")}
                  <input placeholder={t("projects.form.namePlaceholder")} {...register("name")} />
                  {errors.name ? <small>{errors.name.message}</small> : null}
                </label>
                <label>
                  {t("projects.form.description")}
                  <textarea rows={4} placeholder={t("projects.form.descPlaceholder")} {...register("description")} />
                  {errors.description ? <small>{errors.description.message}</small> : null}
                </label>
                <label>
                  {t("projects.form.status")}
                  <select {...register("status")}>
                    <option value="PLANNING">{t("common.project.status.planning")}</option>
                    <option value="ACTIVE">{t("common.project.status.active")}</option>
                    <option value="ON_HOLD">{t("common.project.status.onHold")}</option>
                    <option value="COMPLETED">{t("common.project.status.completed")}</option>
                  </select>
                </label>
                <label>
                  {t("projects.form.company")}
                  <select {...register("companyId")}>
                    <option value="">{t("common.noCompany")}</option>
                    {companiesQuery.data?.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dual-form-row">
                  <label>
                    {t("projects.form.startDate")}
                    <input type="date" {...register("startDate")} />
                  </label>
                  <label>
                    {t("projects.form.endDate")}
                    <input type="date" {...register("endDate")} />
                  </label>
                </div>

                {error ? <div className="form-error">{error}</div> : null}

                <button className="primary-button" type="submit" disabled={isSubmitting || createProject.isPending}>
                  {createProject.isPending ? t("common.creating") : t("projects.form.submit")}
                </button>
              </form>
            </div>

            <div className="panel project-create-info">
              <div className="panel-header">
                <h3>{t("projects.setup.title")}</h3>
                <span className="eyebrow">{t("projects.setup.eyebrow")}</span>
              </div>
              <div className="create-info-item">
                <strong>{t("projects.setup.key.title")}</strong>
                <p>{t("projects.setup.key.desc")}</p>
              </div>
              <div className="create-info-item">
                <strong>{t("projects.setup.status.title")}</strong>
                <ul className="create-info-status-list">
                  <li><span className="create-info-dot" style={{ background: "#6366f1" }} />{t("projects.setup.status.planning")}</li>
                  <li><span className="create-info-dot" style={{ background: "#2563eb" }} />{t("projects.setup.status.active")}</li>
                  <li><span className="create-info-dot" style={{ background: "#f59e0b" }} />{t("projects.setup.status.onHold")}</li>
                  <li><span className="create-info-dot" style={{ background: "#22c55e" }} />{t("projects.setup.status.completed")}</li>
                </ul>
              </div>
              <div className="create-info-item">
                <strong>{t("projects.setup.dates.title")}</strong>
                <p>{t("projects.setup.dates.desc")}</p>
              </div>
              <div className="create-info-item">
                <strong>{t("projects.setup.next.title")}</strong>
                <p>{t("projects.setup.next.desc")}</p>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {confirmDeleteId ? (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("projects.confirmDelete.title")}</h3>
            <p>{t("projects.confirmDelete.description")}</p>
            <div className="confirm-modal-actions">
              <button className="ghost-button" type="button" onClick={() => setConfirmDeleteId(null)}>
                {t("projects.confirmDelete.cancel")}
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  deleteProject.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                {t("projects.confirmDelete.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
