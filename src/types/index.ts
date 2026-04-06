export interface VocabularyEntry {
  id: string;
  word: string;
  reading: string;
  meaningVi: string;
  meaningEn: string;
  group: string;
  createdAt: string;
}

export interface KanjiProgress {
  known: boolean;
  score: number;
  intervalDays: number;
  dueAt: number;
  lastReviewedAt: number;
}

export interface FlashCard {
  kanji: string;
  hanViet: string;
  image: string;
  vocabulary: VocabularyEntry[];
}

export interface ImportedKanjiRecord {
  id: string;
  kanji: string;
  hanViet: string;
  image: string;
}

export type VerbType = "godan" | "ichidan" | "irregular";
export type VerbLevel = "N5" | "N4";

export interface InspirationItem {
  kanji: string;
  hanViet: string;
  keyword: string;
  quoteJa: string;
  reading: string;
  meaningVi: string;
}

export interface VerbLesson {
  dictionary: string;
  kana: string;
  meaningVi: string;
  jlpt: VerbLevel;
  type: VerbType;
}

export interface VerbConjugation {
  label: string;
  form: string;
  note: string;
}

export interface GroupStat {
  group: string;
  count: number;
}

export interface KanjiFrequency {
  kanji: string;
  count: number;
}

export interface GroupMasteryStat {
  group: string;
  known: number;
  total: number;
  rate: number;
}
