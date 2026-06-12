import { analyzeLibrary, rewriteBullet, acknowledgeInput } from '../services/ai-guide.js';
import { getApiKey, getLibrary, updateLibraryItem } from '../services/storage.js';
import { createVoiceInput, isVoiceSupported } from '../services/voice-input.js';

let onCloseCb = null;
let tasks = [];
let acceptedCount = 0;
let skippedCount = 0;
let resolveAnswer = null;  // unified: resolves on text send OR choice button click
let resolveSkip = null;
let activeChoiceEl = null;
let msgContainer = null;
let aborted = false;

const SKIP = Symbol('skip');
const GENERATE = Symbol('generate');

export async function startGuide(opts = {}) {
  onCloseCb = opts.onClose ?? null;
  tasks = [];
  acceptedCount = 0;
  skippedCount = 0;
  resolveAnswer = null;
  resolveSkip = null;
  activeChoiceEl = null;
  aborted = false;

  if (!getApiKey()) {
    alert('请先在右上角设置 DeepSeek API Key，再使用 AI 完善功能');
    return;
  }

  mountUI();
  showOverlay(true);
  msgContainer = document.getElementById('guide-messages');
  await runGuide();
}

// ── UI mount ──────────────────────────────────────────────────────────────────

function mountUI() {
  let overlay = document.getElementById('guide-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'guide-overlay';
    document.body.appendChild(overlay);
  }
  overlay.className = 'guide-overlay hidden';
  overlay.innerHTML = `
    <div class="guide-chat-modal">
      <div class="guide-chat-head">
        <span class="guide-chat-label">✨ AI 完善经历</span>
        <span id="guide-progress" class="guide-chat-progress"></span>
        <button id="guide-x" class="guide-x" title="关闭">✕</button>
      </div>
      <div class="guide-messages" id="guide-messages"></div>
      <div class="guide-chat-footer">
        <div class="guide-input-wrap">
          <textarea id="guide-input" class="guide-input" rows="1" placeholder="输入你的回答…" disabled></textarea>
          ${isVoiceSupported() ? `<button id="guide-voice" class="guide-voice-btn" title="语音输入">🎤</button>` : ''}
          <button id="guide-send" class="guide-send-btn" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/></svg>
          </button>
        </div>
        <button id="guide-skip-task" class="guide-skip-task-btn hidden">跳过这条</button>
      </div>
    </div>
  `;
  document.getElementById('guide-x').addEventListener('click', closeGuide);
  wireFooter();
}

function wireFooter() {
  const input = document.getElementById('guide-input');
  const sendBtn = document.getElementById('guide-send');
  const skipBtn = document.getElementById('guide-skip-task');
  const voiceBtn = document.getElementById('guide-voice');

  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  sendBtn.addEventListener('click', doSend);

  skipBtn.addEventListener('click', () => {
    cleanupPending();
    if (resolveAnswer) { const fn = resolveAnswer; resolveAnswer = null; fn(SKIP); }
    if (resolveSkip) { const fn = resolveSkip; resolveSkip = null; fn(SKIP); }
  });

  if (voiceBtn) {
    let base = '';
    const voice = createVoiceInput({
      onText: (final, interim) => {
        input.value = (base ? base + ' ' : '') + final + interim;
        input.dispatchEvent(new Event('input'));
      },
      onState: live => {
        voiceBtn.classList.toggle('recording', live);
        voiceBtn.title = live ? '停止录音' : '语音输入';
        if (live) base = input.value.trim();
      },
      onError: msg => { voiceBtn.classList.remove('recording'); alert(msg); }
    });
    voiceBtn.addEventListener('click', () =>
      voiceBtn.classList.contains('recording') ? voice.stop() : (base = input.value.trim(), voice.start())
    );
  }
}

function doSend() {
  const input = document.getElementById('guide-input');
  const val = input.value.trim();
  if (!val || !resolveAnswer) return;
  addUserMsg(val);
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('guide-send').disabled = true;
  const fn = resolveAnswer;
  resolveAnswer = null;
  setInput(false);
  fn(val);
}

