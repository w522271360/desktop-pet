(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChatMarkdown = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isSafeUrl(url) {
    return /^(https?:|mailto:)/i.test(url);
  }

  function renderInline(markdown) {
    const codeSpans = [];
    let html = escapeHtml(markdown).replace(/`([^`\n]+)`/g, (match, code) => {
      const index = codeSpans.push(`<code>${code}</code>`) - 1;
      return `\u0000CODE${index}\u0000`;
    });

    html = html
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
        const decodedUrl = url.replace(/&amp;/g, '&');
        if (!isSafeUrl(decodedUrl)) return label;
        return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
      })
      .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n][\s\S]*?[^_\n])__/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/_([^_\n]+)_/g, '<em>$1</em>');

    return html.replace(/\u0000CODE(\d+)\u0000/g, (match, index) => codeSpans[Number(index)] || '');
  }

  function flushParagraph(state, html) {
    if (state.paragraph.length === 0) return;
    html.push(`<p>${renderInline(state.paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
    state.paragraph = [];
  }

  function flushList(state, html) {
    if (!state.listType) return;
    html.push(`<${state.listType}>${state.listItems.map(item => `<li>${renderInline(item)}</li>`).join('')}</${state.listType}>`);
    state.listType = null;
    state.listItems = [];
  }

  function flushBlocks(state, html) {
    flushParagraph(state, html);
    flushList(state, html);
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    const state = {
      paragraph: [],
      listType: null,
      listItems: []
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        flushBlocks(state, html);
        const codeLines = [];
        index += 1;
        while (index < lines.length && !lines[index].trim().startsWith('```')) {
          codeLines.push(lines[index]);
          index += 1;
        }
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        continue;
      }

      if (!trimmed) {
        flushBlocks(state, html);
        continue;
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushBlocks(state, html);
        const level = heading[1].length + 2;
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        continue;
      }

      const unordered = trimmed.match(/^[-*]\s+(.+)$/);
      const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph(state, html);
        const nextType = unordered ? 'ul' : 'ol';
        if (state.listType && state.listType !== nextType) {
          flushList(state, html);
        }
        state.listType = nextType;
        state.listItems.push((unordered || ordered)[1]);
        continue;
      }

      const quote = trimmed.match(/^>\s?(.+)$/);
      if (quote) {
        flushBlocks(state, html);
        html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
        continue;
      }

      flushList(state, html);
      state.paragraph.push(line);
    }

    flushBlocks(state, html);
    return html.join('');
  }

  function renderMarkdownInto(element, markdown) {
    element.innerHTML = renderMarkdown(markdown);
  }

  return {
    escapeHtml,
    renderInline,
    renderMarkdown,
    renderMarkdownInto
  };
});
