import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION,
  buildRecordText,
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
  });

  assert.equal(record.repCount, 7);
  assert.equal(record.maxReps, 7);
  assert.equal(record.stanceChanged, true);
  assert.equal(record.updateLabel, "判断を更新");
  assert.match(buildRecordText(record, "2026/08/01"), /IQではなく/);
});
