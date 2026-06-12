import { callDeepSeek } from '../services/deepseek.js';
import { getLibrary, getApiKey, updateLibraryItem } from '../services/storage.js';
import { createBullet } from '../data/resume-schema.js';

let currentResume = null;
let onUpdate = null;

export function initAiPanel(container, resume, updateCallback) {
  currentResume = resume;
  onUpdate = updateCallback;

  if (!container) return;

  const selectedIds = [
    ...resume.selectedExperiences,
    ...resume.selectedProjects
  ];

  if (!selectedIds.length) {
    container.innerHTML = '<p class="text-muted text-sm">请先选择经历条目</p>';
    return;
  }

  const library = getLibrary();
  const items = [
    ...resume.selectedExperiences.map(id => library.experiences.find(e => e.id === id)).filter(Boolean),
    ...resume.selectedProjects.map(id => library.projects.find(p => p.id === id)).filter(Boolean)
  ];

  container.innerHTML = `
    <div class="ai-panel">
      <div class="ai-mode-tabs">
        <button class="ai-mode active" data-mode="batch">批量追问</button>
        <button class="ai-mode" data-mode="chat">对话式引导</button>
      </div>
      <div class="ai-item-list">
        ${items.map(item => `
          <div class="ai-item" data-id="${item.id}" data-type="${item.type}">
            <span>${esc(item.company || item.name)} · ${esc(item.role)}</span>
            <button class="btn btn-xs btn-primary ai-optimize-btn" data-id="${item.id}" data-type="${item.type}">优化</button>
          </div>
        `).join('')}
      </div>
      <div id="ai-workspace"></div>
    </div>
  `;

  let currentMode = 'batch';
  container.querySelectorAll('.ai-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      container.querySelectorAll('.ai-mode').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('ai-workspace').innerHTML = '';
    });
  });

  container.querySelectorAll('.ai-optimize-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      const lib = getLibrary();
      const item = type === 'work'
        ? lib.experiences.find(e => e.id === id)
        : lib.projects.find(p => p.id === id);
      if (!item) return;

      if (currentMode === 'batch') {
        startBatchMode(item);
      } else {
        startChatMode(item);
      }
    });
  });
}

