import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { HexCanvas } from "../components/ui/HexCanvas";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { useI18n } from "../features/i18n/I18nContext";
import { api, getErrorMessage } from "../lib/api";

const requestSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z
  .object({
    email: z.string().email(),
    token: z.string().length(64),
    newPassword: z
      .string()
      .min(8)
      .max(64)
      .regex(/[a-z]/, "Password must include a lowercase letter.")
      .regex(/[A-Z]/, "Password must include an uppercase letter.")
      .regex(/[0-9]/, "Password must include a number.")
      .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
    confirmPassword: z.string().min(8),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type RequestFormValues = z.infer<typeof requestSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  // When arriving via the email link (?token=...&email=...), jump straight to reset step
  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");
    if (token && email) {
      resetForm.setValue("token", token);
      resetForm.setValue("email", email);
      setStep("reset");
    }
  }, [searchParams, resetForm]);

  const handleRequestReset = async (values: RequestFormValues) => {
    try {
      setError("");
      setSuccess("");
      const { data } = await api.post<{ message: string }>("/auth/forgot-password", values);
      setSuccess(data.message);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleResetPassword = async (values: ResetFormValues) => {
    try {
      setError("");
      setSuccess("");
      const { data } = await api.post<{ message: string }>("/auth/reset-password", {
        email: values.email,
        token: values.token,
        newPassword: values.newPassword,
      });
      setSuccess(data.message);
      window.setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <div className="auth-hex-shell">
      <HexCanvas className="auth-hex-canvas" />

      <header className="auth-hex-topbar">
        <Link to="/" className="auth-hex-brand-link">
          <img src="/sprintflow-logo.svg" alt="SprintFlow" className="hex-logo" style={{ width: 28, height: 28 }} />
          <strong>SprintFlow</strong>
        </Link>
        <LanguageSwitcher compact />
      </header>

      <div className="auth-hex-card">
        <div className="auth-hex-card-brand">
          <div className="auth-hex-badge">
            <img src="/sprintflow-logo.svg" alt="SprintFlow" />
          </div>
          <div>
            <strong>SprintFlow</strong>
            <span>{t("auth.forgotPasswordEyebrow")}</span>
          </div>
        </div>

        <h1 className="auth-hex-title">
          {step === "request" ? t("auth.forgotPasswordTitle") : t("auth.createNewPassword")}
        </h1>
        <p className="auth-hex-sub">
          {step === "request"
            ? t("auth.forgotPasswordHeroDescription")
            : "Enter your new password below."}
        </p>

        {step === "request" ? (
          <form className="auth-hex-form" onSubmit={requestForm.handleSubmit(handleRequestReset)}>
            <label className="auth-hex-label">
              {t("auth.email")}
              <input
                type="email"
                className="auth-hex-input"
                placeholder="you@company.com"
                {...requestForm.register("email")}
              />
              {requestForm.formState.errors.email ? (
                <small className="auth-hex-err">{requestForm.formState.errors.email.message}</small>
              ) : null}
            </label>

            {error ? <div className="form-error auth-hex-api-err">{error}</div> : null}
            {success ? <div className="form-success">{success}</div> : null}

            <button className="primary-button auth-hex-submit" type="submit" disabled={requestForm.formState.isSubmitting}>
              {requestForm.formState.isSubmitting ? t("auth.sendingCode") : t("auth.sendResetCode")}
            </button>
          </form>
        ) : (
          <form className="auth-hex-form" onSubmit={resetForm.handleSubmit(handleResetPassword)}>
            {/* token and email are pre-filled from URL params and submitted silently */}
            <input type="hidden" {...resetForm.register("token")} />
            <input type="hidden" {...resetForm.register("email")} />

            <label className="auth-hex-label">
              {t("auth.newPassword")}
              <div className="auth-hex-pass-wrap">
                <input
                  type={showPass ? "text" : "password"}
                  className="auth-hex-input"
                  placeholder="8+ chars, upper/lower, number, symbol"
                  {...resetForm.register("newPassword")}
                />
                <button
                  type="button"
                  className="auth-hex-eye"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {resetForm.formState.errors.newPassword ? (
                <small className="auth-hex-err">{resetForm.formState.errors.newPassword.message}</small>
              ) : null}
            </label>

            <label className="auth-hex-label">
              {t("auth.confirmPassword")}
              <div className="auth-hex-pass-wrap">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="auth-hex-input"
                  placeholder="Repeat your password"
                  {...resetForm.register("confirmPassword")}
                />
                <button
                  type="button"
                  className="auth-hex-eye"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {resetForm.formState.errors.confirmPassword ? (
                <small className="auth-hex-err">{resetForm.formState.errors.confirmPassword.message}</small>
              ) : null}
            </label>

            {error ? <div className="form-error auth-hex-api-err">{error}</div> : null}
            {success ? <div className="form-success">{success}</div> : null}

            <button className="primary-button auth-hex-submit" type="submit" disabled={resetForm.formState.isSubmitting}>
              {resetForm.formState.isSubmitting ? t("auth.updatingPassword") : t("auth.resetPassword")}
            </button>
          </form>
        )}

        <p className="auth-hex-switch">
          {t("auth.rememberedIt")}{" "}
          <Link to="/login">{t("auth.goBackToLogin")}</Link>
        </p>
      </div>
    </div>
  );
}
