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
