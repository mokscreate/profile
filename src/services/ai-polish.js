import { getLibrary } from './storage.js';

export const POLISH_SYSTEM = `你是一位资深简历顾问，正在和求职者像朋友聊天一样自由地讨论、打磨简历。

对话风格：
- 自然、口语、有来有回，可以追问、给建议、解释思路，不要套用固定模板或机械问答。
- 用户问什么答什么，可以天马行空，你要优先回应用户当下关心的点。

改写底线（极其重要）：
- 只增不删：绝不能删除原文里已有的任何工具名、技术栈、平台名、操作方法或具体细节，只允许增加信息、调整语序、优化措辞。
- 把用户补充的量化数据和背景融入原文，不要替换原文已有的具体内容。
- 每条 bullet 动词开头，体现"做了什么 + 带来什么结果"，15-60 个中文字，专业简洁不口语化。

如何提交修改：
- 当且仅当你想具体修改/新增某条 bullet 时，在你这条回复的【最末尾】附上一个 JSON 代码块（用户看不到这段 JSON，会被渲染成可点击的"采用"卡片）。
- 格式严格如下，ref 必须使用我在下文给你的编号，不要编造：
\`\`\`json
{"edits":[{"action":"rewrite","ref":"work:exp_x#0","newText":"改写后的整条文本"},{"action":"add","itemRef":"project:proj_y","newText":"新增的一条 bullet"}]}
\`\`\`
- action 只有 "rewrite"（改写已有条目，需 ref）和 "add"（给某段经历新增一条，需 itemRef）两种。
- 如果这一轮只是聊天、答疑、给方向，没有具体要落地的改写，就【不要】输出 JSON 块。
- JSON 块之前的正文照常自然说话，正文里不要重复粘贴 JSON 内容。`;

// 收集经历库中带 ref 的工作/项目，渲染成喂给 AI 的上下文文本
export function buildLibraryContext() {
  const lib = getLibrary();
  const lines = ['这是该求职者经历库的当前内容，每条 bullet 都带唯一编号 [ref]，你改写时引用这些编号：', ''];

  if (lib.experiences.length) {
    lines.push('## 工作经历');
    for (const e of lib.experiences) {
      lines.push(`【${e.company || '（未填公司）'} · ${e.role || '（未填职位）'}】 itemRef=work:${e.id}`);
      (e.bullets || []).forEach((b, idx) => {
        lines.push(`  [work:${e.id}#${idx}] ${bulletText(b)}`);
      });
      lines.push('');
    }
  }

  if (lib.projects.length) {
    lines.push('## 项目经历');
    for (const p of lib.projects) {
      const tech = (p.techStack || []).length ? `（技术栈：${p.techStack.join('、')}）` : '';
      lines.push(`【${p.name || '（未填项目名）'} · ${p.role || ''}】${tech} itemRef=project:${p.id}`);
      (p.bullets || []).forEach((b, idx) => {
        lines.push(`  [project:${p.id}#${idx}] ${bulletText(b)}`);
      });
      lines.push('');
    }
  }

  // 教育/奖项作为只读背景
  if (lib.education.length) {
    lines.push('## 教育背景（只读背景，不要改写）');
    for (const edu of lib.education) {
      lines.push(`  - ${edu.school || ''} ${edu.major || ''} ${edu.degree || ''}`.trim());
    }
    lines.push('');
  }
  if (lib.awards.length) {
    lines.push('## 荣誉奖项（只读背景，不要改写）');
    for (const a of lib.awards) {
      lines.push(`  - ${a.title || ''}`.trim());
    }
    lines.push('');
  }

  return lines.join('\n');
}

// 当前所有合法的 bullet ref 与 item ref，用于校验 AI 返回的编号
export function knownRefs() {
  const lib = getLibrary();
  const bulletRefs = new Set();
  const itemRefs = new Set();
  lib.experiences.forEach(e => {
    itemRefs.add(`work:${e.id}`);
    (e.bullets || []).forEach((_, idx) => bulletRefs.add(`work:${e.id}#${idx}`));
  });
  lib.projects.forEach(p => {
    itemRefs.add(`project:${p.id}`);
    (p.bullets || []).forEach((_, idx) => bulletRefs.add(`project:${p.id}#${idx}`));
  });
  return { bulletRefs, itemRefs };
}

/**
 * 把 AI 完整回复拆成「可见正文」+「edits 数组」。
 * 末尾的 ```json 代码块``` 会被解析并从正文里剥离；非法 ref 丢弃。
 * @returns {{ text: string, edits: Array }}
 */
export function splitReply(fullText) {
  const { bulletRefs, itemRefs } = knownRefs();
  let text = fullText;
  let edits = [];

  // 抓取最后一个 ```json ... ``` 代码块
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match, last = null;
  while ((match = fenceRe.exec(fullText)) !== null) last = match;

  if (last) {
    const jsonStr = last[1].trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.edits)) {
        edits = parsed.edits
          .filter(e => e && e.newText && String(e.newText).trim())
          .map(e => ({
            action: e.action === 'add' ? 'add' : 'rewrite',
            ref: e.ref ? String(e.ref) : '',
            itemRef: e.itemRef ? String(e.itemRef) : '',
            newText: String(e.newText).trim()
          }))
          .filter(e =>
            e.action === 'rewrite' ? bulletRefs.has(e.ref) : itemRefs.has(e.itemRef)
          );
        // 只有成功解析出 JSON 才从正文里剥离这个代码块
        text = fullText.slice(0, last.index).trim();
      }
    } catch {
      // 不是合法 edits JSON，正文原样保留
    }
  }

  return { text: text.trim(), edits };
}

// 流式过程中用于显示的可见部分：一旦出现 ``` 围栏（JSON 块开始），就只显示它之前的正文
export function visibleDuringStream(text) {
  const i = text.indexOf('```');
  return (i >= 0 ? text.slice(0, i) : text).trim();
}

function bulletText(b) {
  return ((b.useEnhanced && b.enhanced) ? b.enhanced : b.original || '').trim();
}
