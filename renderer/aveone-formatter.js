// ── AveOne DevTools Inspector — Formatter + Highlighter ──────────────────────

function detectType(text) {
  const t = text.trim();
  if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\S+\s+HTTP\/\d\.\d/i.test(t) ||
      /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\/\S*/i.test(t.split('\n')[0])) {
    return 'http';
  }
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (t.startsWith('<')) return 'xml';
  // Dump de headers brutos (Network Monitor não tem linha "METHOD /path HTTP/1.1" —
  // só request.headers + response.headers concatenados). Sem isso cai no fallback 'text',
  // que tem um highlighter de comentário JS que corrompe qualquer "https://" na linha.
  const firstLines = t.split('\n').slice(0, 6);
  const looksLikeHeaderName = firstLines.some(l =>
    /^:?(host|content-type|authorization|accept|user-agent|cookie|set-cookie|access-control[\w-]*|origin|referer|:method|:path|:authority|:scheme)\s*:/i.test(l.trim())
  );
  const allLinesAreHeaderShaped = firstLines.every(l => !l.trim() || /^:?[\w-]+:\s?.*$/.test(l));
  if (looksLikeHeaderName && allLinesAreHeaderShaped) return 'http';
  return 'text';
}

function formatJSON(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (e) {
    return text; // não era JSON válido, devolve original
  }
}

function formatXML(xml) {
  let formatted = '';
  let pad = 0;
  const PADDING = '  ';
  xml = xml.replace(/(>)(<)(\/*)/g, '$1\n$2$3').trim();
  xml.split('\n').forEach(rawNode => {
    const node = rawNode.trim();
    if (!node) return;
    let indent = 0;
    if (/^<\/[\w:.-]+>$/.test(node)) {
      // tag de fechamento isolada → decrementa antes de imprimir
      pad = Math.max(pad - 1, 0);
    } else if (/^<[\w:.-]+([^>]*[^\/])?>.*<\/[\w:.-]+>$/.test(node)) {
      // tag completa na mesma linha (abre+conteúdo+fecha) → não altera pad
    } else if (/^<[\w:.-]+[^>]*\/>$/.test(node) || /^<\?.*\?>$/.test(node)) {
      // self-closing ou declaração XML → não altera pad
    } else if (/^<[\w:.-]+[^>]*>$/.test(node)) {
      // tag de abertura isolada → indenta a próxima linha
      indent = 1;
    }
    formatted += PADDING.repeat(pad) + node + '\n';
    pad += indent;
  });
  return formatted.trim();
}

// Separa headers HTTP do corpo e formata o corpo se for JSON/XML
function formatHTTP(text) {
  const sep = text.indexOf('\n\n');
  if (sep === -1) return text;
  const headers = text.slice(0, sep);
  let body = text.slice(sep + 2);
  const bodyType = detectType(body);
  if (bodyType === 'json') body = formatJSON(body);
  else if (bodyType === 'xml') body = formatXML(body);
  return headers + '\n\n' + body;
}

function formatCode(text) {
  const type = detectType(text);
  let out;
  if (type === 'json') out = formatJSON(text);
  else if (type === 'xml') out = formatXML(text);
  else if (type === 'http') out = formatHTTP(text);
  else out = text;
  return { type, formatted: out };
}

// ── Highlighter: tokeniza por regex e envolve em <span class="tok-X"> ───────
function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(text, type) {
  let s = escapeHTML(text);
  if (type === 'json') {
    s = s.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="tok-key">$1</span>$2');
    s = s.replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="tok-str">$1</span>');
    s = s.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="tok-num">$1</span>');
    s = s.replace(/:\s*(true|false|null)/g, ': <span class="tok-bool">$1</span>');
  } else if (type === 'xml' || type === 'http') {
    s = s.replace(/(&lt;\/?[\w:.\-]+)/g, '<span class="tok-tag">$1</span>');
    s = s.replace(/([\w-]+)(=)(&quot;[^&]*?&quot;)/g, '<span class="tok-attr">$1</span>$2<span class="tok-str">$3</span>');
    s = s.replace(/^([A-Z]+)\s(\/\S*)\s(HTTP\/\d\.\d)/m, '<span class="tok-method">$1</span> <span class="tok-str">$2</span> <span class="tok-num">$3</span>');
    s = s.replace(/^([\w-]+):(.*)$/gm, '<span class="tok-attr">$1</span>:<span class="tok-str">$2</span>');
  } else {
    // Ordem importa: comentário precisa ser o ÚLTIMO replace. Se rodasse antes, o HTML que ele
    // insere (ex: class="tok-comment") contém a palavra "class", que o regex de keywords abaixo
    // pegaria de novo e quebraria a tag inserida. Keywords/strings primeiro, comentário por último.
    s = s.replace(/\b(function|const|let|var|return|if|else|for|while|new|class|import|export|async|await|eval)\b/g, '<span class="tok-kw">$1</span>');
    s = s.replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-str">$1</span>');
    // Lookbehind negativo evita comer "://" de URLs (http://, https://) como se fosse comentário —
    // defesa extra além da correção do detectType, pra qualquer texto solto que caia aqui.
    s = s.replace(/(?<!:)\/\/.*$/gm, '<span class="tok-comment">$&</span>');
  }
  return s;
}

// Marca os trechos encontrados pelo scanner dentro do HTML já destacado
function markFindings(highlightedHTML, plainText, findings) {
  // Estratégia simples: para cada snippet único, faz replace no texto plain
  // antes do highlight teria sido ideal, mas para manter o highlight já
  // calculado usamos marcação por snippet escapado (best-effort, pode não
  // casar 100% se o highlight já modificou a string ao redor).
  let html = highlightedHTML;
  const uniqueSnippets = [...new Set(findings.map(f => f.snippet))];
  for (const snip of uniqueSnippets) {
    const esc = escapeHTML(snip).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const re = new RegExp(esc);
      html = html.replace(re, m => `<mark class="finding-mark">${m}</mark>`);
    } catch (e) { /* regex inválido, ignora */ }
  }
  return html;
}

