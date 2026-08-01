import {
  SESSION,
  STANCES,
  buildRecordText,
  calculateQuestXp,
  calculateRecord,
  evaluateCounterweight,
  evaluateSignals,
  getCounterweights,
} from "./src/logic.mjs";

const gym = document.querySelector("#workout");
const panel = document.querySelector("#workout-panel");
const title = document.querySelector("#workout-title");
const duration = document.querySelector("#round-duration");
const progressBar = document.querySelector("#progress-bar");
const progressText = document.querySelector("#progress-text");
const zoneLabel = document.querySelector("#zone-label");
const xpLabel = document.querySelector("#xp-label");
const stageCode = document.querySelector("#stage-code");
const roundItems = [...document.querySelectorAll("#round-list li")];
const startButton = document.querySelector("#start-workout");
const themeToggle = document.querySelector("#theme-toggle");
const todayLabel = document.querySelector("#today-label");

const STAGES = [
  { zone: "BASE CAMP", title: "判断をキャンプに置く", duration: "02 MIN", previewXp: 0 },
  { zone: "THE FORK", title: "情報を三つの道へ分ける", duration: "03 MIN", previewXp: 120 },
  { zone: "FOG FIELD", title: "一番重い反論を見つける", duration: "02 MIN", previewXp: 320 },
  { zone: "HEAVY PASS", title: "荷重のあとで判断し直す", duration: "03 MIN", previewXp: 520 },
  { zone: "RETURN GATE", title: "今日の冒険を持ち帰る", duration: "02 MIN", previewXp: 0 },
];

const dateLabel = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const state = {
  round: 0,
  initialStance: null,
  initialConfidence: 55,
  initialReason: "",
  signalAnswers: {},
  counterweightChoice: null,
  counterweightFeedback: null,
  finalStance: null,
  finalConfidence: 55,
  revisionNote: "",
  record: null,
};

todayLabel.textContent = `TODAY ${dateLabel.replaceAll("/", ".")}`;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scrollToGym() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  gym.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = next;
  themeToggle.setAttribute("aria-pressed", String(next === "dark"));
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    next === "dark" ? "#12283b" : "#f8f1dd",
  );
}

applyTheme(safeStorageGet("brain-gym-theme") ?? safeStorageGet("shiko-theme") ?? "light");

themeToggle.addEventListener("click", () => {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  safeStorageSet("brain-gym-theme", next);
});

startButton.addEventListener("click", () => {
  gym.hidden = false;
  renderRound(0);
  scrollToGym();
});

function stanceOptions(name, selected) {
  return Object.entries(STANCES)
    .map(
      ([value, label]) => `
        <label class="choice-card">
          <input type="radio" name="${name}" value="${value}" ${selected === value ? "checked" : ""} required>
          <span><b>${label}</b><small>${value === "deploy" ? "GO" : value === "pilot" ? "SCOUT" : "CAMP"}</small></span>
        </label>`,
    )
    .join("");
}

function rangeControl(id, name, value) {
  return `
    <div class="range-block">
      <div class="range-label"><label for="${id}">判断の装備重量 / 確信度</label><output for="${id}" id="${id}-value">${value}%</output></div>
      <input id="${id}" name="${name}" type="range" min="10" max="90" step="5" value="${value}">
      <div class="range-scale" aria-hidden="true"><span>まだ軽い</span><span>かなり重い</span></div>
    </div>`;
}

function bindRange(id) {
  const input = document.querySelector(`#${id}`);
  const output = document.querySelector(`#${id}-value`);
  input?.addEventListener("input", () => {
    output.value = `${input.value}%`;
    output.textContent = `${input.value}%`;
  });
}

