import { renderHome } from './pages/home.js';
import { renderLibrary } from './pages/library.js';
import { renderEditor } from './pages/editor.js';
import { renderUserSelect } from './pages/user-select.js';
import { getApiKey, setApiKey, initStorage, getAppData, persist } from './services/storage.js';
import { migrateFromLegacy, getActiveUser, getActiveUserId, setActiveUser } from './services/user-manager.js';
import { setNavigate } from './router.js';
import { reformatLibrary } from './services/library-cleanup.js';

let currentView = 'home';
let currentResumeId = null;

function navigate(view, params = {}) {
  currentView = view;
  currentResumeId = params.resumeId || null;
  render();
}

setNavigate(navigate);

function render() {
  const main = document.getElementById('main-content');
  switch (currentView) {
    case 'user-select':
      renderUserSelect(main, (userId) => {
        initStorage(userId);
        updateUserChip();
        navigate('home');
      });
      break;
    case 'home':
      renderHome(main);
      break;
    case 'library':
      renderLibrary(main);
      break;
    case 'editor':
      renderEditor(main, currentResumeId);
      break;
    default:
      renderHome(main);
  }
  updateHeaderVisibility();
}

function updateHeaderVisibility() {
  const header = document.querySelector('.app-header');
  if (currentView === 'user-select') {
    header.style.display = 'none';
  } else {
    header.style.display = '';
  }
}

function updateUserChip() {
  const chip = document.getElementById('user-chip');
  const user = getActiveUser();
  if (user && chip) {
    chip.textContent = `${user.emoji} ${user.name}`;
    chip.style.display = '';
  } else if (chip) {
    chip.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  migrateFromLegacy();

  const activeUserId = getActiveUserId();

  if (!activeUserId) {
    currentView = 'user-select';
    render();
  } else {
    initStorage(activeUserId);
    // One-off forced cleanup: run library reformat to remove zero-width/NBSP from existing data
    try {
      const CLEAN_FLAG = 'resume-craft-cleaned-v2';
      if (!localStorage.getItem(CLEAN_FLAG)) {
        const appData = getAppData();
        if (appData && appData.library) {
          reformatLibrary(appData.library);
          persist();
          localStorage.setItem(CLEAN_FLAG, '1');
          console.info('One-time library cleanup applied.');
        }
      }
    } catch (e) {
      console.error('Forced library cleanup failed:', e);
    }
    updateUserChip();
    render();
  }

  document.getElementById('nav-home').addEventListener('click', () => {
    if (getActiveUserId()) navigate('home');
  });
  document.getElementById('btn-settings').addEventListener('click', showApiKeyModal);
  document.getElementById('user-chip').addEventListener('click', () => {
    navigate('user-select');
  });
});

function showApiKeyModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.remove('hidden');
  content.innerHTML = `
    <h3>设置 DeepSeek API Key</h3>
    <p class="modal-desc">填入你的 API Key 以启用 AI 优化功能</p>
    <input type="password" id="modal-apikey" placeholder="sk-..." value="${getApiKey()}" class="input-full">
    <div class="modal-actions">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">保存</button>
    </div>
  `;
  document.getElementById('modal-cancel').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('modal-save').addEventListener('click', () => {
    const key = document.getElementById('modal-apikey').value.trim();
    if (key) setApiKey(key);
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}
