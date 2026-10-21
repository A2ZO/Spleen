/** Runs once when the server starts: production refuses to boot with missing services. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionConfig } = await import("@spleen/infra/config");
    assertProductionConfig();
  }
}
