import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { downloadBlob } from './download.js';

export async function libraryToDocx(profile, library) {
  const children = [];

  children.push(heading1('个人经历库'));
  children.push(emptyLine());

  if (profile.name) children.push(normalPara(`姓名：${profile.name}`));
  if (profile.phone) children.push(normalPara(`电话：${profile.phone}`));
  if (profile.email) children.push(normalPara(`邮箱：${profile.email}`));
  if (profile.location) children.push(normalPara(`所在地：${profile.location}`));
  children.push(emptyLine());

  if (library.experiences.length) {
    children.push(heading2('工作经历'));
    for (const exp of library.experiences) {
      children.push(heading3(`${exp.company} · ${exp.role}`));
      children.push(italicPara(`${exp.startDate} - ${exp.endDate}${exp.tags.length ? ' | ' + exp.tags.join(', ') : ''}`));
      for (const b of exp.bullets || []) {
        children.push(bulletPara(b.useEnhanced && b.enhanced ? b.enhanced : b.original));
      }
      children.push(emptyLine());
    }
  }

  if (library.projects.length) {
    children.push(heading2('项目经历'));
    for (const proj of library.projects) {
      children.push(heading3(`${proj.name} · ${proj.role}`));
      const meta = [];
      if (proj.startDate) meta.push(`${proj.startDate} - ${proj.endDate || '至今'}`);
      if (proj.techStack?.length) meta.push('技术栈：' + proj.techStack.join(', '));
      if (meta.length) children.push(italicPara(meta.join(' | ')));
      for (const b of proj.bullets || []) {
        children.push(bulletPara(b.useEnhanced && b.enhanced ? b.enhanced : b.original));
      }
      children.push(emptyLine());
    }
  }

  if (library.education.length) {
    children.push(heading2('教育背景'));
    for (const edu of library.education) {
      const gpaStr = edu.gpa ? ` | GPA: ${edu.gpa}` : '';
      children.push(heading3(`${edu.school} · ${edu.major}`));
      children.push(normalPara(`${edu.degree} | ${edu.startDate} - ${edu.endDate}${gpaStr}`));
      children.push(emptyLine());
    }
  }

  if (library.awards.length) {
    children.push(heading2('荣誉奖项'));
    for (const award of library.awards) {
      const dateStr = award.date ? ` (${award.date})` : '';
      children.push(bulletPara(`${award.title}${dateStr}`));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${profile.name || '经历库'}_经历库.docx`);
}

export async function resumeToDocx(resume, library) {
  const children = [];
  const b = resume.basic || {};

  children.push(new Paragraph({
    children: [new TextRun({ text: b.name || '简历', bold: true, size: 32 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 }
  }));

  if (resume.targetRole) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `目标岗位：${resume.targetRole}`, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 }
    }));
  }

  const contactParts = [];
  if (b.phone) contactParts.push(b.phone);
  if (b.email) contactParts.push(b.email);
  if (b.location) contactParts.push(b.location);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join(' | '), size: 20, color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }));
  }

  const selectedEdu = (resume.selectedEducation || [])
    .map(id => library.education.find(e => e.id === id)).filter(Boolean);
  if (selectedEdu.length) {
    children.push(heading2('教育背景'));
    for (const edu of selectedEdu) {
      const gpaStr = edu.gpa ? ` GPA: ${edu.gpa}` : '';
      children.push(boldPara(`${edu.school} · ${edu.major} · ${edu.degree} (${edu.startDate} - ${edu.endDate})${gpaStr}`));
    }
    children.push(emptyLine());
  }

  const selectedExp = (resume.selectedExperiences || [])
    .map(id => library.experiences.find(e => e.id === id)).filter(Boolean);
  if (selectedExp.length) {
    children.push(heading2('工作经历'));
    for (const exp of selectedExp) {
      children.push(boldPara(`${exp.company} — ${exp.role} (${exp.startDate} - ${exp.endDate})`));
      for (const bullet of exp.bullets || []) {
        children.push(bulletPara(bullet.useEnhanced && bullet.enhanced ? bullet.enhanced : bullet.original));
      }
      children.push(emptyLine());
    }
  }

  const selectedProj = (resume.selectedProjects || [])
    .map(id => library.projects.find(e => e.id === id)).filter(Boolean);
  if (selectedProj.length) {
    children.push(heading2('项目经历'));
    for (const proj of selectedProj) {
      const dateStr = proj.startDate ? ` (${proj.startDate} - ${proj.endDate || '至今'})` : '';
      children.push(boldPara(`${proj.name} — ${proj.role}${dateStr}`));
      for (const bullet of proj.bullets || []) {
        children.push(bulletPara(bullet.useEnhanced && bullet.enhanced ? bullet.enhanced : bullet.original));
      }
      children.push(emptyLine());
    }
  }

  const skills = resume.skills || {};
  const hasSkills = skills.technical?.length || skills.tools?.length || skills.languages?.length;
  if (hasSkills) {
    children.push(heading2('专业技能'));
    if (skills.technical?.length) children.push(bulletPara(`技术：${skills.technical.join(', ')}`));
    if (skills.tools?.length) children.push(bulletPara(`工具：${skills.tools.join(', ')}`));
    if (skills.languages?.length) children.push(bulletPara(`语言：${skills.languages.join(', ')}`));
    children.push(emptyLine());
  }

  const selectedAwards = (resume.selectedAwards || [])
    .map(id => library.awards.find(e => e.id === id)).filter(Boolean);
  if (selectedAwards.length) {
    children.push(heading2('荣誉奖项'));
    for (const award of selectedAwards) {
      const dateStr = award.date ? ` (${award.date})` : '';
      children.push(bulletPara(`${award.title}${dateStr}`));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${b.name || '简历'}_${resume.title || '简历'}.docx`);
}

function heading1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } });
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26 })],
    spacing: { before: 200, after: 100 },
    border: { bottom: { color: '999999', size: 1, space: 4, style: 'single' } }
  });
}

function heading3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 100, after: 50 }
  });
}

function normalPara(text) {
  return new Paragraph({ children: [new TextRun({ text, size: 20 })], spacing: { after: 50 } });
}

function boldPara(text) {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })], spacing: { after: 50 } });
}

function italicPara(text) {
  return new Paragraph({ children: [new TextRun({ text, italics: true, size: 20, color: '666666' })], spacing: { after: 50 } });
}

function bulletPara(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    bullet: { level: 0 },
    spacing: { after: 30 }
  });
}

function emptyLine() {
  return new Paragraph({ text: '', spacing: { after: 100 } });
}
