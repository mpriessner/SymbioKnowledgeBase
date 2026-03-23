import type {
  ActualProcedure,
  ProcedureStep,
  PracticalNotesResult,
  PracticalNoteEntry,
  FormattedDeviation,
  NoteImportance,
} from "./types";

/**
 * Parse raw JSONB data into a typed ActualProcedure.
 * Handles stringified JSON, arrays, objects, and malformed data gracefully.
 */
export function parseRawProcedureData(jsonbData: unknown): ActualProcedure | null {
  if (jsonbData === null || jsonbData === undefined) {
    return null;
  }

  if (typeof jsonbData === "string") {
    try {
      const parsed: unknown = JSON.parse(jsonbData);
      return parseRawProcedureData(parsed);
    } catch {
      return null;
    }
  }

  if (Array.isArray(jsonbData)) {
    return { steps: normalizeSteps(jsonbData) };
  }

  if (typeof jsonbData === "object") {
    const data = jsonbData as Record<string, unknown>;
    const result: ActualProcedure = {};

    if (typeof data.exptube_entry_id === "string") {
      result.exptube_entry_id = data.exptube_entry_id;
    }
    if (typeof data.video_url === "string") {
      result.video_url = data.video_url;
    }
    if (typeof data.researcher_name === "string") {
      result.researcher_name = data.researcher_name;
    }
    if (typeof data.overall_notes === "string") {
      result.overall_notes = data.overall_notes;
    }
    if (Array.isArray(data.tips)) {
      result.tips = data.tips.filter(
        (tip): tip is string => typeof tip === "string" && tip.trim().length > 0
      );
    }
    if (Array.isArray(data.steps)) {
      result.steps = normalizeSteps(data.steps);
    }

    return result;
  }

  return null;
}

/**
 * Normalize an array of raw step objects into typed ProcedureSteps.
 * Skips entries that are not objects or have no usable data.
 */
function normalizeSteps(rawSteps: unknown[]): ProcedureStep[] {
  const steps: ProcedureStep[] = [];

  for (const raw of rawSteps) {
    if (!raw || typeof raw !== "object") continue;

    const s = raw as Record<string, unknown>;
    const step: ProcedureStep = {
      step_number: typeof s.step_number === "number" ? s.step_number : steps.length + 1,
    };

    if (typeof s.planned_action === "string") step.planned_action = s.planned_action.trim();
    if (typeof s.actual_action === "string") step.actual_action = s.actual_action.trim();
    if (typeof s.timestamp === "string") step.timestamp = s.timestamp.trim();
    if (typeof s.deviation === "string") step.deviation = s.deviation.trim();
    if (typeof s.observation === "string") step.observation = s.observation.trim();
    if (typeof s.duration_seconds === "number") step.duration_seconds = s.duration_seconds;
    if (typeof s.expected_duration_seconds === "number") step.expected_duration_seconds = s.expected_duration_seconds;
    if (typeof s.is_safety_critical === "boolean") step.is_safety_critical = s.is_safety_critical;
    if (typeof s.deviation_severity === "string" && isValidSeverity(s.deviation_severity)) {
      step.deviation_severity = s.deviation_severity;
    }

    steps.push(step);
  }

  return steps;
}

function isValidSeverity(value: string): value is "minor" | "moderate" | "critical" {
  return value === "minor" || value === "moderate" || value === "critical";
}

/**
 * Determine importance of a note based on step properties.
 */
function rateImportance(step: ProcedureStep): NoteImportance {
  if (step.is_safety_critical) return "critical";
  if (step.deviation_severity === "critical") return "critical";
  if (step.deviation_severity === "moderate") return "important";

  const deviationText = (step.deviation ?? "").toLowerCase();
  const observationText = (step.observation ?? "").toLowerCase();
  const combined = deviationText + " " + observationText;

  const criticalKeywords = ["safety", "hazard", "exotherm", "explosion", "toxic", "fire", "burn", "spill", "fume"];
  if (criticalKeywords.some((kw) => combined.includes(kw))) return "critical";

  const importantKeywords = ["yield", "loss", "failed", "decomposed", "precipitated", "color change", "unexpected"];
  if (importantKeywords.some((kw) => combined.includes(kw))) return "important";

  return "informational";
}