function updateProgress(round) {
  const meta = STAGES[round];
  progressBar.style.width = `${((round + 1) / STAGES.length) * 100}%`;
  progressText.textContent = `STAGE ${round + 1} / ${STAGES.length}`;
  zoneLabel.textContent = meta.zone;
  stageCode.textContent = `STAGE ${String(round + 1).padStart(2, "0")}`;
  duration.textContent = meta.duration;
  xpLabel.textContent = String(
    round === 4 && state.record ? calculateQuestXp(state.record) : meta.previewXp,
  ).padStart(3, "0");

  roundItems.forEach((item, index) => {
    item.classList.toggle("is-active", index === round);
    item.classList.toggle("is-done", index < round);
    if (index === round) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
}

function renderRound(round) {
  state.round = round;
  updateProgress(round);
  title.textContent = STAGES[round].title;

  const renderers = [renderCommit, renderSignal, renderCounterweight, renderRevision, renderRecord];
  renderers[round]();
  window.requestAnimationFrame(() => title.focus({ preventScroll: true }));
}

function renderCommit() {
  panel.innerHTML = `
    <div class="scenario-card">
      <p class="scenario-label">MISSION BRIEF / CASE 01</p>
      <h3>${SESSION.title}</h3>
      <p>${SESSION.context}</p>
    </div>
    <form id="commit-form" class="workout-form">
      <fieldset>
        <legend><span>MOVE</span> AIに聞く前に、進むルートを選ぶ</legend>
        <div class="choice-grid">${stanceOptions("initial-stance", state.initialStance)}</div>
      </fieldset>
      ${rangeControl("initial-confidence", "initial-confidence", state.initialConfidence)}
      <label class="text-field" for="initial-reason">
        <span><b>PACK</b> そのルートを選んだ理由を、装備として持つ</span>
        <textarea id="initial-reason" name="initial-reason" minlength="12" maxlength="360" required placeholder="例：効果はありそうだが、全社展開には未確認の条件が残っている。">${escapeHtml(state.initialReason)}</textarea>
        <small>12文字以上。正解ではなく、出発地点を残します。</small>
      </label>
      <button class="primary-action form-submit" type="submit">このルートで出発 <span aria-hidden="true">➜</span></button>
    </form>`;

  bindRange("initial-confidence");
  document.querySelector("#commit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("initial-reason") ?? "").trim();
    if (reason.length < 12) {
      document.querySelector("#initial-reason").setCustomValidity("12文字以上で出発時の理由を書いてください。");
      event.currentTarget.reportValidity();
      document.querySelector("#initial-reason").setCustomValidity("");
      return;
    }
    state.initialStance = String(form.get("initial-stance"));
    state.initialConfidence = Number(form.get("initial-confidence"));
    state.initialReason = reason;
    state.finalStance = state.initialStance;
    state.finalConfidence = state.initialConfidence;
    renderRound(1);
  });
}

function renderSignal() {
  panel.innerHTML = `
    <p class="round-intro">推論の霧は、情報が足りない場所に発生する。5枚のsignal plateを正しい道へ置き、視界を取り戻そう。</p>
    <form id="signal-form" class="signal-stack">
      ${SESSION.signals
        .map(
          (signal, index) => `
            <fieldset class="signal-row">
              <legend><span>PLATE ${String(index + 1).padStart(2, "0")}</span>${signal.text}</legend>
              <div class="segment-control">
                ${[
                  ["fact", "確認できる / FACT"],
                  ["inference", "推論を含む / LEAP"],
                  ["unknown", "まだ不明 / FOG"],
                ]
                  .map(
                    ([value, label]) => `
                      <label>
                        <input type="radio" name="signal-${signal.id}" value="${value}" ${state.signalAnswers[signal.id] === value ? "checked" : ""} required>
                        <span>${label}</span>
                      </label>`,
                  )
                  .join("")}
              </div>
            </fieldset>`,
        )
        .join("")}
      <button class="primary-action form-submit" type="submit">霧を切り開く <span aria-hidden="true">➜</span></button>
    </form>`;

  document.querySelector("#signal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.signalAnswers = Object.fromEntries(
      SESSION.signals.map((signal) => [signal.id, form.get(`signal-${signal.id}`)]),
    );
    renderRound(2);
  });
}

