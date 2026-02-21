import { describe, test, expect } from "vitest";
import {
  createPageSchema,
  updatePageSchema,
  listPagesQuerySchema,
} from "@/lib/validation/pages";

describe("createPageSchema", () => {
  test("accepts valid input with all fields", () => {
    const result = createPageSchema.safeParse({
      title: "My Page",
      parentId: "550e8400-e29b-41d4-a716-446655440000",
      icon: "📄",
      coverUrl: "https://example.com/cover.jpg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("My Page");
      expect(result.data.parentId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.data.icon).toBe("📄");
      expect(result.data.coverUrl).toBe("https://example.com/cover.jpg");
    }
  });

  test("defaults title to 'Untitled' when not provided", () => {
    const result = createPageSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Untitled");
    }
  });

  test("defaults parentId to null when not provided", () => {
    const result = createPageSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBeNull();
    }
  });

  test("rejects title longer than 500 characters", () => {
    const result = createPageSchema.safeParse({
      title: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid UUID for parentId", () => {
    const result = createPageSchema.safeParse({
      parentId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid URL for coverUrl", () => {
    const result = createPageSchema.safeParse({
      coverUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  test("accepts null for optional nullable fields", () => {
    const result = createPageSchema.safeParse({
      parentId: null,
      icon: null,
      coverUrl: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("updatePageSchema", () => {
  test("accepts partial update with title only", () => {
    const result = updatePageSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("New Title");
      expect(result.data.parentId).toBeUndefined();
    }
  });

  test("accepts empty object (no fields to update)", () => {
    const result = updatePageSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects title longer than 500 characters", () => {
    const result = updatePageSchema.safeParse({
      title: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("listPagesQuerySchema", () => {
  test("applies defaults when no parameters provided", () => {
    const result = listPagesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.sortBy).toBe("updatedAt");
      expect(result.data.order).toBe("desc");
    }
  });

  test("coerces string numbers to integers", () => {
    const result = listPagesQuerySchema.safeParse({
      limit: "50",
      offset: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(10);
    }
  });

  test("rejects limit above 100", () => {
    const result = listPagesQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  test("rejects negative offset", () => {
    const result = listPagesQuerySchema.safeParse({ offset: "-1" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid sortBy value", () => {
    const result = listPagesQuerySchema.safeParse({ sortBy: "invalid" });
    expect(result.success).toBe(false);
  });

  test("accepts valid sortBy and order values", () => {
    const result = listPagesQuerySchema.safeParse({
      sortBy: "title",
      order: "asc",
    });
    expect(result.success).toBe(true);
  });
});
