import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { FullResult, Reporter, Suite } from "@playwright/test/reporter";

/**
 * Writes the run's counts to `test-results/e2e-summary.json`, which `pnpm e2e:quiet`
 * (`scripts/e2e-quiet.mjs`) prints as one line: Turbo hides the output of a passing task.
 */
export default class SummaryReporter implements Reporter {
  private root: Suite | null = null;

  onBegin(_config: unknown, suite: Suite) {
    this.root = suite;
  }

  onEnd(result: FullResult) {
    const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    for (const test of this.root?.allTests() ?? []) {
      const outcome = test.outcome();
      if (outcome === "expected") counts.passed += 1;
      else if (outcome === "unexpected") counts.failed += 1;
      else if (outcome === "flaky") counts.flaky += 1;
      else counts.skipped += 1;
    }
    const dir = path.resolve("test-results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "e2e-summary.json"),
      JSON.stringify({ ...counts, status: result.status, durationMs: result.duration }),
    );
  }

  printsToStdio() {
    return false;
  }
}
