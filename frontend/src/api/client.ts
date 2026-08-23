import { storage } from "../lib/storage";
import type { ApiErrorBody } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "https://zany-eureka-pj99qrqwgx5344p-3000.app.github.dev";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip attaching the X-Organization-Id header (auth endpoints don't need it). */
  skipOrgHeader?: boolean;
  /** Skip attaching Authorization (register/login/refresh). */
  skipAuthHeader?: boolean;
  /** Internal flag preventing infinite refresh loops. */
  _isRetry?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempts a single token refresh, de-duplicated so concurrent 401s from
 * several in-flight requests trigger only one /auth/refresh call.
 */
async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = storage.getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const body = await res.json();
        storage.setSession({ accessToken: body.accessToken, refreshToken: body.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};

  // Only declare a JSON content-type when a body is actually being sent.
  // Fastify's default JSON body parser rejects a request that claims
  // Content-Type: application/json but sends zero bytes (FST_ERR_CTP_EMPTY_
  // JSON_BODY) — which every bodyless DELETE (unassign, delete task/project,
  // remove member) was doing before this fix, since this header used to be
  // set unconditionally regardless of method/body.
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!options.skipAuthHeader) {
    const token = storage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (!options.skipOrgHeader) {
    const orgId = storage.getOrganizationId();
    if (orgId) headers["X-Organization-Id"] = orgId;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  // Transparent access-token refresh on 401, retried exactly once per call.
  if (res.status === 401 && !options.skipAuthHeader && !options._isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _isRetry: true });
    }
    storage.clear();
    window.location.href = "/login";
    throw new ApiError(401, { error: "Session expired", code: "UNAUTHORIZED" });
  }

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body ?? { error: res.statusText, code: "INTERNAL_SERVER_ERROR" });
  }

  return body as T;
}
