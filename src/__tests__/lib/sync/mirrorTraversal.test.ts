import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

/**
 * Path-traversal hardening for the filesystem mirror.
 *
 * MIRROR_ROOT is read from MIRROR_DIR at module-load, so we set the env to a
 * temp dir and dynamically import mirrorOps after resetting the module cache.
 */
let mirrorRoot: string;
let mirror: typeof import("@/lib/sync/mirrorOps");

beforeAll(async () => {
  mirrorRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skb-mirror-"));
  process.env.MIRROR_DIR = mirrorRoot;
  vi.resetModules();
  mirror = await import("@/lib/sync/mirrorOps");

  // Tenant "abc" owns a secret file; sibling tenant "ab" must never reach it.
  await fs.mkdir(path.join(mirrorRoot, "abc"), { recursive: true });
  await fs.writeFile(
    path.join(mirrorRoot, "abc", "secret.md"),
    "TOP SECRET",
    "utf-8"
  );
  await fs.mkdir(path.join(mirrorRoot, "ab"), { recursive: true });
  await fs.writeFile(path.join(mirrorRoot, "ab", "own.md"), "mine", "utf-8");
});

afterAll(async () => {
  await fs.rm(mirrorRoot, { recursive: true, force: true });
  delete process.env.MIRROR_DIR;
});

describe("mirror path traversal", () => {
  it("reads a legitimate in-tenant file", async () => {
    const content = await mirror.readMirrorFile("ab", "own.md");
    expect(content).toBe("mine");
  });

  it("rejects ../ traversal out of the tenant root", async () => {
    await expect(
      mirror.readMirrorFile("ab", "../abc/secret.md")
    ).rejects.toThrow("Path traversal detected");
  });

  it("rejects a bare .. segment", async () => {
    await expect(mirror.readMirrorFile("ab", "..")).rejects.toThrow(
      "Path traversal detected"
    );
  });

  it("blocks the prefix-escape bug (tenant 'ab' must not see 'abc')", async () => {
    // The old guard used startsWith without a trailing separator, so a path
    // resolving into a sibling whose name shares the prefix (abc vs ab) would
    // slip through. List of tenant "ab" must not include "abc" content.
    const listed = await mirror.listMirrorFiles("ab");
    expect(listed.map((e) => e.name)).toContain("own.md");
    expect(listed.map((e) => e.name)).not.toContain("secret.md");

    // And a path crafted to reach the sibling is rejected on write/delete too.
    await expect(
      mirror.writeMirrorFile("ab", "../abc/pwn.md", "x")
    ).rejects.toThrow("Path traversal detected");
    await expect(
      mirror.deleteMirrorFile("ab", "../abc/secret.md")
    ).rejects.toThrow("Path traversal detected");

    // Confirm the secret file is untouched.
    const stillThere = await mirror.readMirrorFile("abc", "secret.md");
    expect(stillThere).toBe("TOP SECRET");
  });

  it("listMirrorFiles returns [] for a traversal subPath instead of escaping", async () => {
    const listed = await mirror.listMirrorFiles("ab", "../abc");
    expect(listed).toEqual([]);
  });
});
