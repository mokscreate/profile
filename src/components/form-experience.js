import { getResumeData, saveResumeData } from '../services/storage.js';
import { createExperience, createBullet } from '../data/resume-schema.js';
import { triggerPreviewUpdate } from './wizard.js';
import { initAiChat } from './ai-chat.js';

export function renderExperienceForm(container) {
  const data = getResumeData();

  container.innerHTML = `
    <div class="form-section">
      <h2 class="form-section-title">工作经历</h2>
      <p class="form-hint">填写你的实习/工作经历，AI 会帮你优化描述</p>
      <div id="exp-list"></div>
      <button class="btn-add" id="btn-add-exp">+ 添加工作经历</button>
    </div>
  `;

  renderExpList(data);

  document.getElementById('btn-add-exp').addEventListener('click', () => {
    data.experience.push(createExperience());
    saveResumeData(data);
    renderExpList(data);
    triggerPreviewUpdate();
  });
}

function renderExpList(data) {
  const list = document.getElementById('exp-list');
  list.innerHTML = data.experience.map((exp, i) => `
    <div class="entry-card" data-exp-index="${i}">
      <div class="entry-card-header">
        <span class="entry-card-title">${exp.company || '工作经历 ' + (i + 1)}</span>
        <button class="btn-remove" data-remove-exp="${i}">删除</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">公司</label>
           <input class="form-input exp-field" data-idx="${i}" data-field="company" value="${esc(clean(exp.company))}" placeholder="公司名称">
        </div>
        <div class="form-group">
          <label class="form-label">职位</label>
           <input class="form-input exp-field" data-idx="${i}" data-field="role" value="${esc(clean(exp.role))}" placeholder="你的职位">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">开始时间</label>
           <input class="form-input exp-field" data-idx="${i}" data-field="startDate" value="${esc(clean(exp.startDate))}" placeholder="YYYY.MM">
        </div>
        <div class="form-group">
          <label class="form-label">结束时间</label>
           <input class="form-input exp-field" data-idx="${i}" data-field="endDate" value="${esc(clean(exp.endDate))}" placeholder="YYYY.MM 或 至今">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">工作内容</label>
        <div id="bullets-exp-${i}"></div>
        <button class="btn-add" data-add-bullet-exp="${i}" style="margin-top:8px">+ 添加一条</button>
      </div>
    </div>
  `).join('');

  data.experience.forEach((exp, i) => {
    renderBullets(exp, i, 'exp');
  });

  bindExpEvents(data);
}

function renderBullets(entry, entryIdx, type) {
  const container = document.getElementById(`bullets-${type}-${entryIdx}`);
  container.innerHTML = entry.bullets.map((bullet, bIdx) => `
    <div class="bullet-item" data-bullet-idx="${bIdx}">
      <textarea class="form-textarea bullet-text" data-entry="${entryIdx}" data-bullet="${bIdx}" placeholder="描述你的工作内容和成果...">${esc(clean(bullet.useEnhanced && bullet.enhanced ? bullet.enhanced : bullet.original))}</textarea>
      <div class="bullet-actions">
        <button class="btn-ai" data-ai-entry="${entryIdx}" data-ai-bullet="${bIdx}" data-type="${type}">AI优化</button>
        ${entry.bullets.length > 1 ? `<button class="btn-icon" data-rm-bullet-entry="${entryIdx}" data-rm-bullet="${bIdx}" data-type="${type}">✕</button>` : ''}
      </div>
      <div id="ai-panel-${type}-${entryIdx}-${bIdx}"></div>
    </div>
  `).join('');

  container.querySelectorAll('.bullet-text').forEach(el => {
    el.addEventListener('input', () => {
      const data = getResumeData();
      const eIdx = parseInt(el.dataset.entry);
      const bIdx = parseInt(el.dataset.bullet);
      const entries = type === 'exp' ? data.experience : data.projects;
      entries[eIdx].bullets[bIdx].original = el.value;
      entries[eIdx].bullets[bIdx].useEnhanced = false;
      saveResumeData(data);
      triggerPreviewUpdate();
    });
  });

  container.querySelectorAll('.btn-ai').forEach(el => {
    el.addEventListener('click', () => {
      const eIdx = parseInt(el.dataset.aiEntry);
      const bIdx = parseInt(el.dataset.aiBullet);
      const data = getResumeData();
      const entries = type === 'exp' ? data.experience : data.projects;
      const entry = entries[eIdx];
      const bullet = entry.bullets[bIdx];
      const panelId = `ai-panel-${type}-${eIdx}-${bIdx}`;
      initAiChat(panelId, bullet, entry, () => {
        renderBullets(entry, eIdx, type);
        triggerPreviewUpdate();
      });
    });
  });

  container.querySelectorAll('[data-rm-bullet]').forEach(el => {
    el.addEventListener('click', () => {
      const data = getResumeData();
      const eIdx = parseInt(el.dataset.rmBulletEntry);
      const bIdx = parseInt(el.dataset.rmBullet);
      const entries = type === 'exp' ? data.experience : data.projects;
      entries[eIdx].bullets.splice(bIdx, 1);
      saveResumeData(data);
      renderBullets(entries[eIdx], eIdx, type);
      triggerPreviewUpdate();
    });
  });
}

function bindExpEvents(data) {
  document.querySelectorAll('.exp-field').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx);
      data.experience[idx][el.dataset.field] = el.value;
      saveResumeData(data);
      triggerPreviewUpdate();
    });
  });

  document.querySelectorAll('[data-remove-exp]').forEach(btn => {
    btn.addEventListener('click', () => {
      data.experience.splice(parseInt(btn.dataset.removeExp), 1);
      saveResumeData(data);
      renderExpList(data);
      triggerPreviewUpdate();
    });
  });

  document.querySelectorAll('[data-add-bullet-exp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.addBulletExp);
      data.experience[idx].bullets.push(createBullet());
      saveResumeData(data);
      renderBullets(data.experience[idx], idx, 'exp');
    });
  });
}

export { renderBullets };

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clean(str) {
  if (!str) return '';
  return String(str).replace(/\u200B|\uFEFF/g, '').replace(/\u00A0/g, ' ').trim();
}
