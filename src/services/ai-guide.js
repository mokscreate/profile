import { callDeepSeek } from './deepseek.js';
import { getLibrary } from './storage.js';

// 一次发送给 AI 分析的最大 bullet 条数，避免请求过大被截断
const MAX_BULLETS = 40;

const ANALYSIS_SYSTEM = `你是一位资深简历顾问，精通两条核心原则：
1. STAR 法则：一条好的经历描述应交代 情境(Situation)、任务(Task)、行动(Action)、结果(Result)，其中"你的具体行动"和"可衡量的结果"最关键。
2. 数据量化：尽量用具体数字、百分比、规模、时长来支撑成果（如"提升转化率 18%""服务 5000+ 用户""3 个月内"）。

你的任务：逐条审阅求职者经历库中的描述，找出不符合 STAR、缺乏量化或表述空泛的地方，并为每条设计有针对性的追问，引导用户补全信息。追问要友好、具体、口语化，一次只问一个清晰的点。`;

const REWRITE_SYSTEM = `你是一位资深简历顾问。你的任务是在原始描述的基础上补充和强化，绝对不能删除原文中提到的任何工具、技术、平台、方法或具体细节。
改写原则：
1. 保留原文所有实质性内容（工具名、技术栈、平台名、操作方法等），只允许增加信息、调整语序、优化措辞。
2. 把用户补充的量化数据和上下文信息融入原文，不要替换原文已有的具体内容。
3. 动词开头；体现"做了什么 + 带来什么结果"；15-60 个中文字；专业简洁，不口语化。
4. 若用户未提供额外信息，保持原文主要内容不变，仅在措辞层面做最小幅度的专业化调整。`;

// 收集经历库中带有有效描述的工作/项目条目，构造带稳定地址的纯文本，供 AI 分析
function collectEntries() {
  const library = getLibrary();
  const entries = [
    ...library.experiences.map(e => ({
      itemType: 'work', id: e.id,
      title: `${e.company || '（未填公司）'} · ${e.role || '（未填职位）'}`,
      bullets: e.bullets || []
    })),
    ...library.projects.map(p => ({
      itemType: 'project', id: p.id,
      title: `${p.name || '（未填项目名）'} · ${p.role || '（未填角色）'}`,
      bullets: p.bullets || []
    }))
  ];
  return entries;
}

function bulletText(b) {
  return ((b.useEnhanced && b.enhanced) ? b.enhanced : b.original || '').trim();
}

/**
 * 全面分析经历库，返回点对点完善任务队列。
 * @returns {{ summary: string, tasks: Array, truncated: boolean }}
 *   每个 task: { ref, itemType, itemId, bulletIndex, bulletText, issues:[], questions:[{format, text, options?}] }
 */
export async function analyzeLibrary() {
  const entries = collectEntries();

  // 展开成 (entry, bulletIndex) 列表，过滤空描述，并按上限截断
  const addressed = [];
  for (const entry of entries) {
    entry.bullets.forEach((b, idx) => {
      const text = bulletText(b);
      if (text) addressed.push({ entry, idx, text });
    });
  }
  if (!addressed.length) {
    return { summary: '', tasks: [], truncated: false };
  }
  const truncated = addressed.length > MAX_BULLETS;
  const used = addressed.slice(0, MAX_BULLETS);

  // 按条目分组渲染，编号格式 itemId#bulletIndex
  const byEntry = new Map();
  for (const a of used) {
    if (!byEntry.has(a.entry)) byEntry.set(a.entry, []);
    byEntry.get(a.entry).push(a);
  }
  let block = '';
  for (const [entry, list] of byEntry) {
    const label = entry.itemType === 'work' ? '工作' : '项目';
    block += `【${label}】${entry.title}\n`;
    for (const a of list) {
      block += `  [${entry.id}#${a.idx}] ${a.text}\n`;
    }
    block += '\n';
  }

  const prompt = `以下是求职者经历库中的描述，每条都带有唯一编号 [itemId#index]：

${block}
请逐条分析，挑出"需要完善"的描述（已经写得很好、含明确量化结果的可以跳过）。为每条需要完善的描述设计 1-3 个追问，引导用户补全信息。

每个追问必须是以下三种形式之一，并根据问题性质选择最合适的一种：
- "open"：开放式问题，让用户自由填写（适合挖掘量化数据、具体成果）。
- "choice"：给出 3-4 个选项让用户选择（适合界定角色、方向、类型；选项要互斥、覆盖常见情况，可含"其他"）。
- "boolean"：是非题，让用户回答是或否（适合确认某个事实，如"是否带领团队"）。

只返回 JSON，不要任何额外文字。格式：
{
  "summary": "对整体经历库的一句话点评（指出最普遍的问题，如多数描述缺少量化结果）",
  "tasks": [
    {
      "ref": "exp_xxx#0",
      "issues": ["缺少量化结果", "未体现你的具体行动"],
      "questions": [
        { "format": "open", "text": "这段工作带来了哪些可量化的成果？比如指标提升、用户量、节省的时间或成本？" },
        { "format": "choice", "text": "你在其中主要承担什么角色？", "options": ["独立主导", "核心成员", "参与协作", "辅助支持"] },
        { "format": "boolean", "text": "这段经历是否涉及带领或协调团队？" }
      ]
    }
  ]
}

要求：
1. ref 必须严格使用上面给出的编号，不要编造。
2. issues 用简短中文标签描述问题所在（对照 STAR 与量化原则）。
3. 每条至少包含 1 个 open 类型的问题；优先围绕"可量化的结果"提问。
4. 最多分析 ${used.length} 条，按"最需要完善"的优先排序。`;

  const response = await callDeepSeek([
    { role: 'system', content: ANALYSIS_SYSTEM },
    { role: 'user', content: prompt }
  ], { jsonMode: true, maxTokens: 4000, temperature: 0.4 });

  const parsed = parseJson(response);
  const validRefs = new Map(used.map(a => [`${a.entry.id}#${a.idx}`, a]));

  const tasks = (parsed.tasks || [])
    .map(t => {
      const addr = validRefs.get(t.ref);
      if (!addr) return null;
      const questions = (t.questions || [])
        .filter(q => q && q.text && ['open', 'choice', 'boolean'].includes(q.format))
        .map(q => ({
          format: q.format,
          text: String(q.text),
          options: q.format === 'choice' && Array.isArray(q.options) ? q.options.map(String).filter(Boolean) : undefined
        }))
        .filter(q => q.format !== 'choice' || (q.options && q.options.length >= 2));
      if (!questions.length) return null;
      return {
        ref: t.ref,
        itemType: addr.entry.itemType,
        itemId: addr.entry.id,
        bulletIndex: addr.idx,
        entryTitle: addr.entry.title,
        bulletText: addr.text,
        issues: Array.isArray(t.issues) ? t.issues.map(String).slice(0, 4) : [],
        questions
      };
    })
    .filter(Boolean);

  return { summary: parsed.summary || '', tasks, truncated };
}

