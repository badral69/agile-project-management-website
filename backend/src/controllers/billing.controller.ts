import { BillingPlan } from "@prisma/client";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

const billingContextSchema = z.union([
  z.object({ tier: z.enum(["starter", "professional"]) }),
  z.object({
    seats: z.number().int().positive(),
    supportLevel: z.string(),
    analyticsPack: z.boolean(),
    guidedOnboarding: z.boolean(),
  }),
]);

type CheckoutPlan = "starter" | "professional" | "enterprise";

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    })
  : null;

const requireStripe = () => {
  if (!stripe) {
    throw new AppError("Stripe is not configured yet. Add STRIPE_SECRET_KEY to backend/.env.", StatusCodes.SERVICE_UNAVAILABLE);
  }

  return stripe;
};

type CheckoutSession = Awaited<ReturnType<ReturnType<typeof requireStripe>["checkout"]["sessions"]["retrieve"]>>;

const resolveClientOrigin = (request: Request) => {
  const origin = String(request.headers.origin || "").trim();
  if (origin && env.allowedOrigins.includes(origin)) {
    return origin;
  }

  return env.allowedOrigins[0] || env.CLIENT_URL;
};

const parseEnterprisePrice = (payload: Request["body"]) => {
  const seats = Number(payload.seats || 10);
  const supportLevel = String(payload.supportLevel || "standard");
  const analyticsPack = Boolean(payload.analyticsPack);
  const guidedOnboarding = Boolean(payload.guidedOnboarding);

  let amount = 9900;

  if (seats >= 50) {
    amount += 34900;
  } else if (seats >= 25) {
    amount += 14900;
  }

  if (supportLevel === "priority") {
    amount += 7900;
  }

  if (analyticsPack) {
    amount += 5900;
  }

  if (guidedOnboarding) {
    amount += 9900;
  }

  return {
    amount,
    context: {
      seats,
      supportLevel,
      analyticsPack,
      guidedOnboarding,
    },
  };
};

const getPlanConfig = (plan: CheckoutPlan, payload: Request["body"]) => {
  if (plan === "professional") {
    return {
      billingPlan: BillingPlan.PROFESSIONAL,
      name: "SprintFlow Professional",
      description: "Unlimited projects, supervisor and worker company structure, and AI planning tools.",
      amount: 1900,
      context: {
        tier: "professional",
        aiAccess: "included",
      },
    };
  }

  if (plan === "enterprise") {
    const pricing = parseEnterprisePrice(payload);
    return {
      billingPlan: BillingPlan.ENTERPRISE,
      name: "SprintFlow Enterprise",
      description: "Custom enterprise plan with unlimited AI, multi-company oversight, and scalable delivery support.",
      amount: pricing.amount,
      context: pricing.context,
    };
  }

  return {
    billingPlan: BillingPlan.STARTER,
    name: "SprintFlow Starter",
    description: "Free trial for small student teams and pilots before AI and company controls are enabled.",
    amount: 0,
    context: {
      tier: "starter",
      aiAccess: "locked",
    },
  };
};

const syncCheckoutToUser = async (session: CheckoutSession) => {
  if (session.status !== "complete") {
    return null;
  }

  const userId = session.metadata?.userId;
  if (!userId) {
    return null;
  }

  const selectedPlan = session.metadata?.billingPlan as BillingPlan | undefined;
  let subscriptionStatus: string | null = session.payment_status || null;

  if (typeof session.subscription === "string") {
    const subscription = await requireStripe().subscriptions.retrieve(session.subscription);
    subscriptionStatus = subscription.status;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      billingPlan: selectedPlan || BillingPlan.STARTER,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      subscriptionStatus,
      billingContext: (() => {
        if (!session.metadata?.billingContext) return undefined;
        try {
          const parsed = JSON.parse(session.metadata.billingContext);
          return billingContextSchema.parse(parsed);
        } catch {
          return undefined;
        }
      })(),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      billingPlan: true,
      subscriptionStatus: true,
      createdAt: true,
    },
  });

  return user;
};

export const createCheckoutSession = asyncHandler(async (request: Request, response: Response) => {
  const plan = String(request.body.plan || "").trim() as CheckoutPlan;
  if (!["starter", "professional", "enterprise"].includes(plan)) {
    throw new AppError("Please choose a valid pricing plan.", StatusCodes.BAD_REQUEST);
  }

  const planConfig = getPlanConfig(plan, request.body);
  if (planConfig.amount <= 0) {
    response.json({
      free: true,
      billingPlan: planConfig.billingPlan,
      amount: 0,
      summary: planConfig,
    });
    return;
  }

  const stripeClient = requireStripe();
  const origin = resolveClientOrigin(request);
  const currentUser = request.user
    ? await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { id: true, email: true, stripeCustomerId: true },
      })
    : null;

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded_page",
    return_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    customer: currentUser?.stripeCustomerId || undefined,
    customer_email: currentUser?.stripeCustomerId ? undefined : currentUser?.email || request.user?.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: planConfig.amount,
          product_data: {
            name: planConfig.name,
            description: planConfig.description,
          },
        },
      },
    ],
    metadata: {
      billingPlan: planConfig.billingPlan,
      billingContext: JSON.stringify(planConfig.context),
      userId: currentUser?.id || "",
    },
  });

  response.status(StatusCodes.CREATED).json({
    sessionId: session.id,
    clientSecret: session.client_secret,
    amount: planConfig.amount,
    billingPlan: planConfig.billingPlan,
    summary: planConfig,
  });
});

export const getCheckoutSession = asyncHandler(async (request: Request, response: Response) => {
  const sessionId = String(request.params.id);
  const session = await requireStripe().checkout.sessions.retrieve(sessionId);
  const syncedUser = await syncCheckoutToUser(session);

  response.json({
    session: {
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email,
      amountTotal: session.amount_total,
      currency: session.currency,
      billingPlan: session.metadata?.billingPlan || BillingPlan.STARTER,
    },
    user: syncedUser,
  });
});
