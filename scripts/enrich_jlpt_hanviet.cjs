/**
 * Gắn trường hanViet cho từng mục JLPT từ src/data/kanjiImported.json (theo thứ tự chữ Hán trong `word`).
 * Chạy sau khi chỉnh JSON hoặc import APKG: node scripts/enrich_jlpt_hanviet.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const kanjiPath = path.join(root, "src/data/kanjiImported.json");

const kanjiList = JSON.parse(fs.readFileSync(kanjiPath, "utf8"));
const map = Object.create(null);
for (const row of kanjiList) {
  const k = row.kanji;
  const hv = row.hanViet;
  if (k && typeof k === "string" && k.length === 1 && typeof hv === "string") {
    map[k] = hv.trim();
  }
}

function hanVietFromWord(word) {
  if (!word) {
    return "";
  }
  const KANJI = /\p{Script=Han}/gu;
  const chars = word.match(KANJI) || [];
  const parts = [];
  for (const ch of chars) {
    if (ch === "々") {
      // Iteration mark repeats previous kanji reading.
      parts.push(parts.length ? parts[parts.length - 1] : "[々]");
      continue;
    }
    parts.push(map[ch] || `[${ch}]`);
  }
  return parts.length ? parts.join(" - ") : "";
}

function processFile(rel) {
  const p = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  let n = 0;
  for (const w of data.words) {
    w.hanViet = hanVietFromWord(w.word || "");
    n += 1;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(rel + ": " + n + " từ");
}

processFile("src/data/n5Vocabulary.json");
processFile("src/data/n4Vocabulary.json");
console.log("Xong enrich hanViet.");
