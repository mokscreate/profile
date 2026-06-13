import { getApiKey } from './storage.js';

// 开发环境走 Vite 代理（避免跨域）；生产环境直连 DeepSeek（api.deepseek.com 国内可直接访问）
const API_URL = import.meta.env.DEV
  ? '/api/deepseek/chat/completions'
  : 'https://api.deepseek.com/chat/completions';

export async function callDeepSeek(messages, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('请先设置 DeepSeek API Key');
  }

  const body = {
    model: 'deepseek-chat',
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 800
  };
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error('网络请求失败，可能是浏览器跨域限制。如果你在自部署站点遇到此问题，请联系管理员配置代理。');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API 调用失败: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const choice = json.choices[0];
  if (choice.finish_reason === 'length') {
    throw new Error('内容过长被截断，请减少一次导入的内容，或分多次导入');
  }
  return choice.message.content;
}

/**
 * 流式调用 DeepSeek（像网页版一样逐字返回）。
 * @param {Array} messages 对话消息
 * @param {object} options { temperature, maxTokens }
 * @param {(deltaText:string)=>void} onToken 每收到一段增量文本时回调
 * @returns {Promise<string>} 累计的完整文本
 */
export async function callDeepSeekStream(messages, options = {}, onToken) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('请先设置 DeepSeek API Key');
  }

  const body = {
    model: 'deepseek-chat',
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1200,
    stream: true
  };

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error('网络请求失败，可能是浏览器跨域限制。如果你在自部署站点遇到此问题，请联系管理员配置代理。');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API 调用失败: ${res.status} ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let full = '';
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按行处理 SSE：每条以 \n 分隔，data: 开头
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 末尾可能是半行，留到下次

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          if (onToken) onToken(delta);
        }
      } catch {
        // 半个 JSON 或心跳行，忽略
      }
    }
  }

  if (!full.trim()) {
    throw new Error('AI 没有返回内容，请重试');
  }
  return full;
}
