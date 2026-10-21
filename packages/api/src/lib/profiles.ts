import { schema, sql, type Db } from "@spleen/db";

import { fixtureUsernameById, getProfileByUsername } from "../mock/repository";
import type { ProfileDetail } from "../types";
import { computeBaseStats } from "./stats";

/**
 * Public profile page. Identity (username, name, bio, avatar) comes from the database;
 * activity still comes from the mockup fixtures for demo members until milestones 5-6,
 * and is empty for real members.
 */
export async function getPublicProfile(
  db: Db,
  username: string,
  now: Date,
): Promise<ProfileDetail | null> {
  const [row] = await db
    .select()
    .from(schema.profiles)
    .where(sql`lower(${schema.profiles.username}) = ${username.toLowerCase()}`)
    .limit(1);
  if (!row) return null;

  const fixtureUsername = fixtureUsernameById(row.userId);
  const activity = fixtureUsername ? getProfileByUsername(fixtureUsername, now) : null;
  const identity = {
    id: row.userId,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
  };
  if (activity) return { ...activity, ...identity };

  return {
    ...identity,
    joinedOn: row.createdAt.toISOString().slice(0, 10),
    followerCount: 0,
    followingCount: 0,
    shelf: [null, null, null, null],
    recent: [],
    diary: [],
    reviews: [],
    lists: [],
    stats: computeBaseStats([], now.getUTCFullYear()),
  };
}
