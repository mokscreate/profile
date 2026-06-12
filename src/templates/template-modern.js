import { ResumeTemplate } from './template-base.js';

export class ModernTemplate extends ResumeTemplate {
  constructor() {
    super('modern', '现代', '双栏布局，左侧边栏突出');
  }

  getStyles() {
    return `
      .tpl-modern { font-size: 11px; color: #1a1a1a; display: flex; gap: 20px; }
      .tpl-modern .sidebar { width: 160px; flex-shrink: 0; }
      .tpl-modern .main { flex: 1; }
      .tpl-modern .resume-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
      .tpl-modern .resume-target { font-size: 12px; color: #64748b; margin-bottom: 12px; }
      .tpl-modern .sidebar-section { margin-bottom: 14px; }
      .tpl-modern .sidebar-title { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #6366f1; }
      .tpl-modern .contact-item { font-size: 10px; color: #475569; margin-bottom: 4px; word-break: break-all; }
      .tpl-modern .skill-tag { display: inline-block; background: #eef2ff; color: #4338ca; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin: 2px 2px 2px 0; }
      .tpl-modern .edu-item { margin-bottom: 8px; }
      .tpl-modern .edu-school { font-weight: 600; font-size: 11px; }
      .tpl-modern .edu-detail { font-size: 10px; color: #64748b; }
      .tpl-modern .section { margin-bottom: 14px; }
      .tpl-modern .section-title { font-size: 13px; font-weight: 700; color: #6366f1; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
      .tpl-modern .entry { margin-bottom: 10px; }
      .tpl-modern .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
      .tpl-modern .entry-title { font-weight: 600; font-size: 12px; }
      .tpl-modern .entry-date { font-size: 10px; color: #64748b; }
      .tpl-modern .entry-subtitle { font-size: 11px; color: #475569; }
      .tpl-modern .bullets { padding-left: 14px; margin-top: 4px; }
      .tpl-modern .bullets li { margin-bottom: 3px; line-height: 1.5; }
      .tpl-modern .awards-item { font-size: 10px; margin-bottom: 3px; }
    `;
  }

  render(data) {
    const { basic, education, experience, projects, skills, awards } = data;

    return `<div class="tpl-modern">
      <div class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">联系方式</div>
          ${basic.phone ? `<div class="contact-item">${this.esc(basic.phone)}</div>` : ''}
          ${basic.email ? `<div class="contact-item">${this.esc(basic.email)}</div>` : ''}
          ${basic.location ? `<div class="contact-item">${this.esc(basic.location)}</div>` : ''}
        </div>

        ${education.some(e => e.school) ? `
        <div class="sidebar-section">
          <div class="sidebar-title">教育背景</div>
          ${education.filter(e => e.school).map(edu => `
            <div class="edu-item">
              <div class="edu-school">${this.esc(edu.school)}</div>
              <div class="edu-detail">${this.esc(edu.major)} · ${this.esc(edu.degree)}</div>
              <div class="edu-detail">${this.formatDate(edu.startDate, edu.endDate)}</div>
              ${edu.gpa ? `<div class="edu-detail">GPA: ${this.esc(edu.gpa)}</div>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        ${this.hasSkills(skills) ? `
        <div class="sidebar-section">
          <div class="sidebar-title">技能</div>
          ${[...skills.technical, ...skills.tools, ...skills.languages].map(s => `<span class="skill-tag">${this.esc(s)}</span>`).join('')}
        </div>` : ''}

        ${awards.some(a => a.title) ? `
        <div class="sidebar-section">
          <div class="sidebar-title">荣誉</div>
          ${awards.filter(a => a.title).map(a => `<div class="awards-item">${this.esc(a.title)}</div>`).join('')}
        </div>` : ''}
      </div>

      <div class="main">
        <div class="resume-name">${this.esc(basic.name) || '你的姓名'}</div>
        ${basic.targetRole ? `<div class="resume-target">${this.esc(basic.targetRole)}</div>` : ''}

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
      </div>
    </div>`;
  }

  hasSkills(skills) {
    return skills.technical.length || skills.tools.length || skills.languages.length;
  }
}
