const test = require('node:test');
const assert = require('node:assert/strict');

const { renderMarkdown } = require('../renderer/markdown-renderer');

test('renders common assistant Markdown safely', () => {
  const html = renderMarkdown(`主人，**要看这个应用怎么接入 API**。

1. **会带上之前的聊天记录**
   - 应用会把您和我之前的对话，一起发给模型
2. 只带当前这一条消息

简单说：
- **短期上下文**：来自历史消息
- \`messages\` 越长费用越高`);

  assert.match(html, /<strong>要看这个应用怎么接入 API<\/strong>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<code>messages<\/code>/);
});

test('escapes raw HTML while preserving Markdown output', () => {
  const html = renderMarkdown('**安全** <script>alert(1)</script>');

  assert.match(html, /<strong>安全<\/strong>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
