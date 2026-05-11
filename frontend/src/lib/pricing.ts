export type PricingPlanKey = "starter" | "professional" | "enterprise";
export type SupportLevel = "standard" | "priority";

export type EnterpriseOptions = {
  seats: number;
  supportLevel: SupportLevel;
  analyticsPack: boolean;
  guidedOnboarding: boolean;
};

export const defaultEnterpriseOptions: EnterpriseOptions = {
  seats: 10,
  supportLevel: "standard",
  analyticsPack: false,
  guidedOnboarding: false,
};

export const pricingPlans = [
  {
    key: "starter" as PricingPlanKey,
    name: "Starter",
    priceLabel: "Free trial",
    description: "For small student teams and early-stage project pilots that want to test the full workspace.",
    points: ["14-day free trial", "Up to 5 active projects", "Projects, tasks, and team workspace", "No AI tools included"],
    cta: "Start free trial",
  },
  {
    key: "professional" as PricingPlanKey,
    name: "Professional",
    priceLabel: "$19",
    description: "For delivery teams that need stronger planning and collaboration.",
    points: ["Unlimited projects", "AI sprint planner and voice task capture", "Supervisor and worker company structure", "Team dashboards and reporting"],
    cta: "Start Professional",
  },
  {
    key: "enterprise" as PricingPlanKey,
    name: "Custom",
    priceLabel: "From $99",
    description: "Build a tailored plan with seats, support, analytics, and onboarding options.",
    points: ["Flexible seat bundles", "Unlimited AI usage across the workspace", "Multi-company oversight for admins", "Priority support, analytics, and onboarding"],
    cta: "Customize Plan",
  },
];

export const calculateEnterpriseMonthlyPrice = (options: EnterpriseOptions) => {
  let total = 99;

  if (options.seats >= 50) {
    total += 349;
  } else if (options.seats >= 25) {
    total += 149;
  }

  if (options.supportLevel === "priority") {
    total += 79;
  }

  if (options.analyticsPack) {
    total += 59;
  }

  if (options.guidedOnboarding) {
    total += 99;
  }

  return total;
};
