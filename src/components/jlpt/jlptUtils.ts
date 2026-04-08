import { getJSON } from "../../lib/storage";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { JlptLevel, JlptWord, WordScope } from "../../vocabulary/jlptTypes";

export type JlptSubView = "levels" | "list" | "testConfig" | "testRun";

export function keyListShuffleEnabled(level: JlptLevel): string {
  return STORAGE_KEYS.jlpt.shuffleEnabled(level);
}

export function keyListShuffleOrder(level: JlptLevel): string {
  return STORAGE_KEYS.jlpt.shuffleOrder(level);
}

export function loadListShuffleOrder(level: JlptLevel): string[] {
  const parsed = getJSON<unknown>(keyListShuffleOrder(level), []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((id): id is string => typeof id === "string");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function answerOk(expected: string, user: string): boolean {
  const e = normalize(expected);
  const u = normalize(user);
  if (!u) {
    return false;
  }
  if (e === u) {
    return true;
  }
  if (e.includes(u) || u.includes(e)) {
    return true;
  }
  const eParts = e.split(/[;,\/|]/).map((p) => p.trim()).filter(Boolean);
  return eParts.some((p) => p === u || p.includes(u) || u.includes(p));
}

export function buildPool(
  words: JlptWord[],
  learned: Record<string, boolean>,
  wordScope: WordScope,
  skipMemorized: boolean,
  lesson: number | "all" | "unassigned"
): JlptWord[] {
  let basePool = words;
  if (lesson === "unassigned") {
    basePool = words.filter((w) => w.lesson == null);
  } else if (lesson !== "all") {
    basePool = words.filter((w) => w.lesson === lesson);
  }

  if (wordScope === "memorized") {
    return shuffle(basePool.filter((w) => learned[w.id]));
  }
  let pool = [...basePool];
  if (skipMemorized) {
    pool = pool.filter((w) => !learned[w.id]);
  }
  return shuffle(pool);
}

export function takeCount(pool: JlptWord[], mode: "10" | "50" | "all" | "custom", custom: number): JlptWord[] {
  if (mode === "all") {
    return pool;
  }
  const n = mode === "10" ? 10 : mode === "50" ? 50 : Math.max(1, Math.min(custom, pool.length));
  return pool.slice(0, Math.min(n, pool.length));
}
