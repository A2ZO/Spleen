/** Stable, valid UUIDs for fixtures (UUID everywhere, as in the real schema). */
export const fixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
