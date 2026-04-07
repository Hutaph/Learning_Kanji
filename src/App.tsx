import React, { FormEvent, KeyboardEvent, Suspense, lazy, useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, House, LayoutGrid, MoonStar, Sparkles, SunMedium, TextSearch } from "lucide-react";
import { BgmPlayer } from "./components/BgmPlayer";
import { HomeInsightsPanel } from "./components/HomeInsightsPanel";
import { VocabularyList, formatMeaningLine } from "./components/VocabularyList";
import { FlashCard, ImportedKanjiRecord, VerbType, VerbLevel, InspirationItem, VerbLesson, KanjiProgress, VocabularyEntry } from "./types";
import {
  addGroup,
  addVocabulary,
  deleteGroup,
  deleteVocabularyById,
  findByKanjiCharacter,
  getAllVocabulary,
  getGroups,
  getKanjiCharacters,
  getKanjiProgressMap,
  markKanjiKnown,
  markKanjiUnknown,
  suggestVocabularyByWordInput,
  toHanVietFromKanji,
  toReadingPreview
} from "./dictionary/lookup";
import { lookupVocabularyOnline, OnlineLookupResult } from "./dictionary/onlineLookup";
import verbsPack from "./data/verbsConjugation.json";

const JlptVocabularyPage = lazy(() =>
  import("./components/JlptVocabularyPage").then((mod) => ({ default: mod.JlptVocabularyPage }))
);
const VerbStudyPanel = lazy(() =>
  import("./components/VerbStudyPanel").then((mod) => ({ default: mod.VerbStudyPanel }))
);

