import { describe, it, expect } from "vitest";
import { buildPagePaths } from "@/lib/sync/FolderStructure";
import type { SyncPageData } from "@/lib/sync/types";

function makePage(
  id: string,
  title: string,
  parentId: string | null = null,
  position: number = 0
): SyncPageData {
  return {
    id,
    title,
    icon: null,
    parentId,
    position,
    spaceType: "PRIVATE",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    blocks: [],
  };
}

describe("buildPagePaths", () => {
  it("leaf page → single .md file", () => {
    const pages = [makePage("p1", "Welcome")];
    const paths = buildPagePaths(pages);
    expect(paths.get("p1")!.filePath).toBe("Welcome.md");
  });

  it("page with children → folder + _index.md", () => {
    const pages = [
      makePage("p1", "Projects"),
      makePage("p2", "Project Alpha", "p1"),
    ];
    const paths = buildPagePaths(pages);
    expect(paths.get("p1")!.filePath).toBe("Projects/_index.md");
    expect(paths.get("p2")!.filePath).toBe("Projects/Project Alpha.md");
  });

  it("nested hierarchy works correctly", () => {
    const pages = [
      makePage("p1", "Root"),
      makePage("p2", "Child", "p1"),
      makePage("p3", "Grandchild", "p2"),
    ];
    const paths = buildPagePaths(pages);
    expect(paths.get("p1")!.filePath).toBe("Root/_index.md");
    expect(paths.get("p2")!.filePath).toBe("Root/Child/_index.md");
    expect(paths.get("p3")!.filePath).toBe("Root/Child/Grandchild.md");
  });

  it("multiple root pages", () => {
    const pages = [
      makePage("p1", "Page A", null, 0),
      makePage("p2", "Page B", null, 1),
    ];
    const paths = buildPagePaths(pages);
    expect(paths.get("p1")!.filePath).toBe("Page A.md");
    expect(paths.get("p2")!.filePath).toBe("Page B.md");
  });

  it("duplicate slugs get numeric suffix", () => {
    const pages = [
      makePage("p1", "Notes", null, 0),
      makePage("p2", "Notes", null, 1),
    ];
    const paths = buildPagePaths(pages);
    expect(paths.get("p1")!.filePath).toBe("Notes.md");
    expect(paths.get("p2")!.filePath).toBe("Notes-2.md");
  });

  it("unsafe characters in titles are sanitized", () => {
    const pages = [
      makePage("p1", "What is this?"),
      makePage("p2", "file/path:bad"),
    ];
    const paths = buildPagePaths(pages);
    // Should not contain path-unsafe characters
    expect(paths.get("p1")!.filePath).not.toContain("?");
    expect(paths.get("p2")!.filePath).not.toContain("/");
  });

  it("empty title uses Untitled", () => {
    const pages = [makePage("p1", "")];
    const paths = buildPagePaths(pages);
    expect(paths.get("p1")!.filePath).toBe("Untitled.md");
  });

  it("handles complex tree structure", () => {
    // Root
    //  ├── Projects/
    //  │   ├── _index.md
    //  │   ├── Alpha.md
    //  │   └── Beta.md
    //  └── Notes.md
    const pages = [
      makePage("root", "Root"),
      makePage("projects", "Projects", "root", 0),
      makePage("alpha", "Alpha", "projects", 0),
      makePage("beta", "Beta", "projects", 1),
      makePage("notes", "Notes", "root", 1),
    ];
    const paths = buildPagePaths(pages);

    expect(paths.get("root")!.filePath).toBe("Root/_index.md");
    expect(paths.get("projects")!.filePath).toBe(
      "Root/Projects/_index.md"
    );
    expect(paths.get("alpha")!.filePath).toBe(
      "Root/Projects/Alpha.md"
    );
    expect(paths.get("beta")!.filePath).toBe(
      "Root/Projects/Beta.md"
    );
    expect(paths.get("notes")!.filePath).toBe("Root/Notes.md");
  });
});
