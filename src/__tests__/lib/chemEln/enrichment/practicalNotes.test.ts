import { describe, it, expect } from "vitest";
import {
  parseRawProcedureData,
  extractPracticalNotes,
  formatPracticalNotes,
} from "@/lib/chemEln/enrichment/practicalNotes";

const REALISTIC_SUZUKI_PROCEDURE = {
  exptube_entry_id: "ET-2024-0156",
  video_url: "https://exptube.internal/videos/ET-2024-0156",
  researcher_name: "Dr. Sarah Chen",
  steps: [
    {
      step_number: 1,
      planned_action: "Weigh 500 mg 4-bromoacetophenone into round-bottom flask",
      actual_action: "Weighed 512 mg 4-bromoacetophenone into 100 mL RBF",
      timestamp: "00:01:30",
      observation: "White crystalline solid, dissolved completely in THF",
    },
    {
      step_number: 2,
      planned_action: "Add 1.2 eq phenylboronic acid (365 mg)",
      actual_action: "Added 402 mg phenylboronic acid (1.32 eq)",
      timestamp: "00:03:45",
      deviation: "Used 10% excess boronic acid to ensure complete conversion",
      observation: "White solid dissolved quickly upon stirring",
    },
    {
      step_number: 3,
      planned_action: "Add Pd(PPh3)4 catalyst (2 mol%, 58 mg)",
      actual_action: "Added 55 mg Pd(PPh3)4 under N2 flow",
      timestamp: "00:05:20",
      observation: "Yellow catalyst dissolved, solution turned pale yellow",
      is_safety_critical: true,
    },
    {
      step_number: 4,
      planned_action: "Add K2CO3 base (2 eq) in degassed water",
      actual_action: "Added K2CO3 in water, but forgot to degas",
      timestamp: "00:08:00",
      deviation: "Water not degassed — noticed after addition",
      deviation_severity: "moderate" as const,
      observation: "Solution darkened slightly, possible Pd oxidation",
    },
    {
      step_number: 5,
      planned_action: "Heat to 80°C for 4 hours",
      actual_action: "Heated to 80°C",
      timestamp: "00:10:30",
      duration_seconds: 21600,
      expected_duration_seconds: 14400,
      deviation: "Reaction incomplete at 4h (TLC showed starting material), extended to 6h",
      observation: "Complete conversion confirmed by TLC after 6 hours",
    },
    {
      step_number: 6,
      planned_action: "Cool to room temperature",
      actual_action: "Cooled to RT",
      timestamp: "06:10:30",
    },
    {
      step_number: 7,
      planned_action: "Extract with EtOAc (3 x 30 mL)",
      actual_action: "Extracted with EtOAc (3 x 30 mL)",
      timestamp: "06:15:00",
      observation: "Clean separation, no emulsion",
    },
    {
      step_number: 8,
      planned_action: "Purify by column chromatography (hexanes/EtOAc 9:1)",
      actual_action: "Column chromatography hexanes/EtOAc gradient 95:5 to 85:15",
      timestamp: "06:30:00",
      deviation: "Required gradient elution instead of isocratic — product co-eluted with side product at 9:1",
      observation: "Pure product obtained as white solid, 78% yield",
      duration_seconds: 5400,
      expected_duration_seconds: 3600,
    },
  ],
  overall_notes:
    "Heteroaryl substrates with electron-withdrawing groups required excess boronic acid and longer reaction times. Degassing the aqueous base is critical for catalyst longevity.",
  tips: [
    "Use 10% excess boronic acid for electron-poor aryl halides",
    "Always degas aqueous base before addition to avoid Pd black formation",
    "Monitor by TLC at 2h intervals — reaction time varies with substrate",
    "Gradient elution often needed for Suzuki products with similar Rf to starting material",
  ],
};

