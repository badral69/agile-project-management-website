import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import type { PaginatedResponse } from "../types";

type CompanyMember = {
  id: string;
  memberRole: "SUPERVISOR" | "WORKER";
  user: { id: string; fullName: string; email: string; avatarColor: string };
};

type Company = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count: { members: number; projects: number };
  members: CompanyMember[];
};

type DirectoryUser = { id: string; fullName: string; email: string };

export default function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"SUPERVISOR" | "WORKER">("WORKER");
  const [memberError, setMemberError] = useState("");

  const companiesQuery = useQuery({
    queryKey: ["admin-companies", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "8",
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await api.get<PaginatedResponse<Company>>(`/companies?${params.toString()}`);
      return res.data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["admin-company-users"],
    queryFn: async () => {
      const res = await api.get<{ items: DirectoryUser[] }>("/users/directory");
      return res.data.items;
    },
  });

  const companies = companiesQuery.data?.items || [];

  useEffect(() => {
    if (!selectedCompanyId && companies[0]) {
      setSelectedCompanyId(companies[0].id);
      return;
    }

    if (selectedCompanyId && !companies.some((company) => company.id === selectedCompanyId)) {
      setSelectedCompanyId(companies[0]?.id || "");
    }
  }, [companies, selectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  const createMutation = useMutation({
    mutationFn: async () => api.post("/companies", { name, description }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setName("");
      setDescription("");
      setCreating(false);
      setError("");
      toast.success(t("toast.companyCreated"));
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async () =>
      api.post(`/companies/${selectedCompanyId}/members`, { userId: memberUserId, memberRole }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setMemberUserId("");
      setMemberError("");
      setAddingMember(false);
      toast.success(t("toast.memberAdded"));
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setMemberError(msg);
      toast.error(msg);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) =>
      api.patch(`/companies/${selectedCompanyId}/members/${memberId}`, { memberRole: role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success(t("toast.roleUpdated"));
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) =>
      api.delete(`/companies/${selectedCompanyId}/members/${memberId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success(t("toast.memberRemoved"));
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const users = usersQuery.data || [];

  return (
    <section className="page admin-companies-page">
      <PageHeader
        eyebrow={t("admin.companies.eyebrow")}
        title={t("admin.companies.title")}
        description={t("admin.companies.description")}
        actions={
          <button className="primary-button" type="button" onClick={() => setCreating(true)}>
            <Plus size={15} /> {t("admin.companies.newCompany")}
          </button>
        }
      />

      <div className="admin-companies-grid">
        <div className="panel">
          {creating ? (
            <div className="company-create-form">
              <h4>{t("admin.companies.create.title")}</h4>
              <label>
                {t("admin.companies.create.name")}
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
              </label>
              <label>
                {t("admin.companies.create.descriptionLabel")}
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("admin.companies.create.optional")} />
              </label>
              {error ? <div className="form-error">{error}</div> : null}
              <div className="form-actions">
                <button type="button" className="ghost-button" onClick={() => { setCreating(false); setError(""); }}>{t("admin.common.cancel")}</button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={name.trim().length < 2 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? t("admin.common.creating") : t("admin.companies.create.submit")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="toolbar admin-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t("admin.companies.searchPlaceholder")}
              />
            </label>
          </div>

          <div className="company-list">
            {companiesQuery.isLoading ? (
              <div className="page-loader">{t("admin.companies.loading")}</div>
            ) : companies.length === 0 && !creating ? (
              <div className="empty-state">
                <Building2 size={24} />
                <div><strong>{t("admin.companies.empty.title")}</strong><p>{t("admin.companies.empty.description")}</p></div>
              </div>
            ) : null}

            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                className={`company-list-row ${selectedCompany?.id === company.id ? "active" : ""}`}
                onClick={() => setSelectedCompanyId(company.id)}
              >
                <div className="company-list-icon">
                  <Building2 size={16} />
                </div>
                <div>
                  <strong>{company.name}</strong>
                  <p>{t("admin.companies.card.meta", { members: company._count.members, projects: company._count.projects })}</p>
                </div>
                <Link
                  className="ghost-button"
                  to={`/workspace/companies/${company.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("common.open")}
                </Link>
              </button>
            ))}
          </div>

          {companiesQuery.data ? (
            <div className="admin-pagination">
              <button
                type="button"
                className="ghost-button"
                disabled={companiesQuery.data.meta.page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                {t("common.previous")}
              </button>
              <span className="muted-text">
                {t("common.pageOf", {
                  page: companiesQuery.data.meta.page,
                  total: companiesQuery.data.meta.totalPages,
                })}
              </span>
              <button
                type="button"
                className="ghost-button"
                disabled={companiesQuery.data.meta.page >= companiesQuery.data.meta.totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, companiesQuery.data?.meta.totalPages || current))}
              >
                {t("common.next")}
              </button>
            </div>
          ) : null}
        </div>

        {selectedCompany ? (
          <div className="panel company-detail-panel">
            <div className="panel-header">
              <h3>{selectedCompany.name}</h3>
              <button type="button" className="ghost-button" onClick={() => setAddingMember(true)}>
                <UserPlus size={14} /> {t("admin.companies.addMember")}
              </button>
            </div>
            {selectedCompany.description ? <p className="company-description">{selectedCompany.description}</p> : null}

            {addingMember ? (
              <div className="company-add-member-form">
                <div className="dual-form-row">
                  <label>
                    {t("admin.companies.memberForm.user")}
                    <select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
                      <option value="">{t("admin.companies.memberForm.selectUser")}</option>
                      {users
                        .filter((u) => !selectedCompany.members.some((m) => m.user.id === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.fullName} — {u.email}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("admin.companies.memberForm.role")}
                    <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as "SUPERVISOR" | "WORKER")}>
                      <option value="SUPERVISOR">{t("admin.common.supervisor")}</option>
                      <option value="WORKER">{t("admin.common.worker")}</option>
                    </select>
                  </label>
                </div>
                {memberError ? <div className="form-error">{memberError}</div> : null}
                <div className="form-actions">
                  <button type="button" className="ghost-button" onClick={() => { setAddingMember(false); setMemberError(""); }}>
                    <X size={13} /> {t("admin.common.cancel")}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!memberUserId || addMemberMutation.isPending}
                    onClick={() => addMemberMutation.mutate()}
                  >
                    {addMemberMutation.isPending ? t("admin.common.adding") : t("admin.companies.memberForm.submit")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="company-members-list">
              {selectedCompany.members.length === 0 ? (
                <p className="muted-text">{t("admin.companies.membersEmpty")}</p>
              ) : null}
              {selectedCompany.members.map((member) => (
                <div key={member.id} className="company-member-row">
                  <div
                    className="avatar-circle small"
                    style={{ background: member.user.avatarColor }}
                  >
                    {member.user.fullName[0]}
                  </div>
                  <div className="company-member-info">
                    <strong>{member.user.fullName}</strong>
                    <p>{member.user.email}</p>
                  </div>
                  <select
                    className="company-role-select"
                    value={member.memberRole}
                    onChange={(e) => updateRoleMutation.mutate({ memberId: member.id, role: e.target.value })}
                  >
                    <option value="SUPERVISOR">{t("admin.common.supervisor")}</option>
                    <option value="WORKER">{t("admin.common.worker")}</option>
                  </select>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => removeMemberMutation.mutate(member.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="panel company-detail-panel company-detail-empty">
            <Building2 size={28} />
            <p>{t("admin.companies.selectPrompt")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
