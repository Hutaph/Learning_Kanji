import React, { useMemo, useState } from "react";
import { VerbLesson, VerbType, VerbLevel, VerbConjugation } from "../types";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function conjugateVerb(verb: VerbLesson): VerbConjugation[] {
  const dictionaryKana = verb.kana;

  if (verb.type === "ichidan") {
    const stem = dictionaryKana.slice(0, -1);
    return [
      { label: "Từ điển", form: dictionaryKana, note: "Dạng thường, hiện tại/tương lai" },
      { label: "ます", form: `${stem}ます`, note: "Lịch sự" },
      { label: "て", form: `${stem}て`, note: "Liên kết câu / yêu cầu" },
      { label: "た", form: `${stem}た`, note: "Quá khứ thường" },
      { label: "ない", form: `${stem}ない`, note: "Phủ định thường" },
      { label: "Khả năng", form: `${stem}られる`, note: "Có thể làm" },
      { label: "Ý chí", form: `${stem}よう`, note: "Thể rủ rê / quyết tâm" },
      { label: "Mệnh lệnh", form: `${stem}ろ`, note: "Mệnh lệnh trực tiếp" },
      { label: "Điều kiện", form: `${stem}れば`, note: "Nếu..." },
      { label: "Bị động", form: `${stem}られる`, note: "Bị..." },
      { label: "Sai khiến", form: `${stem}させる`, note: "Khiến/cho phép..." },
      { label: "Sai khiến bị động", form: `${stem}させられる`, note: "Bị ép phải..." }
    ];
  }

  if (verb.type === "irregular") {
    if (dictionaryKana.endsWith("する")) {
      const stem = dictionaryKana.slice(0, -2);
      const potential = stem ? `${stem}できる` : "できる";
      return [
        { label: "Từ điển", form: dictionaryKana, note: "Dạng thường, hiện tại/tương lai" },
        { label: "ます", form: `${stem}します`, note: "Lịch sự" },
        { label: "て", form: `${stem}して`, note: "Liên kết câu / yêu cầu" },
        { label: "た", form: `${stem}した`, note: "Quá khứ thường" },
        { label: "ない", form: `${stem}しない`, note: "Phủ định thường" },
        { label: "Khả năng", form: potential, note: "Có thể làm" },
        { label: "Ý chí", form: `${stem}しよう`, note: "Thể rủ rê / quyết tâm" },
        { label: "Mệnh lệnh", form: `${stem}しろ`, note: "Mệnh lệnh trực tiếp" },
        { label: "Điều kiện", form: `${stem}すれば`, note: "Nếu..." },
        { label: "Bị động", form: `${stem}される`, note: "Bị..." },
        { label: "Sai khiến", form: `${stem}させる`, note: "Khiến/cho phép..." },
        { label: "Sai khiến bị động", form: `${stem}させられる`, note: "Bị ép phải..." }
      ];
    }
    return [
      { label: "Từ điển", form: "くる", note: "Dạng thường, hiện tại/tương lai" },
      { label: "ます", form: "きます", note: "Lịch sự" },
      { label: "て", form: "きて", note: "Liên kết câu / yêu cầu" },
      { label: "た", form: "きた", note: "Quá khứ thường" },
      { label: "ない", form: "こない", note: "Phủ định thường" },
      { label: "Khả năng", form: "こられる", note: "Có thể đến" },
      { label: "Ý chí", form: "こよう", note: "Thể rủ rê / quyết tâm" },
      { label: "Mệnh lệnh", form: "こい", note: "Mệnh lệnh trực tiếp" },
      { label: "Điều kiện", form: "くれば", note: "Nếu..." },
      { label: "Bị động", form: "こられる", note: "Bị..." },
      { label: "Sai khiến", form: "こさせる", note: "Khiến/cho phép..." },
      { label: "Sai khiến bị động", form: "こさせられる", note: "Bị ép phải..." }
    ];
  }

  const stem = dictionaryKana.slice(0, -1);
  const last = dictionaryKana[dictionaryKana.length - 1] as string;
  const iMap: Record<string, string> = { う: "い", く: "き", ぐ: "ぎ", す: "し", つ: "ち", ぬ: "に", ぶ: "び", む: "み", る: "り" };
  const aMap: Record<string, string> = { う: "わ", く: "か", ぐ: "が", す: "さ", つ: "た", ぬ: "な", ぶ: "ば", む: "ま", る: "ら" };
  const eMap: Record<string, string> = { う: "え", く: "け", ぐ: "げ", す: "せ", つ: "て", ぬ: "ね", ぶ: "べ", む: "め", る: "れ" };
  const oMap: Record<string, string> = { う: "お", く: "こ", ぐ: "ご", す: "そ", つ: "と", ぬ: "の", ぶ: "ぼ", む: "も", る: "ろ" };
  let te = `${stem}って`;
  let ta = `${stem}った`;
  if (dictionaryKana === "いく") {
    te = "いって";
    ta = "いった";
  } else if (last === "く") {
    te = `${stem}いて`;
    ta = `${stem}いた`;
  } else if (last === "ぐ") {
    te = `${stem}いで`;
    ta = `${stem}いだ`;
  } else if (last === "す") {
    te = `${stem}して`;
    ta = `${stem}した`;
  } else if (last === "む" || last === "ぶ" || last === "ぬ") {
    te = `${stem}んで`;
    ta = `${stem}んだ`;
  }

  return [
    { label: "Từ điển", form: dictionaryKana, note: "Dạng thường, hiện tại/tương lai" },
    { label: "ます", form: `${stem}${iMap[last]}ます`, note: "Lịch sự" },
    { label: "て", form: te, note: "Liên kết câu / yêu cầu" },
    { label: "た", form: ta, note: "Quá khứ thường" },
    { label: "ない", form: `${stem}${aMap[last]}ない`, note: "Phủ định thường" },
    { label: "Khả năng", form: `${stem}${eMap[last]}る`, note: "Có thể làm" },
    { label: "Ý chí", form: `${stem}${oMap[last]}う`, note: "Thể rủ rê / quyết tâm" },
    { label: "Mệnh lệnh", form: `${stem}${eMap[last]}`, note: "Mệnh lệnh trực tiếp" },
    { label: "Điều kiện", form: `${stem}${eMap[last]}ば`, note: "Nếu..." },
    { label: "Bị động", form: `${stem}${aMap[last]}れる`, note: "Bị..." },
    { label: "Sai khiến", form: `${stem}${aMap[last]}せる`, note: "Khiến/cho phép..." },
    { label: "Sai khiến bị động", form: `${stem}${aMap[last]}せられる`, note: "Bị ép phải..." }
  ];
}

