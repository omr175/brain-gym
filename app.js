import {
  SESSION,
  STANCES,
  buildRecordText,
  calculateRecord,
  evaluateCounterweight,
  getCounterweights,
} from "./src/logic.mjs";

const gym = document.querySelector("#workout");
const panel = document.querySelector("#workout-panel");
const title = document.querySelector("#workout-title");
const duration = document.querySelector("#round-duration");
const progressBar = document.querySelector("#progress-bar");
const progressText = document.querySelector("#progress-text");
const roundItems = [...document.querySelectorAll("#round-list li")];
const startButton = document.querySelector("#start-workout");
const themeToggle = document.querySelector("#theme-toggle");
const todayLabel = document.querySelector("#today-label");

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
  gym.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
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
    next === "dark" ? "#171714" : "#f2efe6",
  );
}

applyTheme(safeStorageGet("shiko-theme") ?? "light");

themeToggle.addEventListener("click", () => {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  safeStorageSet("shiko-theme", next);
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
          <span><b>${label}</b><small>${value === "deploy" ? "GO" : value === "pilot" ? "TEST" : "HOLD"}</small></span>
        </label>`,
    )
    .join("");
}

function rangeControl(id, name, value) {
  return `
    <div class="range-block">
      <div class="range-label"><label for="${id}">いまの確信度</label><output for="${id}" id="${id}-value">${value}%</output></div>
      <input id="${id}" name="${name}" type="range" min="10" max="90" step="5" value="${value}">
      <div class="range-scale" aria-hidden="true"><span>仮置き</span><span>かなり確か</span></div>
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
  const percent = ((round + 1) / 5) * 100;
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `ROUND ${round + 1} / 5`;
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

  const renderers = [renderCommit, renderSignal, renderCounterweight, renderRevision, renderRecord];
  renderers[round]();
  window.requestAnimationFrame(() => title.focus({ preventScroll: true }));
}

function renderCommit() {
  title.textContent = "判断をラックに置く";
  duration.textContent = "02 MIN";
  panel.innerHTML = `
    <div class="scenario-card">
      <p class="scenario-label">CASE / 01</p>
      <h3>${SESSION.title}</h3>
      <p>${SESSION.context}</p>
    </div>
    <form id="commit-form" class="workout-form">
      <fieldset>
        <legend><span>1A</span> AIに聞く前の判断</legend>
        <div class="choice-grid">${stanceOptions("initial-stance", state.initialStance)}</div>
      </fieldset>
      ${rangeControl("initial-confidence", "initial-confidence", state.initialConfidence)}
      <label class="text-field" for="initial-reason">
        <span><b>1B</b> その判断を支える理由を、まず自分の言葉で</span>
        <textarea id="initial-reason" name="initial-reason" minlength="12" maxlength="360" required placeholder="例：効果の可能性はあるが、全社展開には未確認の条件が残っている。">${escapeHtml(state.initialReason)}</textarea>
        <small>12文字以上。正解を書く場所ではなく、現在地を残す場所です。</small>
      </label>
      <button class="primary-action form-submit" type="submit">判断をcommitする <span aria-hidden="true">→</span></button>
    </form>`;

  bindRange("initial-confidence");
  document.querySelector("#commit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("initial-reason") ?? "").trim();
    if (reason.length < 12) {
      document.querySelector("#initial-reason").setCustomValidity("12文字以上で現在の理由を書いてください。");
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
  title.textContent = "情報を三つの棚へ戻す";
  duration.textContent = "03 MIN";
  panel.innerHTML = `
    <p class="round-intro">情報の価値ではなく、いま何が言えるかを分ける。各plateを一つの棚へ。</p>
    <form id="signal-form" class="signal-stack">
      ${SESSION.signals
        .map(
          (signal, index) => `
            <fieldset class="signal-row">
              <legend><span>${String(index + 1).padStart(2, "0")}</span>${signal.text}</legend>
              <div class="segment-control">
                ${[
                  ["fact", "確認できる"],
                  ["inference", "推論を含む"],
                  ["unknown", "まだ不明"],
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
      <button class="primary-action form-submit" type="submit">仕分けを固定する <span aria-hidden="true">→</span></button>
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
  title.textContent = "一番重い反論を持ち上げる";
  duration.textContent = "02 MIN";
  const options = getCounterweights(state.initialStance);
  panel.innerHTML = `
    <div class="decision-recap">
      <span>YOUR COMMIT</span>
      <b>${STANCES[state.initialStance]}</b>
      <strong>${state.initialConfidence}%</strong>
    </div>
    <p class="round-intro">自分の案を弱く殴る反論ではなく、判断を本当に変えうる反論を一つ選ぶ。</p>
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
      <button class="primary-action form-submit" type="submit">荷重を受ける <span aria-hidden="true">→</span></button>
    </form>`;

  document.querySelector("#counter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.counterweightChoice = String(form.get("counterweight"));
    const result = evaluateCounterweight(state.initialStance, state.counterweightChoice);
    state.counterweightFeedback = result.accepted
      ? "その反論は、元の判断の主要な不確実性へ直接荷重をかけている。"
      : `より重い反論はこれだった：${result.strongest.text}`;
    renderRound(3);
  });
}

function renderRevision() {
  title.textContent = "荷重のあとで、判断し直す";
  duration.textContent = "03 MIN";
  panel.innerHTML = `
    <div class="spotter-note"><span>SPOTTER</span><p>${state.counterweightFeedback}</p></div>
    <div class="decision-recap">
      <span>BEFORE</span>
      <b>${STANCES[state.initialStance]}</b>
      <strong>${state.initialConfidence}%</strong>
    </div>
    <form id="revision-form" class="workout-form">
      <fieldset>
        <legend><span>4A</span> いまの判断</legend>
        <div class="choice-grid">${stanceOptions("final-stance", state.finalStance)}</div>
      </fieldset>
      ${rangeControl("final-confidence", "final-confidence", state.finalConfidence)}
      <label class="text-field" for="revision-note">
        <span><b>4B</b> 何を維持し、何を更新したか</span>
        <textarea id="revision-note" name="revision-note" minlength="12" maxlength="360" required placeholder="例：限定試験の方向は維持するが、機密会議を除外し、security reviewを先行条件にした。">${escapeHtml(state.revisionNote)}</textarea>
        <small>考えを変えないことも選べます。反論を受けた後の理由を残してください。</small>
      </label>
      <button class="primary-action form-submit" type="submit">今日のrecordを見る <span aria-hidden="true">→</span></button>
    </form>`;

  bindRange("final-confidence");
  document.querySelector("#revision-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = String(form.get("revision-note") ?? "").trim();
    if (note.length < 12) {
      document.querySelector("#revision-note").setCustomValidity("12文字以上で更新内容を書いてください。");
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
  title.textContent = "今日の思考を記録する";
  duration.textContent = "02 MIN";
  const record = state.record ?? calculateRecord(state);
  const delta = record.confidenceDelta > 0 ? `+${record.confidenceDelta}` : record.confidenceDelta;
  const recordText = buildRecordText(record, dateLabel);
  const savedCount = Number(safeStorageGet("shiko-session-count") ?? 0);

  panel.innerHTML = `
    <div class="record-sheet">
      <div class="record-head">
        <div><span>TRAINING RECORD</span><strong>${dateLabel}</strong></div>
        <div class="rep-stamp"><b>${record.repCount}</b><span>/ ${record.maxReps} REPS</span></div>
      </div>
      <div class="record-grid">
        <div><span>SIGNAL</span><strong>${record.signals.correct}/${record.signals.total}</strong><small>根拠の仕分け</small></div>
        <div><span>COUNTERWEIGHT</span><strong>${record.counterweight.accepted ? "LIFT" : "RE-RACK"}</strong><small>${record.counterweight.accepted ? "最重量を選択" : "重い反論を確認"}</small></div>
        <div><span>UPDATE</span><strong>${delta} pt</strong><small>${record.updateLabel}</small></div>
      </div>
      <div class="decision-path">
        <div><span>BEFORE</span><b>${record.initialStanceLabel}</b><small>${state.initialConfidence}%</small></div>
        <span aria-hidden="true">→</span>
        <div><span>AFTER</span><b>${record.finalStanceLabel}</b><small>${state.finalConfidence}%</small></div>
      </div>
      <p class="record-note">これはIQでも能力診断でもない。今日、実際に行った思考のrepだけを記録している。</p>
    </div>
    <div class="record-actions">
      <button class="primary-action" id="save-record" type="button">この端末に記録する</button>
      <button class="secondary-action" id="copy-record" type="button">recordをコピー</button>
      <button class="text-action" id="restart-workout" type="button">もう一度トレーニング</button>
    </div>
    <p class="local-note" id="record-status" role="status">これまでのdevice-local session: ${savedCount}。入力内容は保存しません。</p>`;

  document.querySelector("#save-record").addEventListener("click", () => {
    const next = Number(safeStorageGet("shiko-session-count") ?? 0) + 1;
    const saved = safeStorageSet("shiko-session-count", String(next));
    document.querySelector("#record-status").textContent = saved
      ? `この端末にsession回数 ${next} を記録しました。入力内容は保存していません。`
      : "browser設定により保存できませんでした。入力内容は外部送信されていません。";
  });

  document.querySelector("#copy-record").addEventListener("click", async () => {
    const status = document.querySelector("#record-status");
    try {
      await navigator.clipboard.writeText(recordText);
      status.textContent = "recordをclipboardへコピーしました。";
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