describe("parseRawProcedureData", () => {
  it("should parse complete actual_procedure JSONB", () => {
    const result = parseRawProcedureData(REALISTIC_SUZUKI_PROCEDURE);

    expect(result).not.toBeNull();
    expect(result?.exptube_entry_id).toBe("ET-2024-0156");
    expect(result?.video_url).toBe("https://exptube.internal/videos/ET-2024-0156");
    expect(result?.researcher_name).toBe("Dr. Sarah Chen");
    expect(result?.steps).toHaveLength(8);
    expect(result?.overall_notes).toContain("Heteroaryl substrates");
    expect(result?.tips).toHaveLength(4);
  });

  it("should parse stringified JSON", () => {
    const stringified = JSON.stringify(REALISTIC_SUZUKI_PROCEDURE);
    const result = parseRawProcedureData(stringified);

    expect(result).not.toBeNull();
    expect(result?.steps).toHaveLength(8);
    expect(result?.exptube_entry_id).toBe("ET-2024-0156");
  });

  it("should parse bare array of steps (V1 format)", () => {
    const v1Data = [
      { step_number: 1, deviation: "Used excess reagent" },
      { step_number: 2, deviation: "Extended reaction time" },
    ];
    const result = parseRawProcedureData(v1Data);

    expect(result).not.toBeNull();
    expect(result?.steps).toHaveLength(2);
    expect(result?.steps?.[0].deviation).toBe("Used excess reagent");
  });

  it("should return null for null/undefined input", () => {
    expect(parseRawProcedureData(null)).toBeNull();
    expect(parseRawProcedureData(undefined)).toBeNull();
  });

  it("should return null for non-object input", () => {
    expect(parseRawProcedureData(42)).toBeNull();
    expect(parseRawProcedureData(true)).toBeNull();
  });

  it("should return null for invalid JSON string", () => {
    expect(parseRawProcedureData("not json {{{")).toBeNull();
  });

  it("should handle malformed steps gracefully", () => {
    const malformed = {
      steps: [
        null,
        { step_number: "invalid" },
        { step_number: 2, deviation: 123 },
        { step_number: 3, deviation: "Valid deviation" },
      ],
      tips: ["Valid tip", null, 123, ""],
    };

    const result = parseRawProcedureData(malformed);
    expect(result).not.toBeNull();
    expect(result?.steps).toHaveLength(3);
    expect(result?.steps?.[2].deviation).toBe("Valid deviation");
    expect(result?.tips).toHaveLength(1);
    expect(result?.tips?.[0]).toBe("Valid tip");
  });

  it("should auto-number steps missing step_number", () => {
    const data = {
      steps: [
        { deviation: "First step deviation" },
        { deviation: "Second step deviation" },
      ],
    };
    const result = parseRawProcedureData(data);
    expect(result?.steps?.[0].step_number).toBe(1);
    expect(result?.steps?.[1].step_number).toBe(2);
  });

  it("should handle empty object", () => {
    const result = parseRawProcedureData({});
    expect(result).not.toBeNull();
    expect(result?.steps).toBeUndefined();
  });
});

