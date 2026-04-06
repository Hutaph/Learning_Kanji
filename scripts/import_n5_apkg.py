"""
Trích từ vựng N5 và N4 từ file Anki .apkg → src/data/n5Vocabulary.json và src/data/n4Vocabulary.json

Dành riêng cho bộ: Japanese_Minna_no_Nihongo_1__2_Lessons_1_-_50.apkg
Trường: Expression, Meaning, Reading, Lesson Number
"""

import argparse
import html
import json
import os
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Any

TAG_STRIP = re.compile(r"<[^>]+>")

def strip_html(text: str) -> str:
    if not text:
        return ""
    out = TAG_STRIP.sub(" ", text)
    return " ".join(html.unescape(out).replace("\xa0", " ").split()).strip()

def load_models(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT models FROM col").fetchone()
    if not row:
        return {}
    return json.loads(row[0])

def field_names_for_mid(models: dict[str, Any], mid: int) -> list[str]:
    m = models.get(str(mid))
    if not m:
        return []
    return [f.get("name", "") for f in m.get("flds", [])]

def pick_indices(names: list[str]) -> dict[str, int]:
    lower = [n.lower() for n in names]
    
    def find(*candidates: str) -> int:
        for i, ln in enumerate(lower):
            for c in candidates:
                if c in ln or ln == c:
                    return i
        return -1

    return {
        "expression": find("expression", "kanji", "front", "word"),
        "reading": find("reading", "kana", "furigana"),
        "meaning": find("meaning", "english", "back"),
        "lesson": find("lesson number", "lesson", "tags")
    }

def normalize_lesson(text: str) -> int | None:
    text = strip_html(text)
    # Tìm trực tiếp con số trong text (Lesson Number thường là "1", "02", "Lesson 3", v.v.)
    m = re.search(r"\b(\d+)\b", text)
    if m:
        return int(m.group(1))
    return None

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apkg", default="apkg/Japanese_Minna_no_Nihongo_1__2_Lessons_1_-_50.apkg")
    parser.add_argument("--out-n5", default="src/data/n5Vocabulary.json")
    parser.add_argument("--out-n4", default="src/data/n4Vocabulary.json")
    args = parser.parse_args()

    apkg_path = Path(args.apkg)
    if not apkg_path.is_file():
        raise SystemExit(f"Không tìm thấy: {apkg_path.resolve()}")

    Path(args.out_n5).parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(apkg_path, "r") as zf:
        if "collection.anki2" not in zf.namelist():
            raise SystemExit("APKG không chứa collection.anki2")
        collection_bytes = zf.read("collection.anki2")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".anki2")
    tmp.write(collection_bytes)
    tmp.close()

    words_n5: list[dict[str, Any]] = []
    words_n4: list[dict[str, Any]] = []
    conn = None

    try:
        conn = sqlite3.connect(tmp.name)
        models = load_models(conn)
        
        rows = conn.execute(
            """
            SELECT n.id, n.mid, n.tags, n.flds
            FROM notes n
            """
        ).fetchall()

        for note_id, mid, anki_tags, flds in rows:
            names = field_names_for_mid(models, mid)
            if not names:
                continue
                
            fields = (flds or "").split("\x1f")
            while len(fields) < len(names):
                fields.append("")

            idx = pick_indices(names)
            if idx["expression"] == -1:
                continue

            expr = strip_html(fields[idx["expression"]])
            reading = strip_html(fields[idx["reading"]]) if idx["reading"] != -1 else ""
            meaning = strip_html(fields[idx["meaning"]]) if idx["meaning"] != -1 else ""
            
            lesson = None
            if idx["lesson"] != -1:
                lesson = normalize_lesson(fields[idx["lesson"]])
            
            if lesson is None and anki_tags:
                lesson = normalize_lesson(anki_tags.replace("::", " "))

            if not expr and not reading:
                continue
            if not expr:
                expr = reading
            if not meaning:
                meaning = reading

            # Some fields like reading might contain brackets with kanji, let's just make sure it's clean if possible,
            # though usually "expression" is Kanji and "reading" is kana.

            word_entry = {
                "id": f"apkg-{note_id}",
                "word": expr,
                "reading": reading,
                "meaning": meaning,
                "lesson": lesson,
                "tags": [t for t in (anki_tags or "").split() if t]
            }

            if lesson is not None:
                if 1 <= lesson <= 25:
                    words_n5.append(word_entry)
                elif 26 <= lesson <= 50:
                    words_n4.append(word_entry)
                else:
                    # Nếu out of bound, tạm đẩy vào N5 nhưng bỏ bài
                    words_n5.append(word_entry)
            else:
                words_n5.append(word_entry)

    finally:
        if conn:
            conn.close()
        os.unlink(tmp.name)

    # Save N5
    payload_n5 = {
        "meta": {
            "title": "Minna no Nihongo N5 (Lessons 1-25)",
            "source": apkg_path.name,
            "extractedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
            "sourceNote": f"{len(words_n5)} từ vựng N5.",
        },
        "words": words_n5,
    }
    Path(args.out_n5).write_text(json.dumps(payload_n5, ensure_ascii=False, indent=2), encoding="utf-8")
    
    # Save N4
    payload_n4 = {
        "meta": {
            "title": "Minna no Nihongo N4 (Lessons 26-50)",
            "source": apkg_path.name,
            "extractedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
            "sourceNote": f"{len(words_n4)} từ vựng N4.",
        },
        "words": words_n4,
    }
    Path(args.out_n4).write_text(json.dumps(payload_n4, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Đã xuất {len(words_n5)} từ N5 → {args.out_n5}")
    print(f"Đã xuất {len(words_n4)} từ N4 → {args.out_n4}")

if __name__ == "__main__":
    main()
