import { z } from "zod";

// Reasonable ceiling on page size to prevent an accidental/malicious request
// from forcing an unbounded table scan / huge response payload.
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Converts a validated page/limit into a Prisma-compatible skip/take pair.
 * Pure function — no I/O — so it is trivially unit-testable.
 */
export function toSkipTake(pagination: PaginationQuery): { skip: number; take: number } {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  };
}

/**
 * Wraps a data page + total count into the API's standard pagination envelope.
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  pagination: PaginationQuery
): PaginatedResult<T> {
  return {
    data,
    total,
    page: pagination.page,
    limit: pagination.limit,
  };
}
