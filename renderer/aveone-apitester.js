// ── AveOne DevTools Inspector — API Tester / mini-repeater ──────────────────
// Funções de envio e testes ativos. UI fica em panel.js.

// Headers que o fetch() do browser proíbe definir manualmente (forbidden header names).
const _AVEONE_FORBIDDEN_HEADERS = new Set([
  'host', 'content-length', 'connection', 'origin', 'cookie',
  'cookie2', 'date', 'dnt', 'expect', 'keep-alive', 'referer', 'te',
  'trailer', 'transfer-encoding', 'upgrade', 'via'
]);

function aveoneHeadersToObject(headerLines, includeAuth) {
  const out = {};
  for (const line of headerLines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!name) continue;
    if (_AVEONE_FORBIDDEN_HEADERS.has(name.toLowerCase())) continue;
    if (!includeAuth && /^authorization$/i.test(name)) continue;
    out[name] = value;
  }
  return out;
}

function aveoneHeaderArrayToLines(headerArr) {
  return (headerArr || [])
    .filter(h => !_AVEONE_FORBIDDEN_HEADERS.has((h.name || '').toLowerCase()))
    .map(h => `${h.name}: ${h.value}`);
}

// Envia uma requisição real. Roda no contexto da extensão (chrome-extension://),
// por isso precisa de host_permissions: ["<all_urls>"] no manifest para não
// ser bloqueado por CORS na LEITURA da resposta.
async function aveoneSend(method, url, headerLines, body, opts) {
  opts = opts || {};
  const headers = aveoneHeadersToObject(headerLines, opts.includeAuth !== false);
  const fetchOpts = {
    method,
    headers,
    credentials: opts.includeCookies ? 'include' : 'omit',
    redirect: 'follow'
  };
  if (body && !['GET', 'HEAD'].includes(method)) fetchOpts.body = body;
  const t0 = performance.now();
  try {
    const res = await fetch(url, fetchOpts);
    const text = await res.text();
    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      headers: [...res.headers.entries()],
      body: text,
      ms: Math.round(performance.now() - t0)
    };
  } catch (e) {
    return { ok: false, error: e.message, ms: Math.round(performance.now() - t0) };
  }
}

function aveoneFindIdInUrl(url) {
  // pega o último segmento puramente numérico do path (ex: /api/users/123/profile → 123, se houver)
  const u = url.split('?')[0];
  const parts = u.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d{1,15}$/.test(parts[i])) return { id: parts[i], segIndex: i, parts, query: url.slice(u.length) };
  }
  return null;
}

function aveoneIsRateLimited(res) {
  return !!(res && res.ok && res.status === 429);
}

// Remove Authorization/Cookie da Conta A e injeta os headers da Conta B —
// permite provar acesso cross-account real (não apenas "sem auth nenhuma").
function aveoneSwapAuthHeaders(headerLines, accountBLines) {
  const filtered = headerLines.filter(l => !/^(authorization|cookie):/i.test(l));
  return filtered.concat(accountBLines || []);
}

// ── Testes ativos ────────────────────────────────────────────────────────

async function aveoneTestBrokenAuth(row, accountBLines) {
  const headerLines = aveoneHeaderArrayToLines(row.reqHeaders);
  const withAuth = await aveoneSend(row.method, row.url, headerLines, row.body, { includeAuth: true, includeCookies: true });
  const noAuth   = await aveoneSend(row.method, row.url, headerLines, row.body, { includeAuth: false, includeCookies: false });

  let accountB = null;
  if (accountBLines && accountBLines.length) {
    const swapped = aveoneSwapAuthHeaders(headerLines, accountBLines);
    accountB = await aveoneSend(row.method, row.url, swapped, row.body, { includeAuth: true, includeCookies: false });
  }

  let verdict = 'ok', verdictMsg = 'OK — bloqueado/diferente sem autenticação.';

  if (aveoneIsRateLimited(noAuth) || aveoneIsRateLimited(accountB)) {
    verdict = 'warn';
    verdictMsg = '⏸ Rate limit (429) durante o teste — resultado inconclusivo, NÃO indica que está seguro. Repita mais tarde.';
  } else if (accountB && accountB.ok && accountB.status >= 200 && accountB.status < 300 &&
             withAuth.ok && Math.abs((accountB.body || '').length - (withAuth.body || '').length) < Math.max(20, (withAuth.body || '').length * 0.15)) {
    verdict = 'critical';
    verdictMsg = '🚨 CRÍTICO — Conta B (identidade diferente) acessou o MESMO recurso da Conta A! BOLA/IDOR confirmado entre contas — prova forte para relatório.';
  } else if (noAuth.ok && noAuth.status >= 200 && noAuth.status < 300 &&
      withAuth.ok && Math.abs((noAuth.body || '').length - (withAuth.body || '').length) < Math.max(20, (withAuth.body || '').length * 0.1)) {
    verdict = 'critical';
    verdictMsg = '🚨 CRÍTICO — resposta praticamente IDÊNTICA sem header de autenticação! Possível Broken Auth/BOLA.';
  } else if (noAuth.ok && noAuth.status >= 200 && noAuth.status < 300) {
    verdict = 'warn';
    verdictMsg = '⚠ Atenção — endpoint respondeu 2xx sem autenticação (corpo diferente do original, validar manualmente).';
  }
  return { type: 'auth', verdict, verdictMsg, withAuth, noAuth, accountB };
}

