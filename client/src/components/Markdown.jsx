// A tiny, safe-enough markdown renderer for the strategist report. Not a full
// CommonMark implementation — just headings, bold/italic/code, lists, hr, and
// paragraphs, which is all the plan output uses. Input is Gemini text (trusted
// enough, but we still escape HTML to avoid injecting markup).

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return t;
}

function render(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let listType = null; // 'ul' | 'ol'

  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = null; } };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (/^```/.test(line)) {
      closeList();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(escapeHtml(lines[i])); i++; }
      i++; // skip closing fence
      html.push(`<pre><code>${buf.join('\n')}</code></pre>`);
      continue;
    }

    // headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const level = Math.min(h[1].length, 3);
      html.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++; continue;
    }

    // horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { closeList(); html.push('<hr />'); i++; continue; }

    // ordered list
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
      html.push(`<li>${inline(ol[1])}</li>`);
      i++; continue;
    }
    // unordered list
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
      html.push(`<li>${inline(ul[1])}</li>`);
      i++; continue;
    }

    // blank line
    if (!line.trim()) { closeList(); i++; continue; }

    // paragraph (gather consecutive non-empty, non-special lines)
    closeList();
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim()
      && !/^(#{1,6})\s/.test(lines[i]) && !/^```/.test(lines[i])
      && !/^\s*\d+[.)]\s/.test(lines[i]) && !/^\s*[-*+]\s/.test(lines[i])
      && !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  closeList();
  return html.join('\n');
}

export default function Markdown({ children }) {
  return <div className="report-body" dangerouslySetInnerHTML={{ __html: render(children) }} />;
}
