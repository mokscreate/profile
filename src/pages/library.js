import { navigate } from '../router.js';
import {
  getLibrary, addLibraryItem, updateLibraryItem, removeLibraryItem, reorderLibraryItems,
  getProfile, saveProfile, persist
} from '../services/storage.js';
import {
  createExperienceEntry, createProjectEntry,
  createEducationEntry, createAwardEntry, createBullet
} from '../data/resume-schema.js';
import { libraryToMarkdown } from '../services/export-md.js';
import { libraryToDocx } from '../services/export-docx.js';
import { downloadText } from '../services/download.js';
import { extractTextFromFile } from '../services/file-parse.js';
import { createVoiceInput, isVoiceSupported } from '../services/voice-input.js';
import { reformatLibrary, findDuplicates, detectProblems, cleanProblemValue } from '../services/library-cleanup.js';
import { cleanText as clean } from '../utils/text.js';

let activeTab = 'work';

export function renderLibrary(container) {
  const library = getLibrary();
  const profile = getProfile();

  container.innerHTML = `
    <div class="library-page">
      <div class="library-header">
        <button class="btn btn-ghost" id="lib-back">← 返回</button>
        <h2>我的经历库</h2>
        <div class="library-header-actions">
          <button class="btn btn-ghost btn-sm" id="lib-cleanup">🧹 整理</button>
          <button class="btn btn-ghost btn-sm" id="lib-export-md">导出整库 MD</button>
          <button class="btn btn-ghost btn-sm" id="lib-export-docx">导出整库 Word</button>
          <button class="btn btn-primary btn-sm" id="lib-ai-guide">✨ AI 润色</button>
        </div>
      </div>

      <div class="library-profile">
        <h3>基本信息</h3>
        <div class="profile-form">
          <div class="form-row">
            <input type="text" id="profile-name" placeholder="姓名" value="${esc(profile.name)}">
            <input type="text" id="profile-phone" placeholder="电话" value="${esc(profile.phone)}">
          </div>
          <div class="form-row">
            <input type="email" id="profile-email" placeholder="邮箱" value="${esc(profile.email)}">
            <input type="text" id="profile-location" placeholder="所在地" value="${esc(profile.location)}">
          </div>
        </div>
      </div>

      <div class="library-tabs">
        <button class="tab ${activeTab === 'work' ? 'active' : ''}" data-tab="work">工作经历 (${library.experiences.length})</button>
        <button class="tab ${activeTab === 'project' ? 'active' : ''}" data-tab="project">项目经历 (${library.projects.length})</button>
        <button class="tab ${activeTab === 'education' ? 'active' : ''}" data-tab="education">教育背景 (${library.education.length})</button>
        <button class="tab ${activeTab === 'award' ? 'active' : ''}" data-tab="award">荣誉奖项 (${library.awards.length})</button>
      </div>

      <div class="library-toolbar">
        <button class="btn btn-primary btn-sm" id="lib-add">+ 添加</button>
        <button class="btn btn-ghost btn-sm" id="lib-import">导入简历</button>
      </div>

      <div class="library-list" id="library-list"></div>
    </div>
  `;

  renderList(container);
  bindEvents(container);
}

function renderList(container) {
  const library = getLibrary();
  const listEl = container.querySelector('#library-list');
  let items = [];

  switch (activeTab) {
    case 'work': items = library.experiences; break;
    case 'project': items = library.projects; break;
    case 'education': items = library.education; break;
    case 'award': items = library.awards; break;
  }

  if (!items.length) {
    listEl.innerHTML = `<div class="empty-state">暂无${tabLabel(activeTab)}，点击上方按钮添加</div>`;
    return;
  }

  listEl.innerHTML = items.map(item => renderItem(item)).join('');

  listEl.querySelectorAll('.lib-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确定删除？')) {
        removeLibraryItem(activeTab, btn.dataset.id);
        renderList(container);
        updateTabCounts(container);
      }
    });
  });

  listEl.querySelectorAll('.lib-item').forEach(el => {
    el.addEventListener('click', () => {
      showEditForm(container, el.dataset.id);
    });
  });

  bindDragReorder(listEl, container);
}

