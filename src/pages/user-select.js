import { getUsers, createUser, deleteUser, setActiveUser, DEFAULT_EMOJIS } from '../services/user-manager.js';

export function renderUserSelect(container, onUserSelected) {
  const users = getUsers();

  container.innerHTML = `
    <div class="user-select-page">
      <div class="user-select-header">
        <h1>Resume Craft</h1>
        <p class="user-select-subtitle">选择你的档案</p>
      </div>
      <div class="user-grid" id="user-grid">
        ${users.map(u => `
          <div class="user-card" data-user-id="${u.id}">
            <span class="user-emoji">${u.emoji}</span>
            <span class="user-name">${esc(u.name)}</span>
            <button class="user-delete" data-delete-id="${u.id}" title="删除">&times;</button>
          </div>
        `).join('')}
        <div class="user-card user-card-new" id="btn-new-user">
          <span class="user-emoji">+</span>
          <span class="user-name">新建档案</span>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.user-card[data-user-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('user-delete')) return;
      const userId = card.dataset.userId;
      setActiveUser(userId);
      onUserSelected(userId);
    });
  });

  container.querySelectorAll('.user-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteId;
      const user = users.find(u => u.id === id);
      if (confirm(`确定删除「${user.name}」的所有数据？此操作不可恢复。`)) {
        deleteUser(id);
        renderUserSelect(container, onUserSelected);
      }
    });
  });

  document.getElementById('btn-new-user').addEventListener('click', () => {
    showCreateModal(container, onUserSelected);
  });
}

function showCreateModal(container, onUserSelected) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.remove('hidden');

  let selectedEmoji = DEFAULT_EMOJIS[Math.floor(Math.random() * DEFAULT_EMOJIS.length)];

  content.innerHTML = `
    <h3>新建档案</h3>
    <p class="modal-desc">输入名字，选一个头像</p>
    <div class="emoji-picker" id="emoji-picker">
      ${DEFAULT_EMOJIS.map(e => `
        <button class="emoji-option ${e === selectedEmoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>
      `).join('')}
    </div>
    <input type="text" id="new-user-name" placeholder="你的名字" class="input-full" autofocus>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-create">创建</button>
    </div>
  `;

  content.querySelectorAll('.emoji-option').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEmoji = btn.dataset.emoji;
    });
  });

  document.getElementById('modal-cancel').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  document.getElementById('modal-create').addEventListener('click', () => {
    const name = document.getElementById('new-user-name').value.trim();
    if (!name) {
      document.getElementById('new-user-name').focus();
      return;
    }
    const user = createUser(name, selectedEmoji);
    setActiveUser(user.id);
    overlay.classList.add('hidden');
    onUserSelected(user.id);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
