export const STANCES = {
  deploy: "全社導入する",
  pilot: "対象を絞って再検証する",
  hold: "いったん見送る",
};

export const SESSION = {
  title: "会議要約AIを全社導入するか",
  context:
    "試験チームでは、会議後の作業が1人あたり週2.4時間減ったと報告された。要約精度は担当者評価で92%。年間費用は480万円。security reviewは未完了。経営会議は来週、導入判断を求めている。",
  signals: [
    {
      id: "time",
      text: "試験チームは、会議後の作業が週2.4時間減ったと自己報告した。",
      answer: "fact",
      note: "報告された事実。ただし自己申告で、計測方法と比較対象はまだ弱い。",
    },
    {
      id: "accuracy",
      text: "要約精度92%なら、重要な会議でも十分に安全である。",
      answer: "inference",
      note: "92%の定義、重大な8%の内容、会議種別がないまま安全性へ飛躍している。",
    },
    {
      id: "security",
      text: "security reviewは完了していない。",
      answer: "fact",
      note: "現時点で確認できる状態。ただし不合格を意味するわけではない。",
    },
    {
      id: "savings",
      text: "全社導入すれば、年間費用480万円を上回る人件費を確実に削減できる。",
      answer: "inference",
      note: "試験チームの結果を全社へ外挿し、時間削減をそのまま現金化している。",
    },
    {
      id: "adoption",
      text: "社員の大半は、会議要約AIを歓迎する。",
      answer: "unknown",
      note: "受容性のdataが提示されていない。今は判断できない。",
    },
  ],
};

const COUNTERWEIGHTS = {
  deploy: [
    {
      id: "security-evidence",
      text: "効果は小さな試験チームの自己申告で、92%の定義も不明。security review前の全社展開は、便益と損失の両方をまだ見積もれない。",
      strongest: true,
    },
    {
      id: "cost-only",
      text: "年間480万円は高く感じるので、もっと値引き交渉をした方がよい。",
      strongest: false,
    },
    {
      id: "taste",
      text: "AIの文章を好まない社員が一人でもいるかもしれない。",
      strongest: false,
    },
  ],
  pilot: [
    {
      id: "limited-risk",
      text: "対象を絞っても、機密会議を扱うならsecurity review未完了という主要riskは残る。試験範囲より先にdata境界を決めるべきだ。",
      strongest: true,
    },
    {
      id: "speed",
      text: "限定導入は全社導入より勢いがなく、社内で目立ちにくい。",
      strongest: false,
    },
    {
      id: "vendor",
      text: "別のvendorの方が有名かもしれないので、そちらを使うべきだ。",
      strongest: false,
    },
  ],
  hold: [
    {
      id: "delay-cost",
      text: "見送りにも機会費用がある。機密を除いた可逆的な再試験なら、security reviewと並行して不確実性を安く減らせる。",
      strongest: true,
    },
    {
      id: "trend",
      text: "競合企業もAIを使っていそうなので、遅れて見える。",
      strongest: false,
    },
    {
      id: "enthusiasm",
      text: "試験チームが喜んでいるので、すぐ考え直すべきだ。",
      strongest: false,
    },
  ],
};

export function evaluateSignals(answers = {}) {
  const details = SESSION.signals.map((signal) => ({
    ...signal,
    selected: answers[signal.id] ?? null,
    correct: answers[signal.id] === signal.answer,
  }));

  return {
    correct: details.filter((item) => item.correct).length,
    total: details.length,
    details,
  };
}

export function getCounterweights(stance) {
  return COUNTERWEIGHTS[stance] ?? COUNTERWEIGHTS.pilot;
}

export function evaluateCounterweight(stance, choice) {
  const options = getCounterweights(stance);
  const selected = options.find((option) => option.id === choice) ?? null;
  const strongest = options.find((option) => option.strongest);

  return {
    accepted: Boolean(selected?.strongest),
    selected,
    strongest,
  };
}

export function calculateRecord(input) {
  const signals = evaluateSignals(input.signalAnswers);
  const counterweight = evaluateCounterweight(
    input.initialStance,
    input.counterweightChoice,
  );
  const confidenceDelta = Number(input.finalConfidence) - Number(input.initialConfidence);
  const stanceChanged = input.initialStance !== input.finalStance;
  const meaningfulUpdate = stanceChanged || Math.abs(confidenceDelta) >= 10;
  const revisionComplete = String(input.revisionNote ?? "").trim().length >= 12;

  let updateLabel = "立場と確信度を維持";
  if (stanceChanged) updateLabel = "判断を更新";
  else if (Math.abs(confidenceDelta) >= 20) updateLabel = "確信度を大きく調整";
  else if (Math.abs(confidenceDelta) >= 10) updateLabel = "確信度を調整";

  return {
    signals,
    counterweight,
    confidenceDelta,
    stanceChanged,
    meaningfulUpdate,
    revisionComplete,
    updateLabel,
    repCount:
      signals.correct + Number(counterweight.accepted) + Number(revisionComplete),
    maxReps: signals.total + 2,
    initialStanceLabel: STANCES[input.initialStance],
    finalStanceLabel: STANCES[input.finalStance],
  };
}

export function calculateQuestXp(record) {
  return (
    200 +
    record.signals.correct * 80 +
    Number(record.counterweight.accepted) * 160 +
    Number(record.revisionComplete) * 80
  );
}

export function buildRecordText(record, dateLabel) {
  const direction = record.confidenceDelta > 0 ? "+" : "";
  return [
    `BRAIN GYM / QUEST 001 / ${dateLabel}`,
    `QUEST XP ${calculateQuestXp(record)}`,
    `根拠の仕分け ${record.signals.correct}/${record.signals.total}`,
    `反証 ${record.counterweight.accepted ? "最重量を選択" : "再ラック"}`,
    `判断 ${record.initialStanceLabel} → ${record.finalStanceLabel}`,
    `確信度 ${direction}${record.confidenceDelta}pt / ${record.updateLabel}`,
    "IQではなく、今日のQUESTで行った思考のrep。",
  ].join("\n");
}