/**
 * Extract deviations from steps that have deviation fields.
 */
function extractDeviations(steps: ProcedureStep[]): FormattedDeviation[] {
  const deviations: FormattedDeviation[] = [];

  for (const step of steps) {
    if (!step.deviation && !step.observation) continue;

    const dev: FormattedDeviation = {
      stepNumber: step.step_number,
      timestamp: step.timestamp,
      deviation: "",
      reason: typeof step.deviation === "string" ? step.deviation : undefined,
      observation: typeof step.observation === "string" ? step.observation : undefined,
    };

    if (step.actual_action && step.planned_action) {
      dev.deviation = `${step.actual_action} (planned: ${step.planned_action})`;
    } else if (step.actual_action) {
      dev.deviation = step.actual_action;
    } else if (step.deviation) {
      dev.deviation = step.deviation;
    }

    if (dev.deviation || dev.reason || dev.observation) {
      deviations.push(dev);
    }
  }

  return deviations;
}

/**
 * Extract "what worked" notes from successful steps with positive observations.
 */
function extractWhatWorked(steps: ProcedureStep[], attribution?: string): PracticalNoteEntry[] {
  const notes: PracticalNoteEntry[] = [];

  for (const step of steps) {
    if (!step.observation) continue;
    if (step.deviation_severity === "critical" || step.deviation_severity === "moderate") continue;

    const obsLower = step.observation.toLowerCase();
    const positiveIndicators = [
      "complete", "clean", "quantitative", "success", "dissolved",
      "clear solution", "white solid", "pure", "excellent", "good",
      "smooth", "no side product", "high purity",
    ];

    if (positiveIndicators.some((ind) => obsLower.includes(ind))) {
      const prefix = step.actual_action
        ? `Step ${step.step_number} (${step.actual_action})`
        : `Step ${step.step_number}`;
      notes.push({
        text: `${prefix}: ${step.observation}`,
        importance: "informational",
        sourceStep: step.step_number,
        attribution,
      });
    }
  }

  return notes;
}

/**
 * Extract challenges from steps with deviations marked as problems.
 */
function extractChallenges(steps: ProcedureStep[], attribution?: string): PracticalNoteEntry[] {
  const notes: PracticalNoteEntry[] = [];

  for (const step of steps) {
    if (!step.deviation) continue;

    const devLower = step.deviation.toLowerCase();
    const challengeIndicators = [
      "failed", "problem", "difficult", "slow", "incomplete",
      "decomposed", "loss", "unexpected", "clogged", "precipitated",
      "stuck", "low yield", "side product", "impure",
    ];

    const isExplicitProblem = step.deviation_severity === "moderate" || step.deviation_severity === "critical";

    if (isExplicitProblem || challengeIndicators.some((ind) => devLower.includes(ind))) {
      const importance = rateImportance(step);
      notes.push({
        text: `Step ${step.step_number}: ${step.deviation}${step.observation ? ` — ${step.observation}` : ""}`,
        importance,
        sourceStep: step.step_number,
        attribution,
      });
    }
  }

  return notes;
}

/**
 * Extract timing insights from steps with significant duration differences.
 */
