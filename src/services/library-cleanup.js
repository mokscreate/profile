// 经历库「整理」：① 重整格式 ② 检测疑似重复项。纯本地逻辑，不调用 AI。

import { cleanText, normalizeForCompare } from '../utils/text.js';

const FIELDS = {
  experiences: ['company', 'role', 'startDate', 'endDate'],
  projects: ['name', 'role', 'startDate', 'endDate'],
  education: ['school', 'major', 'degree', 'gpa', 'startDate', 'endDate'],
  awards: ['title', 'date']
};

// 对整个 library 原地重整格式，返回改动统计（调用方负责 persist）
export function reformatLibrary(library) {
  let fieldsCleaned = 0;
  let bulletsCleaned = 0;
  let bulletsRemoved = 0;

  for (const key of Object.keys(FIELDS)) {
    for (const item of library[key] || []) {
      for (const f of FIELDS[key]) {
        if (typeof item[f] === 'string') {
          const c = cleanText(item[f]);
          if (c !== item[f]) { item[f] = c; fieldsCleaned++; }
        }
      }

      if (Array.isArray(item.tags)) {
        const before = item.tags.join('||');
        item.tags = item.tags.map(cleanText).filter(Boolean);
        if (item.tags.join('||') !== before) fieldsCleaned++;
      }

      if (Array.isArray(item.bullets)) {
        for (const b of item.bullets) {
          if (b.original) {
            const c = cleanText(b.original);
            if (c !== b.original) { b.original = c; bulletsCleaned++; }
          }
          if (b.enhanced) {
            const c = cleanText(b.enhanced);
            if (c !== b.enhanced) { b.enhanced = c; bulletsCleaned++; }
          }
        }
        // 去掉空 bullet + 同条经历内的重复 bullet
        const seen = new Set();
        const kept = [];
        for (const b of item.bullets) {
          const text = (b.original || b.enhanced || '').trim();
          if (!text) { bulletsRemoved++; continue; }
          const sig = normalizeForCompare(text);
          if (seen.has(sig)) { bulletsRemoved++; continue; }
          seen.add(sig);
          kept.push(b);
        }
        item.bullets = kept.length ? kept : item.bullets;
      }
    }
  }

  return { fieldsCleaned, bulletsCleaned, bulletsRemoved, total: fieldsCleaned + bulletsCleaned + bulletsRemoved };
}

// 条目签名：用于判定「疑似同一个经历」
function itemSignature(key, item) {
  switch (key) {
    case 'experiences': return normalizeForCompare(`${item.company}${item.role}`);
    case 'projects': return normalizeForCompare(item.name);
    case 'education': return normalizeForCompare(`${item.school}${item.major}`);
    case 'awards': return normalizeForCompare(item.title);
    default: return '';
  }
}

function itemTitle(key, item) {
  switch (key) {
    case 'experiences': return [item.company, item.role].filter(Boolean).join(' · ') || '(未填写)';
    case 'projects': return [item.name, item.role].filter(Boolean).join(' · ') || '(未填写)';
    case 'education': return [item.school, item.major].filter(Boolean).join(' · ') || '(未填写)';
    case 'awards': return item.title || '(未填写)';
    default: return '(未填写)';
  }
}

const KEY_TO_TYPE = { experiences: 'work', projects: 'project', education: 'education', awards: 'award' };
const TYPE_LABEL = { work: '工作经历', project: '项目经历', education: '教育背景', award: '荣誉奖项' };

// 返回疑似重复组：[{ type, typeLabel, signature, items: [{id, title, bulletCount}] }]
export function findDuplicates(library) {
  const groups = [];
  for (const key of Object.keys(FIELDS)) {
    const bySig = new Map();
    for (const item of library[key] || []) {
      const sig = itemSignature(key, item);
      if (!sig) continue;
      if (!bySig.has(sig)) bySig.set(sig, []);
      bySig.get(sig).push(item);
    }
    for (const [sig, items] of bySig) {
      if (items.length > 1) {
        groups.push({
          type: KEY_TO_TYPE[key],
          typeLabel: TYPE_LABEL[KEY_TO_TYPE[key]],
          signature: sig,
          items: items.map(i => ({
            id: i.id,
            title: itemTitle(key, i),
            bulletCount: (i.bullets || []).filter(b => b.original || b.enhanced).length
          }))
        });
      }
    }
  }
  return groups;
}
