import { FormEvent, useCallback, useMemo, useState, useEffect } from "react";
import n5Pack from "../data/n5Vocabulary.json";
import n4Pack from "../data/n4Vocabulary.json";
import { speakJapanese } from "../audio";
import {
  completionRate,
  countLearned,
  isLevelUnlocked,
  loadLearnedMap,
  nextLockedReason,
  resetLearnedLevel,
  saveLearnedMap,
  toggleLearned
} from "../vocabulary/jlptProgress";
import { JLPT_LEVEL_ORDER, JlptLevel, JlptWord, N5VocabularyFile, TestMode, WordScope } from "../vocabulary/jlptTypes";

const n5Data = n5Pack as N5VocabularyFile;
const n4Data = n4Pack as N5VocabularyFile; // Vẫn dùng chung schema n5

const PLACEHOLDER_LEVELS: Record<Exclude<JlptLevel, "N5" | "N4">, string> = {
  N3: "Nội dung N3 sẽ được bổ sung sau.",
  N2: "Nội dung N2 sẽ được bổ sung sau.",
  N1: "Nội dung N1 sẽ được bổ sung sau."
};

type SubView = "levels" | "list" | "testConfig" | "testRun";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function answerOk(expected: string, user: string): boolean {
  const e = normalize(expected);
  const u = normalize(user);
  if (!u) {
    return false;
  }
  if (e === u) {
    return true;
  }
  if (e.includes(u) || u.includes(e)) {
    return true;
  }
  const eParts = e.split(/[;,\/|]/).map((p) => p.trim()).filter(Boolean);
  return eParts.some((p) => p === u || p.includes(u) || u.includes(p));
}

function buildPool(
  words: JlptWord[],
  learned: Record<string, boolean>,
  wordScope: WordScope,
  skipMemorized: boolean,
  lesson: number | "all" | "unassigned"
): JlptWord[] {
  let basePool = words;
  if (lesson === "unassigned") {
    basePool = words.filter((w) => w.lesson == null);
  } else if (lesson !== "all") {
    basePool = words.filter((w) => w.lesson === lesson);
  }

  if (wordScope === "memorized") {
    return shuffle(basePool.filter((w) => learned[w.id]));
  }
  let pool = [...basePool];
  if (skipMemorized) {
    pool = pool.filter((w) => !learned[w.id]);
  }
  return shuffle(pool);
}

function takeCount(pool: JlptWord[], mode: "10" | "50" | "all" | "custom", custom: number): JlptWord[] {
  if (mode === "all") {
    return pool;
  }
  const n = mode === "10" ? 10 : mode === "50" ? 50 : Math.max(1, Math.min(custom, pool.length));
  return pool.slice(0, Math.min(n, pool.length));
}

