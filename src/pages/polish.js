import { navigate } from '../router.js';
import { getLibrary, getApiKey, updateLibraryItem } from '../services/storage.js';
import { createBullet } from '../data/resume-schema.js';
import { callDeepSeekStream } from '../services/deepseek.js';
import {
  POLISH_SYSTEM, buildLibraryContext, splitReply, visibleDuringStream
} from '../services/ai-polish.js';
import { createVoiceInput, isVoiceSupported } from '../services/voice-input.js';

let conversation = [];   // 多轮对话（含 AI 原始完整回复，便于上下文连贯）
let activePane = 'resume'; // 移动端 tab
let sending = false;

export function renderPolish(container) {
  conversation = [];
  activePane = 'resume';
  sending = false;

  container.innerHTML = `
    <div class="polish-page">
      <div class="polish-header">
        <button class="btn btn-ghost" id="polish-back">← 返回</button>
        <h2>AI 润色</h2>
        <div class="polish-pane-tabs">
          <button class="polish-tab active" data-pane="resume">原简历</button>
          <button class="polish-tab" data-pane="chat">AI 对话</button>
        </div>
      </div>

      <div class="polish-body">
        <div class="polish-col polish-col-resume" id="polish-col-resume">
          <div class="polish-col-head">📄 原简历（经历库）</div>
          <div class="polish-resume" id="polish-resume"></div>
        </div>
        <div class="polish-col polish-col-chat" id="polish-col-chat">
          <div class="polish-col-head">💬 和 AI 自由沟通</div>
          <div class="polish-messages" id="polish-messages"></div>
          <div class="polish-footer">
            <div class="polish-input-wrap">
              <textarea id="polish-input" class="polish-input" rows="1" placeholder="想怎么改、想补充什么，随便说…"></textarea>
              ${isVoiceSupported() ? `<button id="polish-voice" class="guide-voice-btn" title="语音输入">🎤</button>` : ''}
              <button id="polish-send" class="guide-send-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderResume();
  bindEvents(container);
  fitHeight(container);
  greet();

  if (!getApiKey()) {
    addAiMsg('👋 用之前，请先点右上角「设置 API Key」填入 DeepSeek 的 Key，我才能和你对话哦。');
  }
}

// 让双栏精确占满 header 以下的可视高度（header 高度随内容浮动，用 JS 取真实值）
function fitHeight(container) {
  const page = container.querySelector('.polish-page');
  if (!page) return;
  const apply = () => {
    const header = document.querySelector('.app-header');
    const h = header ? header.offsetHeight : 60;
    page.style.height = (window.innerHeight - h) + 'px';
  };
  apply();
  // 解绑上一次的监听，避免离开页面后仍触发
  if (window.__polishResize) window.removeEventListener('resize', window.__polishResize);
  window.__polishResize = apply;
  window.addEventListener('resize', apply);
}

// ── 左栏：经历库渲染 ──────────────────────────────────────────────

function renderResume() {
  const lib = getLibrary();
  const el = document.getElementById('polish-resume');
  if (!el) return;

  const blocks = [];

  if (lib.experiences.length) {
    blocks.push(section('工作经历', lib.experiences.map(e =>
      entryBlock('work', e, `${e.company || '（未填公司）'} · ${e.role || '（未填职位）'}`, dateRange(e.startDate, e.endDate))
    ).join('')));
  }
  if (lib.projects.length) {
    blocks.push(section('项目经历', lib.projects.map(p =>
      entryBlock('project', p, `${p.name || '（未填项目名）'} · ${p.role || ''}`, dateRange(p.startDate, p.endDate))
    ).join('')));
  }
  if (lib.education.length) {
    blocks.push(section('教育背景', lib.education.map(edu => `
      <div class="polish-entry readonly">
        <div class="polish-entry-title">${esc(edu.school || '')} · ${esc(edu.major || '')}</div>
        <div class="polish-entry-meta">${esc(edu.degree || '')} ${dateRange(edu.startDate, edu.endDate)}${edu.gpa ? ' · GPA ' + esc(edu.gpa) : ''}</div>
      </div>
    `).join('')));
  }
  if (lib.awards.length) {
    blocks.push(section('荣誉奖项', `<div class="polish-entry readonly"><ul class="polish-bullets">${
      lib.awards.map(a => `<li>${esc(a.title || '')}${a.date ? ' (' + esc(a.date) + ')' : ''}</li>`).join('')
    }</ul></div>`));
  }

  el.innerHTML = blocks.length
    ? blocks.join('')
    : '<p class="polish-empty">经历库还是空的，先去「经历库」添加或导入简历吧。</p>';
}

function section(title, inner) {
  return `<div class="polish-section"><h3 class="polish-section-title">${title}</h3>${inner}</div>`;
}

function entryBlock(type, item, title, meta) {
  const bullets = (item.bullets || []).map((b, idx) => {
    const cur = (b.useEnhanced && b.enhanced) ? b.enhanced : (b.original || '');
    const changed = b.useEnhanced && b.enhanced && b.original && b.enhanced !== b.original;
    return `
      <li class="polish-bullet ${changed ? 'changed' : ''}" data-ref="${type}:${item.id}#${idx}">
        <span class="polish-bullet-text">${esc(cur) || '<span class="polish-empty-bullet">（空）</span>'}</span>
        ${changed ? `<button class="polish-revert" data-type="${type}" data-id="${item.id}" data-idx="${idx}" title="撤销，恢复原文">↩︎</button>` : ''}
      </li>`;
  }).join('');
  return `
    <div class="polish-entry" data-item="${type}:${item.id}">
      <div class="polish-entry-title">${esc(title)}</div>
      ${meta ? `<div class="polish-entry-meta">${esc(meta)}</div>` : ''}
      <ul class="polish-bullets">${bullets || '<li class="polish-empty-bullet">（暂无描述）</li>'}</ul>
    </div>`;
}

// ── 事件 ──────────────────────────────────────────────────────────

function bindEvents(container) {
  container.querySelector('#polish-back').addEventListener('click', () => navigate('home'));

  container.querySelectorAll('.polish-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activePane = btn.dataset.pane;
      container.querySelectorAll('.polish-tab').forEach(b => b.classList.toggle('active', b === btn));
      container.querySelector('.polish-body').classList.toggle('show-chat', activePane === 'chat');
    });
  });

  const input = container.querySelector('#polish-input');
  const sendBtn = container.querySelector('#polish-send');
  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim() || sending;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  sendBtn.addEventListener('click', doSend);

  // 左栏：撤销改写
  container.querySelector('#polish-resume').addEventListener('click', e => {
    const btn = e.target.closest('.polish-revert');
    if (!btn) return;
    revert(btn.dataset.type, btn.dataset.id, parseInt(btn.dataset.idx, 10));
  });

  // 语音输入
  const voiceBtn = container.querySelector('#polish-voice');
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

function greet() {
  const lib = getLibrary();
  const count = lib.experiences.length + lib.projects.length;
  addAiMsg(
    `你好～我是你的简历顾问 ✨ 左边是你经历库里的全部内容（${count} 段经历）。<br>` +
    `想怎么改都行：可以让我「帮第一段补点量化数据」「这条太啰嗦了精简一下」「针对产品岗优化」，也可以先问问我的建议。<br>` +
    `我提出的修改会变成可点击的卡片，你点「采用」才会真正改到左边——放心，原文我都给你留着，随时能撤销。`
  );
}

// ── 发送 / 流式接收 ───────────────────────────────────────────────

async function doSend() {
  const input = document.getElementById('polish-input');
  const sendBtn = document.getElementById('polish-send');
  const val = input.value.trim();
  if (!val || sending) return;

  if (!getApiKey()) {
    addAiMsg('还没设置 API Key 呢，点右上角「设置 API Key」填一下吧。');
    return;
  }

  sending = true;
  addUserMsg(val);
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  conversation.push({ role: 'user', content: val });

  // 组装消息：system(角色) + system(经历库快照) + 历史
  const messages = [
    { role: 'system', content: POLISH_SYSTEM },
    { role: 'system', content: buildLibraryContext() },
    ...conversation.slice(-12)
  ];

  const bubble = addAiMsg('<span class="polish-cursor"></span>');
  const contentEl = bubble.querySelector('.guide-bubble');

  let full = '';
  try {
    full = await callDeepSeekStream(messages, { temperature: 0.7, maxTokens: 1400 }, delta => {
      const acc = (contentEl._raw || '') + delta;
      contentEl._raw = acc;
      contentEl.innerHTML = formatText(visibleDuringStream(acc)) + '<span class="polish-cursor"></span>';
      scrollBottom();
    });
  } catch (err) {
    contentEl.innerHTML = '😅 ' + esc(err.message || '出错了，请重试');
    sending = false;
    document.getElementById('polish-send').disabled = false;
    return;
  }

  conversation.push({ role: 'assistant', content: full });

  const { text, edits } = splitReply(full);
  contentEl.innerHTML = formatText(text) || '（已给出修改建议 👇）';

  if (edits.length) {
    for (const edit of edits) addEditCard(edit);
  }

  sending = false;
  document.getElementById('polish-send').disabled = false;
  scrollBottom();
}

// ── 修改卡片 / 采用 ──────────────────────────────────────────────

function addEditCard(edit) {
  const original = edit.action === 'rewrite' ? bulletOf(edit.ref) : '';
  const targetTitle = entryTitleOf(edit.action === 'rewrite' ? edit.ref.split('#')[0] : edit.itemRef);

  const el = document.createElement('div');
  el.className = 'guide-msg result';
  el.innerHTML = `
    <div class="guide-result-card">
      <div class="polish-card-target">${edit.action === 'add' ? '➕ 新增到' : '✏️ 修改'} · ${esc(targetTitle)}</div>
      ${edit.action === 'rewrite' ? `
      <div class="guide-result-row">
        <span class="guide-result-label">原来</span>
        <div class="guide-result-original">${esc(original)}</div>
      </div>` : ''}
      <div class="guide-result-row">
        <span class="guide-result-label accent">${edit.action === 'add' ? '新增' : '优化后'}</span>
        <textarea class="guide-result-edit" rows="2">${esc(edit.newText)}</textarea>
      </div>
      <div class="guide-result-actions">
        <button class="btn btn-ghost btn-sm" data-ignore>忽略</button>
        <button class="btn btn-primary btn-sm" data-accept>采用 ✓</button>
      </div>
    </div>
  `;

  el.querySelector('[data-accept]').addEventListener('click', () => {
    const txt = el.querySelector('.guide-result-edit').value.trim();
    if (txt) applyEdit(edit, txt);
    el.querySelector('.guide-result-actions').innerHTML = '<span class="guide-adopted">✅ 已采用</span>';
  });
  el.querySelector('[data-ignore]').addEventListener('click', () => {
    el.querySelector('.guide-result-actions').innerHTML = '<span class="guide-adopted muted">— 已忽略</span>';
  });

  document.getElementById('polish-messages').appendChild(el);
  scrollBottom();
}

function applyEdit(edit, text) {
  const lib = getLibrary();
  if (edit.action === 'rewrite') {
    const { type, id, idx } = parseRef(edit.ref);
    const item = findItem(lib, type, id);
    if (!item || !item.bullets?.[idx]) return;
    const b = item.bullets[idx];
    if (!b.original) b.original = (b.useEnhanced && b.enhanced) ? b.enhanced : (b.original || '');
    b.enhanced = text;
    b.useEnhanced = true;
    updateLibraryItem(type, id, { bullets: item.bullets });
  } else {
    const { type, id } = parseItemRef(edit.itemRef);
    const item = findItem(lib, type, id);
    if (!item) return;
    const nb = createBullet();
    nb.original = text;
    nb.enhanced = text;
    nb.useEnhanced = true;
    item.bullets = [...(item.bullets || []), nb];
    updateLibraryItem(type, id, { bullets: item.bullets });
  }
  renderResume();
  flashRef(edit.action === 'rewrite' ? edit.ref : `${edit.itemRef}#last`);
}

