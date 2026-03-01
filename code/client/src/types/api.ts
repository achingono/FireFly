// ============================================================
// FireFly — API Envelope Types
// ============================================================

/** Standard success response envelope */
export interface ApiSuccessResponse<T = unknown> {
  status: "success";
  code: number;
  requestId: string;
  data: T;
  meta: ApiMeta;
}

/** Standard error response envelope */
export interface ApiErrorResponse {
  status: "error";
  code: number;
  requestId: string;
  error: ApiError;
}

/** Error detail */
export interface ApiError {
  type: string;
  message: string;
  details: ApiErrorDetail[];
}

/** Individual error detail (e.g. field validation) */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

/** Response metadata */
export interface ApiMeta {
  schemaVersion: string;
  cursor?: string;
  limit?: number;
  hasMore?: boolean;
}

/** Union type for any API response */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Type guard to check if response is a success */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.status === "success";
}

/** Type guard to check if response is an error */
export function isApiError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return response.status === "error";
}

// -----------------------------------------------------------
// Request types
// -----------------------------------------------------------

/** Execute code request */
export interface ExecuteCodeRequest {
  code: string;
  language: string;
  stdin?: string;
  timeoutMs?: number;
  captureTrace?: boolean;
}

/** Submit exercise request */
export interface SubmitExerciseRequest {
  code: string;
  language: string;
  options?: Record<string, unknown>;
}

/** Update user request */
export interface UpdateUserRequest {
  displayName?: string;
  age?: number;
  ageProfile?: string;
  preferences?: Partial<{
    theme: string;
    soundEnabled: boolean;
    animationsEnabled: boolean;
  }>;
}

/** Explain trace step request */
export interface ExplainStepRequest {
  traceStep: number;
  ageProfile: string;
  tone: string;
}

/** Update mastery request */
export interface UpdateMasteryRequest {
  exerciseId: string;
  correct: boolean;
  attemptData?: Record<string, unknown>;
}
