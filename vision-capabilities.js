function supportsVision(apiConfig, providerTemplates) {
  if (!apiConfig) {
    return false;
  }

  // A custom endpoint may expose models unknown to this app. Let the API
  // accept or reject the multimodal request instead of blocking it locally.
  if (apiConfig.provider === 'custom') {
    return true;
  }

  const template = providerTemplates[apiConfig.provider];
  const model = template?.models.find(item => item.id === apiConfig.selectedModel);
  return model?.supportsVision === true;
}

module.exports = { supportsVision };