function cleanupPending() {
  if (activeChoiceEl) { activeChoiceEl.remove(); activeChoiceEl = null; }
  setInput(false);
}

// ── Guide flow ────────────────────────────────────────────────────────────────

async function runGuide() {
  const typing = addTyping();
  let analysis;
  try {
    analysis = await analyzeLibrary();
  } catch (err) {
    typing.remove();
    addAiMsg('😅 分析出了点问题：' + esc(err.message || '请稍后重试'));
    return;
  }
  if (aborted) return;
  typing.remove();

  const { summary, tasks: t, truncated } = analysis;

  if (!t.length) {
    addAiMsg('🎉 你的经历描述已经挺不错了，没发现明显需要改进的地方~ 如果想针对特定岗位调整，可以手动打磨！');
    await addActions([{ label: '好的，关闭', primary: true, value: true }]);
    closeGuide();
    return;
  }

  tasks = t;
  addAiMsg(
    `好，分析完了！发现 <strong>${t.length} 条</strong>描述还可以更出彩 ✨` +
    (truncated ? `<br><span class="guide-note-sm">（先挑了最需要完善的 ${t.length} 条）</span>` : '')
  );
  await pause(180);
  if (summary) { addAiMsg(summary); await pause(180); }
  addAiMsg('我来一条一条问你几个问题。你也可以随时在输入框补充任何想说的，我会优先处理你补充的内容~ 随时可以跳过不想改的。');

  const go = await addActions([
    { label: '好，开始 →', primary: true, value: true },
    { label: '先不用了', primary: false, value: false }
  ]);
  if (!go || aborted) { closeGuide(); return; }

  // Global brain dump: let user offload everything before sequential Q&A
  await pause(150);
  addAiMsg('在逐条提问之前，你有没有想先说的？比如某段经历的具体数字、评语、背景情况……什么都可以，我会记住，改写时自动提取相关的。没有就直接点下面的按钮开始。');
  const globalFreeform = await collectGlobalDump();
  if (aborted) return;

  const pendingRewrites = [];
  for (let i = 0; i < tasks.length; i++) {
    if (aborted) return;
    updateProgress(i + 1, tasks.length);
    const { answers, freeform, skipped } = await collectAnswers(tasks[i]);
    if (aborted) return;

    if (skipped) {
      skippedCount++;
      await pause(120);
      addAiMsg('好的，跳过这条~ 继续下一条。');
      continue;
    }

    const loadingEl = addLoadingMsg('让我帮你改写一下…');
    try {
      const newText = await rewriteBullet(
        tasks[i],
        tasks[i].questions.map((q, qi) => ({ question: q.text, answer: answers[qi] || '' })),
        freeform,
        globalFreeform
      );
      loadingEl.replaceWith(buildResultCard(tasks[i], newText));
    } catch {
      loadingEl.replaceWith(buildErrorBubble());
    }
    scrollBottom();
  }

  if (aborted) return;
  updateProgress(tasks.length, tasks.length);
  await pause(200);
  addAiMsg('全部改写完成 🎊 上面的优化版随时可以采用，也可以编辑后再采用~');
  await pause(300);
  addAiMsg(`这次共采用了 <strong>${acceptedCount}</strong> 条优化，加油！💪`);
  const close = await addActions([{ label: '完成，关闭', primary: true, value: true }]);
  if (close) closeGuide();
}

