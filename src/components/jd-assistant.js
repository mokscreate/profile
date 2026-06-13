import { callDeepSeekStream } from '../services/deepseek.js';
import { getApiKey } from '../services/storage.js';
import { JD_SYSTEM, ANALYSIS_INSTRUCTION, jdContextMessage } from '../services/ai-jd.js';
import { createVoiceInput, isVoiceSupported } from '../services/voice-input.js';

const SEND_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/></svg>`;

/**
 * 在编辑器 JD 区挂载一个「AI 匹配分析」助手。
 * @param {HTMLElement} panel  分析结果与追问输入的容器（JD textarea 下方）
 * @param {object} resume      当前简历对象（实时读取 jd / 选中经历）
 * @param {HTMLElement} triggerBtn 触发分析的按钮
 */
export function initJdAssistant(panel, resume, triggerBtn) {
  if (!panel || !triggerBtn) return;

  let conversation = [];
  let sending = false;
  let mounted = false;

  triggerBtn.addEventListener('click', () => {
    if (!(resume.jd || '').trim()) { alert('请先在上方粘贴目标岗位的 JD'); return; }
    if (!getApiKey()) { alert('请先在右上角「设置 API Key」填入 DeepSeek Key'); return; }
    if (sending) return;
    if (!mounted) { mount(); mounted = true; }
    runAnalysis();
  });

  function mount() {
    panel.innerHTML = `
      <div class="jd-ai">
        <div class="jd-ai-messages" id="jd-ai-messages"></div>
        <div class="jd-ai-input-wrap">
          <textarea id="jd-ai-input" class="jd-ai-input" rows="1" placeholder="追问，比如：我该突出哪段经历？"></textarea>
          ${isVoiceSupported() ? `<button id="jd-ai-voice" class="guide-voice-btn" title="语音输入">🎤</button>` : ''}
          <button id="jd-ai-send" class="guide-send-btn" disabled>${SEND_SVG}</button>
        </div>
      </div>
    `;
    wireInput();
  }

  function wireInput() {
    const input = panel.querySelector('#jd-ai-input');
    const sendBtn = panel.querySelector('#jd-ai-send');
    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim() || sending;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    sendBtn.addEventListener('click', send);

    const voiceBtn = panel.querySelector('#jd-ai-voice');
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

  async function runAnalysis() {
    conversation = [];
    const msgs = panel.querySelector('#jd-ai-messages');
    msgs.innerHTML = '';
    const messages = [JD_SYSTEM_MSG(), jdContextMessage(resume), { role: 'user', content: ANALYSIS_INSTRUCTION }];
    const full = await streamInto(messages, '正在对照 JD 分析你的简历…');
    if (full != null) {
      conversation.push({ role: 'user', content: ANALYSIS_INSTRUCTION });
      conversation.push({ role: 'assistant', content: full });
    }
  }

  async function send() {
    const input = panel.querySelector('#jd-ai-input');
    const text = input.value.trim();
    if (!text || sending) return;
    addUser(text);
    input.value = '';
    input.style.height = 'auto';
    panel.querySelector('#jd-ai-send').disabled = true;

    const messages = [JD_SYSTEM_MSG(), jdContextMessage(resume), ...conversation.slice(-10), { role: 'user', content: text }];
    const full = await streamInto(messages, '');
    if (full != null) {
      conversation.push({ role: 'user', content: text });
      conversation.push({ role: 'assistant', content: full });
    }
  }

  // 流式渲染一条 AI 气泡，返回完整文本；出错返回 null
  async function streamInto(messages, loadingHint) {
    sending = true;
    const sendBtn = panel.querySelector('#jd-ai-send');
    if (sendBtn) sendBtn.disabled = true;

    const bubble = addAi('<span class="jd-ai-cursor"></span>');
    const contentEl = bubble.querySelector('.guide-bubble');
    if (loadingHint) contentEl.innerHTML = `<span class="jd-ai-dim">${esc(loadingHint)}</span><span class="jd-ai-cursor"></span>`;

    let full = '';
    contentEl._raw = '';
    try {
      full = await callDeepSeekStream(messages, { temperature: 0.6, maxTokens: 1400 }, delta => {
        contentEl._raw += delta;
        contentEl.innerHTML = format(contentEl._raw) + '<span class="jd-ai-cursor"></span>';
        scrollBottom();
      });
    } catch (err) {
      contentEl.innerHTML = '😅 ' + esc(err.message || '分析失败，请重试');
      sending = false;
      refreshSendBtn();
      return null;
    }
    contentEl.innerHTML = format(full);
    sending = false;
    refreshSendBtn();
    scrollBottom();
    return full;
  }

  function refreshSendBtn() {
    const input = panel.querySelector('#jd-ai-input');
    const sendBtn = panel.querySelector('#jd-ai-send');
    if (input && sendBtn) sendBtn.disabled = !input.value.trim() || sending;
  }

  function addAi(html) {
    const el = document.createElement('div');
    el.className = 'guide-msg ai';
    el.innerHTML = `<div class="guide-bubble">${html}</div>`;
    panel.querySelector('#jd-ai-messages').appendChild(el);
    scrollBottom();
    return el;
  }
  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'guide-msg user';
    el.innerHTML = `<div class="guide-bubble user">${esc(text)}</div>`;
    panel.querySelector('#jd-ai-messages').appendChild(el);
    scrollBottom();
    return el;
  }
  function scrollBottom() {
    const m = panel.querySelector('#jd-ai-messages');
    if (m) requestAnimationFrame(() => { m.scrollTop = m.scrollHeight; });
  }
}

function JD_SYSTEM_MSG() {
  return { role: 'system', content: JD_SYSTEM };
}

function format(text) {
  return esc(text).replace(/\n/g, '<br>');
}
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
