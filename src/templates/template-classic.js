import { ResumeTemplate } from './template-base.js';

export class ClassicTemplate extends ResumeTemplate {
  constructor() {
    super('classic', '经典', '传统单栏布局，简洁专业');
  }

  getStyles() {
    return `
      .tpl-classic { font-size: 11px; color: #1a1a1a; }
      .tpl-classic .resume-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
      .tpl-classic .resume-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
      .tpl-classic .resume-target { font-size: 13px; color: #64748b; margin-bottom: 6px; }
      .tpl-classic .resume-contact { font-size: 11px; color: #475569; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
      .tpl-classic .section { margin-bottom: 14px; }
      .tpl-classic .section-title { font-size: 13px; font-weight: 700; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
      .tpl-classic .entry { margin-bottom: 10px; }
      .tpl-classic .entry-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
      .tpl-classic .entry-title { font-weight: 600; font-size: 12px; }
      .tpl-classic .entry-subtitle { color: #475569; font-size: 11px; }
      .tpl-classic .entry-date { color: #64748b; font-size: 10px; white-space: nowrap; }
      .tpl-classic .bullets { padding-left: 16px; margin-top: 4px; }
      .tpl-classic .bullets li { margin-bottom: 3px; line-height: 1.5; }
      .tpl-classic .skills-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
      .tpl-classic .skill-tag { background: #f1f5f9; padding: 2px 8px; border-radius: 3px; font-size: 10px; }
      .tpl-classic .awards-list { columns: 2; column-gap: 20px; }
      .tpl-classic .awards-list li { font-size: 11px; margin-bottom: 3px; }
    `;
  }

  render(data) {
    const { basic, education, experience, projects, skills, awards } = data;

    return `<div class="tpl-classic">
      <div class="resume-header">
        <div class="resume-name">${this.esc(basic.name) || '你的姓名'}</div>
        ${basic.targetRole ? `<div class="resume-target">${this.esc(basic.targetRole)}</div>` : ''}
        <div class="resume-contact">
          ${basic.phone ? `<span>${this.esc(basic.phone)}</span>` : ''}
          ${basic.email ? `<span>${this.esc(basic.email)}</span>` : ''}
          ${basic.location ? `<span>${this.esc(basic.location)}</span>` : ''}
        </div>
      </div>

      ${education.some(e => e.school) ? `
      <div class="section">
        <div class="section-title">教育背景</div>
        ${education.filter(e => e.school).map(edu => `
          <div class="entry">
            <div class="entry-header">
              <span class="entry-title">${this.esc(edu.school)} · ${this.esc(edu.major)}</span>
              <span class="entry-date">${this.formatDate(edu.startDate, edu.endDate)}</span>
            </div>
            <div class="entry-subtitle">${this.esc(edu.degree)}${edu.gpa ? ' | GPA: ' + this.esc(edu.gpa) : ''}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${experience.length ? `
      <div class="section">
        <div class="section-title">工作经历</div>
        ${experience.map(exp => `
          <div class="entry">
            <div class="entry-header">
              <span class="entry-title">${this.esc(exp.company)}${exp.role ? ' - ' + this.esc(exp.role) : ''}</span>
              <span class="entry-date">${this.formatDate(exp.startDate, exp.endDate)}</span>
            </div>
            ${exp.bullets.some(b => this.getBulletText(b)) ? `
            <ul class="bullets">
              ${exp.bullets.filter(b => this.getBulletText(b)).map(b => `<li>${this.esc(this.getBulletText(b))}</li>`).join('')}
            </ul>` : ''}
          </div>
        `).join('')}
      </div>` : ''}

      ${projects.length ? `
      <div class="section">
        <div class="section-title">项目经历</div>
        ${projects.map(proj => `
          <div class="entry">
            <div class="entry-header">
              <span class="entry-title">${this.esc(proj.name)}${proj.role ? ' - ' + this.esc(proj.role) : ''}</span>
              <span class="entry-date">${this.formatDate(proj.startDate, proj.endDate)}</span>
            </div>
            ${proj.bullets.some(b => this.getBulletText(b)) ? `
            <ul class="bullets">
              ${proj.bullets.filter(b => this.getBulletText(b)).map(b => `<li>${this.esc(this.getBulletText(b))}</li>`).join('')}
            </ul>` : ''}
          </div>
        `).join('')}
      </div>` : ''}

      ${this.hasSkills(skills) ? `
      <div class="section">
        <div class="section-title">专业技能</div>
        ${skills.technical.length ? `<div class="skills-row">${skills.technical.map(s => `<span class="skill-tag">${this.esc(s)}</span>`).join('')}</div>` : ''}
        ${skills.tools.length ? `<div class="skills-row">${skills.tools.map(s => `<span class="skill-tag">${this.esc(s)}</span>`).join('')}</div>` : ''}
        ${skills.languages.length ? `<div class="skills-row">${skills.languages.map(s => `<span class="skill-tag">${this.esc(s)}</span>`).join('')}</div>` : ''}
      </div>` : ''}

      ${awards.some(a => a.title) ? `
      <div class="section">
        <div class="section-title">荣誉奖项</div>
        <ul class="awards-list">
          ${awards.filter(a => a.title).map(a => `<li>${this.esc(a.title)}${a.date ? ' (' + this.esc(a.date) + ')' : ''}</li>`).join('')}
        </ul>
      </div>` : ''}
    </div>`;
  }

  hasSkills(skills) {
    return skills.technical.length || skills.tools.length || skills.languages.length;
  }
}