export function JlptVocabularyPage() {
  const wordsByLevel = useMemo<Record<JlptLevel, JlptWord[]>>(
    () => ({
      N5: n5Data.words,
      N4: n4Data.words,
      N3: [],
      N2: [],
      N1: []
    }),
    []
  );

  const [learnedN5, setLearnedN5] = useState(() => loadLearnedMap("N5"));
  const [learnedN4, setLearnedN4] = useState(() => loadLearnedMap("N4"));
  const [learnedN3, setLearnedN3] = useState(() => loadLearnedMap("N3"));
  const [learnedN2, setLearnedN2] = useState(() => loadLearnedMap("N2"));
  const [learnedN1, setLearnedN1] = useState(() => loadLearnedMap("N1"));

  const learnedByLevel = useMemo(
    () => ({
      N5: learnedN5,
      N4: learnedN4,
      N3: learnedN3,
      N2: learnedN2,
      N1: learnedN1
    }),
    [learnedN5, learnedN4, learnedN3, learnedN2, learnedN1]
  );

  const setLearnedFor = useCallback((level: JlptLevel, map: Record<string, boolean>) => {
    saveLearnedMap(level, map);
    if (level === "N5") {
      setLearnedN5(map);
    } else if (level === "N4") {
      setLearnedN4(map);
    } else if (level === "N3") {
      setLearnedN3(map);
    } else if (level === "N2") {
      setLearnedN2(map);
    } else {
      setLearnedN1(map);
    }
  }, []);

  const [subView, setSubView] = useState<SubView>(() => {
    return (localStorage.getItem("jlpt_subView") as SubView) || "levels";
  });
  const [activeLevel, setActiveLevel] = useState<JlptLevel>(() => {
    return (localStorage.getItem("jlpt_activeLevel") as JlptLevel) || "N5";
  });
  const [lessonFilter, setLessonFilter] = useState<number | "all" | "unassigned">(() => {
    const saved = localStorage.getItem("jlpt_lessonFilter");
    if (saved === "all" || saved === "unassigned") return saved;
    return saved ? Number(saved) : 1;
  });

  useEffect(() => {
    localStorage.setItem("jlpt_subView", subView);
    localStorage.setItem("jlpt_activeLevel", activeLevel);
    localStorage.setItem("jlpt_lessonFilter", String(lessonFilter));
  }, [subView, activeLevel, lessonFilter]);

  const [isReadingHidden, setIsReadingHidden] = useState(false);
  const [isMeaningHidden, setIsMeaningHidden] = useState(false);
  const [revealedCells, setRevealedCells] = useState<Record<string, boolean>>({});

  const [wordScope, setWordScope] = useState<WordScope>(() => {
    return (localStorage.getItem("jlpt_wordScope") as WordScope) || "all";
  });
  const [testLesson, setTestLesson] = useState<number | "all" | "unassigned">(() => {
    const saved = localStorage.getItem("jlpt_testLesson");
    if (saved === "all" || saved === "unassigned") return saved;
    return saved ? Number(saved) : 1;
  });
  const [testMode, setTestMode] = useState<TestMode>(() => {
    return (localStorage.getItem("jlpt_testMode") as TestMode) || "meaning";
  });

  useEffect(() => {
    localStorage.setItem("jlpt_wordScope", wordScope);
    localStorage.setItem("jlpt_testLesson", String(testLesson));
    localStorage.setItem("jlpt_testMode", testMode);
  }, [wordScope, testLesson, testMode]);
  const [countMode, setCountMode] = useState<"10" | "50" | "all" | "custom">("10");
  const [customCount, setCustomCount] = useState(20);
  const [skipMemorized, setSkipMemorized] = useState(true);

  const [testQueue, setTestQueue] = useState<JlptWord[]>([]);
  const [testIndex, setTestIndex] = useState(0);
  const [questionMode, setQuestionMode] = useState<TestMode>("meaning");
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [scoreOk, setScoreOk] = useState(0);

  const words = wordsByLevel[activeLevel];
  const learnedMap = learnedByLevel[activeLevel];
  const learnedCount = countLearned(words, learnedMap);
  const total = words.length;
  const unlocked = isLevelUnlocked(activeLevel, wordsByLevel, learnedByLevel);
  const lockHint = nextLockedReason(activeLevel, wordsByLevel, learnedByLevel);

  const lessonCounts = useMemo(() => {
    const m: Record<number, number> = {};
    for (const w of words) {
      if (w.lesson != null) {
        m[w.lesson] = (m[w.lesson] || 0) + 1;
      }
    }
    return m;
  }, [words]);

  const unassignedCount = useMemo(() => words.filter((w) => w.lesson == null).length, [words]);

  const filteredWords = useMemo(() => {
    if (lessonFilter === "all") {
      return words;
    }
    if (lessonFilter === "unassigned") {
      return words.filter((w) => w.lesson == null);
    }
    return words.filter((w) => w.lesson === lessonFilter);
  }, [words, lessonFilter]);

  const openLevel = (level: JlptLevel) => {
    if (!isLevelUnlocked(level, wordsByLevel, learnedByLevel)) {
      return;
    }
    setActiveLevel(level);
    const startLesson = level === "N5" ? 1 : level === "N4" ? 26 : "all";
    setLessonFilter(startLesson);
    setTestLesson(startLesson);
    setSubView("list");
  };

  const handleToggleLearned = (word: JlptWord) => {
    const next = !learnedMap[word.id];
    const map = toggleLearned(activeLevel, word.id, next);
    setLearnedFor(activeLevel, map);
  };

  const handleResetProgress = () => {
    if (!window.confirm(`Đặt lại toàn bộ tiến độ đã học (${activeLevel})?`)) {
      return;
    }
    resetLearnedLevel(activeLevel);
    setLearnedFor(activeLevel, {});
  };

  const generateOptions = useCallback((q: JlptWord, mode: TestMode, allWords: JlptWord[]) => {
    if (!q) return [];
    const isMeaning = mode === "meaning";
    const getLabel = (w: JlptWord) => (isMeaning ? w.meaning : `${w.word} (${w.reading})`);
    
    const correctLabel = getLabel(q);
    const pool = allWords.filter((w) => getLabel(w) !== correctLabel);
    
    const distractorsSet = new Set<string>();
    const shuffledPool = shuffle(pool);
    for (const w of shuffledPool) {
      if (distractorsSet.size >= 3) break;
      distractorsSet.add(getLabel(w));
    }
    
    return shuffle([correctLabel, ...Array.from(distractorsSet)]);
  }, []);

  const startTest = () => {
    const pool = buildPool(words, learnedMap, wordScope, wordScope === "all" ? skipMemorized : false, testLesson);
    if (pool.length === 0) {
      window.alert("Không có từ nào phù hợp với bộ lọc. Hãy điều chỉnh loại từ hoặc ôn thêm từ.");
      return;
    }
    const picked = takeCount(pool, countMode, customCount);
    if (picked.length === 0) {
      window.alert("Không đủ từ để kiểm tra.");
      return;
    }
    
    const initMode = testMode === "both" ? (Math.random() > 0.5 ? "meaning" : "kanji") : testMode;
    
    setTestQueue(picked);
    setTestIndex(0);
    setUserAnswer("");
    setShowAnswer(false);
    setScoreOk(0);
    setQuestionMode(initMode);
    setCurrentOptions(generateOptions(picked[0], initMode, words));
    setSubView("testRun");
  };

  const currentQ = testQueue[testIndex];

  const goNextQuestion = () => {
    if (testIndex + 1 >= testQueue.length) {
      setSubView("testConfig");
      setTestQueue([]);
      return;
    }
    const nextIndex = testIndex + 1;
    const nextMode = testMode === "both" ? (Math.random() > 0.5 ? "meaning" : "kanji") : testMode;
    
    setTestIndex(nextIndex);
    setUserAnswer("");
    setShowAnswer(false);
    setQuestionMode(nextMode);
    setCurrentOptions(generateOptions(testQueue[nextIndex], nextMode, words));
  };

  const onSelectOption = (opt: string) => {
    if (showAnswer) return;
    setUserAnswer(opt);
    
    const correctOpt = questionMode === "meaning" ? currentQ.meaning : `${currentQ.word} (${currentQ.reading})`;
    if (opt === correctOpt) {
      setScoreOk((s) => s + 1);
    }
    setShowAnswer(true);
  };

  if (subView === "testRun" && currentQ) {
    const prompt =
      questionMode === "meaning" ? (
        <>
          <p className="jlptTestPromptLabel">Nghĩa tiếng Anh/Việt của từ sau là gì?</p>
          <div className="jlptTestJapaneseWrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <p className="jlptTestJapanese" lang="ja" style={{ margin: 0 }}>
              {currentQ.word}
            </p>
            <button 
              type="button" 
              className="toolbarBtn" 
              onClick={() => speakJapanese(currentQ.word)}
              style={{ borderRadius: "50%", padding: "8px", width: "40px", height: "40px" }}
              title="Phát âm"
            >
              🔊
            </button>
          </div>
          <p className="jlptTestReading muted" lang="ja">
            {currentQ.reading}
          </p>
        </>
      ) : (
        <>
          <p className="jlptTestPromptLabel">Viết từ tiếng Nhật tương ứng nghĩa:</p>
          <p className="jlptTestMeaning">{currentQ.meaning}</p>
        </>
      );

    const correctOpt = questionMode === "meaning" ? currentQ.meaning : `${currentQ.word} (${currentQ.reading})`;

    return (
      <div className="card jlptTestCard">
        <div className="jlptTestHeader">
          <p className="muted jlptTestMeta">
            Câu {testIndex + 1}/{testQueue.length} · Đúng {scoreOk}
          </p>
          <button type="button" className="btnGhost jlptTestExit" onClick={() => setSubView("testConfig")}>
            Thoát kiểm tra
          </button>
        </div>
        {prompt}
        
        <div className="jlptTestForm">
          <div className="jlptOptionsGrid" style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
            {currentOptions.map((opt, i) => {
              let btnClass = "jlptOptionBtn";
              if (showAnswer) {
                if (opt === correctOpt) {
                  btnClass += " isCorrect";
                } else if (opt === userAnswer) {
                  btnClass += " isWrong";
                }
              }
              
              return (
                <button
                  key={i}
                  type="button"
                  className={btnClass}
                  onClick={() => onSelectOption(opt)}
                  disabled={showAnswer}
                  style={{
                    padding: "14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-strong)",
                    background: "var(--surface)",
                    textAlign: "left",
                    color: "var(--text)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    cursor: showAnswer ? "default" : "pointer",
                    transition: "all 0.2s",
                    ...(showAnswer && opt === correctOpt ? { background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success)" } : {}),
                    ...(showAnswer && opt === userAnswer && opt !== correctOpt ? { background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" } : {}),
                  }}
                >
                  <span style={{ marginRight: "10px", opacity: 0.5, fontSize: "0.9rem" }}>{["A", "B", "C", "D"][i]}.</span>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="jlptTestActions" style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            {showAnswer && (
              <button type="button" className="jlptTestBtnPrimary" onClick={goNextQuestion}>
                {testIndex + 1 >= testQueue.length ? "Kết thúc" : "Câu tiếp →"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (subView === "testConfig") {
    const memorizedCount = learnedCount;
    return (
      <div className="card jlptTestConfig">
        <div className="jlptTestTitleBlock">
          <h2 className="jlptTestTitle">Bài kiểm tra</h2>
          <p className="muted jlptTestSubtitle">Chọn cài đặt và bắt đầu kiểm tra từ vựng ({activeLevel})</p>
        </div>

        <div className="jlptSegSection">
          <p className="jlptSegLabel">Loại từ</p>
          <div className="jlptSegRow">
            <button
              type="button"
              className={`jlptSegBtn ${wordScope === "all" ? "isOn" : ""}`}
              onClick={() => setWordScope("all")}
            >
              Tất cả ({total})
            </button>
            <button
              type="button"
              className={`jlptSegBtn ${wordScope === "memorized" ? "isOn" : ""}`}
              onClick={() => setWordScope("memorized")}
            >
              Đã nhớ ({memorizedCount})
            </button>
          </div>
        </div>

        <div className="jlptSegSection">
          <p className="jlptSegLabel">Phạm vi bài học (Lesson)</p>
          <div className="jlptSegRow">
            <select
              className="jlptTestInput"
              value={testLesson === "all" ? "all" : testLesson === "unassigned" ? "unassigned" : String(testLesson)}
              onChange={(e) => {
                const v = e.target.value;
                setTestLesson(v === "all" ? "all" : v === "unassigned" ? "unassigned" : Number(v));
              }}
              style={{ width: "100%", marginBottom: 0, padding: "8px 12px", borderRadius: "10px", borderColor: "var(--border-strong)", cursor: "pointer" }}
            >
              {activeLevel !== "N5" && activeLevel !== "N4" ? (
                <>
                  <option value="all">Tất cả bài học ({total})</option>
                  <option value="unassigned">Chưa gán bài ({unassignedCount})</option>
                </>
              ) : null}
              {Array.from({ length: 25 }, (_, i) => i + (activeLevel === "N5" ? 1 : 26)).map((n) => {
                const c = lessonCounts[n] || 0;
                return (
                  <option key={n} value={n} disabled={c === 0}>
                    Bài {n} ({c} từ)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="jlptSegSection">
          <p className="jlptSegLabel">Loại kiểm tra</p>
          <div className="jlptSegRow jlptSegRow3">
            <button type="button" className={`jlptSegBtn ${testMode === "meaning" ? "isOn" : ""}`} onClick={() => setTestMode("meaning")}>
              KT nghĩa
            </button>
            <button type="button" className={`jlptSegBtn ${testMode === "kanji" ? "isOn" : ""}`} onClick={() => setTestMode("kanji")}>
              KT chữ Hán / kana
            </button>
            <button type="button" className={`jlptSegBtn ${testMode === "both" ? "isOn" : ""}`} onClick={() => setTestMode("both")}>
              Cả hai
            </button>
          </div>
        </div>

        <div className="jlptSegSection">
          <p className="jlptSegLabel">Số từ</p>
          <div className="jlptSegRow jlptSegRowWrap">
            {(["10", "50", "all"] as const).map((m) => (
              <button key={m} type="button" className={`jlptSegBtn ${countMode === m ? "isOn" : ""}`} onClick={() => setCountMode(m)}>
                {m === "all" ? `Tất cả (${total})` : m}
              </button>
            ))}
            <label className="jlptCustomCount">
              <span>Tự nhập</span>
              <input
                type="number"
                min={1}
                max={total || 999}
                value={customCount}
                onChange={(e) => {
                  setCountMode("custom");
                  setCustomCount(Number(e.target.value) || 1);
                }}
              />
            </label>
          </div>
        </div>

        <div className={`jlptToggleRow ${wordScope === "memorized" ? "isDisabled" : ""}`}>
          <label className="jlptToggle">
            <input
              type="checkbox"
              checked={skipMemorized}
              disabled={wordScope === "memorized"}
              onChange={(e) => setSkipMemorized(e.target.checked)}
            />
            <span>Bỏ qua từ đã nhớ</span>
          </label>
          <p className="muted jlptToggleHint">Khi bật: chỉ kiểm tra từ chưa đánh dấu đã học.</p>
        </div>

        <div className="jlptProgressCard">
          <p className="jlptProgressTitle">Tiến độ</p>
          <p className="jlptProgressStats">
            {learnedCount} / {total} từ đã nhớ
          </p>
          <div className="jlptProgressBar">
            <div className="jlptProgressFill" style={{ width: `${total ? (learnedCount / total) * 100 : 0}%` }} />
          </div>
          <p className="muted jlptProgressSub">{total - learnedCount} từ chưa đánh dấu</p>
          <button type="button" className="jlptResetBtn" onClick={handleResetProgress}>
            Đặt lại tiến độ (xóa hết đã học)
          </button>
        </div>

        <div className="jlptTestNavRow">
          <button type="button" className="btnSecondary" onClick={() => setSubView("list")}>
            ← Quay lại
          </button>
          <button type="button" className="jlptTestBtnPrimary jlptStartBtn" onClick={startTest}>
            Bắt đầu →
          </button>
        </div>
      </div>
    );
  }

  if (subView === "list" && unlocked) {
    return (
      <>
        <div className="card jlptListCard">
          <div className="jlptListHeader">
            <div>
              <h2>Từ vựng JLPT {activeLevel}</h2>
              <p className="muted">
                {(n5Data.meta?.sourceNote && activeLevel === "N5") || (n4Data.meta?.sourceNote && activeLevel === "N4") ? (
                  <span>{activeLevel === "N5" ? n5Data.meta?.sourceNote : n4Data.meta?.sourceNote} </span>
                ) : null}
                {activeLevel !== "N5" && activeLevel !== "N4"
                  ? PLACEHOLDER_LEVELS[activeLevel as Exclude<JlptLevel, "N5" | "N4">]
                  : "Cột «Bài» = chương Minna (N5: 1–25, N4: 26–50) sau khi chạy npm run import-minna. Lọc «Chưa gán bài» cho thẻ không có thông tin bài."}
              </p>
            </div>
            <div className="jlptListHeaderActions">
              <button type="button" className="btnSecondary" onClick={() => setSubView("levels")}>
                ← Chọn cấp độ
              </button>
              {total > 0 ? (
                <button type="button" className="jlptTestBtnPrimary" onClick={() => setSubView("testConfig")}>
                  Kiểm tra từ vựng
                </button>
              ) : null}
            </div>
          </div>

          {(activeLevel === "N5" || activeLevel === "N4") && total > 0 ? (
            <div className="jlptLessonRow">
              <label>
                Lọc theo bài (Minna)
                <select
                  value={lessonFilter === "all" ? "all" : lessonFilter === "unassigned" ? "unassigned" : String(lessonFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "all") {
                      setLessonFilter("all");
                    } else if (v === "unassigned") {
                      setLessonFilter("unassigned");
                    } else {
                      setLessonFilter(Number(v));
                    }
                  }}
                >
                  {activeLevel !== "N5" && activeLevel !== "N4" ? (
                    <>
                      <option value="all">Tất cả ({words.length})</option>
                      <option value="unassigned">Chưa gán bài Minna ({unassignedCount})</option>
                    </>
                  ) : null}
                  {Array.from({ length: 25 }, (_, i) => i + (activeLevel === "N5" ? 1 : 26)).map((n) => {
                    const c = lessonCounts[n] || 0;
                    return (
                      <option key={n} value={n} disabled={c === 0}>
                        Bài {n} ({c})
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
          ) : null}

          {total === 0 ? (
            <p className="muted">Chưa có danh sách từ cho cấp độ này.</p>
          ) : (
            <div className="tableWrap jlptTableWrap">
              <table className="listTable jlptWordTable">
                <thead>
                  <tr>
                    <th>Từ</th>
                    <th>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        Đọc
                        <button type="button" className="btnGhost" style={{ padding: "4px", fontSize: "1rem" }} onClick={() => { setIsReadingHidden(!isReadingHidden); setRevealedCells({}); }} title={isReadingHidden ? "Hiện tất cả" : "Ẩn tất cả"}>
                          {isReadingHidden ? "👁️" : "🙈"}
                        </button>
                      </div>
                    </th>
                    <th>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        Ý nghĩa
                        <button type="button" className="btnGhost" style={{ padding: "4px", fontSize: "1rem" }} onClick={() => { setIsMeaningHidden(!isMeaningHidden); setRevealedCells({}); }} title={isMeaningHidden ? "Hiện tất cả" : "Ẩn tất cả"}>
                          {isMeaningHidden ? "👁️" : "🙈"}
                        </button>
                      </div>
                    </th>
                    <th>Bài</th>
                    <th>Đã học</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWords.map((w) => (
                    <tr key={w.id} className={learnedMap[w.id] ? "isLearnedRow" : ""}>
                      <td lang="ja">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {w.word}
                          <button 
                            type="button" 
                            className="btnGhost" 
                            style={{ padding: "4px", fontSize: "1rem" }}
                            onClick={() => speakJapanese(w.word)}
                            title="Nghe"
                          >
                            🔊
                          </button>
                        </div>
                      </td>
                      <td lang="ja">
                        <span 
                          className={isReadingHidden && !revealedCells[`read-${w.id}`] ? "blurTextOnly" : ""}
                          onClick={() => { if (isReadingHidden) setRevealedCells(p => ({...p, [`read-${w.id}`]: !p[`read-${w.id}`]})) }}
                          style={{ cursor: isReadingHidden ? "pointer" : "text", display: "inline-block", padding: "4px 0" }}
                          title={isReadingHidden && !revealedCells[`read-${w.id}`] ? "Bấm để xem" : ""}
                        >
                          {w.reading}
                        </span>
                      </td>
                      <td>
                        <span 
                          className={isMeaningHidden && !revealedCells[`mean-${w.id}`] ? "blurTextOnly" : ""}
                          onClick={() => { if (isMeaningHidden) setRevealedCells(p => ({...p, [`mean-${w.id}`]: !p[`mean-${w.id}`]})) }}
                          style={{ cursor: isMeaningHidden ? "pointer" : "text", display: "inline-block", padding: "4px 0" }}
                          title={isMeaningHidden && !revealedCells[`mean-${w.id}`] ? "Bấm để xem" : ""}
                        >
                          {w.meaning}
                        </span>
                      </td>
                      <td>{w.lesson ?? "—"}</td>
                      <td>
                        <button
                          type="button"
                          className={learnedMap[w.id] ? "jlptLearnedOn" : "jlptLearnedOff"}
                          onClick={() => handleToggleLearned(w)}
                        >
                          {learnedMap[w.id] ? "Đã học" : "Đánh dấu học"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="card jlptLevelCard">
      <h2>Học từ vựng JLPT</h2>
      <p className="muted">Hoàn thành ít nhất 80% cấp trước để mở khóa cấp tiếp theo. Bộ N5 (Minna chương 1–25); các cấp khác hiển thị khóa.</p>
      <div className="jlptLevelGrid">
        {JLPT_LEVEL_ORDER.map((level) => {
          const lvWords = wordsByLevel[level];
          const lvLearned = learnedByLevel[level];
          const lvTotal = lvWords.length;
          const rate = completionRate(lvWords, lvLearned);
          const open = isLevelUnlocked(level, wordsByLevel, learnedByLevel);
          const hint = nextLockedReason(level, wordsByLevel, learnedByLevel);
          return (
            <button
              key={level}
              type="button"
              className={`jlptLevelTile ${open ? "isOpen" : "isLocked"}`}
              disabled={!open}
              onClick={() => openLevel(level)}
              title={hint || undefined}
            >
              <span className="jlptLevelBadge">{level}</span>
              {lvTotal === 0 ? (
                <span className="jlptLevelSoon">Sắp có</span>
              ) : (
                <>
                  <span className="jlptLevelRate">{Math.round(rate * 100)}%</span>
                  <span className="muted jlptLevelTiny">
                    {countLearned(lvWords, lvLearned)}/{lvTotal} từ
                  </span>
                </>
              )}
              {!open && <span className="jlptLockIcon" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {lockHint && (
        <p className="jlptLockHint muted" role="status">
          {lockHint}
        </p>
      )}
    </div>
  );
}