async function startBatchMode(item) {
  const workspace = document.getElementById('ai-workspace');
  if (!getApiKey()) {
    workspace.innerHTML = '<p class="text-error">请先设置 API Key</p>';
    return;
  }

  const bullets = item.bullets.filter(b => b.original.trim());
  if (!bullets.length) {
    workspace.innerHTML = '<p class="text-muted text-sm">该经历没有描述内容，请先在经历库中填写</p>';
    return;
  }

  workspace.innerHTML = `
    <div class="ai-batch">
      <div class="ai-status">AI 正在分析 ${bullets.length} 条描述...</div>
      <div id="ai-batch-results"></div>
    </div>
  `;

  try {
    const context = buildContext(item);
    const bulletsText = bullets.map((b, i) => `${i + 1}. ${b.original}`).join('\n');
    const prompt = `我是一位求职者，以下是我在"${item.company || item.name}"担任"${item.role}"期间的经历描述：

${bulletsText}

${context}

请对每一条逐一分析，针对以下维度提出追问：
- 量化数据（具体数字、百分比、规模）
- 具体角色（主导还是参与，独立还是团队）
- 技术/方法选择（为什么用这个方案）
- 成果影响（对业务/团队/产品的影响）

每条给出1-2个最关键的追问。格式：
[第1条] 问题...
[第2条] 问题...`;

    const response = await callDeepSeek([
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    const resultsEl = document.getElementById('ai-batch-results');
    workspace.querySelector('.ai-status').textContent = 'AI 追问如下，请回答后生成优化版本：';

    resultsEl.innerHTML = `
      <div class="ai-questions">${formatResponse(response)}</div>
      <textarea id="ai-batch-answers" rows="4" placeholder="在这里统一回答上述问题..." class="input-full"></textarea>
      <div class="ai-batch-actions">
        <button class="btn btn-primary btn-sm" id="ai-batch-rewrite">生成优化版</button>
        <button class="btn btn-ghost btn-sm" id="ai-batch-stop">结束</button>
      </div>
    `;

    document.getElementById('ai-batch-stop').addEventListener('click', () => {
      workspace.innerHTML = '';
    });

    document.getElementById('ai-batch-rewrite').addEventListener('click', async () => {
      const answers = document.getElementById('ai-batch-answers').value.trim();
      if (!answers) return;
      await batchRewrite(item, bullets, response, answers, workspace);
    });
  } catch (err) {
    workspace.innerHTML = `<p class="text-error">出错: ${esc(err.message)}</p>`;
  }
}

async function batchRewrite(item, bullets, questions, answers, workspace) {
  workspace.innerHTML = '<div class="ai-status">AI 正在重写...</div><div id="ai-batch-results"></div>';

  try {
    const context = buildContext(item);
    const prompt = `原始经历描述：
${bullets.map((b, i) => `${i + 1}. ${b.original}`).join('\n')}

AI之前的追问：
${questions}

用户的回答：
${answers}

${context}

请根据以上信息，重写每一条经历为专业的简历 bullet point。
要求：动词开头，包含量化数据（如有），15-50字，专业简洁。
格式：每行一条，与原始顺序一一对应。不要编号，不要解释。`;

    const response = await callDeepSeek([
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    const rewritten = response.split('\n').filter(l => l.trim());
    const resultsEl = document.getElementById('ai-batch-results');
    workspace.querySelector('.ai-status').textContent = '优化结果：';

    resultsEl.innerHTML = bullets.map((b, i) => `
      <div class="ai-result-item">
        <div class="ai-result-original"><span class="label">原始：</span>${esc(b.original)}</div>
        <div class="ai-result-enhanced"><span class="label">优化：</span>${esc(rewritten[i] || b.original)}</div>
        <div class="ai-result-actions">
          <button class="btn btn-xs btn-primary ai-accept" data-idx="${i}">采用</button>
          <button class="btn btn-xs btn-ghost ai-refine" data-idx="${i}">再改改</button>
          <button class="btn btn-xs btn-ghost ai-reject" data-idx="${i}">不用</button>
        </div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.ai-accept').forEach(btn => {
      const idx = parseInt(btn.dataset.idx);
      btn.addEventListener('click', () => {
        bullets[idx].enhanced = rewritten[idx] || '';
        bullets[idx].useEnhanced = true;
        updateLibraryItem(item.type, item.id, { bullets: item.bullets });
        btn.closest('.ai-result-item').classList.add('accepted');
        btn.textContent = '已采用';
        btn.disabled = true;
        if (onUpdate) onUpdate();
      });
    });

    resultsEl.querySelectorAll('.ai-reject').forEach(btn => {
      const idx = parseInt(btn.dataset.idx);
      btn.addEventListener('click', () => {
        btn.closest('.ai-result-item').classList.add('rejected');
      });
    });

    resultsEl.querySelectorAll('.ai-refine').forEach(btn => {
      const idx = parseInt(btn.dataset.idx);
      btn.addEventListener('click', () => {
        startRefine(item, bullets[idx], rewritten[idx], btn.closest('.ai-result-item'));
      });
    });
  } catch (err) {
    workspace.innerHTML = `<p class="text-error">出错: ${esc(err.message)}</p>`;
  }
}

function startRefine(item, bullet, currentVersion, container) {
  const refineEl = document.createElement('div');
  refineEl.className = 'ai-refine-box';
  refineEl.innerHTML = `
    <input type="text" class="input-full" placeholder="告诉AI怎么改，如：加上用户量数据" id="refine-input">
    <button class="btn btn-xs btn-primary" id="refine-send">发送</button>
  `;
  container.appendChild(refineEl);

  document.getElementById('refine-send').addEventListener('click', async () => {
    const instruction = document.getElementById('refine-input').value.trim();
    if (!instruction) return;

    refineEl.innerHTML = '<span class="text-muted text-sm">AI 修改中...</span>';

    try {
      const prompt = `当前版本：${currentVersion}
用户要求：${instruction}
请根据要求修改这条 bullet point。只输出修改后的文本，不要解释。`;

      const response = await callDeepSeek([
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: prompt }
      ]);

      const refined = response.trim();
      refineEl.innerHTML = `
        <div class="ai-result-enhanced"><span class="label">新版：</span>${esc(refined)}</div>
        <button class="btn btn-xs btn-primary refine-accept">采用</button>
        <button class="btn btn-xs btn-ghost refine-again">再改</button>
      `;

      refineEl.querySelector('.refine-accept').addEventListener('click', () => {
        bullet.enhanced = refined;
        bullet.useEnhanced = true;
        updateLibraryItem(item.type, item.id, { bullets: item.bullets });
        container.classList.add('accepted');
        refineEl.innerHTML = '<span class="text-muted text-sm">已采用</span>';
        if (onUpdate) onUpdate();
      });

      refineEl.querySelector('.refine-again').addEventListener('click', () => {
        startRefine(item, bullet, refined, container);
        refineEl.remove();
      });
    } catch (err) {
      refineEl.innerHTML = `<span class="text-error">${esc(err.message)}</span>`;
    }
  });
}

async function startChatMode(item) {
  const workspace = document.getElementById('ai-workspace');
  if (!getApiKey()) {
    workspace.innerHTML = '<p class="text-error">请先设置 API Key</p>';
    return;
  }

  const conversation = [];
  const context = buildContext(item);

  workspace.innerHTML = `
    <div class="ai-chat-box">
      <div class="ai-chat-messages" id="chat-msgs"></div>
      <div class="ai-chat-input-row">
        <input type="text" id="chat-input" placeholder="描述你在这段经历中做了什么..." class="input-grow">
        <button class="btn btn-sm btn-primary" id="chat-send">发送</button>
        <button class="btn btn-sm btn-accent" id="chat-finish">结束生成</button>
      </div>
    </div>
  `;

  const msgsEl = document.getElementById('chat-msgs');
  msgsEl.innerHTML = `<div class="ai-message assistant"><div class="ai-message-content">你好！请告诉我你在 <strong>${esc(item.company || item.name)}</strong> 做 <strong>${esc(item.role)}</strong> 期间的主要工作，我会通过追问帮你挖掘亮点并生成专业的简历描述。<br><br>你可以：<br>• 简单说几句你做了什么<br>• 打几个关键词/标签<br>• 或者直接粘贴你已有的描述</div></div>`;

  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const finishBtn = document.getElementById('chat-finish');

  const sendMessage = async () => {
    const text = inputEl.value.trim();
    if (!text) return;

    conversation.push({ role: 'user', content: text });
    msgsEl.innerHTML += `<div class="ai-message user"><div class="ai-message-content">${esc(text)}</div></div>`;
    inputEl.value = '';

    msgsEl.innerHTML += '<div class="ai-loading">AI 思考中...</div>';
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      const prompt = conversation.length <= 2
        ? `用户描述了在"${item.company || item.name}"担任"${item.role}"的工作内容。
${context}

请基于用户说的内容，从以下维度追问1-2个关键问题来挖掘更多细节：
- 量化数据（具体数字、百分比、规模）
- 具体角色（主导还是参与）
- 技术/方法选择
- 成果影响

用户说：${text}

友好、简短地追问，中文回复。`
        : `继续对话。用户又提供了新信息。如果已经有足够信息生成 bullet points，就回复"我已经有足够信息了，点击'结束生成'即可获得优化结果。"否则继续追问。

用户回复：${text}`;

      const response = await callDeepSeek([
        { role: 'system', content: getSystemPrompt() },
        ...conversation.slice(-6),
        { role: 'user', content: prompt }
      ]);

      conversation.push({ role: 'assistant', content: response });
      const loading = msgsEl.querySelector('.ai-loading');
      if (loading) loading.remove();

      msgsEl.innerHTML += `<div class="ai-message assistant"><div class="ai-message-content">${formatResponse(response)}</div></div>`;
      msgsEl.scrollTop = msgsEl.scrollHeight;
    } catch (err) {
      const loading = msgsEl.querySelector('.ai-loading');
      if (loading) loading.remove();
      msgsEl.innerHTML += `<div class="ai-message error"><div class="ai-message-content">${esc(err.message)}</div></div>`;
    }
  };

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

  finishBtn.addEventListener('click', async () => {
    if (conversation.length < 2) {
      alert('请先和 AI 对话，提供一些经历信息');
      return;
    }
    await generateFromChat(item, conversation, workspace);
  });
}

async function generateFromChat(item, conversation, workspace) {
  workspace.innerHTML = '<div class="ai-status">AI 正在根据对话生成 bullet points...</div><div id="ai-chat-results"></div>';

  try {
    const context = buildContext(item);
    const convoText = conversation.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n');
    const prompt = `基于以下对话内容，为用户在"${item.company || item.name}"担任"${item.role}"期间的经历生成3-5条专业的简历 bullet points。

对话记录：
${convoText}

${context}

要求：
- 动词开头（主导、设计、优化、推动、搭建等）
- 包含量化数据
- 每条15-50字
- 按重要性排序
- 只输出 bullet points，每行一条，不要编号和解释`;

    const response = await callDeepSeek([
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    const newBullets = response.split('\n').filter(l => l.trim());
    const resultsEl = document.getElementById('ai-chat-results');
    workspace.querySelector('.ai-status').textContent = '生成结果（可逐条采用或修改）：';

    resultsEl.innerHTML = newBullets.map((text, i) => `
      <div class="ai-result-item">
        <div class="ai-result-enhanced">${esc(text)}</div>
        <div class="ai-result-actions">
          <button class="btn btn-xs btn-primary chat-accept" data-idx="${i}">采用</button>
          <button class="btn btn-xs btn-ghost chat-refine" data-idx="${i}">再改改</button>
        </div>
      </div>
    `).join('') + `<button class="btn btn-sm btn-primary" id="chat-accept-all" style="margin-top:12px">全部采用</button>`;

    document.getElementById('chat-accept-all').addEventListener('click', () => {
      item.bullets = newBullets.map(text => ({ ...createBullet(), original: text, enhanced: text, useEnhanced: true }));
      updateLibraryItem(item.type, item.id, { bullets: item.bullets });
      resultsEl.innerHTML = '<p class="text-muted text-sm">已全部采用，经历库已更新</p>';
      if (onUpdate) onUpdate();
    });

    resultsEl.querySelectorAll('.chat-accept').forEach(btn => {
      const idx = parseInt(btn.dataset.idx);
      btn.addEventListener('click', () => {
        const bullet = createBullet();
        bullet.original = newBullets[idx];
        bullet.enhanced = newBullets[idx];
        bullet.useEnhanced = true;
        item.bullets.push(bullet);
        updateLibraryItem(item.type, item.id, { bullets: item.bullets });
        btn.textContent = '已采用';
        btn.disabled = true;
        if (onUpdate) onUpdate();
      });
    });

    resultsEl.querySelectorAll('.chat-refine').forEach(btn => {
      const idx = parseInt(btn.dataset.idx);
      btn.addEventListener('click', () => {
        const tempBullet = { ...createBullet(), original: newBullets[idx], enhanced: newBullets[idx] };
        startRefine(item, tempBullet, newBullets[idx], btn.closest('.ai-result-item'));
      });
    });
  } catch (err) {
    workspace.innerHTML = `<p class="text-error">生成失败: ${esc(err.message)}</p>`;
  }
}

function buildContext(item) {
  const library = getLibrary();
  const parts = [];

  if (currentResume?.targetRole) {
    parts.push(`目标岗位：${currentResume.targetRole}`);
  }
  if (currentResume?.jd) {
    parts.push(`目标JD关键信息：${currentResume.jd.slice(0, 300)}`);
  }

  const otherExp = library.experiences
    .filter(e => e.id !== item.id && e.company)
    .map(e => `${e.company}-${e.role}`)
    .slice(0, 5);
  const otherProj = library.projects
    .filter(p => p.id !== item.id && p.name)
    .map(p => p.name)
    .slice(0, 5);
  if (otherExp.length || otherProj.length) {
    parts.push(`其他经历：${[...otherExp, ...otherProj].join('、')}（避免与这些经历的描述重复）`);
  }

  const totalBullets = [
    ...library.experiences.flatMap(e => e.bullets),
    ...library.projects.flatMap(p => p.bullets)
  ].filter(b => b.original).length;
  if (totalBullets > 15) {
    parts.push(`简历已有${totalBullets}条描述，建议当前经历精简为3-4条核心亮点`);
  }

  return parts.length ? '\n背景信息：\n' + parts.join('\n') : '';
}

function getSystemPrompt() {
  return `你是一个专业的简历优化助手，帮助求职者挖掘经历亮点并生成专业 bullet points。

规则：
1. 使用STAR法则（情境-任务-行动-结果）
2. 优先使用数据量化结果
3. 动词开头（主导、设计、优化、推动、搭建、负责等）
4. 每条bullet在15-50个中文字之间
5. 语言风格：专业简洁，避免口语化
6. 根据目标岗位调整侧重点
7. 不同经历间避免重复表述`;
}

function formatResponse(text) {
  return esc(text).replace(/\n/g, '<br>');
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
