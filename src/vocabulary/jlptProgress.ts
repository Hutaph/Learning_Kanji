import { JLPT_LEVEL_ORDER, JLPT_UNLOCK_RATIO, JlptLevel, JlptWord } from "./jlptTypes";
import { getJSON, getString, removeKey, setJSON, setString } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";

const PREFIX = "jlpt-vocab";
const JLPT_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

function keyLearned(level: JlptLevel): string {
  return STORAGE_KEYS.jlpt.learned(level);
}

function keyReset(level: JlptLevel): string {
  return `${PREFIX}-meta-${level}`;
}

function keyWrongReview(level: JlptLevel): string {
  return STORAGE_KEYS.jlpt.wrongReview(level);
}

/** ID các từ làm sai ở lần kiểm tra gần nhất (để ôn lại). */
export function loadWrongReviewIds(level: JlptLevel): string[] {
  const parsed = getJSON<unknown>(keyWrongReview(level), []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((id): id is string => typeof id === "string");
}

export function saveWrongReviewIds(level: JlptLevel, ids: string[]): void {
  setJSON(keyWrongReview(level), [...new Set(ids)]);
}

export function clearWrongReviewIds(level: JlptLevel): void {
  removeKey(keyWrongReview(level));
}

export function loadLearnedMap(level: JlptLevel): Record<string, boolean> {
  const parsed = getJSON<Record<string, boolean> | null>(keyLearned(level), {});
  if (typeof parsed !== "object" || !parsed) {
    return {};
  }
  return parsed;
}

export function saveLearnedMap(level: JlptLevel, map: Record<string, boolean>): void {
  setJSON(keyLearned(level), map);
}

export function toggleLearned(level: JlptLevel, wordId: string, learned: boolean): Record<string, boolean> {
  const map = { ...loadLearnedMap(level) };
  if (learned) {
    map[wordId] = true;
  } else {
    delete map[wordId];
  }
  saveLearnedMap(level, map);
  return map;
}

export function resetLearnedLevel(level: JlptLevel): void {
  removeKey(keyLearned(level));
  setJSON(keyReset(level), { resetAt: Date.now() });
}

export function countLearned(words: JlptWord[], map: Record<string, boolean>): number {
  return words.filter((w) => map[w.id]).length;
}

export function completionRate(words: JlptWord[], map: Record<string, boolean>): number {
  if (words.length === 0) {
    return 0;
  }
  return countLearned(words, map) / words.length;
}

/** Cấp `level` được mở khóa nếu cấp trước đạt ≥80% (và có dữ liệu). N5 luôn mở. */
export function isLevelUnlocked(
  level: JlptLevel,
  wordsByLevel: Record<JlptLevel, JlptWord[]>,
  learnedByLevel: Record<JlptLevel, Record<string, boolean>>
): boolean {
  if (level === "N5" || level === "N4") {
    return true;
  }
  const idx = JLPT_LEVEL_ORDER.indexOf(level);
  if (idx <= 0) {
    return true;
  }
  const prev = JLPT_LEVEL_ORDER[idx - 1];
  const prevWords = wordsByLevel[prev];
  if (!prevWords.length) {
    return false;
  }
  const rate = completionRate(prevWords, learnedByLevel[prev]);
  return rate >= JLPT_UNLOCK_RATIO;
}

export function nextLockedReason(
  level: JlptLevel,
  wordsByLevel: Record<JlptLevel, JlptWord[]>,
  learnedByLevel: Record<JlptLevel, Record<string, boolean>>
): string | null {
  if (isLevelUnlocked(level, wordsByLevel, learnedByLevel)) {
    return null;
  }
  if (level === "N5" || level === "N4") {
    return null;
  }
  const idx = JLPT_LEVEL_ORDER.indexOf(level);
  const prev = JLPT_LEVEL_ORDER[idx - 1];
  const prevWords = wordsByLevel[prev];
  if (!prevWords.length) {
    return `Cấp ${prev} chưa có bộ từ trong ứng dụng.`;
  }
  const need = Math.ceil(prevWords.length * JLPT_UNLOCK_RATIO);
  const have = countLearned(prevWords, learnedByLevel[prev]);
  return `Cần đánh dấu đã học ít nhất ${need}/${prevWords.length} từ ở cấp ${prev} (≥80%). Hiện tại: ${have}/${prevWords.length}.`;
}

export type JlptLocalState = {
  learned: Record<JlptLevel, Record<string, boolean>>;
  wrongReview: Record<JlptLevel, string[]>;
  settings: Record<string, string>;
};

const JLPT_GLOBAL_KEYS = [
  STORAGE_KEYS.jlpt.subView,
  STORAGE_KEYS.jlpt.activeLevel,
  STORAGE_KEYS.jlpt.lessonFilter,
  STORAGE_KEYS.jlpt.wordScope,
  STORAGE_KEYS.jlpt.testLesson,
  STORAGE_KEYS.jlpt.testMode,
  STORAGE_KEYS.jlpt.hideLearned
] as const;

function collectJlptDynamicSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) {
      continue;
    }
    if (key.startsWith("jlpt_list_shuffle_enabled_") || key.startsWith("jlpt_list_shuffle_order_")) {
      const value = getString(key);
      if (value != null) {
        out[key] = value;
      }
    }
  }
  return out;
}

export function exportJlptLocalState(): JlptLocalState {
  const learned = {} as Record<JlptLevel, Record<string, boolean>>;
  const wrongReview = {} as Record<JlptLevel, string[]>;
  for (const level of JLPT_LEVELS) {
    learned[level] = loadLearnedMap(level);
    wrongReview[level] = loadWrongReviewIds(level);
  }
  const settings: Record<string, string> = {};
  for (const key of JLPT_GLOBAL_KEYS) {
    const value = getString(key);
    if (value != null) {
      settings[key] = value;
    }
  }
  Object.assign(settings, collectJlptDynamicSettings());
  return {
    learned,
    wrongReview,
    settings
  };
}

export function importJlptLocalState(payload: JlptLocalState): void {
  for (const level of JLPT_LEVELS) {
    const learned = payload.learned?.[level];
    saveLearnedMap(level, learned && typeof learned === "object" ? learned : {});
    const wrong = payload.wrongReview?.[level];
    saveWrongReviewIds(level, Array.isArray(wrong) ? wrong : []);
  }

  for (const key of JLPT_GLOBAL_KEYS) {
    removeKey(key);
  }
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) {
      continue;
    }
    if (key.startsWith("jlpt_list_shuffle_enabled_") || key.startsWith("jlpt_list_shuffle_order_")) {
      removeKey(key);
    }
  }

  const entries = payload.settings && typeof payload.settings === "object" ? Object.entries(payload.settings) : [];
  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      continue;
    }
    setString(key, value);
  }
}
