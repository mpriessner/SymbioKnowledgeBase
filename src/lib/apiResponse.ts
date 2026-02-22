import { NextResponse } from "next/server";

import type {
  ApiResponse,
  ApiListResponse,
  ApiErrorResponse,
  ApiValidationError,
} from "@/types/api";

/**
 * Create a success response for a single item.
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status }
  );
}

/**
 * Create a success response for a list of items with pagination metadata.
 */
export function listResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
  extraMeta?: Record<string, unknown>
): NextResponse<ApiListResponse<T>> {
  return NextResponse.json({
    data,
    meta: {
      total,
      limit,
      offset,
      timestamp: new Date().toISOString(),
      ...extraMeta,
    },
  });
}

/**
 * Create an error response with the standard error envelope.
 */
export function errorResponse(
  code: string,
  message: string,
  details?: ApiValidationError[],
  status: number = 400
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  if (details && details.length > 0) {
    body.error.details = details;
  }

  return NextResponse.json(body, { status });
}