/**
 * 根据用户对追问的回答，重写一条 bullet。
 * @param {object} task 来自 analyzeLibrary 的任务
 * @param {Array<{question:string, answer:string}>} answers 已回答的问答对
 * @param {string[]} freeform 当前条目问答结束后用户补充的内容
 * @param {string[]} globalContext 开始前用户一次性倾倒的背景信息（跨条目）
 * @returns {string} 改写后的文本
 */
export async function rewriteBullet(task, answers, freeform = [], globalContext = []) {
  const qa = answers
    .filter(a => a.answer && a.answer.trim())
    .map(a => `问：${a.question}\n答：${a.answer.trim()}`)
    .join('\n');

  const globalText = globalContext.filter(f => f && f.trim()).length
    ? '\n\n【用户提前补充的背景信息（从中提取与本条相关的内容使用，不相关的忽略）】\n当前条目：' + task.entryTitle + '\n' + globalContext.filter(f => f.trim()).map(f => `- ${f}`).join('\n')
    : '';

  const freeformText = freeform.filter(f => f && f.trim()).length
    ? '\n\n【用户针对本条的补充（优先处理，必须融入）】\n' + freeform.filter(f => f.trim()).map(f => `- ${f}`).join('\n')
    : '';

  const prompt = `原始描述：${task.bulletText}
条目：${task.entryTitle}

这条描述可以补充的方向：${task.issues.join('、') || '可以更专业'}

用户对追问的回答：
${qa || '（用户未提供）'}${globalText}${freeformText}

请在保留原文所有工具、技术、平台、方法等具体细节的前提下，把用户补充的信息融入原文，强化 STAR 要素和量化结果。
严禁删除原文中已提到的任何具体名词（工具名、技术名、平台名等）。
只输出优化后的一条文本，不要编号、引号或任何解释。`;

  const response = await callDeepSeek([
    { role: 'system', content: REWRITE_SYSTEM },
    { role: 'user', content: prompt }
  ], { maxTokens: 400, temperature: 0.6 });

  return response.trim().replace(/^["“”]|["“”]$/g, '').trim();
}

/**
 * 对用户补充的内容给出简短的 AI 确认回复（聊天式）。
 */
export async function acknowledgeInput(text) {
  const response = await callDeepSeek([
    { role: 'system', content: '你是一位轻松友好的简历顾问，正在和用户聊天式地完善简历。用户刚补充了一些背景信息，请用1-2句话确认你理解了，语气像朋友聊天一样自然，点出1-2个你会用到的关键信息即可，不要列举所有内容。30字以内，不要加任何标点符号结尾以外的符号。' },
    { role: 'user', content: text }
  ], { maxTokens: 80, temperature: 0.8 });
  return response.trim();
}


function parseJson(response) {
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试截取第一个 { 到最后一个 }
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { /* fall through */ }
    }
    throw new Error('AI 返回的内容无法解析，请重试');
  }
}
