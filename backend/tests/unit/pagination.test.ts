import { describe, expect, it } from "vitest";
import {
  buildPaginatedResult,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  paginationQuerySchema,
  toSkipTake,
} from "../../src/shared/pagination/pagination";

describe("pagination helper", () => {
  it("applies defaults when page/limit are omitted", () => {
    const result = paginationQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("computes skip/take from page and limit", () => {
    const pagination = paginationQuerySchema.parse({ page: 3, limit: 10 });
    expect(toSkipTake(pagination)).toEqual({ skip: 20, take: 10 });
  });

  it("computes skip=0 for the first page", () => {
    const pagination = paginationQuerySchema.parse({ page: 1, limit: 25 });
    expect(toSkipTake(pagination)).toEqual({ skip: 0, take: 25 });
  });

  it("rejects a limit above the maximum", () => {
    const result = paginationQuerySchema.safeParse({ limit: MAX_PAGE_LIMIT + 1 });
    expect(result.success).toBe(false);
  });

  it("rejects a page below 1", () => {
    const result = paginationQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric values", () => {
    const result = paginationQuerySchema.safeParse({ page: "abc" });
    expect(result.success).toBe(false);
  });

  it("builds the standard paginated response envelope", () => {
    const pagination = paginationQuerySchema.parse({ page: 2, limit: 5 });
    const envelope = buildPaginatedResult(["a", "b"], 12, pagination);
    expect(envelope).toEqual({ data: ["a", "b"], total: 12, page: 2, limit: 5 });
  });
});
