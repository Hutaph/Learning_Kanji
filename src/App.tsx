import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
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
import importedKanjiData from "./data/kanjiImported.json";

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
  const currentCard = scheduledCards[cardIndex] || null;

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

  return (
    <main className="appShell">
      <div className={`container ${layoutMode === "compact" ? "layoutCompact" : "layoutFull"}`}>
      <header className="hero">
        <div className="brand">
          <img className="brandLogo" src="/logo.png" alt="Kanji Learning Logo" />
          <div>
            <h1>Kanji Learning Studio</h1>
            <p className="heroSubtitle">Học Kanji bằng flashcard, hình ảnh và hệ thống nhóm cá nhân hóa.</p>
          </div>
          <div className="headerControls">
            <button
              type="button"
              className="themeSwitch"
              onClick={() => setLayoutMode((prev) => (prev === "full" ? "compact" : "full"))}
            >
              {layoutMode === "full" ? "🧩 Layout Nhỏ" : "🖥️ Layout Full"}
            </button>
            <button type="button" className="themeSwitch" onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}>
              {theme === "light" ? "🌙 Dark mode" : "☀️ Bright mode"}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="card">
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
                <p className="flashKanji">{currentCard.kanji}</p>
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
              <button type="button" onClick={handlePrevCard}>
                ← Thẻ trước
              </button>
              <button type="button" onClick={handleNextCard}>
                Thẻ tiếp theo →
              </button>
            </div>
            <div className="row gap">
              <button type="button" className="knownButton" onClick={handleMarkKnown}>
                ✅ Đã thuộc
              </button>
              <button type="button" className="unknownButton" onClick={handleMarkUnknown}>
                🔁 Chưa thuộc
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Nhóm này chưa có dữ liệu. Hãy thêm từ vựng để bắt đầu học.</p>
        )}
      </section>

      <div className="sectionGrid">
        <section className="card">
          <h2>Quản Lý Nhóm Học</h2>
          <div className="row gap groupRow">
            <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ví dụ: Bài 1" />
            <button type="button" onClick={handleAddGroup}>
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
              🗑️ Xóa nhóm
            </button>
          </div>
          <p className="muted">Khi xóa nhóm, các từ vựng trong nhóm sẽ được chuyển về "Chung".</p>
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
            <button type="button" onClick={handleLookupOnline} disabled={isOnlineLookingUp || !queryInput.trim()}>
              {isOnlineLookingUp ? "Đang tra..." : "Tra cứu online"}
            </button>
            <button type="button" onClick={handleApplyLocalSuggestion} disabled={!localSuggestion}>
              Áp dụng gợi ý local
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
                <button type="button" onClick={handleAddGroup}>
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
              <button type="submit">Lưu từ vựng</button>
              <button type="button" onClick={handleResetForm}>
                Làm mới
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
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

export default App;
