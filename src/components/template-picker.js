import { getResumeData, saveResumeData } from '../services/storage.js';
import { templates } from '../templates/index.js';
import { renderPreview } from './preview.js';

export function renderTemplatePicker() {
  const data = getResumeData();
  const picker = document.getElementById('template-picker');

  picker.innerHTML = Object.values(templates).map(tpl => `
    <label class="tpl-option ${data.meta.selectedTemplate === tpl.id ? 'active' : ''}">
      <input type="radio" name="template" value="${tpl.id}" ${data.meta.selectedTemplate === tpl.id ? 'checked' : ''}>
      <span class="tpl-option-name">${tpl.name}</span>
    </label>
  `).join('');

  picker.querySelectorAll('input[name="template"]').forEach(input => {
    input.addEventListener('change', () => {
      data.meta.selectedTemplate = input.value;
      saveResumeData(data);
      renderPreview();
      renderTemplatePicker();
    });
  });
}
