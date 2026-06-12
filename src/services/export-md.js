export function libraryToMarkdown(profile, library) {
  const lines = [];

  lines.push(`# 个人经历库`);
  lines.push('');
  lines.push('## 基本信息');
  if (profile.name) lines.push(`- 姓名：${profile.name}`);
  if (profile.phone) lines.push(`- 电话：${profile.phone}`);
  if (profile.email) lines.push(`- 邮箱：${profile.email}`);
  if (profile.location) lines.push(`- 所在地：${profile.location}`);
  lines.push('');

  if (library.experiences.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 工作经历');
    lines.push('');
    for (const exp of library.experiences) {
      lines.push(`### ${exp.company} · ${exp.role}`);
      lines.push(`**${exp.startDate} - ${exp.endDate}**${exp.tags.length ? ' | ' + exp.tags.join(', ') : ''}`);
      lines.push('');
      for (const b of exp.bullets || []) {
        lines.push(`- ${b.useEnhanced && b.enhanced ? b.enhanced : b.original}`);
      }
      lines.push('');
    }
  }

  if (library.projects.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 项目经历');
    lines.push('');
    for (const proj of library.projects) {
      lines.push(`### ${proj.name} · ${proj.role}`);
      const dateStr = proj.startDate ? `**${proj.startDate} - ${proj.endDate || '至今'}**` : '';
      const techStr = proj.techStack?.length ? ' | 技术栈：' + proj.techStack.join(', ') : '';
      if (dateStr || techStr) lines.push(`${dateStr}${techStr}`);
      lines.push('');
      for (const b of proj.bullets || []) {
        lines.push(`- ${b.useEnhanced && b.enhanced ? b.enhanced : b.original}`);
      }
      lines.push('');
    }
  }

  if (library.education.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 教育背景');
    lines.push('');
    for (const edu of library.education) {
      const gpaStr = edu.gpa ? ` | GPA: ${edu.gpa}` : '';
      lines.push(`### ${edu.school} · ${edu.major}`);
      lines.push(`**${edu.degree}** | ${edu.startDate} - ${edu.endDate}${gpaStr}`);
      lines.push('');
    }
  }

  if (library.awards.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 荣誉奖项');
    lines.push('');
    for (const award of library.awards) {
      const dateStr = award.date ? ` (${award.date})` : '';
      lines.push(`- ${award.title}${dateStr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function resumeToMarkdown(resume, library) {
  const lines = [];
  const b = resume.basic || {};

  lines.push(`# ${b.name || '简历'}`);
  if (resume.targetRole) lines.push(`**目标岗位：${resume.targetRole}**`);
  const contactParts = [];
  if (b.phone) contactParts.push(`电话：${b.phone}`);
  if (b.email) contactParts.push(`邮箱：${b.email}`);
  if (b.location) contactParts.push(`所在地：${b.location}`);
  if (contactParts.length) lines.push(contactParts.join(' | '));
  lines.push('');

  const selectedEdu = (resume.selectedEducation || [])
    .map(id => library.education.find(e => e.id === id)).filter(Boolean);
  if (selectedEdu.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 教育背景');
    lines.push('');
    for (const edu of selectedEdu) {
      const gpaStr = edu.gpa ? ` GPA: ${edu.gpa}` : '';
      lines.push(`**${edu.school}** · ${edu.major} · ${edu.degree} (${edu.startDate} - ${edu.endDate})${gpaStr}`);
    }
    lines.push('');
  }

  const selectedExp = (resume.selectedExperiences || [])
    .map(id => library.experiences.find(e => e.id === id)).filter(Boolean);
  if (selectedExp.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 工作经历');
    lines.push('');
    for (const exp of selectedExp) {
      lines.push(`### ${exp.company} — ${exp.role} (${exp.startDate} - ${exp.endDate})`);
      for (const bullet of exp.bullets || []) {
        lines.push(`- ${bullet.useEnhanced && bullet.enhanced ? bullet.enhanced : bullet.original}`);
      }
      lines.push('');
    }
  }

  const selectedProj = (resume.selectedProjects || [])
    .map(id => library.projects.find(e => e.id === id)).filter(Boolean);
  if (selectedProj.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 项目经历');
    lines.push('');
    for (const proj of selectedProj) {
      const dateStr = proj.startDate ? ` (${proj.startDate} - ${proj.endDate || '至今'})` : '';
      lines.push(`### ${proj.name} — ${proj.role}${dateStr}`);
      for (const bullet of proj.bullets || []) {
        lines.push(`- ${bullet.useEnhanced && bullet.enhanced ? bullet.enhanced : bullet.original}`);
      }
      lines.push('');
    }
  }

  const skills = resume.skills || {};
  const hasSkills = skills.technical?.length || skills.tools?.length || skills.languages?.length;
  if (hasSkills) {
    lines.push('---');
    lines.push('');
    lines.push('## 专业技能');
    lines.push('');
    if (skills.technical?.length) lines.push(`- 技术：${skills.technical.join(', ')}`);
    if (skills.tools?.length) lines.push(`- 工具：${skills.tools.join(', ')}`);
    if (skills.languages?.length) lines.push(`- 语言：${skills.languages.join(', ')}`);
    lines.push('');
  }

  const selectedAwards = (resume.selectedAwards || [])
    .map(id => library.awards.find(e => e.id === id)).filter(Boolean);
  if (selectedAwards.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 荣誉奖项');
    lines.push('');
    for (const award of selectedAwards) {
      const dateStr = award.date ? ` (${award.date})` : '';
      lines.push(`- ${award.title}${dateStr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
