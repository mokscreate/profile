import { navigate } from '../router.js';
import {
  getResume, updateResume, getLibrary
} from '../services/storage.js';
import { adjustScale } from '../components/preview.js';
import { initAiPanel } from '../components/ai-chat.js';
import { templates } from '../templates/index.js';
import { resumeToMarkdown } from '../services/export-md.js';
import { resumeToDocx } from '../services/export-docx.js';
import { downloadText } from '../services/download.js';

let resumeId = null;
let resume = null;

export function renderEditor(container, id) {
  resumeId = id;
  resume = getResume(id);
  if (!resume) {
    navigate('home');
    return;
  }

  container.innerHTML = `
    <div class="editor-page">
      <div class="editor-header">
        <button class="btn btn-ghost" id="editor-back">← 返回</button>
        <input type="text" class="editor-title-input" id="editor-title" value="${esc(resume.title)}" placeholder="简历标题">
        <div class="editor-actions">
          <button class="btn btn-ghost btn-sm" id="btn-export-md">MD</button>
          <button class="btn btn-ghost btn-sm" id="btn-export-docx">Word</button>
          <button class="btn btn-accent btn-sm" id="btn-export">导出 PDF</button>
        </div>
      </div>

      <div class="editor-body">
        <div class="editor-left">
          <div class="editor-section">
            <h3>目标岗位</h3>
            <input type="text" id="editor-role" placeholder="如: 产品运营、AI 产品经理" value="${esc(resume.targetRole)}">
          </div>

          <div class="editor-section">
            <h3>基本信息</h3>
            <div class="form-row">
              <input type="text" id="ed-name" placeholder="姓名" value="${esc(resume.basic.name)}">
              <input type="text" id="ed-phone" placeholder="电话" value="${esc(resume.basic.phone)}">
            </div>
            <div class="form-row">
              <input type="text" id="ed-email" placeholder="邮箱" value="${esc(resume.basic.email)}">
              <input type="text" id="ed-location" placeholder="所在地" value="${esc(resume.basic.location)}">
            </div>
          </div>

          <div class="editor-section">
            <h3>选择经历 <button class="btn btn-ghost btn-xs" id="btn-ai-recommend">AI 推荐</button></h3>
            <div class="exp-selector" id="exp-selector"></div>
          </div>

          <div class="editor-section">
            <h3>AI 优化 <span class="text-muted text-sm">选中经历后，点击优化</span></h3>
            <div id="ai-panel"></div>
          </div>

          <div class="editor-section">
            <h3>技能</h3>
            <input type="text" id="ed-skills-tech" placeholder="技术技能 (逗号分隔)" value="${(resume.skills.technical || []).join(', ')}">
            <input type="text" id="ed-skills-tools" placeholder="工具 (逗号分隔)" value="${(resume.skills.tools || []).join(', ')}" style="margin-top:8px">
            <input type="text" id="ed-skills-lang" placeholder="语言能力 (逗号分隔)" value="${(resume.skills.languages || []).join(', ')}" style="margin-top:8px">
          </div>

          <div class="editor-section">
            <h3>模板</h3>
            <div class="template-options" id="template-options">
              ${Object.values(templates).map(t => `
                <label class="tpl-option ${resume.templateId === t.id ? 'active' : ''}">
                  <input type="radio" name="template" value="${t.id}" ${resume.templateId === t.id ? 'checked' : ''}>
                  <span class="tpl-option-name">${t.name}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="editor-right">
          <div class="jd-sidebar" id="jd-sidebar">
            <div class="jd-header">
              <span>JD 参考</span>
              <button class="btn btn-ghost btn-xs" id="jd-toggle">收起</button>
            </div>
            <textarea id="jd-text" placeholder="粘贴目标职位描述(JD)，AI 将根据 JD 优化你的经历..." rows="6">${esc(resume.jd || '')}</textarea>
          </div>
          <div class="preview-wrapper">
            <div id="resume-preview" class="a4-container print-target"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderExpSelector();
  renderResumePreview();
  bindEditorEvents(container);
}

