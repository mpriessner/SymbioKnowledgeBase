import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

// tenantContext (where AuthenticationError lives) imports prisma at module load;
// stub it so importing the gate doesn't need a real DB.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  requireDestructivePermission,
  isDestructiveGateEnabled,
} from "@/lib/auth/requireDestructivePermission";
import { AuthenticationError } from "@/lib/tenantContext";
import type { TenantContext } from "@/types/auth";

const ADMIN: TenantContext = { tenantId: "t1", userId: "admin-1", role: "ADMIN" };
const USER: TenantContext = { tenantId: "t1", userId: "user-1", role: "USER" };

const ORIGINAL = process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE;
  else process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE = ORIGINAL;
  vi.unstubAllEnvs();
});

describe("requireDestructivePermission — destructive-op gate (audit S4)", () => {
  describe("gate ON (default — flag unset)", () => {
    beforeEach(() => {
      delete process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE;
    });

    test("defaults to ON when the flag is unset", () => {
      expect(isDestructiveGateEnabled()).toBe(true);
    });

    test("ADMIN (owner-equivalent) is allowed to delete", () => {
      expect(() => requireDestructivePermission(ADMIN)).not.toThrow();
    });

    test("non-admin USER is blocked with a 403 FORBIDDEN", () => {
      expect(() => requireDestructivePermission(USER)).toThrow(AuthenticationError);
      try {
        requireDestructivePermission(USER);
      } catch (e) {
        const err = e as AuthenticationError;
        expect(err.statusCode).toBe(403);
        expect(err.errorCode).toBe("FORBIDDEN");
      }
    });
  });

  describe('gate ON (flag explicitly "1" / "true")', () => {
    test('"1" keeps the gate on — USER blocked, ADMIN allowed', () => {
      process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE = "1";
      expect(isDestructiveGateEnabled()).toBe(true);
      expect(() => requireDestructivePermission(USER)).toThrow(AuthenticationError);
      expect(() => requireDestructivePermission(ADMIN)).not.toThrow();
    });

    test('"true" (any case) keeps the gate on', () => {
      process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE = "TRUE";
      expect(isDestructiveGateEnabled()).toBe(true);
      expect(() => requireDestructivePermission(USER)).toThrow(AuthenticationError);
    });
  });

  describe("gate OFF (flag relaxed)", () => {
    test('"0" disables the gate — non-admin USER allowed to delete', () => {
      process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE = "0";
      expect(isDestructiveGateEnabled()).toBe(false);
      expect(() => requireDestructivePermission(USER)).not.toThrow();
      expect(() => requireDestructivePermission(ADMIN)).not.toThrow();
    });

    test('"false" disables the gate', () => {
      process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE = "false";
      expect(isDestructiveGateEnabled()).toBe(false);
      expect(() => requireDestructivePermission(USER)).not.toThrow();
    });

    test('"off" disables the gate', () => {
      process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE = "off";
      expect(isDestructiveGateEnabled()).toBe(false);
      expect(() => requireDestructivePermission(USER)).not.toThrow();
    });
  });
});
