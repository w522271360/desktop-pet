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

### 🤖 自定义 AI 对话

- 支持自定义 OpenAI 兼容接口
- 支持手动填写 API 地址、API Key 和模型 ID
- 支持保存多个 API 配置并快速切换
- 支持测试连接，确认配置可用后再开始对话

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

### 自定义 API 配置

适用于使用自定义 OpenAI 兼容 API 的用户：

1. 填写 API 服务提供的接口地址
2. 填写 API Key
3. 填写当前服务支持的模型 ID
4. 点击 **测试连接** 验证配置

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
- ✨ 精简为自定义 OpenAI 兼容 API 配置
- ✨ 支持手动输入任意模型 ID
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
