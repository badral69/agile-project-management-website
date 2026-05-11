import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { env } from "../config/env";
import { api } from "../lib/api";
import { calculateEnterpriseMonthlyPrice, defaultEnterpriseOptions, pricingPlans, type EnterpriseOptions, type PricingPlanKey } from "../lib/pricing";

const stripePromise = env.VITE_STRIPE_PUBLISHABLE_KEY ? loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY) : null;

type CheckoutBootstrap = {
  plan: PricingPlanKey;
  enterpriseOptions: EnterpriseOptions;
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [error, setError] = useState("");
  const sessionIdRef = useRef("");
  const [checkoutBootstrap, setCheckoutBootstrap] = useState<CheckoutBootstrap | null>(null);
  const [enterpriseOptions, setEnterpriseOptions] = useState(defaultEnterpriseOptions);

  const plan = (searchParams.get("plan") || "professional") as PricingPlanKey;
  const selectedPlan = pricingPlans.find((item) => item.key === plan) || pricingPlans[1];
  const enterpriseMonthly = calculateEnterpriseMonthlyPrice(enterpriseOptions);

  const checkoutKey = useMemo(
    () => `${selectedPlan.key}:${JSON.stringify(checkoutBootstrap?.enterpriseOptions || enterpriseOptions)}`,
    [enterpriseOptions, checkoutBootstrap?.enterpriseOptions, selectedPlan.key],
  );

  const startEmbeddedCheckout = () => {
    setError("");
    setCheckoutBootstrap({
      plan: selectedPlan.key,
      enterpriseOptions,
    });
  };

  const fetchClientSecret = useCallback(async () => {
    const payload = {
      plan: checkoutBootstrap?.plan || selectedPlan.key,
      ...((checkoutBootstrap?.plan || selectedPlan.key) === "enterprise" ? checkoutBootstrap?.enterpriseOptions || enterpriseOptions : {}),
    };

    const { data } = await api.post<{
      clientSecret?: string;
      sessionId?: string;
      free?: boolean;
    }>("/billing/checkout-session", payload);

    if (data.free || !data.clientSecret || !data.sessionId) {
      navigate(isAuthenticated ? "/workspace" : "/register");
      return "";
    }

    sessionIdRef.current = data.sessionId;
    return data.clientSecret;
  }, [checkoutBootstrap?.enterpriseOptions, checkoutBootstrap?.plan, enterpriseOptions, isAuthenticated, navigate, selectedPlan.key]);

  const handleCheckoutComplete = useCallback(() => {
    if (sessionIdRef.current) {
      navigate(`/checkout/success?session_id=${sessionIdRef.current}`);
    }
  }, [navigate]);

  return (
    <section className="checkout-page">
      <div className="checkout-shell">
        <div className="checkout-summary panel">
          <span className="eyebrow">Billing workspace</span>
          <div className="checkout-heading-block">
            <div>
              <h1>{selectedPlan.name} plan</h1>
              <p>{selectedPlan.description}</p>
            </div>
            <div className="checkout-price-card">
              <small>{selectedPlan.key === "starter" ? "Trial access" : "Monthly billing"}</small>
              <strong>
                {selectedPlan.key === "enterprise"
                  ? `$${enterpriseMonthly}/mo`
                  : selectedPlan.key === "starter"
                    ? selectedPlan.priceLabel
                    : `${selectedPlan.priceLabel}/mo`}
              </strong>
            </div>
          </div>

          <div className="checkout-feature-grid">
            {selectedPlan.points.map((point) => (
              <span key={point} className="checkout-feature-pill">
                {point}
              </span>
            ))}
            <span className="checkout-feature-pill">
              {selectedPlan.key === "starter"
                ? "AI tools locked until upgrade"
                : selectedPlan.key === "professional"
                  ? "AI planner, AI search, and voice tasks included"
                  : "Unlimited AI access across companies and supervisors"}
            </span>
          </div>

          {selectedPlan.key === "enterprise" ? (
            <div className="stack-form checkout-options-form checkout-config-panel">
              <div className="panel-header">
                <h3>Custom plan setup</h3>
                <span className="eyebrow">Live pricing</span>
              </div>
              <label>
                Team size
                <select
                  value={enterpriseOptions.seats}
                  onChange={(event) => setEnterpriseOptions((current) => ({ ...current, seats: Number(event.target.value) }))}
                >
                  <option value="10">10 seats included</option>
                  <option value="25">25 seats</option>
                  <option value="50">50 seats</option>
                </select>
              </label>
              <label>
                Support level
                <select
                  value={enterpriseOptions.supportLevel}
                  onChange={(event) =>
                    setEnterpriseOptions((current) => ({ ...current, supportLevel: event.target.value as EnterpriseOptions["supportLevel"] }))
                  }
                >
                  <option value="standard">Standard support</option>
                  <option value="priority">Priority support</option>
                </select>
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={enterpriseOptions.analyticsPack}
                  onChange={(event) => setEnterpriseOptions((current) => ({ ...current, analyticsPack: event.target.checked }))}
                />
                Advanced analytics pack
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={enterpriseOptions.guidedOnboarding}
                  onChange={(event) => setEnterpriseOptions((current) => ({ ...current, guidedOnboarding: event.target.checked }))}
                />
                Guided onboarding
              </label>
            </div>
          ) : null}

          <div className="checkout-qr-block">
            <span className="eyebrow">Pay on mobile</span>
            <p>Scan to open this checkout on your phone</p>
            <div className="checkout-qr-frame">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&color=0f172a&bgcolor=ffffff&data=${encodeURIComponent(window.location.href)}`}
                alt="QR code for this checkout"
                width={140}
                height={140}
                className="checkout-qr-img"
              />
            </div>
          </div>

          {selectedPlan.key === "starter" ? (
            <button className="primary-button" type="button" onClick={() => navigate(isAuthenticated ? "/workspace" : "/register")}>
              Continue with free trial
            </button>
          ) : !isAuthenticated ? (
            <div className="checkout-auth-prompt">
              <p>Sign in or register first so your paid subscription can be attached to your SprintFlow account.</p>
              <div className="landing-cta-row">
                <Link className="primary-button" to="/login">
                  Sign in
                </Link>
                <Link className="secondary-button" to="/register">
                  Create account
                </Link>
              </div>
            </div>
          ) : !env.VITE_STRIPE_PUBLISHABLE_KEY ? (
            <div className="form-error">Stripe publishable key is missing in `frontend/.env`.</div>
          ) : checkoutBootstrap ? (
            <div className="checkout-embed-panel">
              <div className="checkout-embed-header">
                <div>
                  <span className="eyebrow">Payment</span>
                  <h3>Complete your billing details</h3>
                </div>
              </div>
              <EmbeddedCheckoutProvider
                key={checkoutKey}
                stripe={stripePromise}
                options={{
                  fetchClientSecret,
                  onComplete: handleCheckoutComplete,
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <button className="primary-button" type="button" onClick={startEmbeddedCheckout}>
              Continue to payment
            </button>
          )}

          {error ? <div className="form-error">{error}</div> : null}
        </div>

        <div className="checkout-side panel">
          <span className="eyebrow">Account snapshot</span>
          <h2>{user?.fullName || "SprintFlow customer"}</h2>
          <p>{user?.email || "Billing is linked after sign-in."}</p>
          <div className="checkout-side-card">
            <div>
              <strong>Plan</strong>
              <span>{selectedPlan.name}</span>
            </div>
            <div>
              <strong>Workspace</strong>
              <span>{user?.billingPlan || "STARTER"}</span>
            </div>
            <div>
              <strong>Status</strong>
              <span>{user?.subscriptionStatus || "Not active yet"}</span>
            </div>
          </div>

          <Link className="ghost-button" to="/">
            Back to pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