async function collectGlobalDump() {
  const items = [];
  let doneResolve = null;
  const donePromise = new Promise(r => { doneResolve = r; });
  const doneEl = addGenerateButton(() => { if (doneResolve) { doneResolve(); doneResolve = null; } }, '好，开始逐条优化 →');

  while (true) {
    if (aborted) { doneEl.remove(); setInput(false); return items; }
    setInput(true, '想到什么就说什么，没有就直接点上面的按钮…');
    const r = await Promise.race([waitAnswer(), donePromise.then(() => GENERATE)]);
    setInput(false);
    if (r === GENERATE) break;
    items.push(r);
    const typingEl = addTyping();
    try {
      const ack = await acknowledgeInput(r);
      const ackEl = document.createElement('div');
      ackEl.className = 'guide-msg ai';
      ackEl.innerHTML = `<div class="guide-bubble">${esc(ack)}</div>`;
      typingEl.replaceWith(ackEl);
    } catch {
      const fallbackEl = document.createElement('div');
      fallbackEl.className = 'guide-msg ai';
      fallbackEl.innerHTML = `<div class="guide-bubble">好的，记住了~</div>`;
      typingEl.replaceWith(fallbackEl);
    }
    scrollBottom();
  }

  doneEl.remove();
  setInput(false);
  if (items.length) {
    await pause(100);
    addAiMsg(`好，记住了 ${items.length} 条背景信息，改写时我会自动提取相关内容~`);
    await pause(120);
  }
  return items;
}

async function collectAnswers(task) {
  await pause(120);
  addAiMsg(`<span class="guide-chip">${esc(task.entryTitle)}</span>`);
  await pause(100);

  const issuesHtml = task.issues.length
    ? `<div class="guide-issues-row">${task.issues.map(i => `<span class="guide-issue">${esc(i)}</span>`).join('')}</div>`
    : '';
  addAiMsg(`<div class="guide-quote">${esc(task.bulletText)}</div>${issuesHtml}`);
  await pause(180);

  const answers = Array(task.questions.length).fill('');
  const freeform = [];

  showSkip(true);
  const skipPromise = new Promise(r => { resolveSkip = r; });

  // ── Structured questions (input always on, choice buttons as shortcuts) ──
  for (let qi = 0; qi < task.questions.length; qi++) {
    if (aborted) { doCleanup(); return { answers, freeform, skipped: true }; }
    await pause(150);
    addAiMsg(esc(task.questions[qi].text));
    await pause(80);

    const q = task.questions[qi];

    // Show choice/boolean buttons as shortcuts (clicking them resolves resolveAnswer)
    let choiceEl = null;
    if (q.format === 'boolean' || q.format === 'choice') {
      const opts = q.format === 'boolean' ? ['是', '否'] : (q.options || []);
      choiceEl = addChoiceRow(opts, q.format === 'choice');
    }

    // Input is always active — user can type instead of clicking buttons
    setInput(true, q.format === 'open' ? '用一两句话回答，没有就留空…' : '输入回答，或点上面的选项…');

    const r = await Promise.race([waitAnswer(), skipPromise.then(() => SKIP)]);

    setInput(false);
    if (choiceEl && choiceEl.parentNode) { choiceEl.remove(); activeChoiceEl = null; }

    if (r === SKIP) { doCleanup(); return { answers, freeform, skipped: true }; }
    answers[qi] = r;
    // user bubble already shown by doSend or choice button handler
  }

  // ── Freeform phase: user can add anything before AI rewrites ──
  await pause(150);
  addAiMsg('还有要补充的吗？比如具体数据、背景细节、你觉得重要的细节，随便说~ 说完了点「生成优化版」。');

  // generate button fires a one-time promise
  let generateResolve = null;
  const generatePromise = new Promise(r => { generateResolve = r; });
  const generateEl = addGenerateButton(() => { if (generateResolve) { generateResolve(); generateResolve = null; } });

  while (true) {
    if (aborted) { generateEl.remove(); doCleanup(); return { answers, freeform, skipped: true }; }
    setInput(true, '补充任何细节，AI 会优先处理你的内容…');

    const r = await Promise.race([
      waitAnswer(),
      generatePromise.then(() => GENERATE),
      skipPromise.then(() => SKIP)
    ]);

    setInput(false);
    if (r === SKIP || r === GENERATE) break;

    freeform.push(r);
    const typingEl2 = addTyping();
    try {
      const ack = await acknowledgeInput(r);
      const ackEl = document.createElement('div');
      ackEl.className = 'guide-msg ai';
      ackEl.innerHTML = `<div class="guide-bubble">${esc(ack)}</div>`;
      typingEl2.replaceWith(ackEl);
    } catch {
      const fallbackEl = document.createElement('div');
      fallbackEl.className = 'guide-msg ai';
      fallbackEl.innerHTML = `<div class="guide-bubble">好的，记住了~</div>`;
      typingEl2.replaceWith(fallbackEl);
    }
    scrollBottom();
  }

  generateEl.remove();
  showSkip(false);
  resolveSkip = null;
  return { answers, freeform, skipped: false };
}

