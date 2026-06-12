export const SYSTEM_PROMPT = `你是一个专业的简历优化助手。你的任务是帮助用户将工作/项目经历描述优化为更具影响力的简历bullet point。

规则：
1. 首先分析用户的描述，找出可以量化或具体化的地方
2. 提出1-2个简短的追问（不超过2个问题）
3. 根据用户的回答，重写bullet point
4. 重写时遵循STAR法则（情境-任务-行动-结果）
5. 优先使用数据量化结果
6. 使用动词开头（主导、设计、优化、推动、搭建等）
7. 保持每条bullet在15-50个中文字之间
8. 语言风格：专业简洁，避免口语化`;

export function buildFollowUpPrompt(bullet, context) {
  return `用户的岗位：${context.role || '未填写'}
用户的公司/项目：${context.company || context.name || '未填写'}
用户写的经历描述：${bullet}

请分析这段描述，提出1-2个追问来帮助用户补充可量化、可具体化的信息。
追问要具体、友好、简短，用中文。
直接输出问题，每个问题一行，不要编号或多余格式。`;
}

export function buildRewritePrompt(bullet, conversation, context) {
  const qa = conversation
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'assistant' ? 'AI' : '用户'}: ${m.content}`)
    .join('\n');

  return `用户的岗位：${context.role || '未填写'}
用户的公司/项目：${context.company || context.name || '未填写'}
原始描述：${bullet}

对话记录：
${qa}

请根据以上信息，重写这段经历为一条专业的简历bullet point。
要求：动词开头，包含量化数据（如有），15-50字，专业简洁。
只输出重写后的一条文本，不要任何解释或前缀。`;
}