describe("extractPracticalNotes", () => {
  it("should extract deviations from steps with deviation field", () => {
    const result = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);

    expect(result.hasData).toBe(true);
    expect(result.deviations.length).toBeGreaterThan(0);

    const boronicDeviation = result.deviations.find((d) => d.stepNumber === 2);
    expect(boronicDeviation).toBeDefined();
    expect(boronicDeviation?.reason).toContain("excess boronic acid");
  });

  it("should extract observations categorized as what_worked", () => {
    const result = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);

    expect(result.whatWorked.length).toBeGreaterThan(0);
    const dissolvedNote = result.whatWorked.find((n) => n.text.includes("dissolved completely"));
    expect(dissolvedNote).toBeDefined();
  });

  it("should extract timing insights for steps with duration differences", () => {
    const result = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);

    expect(result.timingTips.length).toBeGreaterThan(0);
    const longerStep = result.timingTips.find((t) => t.text.includes("longer"));
    expect(longerStep).toBeDefined();
  });

  it("should extract safety notes from safety-critical steps", () => {
    const result = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);

    expect(result.safetyNotes.length).toBeGreaterThan(0);
    const catalystNote = result.safetyNotes.find((n) => n.text.includes("Pd(PPh3)4"));
    expect(catalystNote).toBeDefined();
    expect(catalystNote?.importance).toBe("critical");
  });

  it("should extract challenges from steps with problem-like deviations", () => {
    const data = {
      steps: [
        {
          step_number: 1,
          deviation: "Filtration failed due to clogged frit",
          deviation_severity: "moderate" as const,
          observation: "Had to switch to gravity filtration",
        },
        {
          step_number: 2,
          deviation: "Unexpected precipitate formed during addition",
        },
      ],
    };

    const result = extractPracticalNotes(data);
    expect(result.challenges.length).toBe(2);
    expect(result.challenges[0].text).toContain("clogged frit");
  });

  it("should rate note importance correctly", () => {
    const data = {
      steps: [
        {
          step_number: 1,
          deviation: "safety hazard: exotherm during quench",
          is_safety_critical: true,
        },
        {
          step_number: 2,
          deviation: "low yield obtained after purification",
          deviation_severity: "moderate" as const,
        },
        {
          step_number: 3,
          deviation: "Used slightly different temperature",
          deviation_severity: "minor" as const,
        },
      ],
    };

    const result = extractPracticalNotes(data);

    const safetyNote = result.safetyNotes.find((n) => n.sourceStep === 1);
    expect(safetyNote?.importance).toBe("critical");

    const yieldChallenge = result.challenges.find((n) => n.sourceStep === 2);
    expect(yieldChallenge?.importance).toBe("important");
  });

  it("should include attribution from researcher_name", () => {
    const result = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);

    const notesWithAttribution = [
      ...result.whatWorked,
      ...result.challenges,
      ...result.recommendations,
      ...result.timingTips,
      ...result.safetyNotes,
    ].filter((n) => n.attribution === "Dr. Sarah Chen");

    expect(notesWithAttribution.length).toBeGreaterThan(0);
  });

  it("should include source information", () => {
    const result = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);

    expect(result.source).toBeDefined();
    expect(result.source?.entryId).toBe("ET-2024-0156");
    expect(result.source?.videoUrl).toBe("https://exptube.internal/videos/ET-2024-0156");
  });

  it("should handle tips as recommendations", () => {
    const result = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);

    expect(result.recommendations.length).toBeGreaterThanOrEqual(4);
    expect(result.tips).toHaveLength(4);
  });

  it("should handle missing actual_procedure gracefully", () => {
    const result = extractPracticalNotes(null);

    expect(result.hasData).toBe(false);
    expect(result.whatWorked).toHaveLength(0);
    expect(result.challenges).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
    expect(result.timingTips).toHaveLength(0);
    expect(result.safetyNotes).toHaveLength(0);
    expect(result.deviations).toHaveLength(0);
  });

  it("should handle empty steps array", () => {
    const result = extractPracticalNotes({ steps: [] });

    expect(result.hasData).toBe(false);
    expect(result.deviations).toHaveLength(0);
  });

  it("should handle procedure with only overall_notes", () => {
    const result = extractPracticalNotes({
      overall_notes: "This reaction works best under strict anhydrous conditions",
    });

    expect(result.hasData).toBe(true);
    expect(result.overallNotes).toBe("This reaction works best under strict anhydrous conditions");
  });

  it("should work with realistic Grignard reaction data", () => {
    const grignardData = {
      exptube_entry_id: "ET-2024-0289",
      video_url: "https://exptube.internal/videos/ET-2024-0289",
      researcher_name: "Dr. James Liu",
      steps: [
        {
          step_number: 1,
          planned_action: "Dry all glassware in oven at 120°C overnight",
          actual_action: "Dried glassware in oven at 120°C for 2 hours (not overnight)",
          timestamp: "00:02:00",
          deviation: "Shortened drying time due to schedule constraints",
          deviation_severity: "minor" as const,
          observation: "Glassware appeared dry, no moisture visible",
        },
        {
          step_number: 2,
          planned_action: "Activate Mg turnings with I2",
          actual_action: "Activated Mg turnings with I2 crystal",
          timestamp: "00:05:30",
          observation: "Brown color dissipated after 5 min — activation complete",
          is_safety_critical: true,
        },
        {
          step_number: 3,
          planned_action: "Add bromobenzene dropwise over 30 min",
          actual_action: "Added bromobenzene dropwise, exotherm started after 2 mL",
          timestamp: "00:10:00",
          deviation: "Exotherm more vigorous than expected, slowed addition rate",
          observation: "Reflux maintained with ice bath, color change to dark grey",
          is_safety_critical: true,
          duration_seconds: 3600,
          expected_duration_seconds: 1800,
        },
        {
          step_number: 4,
          planned_action: "Add benzaldehyde (0.9 eq) at 0°C",
          actual_action: "Added benzaldehyde at -10°C",
          timestamp: "01:15:00",
          deviation: "Lowered temperature to -10°C for better selectivity",
          observation: "Clean addition, no side products by TLC",
        },
      ],
      overall_notes:
        "Grignard formation was sluggish initially but proceeded well after activation. Lower temperature for aldehyde addition improved selectivity.",
      tips: [
        "Ensure complete Mg activation before substrate addition — look for gas evolution",
        "Keep ice bath ready for Grignard formation exotherm",
        "Use -10°C instead of 0°C for aldehyde addition with this substrate",
      ],
    };

    const result = extractPracticalNotes(grignardData);

    expect(result.hasData).toBe(true);
    expect(result.safetyNotes.length).toBeGreaterThanOrEqual(2);
    expect(result.timingTips.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(result.source?.entryId).toBe("ET-2024-0289");

    const exothermSafety = result.safetyNotes.find((n) => n.text.includes("exotherm"));
    expect(exothermSafety).toBeDefined();
  });
});

