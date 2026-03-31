import { toHiragana } from "wanakana";

export interface OnlineLookupResult {
  word: string;
  reading: string;
  meaningEn: string;
  meaningVi: string;
  source: "jotoba" | "jisho";
}

const LATIN_REGEX = /^[A-Za-z\s'-]+$/;

function normalizeQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  if (LATIN_REGEX.test(trimmed)) {
    return toHiragana(trimmed);
  }
  return trimmed;
}

async function lookupFromJotoba(query: string): Promise<OnlineLookupResult | null> {
  const response = await fetch("https://jotoba.de/api/search/words", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      language: "English",
      no_english: false
    })
  });
  if (!response.ok) {
    throw new Error(`Jotoba lỗi ${response.status}`);
  }
  const data = await response.json();
  const candidate = data?.words?.[0];
  if (!candidate) {
    return null;
  }

  const readingObj = candidate.reading || {};
  const word = readingObj.kanji || readingObj.kana || query;
  const reading = readingObj.kana || query;
  const glosses = candidate.senses?.[0]?.glosses || [];
  const meaning = glosses.length > 0 ? glosses.slice(0, 3).join(", ") : "Chưa có nghĩa.";
  return {
    word,
    reading,
    meaningEn: meaning,
    meaningVi: "",
    source: "jotoba"
  };
}

async function lookupFromJisho(query: string): Promise<OnlineLookupResult | null> {
  const endpoint = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Jisho lỗi ${response.status}`);
  }

  const data = await response.json();
  const candidate = data?.data?.[0];
  if (!candidate) {
    return null;
  }

  const japanese = candidate.japanese?.[0] || {};
  const word = japanese.word || japanese.reading || query;
  const reading = japanese.reading || query;
  const defs = candidate.senses?.[0]?.english_definitions || [];
  const meaning = defs.length > 0 ? defs.slice(0, 3).join(", ") : "Chưa có nghĩa.";
  return {
    word,
    reading,
    meaningEn: meaning,
    meaningVi: "",
    source: "jisho"
  };
}

async function translateEnToVi(text: string): Promise<string> {
  if (!text || text === "Chưa có nghĩa.") {
    return text;
  }
  try {
    const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      return text;
    }
    const data = await response.json();
    const translated = data?.responseData?.translatedText;
    if (!translated || typeof translated !== "string") {
      return text;
    }
    return translated;
  } catch (_err) {
    return text;
  }
}

export async function lookupVocabularyOnline(input: string): Promise<OnlineLookupResult | null> {
  const query = normalizeQuery(input);
  if (!query) {
    return null;
  }

  const errors: string[] = [];

  try {
    const jotoba = await lookupFromJotoba(query);
    if (jotoba) {
      jotoba.meaningVi = await translateEnToVi(jotoba.meaningEn);
      return jotoba;
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Jotoba lỗi không xác định");
  }

  try {
    const jisho = await lookupFromJisho(query);
    if (jisho) {
      jisho.meaningVi = await translateEnToVi(jisho.meaningEn);
      return jisho;
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Jisho lỗi không xác định");
  }

  if (errors.length > 0) {
    throw new Error(`Tra online thất bại. Chi tiết: ${errors.join(" | ")}`);
  }
  return null;
}
