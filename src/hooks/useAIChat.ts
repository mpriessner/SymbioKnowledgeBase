"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, SendMessageOptions, ChatState } from "@/types/ai";

const STORAGE_KEY = "skb-ai-chat-history";
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadMessagesFromStorage(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessagesToStorage(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full or unavailable
  }
}

export function useAIChat() {
  const [state, setState] = useState<ChatState>(() => ({
    messages: loadMessagesFromStorage(),
    isLoading: false,
    error: null,
  }));

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!content.trim() || state.isLoading) return;

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      // Add user message and placeholder for assistant
      setState((prev) => {
        const newMessages = [...prev.messages, userMessage, assistantMessage];
        saveMessagesToStorage(newMessages);
        return {
          ...prev,
          messages: newMessages,
          isLoading: true,
          error: null,
        };
      });

      abortControllerRef.current = new AbortController();

      try {
        // Prepare messages for API (exclude isStreaming flag)
        const apiMessages = [...state.messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Load AI config for provider/key/model
        const aiConfig = loadAIConfig();
        const provider = aiConfig?.provider || "openai";
        const apiKeyMap = {
          openai: aiConfig?.openaiKey,
          anthropic: aiConfig?.anthropicKey,
          google: aiConfig?.googleKey,
        };
        const modelMap = {
          openai: aiConfig?.openaiModel || "gpt-4o-mini",
          anthropic: aiConfig?.anthropicModel || "claude-sonnet-4-20250514",
          google: aiConfig?.googleModel || "gemini-2.0-flash",
        };

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: apiMessages,
            context: options?.pageContext || options?.selectedText || undefined,
            model: modelMap[provider],
            provider,
            apiKey: apiKeyMap[provider],
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            errorData.error?.message ||
            errorData.error ||
            `Request failed with status ${response.status}`;
          throw new Error(
            typeof errorMsg === "string" ? errorMsg : `Request failed with status ${response.status}`
          );
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedContent += parsed.content;

                  // Update the assistant message with accumulated content
                  setState((prev) => {
                    const messages = [...prev.messages];
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage?.role === "assistant") {
                      messages[messages.length - 1] = {
                        ...lastMessage,
                        content: accumulatedContent,
                      };
                    }
                    return { ...prev, messages };
                  });
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        // Finalize the message
        setState((prev) => {
          const messages = [...prev.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "assistant") {
            messages[messages.length - 1] = {
              ...lastMessage,
              content: accumulatedContent || "Sorry, I couldn't generate a response.",
              isStreaming: false,
              timestamp: Date.now(),
            };
          }
          saveMessagesToStorage(messages);
          return {
            ...prev,
            messages,
            isLoading: false,
          };
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was cancelled, don't update state
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "An unexpected error occurred";

        setState((prev) => {
          // Remove the placeholder assistant message on error
          const messages = prev.messages.slice(0, -1);
          saveMessagesToStorage(messages);
          return {
            ...prev,
            messages,
            isLoading: false,
            error: errorMessage,
          };
        });
      }
    },
    [state.isLoading, state.messages]
  );

  const clearHistory = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      messages: [],
      isLoading: false,
      error: null,
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    clearHistory,
    cancelRequest,
    clearError,
  };
}