async function aveoneTestIDOR(row, accountBLines) {
  const found = aveoneFindIdInUrl(row.url);
  const headerLines = aveoneHeaderArrayToLines(row.reqHeaders);

  let crossAccount = null;
  if (accountBLines && accountBLines.length) {
    const swapped = aveoneSwapAuthHeaders(headerLines, accountBLines);
    crossAccount = await aveoneSend(row.method, row.url, swapped, row.body, { includeAuth: true, includeCookies: false });
  }

  if (!found && !crossAccount) {
    return { type: 'idor', verdict: 'ok', verdictMsg: 'Nenhum ID numérico no path da URL e nenhuma Conta B informada — teste não aplicável.' };
  }

  let resPlus = null, resMinus = null, urlPlus = null, urlMinus = null;
  if (found) {
    const idNum = parseInt(found.id, 10);
    const buildUrl = (newId) => {
      const p = found.parts.slice();
      p[found.segIndex] = String(newId);
      return p.join('/') + found.query;
    };
    urlPlus  = buildUrl(idNum + 1);
    urlMinus = buildUrl(Math.max(idNum - 1, 0));
    [resPlus, resMinus] = await Promise.all([
      aveoneSend(row.method, urlPlus, headerLines, row.body, { includeAuth: true, includeCookies: true }),
      aveoneSend(row.method, urlMinus, headerLines, row.body, { includeAuth: true, includeCookies: true })
    ]);
  }

  let verdict = 'ok', verdictMsg = 'OK — nenhum acesso indevido confirmado.';

  if (aveoneIsRateLimited(resPlus) || aveoneIsRateLimited(resMinus) || aveoneIsRateLimited(crossAccount)) {
    verdict = 'warn';
    verdictMsg = '⏸ Rate limit (429) durante o teste — resultado inconclusivo. Repita mais tarde.';
  } else if (crossAccount && crossAccount.ok && crossAccount.status >= 200 && crossAccount.status < 300) {
    verdict = 'critical';
    verdictMsg = '🚨 CRÍTICO — Conta B conseguiu acessar o MESMO recurso da Conta A (mesmo ID, identidade diferente)! IDOR confirmado entre contas — prova forte para o relatório.';
  } else if ((resPlus && resPlus.ok && resPlus.status >= 200 && resPlus.status < 300) ||
             (resMinus && resMinus.ok && resMinus.status >= 200 && resMinus.status < 300)) {
    verdict = 'warn';
    verdictMsg = '⚠ ID vizinho (' + found.id + ' ± 1) respondeu 2xx com a MESMA credencial — indício de IDOR, mas teste com Conta B pra ter prova definitiva (single-account não convence a maioria dos programas).';
  }

  return { type: 'idor', verdict, verdictMsg, originalId: found ? found.id : null, plusUrl: urlPlus, minusUrl: urlMinus, resPlus, resMinus, crossAccount };
}

async function aveoneTestMethods(row) {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const headerLines = aveoneHeaderArrayToLines(row.reqHeaders);
  const results = {};
  for (const m of methods) {
    if (m === row.method) continue;
    const body = (m === 'GET' || m === 'DELETE' || m === 'OPTIONS' || m === 'HEAD') ? null : row.body;
    results[m] = await aveoneSend(m, row.url, headerLines, body, { includeAuth: true, includeCookies: true });
  }
  const rateLimited = Object.values(results).some(r => aveoneIsRateLimited(r));
  // OPTIONS é excluído do veredito: frameworks respondem 200/204 nele por padrão (CORS preflight),
  // não é uma vulnerabilidade — só pegava como falso positivo antes desta correção.
  const allowed = Object.entries(results).filter(([m, r]) => m !== 'OPTIONS' && r.ok && r.status >= 200 && r.status < 300);

  let verdict = 'ok', verdictMsg = 'OK — nenhum método inesperado foi aceito.';
  if (rateLimited) {
    verdict = 'warn';
    verdictMsg = '⏸ Rate limit (429) durante o fuzzing — resultado pode estar incompleto. Repita mais tarde.';
  } else if (allowed.length) {
    verdict = 'warn';
    verdictMsg = `⚠ Métodos não esperados aceitos com 2xx: ${allowed.map(a => a[0]).join(', ')} — validar se deveriam estar disponíveis.`;
  }
  return { type: 'methods', verdict, verdictMsg, results };
}

