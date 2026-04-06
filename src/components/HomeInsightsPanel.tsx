import React, { useState } from "react";
import { loadLearnedMap, countLearned } from "../vocabulary/jlptProgress";
import n5Pack from "../data/n5Vocabulary.json";
import n4Pack from "../data/n4Vocabulary.json";
import { GroupMasteryStat, GroupStat, KanjiFrequency } from "../types";

export function HomeInsightsPanel({
  masteryRate,
  recentGroupMastery,
  dueCardsCount,
  unknownCardsCount,
  totalVocabulary,
  totalGroups,
  topGroups,
  topKanji,
  insight
}: {
  masteryRate: number;
  recentGroupMastery: GroupMasteryStat[];
  dueCardsCount: number;
  unknownCardsCount: number;
  totalVocabulary: number;
  totalGroups: number;
  topGroups: GroupStat[];
  topKanji: KanjiFrequency[];
  insight: string;
}) {
  const [learnedN5] = useState(() => loadLearnedMap("N5"));
  const [learnedN4] = useState(() => loadLearnedMap("N4"));
  const [expandedJlpt, setExpandedJlpt] = useState<"N5" | "N4" | null>(null);

  const n5Words = (n5Pack as any).words || [];
  const n4Words = (n4Pack as any).words || [];
  
  const n5Learned = countLearned(n5Words, learnedN5);
  const n4Learned = countLearned(n4Words, learnedN4);
  const n5Total = n5Words.length;
  const n4Total = n4Words.length;
  
  const n5Rate = n5Total > 0 ? Math.round((n5Learned / n5Total) * 100) : 0;
  const n4Rate = n4Total > 0 ? Math.round((n4Learned / n4Total) * 100) : 0;

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
      <p className="muted">Tiến độ chinh phục từ vựng và flashcard Kanji.</p>
      <div className="insightsGrid">
        <article className="insightPanel">
          <h3>Tiến độ JLPT Từ Vựng (Minna)</h3>
          <div className="masteryGroups">
            <div 
              className="masteryItem" 
              onClick={() => setExpandedJlpt(p => p === "N5" ? null : "N5")}
              style={{ cursor: "pointer", transition: "transform 0.2s" }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
              title="Bấm để xem chi tiết từng bài N5"
            >
              <div className="masteryRing" style={{ ["--progress" as string]: `${n5Rate}` }}>
                <span>{n5Rate}%</span>
              </div>
              <p className="masteryGroupName">Sơ cấp (N5)</p>
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
              title="Bấm để xem chi tiết từng bài N4"
            >
              <div className="masteryRing" style={{ ["--progress" as string]: `${n4Rate}` }}>
                <span>{n4Rate}%</span>
              </div>
              <p className="masteryGroupName">Sơ trung cấp (N4)</p>
              <p className="muted masteryTiny">
                {n4Learned}/{n4Total} từ
              </p>
            </div>
          </div>
          
          {expandedJlpt && (
             <div style={{ marginTop: "16px", padding: "14px", background: "var(--surface)", borderTop: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
               <h4 style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "var(--accent)" }}>Chi tiết tiến độ {expandedJlpt} (Click để đóng)</h4>
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
            <span>Tổng từ vựng: {n5Total + n4Total}</span>
            <span>Tổng đã nhớ: {n5Learned + n4Learned}</span>
          </div>
        </article>

        <article className="insightPanel">
          <h3>Tiến độ Flashcard Kanji (Tự tạo)</h3>
          {recentGroupMastery.length === 0 ? (
            <p className="muted">Chưa có nhóm Flashcard nào được đánh giá thuộc.</p>
          ) : (
            <div className="barList">
              {recentGroupMastery.map((item) => (
                <div key={item.group} className="barItem">
                  <div className="barHeader">
                    <span>{item.group}</span>
                    <strong>{item.rate}%</strong>
                  </div>
                  <div className="barTrack">
                    <div className="barFill" style={{ width: `${item.rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="insightPanel">
          <h3>Tổng quan Bộ Từ vựng (Custom)</h3>
          <div className="overviewList">
            <div>
              <p className="muted">Tổng số nhóm học (Folder)</p>
              <strong>{totalGroups}</strong>
            </div>
            <div>
              <p className="muted">Từ vựng đã thêm tay</p>
              <strong>{totalVocabulary}</strong>
            </div>
            <div>
              <p className="muted">Gợi ý học tập hôm nay</p>
              <strong>{dueCardsCount > 0 ? "Ưu tiên ôn Flashcard Kanji đến hạn" : "Khám phá từ vựng Minna!"}</strong>
            </div>
          </div>
        </article>

        <article className="insightPanel">
          <h3>Tình trạng Bộ Nhớ Kanji hiện tại</h3>
          <div className="overviewList">
            <div>
              <p className="muted">Đến hạn ôn (Hôm nay)</p>
              <strong>{dueCardsCount} thẻ</strong>
            </div>
            <div>
              <p className="muted">Lần đầu tiếp xúc (Chưa thuộc)</p>
              <strong>{unknownCardsCount} thẻ</strong>
            </div>
            <div>
              <p className="muted">Thuộc nằm lòng (Đã thuộc)</p>
              <strong>{totalVocabulary > 0 ? Math.round(masteryRate) : 0}% thẻ</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
