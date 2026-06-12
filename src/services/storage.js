import { createAppData, createResume } from '../data/resume-schema.js';
import { runMigrations, LATEST_CONTENT_VERSION } from './migrations.js';

let STORAGE_KEY = null;
let _data = null;

export function initStorage(userId) {
  STORAGE_KEY = `resume-craft-v2-${userId}`;
  _data = null;
}

export function getAppData() {
  if (_data) return _data;
  if (!STORAGE_KEY) throw new Error('Storage not initialized. Call initStorage(userId) first.');
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    _data = JSON.parse(saved);
    // 版本更新后，自动把存量数据升级到最新内容版本
    const result = runMigrations(_data);
    if (result.upgraded) {
      save();
      if (result.applied.length) {
        console.info(`数据已从 v${result.from} 升级到 v${result.to}：`, result.applied.join('、'));
      }
    }
  } else {
    _data = createAppData();
    _data.contentVersion = LATEST_CONTENT_VERSION; // 新建数据即最新版本，无需迁移
    save();
  }
  return _data;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
}

// 批量修改 library 对象后调用，持久化当前内存数据
export function persist() {
  save();
}

// === Profile ===
export function getProfile() {
  return getAppData().profile;
}

export function saveProfile(profile) {
  _data.profile = { ..._data.profile, ...profile };
  save();
}

// === Library ===
export function getLibrary() {
  return getAppData().library;
}

export function addLibraryItem(type, item) {
  const lib = getAppData().library;
  const key = typeToKey(type);
  lib[key].push(item);
  save();
  return item;
}

export function updateLibraryItem(type, id, updates) {
  const lib = getAppData().library;
  const key = typeToKey(type);
  const idx = lib[key].findIndex(i => i.id === id);
  if (idx >= 0) {
    lib[key][idx] = { ...lib[key][idx], ...updates, updatedAt: new Date().toISOString() };
    save();
    return lib[key][idx];
  }
  return null;
}

export function removeLibraryItem(type, id) {
  const lib = getAppData().library;
  const key = typeToKey(type);
  lib[key] = lib[key].filter(i => i.id !== id);
  save();
}

export function reorderLibraryItems(type, fromId, toId) {
  const lib = getAppData().library;
  const key = typeToKey(type);
  const arr = lib[key];
  const fromIdx = arr.findIndex(i => i.id === fromId);
  const toIdx = arr.findIndex(i => i.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  save();
}

export function getLibraryItem(type, id) {
  const lib = getAppData().library;
  const key = typeToKey(type);
  return lib[key].find(i => i.id === id) || null;
}

export function getAllLibraryItems() {
  const lib = getAppData().library;
  return [
    ...lib.experiences.map(i => ({ ...i, _type: 'work' })),
    ...lib.projects.map(i => ({ ...i, _type: 'project' })),
    ...lib.education.map(i => ({ ...i, _type: 'education' })),
    ...lib.awards.map(i => ({ ...i, _type: 'award' }))
  ];
}

// === Resumes ===
export function getResumes() {
  return getAppData().resumes;
}

export function getResume(id) {
  return getAppData().resumes.find(r => r.id === id) || null;
}

export function createNewResume() {
  const resume = createResume();
  const profile = getProfile();
  resume.basic = { ...profile };
  getAppData().resumes.push(resume);
  save();
  return resume;
}

export function updateResume(id, updates) {
  const resumes = getAppData().resumes;
  const idx = resumes.findIndex(r => r.id === id);
  if (idx >= 0) {
    resumes[idx] = { ...resumes[idx], ...updates, updatedAt: new Date().toISOString() };
    save();
    return resumes[idx];
  }
  return null;
}

export function deleteResume(id) {
  const data = getAppData();
  data.resumes = data.resumes.filter(r => r.id !== id);
  save();
}

// === Settings ===
export function getApiKey() {
  return getAppData().settings.apiKey || '';
}

export function setApiKey(key) {
  getAppData().settings.apiKey = key;
  save();
}

// === Helpers ===
function typeToKey(type) {
  switch (type) {
    case 'work': return 'experiences';
    case 'project': return 'projects';
    case 'education': return 'education';
    case 'award': return 'awards';
    default: return 'experiences';
  }
}