function doCleanup() {
  cleanupPending();
  showSkip(false);
  resolveSkip = null;
  resolveAnswer = null;
}

function waitAnswer() {
  return new Promise(r => { resolveAnswer = r; });
}

// ── Choice row (shortcuts; also resolves resolveAnswer) ───────────────────────

function addChoiceRow(opts, hasOther) {
  const el = document.createElement('div');
  el.className = 'guide-msg choices';
  activeChoiceEl = el;

  const row = document.createElement('div');
  row.className = 'guide-choice-row';

  const finish = val => {
    activeChoiceEl = null;
    el.remove();
    addUserMsg(val);
    if (resolveAnswer) { const fn = resolveAnswer; resolveAnswer = null; setInput(false); fn(val); }
  };

  opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'guide-choice-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (hasOther && /其他|其它/.test(opt)) {
        showOther(el, finish);
      } else {
        finish(opt);
      }
    });
    row.appendChild(btn);
  });

  el.appendChild(row);
  msgContainer.appendChild(el);
  scrollBottom();
  return el;
}

function showOther(parentEl, onConfirm) {
  parentEl.querySelector('.guide-choice-row')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'guide-other-wrap';

  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'guide-other-input';
  field.placeholder = '请补充说明…';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'guide-choice-btn selected';
  confirmBtn.textContent = '确认';
  confirmBtn.addEventListener('click', () => {
    const val = field.value.trim() ? '其他：' + field.value.trim() : '其他';
    onConfirm(val);
  });
  field.addEventListener('keydown', e => { if (e.key === 'Enter') confirmBtn.click(); });

  wrap.appendChild(field);
  wrap.appendChild(confirmBtn);
  parentEl.appendChild(wrap);
  field.focus();
  scrollBottom();
}

// ── Message builders ──────────────────────────────────────────────────────────

function addAiMsg(html) {
  const el = document.createElement('div');
  el.className = 'guide-msg ai';
  el.innerHTML = `<div class="guide-bubble">${html}</div>`;
  msgContainer.appendChild(el);
  scrollBottom();
  return el;
}

function addUserMsg(text) {
  const el = document.createElement('div');
  el.className = 'guide-msg user';
  el.innerHTML = `<div class="guide-bubble user">${esc(text)}</div>`;
  msgContainer.appendChild(el);
  scrollBottom();
  return el;
}

function addTyping() {
  const el = document.createElement('div');
  el.className = 'guide-msg ai';
  el.innerHTML = `<div class="guide-bubble"><span class="guide-dot"></span><span class="guide-dot"></span><span class="guide-dot"></span></div>`;
  msgContainer.appendChild(el);
  scrollBottom();
  return el;
}

function addLoadingMsg(text) {
  const el = document.createElement('div');
  el.className = 'guide-msg ai';
  el.innerHTML = `<div class="guide-bubble"><span class="guide-spinner-sm"></span> ${esc(text)}</div>`;
  msgContainer.appendChild(el);
  scrollBottom();
  return el;
}