describe("formatPracticalNotes", () => {
  it("should format complete practical notes as markdown", () => {
    const notes = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);
    const markdown = formatPracticalNotes(notes, 10000);

    expect(markdown).toContain("## Practical Notes");
    expect(markdown).toContain("### Deviations from Planned Procedure");
    expect(markdown).toContain("**Step 2 (00:03:45)**");
    expect(markdown).toContain("*Reason*:");
    expect(markdown).toContain("### Key Takeaways");
    expect(markdown).toContain("Source: ExpTube entry [ET-2024-0156]");
  });

  it("should show 'no practical notes available' for empty data", () => {
    const notes = extractPracticalNotes(null);
    const markdown = formatPracticalNotes(notes);

    expect(markdown).toContain("No practical notes available");
  });

  it("should include safety notes section when present", () => {
    const notes = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);
    const markdown = formatPracticalNotes(notes);

    if (notes.safetyNotes.length > 0) {
      expect(markdown).toContain("### Safety Notes");
      expect(markdown).toContain("**Warning:**");
    }
  });

  it("should include timing insights section when present", () => {
    const notes = extractPracticalNotes(REALISTIC_SUZUKI_PROCEDURE);
    const markdown = formatPracticalNotes(notes, 10000);

    if (notes.timingTips.length > 0) {
      expect(markdown).toContain("### Timing Insights");
    }
  });

  it("should truncate long notes with link to full video", () => {
    const longData = {
      exptube_entry_id: "ET-2024-0999",
      video_url: "https://exptube.internal/videos/ET-2024-0999",
      steps: Array.from({ length: 50 }, (_, i) => ({
        step_number: i + 1,
        planned_action: `Planned action for step ${i + 1} with detailed description`,
        actual_action: `Actual action for step ${i + 1} that differed from plan`,
        deviation: `Deviation in step ${i + 1}: used different conditions than planned procedure`,
        observation: `Observed unexpected color change and precipitate formation in step ${i + 1}`,
      })),
    };

    const notes = extractPracticalNotes(longData);
    const markdown = formatPracticalNotes(notes, 500);

    expect(markdown.length).toBeLessThanOrEqual(600);
    expect(markdown).toContain("... [see full video]");
  });

  it("should include overall notes as blockquote", () => {
    const notes = extractPracticalNotes({
      overall_notes: "Key finding about reaction optimization",
      tips: ["Tip one"],
    });
    const markdown = formatPracticalNotes(notes);

    expect(markdown).toContain("> **Key finding about reaction optimization**");
  });

  it("should format deviations with timestamp and observations", () => {
    const data = {
      steps: [
        {
          step_number: 3,
          planned_action: "Heat at 60°C",
          actual_action: "Heated at 80°C",
          timestamp: "00:15:30",
          deviation: "Increased temperature for faster conversion",
          observation: "Reaction completed in half the time",
        },
      ],
    };

    const notes = extractPracticalNotes(data);
    const markdown = formatPracticalNotes(notes);

    expect(markdown).toContain("**Step 3 (00:15:30)**");
    expect(markdown).toContain("*Reason*: Increased temperature");
    expect(markdown).toContain("*Observation*: Reaction completed");
  });
});
