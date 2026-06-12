// 数据版本迁移：当你发布新版本、且改动会影响"已经存在浏览器里的用户数据"时，
// 在这里加一个迁移步骤并把 LATEST_CONTENT_VERSION +1。
// 用户下次打开 app 时，storage 会自动把他们的存量数据补齐到最新版本。
//
// 怎么加新迁移：
//   1. LATEST_CONTENT_VERSION 改成下一个数字
//   2. 在 MIGRATIONS 末尾追加 { version: 那个数字, name: '说明', run(data) { ...改 data... } }
//   3. run 里直接修改 data（data.library / data.profile / data.resumes ...），不用返回

import { reformatLibrary } from './library-cleanup.js';

export const LATEST_CONTENT_VERSION = 2;

const MIGRATIONS = [
  {
    version: 1,
    name: '清洗历史导入残留的排版格式',
    run(data) {
      reformatLibrary(data.library);
    }
  },
  {
    version: 2,
    name: '去除零宽字符与 NBSP（修复导入后造成的布局偏移）',
    run(data) {
      // reformatLibrary 中使用的 cleanText 已更新，复用它以清洗一遍
      reformatLibrary(data.library);
    }
  }
  // 示例：以后新增字段时
  // {
  //   version: 2,
  //   name: '给项目补充 techStack 字段',
  //   run(data) {
  //     for (const p of data.library.projects) {
  //       if (!Array.isArray(p.techStack)) p.techStack = [];
  //     }
  //   }
  // }
];

// 原地升级 data，返回 { upgraded, from, to, applied: [迁移名] }
export function runMigrations(data) {
  const from = data.contentVersion || 0;
  if (from >= LATEST_CONTENT_VERSION) {
    return { upgraded: false, from, to: from, applied: [] };
  }
  const applied = [];
  for (const m of MIGRATIONS) {
    if (m.version > from) {
      try {
        m.run(data);
        applied.push(m.name);
      } catch (err) {
        console.error(`迁移「${m.name}」失败:`, err);
      }
    }
  }
  data.contentVersion = LATEST_CONTENT_VERSION;
  return { upgraded: true, from, to: LATEST_CONTENT_VERSION, applied };
}