function addActions(actions) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'guide-msg actions';
    const row = document.createElement('div');
    row.className = 'guide-action-row';
    actions.forEach(({ label, primary, value }) => {
      const btn = document.createElement('button');
      btn.className = `btn ${primary ? 'btn-primary' : 'btn-ghost'} btn-sm`;
      btn.textContent = label;
      btn.addEventListener('click', () => { el.remove(); resolve(value); });
      row.appendChild(btn);
    });
    el.appendChild(row);
    msgContainer.appendChild(el);
    scrollBottom();
  });
}

function addGenerateButton(onClick, label = '生成优化版 ✨') {
  const el = document.createElement('div');
  el.className = 'guide-msg actions';
  const row = document.createElement('div');
  row.className = 'guide-action-row';
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary btn-sm';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  row.appendChild(btn);
  el.appendChild(row);
  msgContainer.appendChild(el);
  scrollBottom();
  return el;
}

function buildResultCard(task, newText) {
  const el = document.createElement('div');
  el.className = 'guide-msg result';
  el.innerHTML = `
    <div class="guide-result-card">
      <div class="guide-result-row">
        <span class="guide-result-label">原来</span>
        <div class="guide-result-original">${esc(task.bulletText)}</div>
      </div>
      <div class="guide-result-row">
        <span class="guide-result-label accent">优化后</span>
        <textarea class="guide-result-edit" rows="2">${esc(newText)}</textarea>
      </div>
      <div class="guide-result-actions">
        <button class="btn btn-ghost btn-sm" data-skip>不用这条</button>
        <button class="btn btn-primary btn-sm" data-accept>采用 ✓</button>
      </div>
    </div>
  `;
  el.querySelector('[data-accept]').addEventListener('click', () => {
    const txt = el.querySelector('.guide-result-edit').value.trim();
    if (txt) { applyRewrite(task, txt); acceptedCount++; }
    el.querySelector('.guide-result-actions').innerHTML = '<span class="guide-adopted">✅ 已采用</span>';
  });
  el.querySelector('[data-skip]').addEventListener('click', () => {
    skippedCount++;
    el.querySelector('.guide-result-actions').innerHTML = '<span class="guide-adopted muted">— 已跳过</span>';
  });
  return el;
}

function buildErrorBubble() {
  const el = document.createElement('div');
  el.className = 'guide-msg ai';
  el.innerHTML = `<div class="guide-bubble">😅 改写失败了，跳过这条吧</div>`;
  return el;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyRewrite(task, text) {
  const lib = getLibrary();
  const arr = task.itemType === 'work' ? lib.experiences : lib.projects;
  const item = (arr || []).find(i => i.id === task.itemId);
  if (!item || !item.bullets?.[task.bulletIndex]) return;
  const b = item.bullets[task.bulletIndex];
  if (!b.original) b.original = task.bulletText;
  b.enhanced = text;
  b.useEnhanced = true;
  updateLibraryItem(task.itemType, task.itemId, { bullets: item.bullets });
}

function setInput(enabled, placeholder = '输入你的回答…') {
  const input = document.getElementById('guide-input');
  const sendBtn = document.getElementById('guide-send');
  if (!input) return;
  input.disabled = !enabled;
  input.placeholder = placeholder;
  if (enabled) { input.focus(); }
  else { input.value = ''; input.style.height = 'auto'; if (sendBtn) sendBtn.disabled = true; }
}

function showSkip(visible) {
  document.getElementById('guide-skip-task')?.classList.toggle('hidden', !visible);
}

function updateProgress(cur, tot) {
  const el = document.getElementById('guide-progress');
  if (el) el.textContent = tot > 0 ? `${cur} / ${tot}` : '';
}

function showOverlay(show) {
  document.getElementById('guide-overlay')?.classList.toggle('hidden', !show);
}

function closeGuide() {
  aborted = true;
  if (resolveAnswer) { const fn = resolveAnswer; resolveAnswer = null; fn(SKIP); }
  if (resolveSkip) { const fn = resolveSkip; resolveSkip = null; fn(SKIP); }
  showOverlay(false);
  if (onCloseCb) onCloseCb();
}

function scrollBottom() {
  requestAnimationFrame(() => { if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight; });
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
