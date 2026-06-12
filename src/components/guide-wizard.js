import { analyzeLibrary, rewriteBullet } from '../services/ai-guide.js';
import { getApiKey, getLibrary, updateLibraryItem } from '../services/storage.js';
import { createVoiceInput, isVoiceSupported } from '../services/voice-input.js';

let onCloseCb = null;
let tasks = [];
let acceptedCount = 0;
let skippedCount = 0;
let resolveInput = null;   // for waiting on open-text answer
let resolveSkip = null;    // for waiting on task-level skip
let activeChoiceEl = null; // choice row currently shown
let msgContainer = null;
let aborted = false;

const SKIP = Symbol('skip');

export async function startGuide(opts = {}) {
  onCloseCb = opts.onClose ?? null;
  tasks = [];
  acceptedCount = 0;
  skippedCount = 0;
  resolveInput = null;
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
    if (resolveInput) { const fn = resolveInput; resolveInput = null; fn(SKIP); }
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
  if (!val || !resolveInput) return;
  addUserMsg(val);
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('guide-send').disabled = true;
  const fn = resolveInput;
  resolveInput = null;
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
  addAiMsg('我来一条一条问你几个小问题，帮你补上量化数据和 STAR 要素，把描述改得更专业。随时可以跳过不想改的~');

  const go = await addActions([
    { label: '好，开始 →', primary: true, value: true },
    { label: '先不用了', primary: false, value: false }
  ]);
  if (!go || aborted) { closeGuide(); return; }

  // Process tasks — rewrite fires async so next task's Q&A starts immediately
  const pendingRewrites = [];
  for (let i = 0; i < tasks.length; i++) {
    if (aborted) return;
    updateProgress(i + 1, tasks.length);
    const { answers, skipped } = await collectAnswers(tasks[i], i);
    if (aborted) return;

    if (skipped) {
      skippedCount++;
      await pause(120);
      addAiMsg('好的，跳过这条~ 继续下一条。');
      continue;
    }

    const loadingEl = addLoadingMsg('让我帮你改写一下…');
    const rp = rewriteBullet(
      tasks[i],
      tasks[i].questions.map((q, qi) => ({ question: q.text, answer: answers[qi] || '' }))
    )
      .then(newText => { loadingEl.replaceWith(buildResultCard(tasks[i], newText)); scrollBottom(); })
      .catch(() => { loadingEl.replaceWith(buildErrorBubble()); scrollBottom(); });
    pendingRewrites.push(rp);
    // Loop immediately continues to next task — rewrite runs in background
  }

  if (aborted) return;
  updateProgress(tasks.length, tasks.length);
  await pause(200);
  addAiMsg('问题都问完了 🎊 上面的优化版随时可以采用，也可以编辑后再采用~');

  await Promise.allSettled(pendingRewrites);
  if (aborted) return;
  await pause(300);
  addAiMsg(`这次共采用了 <strong>${acceptedCount}</strong> 条优化，加油！💪`);
  const close = await addActions([{ label: '完成，关闭', primary: true, value: true }]);
  if (close) closeGuide();
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
  showSkip(true);
  const skipPromise = new Promise(r => { resolveSkip = r; });

  for (let qi = 0; qi < task.questions.length; qi++) {
    if (aborted) { doCleanup(); return { answers, skipped: true }; }
    await pause(150);
    addAiMsg(esc(task.questions[qi].text));
    await pause(80);

    const q = task.questions[qi];
    let answer;

    if (q.format === 'boolean') {
      const r = await Promise.race([pickChoice(['是', '否'], false), skipPromise.then(() => SKIP)]);
      if (r === SKIP) { doCleanup(); return { answers, skipped: true }; }
      answer = r;
      addUserMsg(r);

    } else if (q.format === 'choice') {
      const r = await Promise.race([pickChoice(q.options, true), skipPromise.then(() => SKIP)]);
      if (r === SKIP) { doCleanup(); return { answers, skipped: true }; }
      answer = r;
      addUserMsg(r);

    } else {
      setInput(true, '用一两句话回答，没有就留空…');
      const r = await Promise.race([waitInput(), skipPromise.then(() => SKIP)]);
      setInput(false);
      if (r === SKIP) { doCleanup(); return { answers, skipped: true }; }
      answer = r; // user message already added in doSend
    }

    answers[qi] = answer;
  }

  showSkip(false);
  resolveSkip = null;
  return { answers, skipped: false };
}

function doCleanup() {
  cleanupPending();
  showSkip(false);
  resolveSkip = null;
  resolveInput = null;
}

function waitInput() {
  return new Promise(r => { resolveInput = r; });
}

function pickChoice(opts, hasOther) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'guide-msg choices';
    activeChoiceEl = el;

    const row = document.createElement('div');
    row.className = 'guide-choice-row';

    const finish = val => { activeChoiceEl = null; el.remove(); resolve(val); };

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
  });
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
  if (resolveInput) { const fn = resolveInput; resolveInput = null; fn(SKIP); }
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