function renderCounterweight() {
  const options = getCounterweights(state.initialStance);
  const signals = evaluateSignals(state.signalAnswers);
  panel.innerHTML = `
    <div class="decision-recap">
      <span>FOG CLEARED / YOUR ROUTE</span>
      <b>${signals.correct}/${signals.total} · ${STANCES[state.initialStance]}</b>
      <strong>${state.initialConfidence}%</strong>
    </div>
    <div class="boss-encounter">
      <div class="boss-stone" aria-hidden="true">?</div>
      <div class="boss-copy">
        <small>BOSS ENCOUNTER</small>
        <h3>THE COUNTERWEIGHT</h3>
        <p>弱い反論では動かない。元の判断を本当に変えうる一撃を選べ。</p>
        <div class="boss-meter" aria-label="ボス耐久値 100パーセント"><i></i></div>
      </div>
    </div>
    <form id="counter-form" class="counter-stack">
      <fieldset>
        <legend class="sr-only">最も強い反論を選択</legend>
        ${options
          .map(
            (option, index) => `
              <label class="counter-card">
                <input type="radio" name="counterweight" value="${option.id}" ${state.counterweightChoice === option.id ? "checked" : ""} required>
                <span class="counter-index">${String.fromCharCode(65 + index)}</span>
                <span>${option.text}</span>
              </label>`,
          )
          .join("")}
      </fieldset>
      <button class="primary-action form-submit" type="submit">反論を装備して挑む <span aria-hidden="true">➜</span></button>
    </form>`;

  document.querySelector("#counter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.counterweightChoice = String(form.get("counterweight"));
    const result = evaluateCounterweight(state.initialStance, state.counterweightChoice);
    state.counterweightFeedback = result.accepted
      ? "BREAK成功。元の判断の主要な不確実性へ、直接荷重をかけた。"
      : `BLOCKされた。より重い反論はこれだった：${result.strongest.text}`;
    renderRound(3);
  });
}

function renderRevision() {
  panel.innerHTML = `
    <div class="spotter-note"><span>SCOUT LOG</span><p>${state.counterweightFeedback}</p></div>
    <div class="decision-recap">
      <span>ROUTE BEFORE BOSS</span>
      <b>${STANCES[state.initialStance]}</b>
      <strong>${state.initialConfidence}%</strong>
    </div>
    <form id="revision-form" class="workout-form">
      <fieldset>
        <legend><span>RETURN</span> 荷重を受けたあと、帰還ルートを選び直す</legend>
        <div class="choice-grid">${stanceOptions("final-stance", state.finalStance)}</div>
      </fieldset>
      ${rangeControl("final-confidence", "final-confidence", state.finalConfidence)}
      <label class="text-field" for="revision-note">
        <span><b>LOG</b> 何を維持し、何を更新したか</span>
        <textarea id="revision-note" name="revision-note" minlength="12" maxlength="360" required placeholder="例：限定試験は維持するが、機密会議を除外し、security reviewを先行条件にする。">${escapeHtml(state.revisionNote)}</textarea>
        <small>考えを変えなくてもよい。反論を受けたあとの理由を記録します。</small>
      </label>
      <button class="primary-action form-submit" type="submit">帰還してXPを受け取る <span aria-hidden="true">➜</span></button>
    </form>`;

  bindRange("final-confidence");
  document.querySelector("#revision-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = String(form.get("revision-note") ?? "").trim();
    if (note.length < 12) {
      document.querySelector("#revision-note").setCustomValidity("12文字以上で帰還時の理由を書いてください。");
      event.currentTarget.reportValidity();
      document.querySelector("#revision-note").setCustomValidity("");
      return;
    }
    state.finalStance = String(form.get("final-stance"));
    state.finalConfidence = Number(form.get("final-confidence"));
    state.revisionNote = note;
    state.record = calculateRecord(state);
    renderRound(4);
  });
}

