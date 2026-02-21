import { describe, it, expect } from "vitest";
import { WikilinkExtension } from "@/components/editor/extensions/WikilinkExtension";

describe("WikilinkExtension", () => {
  it("should have the correct name", () => {
    expect(WikilinkExtension.name).toBe("wikilink");
  });

  it("should be an inline node", () => {
    expect(WikilinkExtension.config.group).toBe("inline");
    expect(WikilinkExtension.config.inline).toBe(true);
  });

  it("should be atomic (non-splittable)", () => {
    expect(WikilinkExtension.config.atom).toBe(true);
  });

  it("should define pageId, pageName, and displayText attributes", () => {
    const attrs = WikilinkExtension.config.addAttributes?.call(
      WikilinkExtension
    );
    expect(attrs).toHaveProperty("pageId");
    expect(attrs).toHaveProperty("pageName");
    expect(attrs).toHaveProperty("displayText");
  });
});
