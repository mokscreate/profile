import { getResumeData, saveResumeData } from '../services/storage.js';
import { createAward } from '../data/resume-schema.js';
import { triggerPreviewUpdate } from './wizard.js';

export function renderSkillsForm(container) {
  const data = getResumeData();

  container.innerHTML = `
    <div class="form-section">
      <h2 class="form-section-title">专业技能</h2>
      <div class="form-group">
        <label class="form-label">技术技能</label>
        <div class="tag-input-wrapper" id="tag-technical">
          ${renderTags(data.skills.technical)}
          <input class="tag-input" data-category="technical" placeholder="输入技能后按回车添加">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">工具</label>
        <div class="tag-input-wrapper" id="tag-tools">
          ${renderTags(data.skills.tools)}
          <input class="tag-input" data-category="tools" placeholder="如 Figma、Git、Photoshop">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">语言能力</label>
        <div class="tag-input-wrapper" id="tag-languages">
          ${renderTags(data.skills.languages)}
          <input class="tag-input" data-category="languages" placeholder="如 英语CET-6、日语N2">
        </div>
      </div>
    </div>

    <div class="form-section">
      <h2 class="form-section-title">荣誉奖项</h2>
      <div id="awards-list"></div>
      <button class="btn-add" id="btn-add-award">+ 添加奖项</button>
    </div>
  `;

  renderAwardsList(data);
  bindTagInputs(data);

  document.getElementById('btn-add-award').addEventListener('click', () => {
    data.awards.push(createAward());
    saveResumeData(data);
    renderAwardsList(data);
    triggerPreviewUpdate();
  });
}

function renderTags(arr) {
  return arr.map((tag, i) => `<span class="tag">${esc(tag)}<span class="tag-remove" data-tag-idx="${i}">×</span></span>`).join('');
}

function bindTagInputs(data) {
  document.querySelectorAll('.tag-input').forEach(input => {
    const category = input.dataset.category;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        data.skills[category].push(input.value.trim());
        saveResumeData(data);
        refreshTagWrapper(category, data);
        triggerPreviewUpdate();
      }
    });
  });

  document.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.tag-input-wrapper');
      const input = wrapper.querySelector('.tag-input');
      const category = input.dataset.category;
      const idx = parseInt(btn.dataset.tagIdx);
      data.skills[category].splice(idx, 1);
      saveResumeData(data);
      refreshTagWrapper(category, data);
      triggerPreviewUpdate();
    });
  });
}

function refreshTagWrapper(category, data) {
  const wrapper = document.getElementById(`tag-${category}`);
  const input = wrapper.querySelector('.tag-input');
  wrapper.innerHTML = renderTags(data.skills[category]) + `<input class="tag-input" data-category="${category}" placeholder="${input.placeholder}">`;
  bindTagInputs(data);
  wrapper.querySelector('.tag-input').focus();
}

function renderAwardsList(data) {
  const list = document.getElementById('awards-list');
  list.innerHTML = data.awards.map((award, i) => `
    <div class="entry-card" style="padding:12px">
      <div class="form-row" style="align-items:center">
        <div class="form-group" style="flex:3">
          <input class="form-input award-field" data-idx="${i}" data-field="title" value="${esc(award.title)}" placeholder="奖项名称">
        </div>
        <div class="form-group" style="flex:1">
          <input class="form-input award-field" data-idx="${i}" data-field="date" value="${esc(award.date)}" placeholder="年份">
        </div>
        <button class="btn-remove" data-remove-award="${i}">删除</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.award-field').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx);
      data.awards[idx][el.dataset.field] = el.value;
      saveResumeData(data);
      triggerPreviewUpdate();
    });
  });

  list.querySelectorAll('[data-remove-award]').forEach(btn => {
    btn.addEventListener('click', () => {
      data.awards.splice(parseInt(btn.dataset.removeAward), 1);
      saveResumeData(data);
      renderAwardsList(data);
      triggerPreviewUpdate();
    });
  });
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