function extractTimingTips(steps: ProcedureStep[], attribution?: string): PracticalNoteEntry[] {
  const notes: PracticalNoteEntry[] = [];

  for (const step of steps) {
    if (step.duration_seconds === undefined || step.expected_duration_seconds === undefined) continue;
    if (step.expected_duration_seconds === 0) continue;

    const ratio = step.duration_seconds / step.expected_duration_seconds;
    const diffMinutes = Math.abs(step.duration_seconds - step.expected_duration_seconds) / 60;

    if (diffMinutes < 1) continue;

    if (ratio >= 1.5) {
      const actualMin = Math.round(step.duration_seconds / 60);
      const expectedMin = Math.round(step.expected_duration_seconds / 60);
      const action = step.actual_action ?? step.planned_action ?? `Step ${step.step_number}`;
      notes.push({
        text: `${action} took ${actualMin} min instead of expected ${expectedMin} min (${Math.round((ratio - 1) * 100)}% longer)`,
        importance: ratio >= 3 ? "important" : "informational",
        sourceStep: step.step_number,
        attribution,
      });
    } else if (ratio <= 0.5) {
      const actualMin = Math.round(step.duration_seconds / 60);
      const expectedMin = Math.round(step.expected_duration_seconds / 60);
      const action = step.actual_action ?? step.planned_action ?? `Step ${step.step_number}`;
      notes.push({
        text: `${action} completed faster than expected: ${actualMin} min vs ${expectedMin} min expected`,
        importance: "informational",
        sourceStep: step.step_number,
        attribution,
      });
    }
  }

  return notes;
}

/**
 * Extract safety-related notes from steps flagged as safety-critical.
 */
function extractSafetyNotes(steps: ProcedureStep[], attribution?: string): PracticalNoteEntry[] {
  const notes: PracticalNoteEntry[] = [];

  for (const step of steps) {
    if (!step.is_safety_critical && rateImportance(step) !== "critical") continue;

    const parts: string[] = [];
    if (step.actual_action) parts.push(step.actual_action);
    if (step.deviation) parts.push(step.deviation);
    if (step.observation) parts.push(step.observation);

    if (parts.length === 0) continue;

    notes.push({
      text: `Step ${step.step_number}: ${parts.join(" — ")}`,
      importance: "critical",
      sourceStep: step.step_number,
      attribution,
    });
  }

  return notes;
}

/**
 * Generate recommendations from deviations and observations.
 */
function generateRecommendations(
  steps: ProcedureStep[],
  tips: string[],
  attribution?: string
): PracticalNoteEntry[] {
  const notes: PracticalNoteEntry[] = [];

  for (const tip of tips) {
    notes.push({
      text: tip,
      importance: "informational",
      attribution,
    });
  }

  for (const step of steps) {
    if (!step.deviation || !step.observation) continue;

    const obsLower = step.observation.toLowerCase();
    const positiveOutcome = [
      "complete", "clean", "success", "dissolved", "improved",
      "better", "good", "quantitative",
    ].some((kw) => obsLower.includes(kw));

    if (positiveOutcome && step.deviation) {
      notes.push({
        text: `Consider: ${step.deviation} (observed: ${step.observation})`,
        importance: "informational",
        sourceStep: step.step_number,
        attribution,
      });
    }
  }

  return notes;
}

/**
 * Extract practical notes from raw procedure JSONB data.
 *
 * Parses ExpTube's video analysis data (actual_procedure JSONB) and extracts
 * actionable practical knowledge: what worked, challenges, timing tips,
 * safety notes, and recommendations.
 *
 * @param rawData - Raw JSONB data from ChemELN experiments.actual_procedure
 * @returns Structured practical notes result
 */
export function extractPracticalNotes(rawData: unknown): PracticalNotesResult {
  const procedure = parseRawProcedureData(rawData);

  if (!procedure) {
    return {
      hasData: false,
      whatWorked: [],
      challenges: [],
      recommendations: [],
      timingTips: [],
      safetyNotes: [],
      deviations: [],
      tips: [],
    };
  }

  const steps = procedure.steps ?? [];
  const attribution = procedure.researcher_name;
  const tips = procedure.tips ?? [];

  const deviations = extractDeviations(steps);
  const whatWorked = extractWhatWorked(steps, attribution);
  const challenges = extractChallenges(steps, attribution);
  const timingTips = extractTimingTips(steps, attribution);
  const safetyNotes = extractSafetyNotes(steps, attribution);
  const recommendations = generateRecommendations(steps, tips, attribution);

  const hasData =
    deviations.length > 0 ||
    whatWorked.length > 0 ||
    challenges.length > 0 ||
    timingTips.length > 0 ||
    safetyNotes.length > 0 ||
    recommendations.length > 0 ||
    (procedure.overall_notes !== undefined && procedure.overall_notes.trim().length > 0);

  const source =
    procedure.exptube_entry_id && procedure.video_url
      ? { entryId: procedure.exptube_entry_id, videoUrl: procedure.video_url }
      : undefined;

  return {
    hasData,
    whatWorked,
    challenges,
    recommendations,
    timingTips,
    safetyNotes,
    deviations,
    overallNotes: procedure.overall_notes?.trim() || undefined,
    tips,
    source,
  };
}

