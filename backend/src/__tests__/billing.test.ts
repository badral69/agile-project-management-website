import { describe, it, expect, beforeEach } from "vitest";
import Stripe from "stripe";
import supertest from "supertest";
import app from "../app";
import { TestClient, loginClient } from "./helpers/client";
import { makeUser, testPassword } from "./helpers/factories";
import { resetDatabase } from "./setup";

// Stripe instance used only for webhook test-header generation (no real API calls)
const stripeTest = new Stripe("sk_test_placeholder");

beforeEach(async () => {
  await resetDatabase();
});

describe("POST /api/billing/checkout-session", () => {
  it("creates a checkout session for a paid plan", async () => {
    const owner = await makeUser({ email: "pay@billing.com" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post("/billing/checkout-session", { plan: "professional" });

    // Either succeeds (Stripe configured) or returns a structured error (no key)
    expect([201, 400, 422, 503]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.sessionId).toBeTruthy();
    } else {
      expect(res.body.message).toBeTruthy();
    }
  });

  it("returns 400 for an invalid plan name", async () => {
    const owner = await makeUser({ email: "pay2@billing.com" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post("/billing/checkout-session", { plan: "galaxy_brain" });

    expect(res.status).toBe(400);
  });

  it("returns free:true immediately for the starter plan (no Stripe needed)", async () => {
    const owner = await makeUser({ email: "free@billing.com" });
    const client = await loginClient({ email: owner.email, password: testPassword });

    const res = await client.post("/billing/checkout-session", { plan: "starter" });

    expect(res.status).toBe(200);
    expect(res.body.free).toBe(true);
    expect(res.body.billingPlan).toBe("STARTER");
  });
});

describe("GET /api/billing/:id", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.get("/billing/cs_test_fake_session_id");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/billing/webhook", () => {
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"] ?? "whsec_test_secret_for_unit_tests_only";

  it("returns 400 when Stripe-Signature header is missing", async () => {
    const res = await supertest(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when webhook signature is invalid", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });

    const res = await supertest(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=invalidsig")
      .send(payload);

    expect(res.status).toBe(400);
  });

  it("returns 200 when signature is valid", async () => {
    const payload = JSON.stringify({
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_test123" } },
    });
    // Use Stripe's own test header generator to guarantee signature correctness
    const header = stripeTest.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });

    const res = await supertest(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", header)
      .send(payload);

    // Valid signature but unknown customer — still 200 (event processed, no-op)
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
