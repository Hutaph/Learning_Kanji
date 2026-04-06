import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useState, useRef } from "react";
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
import { KanjiProgress, VocabularyEntry } from "./types";
import { JlptVocabularyPage } from "./components/JlptVocabularyPage";
import { loadLearnedMap, countLearned } from "./vocabulary/jlptProgress";
import n5Pack from "./data/n5Vocabulary.json";
import n4Pack from "./data/n4Vocabulary.json";
import importedKanjiData from "./data/kanjiImported.json";
import { speakJapanese } from "./audio";

function BgmPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((e) => console.error("Audio block:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="bgmPlayer">
      <audio ref={audioRef} loop src="https://stream.zeno.fm/0r0xa792kwzuv" />
      <button type="button" className={`toolbarBtn ${isPlaying ? "bgmActive" : ""}`} onClick={togglePlay} title="Lofi Radio">
        {isPlaying ? "⏸ Tạm dừng nhạc" : "🎵 Bật Lofi"}
      </button>
      {isPlaying && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="bgmVolume"
        />
      )}
    </div>
  );
}

interface FlashCard {
  kanji: string;
  hanViet: string;
  image: string;
  vocabulary: VocabularyEntry[];
}

interface ImportedKanjiRecord {
  id: string;
  kanji: string;
  hanViet: string;
  image: string;
}

type VerbType = "godan" | "ichidan" | "irregular";
type VerbLevel = "N5" | "N4";

interface InspirationItem {
  kanji: string;
  hanViet: string;
  keyword: string;
  quoteJa: string;
  reading: string;
  meaningVi: string;
}

interface VerbLesson {
  dictionary: string;
  kana: string;
  meaningVi: string;
  jlpt: VerbLevel;
  type: VerbType;
}

interface VerbConjugation {
  label: string;
  form: string;
  note: string;
}

interface GroupStat {
  group: string;
  count: number;
}

interface KanjiFrequency {
  kanji: string;
  count: number;
}

interface GroupMasteryStat {
  group: string;
  known: number;
  total: number;
  rate: number;
}

