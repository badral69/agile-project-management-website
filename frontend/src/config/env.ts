import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z.string().min(1).default("/api"),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().default(""),
  VITE_GOOGLE_CLIENT_ID: z.string().default(""),
});

const parsed = envSchema.safeParse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
}

export const env = parsed.data;
