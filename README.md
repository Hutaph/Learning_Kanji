# Learning_Kanji

Ứng dụng web học Kanji / từ vựng (Vite + React).

## Từ vựng N5 (Minna)

Đặt `Minna_No_Nihongo_Chptrs_1-25.apkg` ở thư mục gốc repo, rồi:

```bash
npm run import-minna
```

Sinh `src/data/n5Vocabulary.json` với cột bài (1–25) theo **tên deck** và **tags** trong Anki.

## Khác

- Kanji + media: `python scripts/import_apkg.py` (xem script).
- `*.apkg` được gitignore (không commit file deck).
