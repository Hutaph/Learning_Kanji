import React, { useEffect, useMemo, useState } from "react";
import { VerbLesson, VerbType } from "../types";
import { getJSON, getString, setJSON, setString } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { conjugateVerb, verbTypeToLabel } from "../verbs/conjugate";

function loadLearnedMap(): Record<string, boolean> {
  return getJSON<Record<string, boolean>>(STORAGE_KEYS.verb.learnedMap, {});
}

function saveLearnedMap(map: Record<string, boolean>): void {
  setJSON(STORAGE_KEYS.verb.learnedMap, map);
}

function loadOrderIds(): string[] {
  const parsed = getJSON<unknown>(STORAGE_KEYS.verb.shuffleOrder, []);
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function VerbStudyPanel({
  verbs,
  typeFilter,
  onTypeFilterChange
}: {
  verbs: VerbLesson[];
  typeFilter: "Tất cả" | VerbType;
  onTypeFilterChange: (value: "Tất cả" | VerbType) => void;
}) {
  const [activeTab, setActiveTab] = useState<"conjugation" | "quiz">("conjugation");
  const [expandedVerbIds, setExpandedVerbIds] = useState<Set<string>>(new Set());
  const [learnedMap, setLearnedMap] = useState<Record<string, boolean>>(() => loadLearnedMap());
  const [hideLearned, setHideLearned] = useState(() => getString(STORAGE_KEYS.verb.hideLearned) === "1");
  const [shuffleEnabled, setShuffleEnabled] = useState(() => getString(STORAGE_KEYS.verb.shuffleEnabled) === "1");
  const [shuffleOrderIds, setShuffleOrderIds] = useState<string[]>(() => loadOrderIds());
  const [quizScope, setQuizScope] = useState<"all" | "unlearned" | "learned">(() => {
    const raw = getString(STORAGE_KEYS.verb.quizScope);
    return raw === "unlearned" || raw === "learned" ? raw : "all";
  });
  const [quizSeed, setQuizSeed] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCount, setQuizCount] = useState(0);

  const learnedCount = useMemo(() => verbs.filter((v) => learnedMap[v.id]).length, [verbs, learnedMap]);

  const orderedVerbs = useMemo(() => {
    if (!shuffleEnabled) return verbs;
    const orderMap = new Map<string, number>();
    for (let i = 0; i < shuffleOrderIds.length; i++) {
      orderMap.set(shuffleOrderIds[i], i);
    }
    return [...verbs].sort((a, b) => {
      const ia = orderMap.get(a.id);
      const ib = orderMap.get(b.id);
      if (ia == null && ib == null) return 0;
      if (ia == null) return 1;
      if (ib == null) return -1;
      return ia - ib;
    });
  }, [verbs, shuffleEnabled, shuffleOrderIds]);

  const listVerbs = useMemo(() => {
    if (!hideLearned) return orderedVerbs;
    return orderedVerbs.filter((v) => !learnedMap[v.id]);
  }, [orderedVerbs, hideLearned, learnedMap]);

  const quizPool = useMemo(() => {
    if (quizScope === "learned") return verbs.filter((v) => learnedMap[v.id]);
    if (quizScope === "unlearned") return verbs.filter((v) => !learnedMap[v.id]);
    return verbs;
  }, [quizScope, verbs, learnedMap]);

  useEffect(() => {
    setString(STORAGE_KEYS.verb.hideLearned, hideLearned ? "1" : "0");
    setString(STORAGE_KEYS.verb.shuffleEnabled, shuffleEnabled ? "1" : "0");
    setJSON(STORAGE_KEYS.verb.shuffleOrder, shuffleOrderIds);
    setString(STORAGE_KEYS.verb.quizScope, quizScope);
  }, [hideLearned, shuffleEnabled, shuffleOrderIds, quizScope]);

  useEffect(() => {
    if (!shuffleEnabled) return;
    const ids = verbs.map((v) => v.id);
    const idSet = new Set(ids);
    const normalized = shuffleOrderIds.filter((id) => idSet.has(id));
    const normalizedSet = new Set(normalized);
    const missing = ids.filter((id) => !normalizedSet.has(id));
    if (missing.length > 0 || normalized.length !== shuffleOrderIds.length) {
      setShuffleOrderIds([...normalized, ...shuffle(missing)]);
    }
  }, [verbs, shuffleEnabled, shuffleOrderIds]);

  const meaningQuiz = useMemo(() => {
    if (quizPool.length < 4) {
      return null;
    }
    const question = quizPool[Math.floor(Math.random() * quizPool.length)];
    const correct = question.meaningVi;
    const distractors = shuffle(
      Array.from(
        new Set(
          quizPool
            .map((v) => v.meaningVi)
            .filter((m) => m && m !== correct)
        )
      )
    ).slice(0, 3);
    if (distractors.length < 3) {
      return null;
    }
    return {
      question,
      correct,
      options: shuffle([correct, ...distractors])
    };
  }, [quizPool, quizSeed]);

  const onChooseAnswer = (opt: string) => {
    if (!meaningQuiz || selectedAnswer) {
      return;
    }
    setSelectedAnswer(opt);
    setQuizCount((c) => c + 1);
    if (opt === meaningQuiz.correct) {
      setQuizScore((s) => s + 1);
      if (!learnedMap[meaningQuiz.question.id]) {
        const next = { ...learnedMap, [meaningQuiz.question.id]: true };
        setLearnedMap(next);
        saveLearnedMap(next);
      }
    }
  };

  const nextQuiz = () => {
    setSelectedAnswer(null);
    setQuizSeed((s) => s + 1);
  };

  return (
    <div className="verbMode">
      <p className="muted studySubtitle">Nguồn dữ liệu: Makoto Verb Conjugation APKG.</p>
      <div className="verbTabRow">
        {activeTab === "quiz" ? (
          <button type="button" className="btnSecondary" onClick={() => setActiveTab("conjugation")}>
            ← Quay lại
          </button>
        ) : null}
        <button
          type="button"
          className="jlptTestBtnPrimary ctaPrimary"
          onClick={() => setActiveTab("quiz")}
          disabled={activeTab === "quiz"}
        >
          Kiểm tra từ vựng
        </button>
      </div>
      <div className="verbFilters">
        <label>
          Nhóm động từ
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as "Tất cả" | VerbType)}>
            <option value="Tất cả">Tất cả</option>
            <option value="godan">Godan (Nhóm 1)</option>
            <option value="ichidan">Ichidan (Nhóm 2)</option>
            <option value="irregular">Bất quy tắc (Nhóm 3)</option>
          </select>
        </label>
      </div>
      {activeTab === "conjugation" ? (
        <div className="verbListActions">
          <button
            type="button"
            className={`btnSecondary ${hideLearned ? "isOn" : ""}`}
            onClick={() => setHideLearned((v) => !v)}
          >
            {hideLearned ? "Hiện đã học" : "Ẩn đã học"}
          </button>
          <button
            type="button"
            className={`btnSecondary ${shuffleEnabled ? "isOn" : ""}`}
            onClick={() => {
              if (shuffleEnabled) {
                setString(STORAGE_KEYS.verb.shuffleEnabled, "0");
                setShuffleEnabled(false);
                return;
              }
              const nextOrder = shuffle(verbs.map((v) => v.id));
              setString(STORAGE_KEYS.verb.shuffleEnabled, "1");
              setJSON(STORAGE_KEYS.verb.shuffleOrder, nextOrder);
              setShuffleOrderIds(nextOrder);
              setShuffleEnabled(true);
            }}
          >
            {shuffleEnabled ? "Tắt xáo trộn" : "Xáo trộn"}
          </button>
          <p className="muted">Đã học: {learnedCount}/{verbs.length}</p>
        </div>
      ) : (
        <div className="verbListActions">
          <div className="jlptSegRow segmentedRow">
            <button type="button" className={`jlptSegBtn segmentedBtn ${quizScope === "all" ? "isOn isSelected" : ""}`} onClick={() => setQuizScope("all")}>
              Test tất cả
            </button>
            <button type="button" className={`jlptSegBtn segmentedBtn ${quizScope === "unlearned" ? "isOn isSelected" : ""}`} onClick={() => setQuizScope("unlearned")}>
              Test chưa học
            </button>
            <button type="button" className={`jlptSegBtn segmentedBtn ${quizScope === "learned" ? "isOn isSelected" : ""}`} onClick={() => setQuizScope("learned")}>
              Test đã học
            </button>
          </div>
        </div>
      )}
      {activeTab === "quiz" && meaningQuiz ? (
        <article className="verbCard verbQuizCard">
          <div className="verbCardHeader">
            <h3>Kiểm tra từ vựng động từ</h3>
            <p className="muted">
              {meaningQuiz.question.dictionary}（{meaningQuiz.question.kana}） · {meaningQuiz.question.jlpt}
            </p>
            <p className="muted">Điểm: {quizScore}/{quizCount}</p>
          </div>
          <div className="verbQuizOptions">
            {meaningQuiz.options.map((opt) => {
              const isChosen = selectedAnswer === opt;
              const isCorrect = opt === meaningQuiz.correct;
              let cls = "verbQuizOption";
              if (selectedAnswer) {
                if (isCorrect) cls += " isCorrect";
                else if (isChosen) cls += " isWrong";
              }
              return (
                <button key={opt} type="button" className={cls} onClick={() => onChooseAnswer(opt)} disabled={Boolean(selectedAnswer)}>
                  {opt}
                </button>
              );
            })}
          </div>
          {selectedAnswer ? (
            <div className="verbQuizActions">
              <button type="button" className="btnSecondary" onClick={nextQuiz}>
                Câu kế tiếp
              </button>
            </div>
          ) : null}
        </article>
      ) : activeTab === "quiz" ? (
        <p className="muted">Không đủ dữ liệu để tạo quiz (cần ít nhất 4 động từ).</p>
      ) : null}
      {activeTab === "conjugation" && listVerbs.length === 0 ? (
        <p className="muted">Không có động từ phù hợp với bộ lọc hiện tại.</p>
      ) : activeTab === "conjugation" ? (
        <div className="verbCards">
          {listVerbs.map((verb) => {
            const forms = verb.conjugations?.length ? verb.conjugations : conjugateVerb(verb);
            const isExpanded = expandedVerbIds.has(verb.id);
            return (
              <article key={verb.id} className={`verbCard ${isExpanded ? "isExpanded" : ""}`}>
                <div
                  className="verbCardTop"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedVerbIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(verb.id)) next.delete(verb.id);
                      else next.add(verb.id);
                      return next;
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }
                    event.preventDefault();
                    setExpandedVerbIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(verb.id)) next.delete(verb.id);
                      else next.add(verb.id);
                      return next;
                    });
                  }}
                >
                  <div className="verbCardMain">
                    <div className="verbHeadRow">
                      <h3 className="verbHeadWord">{verb.dictionary}</h3>
                      <p className="verbKanaLine">{verb.kana}</p>
                    </div>
                    <p className="verbMeaningLine">{verb.meaningVi}</p>
                    <span className="verbExpandHint">{isExpanded ? "▾ Thu gọn" : "▸ Mở rộng"}</span>
                    <button
                      type="button"
                      className={learnedMap[verb.id] ? "jlptLearnedOn" : "jlptLearnedOff"}
                      onClick={(event) => {
                        event.stopPropagation();
                        const nextValue = !learnedMap[verb.id];
                        const next = { ...learnedMap, [verb.id]: nextValue };
                        if (!nextValue) {
                          delete next[verb.id];
                        }
                        setLearnedMap(next);
                        saveLearnedMap(next);
                      }}
                    >
                      {learnedMap[verb.id] ? "Đã học" : "Đánh dấu học"}
                    </button>
                  </div>
                  {verb.image ? <img className="verbThumb verbThumbInline" src={verb.image} alt={verb.dictionary} /> : null}
                </div>
                {isExpanded ? (
                  <>
                    <div className="verbExpandedMain">
                      <p className="muted">
                        {verb.jlpt} - {verbTypeToLabel(verb.type)}
                      </p>
                    </div>
                    <div className="tableWrap">
                      <table className="verbTable">
                        <thead>
                          <tr>
                            <th>Thể</th>
                            <th>Dạng chia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forms.map((row) => (
                            <tr key={`${verb.dictionary}-${row.label}`}>
                              <td>{row.label}</td>
                              <td>{row.form}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
