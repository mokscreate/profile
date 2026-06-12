import { ResumeTemplate } from './template-base.js';

export class MinimalTemplate extends ResumeTemplate {
  constructor() {
    super('minimal', '极简', '大留白、纯排版层次');
  }

  getStyles() {
    return `
      .tpl-minimal { font-size: 11px; color: #262626; }
      .tpl-minimal .resume-header { margin-bottom: 20px; }
      .tpl-minimal .resume-name { font-size: 26px; font-weight: 300; letter-spacing: 1px; margin-bottom: 6px; }
      .tpl-minimal .resume-contact { font-size: 11px; color: #737373; display: flex; gap: 16px; }
      .tpl-minimal .section { margin-bottom: 18px; }
      .tpl-minimal .section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #a3a3a3; margin-bottom: 10px; }
      .tpl-minimal .entry { margin-bottom: 12px; }
      .tpl-minimal .entry-line { display: flex; justify-content: space-between; align-items: baseline; }
      .tpl-minimal .entry-title { font-weight: 600; font-size: 12px; }
      .tpl-minimal .entry-sub { font-size: 11px; color: #525252; }
      .tpl-minimal .entry-date { font-size: 10px; color: #a3a3a3; }
      .tpl-minimal .bullets { padding-left: 0; list-style: none; margin-top: 4px; }
      .tpl-minimal .bullets li { margin-bottom: 3px; padding-left: 12px; position: relative; line-height: 1.6; }
      .tpl-minimal .bullets li::before { content: '—'; position: absolute; left: 0; color: #d4d4d4; }
      .tpl-minimal .skills-line { font-size: 11px; color: #525252; margin-bottom: 4px; }
      .tpl-minimal .skills-label { font-weight: 600; color: #262626; }
      .tpl-minimal .awards-line { font-size: 11px; color: #525252; margin-bottom: 3px; }
    `;
  }

  render(data) {
    const { basic, education, experience, projects, skills, awards } = data;

    return `<div class="tpl-minimal">
      <div class="resume-header">
        <div class="resume-name">${this.esc(basic.name) || '你的姓名'}</div>
        <div class="resume-contact">
          ${basic.targetRole ? `<span>${this.esc(basic.targetRole)}</span>` : ''}
          ${basic.phone ? `<span>${this.esc(basic.phone)}</span>` : ''}
          ${basic.email ? `<span>${this.esc(basic.email)}</span>` : ''}
          ${basic.location ? `<span>${this.esc(basic.location)}</span>` : ''}
        </div>
      </div>

      ${education.some(e => e.school) ? `
      <div class="section">
        <div class="section-title">Education</div>
        ${education.filter(e => e.school).map(edu => `
          <div class="entry">
            <div class="entry-line">
              <span class="entry-title">${this.esc(edu.school)}</span>
              <span class="entry-date">${this.formatDate(edu.startDate, edu.endDate)}</span>
            </div>
            <div class="entry-sub">${this.esc(edu.major)} · ${this.esc(edu.degree)}${edu.gpa ? ' · GPA ' + this.esc(edu.gpa) : ''}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${experience.length ? `
      <div class="section">
        <div class="section-title">Experience</div>
        ${experience.map(exp => `
          <div class="entry">
            <div class="entry-line">
              <span class="entry-title">${this.esc(exp.company)}${exp.role ? ' · ' + this.esc(exp.role) : ''}</span>
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
        <div class="section-title">Projects</div>
        ${projects.map(proj => `
          <div class="entry">
            <div class="entry-line">
              <span class="entry-title">${this.esc(proj.name)}${proj.role ? ' · ' + this.esc(proj.role) : ''}</span>
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
        <div class="section-title">Skills</div>
        ${skills.technical.length ? `<div class="skills-line"><span class="skills-label">技术：</span>${skills.technical.map(s => this.esc(s)).join('、')}</div>` : ''}
        ${skills.tools.length ? `<div class="skills-line"><span class="skills-label">工具：</span>${skills.tools.map(s => this.esc(s)).join('、')}</div>` : ''}
        ${skills.languages.length ? `<div class="skills-line"><span class="skills-label">语言：</span>${skills.languages.map(s => this.esc(s)).join('、')}</div>` : ''}
      </div>` : ''}

      ${awards.some(a => a.title) ? `
      <div class="section">
        <div class="section-title">Awards</div>
        ${awards.filter(a => a.title).map(a => `<div class="awards-line">${this.esc(a.title)}${a.date ? ' · ' + this.esc(a.date) : ''}</div>`).join('')}
      </div>` : ''}
    </div>`;
  }

  hasSkills(skills) {
    return skills.technical.length || skills.tools.length || skills.languages.length;
  }
}
