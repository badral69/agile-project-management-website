import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../features/auth/AuthContext";
import { api } from "../lib/api";
import type { BillingPlan, User } from "../types";

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { isAuthenticated, refreshUser } = useAuth();

  const sessionQuery = useQuery({
    queryKey: ["checkout-session", sessionId],
    queryFn: async () => {
      const response = await api.get<{
        session: {
          status: string;
          paymentStatus: string | null;
          customerEmail: string | null;
          amountTotal: number | null;
          currency: string | null;
          billingPlan: BillingPlan;
        };
        user?: User | null;
      }>(`/billing/${sessionId}`);
      await refreshUser();
      return response.data;
    },
    enabled: Boolean(sessionId),
    retry: 1,
  });

  if (!sessionId) {
    return (
      <section className="page checkout-success-page">
        <PageHeader eyebrow="Billing" title="Payment status" description="Review the result of your SprintFlow payment." />
        <div className="panel checkout-result-panel">
          <div className="checkout-status-line">
            <AlertCircle size={20} style={{ color: "var(--danger)" }} />
            <strong>No payment session found</strong>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            This page requires a valid Stripe session. If you just completed a payment, check your billing settings.
          </p>
          <div className="landing-cta-row">
            <Link className="primary-button" to={isAuthenticated ? "/workspace/settings?view=billing" : "/login"}>
              {isAuthenticated ? "Go to billing" : "Sign in"}
            </Link>
            <Link className="ghost-button" to={isAuthenticated ? "/workspace" : "/"}>
              Back to {isAuthenticated ? "workspace" : "home"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page checkout-success-page">
      <PageHeader eyebrow="Billing" title="Payment status" description="Review the result of your SprintFlow payment and continue to your workspace." />

      <div className="panel checkout-result-panel">
        {sessionQuery.isLoading ? (
          <div className="page-loader">Checking Stripe session...</div>
        ) : sessionQuery.isError ? (
          <>
            <div className="checkout-status-line">
              <AlertCircle size={20} style={{ color: "var(--danger)" }} />
              <strong>Could not verify payment</strong>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              There was a problem verifying your session. Your payment may still have gone through — check your billing settings.
            </p>
            <div className="landing-cta-row">
              <Link className="primary-button" to={isAuthenticated ? "/workspace/settings?view=billing" : "/login"}>
                {isAuthenticated ? "Go to billing" : "Sign in"}
              </Link>
              <Link className="ghost-button" to="/checkout?plan=professional">Back to checkout</Link>
            </div>
          </>
        ) : sessionQuery.data ? (
          <>
            <div className="checkout-status-line">
              <CheckCircle2 size={20} />
              <strong>{sessionQuery.data.session.status === "complete" ? "Payment completed" : "Checkout still open"}</strong>
            </div>
            <div className="meta-grid">
              <span>Plan: {sessionQuery.data.session.billingPlan}</span>
              <span>Status: {sessionQuery.data.session.paymentStatus || "Pending"}</span>
              <span>Email: {sessionQuery.data.session.customerEmail || "Unavailable"}</span>
              <span>
                Total:{" "}
                {sessionQuery.data.session.amountTotal
                  ? `$${(sessionQuery.data.session.amountTotal / 100).toFixed(2)} ${String(sessionQuery.data.session.currency || "").toUpperCase()}`
                  : "Unavailable"}
              </span>
            </div>
            <div className="landing-cta-row">
              <Link className="primary-button" to={isAuthenticated ? "/workspace" : "/login"}>
                {isAuthenticated ? "Open workspace" : "Sign in"}
              </Link>
              <Link className="ghost-button" to="/checkout?plan=professional">Back to checkout</Link>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
