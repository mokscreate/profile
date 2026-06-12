// 浏览器语音输入（Web Speech API）。Chrome / Edge 支持，中文 zh-CN。
// 用法：const v = createVoiceInput({ onText, onState, onError }); v.start(); v.stop();

export function isVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createVoiceInput({ onText, onState, onError } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    return { start() { onError?.('当前浏览器不支持语音输入，请用 Chrome 或 Edge'); }, stop() {}, supported: false };
  }

  const rec = new SR();
  rec.lang = 'zh-CN';
  rec.continuous = true;
  rec.interimResults = true;

  let listening = false;
  let finalText = '';

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interim += t;
    }
    onText?.(finalText, interim);
  };

  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    if (e.error === 'not-allowed') onError?.('麦克风权限被拒绝，请在浏览器允许后重试');
    else onError?.('语音识别出错：' + e.error);
  };

  rec.onend = () => {
    // continuous 模式下若仍在听则自动重启（部分浏览器会主动结束）
    if (listening) {
      try { rec.start(); } catch { /* 忽略重复启动 */ }
    } else {
      onState?.(false);
    }
  };

  return {
    supported: true,
    start() {
      if (listening) return;
      finalText = '';
      listening = true;
      try { rec.start(); onState?.(true); }
      catch (err) { listening = false; onError?.('无法启动语音：' + err.message); }
    },
    stop() {
      listening = false;
      try { rec.stop(); } catch { /* noop */ }
      onState?.(false);
    }
  };
}
