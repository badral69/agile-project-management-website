import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { GoogleAuthButton } from "../components/auth/GoogleAuthButton";
import { HexCanvas } from "../components/ui/HexCanvas";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { getErrorMessage } from "../lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, loginWithGoogle, logout, isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setError("");
      await registerUser(values);
      navigate("/workspace");
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleGoogleRegister = async (credential: string) => {
    try {
      setError("");
      await loginWithGoogle(credential);
      navigate("/workspace");
    } catch (e) {
      setError(getErrorMessage(e));
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
            <span>{t("auth.registerEyebrow")}</span>
          </div>
        </div>

        <h1 className="auth-hex-title">{t("auth.createAccount")}</h1>
        <p className="auth-hex-sub">{t("auth.registerHeroDescription")}</p>

        {isAuthenticated ? (
          <div className="auth-session-card">
            <p>{t("auth.alreadySignedIn", { email: user?.email || "" })}</p>
            <div className="landing-cta-row">
              <Link className="primary-button" to="/workspace">{t("auth.openWorkspace")}</Link>
              <button className="ghost-button" type="button" onClick={() => logout()}>
                {t("auth.createDifferentAccount")}
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
                    placeholder="8+ chars, upper/lower, number, symbol"
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

              {error ? <div className="form-error auth-hex-api-err">{error}</div> : null}

              <button className="primary-button auth-hex-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("auth.creating") : t("auth.registerCta")}
              </button>
            </form>

            <div className="auth-separator"><span>{t("common.or")}</span></div>

            <GoogleAuthButton mode="signup" onCredential={handleGoogleRegister} onError={setError} />

            <p className="auth-hex-switch">
              {t("auth.alreadyRegistered")}{" "}
              <Link to="/login">{t("auth.goToLogin")}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