function renderExpSelector() {
  const library = getLibrary();
  const el = document.getElementById('exp-selector');
  const allItems = [
    ...library.experiences.map(i => ({ ...i, _type: 'work', _label: `${i.company} · ${i.role}` })),
    ...library.projects.map(i => ({ ...i, _type: 'project', _label: `${i.name} · ${i.role}` })),
    ...library.education.map(i => ({ ...i, _type: 'education', _label: `${i.school} · ${i.major}` })),
    ...library.awards.map(i => ({ ...i, _type: 'award', _label: i.title }))
  ];

  if (!allItems.length) {
    el.innerHTML = '<p class="text-muted text-sm">经历库为空，请先去经历库添加内容</p>';
    return;
  }

  const selectedIds = [
    ...resume.selectedExperiences,
    ...resume.selectedProjects,
    ...resume.selectedEducation,
    ...resume.selectedAwards
  ];

  el.innerHTML = allItems.map(item => `
    <label class="exp-check-item ${selectedIds.includes(item.id) ? 'checked' : ''}">
      <input type="checkbox" value="${item.id}" data-type="${item._type}" ${selectedIds.includes(item.id) ? 'checked' : ''}>
      <span class="exp-check-label">${esc(item._label || '(未填写)')}</span>
      <span class="exp-check-type">${typeLabel(item._type)}</span>
    </label>
  `).join('');

  el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      syncSelections();
      renderResumePreview();
    });
  });
}

function syncSelections() {
  const el = document.getElementById('exp-selector');
  const checks = el.querySelectorAll('input[type="checkbox"]:checked');
  const selected = { work: [], project: [], education: [], award: [] };
  checks.forEach(cb => {
    selected[cb.dataset.type].push(cb.value);
  });
  resume.selectedExperiences = selected.work;
  resume.selectedProjects = selected.project;
  resume.selectedEducation = selected.education;
  resume.selectedAwards = selected.award;
  updateResume(resumeId, resume);

  el.querySelectorAll('.exp-check-item').forEach(label => {
    const cb = label.querySelector('input');
    label.classList.toggle('checked', cb.checked);
  });
}

function renderResumePreview() {
  const library = getLibrary();
  const data = buildPreviewData(resume, library);
  const template = templates[resume.templateId] || templates.classic;
  const previewEl = document.getElementById('resume-preview');
  if (previewEl) {
    previewEl.innerHTML = `<style>${template.getStyles()}</style>${template.render(data)}`;
    adjustScale();
  }
}

function buildPreviewData(resume, library) {
  const experiences = resume.selectedExperiences
    .map(id => library.experiences.find(e => e.id === id))
    .filter(Boolean);
  const projects = resume.selectedProjects
    .map(id => library.projects.find(p => p.id === id))
    .filter(Boolean);
  const education = resume.selectedEducation
    .map(id => library.education.find(e => e.id === id))
    .filter(Boolean);
  const awards = resume.selectedAwards
    .map(id => library.awards.find(a => a.id === id))
    .filter(Boolean);

  return {
    basic: { ...resume.basic, targetRole: resume.targetRole },
    education,
    experience: experiences,
    projects,
    skills: resume.skills,
    awards
  };
}

