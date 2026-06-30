// ── AveOne DevTools Inspector — Scanner de Vulnerabilidades ──────────────────
// Regras heurísticas baseadas em padrões comuns de bug bounty.
// Cada regra: id, severidade, regex, título, descrição, recomendação.

function aveoneLuhnCheck(numStr) {
  const digits = numStr.replace(/[^0-9]/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const AVEONE_RULES = [
  {
    id: 'aws-key',
    sev: 'CRITICAL',
    re: /AKIA[0-9A-Z]{16}/g,
    title: 'AWS Access Key exposta',
    desc: 'Chave de acesso AWS (AKIA...) encontrada em texto plano.',
    fix: 'Revogar a chave imediatamente no IAM e mover para variável de ambiente/secrets manager.'
  },
  {
    id: 'private-key',
    sev: 'CRITICAL',
    re: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    title: 'Chave privada exposta',
    desc: 'Bloco de chave privada PEM encontrado no código/resposta.',
    fix: 'Remover do código-fonte/resposta, revogar a chave e gerar um novo par.'
  },
  {
    id: 'hardcoded-secret',
    sev: 'HIGH',
    re: /(api[_-]?key|apikey|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][A-Za-z0-9\-_.]{10,}['"]/gi,
    title: 'Secret/API key hardcoded',
    desc: 'Possível chave de API, secret ou token fixo no código.',
    fix: 'Mover para variável de ambiente. Se for produção, revogar e rotacionar a credencial.'
  },
  {
    id: 'jwt-token',
    sev: 'INFO',
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g,
    title: 'Token JWT encontrado',
    desc: 'JWT presente — decodificado automaticamente abaixo. Verifique alg, exp e claims sensíveis.',
    fix: 'Testar alg=none, confusão RS256→HS256, secret fraco (jwt_tool) e expiração.'
  },
  {
    id: 'eval-sink',
    sev: 'HIGH',
    re: /\beval\s*\(|new\s+Function\s*\(/g,
    title: 'Uso de eval()/Function() — risco de RCE/XSS',
    desc: 'Execução dinâmica de código a partir de string. Se a entrada vier do usuário, é RCE/XSS.',
    fix: 'Substituir por JSON.parse, mapas de função fixos, ou validação estrita de input.'
  },
  {
    id: 'dom-xss-sink',
    sev: 'HIGH',
    re: /\.innerHTML\s*=|document\.write\s*\(|outerHTML\s*=/g,
    title: 'DOM XSS sink (innerHTML/document.write)',
    desc: 'Atribuição direta a innerHTML/outerHTML ou document.write — vetor clássico de DOM XSS.',
    fix: 'Usar textContent, ou sanitizar com DOMPurify antes de inserir HTML dinâmico.'
  },
  {
    id: 'cors-wildcard-creds',
    sev: 'HIGH',
    re: /Access-Control-Allow-Origin:\s*\*/gi,
    title: 'CORS com wildcard (*)',
    desc: 'Access-Control-Allow-Origin: * — se combinado com Allow-Credentials:true, é crítico.',
    fix: 'Restringir a origem a uma allowlist explícita. Nunca usar * com credentials.'
  },
  {
    id: 'cors-allow-credentials',
    sev: 'INFO',
    // Downgrade de CRITICAL para INFO: a presença isolada deste header NÃO é vulnerabilidade.
    // CDNs legítimos (ex: googlevideo.com) sempre mandam isso com Allow-Origin FIXO — só é
    // crítico se Allow-Origin reflete a origem do request ou é wildcard (ver 'cors-origin-reflected'
    // abaixo, que correlaciona os dois headers, ou o teste ativo de CORS no API Tester).
    re: /Access-Control-Allow-Credentials:\s*true/gi,
    title: 'CORS Allow-Credentials: true (informativo — ver achado correlacionado)',
    desc: 'Presença isolada não prova vulnerabilidade. Só é crítico se Allow-Origin reflete a origem do request ou é wildcard.',
    fix: 'Use o teste ativo "Testar CORS" no API Tester pra confirmar reflexão de origem antes de reportar.'
  },
  {
    id: 'supabase-url',
    sev: 'LOW',
    re: /https:\/\/[a-z0-9]{15,25}\.supabase\.co/gi,
    title: 'Endpoint Supabase exposto',
    desc: 'URL de projeto Supabase encontrada. Por padrão é pública (faz parte do design) — o que importa é se RLS (Row Level Security) está habilitado nas tabelas.',
    fix: 'Testar acesso direto via REST (/rest/v1/<tabela>) com a anon key — se retornar dados sem policy aplicada, RLS está desabilitado (CRITICAL).'
  },
  {
    id: 'weak-crypto',
    sev: 'MEDIUM',
    re: /\b(MD5|SHA1|DES|RC4)\b/g,
    title: 'Algoritmo criptográfico fraco',
    desc: 'Referência a MD5/SHA1/DES/RC4 — inadequados para senhas, tokens ou assinatura.',
    fix: 'Usar bcrypt/argon2 para senhas, SHA-256+ para hashing, AES-GCM para cifragem.'
  },
  {
    id: 'debug-leak',
    sev: 'MEDIUM',
    re: /(stack trace|Traceback \(most recent|Exception in thread|DEBUG\s*=\s*true|django\.db\.utils|at\s+\/[a-zA-Z0-9_\-\/.]+:\d+:\d+)/gi,
    title: 'Vazamento de informação de debug',
    desc: 'Stack trace, exception ou flag de debug exposta na resposta — vaza paths/stack interno.',
    fix: 'Desativar debug em produção e usar páginas de erro genéricas.'
  },
  {
    id: 'sqli-concat',
    sev: 'HIGH',
    re: /(SELECT|INSERT|UPDATE|DELETE)\b[^;]{0,80}\+\s*(req\.|params\.|input|request\.)/gi,
    title: 'Possível SQL Injection (concatenação)',
    desc: 'Query SQL concatenada diretamente com input do usuário.',
    fix: 'Usar prepared statements / queries parametrizadas (nunca concatenar input em SQL).'
  },
  {
    id: 'insecure-cookie',
    sev: 'MEDIUM',
    re: /Set-Cookie:[^\n]*/gi,
    title: 'Cookie sem flags de segurança',
    desc: 'Cookie encontrado — verifique se possui Secure, HttpOnly e SameSite.',
    fix: 'Adicionar Secure; HttpOnly; SameSite=Strict (ou Lax) em todos os cookies de sessão.',
    extraCheck: (match) => !/Secure/i.test(match) || !/HttpOnly/i.test(match)
  },
  {
    id: 'postmessage-no-origin',
    sev: 'MEDIUM',
    re: /addEventListener\(\s*['"]message['"]/g,
    title: 'postMessage listener — verificar validação de origin',
    desc: 'Listener de "message" encontrado. Se não validar event.origin, permite XSS/spoofing cross-origin.',
    fix: 'Sempre validar event.origin contra uma allowlist antes de processar event.data.'
  },
  {
    id: 'storage-sensitive',
    sev: 'MEDIUM',
    re: /(localStorage|sessionStorage)\.setItem\([^)]*(token|password|secret|jwt)/gi,
    title: 'Dado sensível em localStorage/sessionStorage',
    desc: 'Token/senha/secret armazenado em Web Storage — acessível via XSS (sem flag HttpOnly).',
    fix: 'Preferir cookies HttpOnly+Secure para tokens de sessão em vez de localStorage.'
  },
  {
    id: 'mixed-content',
    sev: 'LOW',
    re: /["'(]http:\/\/[a-zA-Z0-9.\-]+[^"')\s]*/g,
    title: 'Mixed content (http:// em contexto possivelmente https)',
    desc: 'URL http:// (não criptografada) referenciada — pode ser bloqueada pelo browser ou ser MITM-ável.',
    fix: 'Forçar https:// em todos os recursos e usar HSTS.',
    // Ignora namespaces XML/SOAP/WSDL (xmlns="http://...", schemas.*) — não são vulnerabilidade,
    // são apenas identificadores de schema e geram falso positivo constante em APIs SOAP.
    extraCheck: (match) => !/xmlns|schemas\.|w3\.org|xmlsoap\.org/i.test(match)
  },
  {
    id: 'pii-cpf',
    sev: 'MEDIUM',
    re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
    title: 'CPF exposto na resposta',
    desc: 'Documento pessoal (CPF) encontrado em texto plano — possível excessive data exposure (API Top 10 #3).',
    fix: 'Mascarar CPF na resposta (ex: ***.***.123-45) e retornar apenas o necessário para a UI.'
  },
  {
    id: 'pii-cnpj',
    sev: 'LOW',
    re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
    title: 'CNPJ exposto na resposta',
    desc: 'Documento de empresa (CNPJ) em texto plano na resposta da API.',
    fix: 'Avaliar se o campo é necessário para o cliente ou pode ser omitido/mascarado.'
  },
  {
    id: 'pii-email',
    sev: 'INFO',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    title: 'E-mail exposto na resposta',
    desc: 'Endereço de e-mail em texto plano. Sinal fraco isolado, mas relevante se aparecer em listagem de outros usuários (IDOR/excessive exposure).',
    fix: 'Verificar se o endpoint deveria retornar e-mails de outros usuários além do autenticado.'
  },
  {
    id: 'pii-creditcard',
    sev: 'CRITICAL',
    re: /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,4}\b/g,
    title: 'Número de cartão de crédito exposto (checksum Luhn válido)',
    desc: 'Padrão de dígitos agrupados que passa a validação Luhn — alta confiança de ser um PAN real, não apenas um número de pedido/telefone.',
    fix: 'PCI-DSS exige tokenização — nunca retornar PAN completo.',
    // Valida Luhn para eliminar falso positivo de IDs de pedido/telefone com a mesma formatação.
    extraCheck: (match) => aveoneLuhnCheck(match)
  },
  {
    id: 'pii-phone-br',
    sev: 'INFO',
    re: /\(\d{2}\)\s?\d{4,5}-\d{4}/g,
    title: 'Telefone (BR) exposto na resposta',
    desc: 'Número de telefone em formato brasileiro encontrado em texto plano.',
    fix: 'Verificar se o campo é necessário para o contexto do endpoint.'
  },
  {
    id: 'sensitive-comment',
    sev: 'LOW',
    re: /\/\/.*\b(TODO|FIXME|HACK)\b.*\b(password|secret|key|vuln|backdoor|bypass)\b/gi,
    title: 'Comentário sensível no código',
    desc: 'Comentário de desenvolvedor menciona informação sensível ou aviso de segurança.',
    fix: 'Remover comentários sensíveis do código antes de deploy/publicação.'
  }
];

function decodeJWT(token) {
  try {
    const [h, p] = token.split('.');
    const pad = s => s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const header  = JSON.parse(atob(pad(h)));
    const payload = JSON.parse(atob(pad(p)));
    const issues = [];
    if ((header.alg || '').toLowerCase() === 'none') issues.push('alg=none — JWT pode ser forjado sem assinatura!');
    if ((header.alg || '').toUpperCase() === 'HS256') issues.push('HS256 — testar brute-force de secret fraco (jwt_tool -C).');
    if (payload.exp) {
      const exp = new Date(payload.exp * 1000);
      if (exp < new Date()) issues.push('Token expirado (exp no passado) — replay pode ser bloqueado ou não, testar.');
    } else {
      issues.push('Sem campo "exp" — token nunca expira.');
    }
    // Supabase: anon/service_role keys SÃO JWTs com claim "role" — service_role exposta no
    // client é acesso total ao banco (ignora Row Level Security), sempre CRITICAL.
    if (payload.role === 'service_role') {
      issues.push('🚨 SERVICE_ROLE key do Supabase — acesso TOTAL ao banco, ignora RLS! Nunca deveria estar no client-side.');
    } else if (payload.role === 'anon') {
      issues.push('Chave "anon" do Supabase (esperado ser pública) — confirme que RLS está habilitado em TODAS as tabelas antes de descartar.');
    }
    return { header, payload, issues };
  } catch (e) {
    return null;
  }
}

// Correlaciona Origin (request) com Access-Control-Allow-Origin (response) no texto combinado —
// só assim dá pra distinguir CORS seguro (allow-origin fixo, ex: CDN do YouTube) de CORS
// vulnerável de verdade (reflete a origem enviada, ou wildcard com credentials).
function aveoneCorsCorrelatedCheck(text) {
  const findings = [];
  const allowOriginMatch = text.match(/^Access-Control-Allow-Origin:\s*(.+)$/im);
  if (!allowOriginMatch) return findings;
  const allowOrigin = allowOriginMatch[1].trim();
  const allowCreds = /^Access-Control-Allow-Credentials:\s*true/im.test(text);
  const originMatch = text.match(/^Origin:\s*(.+)$/im);
  const reqOrigin = originMatch ? originMatch[1].trim() : null;

  if (allowOrigin === '*' && allowCreds) {
    findings.push({
      id: 'cors-wildcard-creds-confirmed', sev: 'CRITICAL',
      title: 'CORS: wildcard (*) combinado com credentials',
      desc: 'Access-Control-Allow-Origin: * junto com Allow-Credentials: true — browsers modernos bloqueiam isso, mas indica configuração quebrada no servidor.',
      fix: 'Nunca usar * com credentials; usar allowlist explícita de origens.',
      snippet: allowOriginMatch[0], index: allowOriginMatch.index
    });
  } else if (reqOrigin && allowOrigin === reqOrigin && allowCreds) {
    // Origin == Allow-Origin é AMBÍGUO passivamente: pode ser allowlist correta (servidor só aceita
    // este domínio específico, ex: CDN do YouTube) OU reflexão automática de QUALQUER origem (vulnerável).
    // Só dá pra confirmar testando com um Origin DIFERENTE — daí o teste ativo "Testar CORS" no API Tester.
    findings.push({
      id: 'cors-origin-matches', sev: 'LOW',
      title: 'CORS: Allow-Origin igual ao Origin enviado (verificar reflexão)',
      desc: `Allow-Origin (${allowOrigin}) é idêntico ao Origin enviado nesta request. Pode ser allowlist correta (só aceita este domínio) OU reflexão automática de qualquer origem — passivamente não dá pra distinguir.`,
      fix: 'Use o teste ativo "Testar CORS" no API Tester com um Origin forjado (ex: https://evil.test) — só reflexão confirmada com origem DIFERENTE da original é CRITICAL.',
      snippet: allowOriginMatch[0], index: allowOriginMatch.index
    });
  }
  return findings;
}

function scanText(text) {
  const findings = [];
  for (const rule of AVEONE_RULES) {
    const matches = [...text.matchAll(rule.re)];
    for (const m of matches) {
      if (rule.extraCheck && !rule.extraCheck(m[0])) continue;
      findings.push({
        id: rule.id, sev: rule.sev, title: rule.title, desc: rule.desc, fix: rule.fix,
        snippet: m[0].slice(0, 200),
        index: m.index
      });
    }
  }
  findings.push(...aveoneCorsCorrelatedCheck(text));
  // Dedup por id+snippet (evita repetir o mesmo achado 50x)
  const seen = new Set();
  const deduped = [];
  for (const f of findings) {
    const key = f.id + '::' + f.snippet;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(f);
  }
  // Ordena por severidade
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  deduped.sort((a, b) => order[a.sev] - order[b.sev]);
  return deduped;
}
