/**
 * Standard API response envelope for single-item responses.
 */
export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

/**
 * Standard API response envelope for list responses with pagination.
 */
export interface ApiListResponse<T> {
  data: T[];
  meta: ApiListMeta;
}

/**
 * Metadata included in every API response.
 */
export interface ApiMeta {
  timestamp: string; // ISO 8601
}

/**
 * Extended metadata for list endpoints with pagination info.
 */
export interface ApiListMeta extends ApiMeta {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Standard error response envelope.
 */
export interface ApiErrorResponse {
  error: ApiError;
  meta: ApiMeta;
}

/**
 * Error details within the error envelope.
 */
export interface ApiError {
  code: string; // UPPER_SNAKE_CASE error code
  message: string; // Human-readable error message
  details?: ApiValidationError[];
}

/**
 * Field-level validation error details.
 */
export interface ApiValidationError {
  field: string;
  message: string;
}