export function verbTypeToLabel(type: VerbType): string {
  if (type === "godan") {
    return "Godan (Nhóm 1)";
  }
  if (type === "ichidan") {
    return "Ichidan (Nhóm 2)";
  }
  return "Bất quy tắc (Nhóm 3)";
}

export function VerbStudyPanel({
  verbs,
  levelFilter,
  typeFilter,
  onLevelFilterChange,
  onTypeFilterChange
}: {
  verbs: VerbLesson[];
  levelFilter: "Tất cả" | VerbLevel;
  typeFilter: "Tất cả" | VerbType;
  onLevelFilterChange: (value: "Tất cả" | VerbLevel) => void;
  onTypeFilterChange: (value: "Tất cả" | VerbType) => void;
}) {
  const [quizSeed, setQuizSeed] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCount, setQuizCount] = useState(0);

  const meaningQuiz = useMemo(() => {
    if (verbs.length < 4) {
      return null;
    }
    const question = verbs[Math.floor(Math.random() * verbs.length)];
    const correct = question.meaningVi;
    const distractors = shuffle(
      Array.from(
        new Set(
          verbs
            .map((v) => v.meaningVi)
            .filter((m) => m && m !== correct)
        )
      )
    ).slice(0, 3);
    if (distractors.length < 3) {
      return null;
    }
    return {
      question,
      correct,
      options: shuffle([correct, ...distractors])
    };
  }, [verbs, quizSeed]);

  const onChooseAnswer = (opt: string) => {
    if (!meaningQuiz || selectedAnswer) {
      return;
    }
    setSelectedAnswer(opt);
    setQuizCount((c) => c + 1);
    if (opt === meaningQuiz.correct) {
      setQuizScore((s) => s + 1);
    }
  };

  const nextQuiz = () => {
    setSelectedAnswer(null);
    setQuizSeed((s) => s + 1);
  };

  return (
    <div className="verbMode">
      <p className="muted">Động từ được lấy từ dữ liệu N5/N4 hiện có và chia thể tự động.</p>
      <div className="verbFilters">
        <label>
          Cấp độ
          <select value={levelFilter} onChange={(event) => onLevelFilterChange(event.target.value as "Tất cả" | VerbLevel)}>
            <option value="Tất cả">Tất cả</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
          </select>
        </label>
        <label>
          Loại động từ
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as "Tất cả" | VerbType)}>
            <option value="Tất cả">Tất cả</option>
            <option value="godan">Godan (Nhóm 1)</option>
            <option value="ichidan">Ichidan (Nhóm 2)</option>
            <option value="irregular">Bất quy tắc (Nhóm 3)</option>
          </select>
        </label>
      </div>
      {meaningQuiz ? (
        <article className="verbCard verbQuizCard">
          <div className="verbCardHeader">
            <h3>Kiểm tra nghĩa động từ</h3>
            <p className="muted">
              {meaningQuiz.question.dictionary}（{meaningQuiz.question.kana}） · {meaningQuiz.question.jlpt}
            </p>
            <p className="muted">Điểm: {quizScore}/{quizCount}</p>
          </div>
          <div className="verbQuizOptions">
            {meaningQuiz.options.map((opt) => {
              const isChosen = selectedAnswer === opt;
              const isCorrect = opt === meaningQuiz.correct;
              let cls = "verbQuizOption";
              if (selectedAnswer) {
                if (isCorrect) cls += " isCorrect";
                else if (isChosen) cls += " isWrong";
              }
              return (
                <button key={opt} type="button" className={cls} onClick={() => onChooseAnswer(opt)} disabled={Boolean(selectedAnswer)}>
                  {opt}
                </button>
              );
            })}
          </div>
          {selectedAnswer ? (
            <div className="verbQuizActions">
              <button type="button" className="btnSecondary" onClick={nextQuiz}>
                Câu kế tiếp
              </button>
            </div>
          ) : null}
        </article>
      ) : null}
      {verbs.length === 0 ? (
        <p className="muted">Không có động từ phù hợp với bộ lọc hiện tại.</p>
      ) : (
        <div className="verbCards">
          {verbs.map((verb) => {
            const forms = verb.conjugations?.length ? verb.conjugations : conjugateVerb(verb);
            return (
              <article key={verb.dictionary} className="verbCard">
                <div className="verbCardHeader">
                  <h3>{verb.dictionary}</h3>
                  <p className="muted">{verb.kana}</p>
                  <p className="verbMeaningLine">{verb.meaningVi}</p>
                  <p className="muted">
                    {verb.jlpt} - {verbTypeToLabel(verb.type)}
                  </p>
                  {verb.image ? <img className="verbThumb" src={verb.image} alt={verb.dictionary} /> : null}
                </div>
                <div className="tableWrap">
                  <table className="verbTable">
                    <thead>
                      <tr>
                        <th>Thể</th>
                        <th>Dạng chia</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forms.map((row) => (
                        <tr key={`${verb.dictionary}-${row.label}`}>
                          <td>{row.label}</td>
                          <td>{row.form}</td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
