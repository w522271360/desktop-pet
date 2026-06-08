# 桌面小助手

桌面小助手是一个基于 Electron 的 AI 桌宠应用。它把桌面宠物、AI 对话、截图分析、提醒事项、图片处理和多端联机整合在一起，适合作为常驻桌面的轻量助手。

当前项目支持 OpenAI 兼容接口、DeepSeek 相关能力、Pi Agent 集成，以及独立的桌宠窗口、聊天窗口、设置窗口和联机管理服务。

## 功能概览

### AI 对话

- 支持 OpenAI 兼容接口配置
- 支持多套 API 配置保存与切换
- 支持流式回复
- 支持对话历史保存
- 支持 Markdown 渲染

### 视觉与图片

- 支持截图选择区域并发送给模型分析
- 支持图片附件
- 支持识别图片意图
- 支持生成图片结果导出
- 支持配置图片生成参数和记录生成日志

### 桌宠交互

- 独立桌宠浮窗
- 支持气泡消息和状态反馈
- 支持桌宠窗口尺寸与模板配置
- 支持右键菜单控制
- 支持聊天、设置、控制窗口分离

### 提醒事项

- 支持从自然语言中识别提醒意图
- 支持创建、调度和确认提醒
- 到时后可通过桌宠展示提醒内容

### 联机能力

- 内置 WebSocket 桌宠联机服务端
- 支持多个桌宠实例接入
- 支持设备身份识别
- 支持在线用户管理和通知下发
- 支持通过管理页查看联机状态

### Pi Agent 集成

- 包含 Pi Agent 相关服务
- 构建前会准备 `third_party/pi` 依赖和产物
- 提供独立控制页面相关 UI 与测试

## 技术栈

- Electron
- Node.js
- Axios
- ws
- electron-builder
- Node.js Test Runner

## 环境要求

- Node.js 18 或更高版本
- npm 9 或更高版本

## 快速开始

安装依赖：

```bash
npm install
```

启动应用：

```bash
npm start
```

开发模式启动：

```bash
npm run dev
```

运行测试：

```bash
npm test
```

## API 配置

应用通过设置窗口配置模型服务。通常需要填写：

- API Base URL
- API Key
- Model ID

推荐流程：

1. 启动应用。
2. 打开设置窗口。
3. 新增一组 API 配置。
4. 填写接口地址、密钥和模型名称。
5. 先执行连接测试。
6. 测试通过后开始聊天或截图分析。

## 联机服务

项目内置桌宠联机服务端，可用于多实例互联和后台通知。

启动服务端：

```bash
npm run server -- --host 0.0.0.0 --port 17890 --admin-token 11171123
```

管理页面：

```text
http://127.0.0.1:17890/admin
```

如果需要让其他设备接入：

- 将 `host` 绑定到局域网或公网可访问地址
- 在客户端中填写对应的 `ws://` 或 `wss://` 服务地址
- 生产环境建议通过 Nginx、Caddy 等反向代理提供 `wss://`
- 请妥善保管管理令牌，避免暴露管理入口

## 可用脚本

```bash
# 启动桌宠应用
npm start

# 开发模式启动
npm run dev

# 运行测试
npm test

# 启动联机服务端
npm run server

# 准备 Pi Agent 依赖和构建产物
npm run prepare:pi

# 构建 Windows 版本
npm run build

# 构建 macOS 版本
npm run build:mac

# 构建 Windows 便携版
npm run build:portable

# 构建 Windows x64 版本
npm run build:all

# 隐藏应用菜单
npm run menu:hide

# 使用精简菜单
npm run menu:minimal

# 使用自定义菜单
npm run menu:custom
```

## 构建说明

构建 Windows 版本：

```bash
npm run build
```

构建 macOS 版本：

```bash
npm run build:mac
```

构建 Windows 便携版：

```bash
npm run build:portable
```

构建输出目录：

```text
dist/
```

> 构建命令会先执行 `prepare:pi`，用于安装并构建 `third_party/pi`。

## 目录结构

```text
desktop-pet/
├─ main.js                         # Electron 主进程入口
├─ preload.js                      # 预加载脚本
├─ api-service.js                  # AI 接口调用封装
├─ openai-compatible.js            # OpenAI 兼容接口适配
├─ deepseek-plugin.js              # DeepSeek 相关能力
├─ vision-capabilities.js          # 视觉能力判断
├─ conversation-history.js         # 对话历史
├─ conversation-save-path.js       # 对话保存路径
├─ generated-image-export.js       # 生成图片导出
├─ image-generation-config.js      # 图片生成配置
├─ image-generation-log.js         # 图片生成日志
├─ reminder-manager.js             # 提醒事项调度
├─ pet-server.js                   # 联机服务端与管理页
├─ pet-network-client.js           # 联机客户端
├─ pet-network-protocol.js         # 联机协议
├─ pet-device-identity.js          # 桌宠设备身份
├─ pi-agent-service.js             # Pi Agent 服务集成
├─ store.js                        # 本地存储
├─ config.js                       # 基础配置
├─ toggle-menu.js                  # 菜单切换工具
├─ renderer/                       # 渲染进程页面与脚本
├─ assets/                         # 静态资源
├─ config/                         # 配置模板
├─ test/                           # 自动化测试
├─ third_party/                    # 第三方集成
└─ dist/                           # 构建输出
```

## 测试

项目使用 Node.js 内置测试运行器：

```bash
npm test
```

测试覆盖配置变更、OpenAI 兼容接口、截图与图片意图、提醒事项、联机协议、服务端、桌宠窗口模板、构建文件清单等模块。

## License

MIT
