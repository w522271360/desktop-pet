# Desktop Pet

一个基于 Electron 的 AI 桌面宠物应用，集成了对话助手、截图分析、提醒事项和宠物联机能力。

项目当前主要面向 Windows 使用，支持接入兼容 OpenAI 的 API 服务，并提供独立的设置窗口、聊天窗口和桌宠浮窗。

## 功能特性

- AI 对话
  - 支持自定义 OpenAI 兼容接口
  - 支持保存多套 API 配置并切换
  - 支持流式输出回复
- 截图分析
  - 支持截图后发送给模型分析
  - 支持区域选择截图
- 图片相关能力
  - 支持图片附件
  - 支持生成图片结果导出
- 桌宠交互
  - 独立桌宠窗口
  - 聊天窗口、设置窗口分离
  - 支持气泡消息和状态反馈
- 提醒事项
  - 支持创建、调度和确认提醒
  - 到时后可在桌宠侧展示提醒内容
- 联机能力
  - 内置 WebSocket 服务端
  - 支持多个桌宠实例接入
  - 支持管理页查看在线用户并下发通知

## 技术栈

- Electron 28
- Node.js
- Axios
- ws
- electron-builder

## 目录结构

```text
desktop-pet/
├─ main.js                        # Electron 主进程入口
├─ preload.js                     # 预加载脚本
├─ api-service.js                 # AI 接口调用
├─ store.js                       # 本地存储
├─ config.js                      # 基础配置
├─ reminder-manager.js            # 提醒事项调度
├─ pet-server.js                  # 联机服务端与管理页
├─ pet-network-client.js          # 联机客户端
├─ pet-network-protocol.js        # 联机协议
├─ renderer/                      # 渲染进程页面与脚本
│  ├─ pet.html
│  ├─ chat.html
│  ├─ chat.js
│  ├─ settings.html
│  └─ settings.js
├─ assets/                        # 静态资源
├─ config/                        # 配置模板
└─ test/                          # 测试
```

## 环境要求

- Node.js 18 或更高版本
- npm 9 或更高版本

## 本地运行

```bash
npm install
npm start
```

开发模式：

```bash
npm run dev
```

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

# 构建 Windows 版本
npm run build

# 构建便携版
npm run build:portable

# 菜单控制
npm run menu:hide
npm run menu:minimal
npm run menu:custom
```

## API 配置说明

应用默认通过设置页配置模型服务。当前实现偏向“OpenAI 兼容接口”接入方式，通常需要填写以下信息：

- API Base URL
- API Key
- Model ID

推荐使用流程：

1. 启动应用。
2. 打开设置窗口。
3. 新增一组 API 配置。
4. 填写接口地址、密钥和模型名称。
5. 先执行连接测试，再开始聊天。

## 联机服务说明

项目内置了一个桌宠联机服务端，可用于多实例互联和后台通知。

启动示例：

```bash
npm run server -- --host 0.0.0.0 --port 17890 --admin-token dushi1117
```

管理页面地址示例：

```text
http://127.0.0.1:17890/admin
```

如果需要让其他设备接入：

- 将 `host` 绑定到公网或局域网可访问地址
- 桌宠客户端中填写对应的 `ws://` 或 `wss://` 地址
- 生产环境建议通过 Nginx 或 Caddy 反代为 `wss://`

## 构建说明

构建 Windows 包：

```bash
npm run build
```

构建便携版：

```bash
npm run build:portable
```

构建输出目录默认是：

```text
dist/
```

## 当前项目状态

从仓库内容看，这个项目已经具备完整的桌面应用骨架和主要功能模块，但仍存在一些需要后续整理的地方：

- 部分中文文案存在编码异常
- `package.json` 中的中文字段也有乱码
- 文档和实际功能还需要进一步对齐

如果你准备继续维护这个项目，建议下一步优先处理：

1. 统一文件编码为 UTF-8
2. 修复应用内中文文案乱码
3. 补充安装、配置和截图示例
4. 为联机和提醒功能补测试

## License

MIT
