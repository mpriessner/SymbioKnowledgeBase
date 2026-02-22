import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * GET /api/agent/openapi.yaml — Serve the OpenAPI specification
 */
export async function GET() {
  try {
    const filePath = join(process.cwd(), "docs", "api", "agent-openapi.yaml");
    const content = readFileSync(filePath, "utf-8");

    return new NextResponse(content, {
      headers: { "Content-Type": "text/yaml" },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "OpenAPI spec not found" } },
      { status: 404 }
    );
  }
}
