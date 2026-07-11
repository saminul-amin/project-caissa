import { z } from "zod";

export const serviceEnvironmentSchema = z.enum(["local", "test", "preview", "production"]);

export const healthResponseSchema = z
  .object({
    serviceName: z.string().min(1),
    serviceVersion: z.string().min(1),
    status: z.literal("ok"),
    environment: serviceEnvironmentSchema,
  })
  .strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ServiceEnvironment = z.infer<typeof serviceEnvironmentSchema>;
