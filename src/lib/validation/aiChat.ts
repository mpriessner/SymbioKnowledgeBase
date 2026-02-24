import { z } from "zod";

/**
 * Validation schema for AI chat messages.
 */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Message content cannot be empty"),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Validation schema for AI chat request body.
 */
export const aiChatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, "At least one message is required")
    .max(50, "Too many messages in conversation"),
  context: z.string().max(50000, "Context too large").optional(),
  model: z.string().max(100).optional(),
});

export type AIChatRequest = z.infer<typeof aiChatRequestSchema>;

/**
 * Supported models for AI chat.
 */
export const SUPPORTED_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
] as const;

export const DEFAULT_MODEL = "gpt-4o-mini";
