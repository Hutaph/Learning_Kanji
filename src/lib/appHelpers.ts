import { DAILY_INSPIRATIONS } from "../data/dailyInspirations";
import { InspirationItem } from "../types";

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export function getDailyInspiration(date: Date): InspirationItem {
  const daySeed = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return DAILY_INSPIRATIONS[Math.abs(daySeed) % DAILY_INSPIRATIONS.length];
}

function getFirstSunday(year: number, monthIndex: number): Date {
  const firstDay = new Date(year, monthIndex, 1);
  firstDay.setHours(0, 0, 0, 0);
  const offset = (7 - firstDay.getDay()) % 7;
  return new Date(year, monthIndex, 1 + offset);
}

export function getNextJlptCountdown(now: Date): { daysLeft: number } {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const candidates = [
    getFirstSunday(currentYear, 6),
    getFirstSunday(currentYear, 11),
    getFirstSunday(currentYear + 1, 6)
  ];
  const target = candidates.find((d) => d.getTime() >= today.getTime()) ?? candidates[candidates.length - 1];
  const daysLeft = Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000));
  return { daysLeft };
}

export function getCurrentJlptLevelFromStorage(): JlptLevel {
  const levels: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];
  const rank = Object.fromEntries(levels.map((lv, idx) => [lv, idx])) as Record<JlptLevel, number>;
  const active = localStorage.getItem("jlpt_activeLevel");
  let best = (active && levels.includes(active as JlptLevel) ? active : "N5") as JlptLevel;
  for (const level of levels) {
    try {
      const raw = localStorage.getItem(`jlpt-vocab-learned-${level}`);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const hasLearned = Object.values(parsed || {}).some(Boolean);
      if (hasLearned && rank[level] > rank[best]) {
        best = level;
      }
    } catch {
      continue;
    }
  }
  return best;
}

export function getCurrentJlptStudyLabelFromStorage(): string {
  const level = getCurrentJlptLevelFromStorage();
  const lessonFilter = localStorage.getItem("jlpt_lessonFilter");
  const testLesson = localStorage.getItem("jlpt_testLesson");
  const lessonRaw = lessonFilter && lessonFilter !== "all" && lessonFilter !== "unassigned"
    ? lessonFilter
    : testLesson && testLesson !== "all" && testLesson !== "unassigned"
      ? testLesson
      : null;
  const lessonNum = lessonRaw ? Number(lessonRaw) : NaN;
  if (Number.isFinite(lessonNum) && lessonNum > 0) {
    return `Bài ${lessonNum} - ${level}`;
  }
  return level;
}

export function formatKanjiLessonLabel(studyGroup: string): string {
  if (!studyGroup || studyGroup === "Tất cả") {
    return "Tất cả";
  }
  const match = studyGroup.match(/\d+/);
  if (!match) {
    return studyGroup;
  }
  return `Bài ${match[0]}`;
}
