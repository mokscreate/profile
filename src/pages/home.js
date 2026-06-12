import { navigate } from '../router.js';
import { getLibrary, getResumes, createNewResume, deleteResume } from '../services/storage.js';

export function renderHome(container) {
  const library = getLibrary();
  const resumes = getResumes();

  const libCount = library.experiences.length + library.projects.length + library.education.length + library.awards.length;

  container.innerHTML = `
    <div class="home-page">
      <div class="home-grid">
        <div class="home-card" id="card-library">
          <div class="home-card-icon">📂</div>
          <h2>我的经历库</h2>
          <p class="home-card-desc">管理你的所有工作、项目、教育经历</p>
          <div class="home-card-stat">${libCount} 条经历</div>
        </div>
        <div class="home-card home-card-new" id="card-new-resume">
          <div class="home-card-icon">✨</div>
          <h2>新建简历</h2>
          <p class="home-card-desc">从经历库中挑选，AI 帮你组合优化</p>
        </div>
      </div>

      ${resumes.length ? `
      <div class="home-section">
        <h3 class="home-section-title">我的简历 (${resumes.length})</h3>
        <div class="resume-list">
          ${resumes.map(r => `
            <div class="resume-card" data-id="${r.id}">
              <div class="resume-card-info">
                <div class="resume-card-title">${esc(r.title)}</div>
                <div class="resume-card-meta">
                  ${r.targetRole ? `<span class="tag">${esc(r.targetRole)}</span>` : ''}
                  <span class="text-muted">${formatDate(r.updatedAt)}</span>
                </div>
              </div>
              <div class="resume-card-actions">
                <button class="btn btn-sm btn-primary resume-edit" data-id="${r.id}">编辑</button>
                <button class="btn btn-sm btn-ghost resume-delete" data-id="${r.id}">删除</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>
  `;

  container.querySelector('#card-library').addEventListener('click', () => navigate('library'));
  container.querySelector('#card-new-resume').addEventListener('click', () => {
    const resume = createNewResume();
    navigate('editor', { resumeId: resume.id });
  });

  container.querySelectorAll('.resume-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate('editor', { resumeId: btn.dataset.id });
    });
  });

  container.querySelectorAll('.resume-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确定删除这份简历？')) {
        deleteResume(btn.dataset.id);
        renderHome(container);
      }
    });
  });

  container.querySelectorAll('.resume-card').forEach(card => {
    card.addEventListener('click', () => {
      navigate('editor', { resumeId: card.dataset.id });
    });
  });
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
