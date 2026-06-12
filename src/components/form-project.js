import { getResumeData, saveResumeData } from '../services/storage.js';
import { createProject, createBullet } from '../data/resume-schema.js';
import { triggerPreviewUpdate } from './wizard.js';
import { renderBullets } from './form-experience.js';
import { initAiChat } from './ai-chat.js';

export function renderProjectForm(container) {
  const data = getResumeData();

  container.innerHTML = `
    <div class="form-section">
      <h2 class="form-section-title">项目经历</h2>
      <p class="form-hint">填写你参与的项目，AI 同样可以帮你优化描述</p>
      <div id="proj-list"></div>
      <button class="btn-add" id="btn-add-proj">+ 添加项目经历</button>
    </div>
  `;

  renderProjList(data);

  document.getElementById('btn-add-proj').addEventListener('click', () => {
    data.projects.push(createProject());
    saveResumeData(data);
    renderProjList(data);
    triggerPreviewUpdate();
  });
}

function renderProjList(data) {
  const list = document.getElementById('proj-list');
  list.innerHTML = data.projects.map((proj, i) => `
    <div class="entry-card" data-proj-index="${i}">
      <div class="entry-card-header">
        <span class="entry-card-title">${proj.name || '项目 ' + (i + 1)}</span>
        <button class="btn-remove" data-remove-proj="${i}">删除</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">项目名称</label>
          <input class="form-input proj-field" data-idx="${i}" data-field="name" value="${esc(clean(proj.name))}" placeholder="项目名称">
        </div>
        <div class="form-group">
          <label class="form-label">你的角色</label>
          <input class="form-input proj-field" data-idx="${i}" data-field="role" value="${esc(clean(proj.role))}" placeholder="如：负责人">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">开始时间</label>
          <input class="form-input proj-field" data-idx="${i}" data-field="startDate" value="${esc(clean(proj.startDate))}" placeholder="YYYY.MM">
        </div>
        <div class="form-group">
          <label class="form-label">结束时间</label>
          <input class="form-input proj-field" data-idx="${i}" data-field="endDate" value="${esc(clean(proj.endDate))}" placeholder="YYYY.MM 或 至今">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">项目描述</label>
        <div id="bullets-proj-${i}"></div>
        <button class="btn-add" data-add-bullet-proj="${i}" style="margin-top:8px">+ 添加一条</button>
      </div>
    </div>
  `).join('');

  data.projects.forEach((proj, i) => {
    renderBulletsProj(proj, i);
  });

  bindProjEvents(data);
}

function renderBulletsProj(entry, entryIdx) {
  const container = document.getElementById(`bullets-proj-${entryIdx}`);
  container.innerHTML = entry.bullets.map((bullet, bIdx) => `
    <div class="bullet-item" data-bullet-idx="${bIdx}">
      <textarea class="form-textarea bullet-text" data-entry="${entryIdx}" data-bullet="${bIdx}" placeholder="描述项目内容和你的贡献...">${esc(clean(bullet.useEnhanced && bullet.enhanced ? bullet.enhanced : bullet.original))}</textarea>
      <div class="bullet-actions">
        <button class="btn-ai" data-ai-entry="${entryIdx}" data-ai-bullet="${bIdx}" data-type="proj">AI优化</button>
        ${entry.bullets.length > 1 ? `<button class="btn-icon" data-rm-bullet-entry="${entryIdx}" data-rm-bullet="${bIdx}" data-type="proj">✕</button>` : ''}
      </div>
      <div id="ai-panel-proj-${entryIdx}-${bIdx}"></div>
    </div>
  `).join('');

  container.querySelectorAll('.bullet-text').forEach(el => {
    el.addEventListener('input', () => {
      const data = getResumeData();
      const eIdx = parseInt(el.dataset.entry);
      const bIdx = parseInt(el.dataset.bullet);
      data.projects[eIdx].bullets[bIdx].original = el.value;
      data.projects[eIdx].bullets[bIdx].useEnhanced = false;
      saveResumeData(data);
      triggerPreviewUpdate();
    });
  });

  container.querySelectorAll('.btn-ai').forEach(el => {
    el.addEventListener('click', () => {
      const eIdx = parseInt(el.dataset.aiEntry);
      const bIdx = parseInt(el.dataset.aiBullet);
      const data = getResumeData();
      const entry = data.projects[eIdx];
      const bullet = entry.bullets[bIdx];
      const panelId = `ai-panel-proj-${eIdx}-${bIdx}`;
      initAiChat(panelId, bullet, entry, () => {
        renderBulletsProj(entry, eIdx);
        triggerPreviewUpdate();
      });
    });
  });

  container.querySelectorAll('[data-rm-bullet]').forEach(el => {
    el.addEventListener('click', () => {
      const data = getResumeData();
      const eIdx = parseInt(el.dataset.rmBulletEntry);
      const bIdx = parseInt(el.dataset.rmBullet);
      data.projects[eIdx].bullets.splice(bIdx, 1);
      saveResumeData(data);
      renderBulletsProj(data.projects[eIdx], eIdx);
      triggerPreviewUpdate();
    });
  });
}

function bindProjEvents(data) {
  document.querySelectorAll('.proj-field').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx);
      data.projects[idx][el.dataset.field] = el.value;
      saveResumeData(data);
      triggerPreviewUpdate();
    });
  });

  document.querySelectorAll('[data-remove-proj]').forEach(btn => {
    btn.addEventListener('click', () => {
      data.projects.splice(parseInt(btn.dataset.removeProj), 1);
      saveResumeData(data);
      renderProjList(data);
      triggerPreviewUpdate();
    });
  });

  document.querySelectorAll('[data-add-bullet-proj]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.addBulletProj);
      data.projects[idx].bullets.push(createBullet());
      saveResumeData(data);
      renderBulletsProj(data.projects[idx], idx);
    });
  });
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clean(str) {
  if (!str) return '';
  // remove zero-width and BOM, replace non-breaking spaces with regular spaces, then trim
  return String(str).replace(/\u200B|\uFEFF/g, '').replace(/\u00A0/g, ' ').trim();
}
