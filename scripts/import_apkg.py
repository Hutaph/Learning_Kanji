import argparse
import html
import json
import os
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path


TAG_RE = re.compile(r"<[^>]+>")
SRC_RE = re.compile(r'src="([^"]+)"', re.IGNORECASE)
SPACE_RE = re.compile(r"\s+")
PAREN_RE = re.compile(r"\(.*?\)")
MEDIA_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


def strip_html(text: str) -> str:
    if not text:
        return ""
    out = TAG_RE.sub(" ", text)
    out = html.unescape(out).replace("\xa0", " ")
    out = SPACE_RE.sub(" ", out).strip()
    return out


def extract_image_names(text: str) -> list[str]:
    if not text:
        return []
    return [Path(src).name for src in SRC_RE.findall(text)]


def normalize_han_viet(word_field: str) -> str:
    text = strip_html(word_field)
    text = PAREN_RE.sub("", text).strip()
    if not text:
        return ""
    tokens = [t for t in SPACE_RE.split(text) if t]
    return " ".join(t[:1].upper() + t[1:].lower() for t in tokens)


def sanitize_file_name(file_name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(file_name).name)
    return safe or "image.bin"


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert Anki APKG into app-owned JSON/media database.")
    parser.add_argument("--apkg", default="2136_Kanji_Vit.apkg")
    parser.add_argument("--out-json", default="src/data/kanjiImported.json")
    parser.add_argument("--out-media-dir", default="public/kanji-media")
    args = parser.parse_args()

    apkg_path = Path(args.apkg)
    out_json_path = Path(args.out_json)
    out_media_dir = Path(args.out_media_dir)
    out_json_path.parent.mkdir(parents=True, exist_ok=True)
    out_media_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(apkg_path, "r") as zf:
        media_map = json.loads(zf.read("media").decode("utf-8"))
        name_to_key = {name: key for key, name in media_map.items()}
        zip_names = set(zf.namelist())

        collection_bytes = zf.read("collection.anki2")
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".anki2")
        tmp.write(collection_bytes)
        tmp.close()

        try:
            conn = sqlite3.connect(tmp.name)
            cur = conn.cursor()
            rows = cur.execute("SELECT id, flds FROM notes").fetchall()
        finally:
            conn.close()
            os.unlink(tmp.name)

        by_kanji: dict[str, dict] = {}
        extracted_images = 0

        for note_id, flds in rows:
            fields = (flds or "").split("\x1f")
            fields += [""] * (7 - len(fields))
            word, picture, _kana, kanji, _mnemonic, _recording, diagram = fields[:7]

            kanji_text = strip_html(kanji)
            kanji_char = kanji_text[:1].strip() if kanji_text else ""
            if not kanji_char:
                continue

            han_viet = normalize_han_viet(word)
            image_file = ""
            for candidate in extract_image_names(picture) + extract_image_names(diagram):
                key = name_to_key.get(candidate)
                if not key:
                    continue
                if key not in zip_names:
                    continue
                ext = Path(candidate).suffix.lower()
                if ext not in MEDIA_EXT:
                    continue
                output_name = sanitize_file_name(candidate)
                output_path = out_media_dir / output_name
                if not output_path.exists():
                    output_path.write_bytes(zf.read(key))
                    extracted_images += 1
                image_file = f"/kanji-media/{output_name}"
                break

            existing = by_kanji.get(kanji_char)
            if existing:
                if not existing.get("hanViet") and han_viet:
                    existing["hanViet"] = han_viet
                if not existing.get("image") and image_file:
                    existing["image"] = image_file
                continue

            by_kanji[kanji_char] = {
                "id": f"apkg-{note_id}",
                "kanji": kanji_char,
                "hanViet": han_viet,
                "image": image_file
            }

    records = sorted(by_kanji.values(), key=lambda item: item["kanji"])
    out_json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Exported {len(records)} kanji records to {out_json_path}")
    print(f"Extracted {extracted_images} media files to {out_media_dir}")


if __name__ == "__main__":
    main()