/**
 * Format a timestamp string to MM:SS format for display.
 */
function formatTimestamp(ts: string): string {
  return ts;
}

/**
 * Format practical notes as a markdown section for experiment pages.
 *
 * Generates "Practical Notes" section with deviations, key takeaways,
 * timing insights, and safety notes. Truncates at maxLength with a link
 * to the full video.
 *
 * @param notes - Extracted practical notes
 * @param maxLength - Maximum section length in characters (default: 2000)
 * @returns Markdown string
 */
export function formatPracticalNotes(notes: PracticalNotesResult, maxLength = 2000): string {
  if (!notes.hasData) {
    return "## Practical Notes\n\n*No practical notes available for this experiment.*\n";
  }

  const sections: string[] = ["## Practical Notes\n"];

  if (notes.safetyNotes.length > 0) {
    sections.push("### Safety Notes\n");
    for (const note of notes.safetyNotes) {
      sections.push(`> **Warning:** ${note.text}`);
      sections.push("");
    }
  }

  if (notes.deviations.length > 0) {
    sections.push("### Deviations from Planned Procedure\n");
    for (const dev of notes.deviations) {
      const timestamp = dev.timestamp ? ` (${formatTimestamp(dev.timestamp)})` : "";
      sections.push(`- **Step ${dev.stepNumber}${timestamp}**: ${dev.deviation}`);
      if (dev.reason) {
        sections.push(`  - *Reason*: ${dev.reason}`);
      }
      if (dev.observation) {
        sections.push(`  - *Observation*: ${dev.observation}`);
      }
      sections.push("");
    }
  }

  if (notes.whatWorked.length > 0) {
    sections.push("### What Worked\n");
    for (const note of notes.whatWorked) {
      sections.push(`- ${note.text}`);
    }
    sections.push("");
  }

  if (notes.challenges.length > 0) {
    sections.push("### Challenges\n");
    for (const note of notes.challenges) {
      const badge = note.importance === "critical" ? " [CRITICAL]" : "";
      sections.push(`- ${note.text}${badge}`);
    }
    sections.push("");
  }

  if (notes.timingTips.length > 0) {
    sections.push("### Timing Insights\n");
    for (const note of notes.timingTips) {
      sections.push(`- ${note.text}`);
    }
    sections.push("");
  }

  if (notes.overallNotes || notes.recommendations.length > 0) {
    sections.push("### Key Takeaways\n");
    if (notes.overallNotes) {
      sections.push(`> **${notes.overallNotes}**\n`);
    }
    for (const rec of notes.recommendations) {
      sections.push(`- ${rec.text}`);
    }
    sections.push("");
  }

  if (notes.source) {
    sections.push("---");
    sections.push(
      `*Source: ExpTube entry [${notes.source.entryId}](${notes.source.videoUrl})*\n`
    );
  }

  let markdown = sections.join("\n");

  if (markdown.length > maxLength && notes.source) {
    markdown = markdown.substring(0, maxLength);
    const lastNewline = markdown.lastIndexOf("\n");
    if (lastNewline > 0) {
      markdown = markdown.substring(0, lastNewline);
    }
    markdown += `\n\n... [see full video](${notes.source.videoUrl})\n`;
  }

  return markdown;
}