function bindDragReorder(listEl, container) {
  let draggedId = null;

  listEl.querySelectorAll('.lib-item').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      draggedId = el.dataset.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      listEl.querySelectorAll('.lib-item').forEach(i => i.classList.remove('drag-over'));
      draggedId = null;
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (el.dataset.id !== draggedId) el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetId = el.dataset.id;
      if (draggedId && targetId && draggedId !== targetId) {
        reorderLibraryItems(activeTab, draggedId, targetId);
        renderList(container);
      }
    });
  });
}

function renderItem(item) {
  const title = item.company || item.name || item.school || item.title || '(未填写)';
  const subtitle = item.role || item.major || item.date || '';
  const dateStr = item.startDate ? `${item.startDate} - ${item.endDate || '至今'}` : '';
  const bulletCount = item.bullets ? item.bullets.filter(b => b.original).length : 0;
  const tags = item.tags || [];

  return `
    <div class="lib-item" data-id="${item.id}" draggable="true">
      <span class="lib-item-drag" title="拖拽排序">⠿</span>
      <div class="lib-item-main">
        <div class="lib-item-title">${esc(title)}${subtitle ? ' · ' + esc(subtitle) : ''}</div>
        <div class="lib-item-meta">
          ${dateStr ? `<span>${dateStr}</span>` : ''}
          ${bulletCount ? `<span>${bulletCount} 条描述</span>` : ''}
          ${tags.map(t => `<span class="tag-sm">${esc(t)}</span>`).join('')}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm lib-item-delete" data-id="${item.id}">删除</button>
    </div>
  `;
}