function revert(type, id, idx) {
  const lib = getLibrary();
  const item = findItem(lib, type, id);
  if (!item || !item.bullets?.[idx]) return;
  item.bullets[idx].useEnhanced = false;
  updateLibraryItem(type, id, { bullets: item.bullets });
  renderResume();
}

// ── ref / 查找辅助 ────────────────────────────────────────────────

function parseRef(ref) {
  const [head, idxStr] = ref.split('#');
  const [type, id] = head.split(':');
  return { type, id, idx: parseInt(idxStr, 10) };
}
function parseItemRef(itemRef) {
  const [type, id] = itemRef.split(':');
  return { type, id };
}
function findItem(lib, type, id) {
  const arr = type === 'work' ? lib.experiences : lib.projects;
  return (arr || []).find(i => i.id === id) || null;
}
function bulletOf(ref) {
  const lib = getLibrary();
  const { type, id, idx } = parseRef(ref);
  const item = findItem(lib, type, id);
  const b = item?.bullets?.[idx];
  if (!b) return '';
  return (b.useEnhanced && b.enhanced) ? b.enhanced : (b.original || '');
}
function entryTitleOf(headOrItemRef) {
  const lib = getLibrary();
  const { type, id } = parseItemRef(headOrItemRef);
  const item = findItem(lib, type, id);
  if (!item) return '';
  return type === 'work' ? `${item.company || ''} · ${item.role || ''}` : `${item.name || ''} · ${item.role || ''}`;
}

