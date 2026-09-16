import { env } from "../config/env";

const demoEmails = new Set([
  "admin@agilepm.local",
  "moderator@agilepm.local",
  "user@agilepm.local",
]);

// Keep development fixtures usable, but never allow shared accounts in production.
export const isDisabledDemoAccount = (email: string): boolean =>
  env.NODE_ENV === "production" && demoEmails.has(email.trim().toLowerCase());
