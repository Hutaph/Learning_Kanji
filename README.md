# Learning_Kanji

Ứng dụng web học Kanji / từ vựng (Vite + React).

## Từ vựng N5 (Minna)

Đặt file deck `.apkg` (ví dụ bộ Minna) vào thư mục `apkg/`, rồi:

```bash
npm run import-minna
```

(Mặc định trỏ tới `apkg/Japanese_Minna_no_Nihongo_1__2_Lessons_1_-_50.apkg`; đổi bằng `--apkg` nếu cần.)

Sinh `src/data/n5Vocabulary.json` với cột bài (1–25) theo **tên deck** và **tags** trong Anki.

## Khác

- Kanji + media: `python scripts/import_apkg.py` (mặc định `apkg/2136_Kanji_Vit.apkg`; xem script).
- `*.apkg` được gitignore (không commit file deck).
