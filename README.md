# Resume Craft

AI 智能简历生成器。把你的所有经历沉淀到一个「经历库」里，针对不同岗位快速挑选组合、用 AI 优化措辞，一键导出多种格式的简历。纯前端应用，数据存在你自己的浏览器里。

## 功能

- **多档案隔离** — 打开先选档案，每个人的数据存在各自独立的本地存储，互不可见
- **经历库** — 集中管理工作 / 项目 / 教育 / 荣誉，支持拖拽排序、一键整理、查重
- **简历组合** — 从经历库挑选条目，选模板，实时预览
- **AI 能力** — 基于目标岗位 / JD 智能推荐经历、优化措辞（需配置 DeepSeek API Key）
- **多种导入方式** — 上传 PDF / Word / txt 文件、粘贴文本，或语音口述，AI 自动提取并清洗格式
- **导出** — 经历库与单份简历均可导出 Markdown、Word(.docx)，简历另支持打印 / 存 PDF
- **数据备份 / 恢复** — 导出 JSON 备份，在另一台设备导入还原（手动跨设备迁移）
- **移动端适配** — 手机 / 平板上自适应布局
- **版本迁移** — 升级新版本后，浏览器里的存量数据下次打开自动升级

## 技术栈

- [Vite](https://vitejs.dev/) + 原生 JavaScript（无框架、无后端）
- 数据持久化：浏览器 localStorage（按档案隔离）
- 文档生成：[docx](https://www.npmjs.com/package/docx)；文件解析：[pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) / [mammoth](https://www.npmjs.com/package/mammoth)
- 语音输入：浏览器 Web Speech API
- AI：DeepSeek Chat API

---

## 一、下载与本地运行

### 前置条件

先装好 [Node.js](https://nodejs.org/)（建议 18 或更高版本）。装完在终端确认：

```bash
node -v   # 显示版本号即可
npm -v
```

### 步骤

```bash
# 1. 下载代码
git clone https://github.com/mokscreate/profile.git
cd profile

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

启动后浏览器打开终端提示的地址（默认 http://localhost:3000 ，端口被占用时会自动换一个）。

> 不用 git 也行：在仓库页面点 **Code → Download ZIP** 下载解压，再在该目录里执行第 2、3 步。

---

## 二、配置 DeepSeek API Key（启用 AI 功能）

拖拽排序、整理、导入文件解析、导出、备份等功能**不需要** Key。只有「AI 推荐 / AI 优化 / 导入时的智能提取」需要：

1. 在 [platform.deepseek.com](https://platform.deepseek.com/) 申请 API Key
2. 打开应用 → 右上角「设置 API Key」→ 填入保存

Key 只存在你本地浏览器，不会上传，也不会进入备份文件。

**关于跨域：**
- 开发环境（`npm run dev`）：请求经 Vite 代理（见 `vite.config.js` 的 `/api/deepseek`）转发，避免跨域
- 生产环境（部署后）：前端直接请求 `https://api.deepseek.com`（国内可直接访问，见 `src/services/deepseek.js`）

---

## 三、部署上线

这是纯静态站点，`npm run build` 后把 `dist/` 目录托管出去即可。

```bash
npm run build   # 产物在 dist/
```

### 方案 A：EdgeOne Pages（推荐，国内可访问）

腾讯云 EdgeOne Pages，连 GitHub 自动构建部署，且有国内加速节点：

1. 打开 [EdgeOne Pages](https://console.cloud.tencent.com/edgeone/pages) ，实名登录
2. 创建项目 → 从 Git 导入 → 授权 GitHub → 选择本仓库
3. 构建配置（一般能自动识别 Vite，认不出就手填）：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
4. 创建时**加速区域选「全球可用区（含中国大陆）」**，否则国内访问会被拦（401）
5. 部署完成后会分配一个 `xxx.edgeone.cool` 域名

之后每次 `git push` 到 `main` 会自动重新部署。

### 方案 B：Vercel（部署简单，但默认域名在中国大陆常被墙）

仓库内已含 `vercel.json`（把 `/api/deepseek` 反代到 DeepSeek）。在 [vercel.com](https://vercel.com/) 导入 GitHub 仓库即可自动部署。
⚠️ `*.vercel.app` 默认域名在中国大陆经常无法访问，适合海外 / 有梯子的场景。

### 关于国内访问与备案

用国内 CDN 节点对大陆访客提供服务，绑**自定义域名**通常需要 ICP 备案。EdgeOne / Vercel 的默认域名可临时使用，长期对外建议用已备案域名。

---

## 四、数据存储与备份

所有数据保存在浏览器 localStorage：

- `resume-craft-users` — 档案列表
- `resume-craft-active-user` — 当前档案
- `resume-craft-v2-{userId}` — 每个档案的经历库 / 简历 / 设置

**数据只在当前浏览器，不跨设备同步。** 换浏览器、清缓存会丢失。重要数据请用主页底部的「**导出备份**」存成 JSON 文件；换设备时在对方「**导入备份**」还原。备份文件不含 API Key。

---

## 五、给开发者：新增数据迁移

当某次改动会影响「已存在用户浏览器里的数据」时，在 `src/services/migrations.js`：

1. 把 `LATEST_CONTENT_VERSION` +1
2. 在 `MIGRATIONS` 末尾追加 `{ version, name, run(data) {...} }`

用户下次打开应用，存量数据会自动从当前版本依次升级到最新。

## 目录结构

```
src/
├─ main.js              # 入口、路由、档案切换
├─ pages/               # 页面：选档案 / 主页 / 经历库 / 编辑器
├─ components/          # 预览、AI 对话等组件
├─ services/            # 存储、备份、迁移、导入导出、DeepSeek、语音
├─ templates/           # 简历模板
├─ data/                # 数据结构定义
├─ utils/               # 文本清洗等工具
└─ styles/              # 样式（含 responsive.css 移动端、print.css 打印）
```
