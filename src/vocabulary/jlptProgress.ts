import { JLPT_LEVEL_ORDER, JLPT_UNLOCK_RATIO, JlptLevel, JlptWord } from "./jlptTypes";

const PREFIX = "jlpt-vocab";

function keyLearned(level: JlptLevel): string {
  return `${PREFIX}-learned-${level}`;
}

function keyReset(level: JlptLevel): string {
  return `${PREFIX}-meta-${level}`;
}

function keyWrongReview(level: JlptLevel): string {
  return `${PREFIX}-wrong-review-${level}`;
}

/** ID các từ làm sai ở lần kiểm tra gần nhất (để ôn lại). */
export function loadWrongReviewIds(level: JlptLevel): string[] {
  try {
    const raw = localStorage.getItem(keyWrongReview(level));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function saveWrongReviewIds(level: JlptLevel, ids: string[]): void {
  localStorage.setItem(keyWrongReview(level), JSON.stringify([...new Set(ids)]));
}

export function clearWrongReviewIds(level: JlptLevel): void {
  localStorage.removeItem(keyWrongReview(level));
}

export function loadLearnedMap(level: JlptLevel): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(keyLearned(level));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLearnedMap(level: JlptLevel, map: Record<string, boolean>): void {
  localStorage.setItem(keyLearned(level), JSON.stringify(map));
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
  localStorage.removeItem(keyLearned(level));
  localStorage.setItem(keyReset(level), JSON.stringify({ resetAt: Date.now() }));
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
