import { templates } from '../templates/index.js';

export function renderPreview(data, templateId) {
  const template = templates[templateId] || templates.classic;
  const previewEl = document.getElementById('resume-preview');
  if (!previewEl) return;
  previewEl.innerHTML = `<style>${template.getStyles()}</style>${template.render(data)}`;
  adjustScale();
}

export function adjustScale() {
  const wrapper = document.querySelector('.preview-wrapper');
  const container = document.getElementById('resume-preview');
  if (!wrapper || !container) return;

  const wrapperWidth = wrapper.clientWidth - 48;
  const a4WidthPx = 210 * 3.7795;
  const scale = Math.min(1, wrapperWidth / a4WidthPx);
  container.style.transform = `scale(${scale})`;
  container.style.transformOrigin = 'top center';
}

window.addEventListener('resize', adjustScale);
