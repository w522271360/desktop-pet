# 🐕 桌面小助手

<p align="center">
  <img src="assets/shiba.jpg" alt="桌面小助手" width="150"/>
</p>

<p align="center">
  <b>智能桌面宠物 - 多模型AI对话助手</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-28.0.0-47848F?logo=electron" alt="Electron"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/Version-2.2.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows" alt="Platform"/>
</p>

---

## ✨ 功能特性

### 🤖 多模型AI对话（支持 10+ 提供商）

**国际服务**
- **DeepSeek** - DeepSeek-V3 Chat、DeepSeek-R1 推理模型
- **Google Gemini** - Gemini 3 Pro/Flash、Gemini 2.5 系列（最新）
- **OpenAI** - GPT-4o、o1/o3 推理系列
- **Anthropic Claude** - Claude Sonnet 4、Claude 3.5 系列
- **Groq** - Llama 3.3 70B（免费高速推理）

**国内服务**
- **智谱 GLM** - GLM-4 Plus、GLM-4V 视觉模型
- **月之暗面 Kimi** - Moonshot v1 系列（128K 超长上下文）
- **零一万物 Yi** - Yi Lightning、Yi Large
- **硅基流动** - Qwen2.5、DeepSeek-V3 托管版

**其他**
- **自定义 API** - 支持任何 OpenAI 兼容接口，可手动输入模型 ID

### 👁️ 视觉分析
- 一键截屏并发送给AI分析
- 支持多模态视觉理解
- 自动隐藏窗口后截屏，确保截图干净

### 🎨 界面特性
- 🐕 可爱的桌面宠物形象
- 🌓 支持明暗主题切换
- 💬 流式输出，实时显示AI回复
- 📝 友好的提示消息系统
- 📄 对话导出为 Markdown 文件
- 🖼️ 响应式设计，窗口大小自适应

---

## 🖼️ 界面预览

| 桌面宠物 | 对话界面 | 设置界面 |
|:---:|:---:|:---:|
| 可爱柴犬桌宠 | 多模型智能对话 | 丰富配置选项 |

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装步骤

```bash
# 1. 进入项目目录
cd desktop-pet

# 2. 安装依赖
npm install

# 3. 启动应用
npm start

# 开发模式（带开发者工具）
npm run dev
```

### 构建可执行文件

```bash
# 构建 Windows 版本
npm run build

# 构建便携版
npm run build:portable
```

构建完成后，可执行文件位于 `dist/win-unpacked/` 目录。

---

## ⚙️ 配置说明

### API 配置

首次使用需要配置 AI 模型的 API：

1. 双击桌面宠物打开对话窗口
2. 点击右上角 **⚙️ 设置**
3. 在 **API 配置** 标签页添加或编辑配置
4. 填写 API 地址和密钥
5. 点击 **测试连接** 验证配置

#### 支持的 API 提供商

| 提供商 | 默认 API 地址 | 推荐模型 |
|-------|-------------|---------|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | deepseek-chat, deepseek-reasoner |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/models` | gemini-3-pro-preview, gemini-2.5-flash |
| OpenAI | `https://api.openai.com/v1/chat/completions` | gpt-4o, o1, o3-mini |
| Anthropic Claude | `https://api.anthropic.com/v1/messages` | claude-sonnet-4, claude-3-5-sonnet |
| Groq (免费) | `https://api.groq.com/openai/v1/chat/completions` | llama-3.3-70b-versatile |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | glm-4-plus, glm-4v-plus |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1/chat/completions` | moonshot-v1-128k |
| 零一万物 Yi | `https://api.lingyiwanwu.com/v1/chat/completions` | yi-lightning, yi-large |
| 硅基流动 | `https://api.siliconflow.cn/v1/chat/completions` | Qwen/Qwen2.5-72B-Instruct |
| 自定义 API | 自行配置 | 支持手动输入任意模型 ID |

### 自定义 API 配置

适用于使用自定义 OpenAI 兼容 API 的用户：

1. 选择提供商类型为 **自定义 API**
2. 填写 API 服务提供的接口地址
3. 填写 API Key
4. 从列表选择模型，或选择 **手动输入模型 ID** 输入任意模型

---

## 📁 项目结构

```
project/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本
├── config.js            # 应用配置（模型、窗口等）
├── store.js             # 数据持久化
├── api-service.js       # AI API 调用服务
├── renderer/            # 渲染进程
│   ├── pet.html         # 桌宠窗口
│   ├── chat.html/js/css # 对话窗口
│   ├── settings.html/js/css # 设置窗口
│   └── friendly-messages.js # 友好提示
├── assets/              # 资源文件
│   ├── shiba.jpg        # 桌宠图片
│   └── icon.png         # 应用图标
└── dist/                # 构建输出
```

---

## 🔧 高级功能

### 对话保存

对话可以导出为 Markdown 文件：
- 点击对话界面的 **💾 保存** 按钮
- 默认保存路径可在 `config.js` 中配置

### 窗口置顶

在 **设置** → **通用设置** 中可开启窗口置顶功能。

### 宠物大小调节

在 **设置** → **外观设置** 中可调节宠物大小：
- 小：180x180
- 中：230x230（默认）
- 大：280x280

### 自定义主题

支持明暗主题切换，在 **外观设置** 中选择。

---

## 🛠️ 开发说明

### 开发模式

```bash
npm run dev
```

开发模式会自动打开开发者工具，方便调试。

### 菜单控制

```bash
# 隐藏菜单
npm run menu:hide

# 最小菜单
npm run menu:minimal

# 自定义菜单
npm run menu:custom
```

### 依赖说明

| 依赖 | 用途 |
|-----|-----|
| electron | 桌面应用框架 |
| axios | HTTP 请求 |
| electron-store | 数据持久化 |
| electron-builder | 应用打包 |

---

## 📋 更新日志

### v2.2.0 (2025-12)
- ✨ 新增 6 个 AI 提供商：Claude、智谱、月之暗面、零一万物、硅基流动、Groq
- ✨ 更新 Gemini 3 系列模型支持
- ✨ 新增网络代理配置功能（动态切换，无需重启）
- ✨ 自定义 API 支持手动输入任意模型 ID
- 🐛 修复编辑配置时 API 地址被重置的问题
- 💄 优化设置页面 UI

### v2.0.0
- ✨ 多卡片配置系统
- ✨ 多模型支持
- ✨ 视觉分析功能
- ✨ 流式输出

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

<p align="center">
  Made for 桌面小助手
</p>
