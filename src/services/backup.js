// 本地数据备份 / 恢复：把当前档案的全部数据导出为 JSON 文件，
// 在另一台设备导入还原。纯本地，不依赖任何服务器。

import { exportData, replaceData } from './storage.js';
import { getActiveUser } from './user-manager.js';
import { downloadText } from './download.js';

const BACKUP_TYPE = 'resume-craft-backup';

export function exportBackup() {
  const data = exportData();
  // 不导出 API Key，避免备份文件外传时泄露
  const safe = { ...data, settings: { ...(data.settings || {}), apiKey: '' } };
  const user = getActiveUser();
  const payload = {
    _type: BACKUP_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    userName: user?.name || '',
    data: safe
  };
  const filename = `${user?.name || '简历数据'}_备份_${tsForName()}.json`;
  downloadText(JSON.stringify(payload, null, 2), filename);
}

// 解析并校验备份内容；返回可写入的 appData（不写入，交给调用方确认后再 apply）
export function parseBackup(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('文件格式不对，不是有效的 JSON 备份文件');
  }

  // 兼容：包装格式（推荐）或裸 appData
  const data = parsed && parsed._type === BACKUP_TYPE ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || !data.library || !Array.isArray(data.resumes)) {
    throw new Error('这不是 Resume Craft 的备份文件');
  }
  return { data, meta: { userName: parsed?.userName || '', exportedAt: parsed?.exportedAt || '' } };
}

// 用解析后的数据覆盖当前档案
export function applyBackup(data) {
  // 保留当前设备已设置的 API Key（备份里通常不含）
  const current = exportData();
  if (!data.settings) data.settings = {};
  if (!data.settings.apiKey && current.settings?.apiKey) {
    data.settings.apiKey = current.settings.apiKey;
  }
  replaceData(data);
}

function tsForName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