function flashRef(ref) {
  if (ref.endsWith('#last')) {
    const itemEl = document.querySelector(`.polish-entry[data-item="${ref.replace('#last', '')}"]`);
    const li = itemEl?.querySelector('.polish-bullet:last-child');
    if (li) pulse(li);
    return;
  }
  const li = document.querySelector(`.polish-bullet[data-ref="${ref}"]`);
  if (li) pulse(li);
}
function pulse(el) {
  el.classList.add('polish-flash');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => el.classList.remove('polish-flash'), 1600);
}

// ── 消息气泡 ──────────────────────────────────────────────────────

function addAiMsg(html) {
  const el = document.createElement('div');
  el.className = 'guide-msg ai';
  el.innerHTML = `<div class="guide-bubble">${html}</div>`;
  document.getElementById('polish-messages').appendChild(el);
  scrollBottom();
  return el;
}
function addUserMsg(text) {
  const el = document.createElement('div');
  el.className = 'guide-msg user';
  el.innerHTML = `<div class="guide-bubble user">${esc(text)}</div>`;
  document.getElementById('polish-messages').appendChild(el);
  scrollBottom();
  return el;
}

function scrollBottom() {
  const m = document.getElementById('polish-messages');
  if (m) requestAnimationFrame(() => { m.scrollTop = m.scrollHeight; });
}

// ── 工具 ──────────────────────────────────────────────────────────

function dateRange(s, e) {
  if (!s && !e) return '';
  return `${s || ''}${(s || e) ? ' - ' : ''}${e || '至今'}`;
}
function formatText(text) {
  return esc(text).replace(/\n/g, '<br>');
}
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
