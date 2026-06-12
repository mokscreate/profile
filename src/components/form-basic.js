import { getResumeData, saveResumeData } from '../services/storage.js';
import { createEducation } from '../data/resume-schema.js';
import { triggerPreviewUpdate } from './wizard.js';

export function renderBasicForm(container) {
  const data = getResumeData();
  const b = data.basic;
  const eduList = data.education;

  container.innerHTML = `
    <div class="form-section">
      <h2 class="form-section-title">基本信息</h2>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">姓名 *</label>
          <input class="form-input" id="f-name" value="${esc(b.name)}" placeholder="你的姓名">
        </div>
        <div class="form-group">
          <label class="form-label">目标岗位</label>
          <input class="form-input" id="f-role" value="${esc(b.targetRole)}" placeholder="如：前端工程师">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">手机号</label>
          <input class="form-input" id="f-phone" value="${esc(b.phone)}" placeholder="手机号码">
        </div>
        <div class="form-group">
          <label class="form-label">邮箱</label>
          <input class="form-input" id="f-email" value="${esc(b.email)}" placeholder="邮箱地址">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">所在城市</label>
        <input class="form-input" id="f-location" value="${esc(b.location)}" placeholder="如：北京">
      </div>
    </div>

    <div class="form-section">
      <h2 class="form-section-title">教育背景</h2>
      <div id="edu-list"></div>
      <button class="btn-add" id="btn-add-edu">+ 添加教育经历</button>
    </div>
  `;

  renderEduList(eduList);
  bindBasicEvents(data);

  document.getElementById('btn-add-edu').addEventListener('click', () => {
    data.education.push(createEducation());
    saveResumeData(data);
    renderEduList(data.education);
    triggerPreviewUpdate();
  });
}

function renderEduList(eduList) {
  const list = document.getElementById('edu-list');
  list.innerHTML = eduList.map((edu, i) => `
    <div class="entry-card" data-index="${i}">
      <div class="entry-card-header">
        <span class="entry-card-title">教育经历 ${i + 1}</span>
        ${eduList.length > 1 ? `<button class="btn-remove" data-remove-edu="${i}">删除</button>` : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">学校</label>
          <input class="form-input edu-field" data-idx="${i}" data-field="school" value="${esc(edu.school)}" placeholder="学校名称">
        </div>
        <div class="form-group">
          <label class="form-label">专业</label>
          <input class="form-input edu-field" data-idx="${i}" data-field="major" value="${esc(edu.major)}" placeholder="专业名称">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">学位</label>
          <select class="form-select edu-field" data-idx="${i}" data-field="degree">
            <option ${edu.degree === '本科' ? 'selected' : ''}>本科</option>
            <option ${edu.degree === '硕士' ? 'selected' : ''}>硕士</option>
            <option ${edu.degree === '博士' ? 'selected' : ''}>博士</option>
            <option ${edu.degree === '大专' ? 'selected' : ''}>大专</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">GPA</label>
          <input class="form-input edu-field" data-idx="${i}" data-field="gpa" value="${esc(edu.gpa)}" placeholder="如 3.8/4.0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">开始时间</label>
          <input class="form-input edu-field" data-idx="${i}" data-field="startDate" value="${esc(edu.startDate)}" placeholder="YYYY.MM">
        </div>
        <div class="form-group">
          <label class="form-label">结束时间</label>
          <input class="form-input edu-field" data-idx="${i}" data-field="endDate" value="${esc(edu.endDate)}" placeholder="YYYY.MM 或 至今">
        </div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.edu-field').forEach(el => {
    el.addEventListener('input', () => {
      const data = getResumeData();
      const idx = parseInt(el.dataset.idx);
      data.education[idx][el.dataset.field] = el.value;
      saveResumeData(data);
      triggerPreviewUpdate();
    });
  });

  list.querySelectorAll('[data-remove-edu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const data = getResumeData();
      data.education.splice(parseInt(btn.dataset.removeEdu), 1);
      saveResumeData(data);
      renderEduList(data.education);
      triggerPreviewUpdate();
    });
  });
}

function bindBasicEvents(data) {
  const fields = { 'f-name': 'name', 'f-phone': 'phone', 'f-email': 'email', 'f-location': 'location', 'f-role': 'targetRole' };
  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        data.basic[key] = el.value;
        saveResumeData(data);
        triggerPreviewUpdate();
      });
    }
  });
}

function esc(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
