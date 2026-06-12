# Resume Craft

AI 智能简历生成器。把你的所有经历沉淀到一个「经历库」里，针对不同岗位快速挑选组合、用 AI 优化措辞，一键导出多种格式的简历。

## 功能

- **多用户隔离** — 打开先选档案，每个人的数据存在各自独立的本地存储，互不可见
- **经历库** — 集中管理工作 / 项目 / 教育 / 荣誉，支持拖拽排序
- **简历组合** — 从经历库挑选条目，选模板，实时预览
- **AI 能力** — 基于目标岗位 / JD 智能推荐经历、优化措辞（需配置 DeepSeek API Key）
- **多种导入方式** — 上传 PDF / Word / txt 文件、粘贴文本，或语音口述，AI 自动提取并清洗格式
- **导出** — 经历库与单份简历均可导出 Markdown、Word(.docx)，简历另支持打印 / 存 PDF
- **一键整理** — 重整历史数据格式、检测疑似重复条目
- **版本迁移** — 发布新版本后，用户本地的存量数据在下次打开时自动升级

## 技术栈

- [Vite](https://vitejs.dev/) + 原生 JavaScript（无框架）
- 数据持久化：浏览器 localStorage（按用户隔离）
- 文档生成：[docx](https://www.npmjs.com/package/docx)、文件解析：[pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) / [mammoth](https://www.npmjs.com/package/mammoth)
- 语音输入：浏览器 Web Speech API
- AI：DeepSeek Chat API

## 本地运行

```bash
npm install
npm run dev
```

默认跑在 http://localhost:3000 （端口被占用时 Vite 会自动换一个）。

构建生产版本：

```bash
npm run build      # 产物在 dist/
npm run preview    # 本地预览构建产物
```

## 配置 DeepSeek API Key

AI 推荐、优化、导入提取等功能依赖 DeepSeek：

1. 在 [platform.deepseek.com](https://platform.deepseek.com/) 申请 API Key
2. 打开应用 → 右上角「设置 API Key」→ 填入保存

Key 只存在你本地浏览器，不会上传。开发环境下请求通过 Vite 代理（见 `vite.config.js` 的 `/api/deepseek`）转发到 DeepSeek，避免跨域。

> 注意：拖拽排序、整理、导出等功能纯本地运行，**不需要** API Key。

## 数据存储说明

所有数据保存在浏览器 localStorage：

- `resume-craft-users` — 用户档案列表
- `resume-craft-active-user` — 当前选中的用户
- `resume-craft-v2-{userId}` — 每个用户独立的经历库 / 简历 / 设置

换浏览器或清理缓存会丢失数据，重要内容建议用导出功能备份。

## 给开发者：新增数据迁移

当某次改动会影响「已经存在用户浏览器里的数据」时，在 `src/services/migrations.js`：

1. 把 `LATEST_CONTENT_VERSION` +1
2. 在 `MIGRATIONS` 末尾追加 `{ version, name, run(data) {...} }`

用户下次打开应用，存量数据会自动从当前版本依次升级到最新。