function App() {
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
  const [studyGroup, setStudyGroup] = useState("Tất cả");
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

  const importedRecords = useMemo(() => importedKanjiData as ImportedKanjiRecord[], []);
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
  const scheduledCards = useMemo(() => scheduleCards(cards, progressMap), [cards, progressMap]);
  const unknownCardsCount = useMemo(
    () => scheduledCards.filter((card) => !progressMap[card.kanji]?.known).length,
    [scheduledCards, progressMap]
  );
  const dueCardsCount = useMemo(() => {
    const now = Date.now();
    return scheduledCards.filter((card) => {
      const progress = progressMap[card.kanji];
      return Boolean(progress?.known && progress.dueAt <= now);
    }).length;
  }, [scheduledCards, progressMap]);
  const currentCard = scheduledCards[cardIndex] || null;
  const dailyInspiration = useMemo(() => getDailyInspiration(new Date()), []);
  const filteredVerbs = useMemo(() => {
    return JLPT_VERBS.filter((verb) => {
      const passLevel = verbLevelFilter === "Tất cả" || verb.jlpt === verbLevelFilter;
      const passType = verbTypeFilter === "Tất cả" || verb.type === verbTypeFilter;
      return passLevel && passType;
    });
  }, [verbLevelFilter, verbTypeFilter]);
  const knownCardsCount = useMemo(
    () => scheduledCards.filter((card) => Boolean(progressMap[card.kanji]?.known)).length,
    [scheduledCards, progressMap]
  );
  const masteryRate = useMemo(() => {
    if (scheduledCards.length === 0) {
      return 0;
    }
    return Math.round((knownCardsCount / scheduledCards.length) * 100);
  }, [knownCardsCount, scheduledCards.length]);
  const recentGroupMastery = useMemo(() => {
    const groupLatestMap: Record<string, number> = {};
    for (const item of allVocabulary) {
      const ts = Date.parse(item.createdAt || "");
      const time = Number.isFinite(ts) ? ts : 0;
      if (!groupLatestMap[item.group] || groupLatestMap[item.group] < time) {
        groupLatestMap[item.group] = time;
      }
    }

    const recentGroups = Object.entries(groupLatestMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([group]) => group);

    return recentGroups.map((group) => {
      const cards = buildFlashCards(group, allVocabulary, importedRecords, importedByKanji);
      const known = cards.filter((card) => Boolean(progressMap[card.kanji]?.known)).length;
      const total = cards.length;
      const rate = total === 0 ? 0 : Math.round((known / total) * 100);
      return { group, known, total, rate };
    });
  }, [allVocabulary, importedByKanji, importedRecords, progressMap]);
  const topGroups = useMemo(() => {
    const bucket: Record<string, number> = {};
    for (const item of allVocabulary) {
      bucket[item.group] = (bucket[item.group] || 0) + 1;
    }
    return Object.entries(bucket)
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allVocabulary]);
  const topKanji = useMemo(() => {
    const bucket: Record<string, number> = {};
    for (const item of allVocabulary) {
      for (const kanji of getKanjiCharacters(item.word)) {
        bucket[kanji] = (bucket[kanji] || 0) + 1;
      }
    }
    return Object.entries(bucket)
      .map(([kanji, count]) => ({ kanji, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [allVocabulary]);
  const studyInsight = useMemo(() => {
    if (dueCardsCount > 0) {
      return `Hôm nay có ${dueCardsCount} thẻ đến hạn ôn. Làm trước nhóm này sẽ giúp nhớ lâu hơn.`;
    }
    if (unknownCardsCount > 0) {
      return `Bạn còn ${unknownCardsCount} thẻ chưa thuộc. Cứ mỗi ngày xử lý 5-10 thẻ là rất ổn.`;
    }
    return "Tiến độ rất tốt! Hôm nay phù hợp để mở rộng thêm từ mới hoặc động từ mới.";
  }, [dueCardsCount, unknownCardsCount]);
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
      setError("Vui lòng nhập đủ Từ vựng, Cách đọc và ít nhất một nghĩa (Việt hoặc Anh) trước khi lưu.");
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
    setNotice("Đã lưu từ vựng thành công.");
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
    const ok = window.confirm(`Xóa nhóm "${groupToDelete}"? Các từ trong nhóm sẽ chuyển về "Chung".`);
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
    setNotice(`Đã xóa nhóm "${groupToDelete}" và chuyển từ vựng về Chung.`);
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

  const handleExportData = () => {
    const data = {
      vocabulary: JSON.parse(localStorage.getItem("kanji_vocabulary_list") || "[]"),
      groups: JSON.parse(localStorage.getItem("kanji_vocabulary_groups") || '["Chung"]'),
      progress: JSON.parse(localStorage.getItem("kanji-learned") || "{}"),
      jlptN5: JSON.parse(localStorage.getItem("jlpt-progress-N5") || "{}"),
      jlptN4: JSON.parse(localStorage.getItem("jlpt-progress-N4") || "{}")
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kulukulu_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Đã tải file sao lưu gốc JSON (Flashcard + JLPT) thành công.");
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = window.confirm("Cảnh báo: Nhập dữ liệu sẽ GHI ĐÈ toàn bộ tiến độ và từ vựng hiện tại. Bạn có chắc chắn?");
    if (!ok) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const data = JSON.parse(text);
        if (data.vocabulary) localStorage.setItem("kanji_vocabulary_list", JSON.stringify(data.vocabulary));
        if (data.groups) localStorage.setItem("kanji_vocabulary_groups", JSON.stringify(data.groups));
        if (data.progress) localStorage.setItem("kanji-learned", JSON.stringify(data.progress));
        if (data.jlptN5) localStorage.setItem("jlpt-progress-N5", JSON.stringify(data.jlptN5));
        if (data.jlptN4) localStorage.setItem("jlpt-progress-N4", JSON.stringify(data.jlptN4));
        setNotice("Phục hồi dữ liệu thành công! Đang khởi động lại...");
        setRefreshTick(r => r + 1);
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setError("File không hợp lệ hoặc cấu trúc bị lỗi.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  const handleMarkKnown = () => {
    if (!currentCard) {
      return;
    }
    const next = markKanjiKnown(currentCard.kanji);
    setProgressMap(next);
    setNotice(`Đã đánh dấu "${currentCard.kanji}" là Đã thuộc.`);
    handleNextCard();
  };

  const handleMarkUnknown = () => {
    if (!currentCard) {
      return;
    }
    const next = markKanjiUnknown(currentCard.kanji);
    setProgressMap(next);
    setNotice(`Đã đánh dấu "${currentCard.kanji}" là Chưa thuộc.`);
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
      setError("Hãy nhập từ (romaji/hiragana/kanji) trước khi tra online.");
      return false;
    }

    setIsOnlineLookingUp(true);
    try {
      const result = await lookupVocabularyOnline(query);
      if (!result) {
        setError("Không tìm thấy từ phù hợp trên Jisho.");
        return false;
      }
      setWord(result.word);
      setReading(result.reading);
      setMeaningVi(result.meaningVi || "");
      setMeaningEn(result.meaningEn || "");
      setOnlineResult(result);
      setNotice("Đã điền dữ liệu từ tra cứu online (gồm cả nghĩa Việt và Anh).");
      setEnterLookupReady(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tra online lúc này.");
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
      setError("Không có gợi ý local phù hợp.");
      return;
    }
    setWord(localSuggestion.word);
    setReading(localSuggestion.reading);
    setMeaningVi((prev) => (prev.trim() ? prev : localSuggestion.meaningVi));
    setMeaningEn((prev) => (prev.trim() ? prev : localSuggestion.meaningEn));
    setNotice("Đã áp dụng gợi ý local vào form.");
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
              <p className="heroSubtitle">Học từ vựng JLPT, Kanji và Ngữ pháp tập trung, không phân tâm.</p>
            </div>
          </div>
          <div className="headerControls">
            <BgmPlayer />
            <button
              type="button"
              className="toolbarBtn"
              onClick={() => setLayoutMode((prev) => (prev === "full" ? "compact" : "full"))}
            >
              {layoutMode === "full" ? "Layout gọn" : "Layout rộng"}
            </button>
            <button type="button" className="toolbarBtn" onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}>
              {theme === "light" ? "Giao diện tối" : "Giao diện sáng"}
            </button>
          </div>
        </div>
        <nav className="mainNav" aria-label="Điều hướng chính">
          <button type="button" className={currentPage === "home" ? "navPill isActive" : "navPill"} onClick={() => goToPage("/")}>
            Trang chủ
          </button>
          <button
            type="button"
            className={currentPage === "kanji" ? "navPill isActive" : "navPill"}
            onClick={() => goToPage("/study/kanji")}
          >
            Học Kanji
          </button>
          <button
            type="button"
            className={currentPage === "verbs" ? "navPill isActive" : "navPill"}
            onClick={() => goToPage("/study/verbs")}
          >
            Động từ
          </button>
          <button
            type="button"
            className={currentPage === "vocabulary" ? "navPill isActive" : "navPill"}
            onClick={() => goToPage("/study/vocabulary")}
          >
            Từ vựng JLPT
          </button>
        </nav>
      </header>

      {currentPage === "home" && (
      <section className="card inspirationCard">
        <div className="inspirationMain">
          <div className="inspirationKanjiWrap">
            <p className="resultLabel">Kanji nhân văn trong ngày</p>
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
              Bắt đầu học Kanji
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
            masteryRate={masteryRate}
            recentGroupMastery={recentGroupMastery}
            dueCardsCount={dueCardsCount}
            unknownCardsCount={unknownCardsCount}
            totalVocabulary={allVocabulary.length}
            totalGroups={allGroups.length}
            topGroups={topGroups}
            topKanji={topKanji}
            insight={studyInsight}
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
              <p className="muted cardCounter">
                Tiến độ thẻ: {scheduledCards.length === 0 ? 0 : cardIndex + 1}/{scheduledCards.length}
              </p>
            </div>
            <p className="hint">
              Ôn tập thông minh: thẻ Chưa thuộc được ưu tiên hiển thị trước.
            </p>

            {currentCard ? (
              <div className="flashcard">
                <div className="flashTopRow">
                  <div className="kanjiPanel">
                    <p className="resultLabel">Kanji</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "16px" }}>
                      <p className="flashKanji" style={{ margin: 0 }}>{currentCard.kanji}</p>
                      <button 
                        type="button" 
                        className="toolbarBtn" 
                        onClick={() => speakJapanese(currentCard.kanji)}
                        style={{ borderRadius: "50%", padding: "8px", width: "48px", height: "48px", fontSize: "1.2rem", flexShrink: 0 }}
                        title="Phát âm"
                      >
                        🔊
                      </button>
                    </div>
                    <p className="resultLabel">Âm Hán Việt (nhấn để hiện)</p>
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
                      <p className="muted">Chưa có ảnh minh họa cho Kanji này.</p>
                    )}
                  </div>
                </div>

                <div className="vocabPanel">
                  <p className="resultLabel">Từ vựng liên quan</p>
                  <p className="muted">Nhấn vào chữ mờ để hiện Hiragana hoặc Nghĩa.</p>
                  {currentCard.vocabulary.length === 0 ? (
                    <p className="muted">Chưa có từ vựng nào chứa Kanji này.</p>
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
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    {entry.word}
                                    <button 
                                      type="button" 
                                      className="btnGhost" 
                                      style={{ padding: "4px", fontSize: "1rem" }}
                                      onClick={() => speakJapanese(entry.word)}
                                      title="Nghe"
                                    >
                                      🔊
                                    </button>
                                  </div>
                                </td>
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
              <p className="muted">Nhóm này chưa có dữ liệu. Hãy thêm từ vựng để bắt đầu học.</p>
            )}
          </section>
        </>
      )}

      {currentPage === "vocabulary" && <JlptVocabularyPage />}

      {currentPage === "verbs" && (
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
              <p className="muted">Khi xóa nhóm, các từ vựng trong nhóm sẽ được chuyển về "Chung".</p>
            </section>
            
            <section className="card">
              <h2>Sao Lưu Dữ Liệu</h2>
              <p className="muted">Hãy Export thường xuyên để đảm bảo tiến độ và từ vựng tự nạp không bị mất khi dọn Browser Cache.</p>
              <div className="row gap groupRow">
                <button type="button" className="btnPrimary" onClick={handleExportData}>
                  Tải Backup (Export)
                </button>
                <label className="btnSecondary" style={{ cursor: "pointer", textAlign: "center" }}>
                  Phục hồi gốc (Import)
                  <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImportData} />
                </label>
              </div>
            </section>

            <section className="card">
              <h2>Thêm Từ Vựng</h2>
              <p className="muted">Bước 1: Tra cứu nhanh. Bước 2: Chỉnh sửa. Bước 3: Lưu vào nhóm học.</p>
              <div className="lookupBar">
                <input
                  lang="ja"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  onKeyDown={handleQueryKeyDown}
                  placeholder="Nhập từ cần tra (Romaji / Hiragana / Kanji). Ví dụ: gakkou"
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
              <p className="hint">Mẹo nhanh: Enter lần 1 để tra cứu, Enter lần 2 để lưu vào nhóm đang chọn.</p>
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
                  <p className="hint">Xem trước cách đọc: {readingPreview || "-"}</p>
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
                  Kết quả online ({onlineResult.source}): {onlineResult.word}（{onlineResult.reading}） - VI:{" "}
                  {onlineResult.meaningVi || onlineResult.meaningEn} | EN: {onlineResult.meaningEn} | Hán Việt:{" "}
                  {renderHanViet(onlineResult.word, importedByKanji)}
                </p>
              )}
              <p className="hint">Hán Việt (tự động theo từ hiện tại): {hanVietPreview}</p>
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
              <p className="muted">Danh sách đang ẩn. Hãy chọn nhóm để hiển thị.</p>
            )}
          </section>
        </>
      )}
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

