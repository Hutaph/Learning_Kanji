import { toHiragana } from "wanakana";
import { BASE_VOCABULARY, HAN_VIET_MAP } from "./kanjiData";
import { KanjiProgress, VocabularyEntry } from "../types";

const STORAGE_KEY = "kanji-learning-user-vocabulary";
const GROUP_KEY = "kanji-learning-groups";
const PROGRESS_KEY = "kanji-learning-progress";
const KANJI_REGEX = /\p{Script=Han}/u;
const LATIN_REGEX = /^[A-Za-z\s'-]+$/;
const DEFAULT_GROUP = "Chung";

function normalizeGroupName(groupName: string): string {
  const trimmed = (groupName || "").trim();
  if (!trimmed || trimmed === "Mặc định" || trimmed === "Bộ 2136") {
    return DEFAULT_GROUP;
  }
  return trimmed;
}

function toTitleCase(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function toHanVietFromKanji(input: string): string {
  const parts: string[] = [];
  for (const ch of input.trim()) {
    if (!KANJI_REGEX.test(ch)) {
      continue;
    }
    const mapped = HAN_VIET_MAP[ch];
    parts.push(mapped ? mapped : `[${ch}]`);
  }
  if (parts.length === 0) {
    return "Không tìm thấy chữ Kanji hợp lệ.";
  }
  return toTitleCase(parts.join(" "));
}

export function getAllVocabulary(): VocabularyEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  let userRows: VocabularyEntry[] = [];
  if (raw) {
    try {
      userRows = JSON.parse(raw) as VocabularyEntry[];
    } catch (_err) {
      userRows = [];
    }
  }
  // Backward compatibility for rows saved before introducing groups.
  const normalizedUserRows = userRows.map((row) => ({
    ...row,
    group: normalizeGroupName(row.group),
    meaningVi: (row as VocabularyEntry & { meaning?: string }).meaningVi || (row as VocabularyEntry & { meaning?: string }).meaning || "",
    meaningEn: row.meaningEn || ""
  }));
  return [...normalizedUserRows, ...BASE_VOCABULARY];
}

export function getGroups(): string[] {
  const raw = localStorage.getItem(GROUP_KEY);
  const customGroups = raw ? ((JSON.parse(raw) as string[]) ?? []) : [];
  const normalizedCustom = customGroups.map(normalizeGroupName).filter((name) => name !== DEFAULT_GROUP);
  const fromVocabulary = getAllVocabulary().map((item) => item.group);
  return Array.from(new Set([DEFAULT_GROUP, ...normalizedCustom, ...fromVocabulary]));
}

export function addGroup(nameInput: string): string[] {
  const name = nameInput.trim();
  if (!name) {
    return getGroups();
  }
  const normalized = normalizeGroupName(name);
  if (!normalized || normalized === DEFAULT_GROUP) {
    return getGroups();
  }
  const raw = localStorage.getItem(GROUP_KEY);
  const current = raw ? ((JSON.parse(raw) as string[]) ?? []) : [];
  if (!current.includes(normalized)) {
    current.push(normalized);
    localStorage.setItem(GROUP_KEY, JSON.stringify(current));
  }
  return getGroups();
}

export function deleteGroup(nameInput: string): string[] {
  const name = normalizeGroupName(nameInput);
  if (!name || name === DEFAULT_GROUP) {
    return getGroups();
  }

  const rawGroups = localStorage.getItem(GROUP_KEY);
  const currentGroups = rawGroups ? ((JSON.parse(rawGroups) as string[]) ?? []) : [];
  const nextGroups = currentGroups.filter((group) => group !== name);
  localStorage.setItem(GROUP_KEY, JSON.stringify(nextGroups));

  // Reassign vocabulary in deleted group back to default group.
  const rawRows = localStorage.getItem(STORAGE_KEY);
  const rows = rawRows ? ((JSON.parse(rawRows) as VocabularyEntry[]) ?? []) : [];
  const nextRows = rows.map((row) => ({
    ...row,
    group: normalizeGroupName(row.group) === name ? DEFAULT_GROUP : normalizeGroupName(row.group)
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRows));

  return getGroups();
}

function normalizeReadingInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  // Keep Japanese IME output as entered; only auto-convert pure Latin romaji.
  if (LATIN_REGEX.test(trimmed)) {
    return toHiragana(trimmed);
  }
  return trimmed;
}

export function addVocabulary(
  word: string,
  readingInput: string,
  meaningViInput: string,
  meaningEnInput: string,
  groupInput: string
): VocabularyEntry {
  const reading = normalizeReadingInput(readingInput);
  const item: VocabularyEntry = {
    id: `user-${Date.now()}`,
    word: word.trim(),
    reading,
    meaningVi: meaningViInput.trim(),
    meaningEn: meaningEnInput.trim(),
    group: groupInput.trim() || DEFAULT_GROUP,
    createdAt: new Date().toISOString()
  };
  const raw = localStorage.getItem(STORAGE_KEY);
  const rows = raw ? ((JSON.parse(raw) as VocabularyEntry[]) ?? []) : [];
  rows.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  return item;
}

export function deleteVocabularyById(id: string): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  const rows = raw ? ((JSON.parse(raw) as VocabularyEntry[]) ?? []) : [];
  const next = rows.filter((row) => row.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getKanjiCharacters(text: string): string[] {
  return Array.from(new Set(Array.from(text).filter((ch) => KANJI_REGEX.test(ch))));
}

export function findByKanjiCharacter(kanji: string, rows: VocabularyEntry[]): VocabularyEntry[] {
  return rows.filter((row) => row.word.includes(kanji));
}

export function findByReading(readingInput: string, rows: VocabularyEntry[]): VocabularyEntry[] {
  const normalized = toHiragana(readingInput.trim());
  if (!normalized) {
    return [];
  }
  return rows.filter((row) => row.reading.includes(normalized));
}

export function toReadingPreview(input: string): string {
  if (!input.trim()) {
    return "";
  }
  return toHiragana(input);
}

export function suggestVocabularyByWordInput(input: string, rows: VocabularyEntry[]): VocabularyEntry | null {
  const normalized = normalizeReadingInput(input);
  if (!normalized) {
    return null;
  }

  const scored = rows
    .map((row) => {
      if (row.reading === normalized) {
        return { row, score: 0 };
      }
      if (row.reading.startsWith(normalized)) {
        return { row, score: 1 };
      }
      if (row.reading.includes(normalized)) {
        return { row, score: 2 };
      }
      return null;
    })
    .filter(Boolean) as Array<{ row: VocabularyEntry; score: number }>;

  if (scored.length === 0) {
    return null;
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return a.row.reading.length - b.row.reading.length;
  });

  return scored[0].row;
}

function readProgressMap(): Record<string, KanjiProgress> {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, KanjiProgress>;
  } catch (_err) {
    return {};
  }
}

