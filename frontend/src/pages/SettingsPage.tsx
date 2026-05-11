import type { ChangeEvent } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { GoogleAuthButton } from "../components/auth/GoogleAuthButton";
import { PageHeader } from "../components/ui/PageHeader";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { calculateEnterpriseMonthlyPrice, defaultEnterpriseOptions, pricingPlans, type PricingPlanKey } from "../lib/pricing";
import type { User } from "../types";

const billingPlanKeyMap: Record<string, PricingPlanKey> = {
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
};

export default function SettingsPage() {
  const { user, refreshUser, linkGoogleAccount } = useAuth();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || "#2563eb");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [error, setError] = useState("");
  const activeView = searchParams.get("view") || "profile";
  const currentPlanKey = billingPlanKeyMap[user?.billingPlan || "STARTER"] || "starter";

  const updateProfile = useMutation({
    mutationFn: async () =>
      api.patch<{ user: User }>("/auth/profile", {
        fullName,
        avatarColor,
        avatarUrl: avatarUrl || "",
      }),
    onSuccess: async () => {
      setError("");
      toast.success(t("toast.profileSaved"));
      await refreshUser();
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const connectGoogle = useMutation({
    mutationFn: async (credential: string) => {
      await linkGoogleAccount(credential);
    },
    onSuccess: async () => {
      setError("");
      toast.success("Google account connected");
      await refreshUser();
    },
    onError: (mutationError) => {
      const msg = getErrorMessage(mutationError);
      setError(msg);
      toast.error(msg);
    },
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Please choose an image smaller than 2 MB.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.readAsDataURL(file);
    });

    setAvatarUrl(dataUrl);
    setError("");
  };

  return (
    <section className="page">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={activeView === "billing" ? t("settings.billingTitle") : t("settings.profileTitle")}
        description=""
      />

      <div className="settings-view-switcher">
        {[
          { key: "profile", label: t("settings.profileTitle") },
          { key: "billing", label: t("settings.billingTitle") },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeView === item.key ? "scope-chip active" : "scope-chip"}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (item.key === "profile") {
                next.delete("view");
              } else {
                next.set("view", item.key);
              }
              setSearchParams(next, { replace: true });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeView === "profile" ? (
        <div className="panel settings-panel" id="profile-settings">
          <div className="settings-avatar-row">
            <UserAvatar fullName={fullName} avatarColor={avatarColor} avatarUrl={avatarUrl} className="settings-avatar" />
            <div>
              <strong>{fullName}</strong>
              <p>{user?.email}</p>
              <p>
                {t("settings.plan")}: {user?.billingPlan || "STARTER"} {user?.subscriptionStatus ? `· ${user.subscriptionStatus}` : ""}
              </p>
            </div>
          </div>

          <div className="settings-language-row">
            <strong>{t("common.language")}</strong>
            <LanguageSwitcher />
          </div>

          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await updateProfile.mutateAsync();
            }}
          >
            <label>
              {t("settings.fullName")}
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>

            <label>
              {t("settings.profilePicture")}
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </label>

            <label>
              {t("settings.avatarColor")}
              <input type="color" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)} />
            </label>

            <div className="landing-cta-row">
              <button className="primary-button" type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? t("settings.saving") : t("settings.saveProfile")}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setAvatarUrl(null);
                }}
              >
                {t("settings.removePhoto")}
              </button>
            </div>

            {error ? <div className="form-error">{error}</div> : null}
          </form>

          <div className="panel-header" style={{ marginTop: "24px" }}>
            <h3>{t("settings.googleTitle")}</h3>
            <span className="eyebrow">{t("settings.connection")}</span>
          </div>
          <div className="stack-list">
            <div className="border-card list-card">
              <div>
                <strong>{t("settings.status")}</strong>
                <p>{user?.googleConnected ? t("settings.googleConnected") : t("settings.googleNotConnected")}</p>
              </div>
            </div>
          </div>
          <div className="settings-action-block">
            {user?.googleConnected ? (
              <div className="google-auth-placeholder connected">{t("settings.googleConnectedReady")}</div>
            ) : (
              <GoogleAuthButton
                mode="continue"
                onCredential={async (credential) => {
                  await connectGoogle.mutateAsync(credential);
                }}
                onError={setError}
              />
            )}
          </div>
        </div>
      ) : null}

      {activeView === "billing" ? (
        <div className="panel settings-panel" id="billing-settings">
          <div className="panel-header">
            <h3>{t("settings.billingTitle")}</h3>
            <span className="eyebrow">{t("settings.subscription")}</span>
          </div>
          <div className="stack-list">
            <div className="border-card list-card">
              <div>
                <strong>{t("settings.currentPlan")}</strong>
                <p>{user?.billingPlan || "STARTER"}</p>
              </div>
            </div>
            <div className="border-card list-card">
              <div>
                <strong>{t("settings.subscriptionStatus")}</strong>
                <p>{user?.subscriptionStatus || t("settings.noSubscription")}</p>
              </div>
              <div>
                <strong>{t("settings.aiAccess")}</strong>
                <p>{user?.aiEntitlements?.usageLabel || t("settings.aiAccess")}</p>
              </div>
            </div>
          </div>
          <div className="settings-plan-selector">
            {pricingPlans.map((plan) => {
              const isCurrent = currentPlanKey === plan.key;
              const checkoutTarget = `/checkout?plan=${plan.key}`;
              const monthlyLabel =
                plan.key === "enterprise" ? `From $${calculateEnterpriseMonthlyPrice(defaultEnterpriseOptions)}/mo` :
                plan.key === "starter" ? plan.priceLabel :
                `${plan.priceLabel}/mo`;

              return (
                <article
                  key={plan.key}
                  className={`settings-plan-card${isCurrent ? " current" : ""}`}
                >
                  <div className="settings-plan-card-head">
                    <div>
                      <strong>{plan.name}</strong>
                      <p>{plan.description}</p>
                    </div>
                    <span className="settings-plan-price">{monthlyLabel}</span>
                  </div>

                  <div className="settings-plan-points">
                    {plan.points.map((point) => (
                      <span key={point} className="settings-plan-pill">
                        {point}
                      </span>
                    ))}
                  </div>

                  <div className="settings-plan-card-foot">
                    {isCurrent ? (
                      <span className="settings-plan-current-badge">{t("settings.currentPlanBadge")}</span>
                    ) : (
                      <Link className="primary-button" to={checkoutTarget}>
                        {plan.key === "starter" ? t("settings.viewFreeTrial") : t("settings.choosePlan", { name: plan.name })}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="settings-action-block">
            <Link className="ghost-button" to={currentPlanKey === "enterprise" ? "/checkout?plan=enterprise" : "/checkout?plan=professional"}>
              {t("settings.changePlan")}
            </Link>
          </div>
        </div>
      ) : null}

    </section>
  );
}