function VocabularyList({
  entries,
  emptyText,
  onDelete
}: {
  entries: VocabularyEntry[];
  emptyText: string;
  onDelete?: (id: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="tableWrap">
      <table className="listTable">
        <thead>
          <tr>
            <th>Nhóm</th>
            <th>Kanji</th>
            <th>Hiragana</th>
            <th>Nghĩa</th>
            <th>Xóa</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.group}</td>
              <td>{entry.word}</td>
              <td>{entry.reading}</td>
              <td>{formatMeaningLine(entry)}</td>
              <td>
                <button
                  type="button"
                  className="trashButton"
                  onClick={() => onDelete?.(entry.id)}
                  aria-label={`Xóa ${entry.word}`}
                  title="Xóa từ vựng"
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerbStudyPanel({
  verbs,
  levelFilter,
  typeFilter,
  onLevelFilterChange,
  onTypeFilterChange
}: {
  verbs: VerbLesson[];
  levelFilter: "Tất cả" | VerbLevel;
  typeFilter: "Tất cả" | VerbType;
  onLevelFilterChange: (value: "Tất cả" | VerbLevel) => void;
  onTypeFilterChange: (value: "Tất cả" | VerbType) => void;
}) {
  return (
    <div className="verbMode">
      <p className="muted">
        Luyện chia động từ N5-N4 với các thể thông dụng: ます, て, た, ない, khả năng, ý chí, mệnh lệnh, điều kiện,
        bị động, sai khiến.
      </p>
      <div className="verbFilters">
        <label>
          Cấp độ
          <select value={levelFilter} onChange={(event) => onLevelFilterChange(event.target.value as "Tất cả" | VerbLevel)}>
            <option value="Tất cả">Tất cả</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
          </select>
        </label>
        <label>
          Loại động từ
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as "Tất cả" | VerbType)}>
            <option value="Tất cả">Tất cả</option>
            <option value="godan">Godan (Nhóm 1)</option>
            <option value="ichidan">Ichidan (Nhóm 2)</option>
            <option value="irregular">Bất quy tắc (Nhóm 3)</option>
          </select>
        </label>
      </div>
      {verbs.length === 0 ? (
        <p className="muted">Không có động từ phù hợp với bộ lọc hiện tại.</p>
      ) : (
        <div className="verbCards">
          {verbs.map((verb) => {
            const forms = conjugateVerb(verb);
            return (
              <article key={verb.dictionary} className="verbCard">
                <div className="verbCardHeader">
                  <h3>{verb.dictionary}</h3>
                  <p className="muted">{verb.kana}</p>
                  <p className="muted">
                    {verb.meaningVi} - {verb.jlpt} - {verbTypeToLabel(verb.type)}
                  </p>
                </div>
                <div className="tableWrap">
                  <table className="verbTable">
                    <thead>
                      <tr>
                        <th>Thể</th>
                        <th>Dạng chia</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forms.map((row) => (
                        <tr key={`${verb.dictionary}-${row.label}`}>
                          <td>{row.label}</td>
                          <td>{row.form}</td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HomeInsightsPanel({
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

function formatMeaningLine(entry: VocabularyEntry): string {
  const vi = entry.meaningVi?.trim() || "";
  const en = entry.meaningEn?.trim() || "";
  if (vi && en) {
    return `VI: ${vi} | EN: ${en}`;
  }
  if (vi) {
    return `VI: ${vi}`;
  }
  if (en) {
    return `EN: ${en}`;
  }
  return "Chưa có nghĩa";
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

const JLPT_VERBS: VerbLesson[] = [
  { dictionary: "行く", kana: "いく", meaningVi: "đi", jlpt: "N5", type: "godan" },
  { dictionary: "書く", kana: "かく", meaningVi: "viết", jlpt: "N5", type: "godan" },
  { dictionary: "聞く", kana: "きく", meaningVi: "nghe/hỏi", jlpt: "N5", type: "godan" },
  { dictionary: "飲む", kana: "のむ", meaningVi: "uống", jlpt: "N5", type: "godan" },
  { dictionary: "読む", kana: "よむ", meaningVi: "đọc", jlpt: "N5", type: "godan" },
  { dictionary: "話す", kana: "はなす", meaningVi: "nói", jlpt: "N5", type: "godan" },
  { dictionary: "待つ", kana: "まつ", meaningVi: "đợi", jlpt: "N5", type: "godan" },
  { dictionary: "帰る", kana: "かえる", meaningVi: "về", jlpt: "N5", type: "godan" },
  { dictionary: "使う", kana: "つかう", meaningVi: "sử dụng", jlpt: "N5", type: "godan" },
  { dictionary: "買う", kana: "かう", meaningVi: "mua", jlpt: "N5", type: "godan" },
  { dictionary: "食べる", kana: "たべる", meaningVi: "ăn", jlpt: "N5", type: "ichidan" },
  { dictionary: "見る", kana: "みる", meaningVi: "xem/nhìn", jlpt: "N5", type: "ichidan" },
  { dictionary: "起きる", kana: "おきる", meaningVi: "thức dậy", jlpt: "N5", type: "ichidan" },
  { dictionary: "寝る", kana: "ねる", meaningVi: "ngủ", jlpt: "N5", type: "ichidan" },
  { dictionary: "開ける", kana: "あける", meaningVi: "mở", jlpt: "N4", type: "ichidan" },
  { dictionary: "閉める", kana: "しめる", meaningVi: "đóng", jlpt: "N4", type: "ichidan" },
  { dictionary: "借りる", kana: "かりる", meaningVi: "mượn", jlpt: "N4", type: "ichidan" },
  { dictionary: "調べる", kana: "しらべる", meaningVi: "tra cứu", jlpt: "N4", type: "ichidan" },
  { dictionary: "働く", kana: "はたらく", meaningVi: "làm việc", jlpt: "N4", type: "godan" },
  { dictionary: "作る", kana: "つくる", meaningVi: "làm/chế tạo", jlpt: "N4", type: "godan" },
  { dictionary: "持つ", kana: "もつ", meaningVi: "cầm/nắm", jlpt: "N4", type: "godan" },
  { dictionary: "手伝う", kana: "てつだう", meaningVi: "giúp đỡ", jlpt: "N4", type: "godan" },
  { dictionary: "勉強する", kana: "べんきょうする", meaningVi: "học", jlpt: "N5", type: "irregular" },
  { dictionary: "来る", kana: "くる", meaningVi: "đến", jlpt: "N5", type: "irregular" }
];

function getDailyInspiration(date: Date): InspirationItem {
  const daySeed = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return DAILY_INSPIRATIONS[Math.abs(daySeed) % DAILY_INSPIRATIONS.length];
}

function conjugateVerb(verb: VerbLesson): VerbConjugation[] {
  const dictionaryKana = verb.kana;

  if (verb.type === "ichidan") {
    const stem = dictionaryKana.slice(0, -1);
    return [
      { label: "Từ điển", form: dictionaryKana, note: "Dạng thường, hiện tại/tương lai" },
      { label: "ます", form: `${stem}ます`, note: "Lịch sự" },
      { label: "て", form: `${stem}て`, note: "Liên kết câu / yêu cầu" },
      { label: "た", form: `${stem}た`, note: "Quá khứ thường" },
      { label: "ない", form: `${stem}ない`, note: "Phủ định thường" },
      { label: "Khả năng", form: `${stem}られる`, note: "Có thể làm" },
      { label: "Ý chí", form: `${stem}よう`, note: "Thể rủ rê / quyết tâm" },
      { label: "Mệnh lệnh", form: `${stem}ろ`, note: "Mệnh lệnh trực tiếp" },
      { label: "Điều kiện", form: `${stem}れば`, note: "Nếu..." },
      { label: "Bị động", form: `${stem}られる`, note: "Bị..." },
      { label: "Sai khiến", form: `${stem}させる`, note: "Khiến/cho phép..." },
      { label: "Sai khiến bị động", form: `${stem}させられる`, note: "Bị ép phải..." }
    ];
  }

  if (verb.type === "irregular") {
    if (dictionaryKana.endsWith("する")) {
      const stem = dictionaryKana.slice(0, -2);
      const potential = stem ? `${stem}できる` : "できる";
      return [
        { label: "Từ điển", form: dictionaryKana, note: "Dạng thường, hiện tại/tương lai" },
        { label: "ます", form: `${stem}します`, note: "Lịch sự" },
        { label: "て", form: `${stem}して`, note: "Liên kết câu / yêu cầu" },
        { label: "た", form: `${stem}した`, note: "Quá khứ thường" },
        { label: "ない", form: `${stem}しない`, note: "Phủ định thường" },
        { label: "Khả năng", form: potential, note: "Có thể làm" },
        { label: "Ý chí", form: `${stem}しよう`, note: "Thể rủ rê / quyết tâm" },
        { label: "Mệnh lệnh", form: `${stem}しろ`, note: "Mệnh lệnh trực tiếp" },
        { label: "Điều kiện", form: `${stem}すれば`, note: "Nếu..." },
        { label: "Bị động", form: `${stem}される`, note: "Bị..." },
        { label: "Sai khiến", form: `${stem}させる`, note: "Khiến/cho phép..." },
        { label: "Sai khiến bị động", form: `${stem}させられる`, note: "Bị ép phải..." }
      ];
    }
    return [
      { label: "Từ điển", form: "くる", note: "Dạng thường, hiện tại/tương lai" },
      { label: "ます", form: "きます", note: "Lịch sự" },
      { label: "て", form: "きて", note: "Liên kết câu / yêu cầu" },
      { label: "た", form: "きた", note: "Quá khứ thường" },
      { label: "ない", form: "こない", note: "Phủ định thường" },
      { label: "Khả năng", form: "こられる", note: "Có thể đến" },
      { label: "Ý chí", form: "こよう", note: "Thể rủ rê / quyết tâm" },
      { label: "Mệnh lệnh", form: "こい", note: "Mệnh lệnh trực tiếp" },
      { label: "Điều kiện", form: "くれば", note: "Nếu..." },
      { label: "Bị động", form: "こられる", note: "Bị..." },
      { label: "Sai khiến", form: "こさせる", note: "Khiến/cho phép..." },
      { label: "Sai khiến bị động", form: "こさせられる", note: "Bị ép phải..." }
    ];
  }

  const stem = dictionaryKana.slice(0, -1);
  const last = dictionaryKana[dictionaryKana.length - 1] as string;
  const iMap: Record<string, string> = { う: "い", く: "き", ぐ: "ぎ", す: "し", つ: "ち", ぬ: "に", ぶ: "び", む: "み", る: "り" };
  const aMap: Record<string, string> = { う: "わ", く: "か", ぐ: "が", す: "さ", つ: "た", ぬ: "な", ぶ: "ば", む: "ま", る: "ら" };
  const eMap: Record<string, string> = { う: "え", く: "け", ぐ: "げ", す: "せ", つ: "て", ぬ: "ね", ぶ: "べ", む: "め", る: "れ" };
  const oMap: Record<string, string> = { う: "お", く: "こ", ぐ: "ご", す: "そ", つ: "と", ぬ: "の", ぶ: "ぼ", む: "も", る: "ろ" };
  let te = `${stem}って`;
  let ta = `${stem}った`;
  if (dictionaryKana === "いく") {
    te = "いって";
    ta = "いった";
  } else if (last === "く") {
    te = `${stem}いて`;
    ta = `${stem}いた`;
  } else if (last === "ぐ") {
    te = `${stem}いで`;
    ta = `${stem}いだ`;
  } else if (last === "す") {
    te = `${stem}して`;
    ta = `${stem}した`;
  } else if (last === "む" || last === "ぶ" || last === "ぬ") {
    te = `${stem}んで`;
    ta = `${stem}んだ`;
  }

  return [
    { label: "Từ điển", form: dictionaryKana, note: "Dạng thường, hiện tại/tương lai" },
    { label: "ます", form: `${stem}${iMap[last]}ます`, note: "Lịch sự" },
    { label: "て", form: te, note: "Liên kết câu / yêu cầu" },
    { label: "た", form: ta, note: "Quá khứ thường" },
    { label: "ない", form: `${stem}${aMap[last]}ない`, note: "Phủ định thường" },
    { label: "Khả năng", form: `${stem}${eMap[last]}る`, note: "Có thể làm" },
    { label: "Ý chí", form: `${stem}${oMap[last]}う`, note: "Thể rủ rê / quyết tâm" },
    { label: "Mệnh lệnh", form: `${stem}${eMap[last]}`, note: "Mệnh lệnh trực tiếp" },
    { label: "Điều kiện", form: `${stem}${eMap[last]}ば`, note: "Nếu..." },
    { label: "Bị động", form: `${stem}${aMap[last]}れる`, note: "Bị..." },
    { label: "Sai khiến", form: `${stem}${aMap[last]}せる`, note: "Khiến/cho phép..." },
    { label: "Sai khiến bị động", form: `${stem}${aMap[last]}せられる`, note: "Bị ép phải..." }
  ];
}

function verbTypeToLabel(type: VerbType): string {
  if (type === "godan") {
    return "Godan (Nhóm 1)";
  }
  if (type === "ichidan") {
    return "Ichidan (Nhóm 2)";
  }
  return "Bất quy tắc (Nhóm 3)";
}

export default App;