function bindEditorEvents(container) {
  container.querySelector('#editor-back').addEventListener('click', () => {
    saveCurrentState();
    navigate('home');
  });

  container.querySelector('#btn-export').addEventListener('click', () => window.print());

  container.querySelector('#btn-export-md').addEventListener('click', () => {
    const library = getLibrary();
    const md = resumeToMarkdown(resume, library);
    downloadText(md, `${resume.basic.name || '简历'}_${resume.title || '简历'}.md`);
  });

  container.querySelector('#btn-export-docx').addEventListener('click', () => {
    const library = getLibrary();
    resumeToDocx(resume, library);
  });

  container.querySelector('#editor-title').addEventListener('change', (e) => {
    resume.title = e.target.value.trim() || '未命名简历';
    updateResume(resumeId, resume);
  });

  container.querySelector('#editor-role').addEventListener('change', (e) => {
    resume.targetRole = e.target.value.trim();
    updateResume(resumeId, resume);
    renderResumePreview();
  });

  ['ed-name', 'ed-phone', 'ed-email', 'ed-location'].forEach(id => {
    container.querySelector(`#${id}`).addEventListener('change', () => {
      resume.basic = {
        name: container.querySelector('#ed-name').value.trim(),
        phone: container.querySelector('#ed-phone').value.trim(),
        email: container.querySelector('#ed-email').value.trim(),
        location: container.querySelector('#ed-location').value.trim(),
        links: resume.basic.links || []
      };
      updateResume(resumeId, resume);
      renderResumePreview();
    });
  });

  ['ed-skills-tech', 'ed-skills-tools', 'ed-skills-lang'].forEach(id => {
    container.querySelector(`#${id}`).addEventListener('change', () => {
      resume.skills = {
        technical: container.querySelector('#ed-skills-tech').value.split(',').map(s => s.trim()).filter(Boolean),
        tools: container.querySelector('#ed-skills-tools').value.split(',').map(s => s.trim()).filter(Boolean),
        languages: container.querySelector('#ed-skills-lang').value.split(',').map(s => s.trim()).filter(Boolean)
      };
      updateResume(resumeId, resume);
      renderResumePreview();
    });
  });

  container.querySelector('#jd-text').addEventListener('change', (e) => {
    resume.jd = e.target.value;
    updateResume(resumeId, resume);
  });

  container.querySelector('#jd-toggle').addEventListener('click', () => {
    const sidebar = container.querySelector('#jd-sidebar');
    sidebar.classList.toggle('collapsed');
    container.querySelector('#jd-toggle').textContent = sidebar.classList.contains('collapsed') ? '展开' : '收起';
  });

  container.querySelectorAll('input[name="template"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      resume.templateId = e.target.value;
      updateResume(resumeId, resume);
      container.querySelectorAll('.tpl-option').forEach(opt => {
        opt.classList.toggle('active', opt.querySelector('input').value === resume.templateId);
      });
      renderResumePreview();
    });
  });

  container.querySelector('#btn-ai-recommend').addEventListener('click', () => aiRecommend());

  initAiPanel(document.getElementById('ai-panel'), resume, () => renderResumePreview());
}

async function aiRecommend() {
  const library = getLibrary();
  const allItems = [
    ...library.experiences.map(i => ({ id: i.id, type: 'work', desc: `${i.company} ${i.role}: ${i.bullets.map(b => b.original).join('; ')}` })),
    ...library.projects.map(i => ({ id: i.id, type: 'project', desc: `${i.name} ${i.role}: ${i.bullets.map(b => b.original).join('; ')}` })),
    ...library.education.map(i => ({ id: i.id, type: 'education', desc: `${i.school} ${i.major} ${i.degree}` })),
    ...library.awards.map(i => ({ id: i.id, type: 'award', desc: i.title }))
  ];

  if (!allItems.length) {
    alert('经历库为空，请先添加经历');
    return;
  }

  const targetRole = resume.targetRole || '通用';
  const jd = resume.jd || '';

  const btn = document.getElementById('btn-ai-recommend');
  btn.textContent = '推荐中...';
  btn.disabled = true;

  try {
    const { callDeepSeek } = await import('../services/deepseek.js');
    const prompt = `我有以下经历条目：
${allItems.map((item, i) => `${i}. [${item.type}] ${item.desc}`).join('\n')}

目标岗位：${targetRole}
${jd ? `职位描述(JD)：${jd}` : ''}

请根据目标岗位${jd ? '和JD' : ''}，从中推荐最相关的经历（按相关度排序）。只返回推荐的序号数组，如 [0, 2, 5]，不要其他文字。`;

    const response = await callDeepSeek([
      { role: 'system', content: '你是简历优化助手，只输出JSON数组。' },
      { role: 'user', content: prompt }
    ]);

    const indices = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    const recommended = indices.map(i => allItems[i]).filter(Boolean);

    resume.selectedExperiences = recommended.filter(r => r.type === 'work').map(r => r.id);
    resume.selectedProjects = recommended.filter(r => r.type === 'project').map(r => r.id);
    resume.selectedEducation = recommended.filter(r => r.type === 'education').map(r => r.id);
    resume.selectedAwards = recommended.filter(r => r.type === 'award').map(r => r.id);
    updateResume(resumeId, resume);

    renderExpSelector();
    renderResumePreview();
  } catch (err) {
    alert('AI 推荐失败: ' + err.message);
  } finally {
    btn.textContent = 'AI 推荐';
    btn.disabled = false;
  }
}

function saveCurrentState() {
  updateResume(resumeId, resume);
}

function typeLabel(type) {
  switch (type) {
    case 'work': return '工作';
    case 'project': return '项目';
    case 'education': return '教育';
    case 'award': return '奖项';
    default: return '';
  }
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