async function aveoneTestMassAssignment(row) {
  let bodyObj;
  try { bodyObj = JSON.parse(row.body || '{}'); }
  catch (e) { return { type: 'mass', verdict: 'ok', verdictMsg: 'Body original não é JSON válido — teste não aplicável.' }; }

  const extraFields = { role: 'admin', isAdmin: true, is_admin: true, admin: true };
  const tamperedBody = JSON.stringify(Object.assign({}, bodyObj, extraFields));
  const headerLines = aveoneHeaderArrayToLines(row.reqHeaders);
  const method = ['POST', 'PUT', 'PATCH'].includes(row.method) ? row.method : 'POST';
  const res = await aveoneSend(method, row.url, headerLines, tamperedBody, { includeAuth: true, includeCookies: true });

  let verdict = 'ok', verdictMsg = 'OK — campos extras não foram refletidos na resposta.';
  const reflected = [];

  if (aveoneIsRateLimited(res)) {
    verdict = 'warn';
    verdictMsg = '⏸ Rate limit (429) durante o teste — resultado inconclusivo. Repita mais tarde.';
  } else if (res.ok && res.body) {
    // Verifica se o VALOR injetado voltou refletido no JSON (não apenas a palavra solta no texto,
    // que daria falso positivo em qualquer resposta que mencione "role" por outro motivo).
    for (const [k, v] of Object.entries(extraFields)) {
      const valStr = typeof v === 'string' ? `"${v}"` : String(v);
      const escK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escV = valStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`"${escK}"\\s*:\\s*${escV}`, 'i');
      if (pattern.test(res.body)) reflected.push(k);
    }
    if (reflected.length) {
      verdict = 'critical';
      verdictMsg = `🚨 CRÍTICO — campo(s) ${reflected.join(', ')} foram refletidos na resposta com o valor injetado! Mass assignment confirmado (valide com um GET de confirmação se persistiu).`;
    }
  }
  return { type: 'mass', verdict, verdictMsg, tamperedBody, res, reflected };
}

// Teste ativo de CORS — NÃO dá pra forjar o header Origin manualmente via fetch() (é um
// "forbidden header name" do spec, o browser sempre manda o valor real). Mas isso na verdade
// ajuda: o browser vai mandar Origin: chrome-extension://<id-da-extensão> automaticamente —
// uma origem que NENHUM servidor legítimo teria colocado numa allowlist de propósito. Se o
// servidor refletir essa origem de volta em Access-Control-Allow-Origin, é prova definitiva de
// que ele aceita QUALQUER origem (reflexão real), não apenas uma allowlist fixa.
async function aveoneTestCors(row) {
  const headerLines = aveoneHeaderArrayToLines(row.reqHeaders);
  const res = await aveoneSend(row.method, row.url, headerLines, row.body, { includeAuth: true, includeCookies: true });

  if (!res.ok) return { type: 'cors', verdict: 'ok', verdictMsg: 'Erro ao enviar requisição: ' + res.error, res };
  if (aveoneIsRateLimited(res)) {
    return { type: 'cors', verdict: 'warn', verdictMsg: '⏸ Rate limit (429) durante o teste — resultado inconclusivo.', res };
  }

  let ourOrigin = '';
  try { ourOrigin = chrome.runtime.getURL('').replace(/\/$/, ''); } catch (e) { /* contexto sem chrome.runtime */ }

  const allowOriginEntry = (res.headers || []).find(([k]) => /^access-control-allow-origin$/i.test(k));
  const allowCredsEntry  = (res.headers || []).find(([k]) => /^access-control-allow-credentials$/i.test(k));

  if (!allowOriginEntry) {
    return { type: 'cors', verdict: 'ok', verdictMsg: 'OK — endpoint não envia Access-Control-Allow-Origin (CORS não habilitado para este recurso).', res, ourOrigin };
  }

  const allowOrigin = allowOriginEntry[1].trim();
  const allowCreds = allowCredsEntry && /true/i.test(allowCredsEntry[1]);

  let verdict = 'ok', verdictMsg = `OK — Allow-Origin (${allowOrigin}) é fixo e não reflete nossa origem de teste (${ourOrigin}).`;

  if (allowOrigin === '*' && allowCreds) {
    verdict = 'critical';
    verdictMsg = '🚨 CRÍTICO — Access-Control-Allow-Origin: * combinado com Allow-Credentials: true (configuração inválida — browsers bloqueiam, mas mostra servidor mal configurado).';
  } else if (ourOrigin && allowOrigin === ourOrigin) {
    verdict = 'critical';
    verdictMsg = `🚨 CRÍTICO CONFIRMADO — o servidor REFLETIU nossa origem de extensão (${ourOrigin}) em Access-Control-Allow-Origin! Isso prova reflexão de QUALQUER origem, não é allowlist.${allowCreds ? ' Combinado com Allow-Credentials: true = roubo de sessão cross-origin confirmado.' : ''}`;
  } else if (allowOrigin === '*') {
    verdict = 'warn';
    verdictMsg = '⚠ Allow-Origin: * sem credentials — não rouba sessão autenticada, mas expõe a resposta a qualquer site.';
  }

  return { type: 'cors', verdict, verdictMsg, allowOrigin, allowCreds, ourOrigin, res };
}