function writeProgressMap(progressMap: Record<string, KanjiProgress>): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));
}

export function getKanjiProgressMap(): Record<string, KanjiProgress> {
  return readProgressMap();
}

export function markKanjiKnown(kanji: string): Record<string, KanjiProgress> {
  const map = readProgressMap();
  const now = Date.now();
  const current = map[kanji];
  const nextScore = Math.min(8, (current?.score || 0) + 1);
  const baseInterval = current?.intervalDays && current.intervalDays > 0 ? current.intervalDays : 1;
  const nextInterval = Math.min(30, Math.max(1, Math.round(baseInterval * 1.8)));
  map[kanji] = {
    known: true,
    score: nextScore,
    intervalDays: nextInterval,
    dueAt: now + nextInterval * 24 * 60 * 60 * 1000,
    lastReviewedAt: now
  };
  writeProgressMap(map);
  return map;
}

export function markKanjiUnknown(kanji: string): Record<string, KanjiProgress> {
  const map = readProgressMap();
  const now = Date.now();
  const current = map[kanji];
  map[kanji] = {
    known: false,
    score: Math.max(0, (current?.score || 0) - 1),
    intervalDays: 0,
    dueAt: now,
    lastReviewedAt: now
  };
  writeProgressMap(map);
  return map;
}
