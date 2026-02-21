import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/apiResponse";

const ogMetadataSchema = z.object({
  url: z.string().url("Invalid URL"),
});

// POST /api/og-metadata -- Fetch Open Graph metadata for a URL
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ogMetadataSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        400
      );
    }

    const { url } = parsed.data;

    // Fetch the page with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SymbioKnowledgeBase/1.0 (Bookmark Preview)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return errorResponse("FETCH_FAILED", "Failed to fetch URL", undefined, 502);
    }

    const html = await response.text();

    // Parse OG meta tags from HTML
    const title = extractMetaContent(html, "og:title") ||
      extractTitle(html) ||
      "";
    const description = extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description") ||
      "";
    const image = extractMetaContent(html, "og:image") || "";
    const favicon = extractFavicon(html, url);

    return successResponse({
      title,
      description,
      favicon,
      image: resolveUrl(image, url),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("TIMEOUT", "Request timeout", undefined, 504);
    }
    console.error("OG metadata fetch error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch metadata", undefined, 500);
  }
}

/**
 * Extract content from a meta tag by property or name attribute.
 */
function extractMetaContent(html: string, property: string): string {
  // Try property attribute first (OG tags)
  const propertyRegex = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const propertyMatch = html.match(propertyRegex);
  if (propertyMatch?.[1]) return propertyMatch[1];

  // Try reversed attribute order
  const reversedRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`,
    "i"
  );
  const reversedMatch = html.match(reversedRegex);
  if (reversedMatch?.[1]) return reversedMatch[1];

  // Try name attribute (standard meta tags)
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const nameMatch = html.match(nameRegex);
  if (nameMatch?.[1]) return nameMatch[1];

  return "";
}

/**
 * Extract the <title> tag content.
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() ?? "";
}

/**
 * Extract the favicon URL from the HTML.
 */
function extractFavicon(html: string, baseUrl: string): string {
  const iconRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i;
  const match = html.match(iconRegex);
  if (match?.[1]) {
    return resolveUrl(match[1], baseUrl);
  }
  // Default favicon location
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(url: string, base: string): string {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
