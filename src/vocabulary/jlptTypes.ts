export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export interface JlptWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  /** Âm Hán Việt từng chữ (từ kanjiImported), ví dụ "Thông - Đạo" */
  hanViet?: string;
  /** Bài Minna (1–25) nếu đã gán; null nếu không xác định */
  lesson: number | null;
  /** Thẻ/ghi chú gốc từ deck (tùy bản APKG) */
  tags?: string[];
}

export interface N5VocabularyFile {
  meta?: {
    title?: string;
    source?: string;
    sourceNote?: string;
    extractedAt?: string;
  };
  words: JlptWord[];
}

export type WordScope = "all" | "memorized";
export type TestMode = "meaning" | "kanji" | "both";

export const JLPT_UNLOCK_RATIO = 0.8;

export const JLPT_LEVEL_ORDER: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];
