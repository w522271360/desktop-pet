// 配置文件 - 自定义 OpenAI 兼容 API 配置
module.exports = {
  providerTemplates: {
    custom: {
      name: '自定义 API',
      icon: 'custom',
      brandColor: '#6B7280',
      defaultApiUrl: 'https://your-api-endpoint.com/v1/chat/completions',
      models: [],
      defaultModel: '',
      authType: 'bearer',
      allowCustomModel: true
    }
  },

  // Markdown 保存路径配置
  markdown: {
    savePath: './conversations',
  },

  // 窗口配置
  window: {
    petWidth: 200,
    petHeight: 200,
    chatWidth: 600,
    chatHeight: 633,
    settingsWidth: 950,
    settingsHeight: 700
  },

  // 模型能力标签
  modelTags: {
    supportsVision: '👁️ 视觉',
    supportsAudio: '🎵 音频',
    supportsVideo: '🎬 视频',
    supportsImageGen: '🖼️ 图像生成',
    isReasoner: '🧠 推理',
    isNew: '🆕 新',
    recommended: '⭐ 推荐'
  }
};