function renderRecord() {
  const record = state.record ?? calculateRecord(state);
  const questXp = calculateQuestXp(record);
  const delta = record.confidenceDelta > 0 ? `+${record.confidenceDelta}` : record.confidenceDelta;
  const recordText = buildRecordText(record, dateLabel);
  const savedCount = Number(
    safeStorageGet("brain-gym-session-count") ?? safeStorageGet("shiko-session-count") ?? 0,
  );
  const savedXp = Number(safeStorageGet("brain-gym-total-xp") ?? 0);
  xpLabel.textContent = String(questXp).padStart(3, "0");

  panel.innerHTML = `
    <div class="record-sheet">
      <div class="record-head">
        <div><span>QUEST CLEAR / 001</span><strong>${dateLabel}</strong></div>
        <div class="rep-stamp"><b>${questXp}</b><span>QUEST XP</span></div>
      </div>
      <div class="record-grid">
        <div><span>FOG FIELD</span><strong>${record.signals.correct}/${record.signals.total}</strong><small>signal plateを正しく配置</small></div>
        <div><span>COUNTERWEIGHT</span><strong>${record.counterweight.accepted ? "BREAK" : "RE-RACK"}</strong><small>${record.counterweight.accepted ? "最重量を選択" : "強い反論を発見"}</small></div>
        <div><span>RETURN</span><strong>${delta} pt</strong><small>${record.updateLabel}</small></div>
      </div>
      <div class="decision-path">
        <div><span>DEPARTURE</span><b>${record.initialStanceLabel}</b><small>${state.initialConfidence}%</small></div>
        <span aria-hidden="true">➜</span>
        <div><span>RETURN</span><b>${record.finalStanceLabel}</b><small>${state.finalConfidence}%</small></div>
      </div>
      <p class="record-note">XPはIQでも能力診断でもない。QUEST完了、根拠の仕分け、反論への荷重、理由を残した帰還という、今日の行動だけを数えている。</p>
    </div>
    <div class="record-actions">
      <button class="primary-action" id="save-record" type="button">XPをこの端末に記録</button>
      <button class="secondary-action" id="copy-record" type="button">QUEST LOGをコピー</button>
      <button class="text-action" id="restart-workout" type="button">QUESTを再挑戦</button>
    </div>
    <p class="local-note" id="record-status" role="status">この端末の記録: ${savedCount} quests / ${savedXp} XP。回答内容は保存しません。</p>`;

  let savedThisRound = false;
  document.querySelector("#save-record").addEventListener("click", (event) => {
    if (savedThisRound) return;
    const nextCount = savedCount + 1;
    const nextXp = savedXp + questXp;
    const countSaved = safeStorageSet("brain-gym-session-count", String(nextCount));
    const xpSaved = safeStorageSet("brain-gym-total-xp", String(nextXp));
    savedThisRound = countSaved && xpSaved;
    event.currentTarget.disabled = savedThisRound;
    event.currentTarget.textContent = savedThisRound ? "このQUESTを記録済み" : "記録できませんでした";
    document.querySelector("#record-status").textContent = savedThisRound
      ? `この端末に ${nextCount} quests / ${nextXp} XP を記録しました。回答内容は保存していません。`
      : "browser設定により保存できませんでした。回答内容は外部送信されていません。";
  });

  document.querySelector("#copy-record").addEventListener("click", async () => {
    const status = document.querySelector("#record-status");
    try {
      await navigator.clipboard.writeText(recordText);
      status.textContent = "QUEST LOGをclipboardへコピーしました。";
    } catch {
      status.textContent = "clipboardへコピーできませんでした。";
    }
  });

  document.querySelector("#restart-workout").addEventListener("click", () => {
    Object.assign(state, {
      round: 0,
      initialStance: null,
      initialConfidence: 55,
      initialReason: "",
      signalAnswers: {},
      counterweightChoice: null,
      counterweightFeedback: null,
      finalStance: null,
      finalConfidence: 55,
      revisionNote: "",
      record: null,
    });
    renderRound(0);
    scrollToGym();
  });
}