function showEditForm(container, id) {
  const library = getLibrary();
  let item = null;
  let key;
  switch (activeTab) {
    case 'work': item = library.experiences.find(i => i.id === id); key = 'experiences'; break;
    case 'project': item = library.projects.find(i => i.id === id); key = 'projects'; break;
    case 'education': item = library.education.find(i => i.id === id); key = 'education'; break;
    case 'award': item = library.awards.find(i => i.id === id); key = 'awards'; break;
  }
  if (!item) return;

  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.remove('hidden');

  if (activeTab === 'work' || activeTab === 'project') {
    const isWork = activeTab === 'work';
    content.innerHTML = `
      <h3>编辑${isWork ? '工作' : '项目'}经历</h3>
      <div class="edit-form">
        <div class="form-row">
          <input type="text" id="edit-main" placeholder="${isWork ? '公司名称' : '项目名称'}" value="${esc(isWork ? item.company : item.name)}">
          <input type="text" id="edit-role" placeholder="职位/角色" value="${esc(item.role)}">
        </div>
        <div class="form-row">
          <input type="text" id="edit-start" placeholder="开始时间 (如2026.4)" value="${esc(item.startDate)}">
          <input type="text" id="edit-end" placeholder="结束时间" value="${esc(item.endDate)}">
        </div>
        <div class="form-row">
          <input type="text" id="edit-tags" placeholder="标签 (逗号分隔)" value="${(item.tags || []).join(', ')}">
        </div>
        <div class="edit-bullets">
          <label>经历描述（每行一条）</label>
          <textarea id="edit-bullets" rows="6" placeholder="每行写一条经历描述...">${item.bullets.map(b => b.useEnhanced && b.enhanced ? b.enhanced : b.original).filter(Boolean).join('\n')}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="edit-cancel">取消</button>
          <button class="btn btn-primary" id="edit-save">保存</button>
        </div>
      </div>
    `;

    document.getElementById('edit-cancel').addEventListener('click', () => overlay.classList.add('hidden'));
    document.getElementById('edit-save').addEventListener('click', () => {
      const mainVal = document.getElementById('edit-main').value.trim();
      const roleVal = document.getElementById('edit-role').value.trim();
      const startVal = document.getElementById('edit-start').value.trim();
      const endVal = document.getElementById('edit-end').value.trim();
      const tagsVal = document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const bulletsText = document.getElementById('edit-bullets').value.split('\n').filter(l => l.trim());
      const bullets = bulletsText.map(text => {
        const existing = item.bullets.find(b => b.original === text || b.enhanced === text);
        return existing || { ...createBullet(), original: text };
      });
      if (!bullets.length) bullets.push(createBullet());

      const updates = {
        ...(isWork ? { company: mainVal } : { name: mainVal }),
        role: roleVal,
        startDate: startVal,
        endDate: endVal,
        tags: tagsVal,
        bullets
      };
      updateLibraryItem(activeTab, id, updates);
      overlay.classList.add('hidden');
      renderList(container);
    });
  } else if (activeTab === 'education') {
    content.innerHTML = `
      <h3>编辑教育背景</h3>
      <div class="edit-form">
        <div class="form-row">
          <input type="text" id="edit-school" placeholder="学校" value="${esc(item.school)}">
          <input type="text" id="edit-major" placeholder="专业" value="${esc(item.major)}">
        </div>
        <div class="form-row">
          <input type="text" id="edit-degree" placeholder="学位" value="${esc(item.degree)}">
          <input type="text" id="edit-gpa" placeholder="GPA" value="${esc(item.gpa)}">
        </div>
        <div class="form-row">
          <input type="text" id="edit-start" placeholder="开始时间" value="${esc(item.startDate)}">
          <input type="text" id="edit-end" placeholder="结束时间" value="${esc(item.endDate)}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="edit-cancel">取消</button>
          <button class="btn btn-primary" id="edit-save">保存</button>
        </div>
      </div>
    `;
    document.getElementById('edit-cancel').addEventListener('click', () => overlay.classList.add('hidden'));
    document.getElementById('edit-save').addEventListener('click', () => {
      updateLibraryItem('education', id, {
        school: document.getElementById('edit-school').value.trim(),
        major: document.getElementById('edit-major').value.trim(),
        degree: document.getElementById('edit-degree').value.trim(),
        gpa: document.getElementById('edit-gpa').value.trim(),
        startDate: document.getElementById('edit-start').value.trim(),
        endDate: document.getElementById('edit-end').value.trim()
      });
      overlay.classList.add('hidden');
      renderList(container);
    });
  } else {
    content.innerHTML = `
      <h3>编辑荣誉奖项</h3>
      <div class="edit-form">
        <div class="form-row">
          <input type="text" id="edit-title" placeholder="奖项名称" value="${esc(item.title)}">
          <input type="text" id="edit-date" placeholder="获奖时间" value="${esc(item.date)}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="edit-cancel">取消</button>
          <button class="btn btn-primary" id="edit-save">保存</button>
        </div>
      </div>
    `;
    document.getElementById('edit-cancel').addEventListener('click', () => overlay.classList.add('hidden'));
    document.getElementById('edit-save').addEventListener('click', () => {
      updateLibraryItem('award', id, {
        title: document.getElementById('edit-title').value.trim(),
        date: document.getElementById('edit-date').value.trim()
      });
      overlay.classList.add('hidden');
      renderList(container);
    });
  }
}

function bindEvents(container) {
  container.querySelector('#lib-back').addEventListener('click', () => navigate('home'));

  container.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      renderList(container);
    });
  });

  container.querySelector('#lib-add').addEventListener('click', () => {
    let item;
    switch (activeTab) {
      case 'work': item = createExperienceEntry(); break;
      case 'project': item = createProjectEntry(); break;
      case 'education': item = createEducationEntry(); break;
      case 'award': item = createAwardEntry(); break;
    }
    addLibraryItem(activeTab, item);
    renderList(container);
    updateTabCounts(container);
    showEditForm(container, item.id);
  });

  container.querySelector('#lib-import').addEventListener('click', () => showImportModal(container));

  container.querySelector('#lib-cleanup').addEventListener('click', () => runCleanup(container));

  container.querySelector('#lib-ai-guide').addEventListener('click', () => {
    navigate('polish');
  });

  container.querySelector('#lib-export-md').addEventListener('click', () => {
    const profile = getProfile();
    const library = getLibrary();
    const md = libraryToMarkdown(profile, library);
    downloadText(md, `${profile.name || '经历库'}_经历库.md`);
  });

  container.querySelector('#lib-export-docx').addEventListener('click', () => {
    const profile = getProfile();
    const library = getLibrary();
    libraryToDocx(profile, library);
  });

  // Profile auto-save
  ['profile-name', 'profile-phone', 'profile-email', 'profile-location'].forEach(id => {
    const el = container.querySelector(`#${id}`);
    if (el) {
      el.addEventListener('change', () => {
        saveProfile({
          name: container.querySelector('#profile-name').value.trim(),
          phone: container.querySelector('#profile-phone').value.trim(),
          email: container.querySelector('#profile-email').value.trim(),
          location: container.querySelector('#profile-location').value.trim()
        });
      });
    }
  });
}

