"use client";

import { useState, useCallback, useRef } from "react";

const AI_CONFIG_KEY = "skb-ai-config";

interface AIConfig {
  provider: "openai" | "anthropic" | "google";
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  openaiModel: string;
  anthropicModel: string;
  googleModel: string;
}

function loadAIConfig(): AIConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

interface UseAIPageGenerationReturn {
  generate: (prompt: string, context?: string, metadata?: { duration?: string; date?: string }) => void;
  content: string;
  isGenerating: boolean;
  error: string | null;
  cancel: () => void;
  reset: () => void;
}

export function useAIPageGeneration(): UseAIPageGenerationReturn {
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (prompt: string, context?: string, metadata?: { duration?: string; date?: string }) => {
      if (isGenerating) return;

      setContent("");
      setError(null);
      setIsGenerating(true);

      abortRef.current = new AbortController();

      const config = loadAIConfig();
      const provider = config?.provider || "openai";
      const keyMap = {
        openai: config?.openaiKey,
        anthropic: config?.anthropicKey,
        google: config?.googleKey,
      };
      const modelMap = {
        openai: config?.openaiModel || "gpt-4o-mini",
        anthropic: config?.anthropicModel || "claude-sonnet-4-20250514",
        google: config?.googleModel || "gemini-2.0-flash",
      };

      try {
        const response = await fetch("/api/ai/generate-page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            context,
            metadata,
            provider,
            apiKey: keyMap[provider],
            model: modelMap[provider],
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error?.message || `Request failed (${response.status})`
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                setContent(accumulated);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Stream interrupted") {
                // Ignore JSON parse errors for partial chunks
              }
            }
          }
        }

        if (!accumulated.trim()) {
          setError("AI returned empty content. Try rephrasing your prompt.");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Cancelled by user
          return;
        }
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setContent("");
    setError(null);
    setIsGenerating(false);
  }, []);

  return { generate, content, isGenerating, error, cancel, reset };
}
