import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { GoogleAuthButton } from "../components/auth/GoogleAuthButton";
import { HexCanvas } from "../components/ui/HexCanvas";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { getErrorMessage } from "../lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, loginWithGoogle, logout, isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setError("");
      await login(values);
      navigate(location.state?.from || "/workspace");
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    try {
      setError("");
      await loginWithGoogle(credential);
      navigate(location.state?.from || "/workspace");
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="auth-hex-shell">
      <HexCanvas className="auth-hex-canvas" />

      <header className="auth-hex-topbar">
        <Link to="/" className="auth-hex-brand-link">
          <span className="auth-hex-topbar-logo">
            <img src="/sprintflow-logo.svg" alt="SprintFlow" className="hex-logo" style={{ width: 28, height: 28 }} />
          </span>
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
            <span>{t("auth.loginEyebrow")}</span>
          </div>
        </div>

        <h1 className="auth-hex-title">{t("auth.signIn")}</h1>
        <p className="auth-hex-sub">{t("auth.welcomeBack")}</p>

        {isAuthenticated ? (
          <div className="auth-session-card">
            <p>{t("auth.alreadySignedIn", { email: user?.email || "" })}</p>
            <div className="landing-cta-row">
              <Link className="primary-button" to="/workspace">{t("auth.openWorkspace")}</Link>
              <button className="ghost-button" type="button" onClick={() => logout()}>
                {t("auth.useAnotherAccount")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <form className="auth-hex-form" onSubmit={handleSubmit(onSubmit)}>
              <label className="auth-hex-label">
                {t("auth.email")}
                <input
                  type="email"
                  className="auth-hex-input"
                  placeholder="you@company.com"
                  {...register("email")}
                />
                {errors.email ? <small className="auth-hex-err">{errors.email.message}</small> : null}
              </label>

              <label className="auth-hex-label">
                {t("auth.password")}
                <div className="auth-hex-pass-wrap">
                  <input
                    type={showPass ? "text" : "password"}
                    className="auth-hex-input"
                    placeholder="Minimum 8 characters"
                    {...register("password")}
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
                {errors.password ? <small className="auth-hex-err">{errors.password.message}</small> : null}
              </label>

              <Link className="auth-hex-forgot" to="/forgot-password">
                {t("auth.forgotPasswordLink")}
              </Link>

              {error ? <div className="form-error auth-hex-api-err">{error}</div> : null}

              <button className="primary-button auth-hex-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("auth.signingIn") : t("auth.loginCta")}
              </button>
            </form>

            <div className="auth-separator"><span>{t("common.or")}</span></div>

            <GoogleAuthButton mode="signin" onCredential={handleGoogleLogin} onError={setError} />

            <p className="auth-hex-switch">
              {t("auth.needAccount")}{" "}
              <Link to="/register">{t("auth.createOne")}</Link>
            </p>

            <details className="auth-hex-demo">
              <summary>Demo credentials</summary>
              <div className="auth-hex-demo-list">
                <span>admin@agilepm.local</span>
                <span>moderator@agilepm.local</span>
                <span>user@agilepm.local</span>
                <span className="auth-hex-demo-pass">Password: Password123!</span>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