function runCleanup(container) {
  const library = getLibrary();
  const stats = reformatLibrary(library);
  const problems = detectProblems(library);
  persist();
  const dups = findDuplicates(library);
  renderList(container);
  showCleanupModal(container, stats, dups, problems);
}

function showCleanupModal(container, stats, dups, problems = []) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.remove('hidden');

  const fmtMsg = stats.total
    ? `已重整格式：清理字段 ${stats.fieldsCleaned} 处、描述 ${stats.bulletsCleaned} 处，移除空白/重复描述 ${stats.bulletsRemoved} 条。`
    : '格式已经很干净，无需整理。';

  const dupHtml = dups.length
    ? `
      <p class="modal-desc" style="margin-top:16px">发现 ${dups.length} 组疑似重复，勾选要删除的条目（每组建议保留一条）：</p>
      <div class="dup-list">
        ${dups.map((g, gi) => `
          <div class="dup-group">
            <div class="dup-group-title">${g.typeLabel}</div>
            ${g.items.map((it, ii) => `
              <label class="dup-item">
                <input type="checkbox" data-type="${g.type}" data-id="${it.id}" ${ii === 0 ? '' : 'checked'}>
                <span class="dup-item-title">${esc(it.title)}</span>
                <span class="dup-item-meta">${it.bulletCount} 条描述</span>
              </label>
            `).join('')}
          </div>
        `).join('')}
      </div>`
    : `<p class="modal-desc" style="margin-top:16px">✅ 未发现疑似重复条目。</p>`;

  content.innerHTML = `
    <h3>🧹 整理经历库</h3>
    <p class="modal-desc">${fmtMsg}</p>
    ${dupHtml}
    ${problems.length ? `
      <p class="modal-desc" style="margin-top:16px">发现 ${problems.length} 条可能导致显示/格式问题的内容，勾选后可选择「清理文本」或「删除条目」：</p>
      <div class="dup-list">
        ${problems.map((p, pi) => `
          <div class="dup-group">
            <div class="dup-group-title">${p.type} · ${esc(p.field)}</div>
            <label class="dup-item">
              <input type="checkbox" class="problem-cb" data-type="${p.type}" data-id="${p.id}" data-field="${p.field}" data-idx="${pi}" checked>
              <span class="dup-item-title">${esc((p.value||'').slice(0,80))}${(p.value||'').length>80? '...':''}</span>
              <span class="dup-item-meta">${p.issue === 'html' ? '包含 HTML' : '包含不可见字符'}</span>
            </label>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="modal-actions">
      <button class="btn btn-secondary" id="cleanup-close">完成</button>
      ${dups.length ? `<button class="btn btn-primary" id="cleanup-apply">删除勾选项</button>` : ''}
      ${problems.length ? `<button class="btn btn-primary" id="cleanup-clean">清理勾选项</button>` : ''}
    </div>
  `;

  document.getElementById('cleanup-close').addEventListener('click', () => overlay.classList.add('hidden'));

  const applyBtn = document.getElementById('cleanup-apply');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const checked = content.querySelectorAll('.dup-item input:checked');
      let removed = 0;
      checked.forEach(cb => {
        removeLibraryItem(cb.dataset.type, cb.dataset.id);
        removed++;
      });
      overlay.classList.add('hidden');
      renderLibrary(container);
      if (removed) alert(`已删除 ${removed} 个重复条目`);
    });
  }

  const cleanBtn = document.getElementById('cleanup-clean');
  if (cleanBtn) {
    cleanBtn.addEventListener('click', () => {
      const checked = content.querySelectorAll('.problem-cb:checked');
      const lib = getLibrary();
      let cleaned = 0;
      checked.forEach(cb => {
        const type = cb.dataset.type;
        const id = cb.dataset.id;
        const field = cb.dataset.field;
        const item = (lib[type] || []).find(i => i.id === id);
        if (!item) return;
        if (field === 'bullets') {
          item.bullets = (item.bullets || []).map(b => ({ ...b, original: cleanProblemValue(b.original), enhanced: cleanProblemValue(b.enhanced) }));
        } else {
          item[field] = cleanProblemValue(item[field]);
        }
        cleaned++;
      });
      if (cleaned) persist();
      overlay.classList.add('hidden');
      renderLibrary(container);
      if (cleaned) alert(`已清理 ${cleaned} 个字段/条目`);
    });
  }
}