function App() {
  const KANJI_STUDY_GROUP_KEY = "kanji-study-group";
  const KANJI_STUDY_FOCUS_KEY = "kanji-study-focus";
  const [layoutMode, setLayoutMode] = useState<"full" | "compact">(() => {
    const stored = localStorage.getItem("kanji-layout");
    return stored === "compact" ? "compact" : "full";
  });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("kanji-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const [queryInput, setQueryInput] = useState("");
  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [meaningVi, setMeaningVi] = useState("");
  const [meaningEn, setMeaningEn] = useState("");
  const [selectedAddGroup, setSelectedAddGroup] = useState("Chung");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupToDelete, setGroupToDelete] = useState("");
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [studyGroup, setStudyGroup] = useState(() => localStorage.getItem(KANJI_STUDY_GROUP_KEY) || "Tất cả");
  const [studyFocus, setStudyFocus] = useState<"priority" | "due" | "new">(() => {
    const stored = localStorage.getItem(KANJI_STUDY_FOCUS_KEY);
    return stored === "due" || stored === "new" ? stored : "priority";
  });
  const [cardIndex, setCardIndex] = useState(0);
  const [showHanViet, setShowHanViet] = useState(false);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [progressMap, setProgressMap] = useState<Record<string, KanjiProgress>>(() => getKanjiProgressMap());
  const [refreshTick, setRefreshTick] = useState(0);
  const [isOnlineLookingUp, setIsOnlineLookingUp] = useState(false);
  const [onlineResult, setOnlineResult] = useState<OnlineLookupResult | null>(null);
  const [enterLookupReady, setEnterLookupReady] = useState(false);
  const [listGroup, setListGroup] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [verbLevelFilter, setVerbLevelFilter] = useState<"Tất cả" | VerbLevel>("Tất cả");
  const [verbTypeFilter, setVerbTypeFilter] = useState<"Tất cả" | VerbType>("Tất cả");
  const [importedRecords, setImportedRecords] = useState<ImportedKanjiRecord[]>([]);
  const [kanjiDataReady, setKanjiDataReady] = useState(false);
  const kanjiPrefetchStartedRef = useRef(false);

  const importedByKanji = useMemo(() => {
    const map: Record<string, ImportedKanjiRecord> = {};
    for (const item of importedRecords) {
      if (!map[item.kanji]) {
        map[item.kanji] = item;
      }
    }
    return map;
  }, [importedRecords]);
  const localVocabulary = useMemo(() => getAllVocabulary(), [refreshTick]);
  const allVocabulary = localVocabulary;
  const allGroups = useMemo(() => getGroups(), [refreshTick]);
  const deletableGroups = useMemo(
    () => allGroups.filter((group) => group !== "Chung"),
    [allGroups]
  );

  const readingPreview = useMemo(() => {
    return toReadingPreview(reading);
  }, [reading]);
  const hanVietPreview = useMemo(() => {
    if (!word.trim()) {
      return "-";
    }
    return renderHanViet(word, importedByKanji);
  }, [word, importedByKanji]);
  const localSuggestion = useMemo(() => {
    const source = queryInput.trim() || word.trim();
    return suggestVocabularyByWordInput(source, allVocabulary);
  }, [queryInput, word, allVocabulary]);
  const listEntries = useMemo(() => {
    if (!listGroup) {
      return [];
    }
    return allVocabulary.filter((item) => item.group === listGroup);
  }, [allVocabulary, listGroup]);

  const cards = useMemo(
    () => buildFlashCards(studyGroup, allVocabulary, importedRecords, importedByKanji),
    [studyGroup, allVocabulary, importedRecords, importedByKanji]
  );
  const scopedCards = useMemo(() => {
    if (studyFocus === "due") {
      const now = Date.now();
      return cards.filter((card) => {
        const progress = progressMap[card.kanji];
        return Boolean(progress?.known && progress.dueAt <= now);
      });
    }
    if (studyFocus === "new") {
      return cards.filter((card) => !progressMap[card.kanji]?.known);
    }
    return cards;
  }, [cards, progressMap, studyFocus]);
  const scheduledCards = useMemo(() => scheduleCards(scopedCards, progressMap), [scopedCards, progressMap]);
  const unknownCardsCount = useMemo(
    () => cards.filter((card) => !progressMap[card.kanji]?.known).length,
    [cards, progressMap]
  );
  const dueCardsCount = useMemo(() => {
    const now = Date.now();
    return cards.filter((card) => {
      const progress = progressMap[card.kanji];
      return Boolean(progress?.known && progress.dueAt <= now);
    }).length;
  }, [cards, progressMap]);
  const currentCard = scheduledCards[cardIndex] || null;
  const dailyInspiration = useMemo(() => getDailyInspiration(new Date()), []);
  const jlptVerbs = useMemo(() => (verbsPack as { verbs: VerbLesson[] }).verbs || [], []);
  const filteredVerbs = useMemo(() => {
    return jlptVerbs.filter((verb) => {
      const passLevel = verbLevelFilter === "Tất cả" || verb.jlpt === verbLevelFilter;
      const passType = verbTypeFilter === "Tất cả" || verb.type === verbTypeFilter;
      return passLevel && passType;
    });
  }, [jlptVerbs, verbLevelFilter, verbTypeFilter]);
  const currentPage = useMemo(() => {
    if (currentPath === "/study/kanji") {
      return "kanji";
    }
    if (currentPath === "/study/verbs") {
      return "verbs";
    }
    if (currentPath === "/study/vocabulary") {
      return "vocabulary";
    }
    return "home";
  }, [currentPath]);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setCardIndex(0);
    setShowHanViet(false);
    setRevealedFields({});
  }, [studyGroup, scheduledCards.length]);

  useEffect(() => {
    setEnterLookupReady(false);
  }, [queryInput]);

  useEffect(() => {
    localStorage.setItem("kanji-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("kanji-layout", layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    localStorage.setItem(KANJI_STUDY_GROUP_KEY, studyGroup);
  }, [studyGroup]);

  useEffect(() => {
    localStorage.setItem(KANJI_STUDY_FOCUS_KEY, studyFocus);
  }, [studyFocus]);

  useEffect(() => {
    if (currentPage !== "kanji" || kanjiDataReady) {
      return;
    }
    let cancelled = false;
    import("./data/kanjiImported.json")
      .then((mod) => {
        if (cancelled) {
          return;
        }
        setImportedRecords(mod.default as ImportedKanjiRecord[]);
        setKanjiDataReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setImportedRecords([]);
          setKanjiDataReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, kanjiDataReady]);

  const prefetchKanjiData = () => {
    if (kanjiDataReady || kanjiPrefetchStartedRef.current) {
      return;
    }
    kanjiPrefetchStartedRef.current = true;
    import("./data/kanjiImported.json")
      .then((mod) => {
        setImportedRecords(mod.default as ImportedKanjiRecord[]);
        setKanjiDataReady(true);
      })
      .catch(() => {
        kanjiPrefetchStartedRef.current = false;
      });
  };

  useEffect(() => {
    if (selectedAddGroup && !allGroups.includes(selectedAddGroup)) {
      setSelectedAddGroup("Chung");
    }
    if (studyGroup && studyGroup !== "Tất cả" && !allGroups.includes(studyGroup)) {
      setStudyGroup("Tất cả");
    }
    if (listGroup && !allGroups.includes(listGroup)) {
      setListGroup("");
    }
  }, [allGroups, selectedAddGroup, studyGroup, listGroup]);

  const saveVocabulary = () => {
    setError("");
    setNotice("");
    if (!word.trim() || !reading.trim() || (!meaningVi.trim() && !meaningEn.trim())) {
      setError("Vui lòng nhập từ, cách đọc và ít nhất một nghĩa.");
      return false;
    }
    addVocabulary(word.trim(), reading.trim(), meaningVi.trim(), meaningEn.trim(), selectedAddGroup);
    setQueryInput("");
    setWord("");
    setReading("");
    setMeaningVi("");
    setMeaningEn("");
    setOnlineResult(null);
    setEnterLookupReady(false);
    setNotice("Đã lưu từ vựng.");
    setRefreshTick((prev) => prev + 1);
    return true;
  };

  const handleAddVocabulary = (event: FormEvent) => {
    event.preventDefault();
    void saveVocabulary();
  };

  const handleAddGroup = () => {
    setError("");
    setNotice("");
    if (!newGroupName.trim()) {
      setError("Vui lòng nhập tên nhóm.");
      return;
    }
    addGroup(newGroupName);
    setSelectedAddGroup(newGroupName.trim());
    setNewGroupName("");
    setRefreshTick((prev) => prev + 1);
  };

  const handleDeleteGroup = () => {
    setError("");
    setNotice("");
    if (!groupToDelete) {
      setError("Vui lòng chọn nhóm cần xóa.");
      return;
    }
    if (groupToDelete === "Chung") {
      setError("Không thể xóa nhóm hệ thống.");
      return;
    }
    const ok = window.confirm(`Xóa nhóm "${groupToDelete}"? Từ vựng sẽ chuyển về "Chung".`);
    if (!ok) {
      return;
    }
    deleteGroup(groupToDelete);
    if (selectedAddGroup === groupToDelete) {
      setSelectedAddGroup("Chung");
    }
    if (studyGroup === groupToDelete) {
      setStudyGroup("Tất cả");
    }
    if (listGroup === groupToDelete) {
      setListGroup("");
    }
    setGroupToDelete("");
    setNotice(`Đã xóa nhóm "${groupToDelete}".`);
    setRefreshTick((prev) => prev + 1);
  };

  const handleNextCard = () => {
    if (scheduledCards.length === 0) {
      return;
    }
    setCardIndex((prev) => (prev + 1) % scheduledCards.length);
    setShowHanViet(false);
    setRevealedFields({});
  };

  const handlePrevCard = () => {
    if (scheduledCards.length === 0) {
      return;
    }
    setCardIndex((prev) => (prev - 1 + scheduledCards.length) % scheduledCards.length);
    setShowHanViet(false);
    setRevealedFields({});
  };

  const handleMarkKnown = () => {
    if (!currentCard) {
      return;
    }
    const next = markKanjiKnown(currentCard.kanji);
    setProgressMap(next);
    setNotice(`Đã đánh dấu "${currentCard.kanji}" là thuộc.`);
    handleNextCard();
  };

  const handleMarkUnknown = () => {
    if (!currentCard) {
      return;
    }
    const next = markKanjiUnknown(currentCard.kanji);
    setProgressMap(next);
    setNotice(`Đã đánh dấu "${currentCard.kanji}" là chưa thuộc.`);
    handleNextCard();
  };

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const performOnlineLookup = async (query: string) => {
    setError("");
    setNotice("");
    setOnlineResult(null);
    if (!query.trim()) {
      setError("Vui lòng nhập từ để tra cứu.");
      return false;
    }

    setIsOnlineLookingUp(true);
    try {
      const result = await lookupVocabularyOnline(query);
      if (!result) {
        setError("Không tìm thấy kết quả phù hợp.");
        return false;
      }
      setWord(result.word);
      setReading(result.reading);
      setMeaningVi(result.meaningVi || "");
      setMeaningEn(result.meaningEn || "");
      setOnlineResult(result);
      setNotice("Đã áp dụng kết quả tra cứu.");
      setEnterLookupReady(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tra cứu lúc này.");
      return false;
    } finally {
      setIsOnlineLookingUp(false);
    }
  };

  const handleLookupOnline = async () => {
    await performOnlineLookup(queryInput.trim());
  };

  const handleApplyLocalSuggestion = () => {
    setError("");
    setNotice("");
    if (!localSuggestion) {
      setError("Không có gợi ý phù hợp.");
      return;
    }
    setWord(localSuggestion.word);
    setReading(localSuggestion.reading);
    setMeaningVi((prev) => (prev.trim() ? prev : localSuggestion.meaningVi));
    setMeaningEn((prev) => (prev.trim() ? prev : localSuggestion.meaningEn));
    setNotice("Đã áp dụng gợi ý.");
  };

  const handleResetForm = () => {
    setError("");
    setNotice("");
    setQueryInput("");
    setWord("");
    setReading("");
    setMeaningVi("");
    setMeaningEn("");
    setOnlineResult(null);
    setEnterLookupReady(false);
  };

  const handleQueryKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (isOnlineLookingUp) {
      return;
    }

    if (enterLookupReady) {
      void saveVocabulary();
      return;
    }

    await performOnlineLookup(queryInput.trim());
  };

  const handleDeleteVocabulary = (entryId: string) => {
    deleteVocabularyById(entryId);
    setNotice("Đã xóa từ vựng.");
    setRefreshTick((prev) => prev + 1);
  };

  const goToPage = (path: "/" | "/study/kanji" | "/study/verbs" | "/study/vocabulary") => {
    if (window.location.pathname === path) {
      return;
    }
    window.history.pushState(null, "", path);
    setCurrentPath(path);
  };

  return (
    <main className={`appShell ${layoutMode === "compact" ? "layoutCompact" : "layoutFull"}`}>
      <div className="container">
      <header className="appHeader">
        <div className="brandRow">
          <div className="heroTitleBlock">
            <img className="brandLogo" src="/logo.png" alt="Nihongo Studio" />
            <div>
              <h1>Kulukulu Nihongo</h1>
              <p className="heroSubtitle">Nền tảng học Kanji và JLPT tập trung, tối giản, hiệu quả.</p>
            </div>
          </div>
          <div className="headerControls">
            <BgmPlayer />
            <button
              type="button"
              className="toolbarBtn"
              onClick={() => setLayoutMode((prev) => (prev === "full" ? "compact" : "full"))}
            >
              <LayoutGrid size={16} />
              {layoutMode === "full" ? "Layout gọn" : "Layout rộng"}
            </button>
            <button type="button" className="toolbarBtn" onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}>
              {theme === "light" ? <MoonStar size={16} /> : <SunMedium size={16} />}
              {theme === "light" ? "Giao diện tối" : "Giao diện sáng"}
            </button>
          </div>
        </div>
        <nav className="mainNav" aria-label="Điều hướng chính">
          <button type="button" className={currentPage === "home" ? "navPill isActive" : "navPill"} onClick={() => goToPage("/")}>
            <span className="navPillInner"><House size={16} />Trang chủ</span>
          </button>
          <button
            type="button"
            className={currentPage === "kanji" ? "navPill isActive" : "navPill"}
            onClick={() => goToPage("/study/kanji")}
            onMouseEnter={prefetchKanjiData}
            onFocus={prefetchKanjiData}
          >
            <span className="navPillInner"><Sparkles size={16} />Học Kanji</span>
          </button>
          <button
            type="button"
            className={currentPage === "verbs" ? "navPill isActive" : "navPill"}
            onClick={() => goToPage("/study/verbs")}
          >
            <span className="navPillInner"><TextSearch size={16} />Động từ</span>
          </button>
          <button
            type="button"
            className={currentPage === "vocabulary" ? "navPill isActive" : "navPill"}
            onClick={() => goToPage("/study/vocabulary")}
          >
            <span className="navPillInner"><BookOpen size={16} />Từ vựng JLPT</span>
          </button>
        </nav>
      </header>

      <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
      {currentPage === "home" && (
      <section className="card inspirationCard">
        <div className="inspirationMain">
          <div className="inspirationKanjiWrap">
            <p className="resultLabel">Kanji hôm nay</p>
            <p className="inspirationKanji">{dailyInspiration.kanji}</p>
            <p className="inspirationMeta">
              Hán Việt: <strong>{dailyInspiration.hanViet}</strong> - {dailyInspiration.keyword}
            </p>
          </div>
          <div className="inspirationQuote">
            <p className="quoteJa">{dailyInspiration.quoteJa}</p>
            <p className="quoteReading">{dailyInspiration.reading}</p>
            <p className="quoteMeaning">{dailyInspiration.meaningVi}</p>
            <button type="button" className="ctaStudyButton btnPrimary" onClick={() => goToPage("/study/kanji")}>
              Bắt đầu học
            </button>
          </div>
        </div>
      </section>
      )}

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      {currentPage === "home" && (
        <>
          <HomeInsightsPanel
            dueCardsCount={dueCardsCount}
            unknownCardsCount={unknownCardsCount}
            totalVocabulary={allVocabulary.length}
            totalGroups={allGroups.length}
          />
        </>
      )}

      {currentPage === "kanji" && (
        <>
          <section className="card studyCard">
            <h2>Flashcard Kanji</h2>
            <div className="toolbar toolbar-2">
              <label>
                Nhóm đang học
                <select value={studyGroup} onChange={(event) => setStudyGroup(event.target.value)}>
                  <option value="Tất cả">Tất cả</option>
                  {allGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chế độ ôn
                <select value={studyFocus} onChange={(event) => setStudyFocus(event.target.value as "priority" | "due" | "new")}>
                  <option value="priority">Ưu tiên thông minh</option>
                  <option value="due">Chỉ thẻ đến hạn</option>
                  <option value="new">Chỉ thẻ chưa thuộc</option>
                </select>
              </label>
              <p className="muted cardCounter">
                Tiến độ thẻ: {scheduledCards.length === 0 ? 0 : cardIndex + 1}/{scheduledCards.length}
              </p>
            </div>
            <p className="muted">
              Hôm nay: {dueCardsCount} thẻ đến hạn · {unknownCardsCount} thẻ chưa thuộc
            </p>

            {!kanjiDataReady ? (
              <p className="muted">Đang tải dữ liệu Kanji...</p>
            ) : currentCard ? (
              <div className="flashcard">
                <div className="flashTopRow">
                  <div className="kanjiPanel">
                    <p className="resultLabel">Kanji</p>
                    <p className="flashKanji">{currentCard.kanji}</p>
                    <p className="resultLabel">Âm Hán Việt</p>
                    <button
                      type="button"
                      className={`blurRevealButton ${showHanViet ? "revealed" : ""}`}
                      onClick={() => setShowHanViet((prev) => !prev)}
                    >
                      {showHanViet ? currentCard.hanViet : "••••••"}
                    </button>
                  </div>
                  <div className="imagePanel">
                    {currentCard.image ? (
                      <img className="kanjiImage" src={currentCard.image} alt={`Minh họa ${currentCard.kanji}`} />
                    ) : (
                      <p className="muted">Chưa có ảnh minh họa.</p>
                    )}
                  </div>
                </div>

                <div className="vocabPanel">
                  <p className="resultLabel">Từ vựng liên quan</p>
                  {currentCard.vocabulary.length === 0 ? (
                    <p className="muted">Chưa có từ liên quan.</p>
                  ) : (
                    <div className="tableWrap">
                      <table className="vocabTable">
                        <thead>
                          <tr>
                            <th>Từ vựng</th>
                            <th>Hiragana</th>
                            <th>Nghĩa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentCard.vocabulary.map((entry) => {
                            const readingKey = `${currentCard.kanji}-${entry.id}-reading`;
                            const meaningKey = `${currentCard.kanji}-${entry.id}-meaning`;
                            const showReading = Boolean(revealedFields[readingKey]);
                            const showMeaning = Boolean(revealedFields[meaningKey]);
                            return (
                              <tr key={`${currentCard.kanji}-${entry.id}`}>
                                <td>{entry.word}</td>
                                <td>
                                  <button
                                    type="button"
                                    className={`blurInline ${showReading ? "revealed" : ""}`}
                                    onClick={() => toggleReveal(readingKey)}
                                  >
                                    {showReading ? entry.reading : "••••••"}
                                  </button>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className={`blurInline ${showMeaning ? "revealed" : ""}`}
                                    onClick={() => toggleReveal(meaningKey)}
                                  >
                                    {showMeaning ? formatMeaningLine(entry) : "••••••••"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="row gap">
                  <button type="button" className="btnSecondary" onClick={handlePrevCard}>
                    Thẻ trước
                  </button>
                  <button type="button" className="btnSecondary" onClick={handleNextCard}>
                    Thẻ tiếp theo
                  </button>
                </div>
                <div className="row gap">
                  <button type="button" className="knownButton" onClick={handleMarkKnown}>
                    Đã thuộc
                  </button>
                  <button type="button" className="unknownButton" onClick={handleMarkUnknown}>
                    Chưa thuộc
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">
                {studyFocus === "due"
                  ? "Không có thẻ đến hạn trong bộ lọc hiện tại."
                  : studyFocus === "new"
                    ? "Không còn thẻ chưa thuộc trong bộ lọc hiện tại."
                    : "Nhóm này chưa có dữ liệu. Hãy thêm từ vựng để bắt đầu học."}
              </p>
            )}
          </section>
        </>
      )}

      {currentPage === "vocabulary" && (
        <Suspense fallback={<PageLoadingCard label="Đang tải tab Từ vựng JLPT..." />}>
          <JlptVocabularyPage />
        </Suspense>
      )}

      {currentPage === "verbs" && (
        <Suspense fallback={<PageLoadingCard label="Đang tải tab Động từ..." />}>
          <section className="card studyCard">
            <h2>Học động từ (N4 trở xuống)</h2>
            <VerbStudyPanel
              verbs={filteredVerbs}
              levelFilter={verbLevelFilter}
              typeFilter={verbTypeFilter}
              onLevelFilterChange={setVerbLevelFilter}
              onTypeFilterChange={setVerbTypeFilter}
            />
          </section>
        </Suspense>
      )}

      {currentPage === "kanji" && (
        <>
          <div className="sectionGrid">
            <section className="card">
              <h2>Quản Lý Nhóm Học</h2>
              <div className="row gap groupRow">
                <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ví dụ: Bài 1" />
                <button type="button" className="btnSecondary" onClick={handleAddGroup}>
                  Tạo nhóm mới
                </button>
              </div>
              <div className="row gap groupRow">
                <select value={groupToDelete} onChange={(event) => setGroupToDelete(event.target.value)}>
                  <option value="">Chọn nhóm để xóa</option>
                  {deletableGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
                <button type="button" className="trashButton" onClick={handleDeleteGroup} disabled={!groupToDelete}>
                  Xóa nhóm
                </button>
              </div>
              <p className="muted">Khi xóa nhóm, từ vựng sẽ chuyển về "Chung".</p>
            </section>
            
            <section className="card">
              <h2>Thêm Từ Vựng</h2>
              <p className="muted">Tra cứu, chỉnh sửa và lưu từ mới.</p>
              <div className="lookupBar">
                <input
                  lang="ja"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  onKeyDown={handleQueryKeyDown}
                  placeholder="Nhập từ cần tra (romaji / hiragana / kanji)"
                />
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={handleLookupOnline}
                  disabled={isOnlineLookingUp || !queryInput.trim()}
                >
                  {isOnlineLookingUp ? "Đang tra..." : "Tra cứu online"}
                </button>
                <button type="button" className="btnSecondary" onClick={handleApplyLocalSuggestion} disabled={!localSuggestion}>
                  Gợi ý cục bộ
                </button>
              </div>
              {localSuggestion && (
                <p className="hint">
                  Gợi ý local: {localSuggestion.word}（{localSuggestion.reading}） - {formatMeaningLine(localSuggestion)}
                </p>
              )}
              <form className="addForm" onSubmit={handleAddVocabulary}>
                <div className="field">
                  <label>Nhóm học</label>
                  <select value={selectedAddGroup} onChange={(event) => setSelectedAddGroup(event.target.value)}>
                    {allGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Tạo nhóm mới</label>
                  <div className="row gap compactRow">
                    <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ví dụ: Bài 3" />
                    <button type="button" className="btnSecondary" onClick={handleAddGroup}>
                      Thêm
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>Từ vựng (Kanji / Japanese)</label>
                  <input
                    lang="ja"
                    value={word}
                    onChange={(event) => setWord(event.target.value)}
                    placeholder="Ví dụ: 学校 / 中学校"
                  />
                </div>

                <div className="field">
                  <label>Cách đọc (Hiragana / Romaji)</label>
                  <input
                    lang="ja"
                    value={reading}
                    onChange={(event) => setReading(event.target.value)}
                    placeholder="Ví dụ: がっこう / gakkou"
                  />
                  <p className="hint">Preview: {readingPreview || "-"}</p>
                </div>

                <div className="field">
                  <label>Nghĩa tiếng Việt</label>
                  <input value={meaningVi} onChange={(event) => setMeaningVi(event.target.value)} placeholder="Ví dụ: trường học" />
                </div>

                <div className="field">
                  <label>Nghĩa tiếng Anh</label>
                  <input value={meaningEn} onChange={(event) => setMeaningEn(event.target.value)} placeholder="Ví dụ: school" />
                </div>

                <div className="row gap actionsRow">
                  <button type="submit" className="btnPrimary">
                    Lưu từ vựng
                  </button>
                  <button type="button" className="btnSecondary" onClick={handleResetForm}>
                    Làm mới form
                  </button>
                </div>
              </form>
              {onlineResult && (
                <p className="hint">
                  Nguồn {onlineResult.source}: {onlineResult.word}（{onlineResult.reading}） · {onlineResult.meaningVi || onlineResult.meaningEn}
                </p>
              )}
              <p className="hint">Âm Hán: {hanVietPreview}</p>
            </section>
          </div>

          <section className="card">
            <h2>Danh Sách Từ Vựng</h2>
            <div className="row gap">
              <select value={listGroup} onChange={(event) => setListGroup(event.target.value)}>
                <option value="">Chọn nhóm để hiển thị danh sách từ</option>
                {allGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
            {listGroup ? (
              <VocabularyList entries={listEntries} emptyText="Nhóm này chưa có từ vựng." onDelete={handleDeleteVocabulary} />
            ) : (
              <p className="muted">Chọn nhóm để hiển thị danh sách.</p>
            )}
          </section>
        </>
      )}
      </motion.div>
      </AnimatePresence>
      <div className="floatingActions">
        {currentPage === "kanji" ? (
          <>
            <button type="button" className="btnSecondary" onClick={handleNextCard} disabled={!currentCard}>
              Thẻ tiếp
            </button>
            <button
              type="button"
              className="btnPrimary"
              onClick={handleLookupOnline}
              disabled={isOnlineLookingUp || !queryInput.trim()}
            >
              Tra nhanh
            </button>
          </>
        ) : currentPage === "verbs" ? (
          <button type="button" className="btnSecondary" onClick={() => goToPage("/study/kanji")}>
            Sang Học Kanji
          </button>
        ) : currentPage === "vocabulary" ? (
          <button type="button" className="btnSecondary" onClick={() => goToPage("/")}>
            Về trang chủ
          </button>
        ) : (
          <button type="button" className="btnPrimary" onClick={() => goToPage("/study/verbs")}>
            Học động từ
          </button>
        )}
      </div>
      </div>
    </main>
  );
}

function PageLoadingCard({ label }: { label: string }) {
  return (
    <section className="card pageLoadingCard" aria-live="polite" aria-busy="true">
      <div className="pageLoadingBar" />
      <p className="muted">{label}</p>
    </section>
  );
}


function buildFlashCards(
  studyGroup: string,
  vocabulary: VocabularyEntry[],
  importedRecords: ImportedKanjiRecord[],
  importedByKanji: Record<string, ImportedKanjiRecord>
): FlashCard[] {
  const scopedVocabulary = studyGroup === "Tất cả" ? vocabulary : vocabulary.filter((item) => item.group === studyGroup);
  const kanjiSet = new Set<string>();

  if (studyGroup === "Tất cả") {
    for (const item of importedRecords) {
      kanjiSet.add(item.kanji);
    }
  }

  for (const item of scopedVocabulary) {
    for (const kanji of getKanjiCharacters(item.word)) {
      kanjiSet.add(kanji);
    }
  }

  return Array.from(kanjiSet)
    .sort((a, b) => a.localeCompare(b))
    .map((kanji) => {
    const imported = importedByKanji[kanji];
    return {
      kanji,
      hanViet: renderHanViet(kanji, importedByKanji),
      image: imported?.image || "",
      vocabulary: findByKanjiCharacter(kanji, scopedVocabulary)
    };
  });
}

function renderHanViet(word: string, importedByKanji: Record<string, ImportedKanjiRecord>): string {
  const parts: string[] = [];
  for (const ch of word) {
    if (!/\p{Script=Han}/u.test(ch)) {
      continue;
    }
    const imported = importedByKanji[ch]?.hanViet?.trim();
    if (imported) {
      parts.push(imported);
      continue;
    }
    const fallback = toHanVietFromKanji(ch);
    if (fallback && fallback !== "Không tìm thấy chữ Kanji hợp lệ.") {
      parts.push(fallback);
    }
  }
  if (parts.length === 0) {
    return "Không tìm thấy chữ Kanji hợp lệ.";
  }
  return parts.join(" ");
}

function scheduleCards(cards: FlashCard[], progressMap: Record<string, KanjiProgress>): FlashCard[] {
  const now = Date.now();
  return [...cards].sort((a, b) => {
    const pa = progressMap[a.kanji];
    const pb = progressMap[b.kanji];
    const wa = getPriorityWeight(pa, now);
    const wb = getPriorityWeight(pb, now);
    if (wa !== wb) {
      return wa - wb;
    }
    const da = pa?.dueAt || 0;
    const db = pb?.dueAt || 0;
    if (da !== db) {
      return da - db;
    }
    return a.kanji.localeCompare(b.kanji);
  });
}

function getPriorityWeight(progress: KanjiProgress | undefined, now: number): number {
  if (!progress) {
    return 0;
  }
  if (!progress.known) {
    return 0;
  }
  if (progress.dueAt <= now) {
    return 1;
  }
  return 2;
}

const DAILY_INSPIRATIONS: InspirationItem[] = [
  {
    kanji: "忍",
    hanViet: "Nhẫn",
    keyword: "Kiên nhẫn và bền bỉ",
    quoteJa: "小さな努力を、毎日積み重ねよう。",
    reading: "Chiisana doryoku o, mainichi tsumikasaneyou.",
    meaningVi: "Hãy tích lũy những nỗ lực nhỏ mỗi ngày, rồi kết quả lớn sẽ đến."
  },
  {
    kanji: "和",
    hanViet: "Hòa",
    keyword: "Hài hòa với bản thân và người khác",
    quoteJa: "相手を理解することは、自分を育てること。",
    reading: "Aite o rikai suru koto wa, jibun o sodateru koto.",
    meaningVi: "Hiểu người khác cũng là cách nuôi lớn chính mình."
  },
  {
    kanji: "夢",
    hanViet: "Mộng",
    keyword: "Giữ ước mơ đủ lâu",
    quoteJa: "夢は、続ける人を裏切らない。",
    reading: "Yume wa, tsuzukeru hito o uragiranai.",
    meaningVi: "Ước mơ không phản bội người biết kiên trì."
  },
  {
    kanji: "誠",
    hanViet: "Thành",
    keyword: "Chân thành trong hành động",
    quoteJa: "誠実さは、信頼をつくる最短の道。",
    reading: "Seijitsusa wa, shinrai o tsukuru saitan no michi.",
    meaningVi: "Sự chân thành là con đường ngắn nhất để tạo nên niềm tin."
  },
  {
    kanji: "光",
    hanViet: "Quang",
    keyword: "Tìm ánh sáng trong khó khăn",
    quoteJa: "暗い日にも、学びは光になる。",
    reading: "Kurai hi ni mo, manabi wa hikari ni naru.",
    meaningVi: "Ngay cả ngày tối nhất, việc học vẫn có thể trở thành ánh sáng."
  },
  {
    kanji: "勇",
    hanViet: "Dũng",
    keyword: "Can đảm bắt đầu",
    quoteJa: "一歩目の勇気が、未来を変える。",
    reading: "Ippome no yuuki ga, mirai o kaeru.",
    meaningVi: "Sự can đảm ở bước đầu tiên có thể thay đổi tương lai."
  }
];

function getDailyInspiration(date: Date): InspirationItem {
  const daySeed = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return DAILY_INSPIRATIONS[Math.abs(daySeed) % DAILY_INSPIRATIONS.length];
}

export default App;
