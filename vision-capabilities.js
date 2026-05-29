function supportsVision(apiConfig) {
  if (!apiConfig) {
    return false;
  }

  // A custom endpoint may expose models unknown to this app. Let the API
  // accept or reject the multimodal request instead of blocking it locally.
  return true;
}

module.exports = { supportsVision };
