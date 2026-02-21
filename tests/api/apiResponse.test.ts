import { successResponse, listResponse, errorResponse } from "../../src/lib/apiResponse";

// Helper to extract JSON body from NextResponse
async function getBody<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

describe("successResponse", () => {
  test("wraps data in standard envelope with timestamp", async () => {
    const data = { id: "123", title: "Test Page" };
    const response = successResponse(data);

    expect(response.status).toBe(200);

    const body = await getBody(response);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect((body as Record<string, unknown>).data).toEqual(data);
    expect((body as Record<string, { timestamp: string }>).meta.timestamp).toBeTruthy();
  });

  test("supports custom status code", async () => {
    const response = successResponse({ id: "new" }, undefined, 201);
    expect(response.status).toBe(201);
  });

  test("includes additional meta fields", async () => {
    const response = successResponse(
      { id: "123" },
      { version: "1.0" }
    );

    const body = await getBody<{ meta: { version: string } }>(response);
    expect(body.meta.version).toBe("1.0");
  });

  test("timestamp is valid ISO 8601", async () => {
    const response = successResponse({});
    const body = await getBody<{ meta: { timestamp: string } }>(response);
    const date = new Date(body.meta.timestamp);
    expect(date.toISOString()).toBe(body.meta.timestamp);
  });
});

describe("listResponse", () => {
  test("wraps array data with pagination metadata", async () => {
    const data = [{ id: "1" }, { id: "2" }];
    const response = listResponse(data, 100, 20, 0);

    expect(response.status).toBe(200);

    const body = await getBody<{
      data: Array<{ id: string }>;
      meta: { total: number; limit: number; offset: number; timestamp: string };
    }>(response);
    expect(body.data).toEqual(data);
    expect(body.meta.total).toBe(100);
    expect(body.meta.limit).toBe(20);
    expect(body.meta.offset).toBe(0);
    expect(body.meta.timestamp).toBeTruthy();
  });

  test("handles empty data array", async () => {
    const response = listResponse([], 0, 20, 0);
    const body = await getBody<{ data: unknown[]; meta: { total: number } }>(response);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });
});

describe("errorResponse", () => {
  test("creates error envelope with code and message", async () => {
    const response = errorResponse("NOT_FOUND", "Page not found", undefined, 404);

    expect(response.status).toBe(404);

    const body = await getBody<{
      error: { code: string; message: string; details?: unknown[] };
      meta: { timestamp: string };
    }>(response);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Page not found");
    expect(body.error.details).toBeUndefined();
    expect(body.meta.timestamp).toBeTruthy();
  });

  test("includes validation details when provided", async () => {
    const details = [
      { field: "title", message: "Must not be empty" },
      { field: "email", message: "Invalid email format" },
    ];
    const response = errorResponse("VALIDATION_ERROR", "Invalid input", details, 400);

    const body = await getBody<{
      error: { details: Array<{ field: string; message: string }> };
    }>(response);
    expect(body.error.details).toHaveLength(2);
    expect(body.error.details[0].field).toBe("title");
    expect(body.error.details[1].field).toBe("email");
  });

  test("defaults to status 400", async () => {
    const response = errorResponse("VALIDATION_ERROR", "Bad request");
    expect(response.status).toBe(400);
  });

  test("omits details when empty array provided", async () => {
    const response = errorResponse("ERROR", "Something failed", []);
    const body = await getBody<{ error: { details?: unknown[] } }>(response);
    expect(body.error.details).toBeUndefined();
  });
});
