import React, { useEffect, useMemo, useState } from "react";
import { loadLearnedMap, countLearned } from "../vocabulary/jlptProgress";
import n5Pack from "../data/n5Vocabulary.json";
import n4Pack from "../data/n4Vocabulary.json";
import { getJSON, setJSON } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";

type TrendRange = "day" | "week" | "month";
type HistoryEntry = {
  date: string;
  kanjiKnown: number;
  vocabLearned: number;
  verbLearned: number;
};

const DAY_MS = 86400000;

export function HomeInsightsPanel({
  dueCardsCount,
  unknownCardsCount,
  knownCardsCount,
  totalVocabulary,
  totalGroups
}: {
  dueCardsCount: number;
  unknownCardsCount: number;
  knownCardsCount: number;
  totalVocabulary: number;
  totalGroups: number;
}) {
  const [learnedN5] = useState(() => loadLearnedMap("N5"));
  const [learnedN4] = useState(() => loadLearnedMap("N4"));
  const [expandedJlpt, setExpandedJlpt] = useState<"N5" | "N4" | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>("week");
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const verbLearned = useMemo(() => {
    const map = getJSON<Record<string, boolean>>(STORAGE_KEYS.verb.learnedMap, {});
    return Object.values(map).filter(Boolean).length;
  }, [knownCardsCount, totalVocabulary]);

  const n5Words = (n5Pack as any).words || [];
  const n4Words = (n4Pack as any).words || [];
  
  const n5Learned = countLearned(n5Words, learnedN5);
  const n4Learned = countLearned(n4Words, learnedN4);
  const n5Total = n5Words.length;
  const n4Total = n4Words.length;
  
  const n5Rate = n5Total > 0 ? Math.round((n5Learned / n5Total) * 100) : 0;
  const n4Rate = n4Total > 0 ? Math.round((n4Learned / n4Total) * 100) : 0;
  const jlptTotal = n5Total + n4Total;
  const jlptLearned = n5Learned + n4Learned;
  const jlptRate = jlptTotal > 0 ? Math.round((jlptLearned / jlptTotal) * 100) : 0;
  const activeLoad = dueCardsCount + unknownCardsCount;

  useEffect(() => {
    const todayKey = toDayKey(new Date());
    const next = upsertHistory(history, {
      date: todayKey,
      kanjiKnown: knownCardsCount,
      vocabLearned: jlptLearned,
      verbLearned
    });
    const changed = next.length !== history.length || next.some((item, idx) => item !== history[idx]);
    if (changed) {
      setHistory(next);
      setJSON(STORAGE_KEYS.insights.history, next);
    }
  }, [history, knownCardsCount, jlptLearned, verbLearned]);

  const trendSeries = useMemo(
    () => buildTrendSeries(history, trendRange),
    [history, trendRange]
  );

  const getLessonBreakdown = (words: any[], learnedMap: Record<string, boolean>) => {
    const lessonMap: Record<number, { total: number; learned: number }> = {};
    for (const w of words) {
      if (!w.lesson) continue;
      if (!lessonMap[w.lesson]) lessonMap[w.lesson] = { total: 0, learned: 0 };
      lessonMap[w.lesson].total++;
      if (learnedMap[w.id]) lessonMap[w.lesson].learned++;
    }
    return Object.entries(lessonMap)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([L, data]) => ({ lesson: Number(L), ...data }));
  };

  return (
    <section className="card insightsCard">
      <h2>Thống kê học tập chung</h2>
      <p className="muted">Tổng quan tiến độ học hiện tại.</p>
      <div className="insightsGrid">
        <article className="insightPanel surfaceCard">
          <h3>Tiến độ JLPT Từ vựng</h3>
          <div className="masteryGroups">
            <div 
              className="masteryItem" 
              onClick={() => setExpandedJlpt(p => p === "N5" ? null : "N5")}
              style={{ cursor: "pointer", transition: "transform 0.2s" }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
              title="Chi tiết theo bài N5"
            >
              <div className="masteryRing" style={{ ["--progress" as string]: `${n5Rate}` }}>
                <span>{n5Rate}%</span>
              </div>
              <p className="masteryGroupName">N5</p>
              <p className="muted masteryTiny">
                {n5Learned}/{n5Total} từ
              </p>
            </div>
            <div 
              className="masteryItem"
              onClick={() => setExpandedJlpt(p => p === "N4" ? null : "N4")}
              style={{ cursor: "pointer", transition: "transform 0.2s" }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
              title="Chi tiết theo bài N4"
            >
              <div className="masteryRing" style={{ ["--progress" as string]: `${n4Rate}` }}>
                <span>{n4Rate}%</span>
              </div>
              <p className="masteryGroupName">N4</p>
              <p className="muted masteryTiny">
                {n4Learned}/{n4Total} từ
              </p>
            </div>
          </div>
          
          {expandedJlpt && (
             <div style={{ marginTop: "16px", padding: "14px", background: "var(--surface)", borderTop: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
               <h4 style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "var(--accent)" }}>Chi tiết {expandedJlpt}</h4>
               <div className="barList" style={{ maxHeight: "250px", overflowY: "auto", paddingRight: "10px" }}>
                 {getLessonBreakdown(expandedJlpt === "N5" ? n5Words : n4Words, expandedJlpt === "N5" ? learnedN5 : learnedN4).map(item => {
                    const pct = Math.round((item.learned / item.total) * 100);
                    return (
                      <div key={item.lesson} className="barItem">
                         <div className="barHeader" style={{ fontSize: "0.8125rem" }}>
                           <span>Bài {item.lesson}</span>
                           <strong>{pct}% ({item.learned}/{item.total})</strong>
                         </div>
                         <div className="barTrack" style={{ height: "6px" }}>
                           <div className="barFill" style={{ width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--accent)" }} />
                         </div>
                      </div>
                    );
                 })}
               </div>
             </div>
          )}
          <div className="statsMini">
            <span>Tổng JLPT: {jlptLearned}/{jlptTotal}</span>
            <span>Hoàn thành: {jlptRate}%</span>
          </div>
        </article>

        <article className="insightPanel surfaceCard">
          <div className="chartHeaderRow">
            <h3>Xu hướng học tập</h3>
            <div className="trendToggle segmentedRow" role="tablist" aria-label="Chọn khung thời gian">
              <button type="button" className={trendRange === "day" ? "trendBtn segmentedBtn isOn isSelected" : "trendBtn segmentedBtn"} onClick={() => setTrendRange("day")}>
                Ngày
              </button>
              <button type="button" className={trendRange === "week" ? "trendBtn segmentedBtn isOn isSelected" : "trendBtn segmentedBtn"} onClick={() => setTrendRange("week")}>
                Tuần
              </button>
              <button type="button" className={trendRange === "month" ? "trendBtn segmentedBtn isOn isSelected" : "trendBtn segmentedBtn"} onClick={() => setTrendRange("month")}>
                Tháng
              </button>
            </div>
          </div>
          <TrendLineChart data={trendSeries} />
          <div className="chartLegend">
            <span><i className="legendDot kanji" />Kanji học trong kỳ</span>
            <span><i className="legendDot vocab" />Từ vựng JLPT học trong kỳ</span>
            <span><i className="legendDot verb" />Động từ học trong kỳ</span>
          </div>
        </article>

        <article className="insightPanel surfaceCard">
          <h3>Ưu tiên học hôm nay</h3>
          <div className="overviewList">
            <div>
              <p className="muted">Khối lượng cần xử lý</p>
              <strong>{activeLoad} thẻ</strong>
            </div>
            <div>
              <p className="muted">Thẻ đến hạn ôn</p>
              <strong>{dueCardsCount} thẻ</strong>
            </div>
            <div>
              <p className="muted">Thẻ chưa thuộc</p>
              <strong>{unknownCardsCount} thẻ</strong>
            </div>
            <div>
              <p className="muted">Kế hoạch gợi ý</p>
              <strong>{dueCardsCount > 0 ? "Ôn thẻ đến hạn trước, sau đó học mới." : "Đẩy thêm từ mới để tăng tiến độ."}</strong>
            </div>
          </div>
        </article>

        <article className="insightPanel surfaceCard">
          <h3>Mục tiêu và tài nguyên</h3>
          <div className="overviewList">
            <div>
              <p className="muted">Nhóm học Kanji</p>
              <strong>{totalGroups}</strong>
            </div>
            <div>
              <p className="muted">Từ vựng tự thêm</p>
              <strong>{totalVocabulary}</strong>
            </div>
            <div>
              <p className="muted">Kanji đã thuộc</p>
              <strong>{knownCardsCount}</strong>
            </div>
            <div>
              <p className="muted">Mức hoàn thành JLPT</p>
              <strong>{jlptRate}%</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadHistory(): HistoryEntry[] {
  const parsed = getJSON<unknown>(STORAGE_KEYS.insights.history, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter((entry): entry is HistoryEntry => {
      return Boolean(
        entry &&
          typeof entry === "object" &&
          typeof (entry as { date?: unknown }).date === "string" &&
          typeof (entry as { kanjiKnown?: unknown }).kanjiKnown === "number" &&
          typeof (entry as { vocabLearned?: unknown }).vocabLearned === "number"
      );
    })
    .map((entry) => ({
      ...entry,
      verbLearned: typeof (entry as { verbLearned?: unknown }).verbLearned === "number" ? (entry as { verbLearned: number }).verbLearned : 0
    }))
    .slice(-420);
}

function upsertHistory(history: HistoryEntry[], nextEntry: HistoryEntry): HistoryEntry[] {
  const copy = [...history];
  const index = copy.findIndex((item) => item.date === nextEntry.date);
  if (index >= 0) {
    const prev = copy[index];
    if (
      prev.kanjiKnown === nextEntry.kanjiKnown &&
      prev.vocabLearned === nextEntry.vocabLearned &&
      prev.verbLearned === nextEntry.verbLearned
    ) {
      return history;
    }
    copy[index] = nextEntry;
  } else {
    copy.push(nextEntry);
  }
  copy.sort((a, b) => a.date.localeCompare(b.date));
  return copy.slice(-420);
}

function buildTrendSeries(
  history: HistoryEntry[],
  range: TrendRange
): Array<{ label: string; kanji: number; vocab: number; verb: number }> {
  const dailyDeltaMap = buildDailyDeltaMap(history);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (range === "day") {
    const points: Array<{ label: string; kanji: number; vocab: number; verb: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      const key = toDayKey(d);
      const item = dailyDeltaMap.get(key);
      points.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        kanji: item?.kanji ?? 0,
        vocab: item?.vocab ?? 0,
        verb: item?.verb ?? 0
      });
    }
    return points;
  }

  if (range === "week") {
    const points: Array<{ label: string; kanji: number; vocab: number; verb: number }> = [];
    for (let w = 11; w >= 0; w--) {
      const end = new Date(now.getTime() - w * 7 * DAY_MS);
      const start = new Date(end.getTime() - 6 * DAY_MS);
      let kanji = 0;
      let vocab = 0;
      let verb = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start.getTime() + i * DAY_MS);
        const key = toDayKey(d);
        const item = dailyDeltaMap.get(key);
        if (item) {
          kanji += item.kanji;
          vocab += item.vocab;
          verb += item.verb;
        }
      }
      points.push({
        label: `${start.getDate()}/${start.getMonth() + 1}`,
        kanji,
        vocab,
        verb
      });
    }
    return points;
  }

  const points: Array<{ label: string; kanji: number; vocab: number; verb: number }> = [];
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthStr = String(d.getMonth() + 1).padStart(2, "0");
    const monthPrefix = `${d.getFullYear()}-${monthStr}-`;
    let kanji = 0;
    let vocab = 0;
    let verb = 0;
    for (const [dateKey, item] of dailyDeltaMap.entries()) {
      if (dateKey.startsWith(monthPrefix)) {
        kanji += item.kanji;
        vocab += item.vocab;
        verb += item.verb;
      }
    }
    points.push({
      label: `${monthStr}/${String(d.getFullYear()).slice(-2)}`,
      kanji,
      vocab,
      verb
    });
  }
  return points;
}

