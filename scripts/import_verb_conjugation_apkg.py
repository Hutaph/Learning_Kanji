"""
Import Makoto Japanese Verb Conjugation APKG to app JSON + media.

Usage:
  python scripts/import_verb_conjugation_apkg.py --apkg apkg/Makos_Japanese_Verb_Conjugation.apkg
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Any

TAG_RE = re.compile(r"<[^>]+>")
IMG_SRC_RE = re.compile(r'src="([^"]+)"', re.IGNORECASE)
FURIGANA_RE = re.compile(r"([^\[])\[([^\]]+)\]")
KANA_RE = re.compile(r"[\u3040-\u30ffー]+")


def strip_html(text: str) -> str:
    out = TAG_RE.sub(" ", text or "")
    return " ".join(html.unescape(out).replace("\xa0", " ").split()).strip()


def strip_furigana(text: str) -> str:
    s = strip_html(text)
    s = re.sub(r"\[[^\]]*\]", "", s).replace(" ", "").strip()
    s = re.sub(r"[，,]\s*$", "", s)
    return s


def furigana_to_kana(text: str) -> str:
    s = strip_html(text)
    s = FURIGANA_RE.sub(r"\2", s)
    chunks = KANA_RE.findall(s)
    return "".join(chunks).strip()


def parse_image_name(image_field: str) -> str:
    m = IMG_SRC_RE.search(image_field or "")
    if not m:
        return ""
    return Path(m.group(1)).name


def infer_type(tags: str) -> str:
    t = (tags or "").lower()
    # Check ru-verb first because "ru-verb" contains "u-verb" as substring.
    if "ru-verb" in t:
        return "ichidan"
    if "u-verb" in t:
        return "godan"
    return "irregular"


def sanitize_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(name).name)


def normalize_vocab_word(word: str) -> str:
    s = (word or "")
    s = re.sub(r"［[^］]*］", "", s)
    s = re.sub(r"\[[^\]]*]", "", s)
    s = s.replace(" ", "")
    return s.strip()


def infer_jlpt_level(dictionary_word: str, n5_set: set[str], n4_set: set[str]) -> str:
    if dictionary_word in n5_set:
        return "N5"
    if dictionary_word in n4_set:
        return "N4"
    return "N4"


def extract_media(
    zf: zipfile.ZipFile,
    media_map: dict[str, str],
    image_name: str,
    out_dir: Path,
) -> str:
    if not image_name:
        return ""
    key = None
    for k, v in media_map.items():
        if Path(v).name == image_name:
            key = k
            break
    if key is None:
        return ""
    safe = f"{key}_{sanitize_name(image_name)}"
    out_path = out_dir / safe
    try:
        out_path.write_bytes(zf.read(key))
    except KeyError:
        return ""
    return f"/verb-media/{safe}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apkg", default="apkg/Makos_Japanese_Verb_Conjugation.apkg")
    parser.add_argument("--out-json", default="src/data/verbsConjugation.json")
    parser.add_argument("--out-media-dir", default="public/verb-media")
    parser.add_argument("--n5-json", default="src/data/n5Vocabulary.json")
    parser.add_argument("--n4-json", default="src/data/n4Vocabulary.json")
    args = parser.parse_args()

    apkg_path = Path(args.apkg)
    out_json = Path(args.out_json)
    out_media = Path(args.out_media_dir)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_media.mkdir(parents=True, exist_ok=True)
    for stale in out_media.glob("*"):
        if stale.is_file():
            stale.unlink()

    n5_words = json.loads(Path(args.n5_json).read_text(encoding="utf-8")).get("words", [])
    n4_words = json.loads(Path(args.n4_json).read_text(encoding="utf-8")).get("words", [])
    n5_set = {normalize_vocab_word(w.get("word", "")) for w in n5_words}
    n4_set = {normalize_vocab_word(w.get("word", "")) for w in n4_words}

    with zipfile.ZipFile(apkg_path, "r") as zf:
        media_map = json.loads(zf.read("media").decode("utf-8"))
        collection = zf.read("collection.anki2")

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".anki2")
        tmp.write(collection)
        tmp.close()

        conn = sqlite3.connect(tmp.name)
        try:
            models_raw = conn.execute("SELECT models FROM col").fetchone()
            if not models_raw:
                raise SystemExit("No models found in APKG.")
            models = json.loads(models_raw[0])
            model = next(iter(models.values()))
            field_names = [f.get("name", "") for f in model.get("flds", [])]

            rows = conn.execute("SELECT id, flds, tags FROM notes").fetchall()
            verbs: list[dict[str, Any]] = []

            field_label_map = {
                "non-past": "Từ điển",
                "non-past neg": "Phủ định hiện tại",
                "non-past polite": "Lịch sự hiện tại",
                "non-past polite neg": "Lịch sự phủ định",
                "past": "Quá khứ",
                "past neg": "Quá khứ phủ định",
                "te-form": "て-form",
                "nakute-form": "なくて-form",
                "naide-form": "ないで-form",
                "volitional": "Ý chí",
                "volitional neg": "Ý chí phủ định",
                "imperative": "Mệnh lệnh",
                "imperative neg": "Cấm đoán",
                "provisional": "Điều kiện (ば)",
                "provisional neg": "Điều kiện (ば) phủ định",
                "conditional": "Điều kiện (たら)",
                "conditional neg": "Điều kiện (たら) phủ định",
                "potential": "Khả năng",
                "potential neg": "Khả năng phủ định",
                "passive": "Bị động",
                "passive neg": "Bị động phủ định",
                "causative": "Sai khiến",
                "causative neg": "Sai khiến phủ định",
                "causative passive": "Sai khiến bị động",
                "causative passive neg": "Sai khiến bị động phủ định",
            }

            for note_id, flds, tags in rows:
                values = (flds or "").split("\x1f")
                while len(values) < len(field_names):
                    values.append("")
                field_map = dict(zip(field_names, values))

                dictionary = strip_furigana(field_map.get("non-past", ""))
                kana = furigana_to_kana(field_map.get("reading", ""))
                meaning = strip_html(field_map.get("meaning", ""))
                image_name = parse_image_name(field_map.get("image", ""))
                image_path = extract_media(zf, media_map, image_name, out_media)
                verb_type = infer_type(tags)
                jlpt = infer_jlpt_level(dictionary, n5_set, n4_set)

                conjugations = []
                for key in field_names:
                    if key in {"reading", "meaning", "image"}:
                        continue
                    form = strip_furigana(field_map.get(key, ""))
                    if not form:
                        continue
                    conjugations.append(
                        {
                            "label": field_label_map.get(key, key),
                            "form": form,
                            "note": key,
                        }
                    )

                if not dictionary or not kana or not conjugations:
                    continue

                verbs.append(
                    {
                        "id": f"verb-{note_id}",
                        "dictionary": dictionary,
                        "kana": kana,
                        "meaningVi": meaning or "No meaning",
                        "jlpt": jlpt,
                        "type": verb_type,
                        "image": image_path,
                        "conjugations": conjugations,
                    }
                )

            payload = {
                "meta": {
                    "title": "Makoto Japanese Verb Conjugation",
                    "source": apkg_path.name,
                    "count": len(verbs),
                },
                "verbs": verbs,
            }
            out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Exported {len(verbs)} verbs -> {out_json}")
            print(f"Media dir -> {out_media}")
        finally:
            conn.close()
            Path(tmp.name).unlink(missing_ok=True)


if __name__ == "__main__":
    main()

