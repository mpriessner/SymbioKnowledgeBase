import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    if (!checkRateLimit(ctx.userId)) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", undefined, 429);
    }

    // Get OpenAI API key (Whisper is OpenAI-only)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return errorResponse(
        "CONFIG_ERROR",
        "Voice transcription requires an OpenAI API key. Configure in Settings > AI.",
        undefined,
        503
      );
    }

    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof Blob)) {
        return errorResponse("VALIDATION_ERROR", "No audio file provided", undefined, 400);
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Recording too long for transcription. Try recording in shorter segments.",
          undefined,
          400
        );
      }

      // Validate minimum size (~1 second of audio)
      if (file.size < 1000) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Recording too short. Please record at least a few seconds.",
          undefined,
          400
        );
      }

      // Forward to OpenAI Whisper API
      const whisperForm = new FormData();
      whisperForm.append("file", file, "recording.webm");
      whisperForm.append("model", "whisper-1");
      whisperForm.append("response_format", "text");

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: whisperForm,
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("[Transcribe] Whisper error:", response.status, errText);
        return errorResponse(
          "AI_ERROR",
          "Transcription failed. Check your API key or try again.",
          undefined,
          502
        );
      }

      const text = await response.text();

      if (!text.trim()) {
        return errorResponse(
          "AI_ERROR",
          "No speech detected in the recording. Try speaking more clearly.",
          undefined,
          422
        );
      }

      return successResponse({ text: text.trim() });
    } catch (error) {
      console.error("[Transcribe] Error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to process audio",
        undefined,
        500
      );
    }
  }
);
