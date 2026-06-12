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
