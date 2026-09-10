import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <section className="page checkout-success-page">
      <div className="panel checkout-result-panel">
        {status === "loading" ? (
          <div className="page-loader">Verifying your email…</div>
        ) : status === "success" ? (
          <>
            <div className="checkout-status-line">
              <CheckCircle2 size={20} style={{ color: "var(--success, #16a34a)" }} />
              <strong>Email verified successfully</strong>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Your account is now fully active.
            </p>
            <Link className="primary-button" to="/workspace">Go to workspace</Link>
          </>
        ) : (
          <>
            <div className="checkout-status-line">
              <AlertCircle size={20} style={{ color: "var(--danger)" }} />
              <strong>Invalid or expired verification link</strong>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              The link may have expired. Log in and check your settings for a new link.
            </p>
            <Link className="ghost-button" to="/login">Back to login</Link>
          </>
        )}
      </div>
    </section>
  );
}
