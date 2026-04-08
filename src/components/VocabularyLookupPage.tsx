import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toHiragana } from "wanakana";
import n5Pack from "../data/n5Vocabulary.json";
import n4Pack from "../data/n4Vocabulary.json";
import { ImportedKanjiRecord, VerbLesson, VocabularyEntry } from "../types";
import { conjugateVerb, verbTypeToLabel } from "../verbs/conjugate";
import { getJSON, setJSON } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";

type LookupScope = "all" | "vocab" | "verb" | "kanji";

type LookupRow = {
  id: string;
  kind: "vocab" | "verb" | "kanji";
  word: string;
  reading: string;
  meaningEn: string;
  meaningVi: string;
  source: string;
  lessonLabel: string;
};

type IndexedRow = LookupRow & {
  wordNorm: string;
  readingNorm: string;
  kanaNorm: string;
  meaningEnNorm: string;
  meaningViNorm: string;
  formVariants: string[];
};

const LATIN_REGEX = /^[A-Za-z0-9\s'`~\-._]+$/;
const KANJI_REGEX = /\p{Script=Han}/u;

export function VocabularyLookupPage({
  allVocabulary,
  verbs,
  kanjiRecords,
  kanjiReady
}: {
  allVocabulary: VocabularyEntry[];
  verbs: VerbLesson[];
  kanjiRecords: ImportedKanjiRecord[];
  kanjiReady: boolean;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<LookupScope>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [verbLearnedMap, setVerbLearnedMap] = useState<Record<string, boolean>>(() =>
    getJSON<Record<string, boolean>>(STORAGE_KEYS.verb.learnedMap, {})
  );

  const indexRows = useMemo(() => {
    const n5Rows = (((n5Pack as { words?: unknown }).words as Array<any> | undefined) || []).map((item) => ({
      id: item.id,
      kind: "vocab" as const,
      word: item.word || "",
      reading: item.reading || "",
      meaningEn: item.meaning || "",
      meaningVi: "",
      source: "N5",
      lessonLabel: typeof item.lesson === "number" ? `Bài ${item.lesson}` : "-"
    }));
    const n4Rows = (((n4Pack as { words?: unknown }).words as Array<any> | undefined) || []).map((item) => ({
      id: item.id,
      kind: "vocab" as const,
      word: item.word || "",
      reading: item.reading || "",
      meaningEn: item.meaning || "",
      meaningVi: "",
      source: "N4",
      lessonLabel: typeof item.lesson === "number" ? `Bài ${item.lesson}` : "-"
    }));
    const customRows = allVocabulary.map((item) => ({
      id: item.id,
      kind: "vocab" as const,
      word: item.word || "",
      reading: item.reading || "",
      meaningEn: item.meaningEn || "",
      meaningVi: item.meaningVi || "",
      source: item.group ? `Custom · ${item.group}` : "Custom",
      lessonLabel: "-"
    }));
    const verbRows = verbs.map((item) => ({
      id: item.id,
      kind: "verb" as const,
      word: item.dictionary || "",
      reading: item.kana || "",
      meaningEn: "",
      meaningVi: item.meaningVi || "",
      source: `Động từ ${item.jlpt}`,
      lessonLabel: item.type
    }));
    const kanjiWordCountMap = buildKanjiWordCountMap(allVocabulary);
    const kanjiRows = kanjiRecords.map((item) => ({
      id: item.id,
      kind: "kanji" as const,
      word: item.kanji || "",
      reading: item.hanViet || "",
      meaningEn: "",
      meaningVi: item.hanViet || "",
      source: "Kanji",
      lessonLabel: `${kanjiWordCountMap[item.kanji] || 0} từ liên quan`
    }));

    const merged = [...customRows, ...n5Rows, ...n4Rows, ...verbRows, ...kanjiRows];
    return merged.map((item) => toIndexedRow(item));
  }, [allVocabulary, verbs, kanjiRecords]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return [] as IndexedRow[];
    }
    const qNorm = normalizeText(trimmed);
    const qKana = normalizeText(toHiragana(trimmed));
    const qLatin = LATIN_REGEX.test(trimmed);
    const qVariants = buildQueryVariants(qNorm, qKana);

    const scored = indexRows
      .filter((item) => scope === "all" || item.kind === scope)
      .map((item) => ({ item, score: getMatchScore(item, qNorm, qKana, qLatin, qVariants) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        if (a.item.kind !== b.item.kind) {
          const rank = { kanji: 0, vocab: 1, verb: 2 };
          return rank[a.item.kind] - rank[b.item.kind];
        }
        return a.item.word.localeCompare(b.item.word);
      })
      .slice(0, 16)
      .map((entry) => entry.item);
    return scored;
  }, [indexRows, query, scope]);

  const verbById = useMemo(() => {
    const map = new Map<string, VerbLesson>();
    for (const item of verbs) {
      map.set(item.id, item);
    }
    return map;
  }, [verbs]);

  const kanjiById = useMemo(() => {
    const map = new Map<string, ImportedKanjiRecord>();
    for (const item of kanjiRecords) {
      map.set(item.id, item);
    }
    return map;
  }, [kanjiRecords]);

  return (
    <section className="card studyCard">
      <h2>Tra cứu tổng hợp</h2>
      <p className="muted studySubtitle">Tra cứu Từ vựng, Động từ, Kanji bằng tiếng Nhật, romaji hoặc nghĩa tiếng Anh/Việt.</p>
      <div className="lookupSearchRow">
        <Search size={16} className="lookupSearchIcon" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhập từ khóa cần tra cứu..."
          aria-label="Tra cứu tổng hợp"
        />
      </div>
      <div className="lookupFilterRow segmentedRow" role="tablist" aria-label="Lọc loại tra cứu">
        <button type="button" className={scope === "all" ? "segmentedBtn isSelected" : "segmentedBtn"} onClick={() => setScope("all")}>Tất cả</button>
        <button type="button" className={scope === "vocab" ? "segmentedBtn isSelected" : "segmentedBtn"} onClick={() => setScope("vocab")}>Từ vựng</button>
        <button type="button" className={scope === "verb" ? "segmentedBtn isSelected" : "segmentedBtn"} onClick={() => setScope("verb")}>Động từ</button>
        <button type="button" className={scope === "kanji" ? "segmentedBtn isSelected" : "segmentedBtn"} onClick={() => setScope("kanji")}>Kanji</button>
      </div>
      {!kanjiReady ? <p className="muted">Đang tải dữ liệu Kanji để tra cứu...</p> : null}
      {!query.trim() ? (
        <p className="muted">Nhập từ khóa để xem các từ tương đồng nhất.</p>
      ) : results.length === 0 ? (
        <p className="muted">Không tìm thấy kết quả phù hợp.</p>
      ) : (
        <div className="tableWrap">
          <table className="vocabTable lookupTable">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Từ / Kanji</th>
                <th>Cách đọc</th>
                <th>Nghĩa</th>
                <th>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item) => {
                const rowKey = `${item.kind}:${item.id}`;
                const isExpanded = expandedKey === rowKey;
                const isExpandable = item.kind === "verb" || item.kind === "kanji";
                const verbDetail = item.kind === "verb" ? verbById.get(item.id) || null : null;
                const kanjiDetail =
                  item.kind === "kanji"
                    ? kanjiById.get(item.id) || {
                        id: item.id,
                        kanji: item.word,
                        hanViet: item.reading,
                        image: ""
                      }
                    : null;
                const relatedVocab =
                  kanjiDetail && kanjiDetail.kanji
                    ? allVocabulary.filter((row) => row.word.includes(kanjiDetail.kanji)).slice(0, 10)
                    : [];

                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className={isExpandable ? "lookupRowExpandable" : ""}
                      onClick={() => {
                        if (!isExpandable) {
                          return;
                        }
                        setExpandedKey((prev) => (prev === rowKey ? null : rowKey));
                      }}
                    >
                      <td><span className={`lookupTypePill is-${item.kind}`}>{toKindLabel(item.kind)}</span></td>
                      <td>{item.word}</td>
                      <td>{item.reading}</td>
                      <td>{item.meaningVi || item.meaningEn || "-"}</td>
                      <td>
                        {item.source}
                        {item.lessonLabel ? ` · ${item.lessonLabel}` : ""}
                      </td>
                    </tr>
                    {isExpanded && verbDetail ? (
                      <tr className="lookupInlineExpandRow">
                        <td colSpan={5}>
                          <div className="lookupInlineExpandInner">
                            <article className="verbCard isExpanded lookupExpandedCard">
                              <div className="verbCardTop">
                                <div className="verbCardMain">
                                  <div className="verbHeadRow">
                                    <h3 className="verbHeadWord">{verbDetail.dictionary}</h3>
                                    <p className="verbKanaLine">{verbDetail.kana}</p>
                                  </div>
                                  <p className="verbMeaningLine">{verbDetail.meaningVi}</p>
                                  <button
                                    type="button"
                                    className={verbLearnedMap[verbDetail.id] ? "jlptLearnedOn" : "jlptLearnedOff"}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      const next = { ...verbLearnedMap };
                                      if (next[verbDetail.id]) {
                                        delete next[verbDetail.id];
                                      } else {
                                        next[verbDetail.id] = true;
                                      }
                                      setVerbLearnedMap(next);
                                      setJSON(STORAGE_KEYS.verb.learnedMap, next);
                                    }}
                                  >
                                    {verbLearnedMap[verbDetail.id] ? "Đã học" : "Đánh dấu học"}
                                  </button>
                                </div>
                                {verbDetail.image ? <img className="verbThumb verbThumbInline" src={verbDetail.image} alt={verbDetail.dictionary} /> : null}
                              </div>
                              <div className="verbExpandedMain">
                                <p className="muted">
                                  {verbDetail.jlpt} - {verbTypeToLabel(verbDetail.type)}
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
                                    {(verbDetail.conjugations?.length ? verbDetail.conjugations : conjugateVerb(verbDetail)).map((row) => (
                                      <tr key={`${verbDetail.id}-${row.label}`}>
                                        <td>{row.label}</td>
                                        <td>{row.form}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </article>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {isExpanded && kanjiDetail ? (
                      <tr className="lookupInlineExpandRow">
                        <td colSpan={5}>
                          <div className="lookupInlineExpandInner">
                            <article className="verbCard lookupExpandedCard">
                              <div className="flashTopRow">
                                <div className="kanjiPanel">
                                  <p className="resultLabel">Kanji</p>
                                  <p className="flashKanji">{kanjiDetail.kanji}</p>
                                  <p className="resultLabel">Âm Hán Việt</p>
                                  <button type="button" className="blurRevealButton revealed">{kanjiDetail.hanViet || "-"}</button>
                                </div>
                                <div className="imagePanel">
                                  {kanjiDetail.image ? (
                                    <img className="kanjiImage" src={kanjiDetail.image} alt={kanjiDetail.kanji} />
                                  ) : (
                                    <p className="muted">Chưa có ảnh minh họa.</p>
                                  )}
                                </div>
                              </div>
                              <div className="vocabPanel">
                                <p className="resultLabel">Từ vựng liên quan</p>
                                {relatedVocab.length === 0 ? (
                                  <p className="muted">Chưa có từ liên quan trong dữ liệu hiện tại.</p>
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
                                        {relatedVocab.map((row) => (
                                          <tr key={`kv-${kanjiDetail.id}-${row.id}`}>
                                            <td>{row.word}</td>
                                            <td>{row.reading}</td>
                                            <td>{row.meaningVi || row.meaningEn || "-"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </article>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function toIndexedRow(item: LookupRow): IndexedRow {
  const kanaRaw = extractKanaReading(item.reading);
  const kanaNorm = normalizeText(toHiragana(kanaRaw || item.reading || item.word));
  const readingNorm = normalizeText(item.reading);
  const wordNorm = normalizeText(item.word);
  return {
    ...item,
    wordNorm,
    readingNorm,
    kanaNorm,
    meaningEnNorm: normalizeText(item.meaningEn),
    meaningViNorm: normalizeText(item.meaningVi),
    formVariants: buildFormVariants(kanaNorm, readingNorm, wordNorm)
  };
}

function normalizeText(input: string): string {
  return (input || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[［【\[]/g, "(")
    .replace(/[］】\]]/g, ")")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/[()]/g, "")
    .replace(/[~～・,，.。'"`´:;!?！？\-_/\\|]/g, "")
    .replace(/\s+/g, "");
}

function extractKanaReading(reading: string): string {
  if (!reading) {
    return "";
  }
  const normalized = reading
    .normalize("NFKC")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
  return normalized
    .replace(/\p{Script=Han}+\[([^\]]+)\]/gu, "$1")
    .replace(/[\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchScore(item: IndexedRow, qNorm: string, qKana: string, qLatin: boolean, qVariants: string[]): number {
  if (!qNorm) {
    return 0;
  }
  let score = 0;
  if (item.wordNorm === qNorm || item.readingNorm === qNorm || item.kanaNorm === qNorm) {
    score = Math.max(score, 120);
  }
  if (item.wordNorm.startsWith(qNorm) || item.readingNorm.startsWith(qNorm) || item.kanaNorm.startsWith(qNorm)) {
    score = Math.max(score, 95);
  }
  if (item.wordNorm.includes(qNorm) || item.readingNorm.includes(qNorm) || item.kanaNorm.includes(qNorm)) {
    score = Math.max(score, 78);
  }
  if (item.meaningEnNorm.includes(qNorm)) {
    score = Math.max(score, 64);
  }
  if (item.meaningViNorm.includes(qNorm)) {
    score = Math.max(score, 58);
  }
  if (qLatin && qKana) {
    if (item.kanaNorm.startsWith(qKana)) {
      score = Math.max(score, 92);
    } else if (item.kanaNorm.includes(qKana)) {
      score = Math.max(score, 74);
    }
  }
  for (const q of qVariants) {
    if (!q) {
      continue;
    }
    if (item.formVariants.includes(q)) {
      score = Math.max(score, 94);
      break;
    }
    if (item.formVariants.some((v) => v.startsWith(q) || q.startsWith(v))) {
      score = Math.max(score, 84);
    }
  }
  // Harder matching: tolerate minor typos with fuzzy similarity.
  if (score < 70) {
    const fuzzy = Math.max(
      fuzzySimilarity(qNorm, item.wordNorm),
      fuzzySimilarity(qNorm, item.readingNorm),
      fuzzySimilarity(qNorm, item.kanaNorm)
    );
    if (fuzzy >= 0.9) score = Math.max(score, 82);
    else if (fuzzy >= 0.82) score = Math.max(score, 74);
    else if (fuzzy >= 0.74) score = Math.max(score, 66);
  }
  return score;
}

function toKindLabel(kind: LookupRow["kind"]): string {
  if (kind === "kanji") return "Kanji";
  if (kind === "verb") return "Động từ";
  return "Từ vựng";
}

function buildKanjiWordCountMap(vocabulary: VocabularyEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of vocabulary) {
    const chars = new Set(Array.from(row.word || "").filter((ch) => KANJI_REGEX.test(ch)));
    for (const ch of chars) {
      map[ch] = (map[ch] || 0) + 1;
    }
  }
  return map;
}

function buildQueryVariants(qNorm: string, qKana: string): string[] {
  return Array.from(new Set([qNorm, qKana, ...verbStems(qNorm), ...verbStems(qKana)])).filter(Boolean);
}

function buildFormVariants(kanaNorm: string, readingNorm: string, wordNorm: string): string[] {
  const base = [kanaNorm, readingNorm, wordNorm].filter(Boolean);
  const stems = base.flatMap((v) => verbStems(v));
  return Array.from(new Set([...base, ...stems]));
}

function verbStems(value: string): string[] {
  if (!value) {
    return [];
  }
  const forms = [value];
  const strips = [
    "ませんでした",
    "なかった",
    "ました",
    "ません",
    "ない",
    "ます",
    "たい",
    "て",
    "た"
  ];
  for (const ending of strips) {
    if (value.endsWith(ending) && value.length > ending.length + 1) {
      forms.push(value.slice(0, -ending.length));
    }
  }
  if (value.endsWith("る") || value.endsWith("う") || value.endsWith("く") || value.endsWith("ぐ") || value.endsWith("す")) {
    forms.push(value.slice(0, -1));
  }
  return Array.from(new Set(forms));
}

function fuzzySimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigramsA = toBigrams(a);
  const bigramsB = toBigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;
  let overlap = 0;
  const counts = new Map<string, number>();
  for (const bg of bigramsB) counts.set(bg, (counts.get(bg) || 0) + 1);
  for (const bg of bigramsA) {
    const c = counts.get(bg) || 0;
    if (c > 0) {
      overlap += 1;
      counts.set(bg, c - 1);
    }
  }
  return (2 * overlap) / (bigramsA.length + bigramsB.length);
}

function toBigrams(text: string): string[] {
  if (text.length < 2) return [text];
  const out: string[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    out.push(text.slice(i, i + 2));
  }
  return out;
}
