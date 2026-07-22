import { z } from "zod";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, "ANTHROPIC_API_KEY is required")
    .refine((key) => key !== "your-api-key-here", {
      message: "Replace the placeholder ANTHROPIC_API_KEY in .env",
    }),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
}

export function hasValidApiKey(): boolean {
  const result = EnvSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
  return result.success;
}

export function getEnvError(): string | null {
  const result = EnvSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
  if (result.success) return null;
  return result.error.errors.map((e) => e.message).join("; ");
}
