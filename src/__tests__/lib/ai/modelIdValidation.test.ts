import { describe, it, expect } from "vitest";

/**
 * Canonical model-id pattern shared by the AI chat / generate-page / transcribe routes.
 * Mirrors the `MODEL_ID_PATTERN` defined in those route modules. This guards the
 * character class against drift — `model` is interpolated into the Google URL path, so
 * it must reject anything that could enable request-splitting (slashes, whitespace,
 * CR/LF, query/fragment characters).
 */
const MODEL_ID_PATTERN = /^[A-Za-z0-9._\-:]+$/;

describe("model id validation pattern", () => {
  const valid = [
    "gpt-4o-mini",
    "gpt-4.1",
    "claude-sonnet-4-20250514",
    "gemini-2.0-flash",
    "whisper-1",
    "nano",
    "models.v2_beta",
    "ft:gpt-4o:org::abc123",
  ];

  it.each(valid)("accepts real model id %s", (id) => {
    expect(MODEL_ID_PATTERN.test(id)).toBe(true);
  });

  const invalid = [
    "", // empty
    "gpt-4o/../../admin", // path traversal
    "gemini:streamGenerateContent?alt=sse&key=LEAKED", // query injection
    "model with spaces",
    "model\nLocation: evil", // header/request splitting via newline
    "model\r\nHost: attacker", // CRLF
    "model#fragment",
    "model%2F", // encoded slash
    "model/extra/path",
  ];

  it.each(invalid)("rejects malicious/invalid model id %j", (id) => {
    expect(MODEL_ID_PATTERN.test(id)).toBe(false);
  });
});