function showImportModal(container) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.remove('hidden');
  content.innerHTML = `
    <h3>导入简历</h3>
    <p class="modal-desc">上传文件（PDF / Word / txt）、粘贴文本，或语音口述，AI 将自动提取经历信息</p>
    <label class="import-upload" id="import-drop">
      <input type="file" id="import-file" accept=".pdf,.docx,.txt,.md" hidden>
      <span class="import-upload-icon">📄</span>
      <span class="import-upload-text">点击选择文件，或拖拽文件到这里</span>
      <span class="import-upload-hint">支持 PDF、Word(.docx)、txt</span>
    </label>
    <div class="import-text-wrap">
      <textarea id="import-text" rows="9" placeholder="也可以直接粘贴简历全文，或点击右下角 🎤 语音口述..." class="input-full"></textarea>
      ${isVoiceSupported() ? `<button class="voice-btn" id="import-voice" title="语音输入" type="button">🎤</button>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="import-cancel">取消</button>
      <button class="btn btn-primary" id="import-submit">AI 提取</button>
    </div>
  `;

  const fileInput = document.getElementById('import-file');
  const dropZone = document.getElementById('import-drop');
  const textArea = document.getElementById('import-text');

  // 语音输入
  const voiceBtn = document.getElementById('import-voice');
  if (voiceBtn) {
    let baseText = '';
    const voice = createVoiceInput({
      onText: (finalText, interim) => {
        textArea.value = (baseText ? baseText + '\n' : '') + finalText + interim;
        textArea.scrollTop = textArea.scrollHeight;
      },
      onState: (listening) => {
        voiceBtn.classList.toggle('recording', listening);
        voiceBtn.title = listening ? '点击停止' : '语音输入';
        if (listening && textArea.value.trim()) baseText = textArea.value.trim();
      },
      onError: (msg) => { voiceBtn.classList.remove('recording'); alert(msg); }
    });
    voiceBtn.addEventListener('click', () => {
      if (voiceBtn.classList.contains('recording')) voice.stop();
      else { baseText = textArea.value.trim(); voice.start(); }
    });
  }

  async function handleFile(file) {
    if (!file) return;
    const hintEl = dropZone.querySelector('.import-upload-text');
    const originalHint = hintEl.textContent;
    hintEl.textContent = `正在解析「${file.name}」...`;
    dropZone.classList.add('loading');
    try {
      const text = await extractTextFromFile(file);
      textArea.value = text;
      hintEl.textContent = `已解析「${file.name}」，可编辑后点击「AI 提取」`;
    } catch (err) {
      hintEl.textContent = originalHint;
      alert('文件解析失败：' + err.message);
    } finally {
      dropZone.classList.remove('loading');
    }
  }

  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });

  document.getElementById('import-cancel').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('import-submit').addEventListener('click', async () => {
    const text = textArea.value.trim();
    if (!text) return;
    document.getElementById('import-submit').textContent = '提取中...';
    document.getElementById('import-submit').disabled = true;
    try {
      await importFromText(text);
      overlay.classList.add('hidden');
      renderLibrary(container);
      if (confirm('简历已导入！是否立即用 AI 润色完善经历描述？')) {
        navigate('polish');
      }
    } catch (err) {
      alert('提取失败: ' + err.message);
      document.getElementById('import-submit').textContent = 'AI 提取';
      document.getElementById('import-submit').disabled = false;
    }
  });
}

async function importFromText(text) {
  const { callDeepSeek } = await import('../services/deepseek.js');
  const prompt = `请从以下简历文本中提取结构化信息，以JSON格式返回。格式如下：
{
  "profile": { "name": "", "phone": "", "email": "", "location": "" },
  "experiences": [{ "company": "", "role": "", "startDate": "", "endDate": "", "bullets": [""] }],
  "projects": [{ "name": "", "role": "", "startDate": "", "endDate": "", "bullets": [""] }],
  "education": [{ "school": "", "major": "", "degree": "", "gpa": "", "startDate": "", "endDate": "" }],
  "awards": [{ "title": "", "date": "" }]
}

