/**
 * AI Chat Types
 */

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

export interface PageContext {
  pageId?: string;
  pageTitle?: string;
  pageContent?: string;
  pathname?: string;
}

export interface SendMessageOptions {
  pageContext?: string;
  selectedText?: string;
  context?: PageContext;
}

export interface ChatApiRequest {
  messages: Array<{
    role: MessageRole;
    content: string;
  }>;
  context?: {
    pageContent?: string;
    selectedText?: string;
  };
  model?: string;
  stream?: boolean;
}

export interface ChatApiResponse {
  id: string;
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
