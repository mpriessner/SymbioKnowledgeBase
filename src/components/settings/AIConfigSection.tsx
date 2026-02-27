"use client";

import { useState, useEffect, useRef } from "react";
import { Key, Eye, EyeOff, Check, AlertCircle, Loader2, ChevronDown, Mic } from "lucide-react";

type TranscriptionProvider = "openai-whisper" | "elevenlabs" | "assemblyai";

interface AIConfig {
  provider: "openai" | "anthropic" | "google";
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  openaiModel: string;
  anthropicModel: string;
  googleModel: string;
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: string;
  transcriptionApiKey?: string;
  useSharedTranscriptionKey: boolean;
}

const DEFAULT_CONFIG: AIConfig = {
  provider: "openai",
  openaiModel: "gpt-5.2",
  anthropicModel: "claude-sonnet-4-5-20250929",
  googleModel: "gemini-3-flash-preview",
  transcriptionProvider: "openai-whisper",
  transcriptionModel: "whisper-1",
  useSharedTranscriptionKey: true,
};

const TRANSCRIPTION_PROVIDERS: { value: TranscriptionProvider; label: string }[] = [
  { value: "openai-whisper", label: "OpenAI Whisper" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "assemblyai", label: "AssemblyAI" },
];

const TRANSCRIPTION_MODELS: Record<TranscriptionProvider, { value: string; label: string }[]> = {
  "openai-whisper": [{ value: "whisper-1", label: "Whisper-1" }],
  elevenlabs: [{ value: "default", label: "Default STT Model" }],
  assemblyai: [
    { value: "best", label: "Best" },
    { value: "nano", label: "Nano" },
  ],
};

const TRANSCRIPTION_PROVIDER_LABELS: Record<TranscriptionProvider, string> = {
  "openai-whisper": "OpenAI Whisper",
  elevenlabs: "ElevenLabs",
  assemblyai: "AssemblyAI",
};