要求：
1. 只提取纯文本内容，不要保留原文的项目符号(• · - * ▪)、序号(1. 一、)、制表符、多余空格或换行等排版格式。
2. 每条 bullet 是一句完整、干净的描述，去掉行首符号。
3. 日期统一为 YYYY-MM 或 YYYY 格式（如 2025-09、2025）。
4. 找不到的字段留空字符串，不要编造。

简历内容：
${text}

只返回JSON，不要其他文字。`;

  const response = await callDeepSeek([
    { role: 'system', content: '你是一个简历信息提取助手，只输出干净的纯文本内容JSON，不保留任何原始排版格式。' },
    { role: 'user', content: prompt }
  ], { maxTokens: 8000, temperature: 0.3, jsonMode: true });

  const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  if (parsed.profile) {
    const { getProfile, saveProfile: sp } = await import('../services/storage.js');
    const current = getProfile();
    if (!current.name && parsed.profile.name) {
      sp({
        name: clean(parsed.profile.name),
        phone: clean(parsed.profile.phone),
        email: clean(parsed.profile.email),
        location: clean(parsed.profile.location)
      });
    }
  }

  if (parsed.experiences) {
    for (const exp of parsed.experiences) {
      const entry = createExperienceEntry();
      entry.company = clean(exp.company);
      entry.role = clean(exp.role);
      entry.startDate = clean(exp.startDate);
      entry.endDate = clean(exp.endDate);
      entry.bullets = cleanBullets(exp.bullets);
      addLibraryItem('work', entry);
    }
  }

  if (parsed.projects) {
    for (const proj of parsed.projects) {
      const entry = createProjectEntry();
      entry.name = clean(proj.name);
      entry.role = clean(proj.role);
      entry.startDate = clean(proj.startDate);
      entry.endDate = clean(proj.endDate);
      entry.bullets = cleanBullets(proj.bullets);
      addLibraryItem('project', entry);
    }
  }

  if (parsed.education) {
    for (const edu of parsed.education) {
      const entry = createEducationEntry();
      entry.school = clean(edu.school);
      entry.major = clean(edu.major);
      entry.degree = clean(edu.degree);
      entry.gpa = clean(edu.gpa);
      entry.startDate = clean(edu.startDate);
      entry.endDate = clean(edu.endDate);
      addLibraryItem('education', entry);
    }
  }

  if (parsed.awards) {
    for (const award of parsed.awards) {
      const entry = createAwardEntry();
      entry.title = clean(award.title);
      entry.date = clean(award.date);
      addLibraryItem('award', entry);
    }
  }
}


// 清洗 bullet 数组，过滤空项，保证至少一条
function cleanBullets(bullets) {
  const cleaned = (bullets || [])
    .map(b => clean(b))
    .filter(Boolean)
    .map(text => ({ ...createBullet(), original: text }));
  return cleaned.length ? cleaned : [createBullet()];
}

function updateTabCounts(container) {
  const library = getLibrary();
  const tabs = container.querySelectorAll('.tab');
  const counts = {
    work: library.experiences.length,
    project: library.projects.length,
    education: library.education.length,
    award: library.awards.length
  };
  tabs.forEach(tab => {
    const type = tab.dataset.tab;
    tab.textContent = `${tabLabel(type)} (${counts[type]})`;
  });
}

function tabLabel(type) {
  switch (type) {
    case 'work': return '工作经历';
    case 'project': return '项目经历';
    case 'education': return '教育背景';
    case 'award': return '荣誉奖项';
    default: return '';
  }
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
