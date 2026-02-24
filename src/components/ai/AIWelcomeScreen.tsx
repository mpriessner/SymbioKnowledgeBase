"use client";

import { Sparkles, FileText, ListTodo, FileSearch, Calendar, type LucideIcon } from "lucide-react";

interface Suggestion {
  icon: LucideIcon;
  text: string;
  prompt: string;
}

const suggestions: Suggestion[] = [
  { icon: FileText, text: "Explain this page", prompt: "Can you explain what this page is about?" },
  { icon: ListTodo, text: "Create a task list", prompt: "Help me create a task list for this project" },
  { icon: FileSearch, text: "Summarize content", prompt: "Summarize the key points on this page" },
  { icon: Calendar, text: "Write meeting notes", prompt: "Help me write meeting notes" },
];

interface AIWelcomeScreenProps {
  onSelectSuggestion: (prompt: string) => void;
}

/**
 * Welcome screen shown when chat has no messages.
 * Displays AI avatar, greeting, and prompt suggestion cards.
 */
export function AIWelcomeScreen({ onSelectSuggestion }: AIWelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-6">
      {/* AI Avatar */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white mb-4">
        <Sparkles className="h-7 w-7" />
      </div>

      {/* Heading */}
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
        Symbio AI Assistant
      </h2>

      {/* Subtext */}
      <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
        Here are a few things I can do, or ask me anything!
      </p>

      {/* Suggestion Cards - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-[320px]">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              onClick={() => onSelectSuggestion(suggestion.prompt)}
              className="
                flex flex-col items-center gap-2 p-3
                rounded-lg border border-[var(--border-default)]
                bg-[var(--bg-secondary)]
                text-[var(--text-secondary)]
                hover:bg-[var(--bg-tertiary)]
                hover:text-[var(--text-primary)]
                hover:border-[var(--border-hover)]
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
              "
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium text-center leading-tight">
                {suggestion.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