// Sublinha (sem fundo vermelho — visual diferente do finding-mark) qualquer JWT, token/secret
// hardcoded ou URL do Supabase encontrado, direto no código exibido. Roda sempre, independente
// de ter clicado em "Escanear" — é um realce visual permanente, não um achado de vulnerabilidade.
function markTokens(html, plainText) {
  const patterns = [
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g,
    /https:\/\/[a-z0-9]{15,25}\.supabase\.co[^\s"'<>]*/gi,
    /\b(api[_-]?key|apikey|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][A-Za-z0-9\-_.]{10,}['"]/gi
  ];
  const matches = new Set();
  patterns.forEach(re => {
    for (const m of plainText.matchAll(re)) matches.add(m[0]);
  });
  // Maiores primeiro evita que um match menor quebre um maior que o contém.
  const sorted = [...matches].sort((a, b) => b.length - a.length);
  let result = html;
  for (const m of sorted) {
    const escLiteral = escapeHTML(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escLiteral) continue;
    try {
      const re = new RegExp(escLiteral);
      result = result.replace(re, match => `<mark class="token-mark">${match}</mark>`);
    } catch (e) { /* regex inválido, ignora */ }
  }
  return result;
}

// Detecta blobs JSON grandes embutidos em JS (ex: window.DATA = {...};) dentro de HTML/script
// e reformata com indentação — sem isso, dumps de página inteira viram uma única linha gigante.
// Falha graciosamente (devolve o texto original) se não for JSON estritamente válido.
function prettyEmbeddedJSON(text) {
  return text.replace(/(=\s*)(\{[^;]{80,20000}\}|\[[^;]{80,20000}\])(\s*;)/g, (full, pre, blob, post) => {
    try {
      const obj = JSON.parse(blob);
      return pre + '\n' + JSON.stringify(obj, null, 2) + post;
    } catch (e) {
      return full;
    }
  });
}

// Renderiza JSON como árvore colapsável (estilo JSON Viewer Pro) em vez de texto plano.
// Profundidade >0 nasce recolhida — evita parede de texto em objetos grandes (ex: dumps de página).
function renderJSONTree(value, depth) {
  depth = depth || 0;
  const MAX_ITEMS = 200;
  if (value === null) return '<span class="tok-bool">null</span>';
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="tok-tag">[ ]</span>';
    const shown = value.slice(0, MAX_ITEMS);
    const openAttr = depth < 1 ? ' open' : '';
    let html = `<details class="json-node"${openAttr}><summary class="json-summary">[ ${value.length} ${value.length === 1 ? 'item' : 'itens'} ]</summary><div class="json-children">`;
    shown.forEach((v, i) => {
      html += `<div class="json-row">${renderJSONTree(v, depth + 1)}${i < shown.length - 1 ? ',' : ''}</div>`;
    });
    if (value.length > MAX_ITEMS) html += `<div class="json-row" style="color:#6e7681">... mais ${value.length - MAX_ITEMS} itens</div>`;
    html += '</div></details>';
    return html;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return '<span class="tok-tag">{ }</span>';
    const shownKeys = keys.slice(0, MAX_ITEMS);
    const openAttr = depth < 1 ? ' open' : '';
    let html = `<details class="json-node"${openAttr}><summary class="json-summary">{ ${keys.length} ${keys.length === 1 ? 'campo' : 'campos'} }</summary><div class="json-children">`;
    shownKeys.forEach((k, i) => {
      html += `<div class="json-row"><span class="tok-key">"${escapeHTML(k)}"</span>: ${renderJSONTree(value[k], depth + 1)}${i < shownKeys.length - 1 ? ',' : ''}</div>`;
    });
    if (keys.length > MAX_ITEMS) html += `<div class="json-row" style="color:#6e7681">... mais ${keys.length - MAX_ITEMS} campos</div>`;
    html += '</div></details>';
    return html;
  }
  if (typeof value === 'string') return `<span class="tok-str">"${escapeHTML(value)}"</span>`;
  if (typeof value === 'number') return `<span class="tok-num">${value}</span>`;
  if (typeof value === 'boolean') return `<span class="tok-bool">${value}</span>`;
  return escapeHTML(String(value));
}
