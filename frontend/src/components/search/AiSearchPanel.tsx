import { ArrowUpRight, Lock, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../features/i18n/I18nContext";
import { api, getErrorMessage } from "../../lib/api";
import { searchOptionsByQuery, type SearchOption } from "../../lib/searchOptions";

type AssistantResponse = {
  answer: string;
  suggestions: SearchOption[];
  mode: "guided";
};

type AiSearchPanelProps = {
  variant: "landing" | "workspace";
};

const dedupeOptions = (options: SearchOption[]) => {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (seen.has(option.id)) {
      return false;
    }

    seen.add(option.id);
    return true;
  });
};

export function AiSearchPanel({ variant }: AiSearchPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [assistant, setAssistant] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState("");

  const localMatches = useMemo(() => searchOptionsByQuery(query, user?.role).slice(0, 8), [query, user?.role]);
  const assistantSuggestions = assistant?.suggestions || [];
  const combinedSuggestions = useMemo(() => dedupeOptions([...assistantSuggestions, ...localMatches]).slice(0, 8), [assistantSuggestions, localMatches]);
  const isCompactLanding = variant === "landing";
  const isMinimalWorkspace = variant === "workspace";
  const useFloatingResults = variant === "landing" || variant === "workspace";

  const suggestedQueries = ["overdue tasks", "my projects", "create project", "team meetings", "billing", "dashboard"];

  useEffect(() => {
    if (!query.trim()) {
      setAssistant(null);
      setError("");
    }
  }, [query]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setError("");
        const { data } = await api.post<AssistantResponse>("/assistant/search", {
          query: normalized,
          pathname: location.pathname,
        });
        if (!cancelled) {
          setAssistant(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setAssistant(null);
          setError(getErrorMessage(requestError));
        }
      } finally {
        // no-op
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, query]);

  const openOption = (option: SearchOption) => {
    if (option.requiresAuth && !isAuthenticated) {
      navigate("/login", { state: { from: option.to } });
      return;
    }

    if (option.to.startsWith("/#")) {
      const hash = option.to.replace("/#", "#");

      if (window.location.pathname === "/") {
        window.history.replaceState(null, "", hash);
        const target = document.querySelector(hash);

        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        return;
      }

      window.location.assign(option.to);
      return;
    }

    navigate(option.to);
  };

  const askAssistant = async () => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError("");
      return;
    }

    try {
      setError("");
      const { data } = await api.post<AssistantResponse>("/assistant/search", {
        query: normalized,
        pathname: location.pathname,
      });
      setAssistant(data);
    } catch (requestError) {
      setAssistant(null);
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <section className={`ai-search-panel ai-search-panel-${variant}${isCompactLanding ? " ai-search-panel-compact" : ""}`}>
      {!isCompactLanding && !isMinimalWorkspace ? (
        <div className="ai-search-header">
          <div>
            <span className="eyebrow">{t("search.header.eyebrow")}</span>
            <h2>{t("search.header.title")}</h2>
            <p>{t("search.header.description")}</p>
          </div>
          <div className="ai-search-status">
            <strong>{isAuthenticated ? t("common.workspaceAccessEnabled") : t("common.protectedPagesRequireLogin")}</strong>
            <span>{isAuthenticated ? t("common.signedInAs", { email: user?.email ?? "" }) : t("common.protectedLoginFirst")}</span>
          </div>
        </div>
      ) : null}

      <div className="ai-search-box">
        <div className="ai-search-input-row">
          <label className="ai-search-input">
            <Search size={18} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void askAssistant();
                }
              }}
              placeholder={
                variant === "landing"
                  ? t("search.placeholder.home")
                  : t("search.placeholder.workspace")
              }
            />
            {query ? (
              <button type="button" className="ai-search-clear" onClick={() => setQuery("")} aria-label="Clear">
                <X size={14} />
              </button>
            ) : null}
          </label>
        </div>

        {!query.trim() && !isCompactLanding ? (
          <div className="ai-search-suggestions">
            <span className="ai-search-suggest-label eyebrow">{t("search.suggestLabel")}</span>
            {suggestedQueries.map((chip) => (
              <button key={chip} type="button" className="ai-search-chip" onClick={() => setQuery(chip)}>
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <div className={`form-error ai-search-error${isCompactLanding ? " ai-search-floating-error" : ""}`}>{error}</div> : null}

        {query.trim() ? (
          <div
            className={
              useFloatingResults
                ? `ai-search-popover${variant === "workspace" ? " ai-search-popover-workspace" : ""}`
                : "ai-search-results-grid"
            }
          >
            {assistant ? (
              <article className="ai-search-surface">
                <div className="ai-search-surface-header">
                  <strong>{t("search.assistantAnswer")}</strong>
                  <span>{t("common.ready")}</span>
                </div>
                <p className="ai-search-answer">{assistant.answer}</p>
              </article>
            ) : null}

            <article className="ai-search-surface">
              <div className="ai-search-surface-header">
                <strong>{isCompactLanding ? t("common.searchResults") : t("search.matchingOptions")}</strong>
                <span>{combinedSuggestions.length} {t("search.results")}</span>
              </div>

              <div className="ai-search-results-list">
                {combinedSuggestions.length ? (
                  combinedSuggestions.map((option) => (
                    <button key={option.id} type="button" className="ai-search-result" onClick={() => openOption(option)}>
                      <div>
                        <strong>{option.title}</strong>
                        <p>{option.description}</p>
                      </div>
                      <div className="ai-search-result-meta">
                        <span>{option.section}</span>
                        {option.requiresAuth && !isAuthenticated ? <Lock size={14} /> : <ArrowUpRight size={14} />}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="empty-state compact-empty-state">{t("common.noMatches")}</div>
                )}
              </div>
            </article>
          </div>
        ) : null}
      </div>
    </section>
  );
}
