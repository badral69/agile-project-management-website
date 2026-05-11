import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { Company, PaginatedResponse, User } from "../types";

type AdminUser = User & {
  companyMemberships?: Array<{
    id: string;
    memberRole: "SUPERVISOR" | "WORKER";
    company: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  _count: {
    memberships: number;
    assignedTasks: number;
    companyMemberships: number;
  };
};

type RoleFilter = "all" | "ADMIN" | "MODERATOR" | "USER";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [companyForm, setCompanyForm] = useState({ name: "", slug: "", description: "" });
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [companyRole, setCompanyRole] = useState<"SUPERVISOR" | "WORKER">("WORKER");
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users", page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);

      const response = await api.get<PaginatedResponse<AdminUser>>(`/users?${params.toString()}`);
      return response.data;
    },
  });

  const companiesQuery = useQuery({
    queryKey: ["companies-admin-options"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Company>>("/companies?page=1&limit=100");
      return response.data.items;
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: async () => {
      setError("");
      toast.success(t("toast.roleUpdated"));
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const createCompany = useMutation({
    mutationFn: async () => api.post("/companies", companyForm),
    onSuccess: async () => {
      setCompanyForm({ name: "", slug: "", description: "" });
      setError("");
      toast.success(t("toast.companyCreated"));
      await queryClient.invalidateQueries({ queryKey: ["companies-admin-options"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: async () => {
      setError("");
      setConfirmDeleteUser(null);
      toast.success(t("toast.userDeleted"));
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const addCompanyMember = useMutation({
    mutationFn: async () =>
      api.post(`/companies/${selectedCompanyId}/members`, {
        userId: selectedUserId,
        memberRole: companyRole,
      }),
    onSuccess: async () => {
      setSelectedUserId("");
      setCompanyRole("WORKER");
      setError("");
      toast.success(t("toast.memberAdded"));
      await queryClient.invalidateQueries({ queryKey: ["companies-admin-options"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const companies = companiesQuery.data || [];
  const users = usersQuery.data?.items || [];
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  return (
    <section className="page">
      <PageHeader
        eyebrow={t("admin.users.eyebrow")}
        title={t("admin.users.title")}
        description={t("admin.users.description")}
      />

      {error ? <div className="form-error">{error}</div> : null}

      <div className="dashboard-detail-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>{t("admin.users.createCompany.title")}</h3>
            <span className="eyebrow">{t("admin.users.createCompany.eyebrow")}</span>
          </div>
          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await createCompany.mutateAsync();
            }}
          >
            <label>
              {t("admin.users.createCompany.name")}
              <input value={companyForm.name} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              {t("admin.users.createCompany.slug")}
              <input value={companyForm.slug} onChange={(event) => setCompanyForm((current) => ({ ...current, slug: event.target.value }))} />
            </label>
            <label>
              {t("admin.users.createCompany.descriptionLabel")}
              <textarea rows={3} value={companyForm.description} onChange={(event) => setCompanyForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <button className="primary-button" type="submit" disabled={createCompany.isPending}>
              <Building2 size={16} />
              {createCompany.isPending ? t("admin.common.creating") : t("admin.users.createCompany.submit")}
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>{t("admin.users.companyMembership.title")}</h3>
            <span className="eyebrow">{t("admin.users.companyMembership.eyebrow")}</span>
          </div>
          <div className="stack-form">
            <label>
              {t("admin.users.companyMembership.company")}
              <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>
                <option value="">{t("admin.users.companyMembership.chooseCompany")}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("admin.users.companyMembership.user")}
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                <option value="">{t("admin.users.companyMembership.chooseUser")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("admin.users.companyMembership.role")}
              <select value={companyRole} onChange={(event) => setCompanyRole(event.target.value as "SUPERVISOR" | "WORKER")}>
                <option value="WORKER">{t("admin.common.worker")}</option>
                <option value="SUPERVISOR">{t("admin.common.supervisor")}</option>
              </select>
            </label>
            <button className="primary-button" type="button" disabled={!selectedCompanyId || !selectedUserId || addCompanyMember.isPending} onClick={() => void addCompanyMember.mutateAsync()}>
              <UserPlus size={16} />
              {addCompanyMember.isPending ? t("admin.common.adding") : t("admin.users.companyMembership.submit")}
            </button>
          </div>

          <div className="stack-list">
            {selectedCompany?.members?.map((member) => (
              <article key={member.id} className="list-card">
                <div>
                  <strong>{member.user.fullName}</strong>
                  <p>{member.user.email}</p>
                </div>
                <div className="list-metadata">
                  <span>{member.memberRole === "SUPERVISOR" ? t("admin.common.supervisor") : t("admin.common.worker")}</span>
                  <span>{member.user.role}</span>
                </div>
              </article>
            )) || <div className="empty-state compact-empty-state">{t("admin.users.companyMembership.empty")}</div>}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>{t("admin.users.list.title")}</h3>
          <span className="eyebrow">{t("admin.users.list.eyebrow")}</span>
        </div>

        <div className="toolbar admin-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("admin.users.list.searchPlaceholder")}
            />
          </label>
          <label className="inline-filter">
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as RoleFilter);
                setPage(1);
              }}
            >
              <option value="all">{t("admin.users.list.allRoles")}</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MODERATOR">MODERATOR</option>
              <option value="USER">USER</option>
            </select>
          </label>
        </div>

        {usersQuery.isLoading || !usersQuery.data ? (
          <div className="page-loader">{t("admin.users.list.loading")}</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("admin.users.table.user")}</th>
                    <th>{t("admin.users.table.role")}</th>
                    <th>{t("admin.users.table.companies")}</th>
                    <th>{t("admin.users.table.projects")}</th>
                    <th>{t("admin.users.table.assignedTasks")}</th>
                    <th>{t("admin.users.table.created")}</th>
                    <th>{t("admin.users.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.fullName}</strong>
                        <p>{user.email}</p>
                      </td>
                      <td>
                        <select value={user.role} onChange={(event) => roleMutation.mutate({ id: user.id, role: event.target.value })}>
                          <option value="ADMIN">ADMIN</option>
                          <option value="MODERATOR">MODERATOR</option>
                          <option value="USER">USER</option>
                        </select>
                      </td>
                      <td>
                        {(user.companyMemberships || []).length
                          ? user.companyMemberships?.map((membership) => `${membership.company.name} (${membership.memberRole})`).join(", ")
                          : t("common.noCompany")}
                      </td>
                      <td>{user._count.memberships}</td>
                      <td>{user._count.assignedTasks}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title={t("admin.users.confirmDelete.confirm")}
                          disabled={deleteUserMutation.isPending}
                          onClick={() => setConfirmDeleteUser(user)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <button
                type="button"
                className="ghost-button"
                disabled={usersQuery.data.meta.page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                {t("common.previous")}
              </button>
              <span className="muted-text">
                {t("common.pageOf", {
                  page: usersQuery.data.meta.page,
                  total: usersQuery.data.meta.totalPages,
                })}
              </span>
              <button
                type="button"
                className="ghost-button"
                disabled={usersQuery.data.meta.page >= usersQuery.data.meta.totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, usersQuery.data?.meta.totalPages || current))}
              >
                {t("common.next")}
              </button>
            </div>
          </>
        )}
      </div>

      {confirmDeleteUser ? (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteUser(null)}>
          <div className="confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t("admin.users.confirmDelete.title")}</h3>
            <p>{t("admin.users.confirmDelete.description", { name: confirmDeleteUser.fullName })}</p>
            <div className="confirm-modal-actions">
              <button className="ghost-button" type="button" onClick={() => setConfirmDeleteUser(null)}>
                {t("admin.users.confirmDelete.cancel")}
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => deleteUserMutation.mutate(confirmDeleteUser.id)}
              >
                {t("admin.users.confirmDelete.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
