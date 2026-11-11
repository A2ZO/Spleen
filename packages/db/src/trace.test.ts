import { describe, expect, it } from "vitest";

import { queryTraceEnabled } from "./trace";

describe("queryTraceEnabled", () => {
  it("is on only with SPLEEN_QUERY_TRACE=1 outside production", () => {
    expect(queryTraceEnabled({ SPLEEN_QUERY_TRACE: "1", NODE_ENV: "development" })).toBe(true);
    expect(queryTraceEnabled({ SPLEEN_QUERY_TRACE: "1", NODE_ENV: "production" })).toBe(false);
    expect(queryTraceEnabled({ NODE_ENV: "development" })).toBe(false);
  });
});
