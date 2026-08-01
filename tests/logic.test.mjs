import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION,
  buildRecordText,
  calculateQuestXp,
  calculateRecord,
  evaluateCounterweight,
  evaluateSignals,
} from "../src/logic.mjs";

test("signal classification distinguishes fact, inference, and unknown", () => {
  const answers = Object.fromEntries(
    SESSION.signals.map((signal) => [signal.id, signal.answer]),
  );
  const result = evaluateSignals(answers);

  assert.equal(result.correct, SESSION.signals.length);
  assert.equal(result.total, 5);
  assert.ok(result.details.every((detail) => detail.correct));
});

test("counterweight strength depends on the committed stance", () => {
  assert.equal(
    evaluateCounterweight("deploy", "security-evidence").accepted,
    true,
  );
  assert.equal(evaluateCounterweight("hold", "trend").accepted, false);
  assert.match(
    evaluateCounterweight("hold", "trend").strongest.text,
    /機会費用/,
  );
});

test("record rewards evidence handling and meaningful revision without an IQ score", () => {
  const signalAnswers = Object.fromEntries(
    SESSION.signals.map((signal) => [signal.id, signal.answer]),
  );
  const record = calculateRecord({
    initialStance: "deploy",
    finalStance: "pilot",
    initialConfidence: 75,
    finalConfidence: 55,
    signalAnswers,
    counterweightChoice: "security-evidence",
    revisionNote: "反論を受け、限定試験へ判断を更新した。",
  });

  assert.equal(record.repCount, 7);
  assert.equal(record.maxReps, 7);
  assert.equal(record.stanceChanged, true);
  assert.equal(record.revisionComplete, true);
  assert.equal(record.updateLabel, "判断を更新");
  assert.equal(calculateQuestXp(record), 840);
  assert.match(buildRecordText(record, "2026/08/01"), /BRAIN GYM/);
  assert.match(buildRecordText(record, "2026/08/01"), /IQではなく/);
});

test("quest XP rewards completed actions without rewarding stance change itself", () => {
  const record = calculateRecord({
    initialStance: "pilot",
    finalStance: "pilot",
    initialConfidence: 55,
    finalConfidence: 55,
    signalAnswers: {},
    counterweightChoice: "speed",
    revisionNote: "反論を確認したが、限定試験という判断は維持する。",
  });

  assert.equal(record.meaningfulUpdate, false);
  assert.equal(record.revisionComplete, true);
  assert.equal(record.repCount, 1);
  assert.equal(calculateQuestXp(record), 280);
});
