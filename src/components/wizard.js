import { getResumeData, saveResumeData } from '../services/storage.js';
import { renderBasicForm } from './form-basic.js';
import { renderExperienceForm } from './form-experience.js';
import { renderProjectForm } from './form-project.js';
import { renderSkillsForm } from './form-skills.js';
import { renderTemplatePicker } from './template-picker.js';
import { renderPreview } from './preview.js';

let currentStep = 1;
const TOTAL_STEPS = 5;

export function initWizard() {
  renderStep(currentStep);
  updateNavButtons();
  updateProgress();
  renderPreview();

  document.getElementById('btn-next').addEventListener('click', () => {
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      renderStep(currentStep);
      updateNavButtons();
      updateProgress();
    }
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      renderStep(currentStep);
      updateNavButtons();
      updateProgress();
    }
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    window.print();
  });
}

function renderStep(step) {
  const container = document.getElementById('wizard-container');
  switch (step) {
    case 1:
      renderBasicForm(container);
      break;
    case 2:
      renderExperienceForm(container);
      break;
    case 3:
      renderProjectForm(container);
      break;
    case 4:
      renderSkillsForm(container);
      break;
    case 5:
      container.innerHTML = '<div class="form-section"><h2 class="form-section-title">预览与导出</h2><p style="color:var(--color-text-secondary)">在右侧预览你的简历，选择模板，满意后点击「导出 PDF」。</p></div>';
      break;
  }
  renderPreview();
}

function updateNavButtons() {
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  prev.disabled = currentStep === 1;
  next.textContent = currentStep === TOTAL_STEPS ? '完成' : '下一步';
  if (currentStep === TOTAL_STEPS) {
    next.disabled = true;
  } else {
    next.disabled = false;
  }
}

function updateProgress() {
  const steps = document.querySelectorAll('.progress-steps .step');
  steps.forEach((el, i) => {
    el.classList.toggle('active', i + 1 === currentStep);
    el.classList.toggle('completed', i + 1 < currentStep);
  });
  const fill = document.querySelector('.progress-fill');
  fill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
}

export function triggerPreviewUpdate() {
  renderPreview();
}
