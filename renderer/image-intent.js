(function initializeImageIntent(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ImageIntent = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createImageIntentApi() {
  function requestsImageOutput(prompt) {
    return /(?:^|请|帮我|给我)(?:生成|画|绘制|创作|制作)(?:一张|一个|一幅)?|(?:生成|画|绘制|创作|做成|转成|转为|变成|改成|制作).{0,16}(?:图|图片|图像|插画|漫画|卡通|头像|海报|风格)|(?:卡通|动漫|日漫|插画|油画|水彩|头像).{0,10}(?:风|版|效果)/.test(prompt || '');
  }

  return { requestsImageOutput };
});
