import { getLibrary } from './storage.js';

export const JD_SYSTEM = `你是一位资深招聘顾问 + 简历教练。求职者会给你一段目标岗位的 JD 和他当前的简历内容，你帮他判断匹配度并给出可执行建议。

风格：中文，分点清晰，直接说重点，可以追问、可以解释，像一个懂行的朋友帮他看简历，别说空话套话。

底线：你只做分析和建议，不要替他改写经历，更不能编造他没有的经历或数据；JD 要求但他简历里没有的，就如实指出，让他自己判断要不要补。`;

export const ANALYSIS_INSTRUCTION = `请基于上面的 JD 和我的简历内容，做一次匹配分析，分四部分：
1. 匹配度概览（一句话判断 + 大致匹配程度，如"较匹配/部分匹配/差距较大"）
2. 已匹配的亮点（JD 要求里我已经具备并在简历中体现出来的）
3. 待补强 / 缺失（JD 强调、但我简历没体现或较弱的关键词、技能、经历方向）
4. 优化建议（具体说：该突出哪几段经历、补哪些量化数据、加哪些关键词；不要替我编造经历）`;

// 当前简历内容快照：优先用已选条目，没选则回退到整库，便于尽早可用
export function buildResumeSnapshot(resume) {
  const lib = getLibrary();
  const expIds = resume.selectedExperiences || [];
  const projIds = resume.selectedProjects || [];
  const exps = expIds.length
    ? expIds.map(id => lib.experiences.find(e => e.id === id)).filter(Boolean)
    : lib.experiences;
  const projs = projIds.length
    ? projIds.map(id => lib.projects.find(p => p.id === id)).filter(Boolean)
    : lib.projects;

  const lines = [];
  const skills = resume.skills || {};
  const skillParts = [
    skills.technical?.length ? '技术：' + skills.technical.join('、') : '',
    skills.tools?.length ? '工具：' + skills.tools.join('、') : '',
    skills.languages?.length ? '语言：' + skills.languages.join('、') : ''
  ].filter(Boolean);
  if (skillParts.length) lines.push('【技能】' + skillParts.join('；'));

  if (exps.length) {
    lines.push('【工作经历】');
    for (const e of exps) {
      lines.push(`- ${e.company || ''} · ${e.role || ''}`);
      for (const b of e.bullets || []) {
        const t = bulletText(b);
        if (t) lines.push(`  · ${t}`);
      }
    }
  }
  if (projs.length) {
    lines.push('【项目经历】');
    for (const p of projs) {
      const tech = (p.techStack || []).length ? `（技术栈：${p.techStack.join('、')}）` : '';
      lines.push(`- ${p.name || ''} · ${p.role || ''}${tech}`);
      for (const b of p.bullets || []) {
        const t = bulletText(b);
        if (t) lines.push(`  · ${t}`);
      }
    }
  }

  return lines.join('\n') || '（简历内容为空）';
}

// JD + 简历内容打包成一条 system 上下文，随每次调用发送，保证追问也有依据
export function jdContextMessage(resume) {
  const jd = (resume.jd || '').trim() || '（未填写 JD）';
  const snapshot = buildResumeSnapshot(resume);
  return {
    role: 'system',
    content: `这是本次分析的依据：

【目标岗位】${resume.targetRole || '（未填）'}

【JD（目标职位描述）】
${jd}

【求职者当前简历内容】
${snapshot}`
  };
}

function bulletText(b) {
  return ((b.useEnhanced && b.enhanced) ? b.enhanced : b.original || '').trim();
}