function TrendLineChart({ data }: { data: Array<{ label: string; kanji: number; vocab: number; verb: number }> }) {
  if (!data.length) {
    return <p className="muted">Chưa có dữ liệu lịch sử để hiển thị biểu đồ.</p>;
  }

  const width = 680;
  const height = 240;
  const padX = 40;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const maxY = Math.max(3, ...data.map((d) => Math.max(d.kanji, d.vocab, d.verb)));
  const minY = 0;
  const scaleX = (idx: number) => padX + (idx / Math.max(1, data.length - 1)) * innerW;
  const scaleY = (value: number) => padY + (1 - (value - minY) / Math.max(1, maxY - minY)) * innerH;
  const yTicks = [maxY, Math.ceil(maxY / 2), 0];

  const pathFor = (key: "kanji" | "vocab" | "verb") =>
    data
      .map((item, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(idx)} ${scaleY(item[key])}`)
      .join(" ");

  const tickStep = Math.max(1, Math.ceil(data.length / 6));
  const labelTicks = data
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => idx % tickStep === 0 || idx === data.length - 1);

  return (
    <div className="trendChartWrap">
      <svg className="trendChart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Biểu đồ xu hướng học tập">
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} className="trendAxis" />
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} className="trendAxis" />
        {yTicks.map((tick) => (
          <text key={`tick-${tick}`} x={6} y={scaleY(tick) + 4} className="trendAxisLabel">
            {tick}
          </text>
        ))}
        {[0.25, 0.5, 0.75].map((step) => {
          const y = padY + innerH * step;
          return <line key={step} x1={padX} y1={y} x2={width - padX} y2={y} className="trendGrid" />;
        })}
        <path d={pathFor("kanji")} className="trendLineKanji" />
        <path d={pathFor("vocab")} className="trendLineVocab" />
        <path d={pathFor("verb")} className="trendLineVerb" />
        {data.map((item, idx) => {
          const x = scaleX(idx);
          return (
            <g key={item.label}>
              <circle cx={x} cy={scaleY(item.kanji)} r="2.8" className="trendDotKanji" />
              <circle cx={x} cy={scaleY(item.vocab)} r="2.8" className="trendDotVocab" />
              <circle cx={x} cy={scaleY(item.verb)} r="2.8" className="trendDotVerb" />
            </g>
          );
        })}
      </svg>
      <div className="trendLabels">
        {labelTicks.map(({ item, idx }) => (
          <span key={`${item.label}-${idx}`}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function buildDailyDeltaMap(history: HistoryEntry[]): Map<string, { kanji: number; vocab: number; verb: number }> {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<string, { kanji: number; vocab: number; verb: number }>();
  let prev: HistoryEntry | null = null;
  for (const item of sorted) {
    if (!prev) {
      // If this is the first tracked day, keep the captured totals as that day's progress.
      out.set(item.date, {
        kanji: Math.max(0, item.kanjiKnown),
        vocab: Math.max(0, item.vocabLearned),
        verb: Math.max(0, item.verbLearned)
      });
      prev = item;
      continue;
    }
    out.set(item.date, {
      kanji: Math.max(0, item.kanjiKnown - prev.kanjiKnown),
      vocab: Math.max(0, item.vocabLearned - prev.vocabLearned),
      verb: Math.max(0, item.verbLearned - prev.verbLearned)
    });
    prev = item;
  }
  return out;
}