const MODEL_OPTIONS = {
  openai: [
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
    { value: "gpt-5-nano", label: "GPT-5 Nano" },
    { value: "o3", label: "o3" },
    { value: "o3-pro", label: "o3 Pro" },
    { value: "o4-mini", label: "o4-mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  ],
  anthropic: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { value: "claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  ],
  google: [
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { value: "gemini-3-pro", label: "Gemini 3 Pro" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google (Gemini)",
};

function CustomSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-[var(--border-default)]
          bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm
          focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]
          cursor-pointer"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left
                ${option.value === value
                  ? "bg-[var(--accent-bg)] text-[var(--accent-primary)] font-medium"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
            >
              {option.value === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              {option.value !== value && <span className="w-3.5 flex-shrink-0" />}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

function validateKeyFormat(provider: string, key: string): boolean {
  if (!key || key.trim() === "") return false;

  switch (provider) {
    case "openai":
      return key.startsWith("sk-");
    case "anthropic":
      return key.startsWith("sk-ant-");
    case "google":
      return key.length > 20;
    default:
      return false;
  }
}

export function AIConfigSection() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
    google: false,
    transcription: false,
  });
  const [tempKeys, setTempKeys] = useState({
    openai: "",
    anthropic: "",
    google: "",
    transcription: "",
  });
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("skb-ai-config");
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
        setTempKeys({
          openai: parsed.openaiKey || "",
          anthropic: parsed.anthropicKey || "",
          google: parsed.googleKey || "",
          transcription: parsed.transcriptionApiKey || "",
        });
      }
    } catch {
      // If parsing fails, use defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const hasKeyChanges =
      tempKeys.openai !== (config.openaiKey || "") ||
      tempKeys.anthropic !== (config.anthropicKey || "") ||
      tempKeys.google !== (config.googleKey || "");

    const hasModelChanges =
      tempKeys.openai !== "" && config.openaiModel !== DEFAULT_CONFIG.openaiModel ||
      tempKeys.anthropic !== "" && config.anthropicModel !== DEFAULT_CONFIG.anthropicModel ||
      tempKeys.google !== "" && config.googleModel !== DEFAULT_CONFIG.googleModel;

    setHasChanges(hasKeyChanges || hasModelChanges);
  }, [tempKeys, config]);

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    setTestResult(null);

    try {
      const newConfig: AIConfig = {
        ...config,
        openaiKey: tempKeys.openai || undefined,
        anthropicKey: tempKeys.anthropic || undefined,
        googleKey: tempKeys.google || undefined,
        transcriptionApiKey: config.useSharedTranscriptionKey ? undefined : (tempKeys.transcription || undefined),
      };

      localStorage.setItem("skb-ai-config", JSON.stringify(newConfig));
      setConfig(newConfig);
      setHasChanges(false);

      setTimeout(() => {
        setTestResult({
          provider: "all",
          success: true,
          message: "Configuration saved successfully",
        });
      }, 100);

      setTimeout(() => setTestResult(null), 3000);
    } catch {
      setTestResult({
        provider: "all",
        success: false,
        message: "Failed to save configuration",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (provider: "openai" | "anthropic" | "google") => {
    setIsTesting(true);
    setTestResult(null);

    const key = tempKeys[provider];

    setTimeout(() => {
      const isValid = validateKeyFormat(provider, key);

      setTestResult({
        provider,
        success: isValid,
        message: isValid
          ? `${PROVIDER_LABELS[provider]} API key format is valid`
          : `Invalid ${PROVIDER_LABELS[provider]} API key format`,
      });

      setIsTesting(false);
      setTimeout(() => setTestResult(null), 3000);
    }, 500);
  };

  const toggleShowKey = (provider: "openai" | "anthropic" | "google") => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleKeyChange = (provider: "openai" | "anthropic" | "google", value: string) => {
    setTempKeys((prev) => ({ ...prev, [provider]: value }));
  };

  const handleModelChange = (provider: "openai" | "anthropic" | "google", value: string) => {
    setConfig((prev) => ({ ...prev, [`${provider}Model`]: value }));
  };

  const handleProviderChange = (provider: "openai" | "anthropic" | "google") => {
    setConfig((prev) => ({ ...prev, provider }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          AI Configuration
        </h2>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
          <div className="h-32 bg-[var(--bg-tertiary)] rounded" />
        </div>
      </div>
    );
  }

  const isProviderConfigured = (provider: "openai" | "anthropic" | "google") => {
    return tempKeys[provider] && tempKeys[provider].length > 0;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          AI Configuration
        </h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Configure your AI provider API keys and preferences
        </p>
      </div>

      {testResult && (
        <div
          className={`rounded-md border px-4 py-3 ${
            testResult.success
              ? "border-green-500/30 bg-green-500/5"
              : "border-red-500/30 bg-red-500/5"
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <p className={`text-sm ${testResult.success ? "text-green-400" : "text-red-400"}`}>
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Default Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
          Default AI Provider
        </label>
        <div className="flex gap-2">
          {(["openai", "anthropic", "google"] as const).map((provider) => (
            <button
              key={provider}
              onClick={() => handleProviderChange(provider)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                config.provider === provider
                  ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]"
              }`}
            >
              {PROVIDER_LABELS[provider]}
            </button>
          ))}
        </div>
      </div>

      {/* Provider Configuration Cards */}
      <div className="space-y-4">
        {(["openai", "anthropic", "google"] as const).map((provider) => (
          <div
            key={provider}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-[var(--text-secondary)]" />
                <h3 className="font-medium text-[var(--text-primary)]">
                  {PROVIDER_LABELS[provider]}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {isProviderConfigured(provider) ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium">
                    <Check className="h-3 w-3" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-xs font-medium">
                    <AlertCircle className="h-3 w-3" />
                    Not configured
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {/* API Key Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  API Key
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showKeys[provider] ? "text" : "password"}
                      value={tempKeys[provider]}
                      onChange={(e) => handleKeyChange(provider, e.target.value)}
                      placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
                      className="w-full px-3 py-2 pr-10 rounded-md border border-[var(--border-default)]
                        bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm
                        focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]
                        placeholder:text-[var(--text-tertiary)] font-mono"
                    />
                    <button
                      onClick={() => toggleShowKey(provider)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)]
                        hover:text-[var(--text-primary)] transition-colors"
                      title={showKeys[provider] ? "Hide key" : "Show key"}
                    >
                      {showKeys[provider] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => handleTest(provider)}
                    disabled={isTesting || !tempKeys[provider]}
                    className="px-4 py-2 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)]
                      text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--border-default)]"
                  >
                    {isTesting && testResult?.provider === provider ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </button>
                </div>
                {isProviderConfigured(provider) && !showKeys[provider] && (
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Key stored: {maskApiKey(tempKeys[provider])}
                  </p>
                )}
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Default Model
                </label>
                <CustomSelect
                  value={config[`${provider}Model`]}
                  options={MODEL_OPTIONS[provider]}
                  onChange={(val) => handleModelChange(provider, val)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transcription Settings */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mic className="h-5 w-5 text-[var(--text-secondary)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Transcription
            </h3>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">
            Configure the provider used for audio transcription in Meeting Notes
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-4">
          {/* Transcription Provider */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Transcription Provider
            </label>
            <CustomSelect
              value={config.transcriptionProvider}
              options={TRANSCRIPTION_PROVIDERS}
              onChange={(val) =>
                setConfig((prev) => ({
                  ...prev,
                  transcriptionProvider: val as TranscriptionProvider,
                  transcriptionModel: TRANSCRIPTION_MODELS[val as TranscriptionProvider][0].value,
                }))
              }
            />
          </div>

          {/* Transcription Model */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Transcription Model
            </label>
            <CustomSelect
              value={config.transcriptionModel}
              options={TRANSCRIPTION_MODELS[config.transcriptionProvider]}
              onChange={(val) =>
                setConfig((prev) => ({ ...prev, transcriptionModel: val }))
              }
            />
          </div>

          {/* API Key — shared or separate */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              API Key
            </label>
            {config.transcriptionProvider === "openai-whisper" ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.useSharedTranscriptionKey}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, useSharedTranscriptionKey: e.target.checked }))
                    }
                    className="rounded border-[var(--border-default)]"
                  />
                  Use same API key as OpenAI LLM provider
                </label>
                {!config.useSharedTranscriptionKey && (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showKeys.transcription ? "text" : "password"}
                        value={tempKeys.transcription}
                        onChange={(e) =>
                          setTempKeys((prev) => ({ ...prev, transcription: e.target.value }))
                        }
                        placeholder="Enter transcription API key"
                        className="w-full px-3 py-2 pr-10 rounded-md border border-[var(--border-default)]
                          bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm
                          focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]
                          placeholder:text-[var(--text-tertiary)] font-mono"
                      />
                      <button
                        onClick={() => setShowKeys((prev) => ({ ...prev, transcription: !prev.transcription }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)]
                          hover:text-[var(--text-primary)] transition-colors"
                      >
                        {showKeys.transcription ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKeys.transcription ? "text" : "password"}
                    value={tempKeys.transcription}
                    onChange={(e) =>
                      setTempKeys((prev) => ({ ...prev, transcription: e.target.value }))
                    }
                    placeholder={`Enter your ${TRANSCRIPTION_PROVIDER_LABELS[config.transcriptionProvider]} API key`}
                    className="w-full px-3 py-2 pr-10 rounded-md border border-[var(--border-default)]
                      bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]
                      placeholder:text-[var(--text-tertiary)] font-mono"
                  />
                  <button
                    onClick={() => setShowKeys((prev) => ({ ...prev, transcription: !prev.transcription }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)]
                      hover:text-[var(--text-primary)] transition-colors"
                  >
                    {showKeys.transcription ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">Security Notice</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              API keys are stored locally in your browser&apos;s localStorage. They are never sent to our
              servers. Keep your keys secure and do not share them with others.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 py-2
            text-sm font-medium text-white hover:opacity-90 transition-opacity
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
}
