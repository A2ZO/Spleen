import { schema, seed, type DbHandle } from "@spleen/db";
import { fixtureId } from "@spleen/db/fixtures";
import { createTestDb } from "@spleen/db/testing";
import type { ListenTargetInput } from "@spleen/validators";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyListenWrite, type ListenWrite } from "./instant";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";
import type { MyItemState } from "./types";

/*
 * `applyListenWrite` (what the item page shows at once) against the server (what it saves):
 * the same click sequences go through both, and the states must match after every click and
 * at the end of the chain.
 */

let handle: DbHandle;
const now = new Date("2026-10-21T12:00:00Z");
const album: ListenTargetInput = { kind: "release", id: fixtureId(201) };
/** Track 1 of that album. */
const track: ListenTargetInput = { kind: "track", id: fixtureId(10_001) };

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db);
}, 60_000);

afterAll(async () => {
  await handle.close();
});

let count = 0;
async function member() {
  count += 1;
  const email = `instant${count}@example.test`;
  const [row] = await handle.db
    .insert(schema.user)
    .values({ name: "", email, emailVerified: true })
    .returning();
  const user: SessionUser = { id: row!.id, email };
  const call = createCaller(createContext({ now, db: () => handle.db, user: async () => user }));
  await call.account.onboard({
    username: `instant${count}`,
    displayName: `instant${count}`,
    termsAccepted: true,
    locale: "fr",
    theme: "dark",
    timeZone: "Europe/Paris",
  });
  return call;
}
type Call = Awaited<ReturnType<typeof member>>;

/** Edit times are wall clock: keep consecutive writes apart (`docs/pieges.md`). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

const form = { relisten: false, format: null, moodIds: [], trackRatings: [] };

/** Starting points: what a member may already have before clicking on the page. */
const starts: Record<string, { target: ListenTargetInput; setup: (call: Call) => Promise<void> }> =
  {
    empty: { target: album, setup: async () => {} },
    "dated, rated, liked": {
      target: album,
      setup: async (call) => {
        await call.listening.entry.create({ target: album, ...form, rating: 6, liked: true });
      },
    },
    "queued only": {
      target: album,
      setup: async (call) => {
        await call.listening.setWantToListen({ target: album, wantToListen: true });
      },
    },
    "undated with a review": {
      target: album,
      setup: async (call) => {
        await call.listening.quickRate({ target: album, rating: 8 });
        const state = await call.listening.myState(album);
        await call.review.create({
          target: album,
          body: "La contrebasse, surtout.",
          lang: "fr",
          entryId: state!.entries[0]!.id,
        });
      },
    },
    "track rated inside an album listen": {
      target: track,
      setup: async (call) => {
        await call.listening.entry.create({
          target: album,
          ...form,
          rating: null,
          liked: false,
          trackRatings: [{ trackId: track.id, rating: 4 }],
        });
        await call.listening.setWantToListen({ target: track, wantToListen: true });
      },
    },
  };

async function send(call: Call, target: ListenTargetInput, write: ListenWrite) {
  switch (write.kind) {
    case "rating":
      return call.listening.quickRate({ target, rating: write.rating });
    case "liked":
      return call.listening.quickLike({ target, liked: write.liked });
    case "wantToListen":
      return call.listening.setWantToListen({ target, wantToListen: write.wantToListen });
    case "listened":
      return call.listening.markListened(target);
  }
}

const shown = ({ rating, liked, listened, wantToListen, quickFallback }: MyItemState) => ({
  rating,
  liked,
  listened,
  wantToListen,
  quickFallback,
});

/** Deterministic pseudo-random writes (the same on every run). */
function sequence(seed: number, length: number): ListenWrite[] {
  let x = seed;
  const next = (n: number) => {
    x = (x * 1_103_515_245 + 12_345) % 2 ** 31;
    return x % n;
  };
  return Array.from({ length }, (): ListenWrite => {
    switch (next(7)) {
      case 0:
        return { kind: "rating", rating: 1 + next(10) };
      case 1:
        return { kind: "rating", rating: null };
      case 2:
        return { kind: "liked", liked: true };
      case 3:
        return { kind: "liked", liked: false };
      case 4:
        return { kind: "wantToListen", wantToListen: true };
      case 5:
        return { kind: "wantToListen", wantToListen: false };
      default:
        return { kind: "listened" };
    }
  });
}

describe("applyListenWrite matches the server", () => {
  const cases = Object.entries(starts).flatMap(([name, start]) =>
    [1, 2, 3, 4].map((n) => ({ name, start, writes: sequence(name.length * 97 + n, 7) })),
  );

  it.each(cases)("$name: %#", async ({ start, writes }) => {
    const call = await member();
    await start.setup(call);
    let server = (await call.listening.myState(start.target))!;
    let chained = server;
    for (const write of writes) {
      const expected = applyListenWrite(server, write);
      chained = applyListenWrite(chained, write);
      await tick();
      await send(call, start.target, write);
      server = (await call.listening.myState(start.target))!;
      expect(shown(expected), JSON.stringify(write)).toEqual(shown(server));
    }
    // The page applies several clicks before any answer: the chain must land on the same state.
    expect(shown(chained)).toEqual(shown(server));
  });
});
