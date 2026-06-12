import { getApiKey } from './storage.js';

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

  const res = await fetch('/api/deepseek/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 调用失败: ${res.status} ${err}`);
  }

  const json = await res.json();
  const choice = json.choices[0];
  if (choice.finish_reason === 'length') {
    throw new Error('内容过长被截断，请减少一次导入的内容，或分多次导入');
  }
  return choice.message.content;
}
