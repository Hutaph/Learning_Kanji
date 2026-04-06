import React from "react";
import { VocabularyEntry } from "../types";

export function formatMeaningLine(entry: VocabularyEntry): string {
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

export function VocabularyList({
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
