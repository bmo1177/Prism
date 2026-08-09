<div align="center">

# Prism

**光，弯折成工作。**

一束光进入，全色谱展开。Prism 是一个本地优先、模型无关的 AI 工作台，将你的
问题折射到智能体、笔记本、文件、图表、报告和审查中 — 每一种颜色都是同一个
思想的不同波长。

基于 Tauri 2、React、MCP、智能体技能和可复现构件构建。
支持 macOS、Windows 和 Linux。

<p>
  <a href="../README.md"><b>English</b></a> ·
  <b>简体中文</b> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.fr.md">Français</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.ar.md">العربية</a>
</p>

</div>

---

## 什么是 Prism？

Prism 是一个桌面 AI 工作台。你提出一个问题。Prism 让它穿过你拥有的所有工具 —
智能体、笔记本、文件、浏览器、远程机器 — 然后给你的不只是答案，而是整个
光谱：图表、代码、报告、溯源，以及思考的精确路径。

**一个输入。所有波长。**

- 一个研究问题变成文献综述、实验、图表和论文
- 一个设计简报变成原型、导出和演示文稿
- 一个数据问题变成分析、笔记本、图表和报告
- 一个编程任务变成智能体、工具、测试和文档

一切都在本地。一切都是你的。一切都可追溯。

---

## 为什么叫 "Prism"？

棱镜将一束光分解为它本就是的多种颜色。Prism 将一个问题分解为它本就是的
多个任务 — 每一个都是同一思想的不同波长，每一个都产出真实的东西。

---

## 功能

### 产出真实构件的自主任智能体
不只是聊天。每个智能体动作产出可检查的文件 — 图表、代码、报告、笔记本 —
链接回创建它们的精确输入、环境和对话。

### 一切可追溯
溯源追踪将每个输出链接到其来源。打开任何构件，查看脚本、数据、模型输出和
创建它的对话。

### 默认本地优先
你的会话、数据、溯源、笔记本和运行记录保存在你的机器上。除非你愿意，
否则不会离开。

### 模型无关
自带模型。运行时支持任何提供商 — OpenAI、Anthropic、本地模型、自定义端点。
技能和 MCP 服务器保持可插拔。

### 随处可达
内置网关将真实的桌面 UI 服务于局域网浏览器或手机。在办公桌前启动运行，
在手机上查看结果。

### 驱动你自己的浏览器
智能体可以控制你真实的 Chrome — 配置文件和登录状态完好 — 或使用隔离的
私人浏览器。

### 先计划后行动
`/plan` 制定执行计划。`/goal` 确定目标、约束和验收标准。然后智能体执行。

### 同时处理多件事
并排平铺窗格。每个窗格运行不同模型。拖拽停靠。不同项目的独立屏幕。

---

## 研究循环

完整的科学方法，作为技能链：

| 阶段 | 作用 | 输出 |
| --- | --- | --- |
| 探索 | 将宽泛方向转化为具体主题 | 主题矩阵、文献预调查 |
| 综述 | 搜索和综合文献 | 6–20 页 PDF，60+ 真实引用 |
| 实验 | 设计和运行实验 | 代码、结果、图表、溯源 |
| 撰写 | 撰写论文 | 8–14 页 PDF，200+ 引用，图表 |

每个阶段都是独立的。单独运行或让元技能端到端链接它们。

---

## 连接器

一键科学集成：

- 文献：arXiv、PubMed、Crossref、Semantic Scholar、bioRxiv/medRxiv
- 生物医学：ClinicalTrials.gov、MyVariant/ClinVar
- 材料：Materials Project
- 经济：FRED
- 气候：Open-Meteo
- 空间天气、USGS 水资源数据

从设置中添加任何 MCP 服务器或本地工具。

---

## 安装

从 [Releases 页面](https://github.com/bmo1177/Prism/releases/latest) 下载。

| 平台 | 格式 |
| --- | --- |
| macOS | `.dmg` / `.app`（Apple Silicon 和 Intel） |
| Windows | `.exe` / `.msi` |
| Linux | `.deb` / `.rpm` / AppImage |

```bash
# Linux .deb
sudo apt install ./Prism_*.deb

# Linux .rpm
sudo rpm -i Prism-*.rpm

# AppImage
chmod +x Prism_*.AppImage
./Prism_*.AppImage
```

---

## 从源码构建

要求：Node.js ≥ 20、pnpm 9、Rust 工具链、Tauri 系统依赖。

```bash
git clone https://github.com/bmo1177/Prism
cd Prism
pnpm install

# 获取捆绑的 sidecar 和技能
bash scripts/dev/fetch-opencode.sh
bash scripts/dev/fetch-uv.sh
bash scripts/dev/fetch-skills.sh

# 开发
pnpm --filter @ai4s/desktop tauri dev

# 构建
pnpm --filter @ai4s/desktop tauri build
```

---

## 安全

- 工作区文件默认保留在本地。
- 命令执行、文件删除和远程连接需要批准。
- 提供商凭据存储在应用私有配置中，永不进入 git 或溯源。
- 设置显示纯语言数据流视图。

---

## 许可证

[MIT](../LICENSE)

> Prism 是测试版软件。将输出视为草稿 — 发布前先验证。
