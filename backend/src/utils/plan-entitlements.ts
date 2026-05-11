import { BillingPlan, Role } from "@prisma/client";

export type AiEntitlements = {
  aiSearch: boolean;
  aiPlanner: boolean;
  voiceTasks: boolean;
  usageLabel: string;
};

export const getAiEntitlements = (plan: BillingPlan, role?: Role): AiEntitlements => {
  if (role === Role.ADMIN) {
    return {
      aiSearch: true,
      aiPlanner: true,
      voiceTasks: true,
      usageLabel: "System admin access includes full AI planning and voice task tools",
    };
  }

  if (plan === BillingPlan.ENTERPRISE) {
    return {
      aiSearch: true,
      aiPlanner: true,
      voiceTasks: true,
      usageLabel: "Unlimited AI planning and task assistance",
    };
  }

  if (plan === BillingPlan.PROFESSIONAL) {
    return {
      aiSearch: true,
      aiPlanner: true,
      voiceTasks: true,
      usageLabel: "AI planning and voice task capture included",
    };
  }

  return {
    aiSearch: false,
    aiPlanner: false,
    voiceTasks: false,
    usageLabel: "Upgrade to Professional to unlock AI features",
  };
};

export const hasPlannerAccess = (plan: BillingPlan, role?: Role) => {
  const entitlements = getAiEntitlements(plan, role);
  return entitlements.aiPlanner;
};
