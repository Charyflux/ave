<div align="center">

<img src="https://raw.githubusercontent.com/Charyflux/ave/main/assets/icon.png" width="110" alt="AveBrowser Logo"/>

# AveBrowser

<h3>🔐 O Navegador Para Bug Hunters & Pentesters</h3>

<p>
  <a href="#"><img src="https://img.shields.io/badge/version-v1.3.6--beta-ff3355?style=for-the-badge&logo=github&logoColor=white" alt="Version"/></a>
  <a href="#"><img src="https://img.shields.io/badge/status-BETA-orange?style=for-the-badge&logo=statuspage&logoColor=white" alt="Beta"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Electron-28.3.3-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Go-1.22-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Rust-2021-CE422B?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"/></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-00e5ff?style=for-the-badge" alt="Platform"/></a>
</p>

<p>
  <a href="#-instalação"><img src="https://img.shields.io/badge/⬇ DOWNLOAD-v1.3.6-7c3aed?style=for-the-badge" alt="Download"/></a>
  <a href="#-stack-de-tecnologias"><img src="https://img.shields.io/badge/STACK-Go+Rust+JS-00e5ff?style=for-the-badge" alt="Stack"/></a>
  <a href="#"><img src="https://img.shields.io/badge/licença-MIT-22c55e?style=for-the-badge" alt="License"/></a>
</p>

> **⚠️ AVISO BETA** — O AveBrowser está em desenvolvimento ativo. Algumas funcionalidades podem estar incompletas. Use apenas em ambientes autorizados e para fins educacionais, bug bounty e testes de segurança legítimos.

---

```
 █████╗ ██╗   ██╗███████╗██████╗ ██████╗  ██████╗ ██╗    ██╗███████╗███████╗██████╗
██╔══██╗██║   ██║██╔════╝██╔══██╗██╔══██╗██╔═══██╗██║    ██║██╔════╝██╔════╝██╔══██╗
███████║██║   ██║█████╗  ██████╔╝██████╔╝██║   ██║██║ █╗ ██║███████╗█████╗  ██████╔╝
██╔══██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══██╗██║   ██║██║███╗██║╚════██║██╔══╝  ██╔══██╗
██║  ██║ ╚████╔╝ ███████╗██████╔╝██║  ██║╚██████╔╝╚███╔███╔╝███████║███████╗██║  ██║
╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝╚══════╝╚═╝  ╚═╝
             Bug Bounty Edition · Powered by AveOne · v1.3.6 BETA
```

</div>

---

## 📋 Índice

- [🧠 O que é o AveBrowser?](#-o-que-é-o-avebrowser)
- [🆚 Por que AveBrowser e não outros?](#-por-que-avebrowser-e-não-outros)
- [⚡ Stack de Tecnologias](#-stack-de-tecnologias)
- [🔥 Funcionalidades Principais](#-funcionalidades-principais)
- [🛡️ PHANTOM DevTools](#️-phantom-devtools)
- [🔍 AveOne Inspector](#-aveone-inspector)
- [🌐 Proxy MITM (Go)](#-proxy-mitm-go)
- [⚔️ Fuzzer Assíncrono (Rust)](#️-fuzzer-assíncrono-rust)
- [🧅 TOR & Anonimato](#-tor--anonimato)
- [🧩 Sistema de Extensões](#-sistema-de-extensões)
- [⌨️ Atalhos](#️-atalhos)
- [📦 Instalação](#-instalação)
- [🔧 Build do Código Fonte](#-build-do-código-fonte)
- [⚖️ Legal & Ética](#️-legal--ética)

---

## 🧠 O que é o AveBrowser?

O **AveBrowser** é um navegador web especializado construído para **bug hunters, pentesters e pesquisadores de segurança**. Diferente de browsers genéricos, o AveBrowser integra nativamente as ferramentas que um profissional de segurança usa no dia-a-dia — sem precisar instalar extensões, configurar proxies externos ou alternar entre janelas.

É o único navegador que combina:

- 🔐 **Proxy MITM nativo** — escrito em Go, intercepta HTTP e HTTPS com full body capture
- ⚔️ **Fuzzer integrado** — escrito em Rust, 500+ req/s com placeholder `FUZZ`
- 🧅 **TOR com 1 clique** — troca de IP automática sem configuração
- 🛡️ **Scanner de vulnerabilidades** — detecta SQLi, XSS, IDOR, CORS, JWT falhos em tempo real
- 🧩 **Chrome Extensions MV2** — carrega extensões como Wappalyzer, HackBar, etc.
- 🔒 **SSL bypass nativo** — acessa sites com certificados inválidos sem aviso

> Tudo dentro de uma única janela. Sem janelas extras, sem configuração complicada.

---

## 🆚 Por que AveBrowser e não outros?

### Comparativo Detalhado

| Funcionalidade | AveBrowser | Chrome/Firefox | Burp Suite | OWASP ZAP |
|---|:---:|:---:|:---:|:---:|
| Proxy MITM integrado | ✅ Nativo (Go) | ❌ Precisa configurar | ✅ Mas pago | ✅ Mas pesado |
| Fuzzer embutido | ✅ Rust (500+ req/s) | ❌ | ❌ Intruder (pago) | ⚠️ Limitado |
| Scanner automático | ✅ Tempo real | ❌ | ⚠️ Manual | ✅ Mas lento |
| TOR com 1 clique | ✅ | ❌ | ❌ | ❌ |
| SSL bypass | ✅ Automático | ⚠️ Manual | ✅ | ✅ |
| Chrome Extensions | ✅ MV2 + MV3 | ✅ | ❌ | ❌ |
| Userscripts | ✅ Nativo | ⚠️ Tampermonkey | ❌ | ❌ |
| JWT Decoder/Editor | ✅ PHANTOM | ❌ | ⚠️ Plugin | ❌ |
| Cookie Manager | ✅ PHANTOM | ⚠️ DevTools | ✅ | ✅ |
| Storage Explorer | ✅ PHANTOM | ⚠️ DevTools | ❌ | ❌ |
| CORS Tester | ✅ Automático | ❌ | ⚠️ Manual | ⚠️ |
| Export HAR | ✅ `/api/export/har` | ✅ | ✅ | ✅ |
| Capture histórico | ✅ 10.000 requests | ❌ | ✅ | ✅ |
| Replay de requests | ✅ Go API | ❌ | ✅ Repeater | ✅ |
| Preço | 🆓 **GRÁTIS** | 🆓 | 💰 €449/ano | 🆓 |
| Configuração | 🟢 Zero config | 🟡 Manual | 🔴 Complexo | 🔴 Complexo |
| Peso / Leveza | 🟢 Leve | 🔴 RAM pesado | 🔴 JVM pesado | 🔴 JVM pesado |

### Por que não usar Burp Suite?

O Burp Suite é excelente — mas:
- A versão gratuita (Community) tem o **Intruder limitado** (throttled)
- Custa **€449/ano** na versão Pro
- Precisa de configuração de proxy no browser
- Não tem TOR integrado
- Não tem scanner de vulnerabilidades em tempo real sem licença

O AveBrowser entrega o essencial **de graça, sem configuração**.

---

## ⚡ Stack de Tecnologias

O AveBrowser usa as melhores linguagens para cada função:

```
┌─────────────────────────────────────────────────────────────┐
│                    AVEBROWSER v2.0                          │
│                                                             │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │   ELECTRON  │  │  Go 1.22   │  │     Rust 2021        │ │
│  │  (Shell UI) │  │ MITM Proxy │  │  Fast HTTP Fuzzer    │ │
│  │  HTML/JS/CS │  │  :7777     │  │  avefuzz CLI         │ │
│  │  48.8%      │  │  7.8%      │  │  6.2%                │ │
│  └──────┬──────┘  └─────┬──────┘  └──────────┬───────────┘ │
│         │               │                     │             │
│         └───────────────┴─────────────────────┘             │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │  Bash Scripts 2.6%  │                        │
│              │  setup / build / run│                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

| Linguagem | % | Uso |
|---|---|---|
| **HTML/CSS** | 48.8% | Interface do browser, DevTools PHANTOM, painéis |
| **JavaScript** | 34.6% | Lógica do renderer, eventos, IPC, scanner AveOne |
| **Go** | 7.8% | Proxy MITM HTTP/HTTPS, WebSocket API, replay, HAR export |
| **Rust** | 6.2% | Fuzzer assíncrono (tokio), 500+ req/s, scan de vulns |
| **Shell/Bash** | 2.6% | Build pipeline, setup automático, launcher |

---

## 🔥 Funcionalidades Principais

<details>
<summary><b>🌐 Browser Core (Electron + Chromium)</b></summary>

- Motor Chromium 120 via Electron 28
- Abas múltiplas com session persistente (`persist:avebrowser`)
- User-Agent customizável por aba
- SSL/TLS bypass automático (`ignore-certificate-errors`)
- Gestão de permissões: auto-allow para media/clipboard, auto-deny para geolocalização/notificações
- Barra de favoritos, bookmarks integrados (HackerOne, Bugcrowd, OWASP, Shodan, GTFOBins...)
- Detecção automática de tecnologias (Wappalyzer-like)
- Find-in-page (`Ctrl+F`), Zoom, DevTools (`F12`)
- Modo fullscreen (`F11`)
- Notas por domínio (salvas localmente)

</details>

<details>
<summary><b>🔄 Intercepção de Traffic em Tempo Real</b></summary>

O proxy Go intercepta **100% do tráfego** — HTTP e HTTPS via MITM:

- Captura request headers, body, response headers, response body
- Streaming em tempo real via WebSocket para o renderer
- Histórico de até **10.000 requests** em memória
- Filtros por host, status code, content-type
- Busca full-text no corpo das respostas
- Export em **HAR** (compatível com Burp Suite, OWASP ZAP, Postman)
- **Replay** de qualquer request com modificações
- Scanner de vulnerabilidades embutido em cada resposta

</details>

<details>
<summary><b>📡 Captura & Análise de Requests</b></summary>

Cada request capturado mostra:
- Método, URL, Status Code, Duração (ms), Tamanho
- Request Headers completos
- Request Body (POST, PUT, PATCH)
- Response Headers completos  
- Response Body com highlight de JSON/HTML
- **Flags de vulnerabilidade** automáticas: SQL-Error, Stack-Trace, AWS-Key, Private-Key, JWT-Token, Debug-Mode, Dir-Listing, PHP-Error, Secret-Env, Open-Redirect, CORS-Wildcard

</details>

---

## 🛡️ PHANTOM DevTools

O PHANTOM é o conjunto de ferramentas de segurança integrado ao AveBrowser. Abre com o botão **TOOLS** na barra superior.

### 🍪 Cookie Manager
- Lista todos os cookies do domínio ativo
- Edita nome, valor, domínio, path, flags (Secure, HttpOnly, SameSite)
- Deleta cookies individuais ou todos
- Importa/exporta cookies em JSON
- Detecta cookies de sessão, CSRF tokens, JWT em cookies

### 🗃️ Storage Explorer
- **localStorage** — lê, edita, deleta entradas
- **sessionStorage** — idem
- **IndexedDB** — lista databases e object stores
- Detecta dados sensíveis armazenados (tokens, keys, dados de usuário)
- Export completo em JSON

### 🔐 JWT Decoder & Editor
- Cola qualquer JWT e decodifica header + payload automaticamente
- Mostra algoritmo (HS256, RS256, ES256...) e claims (exp, iat, sub, role...)
- Detecta JWTs com algoritmo `none` (vulnerabilidade crítica)
- Detecta JWTs expirados
- Edita payload e assina novamente com chave customizada
- Testa **algorithm confusion** (RS256→HS256)

### 🔄 Encoder / Decoder
- Base64 / Base64URL (encode + decode)
- URL Encode / Decode
- HTML Entities encode/decode
- Hex, Binary, ROT13
- MD5, SHA1, SHA256 hashing
- Detecção automática do tipo de encoding

### 🎯 Payload Library (+70 payloads)
Payloads prontos para copiar, organizados por categoria:

| Categoria | Exemplos |
|---|---|
| **XSS** | `<script>alert(1)</script>`, SVG, img onerror, polyglots |
| **SQLi** | `' OR 1=1--`, UNION SELECT, time-based blind, error-based |
| **SSRF** | `http://169.254.169.254`, `http://localhost`, `file:///etc/passwd` |
| **LFI** | `../../../etc/passwd`, null byte bypass, encoding bypass |
| **XXE** | DOCTYPE SYSTEM, parameter entities, blind XXE |
| **SSTI** | `{{7*7}}`, `${7*7}`, `<%= 7*7 %>` (Jinja2, Freemarker, Twig) |
| **IDOR** | IDs numéricos, UUIDs, encoded IDs |
| **Open Redirect** | `//evil.com`, `\evil.com`, `javascript:` |
| **RCE** | `;id`, `|id`, `$(id)`, backtick injection |
| **CORS** | Origin reflection patterns |

### 🔍 RECON
- Extrai todos os links da página ativa
- Lista endpoints de API detectados (fetch, XHR, form actions)
- Detecta comentários HTML com informações sensíveis
- Lista arquivos JavaScript carregados
- Extrai IPs, emails, tokens mencionados no source

---

## 🔍 AveOne Inspector

O AveOne corre em background enquanto você navega e **detecta automaticamente** vulnerabilidades:

### Scanner Automático (Passivo)
Analisa cada request/response em busca de:

| Vulnerabilidade | O que detecta |
|---|---|
| **CORS** | `Access-Control-Allow-Origin: *`, reflexão de Origin |
| **IDOR** | IDs previsíveis em URLs, respostas cross-user |
| **Broken Auth** | Endpoints acessíveis sem token, tokens weak |
| **Mass Assignment** | Campos `role`, `isAdmin`, `admin` reflectidos em respostas |
| **HTTP Methods** | Métodos inesperados aceitos (PUT, DELETE em endpoints públicos) |
| **Information Disclosure** | Stack traces, erros de BD, chaves expostas |
| **JWT Issues** | `alg: none`, expirados, assinatura não verificada |
| **GraphQL** | Introspecção activa, queries abusáveis |

### API Tester (Ativo)
Ferramenta de repetição e teste activo de requests:
- Repita qualquer request capturado com modificações
- Teste **Broken Auth**: envia com e sem token, compara respostas
- Teste **IDOR**: incrementa/decrementa IDs no path (+1/-1)
- Teste **Mass Assignment**: injeta campos sensíveis no body
- Teste **HTTP Methods**: faz fuzzing de todos os métodos HTTP
- Teste **CORS**: envia `Origin: https://avebrowser-cors-probe.invalid` e verifica reflexão
- Comparação automática de tamanho e status code entre respostas
- Verifica rate limiting (429) e avisa quando resultado é inconclusivo

---

## 🌐 Proxy MITM (Go)

O proxy é um processo **Go** separado que intercepta todo o tráfego do webview.

### Como funciona
```
Browser (Electron)
       │
       ▼ HTTP proxy → :7777
  ┌────────────────┐
  │   Go MITM      │  ← intercept HTTP
  │   Proxy        │  ← generate TLS cert per-host
  │   :7777        │  ← forward to real server
  └────────┬───────┘
           │ WebSocket → :7778/ws (real-time stream)
           ▼
    Electron Renderer
    (PROXY tab UI)
```

### API REST (porta 7778)

| Endpoint | Método | Descrição |
|---|---|---|
| `/ws` | WebSocket | Stream real-time de requests capturados |
| `/api/history` | GET | Lista histórico completo (até 10.000) |
| `/api/history?limit=100` | GET | Últimos 100 requests |
| `/api/clear` | POST | Limpa histórico |
| `/api/stats` | GET | Totais: requests, flagged, HTTPS, API |
| `/api/replay` | POST | Replay de request com body JSON |
| `/api/search?q=login` | GET | Busca full-text no histórico |
| `/api/search?flag=SQL-Error` | GET | Filtra por flag de vulnerabilidade |
| `/api/export/har` | GET | Export completo em formato HAR |
| `/api/tor` | POST | Activa/desactiva TOR SOCKS5 chaining |
| `/ca.crt` | GET | Download do CA cert MITM |

### Scanner de Vulnerabilidades Embutido
O proxy aplica **14 regras regex** em cada resposta:

```
SQL-Error · Stack-Trace · AWS-Key · Private-Key · JWT-Token
Dir-Listing · PHP-Error · Debug-Mode · SSRF-Hit · Open-Redirect
CORS-Wildcard · Secret-Env · GraphQL · Spring-Boot
```

---

## ⚔️ Fuzzer Assíncrono (Rust)

O `avefuzz` é um fuzzer HTTP construído em Rust com `tokio` — leve, rápido, sem overhead de GC.

### Características
- **500+ req/s** em modo concorrente
- Placeholder `FUZZ` em URL, body E headers simultaneamente
- Barra de progresso em tempo real
- Saída colorida com status code por cor
- Scanner de vulns automático nas respostas
- Output JSON para integrar com outras ferramentas
- Suporte a proxy (`--proxy http://127.0.0.1:7777`)

### Exemplos de uso

```bash
# Directory fuzzing básico
avefuzz -u "https://target.com/FUZZ" -w wordlist.txt

# Fuzzing de parâmetros com filtro
avefuzz -u "https://target.com/api/user/FUZZ" -w ids.txt \
        -mc 200,302 --fc 404 -c 100

# Fuzzing de corpo POST (SQLi)
avefuzz -u "https://target.com/login" -X POST \
        -d '{"username":"admin","password":"FUZZ"}' \
        -w passwords.txt \
        -H "Content-Type: application/json" \
        --mr "dashboard|welcome"

# Fuzzing de headers (Auth bypass)
avefuzz -u "https://target.com/admin" \
        --fuzz-headers "X-Original-URL: /FUZZ" \
        -w paths.txt \
        --mc 200

# Via proxy MITM para capturar tudo
avefuzz -u "https://target.com/FUZZ" -w dirs.txt \
        --proxy http://127.0.0.1:7777 \
        -o results.json

# Fuzzing com detecção de vulns
avefuzz -u "https://target.com/search?q=FUZZ" \
        -w xss_payloads.txt \
        --mr "alert\(|onerror="
```

### Flags disponíveis

```
-u  --url           URL alvo com FUZZ placeholder
-w  --wordlist      Ficheiro wordlist
-X  --method        Método HTTP [GET]
-d  --data          Request body (FUZZ também é substituído)
-H  --header        Header extra (repetível)
    --fuzz-headers  Headers com FUZZ substituído
-c  --concurrency   Requisições paralelas [50]
-t  --timeout       Timeout por request em segundos [10]
    --mc            Match status codes (ex: 200,301,302)
    --fc            Filter status codes (ex: 404,400)
    --ms            Match tamanho mínimo de resposta
    --mr            Match regex na resposta
    --fr            Filter regex na resposta
    --proxy         Proxy HTTP (ex: http://127.0.0.1:7777)
    --max-matches   Para após N matches
    --delay         Delay aleatório entre requests (ms)
-o  --output        Salvar resultados em JSON
-q  --quiet         Modo silencioso
-e  --show-errors   Mostrar erros de conexão
```

---

## 🧅 TOR & Anonimato

O AveBrowser integra TOR nativamente via o Go proxy — sem configuração manual.

### Como funciona

```
Webview → Go Proxy (:7777) → SOCKS5 (:9050) → TOR Network → Internet
```

O routing passa pelo proxy Go que faz chaining para o TOR daemon local. Todos os requests capturados são registados mesmo quando em modo TOR.

### Funcionalidades TOR
- ✅ Activar/desactivar com 1 clique (botão **TOR** na barra)
- ✅ **New IP** — sinaliza ao control port (9051) para nova circuit (SIGNAL NEWNYM)
- ✅ Mostra IP actual via `api.ipify.org`
- ✅ Não bypassa o proxy Go — traffic ainda é capturado
- ✅ Badge visual quando TOR está activo

### Instalar TOR
```bash
# Ubuntu/Debian
sudo apt install tor && sudo systemctl start tor

# macOS
brew install tor && brew services start tor

# Arch Linux
sudo pacman -S tor && sudo systemctl start tor
```

---

## 🧩 Sistema de Extensões

O AveBrowser suporta 3 tipos de extensões:

### 🔌 Chrome Extensions (MV2, Unpacked)
Carregue extensões do Chrome desempacotadas directamente:

```
1. Clique em TOOLS → EXT → EXTENSÕES
2. Clique em "CARREGAR EXTENSÃO"
3. Selecione a pasta da extensão
```

**Extensões recomendadas para bug hunting:**
| Extensão | Função |
|---|---|
| **Wappalyzer** | Detect tech stack |
| **HackBar** | Encoding, hashing, XSS tools |
| **Cookie-Editor** | Gestão avançada de cookies |
| **FoxyProxy** | Gestão de proxies |
| **Shodan** | Info sobre o IP do servidor |
| **DotGit** | Detecta `.git` exposto |

### 📜 Userscripts (Tampermonkey-style)
Scripts que correm dentro da página visitada:

```javascript
// ==UserScript==
// @name         Auto-auth header injector
// @match        https://target.com/*
// @version      1.0
// ==/UserScript==
(function() {
  // Injeta header de autenticação automaticamente
  const token = localStorage.getItem('token');
  if (token) {
    fetch('/api/check', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(console.log);
  }
})();
```

**Match patterns suportados:**
- `*://target.com/*` — qualquer protocolo
- `https://api.target.com/v*` — wildcard em path
- `<all_urls>` — todos os sites

### ⚙️ Plugins Nativos
Plugins que correm no contexto do AveBrowser (acesso à `window.ave` API):

```javascript
// ==AvePlugin==
// @name         Auto IDOR Tester
// @description  Testa IDs incrementais automaticamente
// @version      1.0
// ==/AvePlugin==
(function() {
  // Acesso a: showToast, getActiveTab, newTab, navigate, window.ave
  const tab = getActiveTab();
  if (!tab) return;
  
  const url = tab.url;
  const match = url.match(/\/(\d+)(?:\/|$|\?)/);
  if (!match) { showToast('Nenhum ID numérico encontrado na URL'); return; }
  
  const id = parseInt(match[1]);
  showToast(`🔍 Testando IDOR: IDs ${id-3} a ${id+3}`);
  
  // Abrir IDs vizinhos em novas abas
  for (let i = id - 3; i <= id + 3; i++) {
    if (i !== id && i > 0) {
      newTab(url.replace(`/${id}`, `/${i}`));
    }
  }
})();
```

---

## ⌨️ Atalhos

| Atalho | Acção |
|---|---|
| `Ctrl + T` | Nova aba |
| `Ctrl + W` | Fechar aba actual |
| `Ctrl + Shift + T` | Reabrir última aba fechada |
| `Ctrl + Tab` | Próxima aba |
| `Ctrl + Shift + Tab` | Aba anterior |
| `Ctrl + 1-9` | Ir para aba N |
| `Ctrl + L` | Focar barra de URL |
| `Ctrl + R` / `F5` | Recarregar |
| `Alt + ←` | Voltar |
| `Alt + →` | Avançar |
| `Ctrl + F` | Pesquisar na página |
| `F12` | DevTools do Chromium |
| `F11` | Fullscreen |
| `Ctrl + +/-` | Zoom in/out |
| `Ctrl + 0` | Reset zoom |
| `Ctrl + D` | Bookmark página actual |
| `Ctrl + Shift + B` | Toggle barra de bookmarks |
| `Ctrl + U` | Ver código fonte |
| `Ctrl + P` | Imprimir |

---

## 📦 Instalação

### Download Pré-compilado (Recomendado)

Vá até a [página de Releases](https://github.com/Charyflux/ave/releases) e baixe o instalador para o seu sistema:

| Sistema | Ficheiro | Notas |
|---|---|---|
| **Windows 64-bit** | `AveBrowser-Setup-vX.X.X.exe` | NSIS installer |
| **Linux x64** | `AveBrowser-vX.X.X.AppImage` | `chmod +x` depois |
| **Linux x64 DEB** | `avebrowser_X.X.X_amd64.deb` | `sudo dpkg -i` |
| **macOS (Intel)** | `AveBrowser-vX.X.X.dmg` | Drag & Drop |

#### Windows
```powershell
# Baixe e execute o installer
# Se aparecer SmartScreen: "Mais informações" → "Executar mesmo assim"
```

#### Linux (AppImage)
```bash
chmod +x AveBrowser-*.AppImage
./AveBrowser-*.AppImage
```

#### Linux (DEB)
```bash
sudo dpkg -i avebrowser_*_amd64.deb
avebrowser
```

#### macOS
```bash
# Abra o .dmg e arraste para Applications
# Se bloqueado pelo Gatekeeper:
sudo spctl --master-disable  # temporário
```

---

## 🔧 Build do Código Fonte

### Pré-requisitos
- **Node.js** 18+ e npm
- **Go** 1.22+
- **Rust** 1.75+ (via rustup)
- **TOR** (opcional, para funcionalidade TOR)

### Setup automático (Linux / macOS)

```bash
git clone https://github.com/Charyflux/ave.git
cd ave

# Instala todas as dependências automaticamente
bash scripts/setup.sh

# Compila Go proxy + Rust fuzzer
bash scripts/build.sh

# Lança o browser
bash scripts/run.sh
```

### Setup manual (Windows / passo a passo)

```bash
# 1. Clonar repositório
git clone https://github.com/Charyflux/ave.git
cd ave

# 2. Instalar dependências Node.js
npm install

# 3. Compilar proxy Go
cd proxy
go mod tidy
go build -o ../bin/ave-proxy .
cd ..

# 4. Compilar fuzzer Rust
cd fuzzer
cargo build --release
cp target/release/avefuzz ../bin/
cd ..

# 5. Lançar
npx electron .
```

### Build de distribuição (installer)

```bash
# Instalar electron-builder
npm install --save-dev electron-builder

# Windows
npm run build:win

# Linux
npm run build:linux

# macOS
npm run build:mac
```

---

## 📁 Estrutura do Projecto

```
ave/
├── main.js                 # Electron main — spawna proxy Go, IPC
├── preload.js              # contextBridge — window.ave API
├── package.json
│
├── renderer/
│   └── index.html          # UI completa do browser (HTML/CSS/JS)
│
├── proxy/                  # Go MITM proxy
│   ├── main.go             # Proxy HTTP/HTTPS + WebSocket API
│   └── go.mod
│
├── fuzzer/                 # Rust async fuzzer
│   ├── src/main.rs         # avefuzz CLI
│   └── Cargo.toml
│
├── scripts/
│   ├── setup.sh            # Instala dependências
│   ├── build.sh            # Compila Go + Rust
│   └── run.sh              # Lança proxy + browser
│
├── bin/                    # Binários compilados (gerado pelo build)
│   ├── ave-proxy           # Go proxy binary
│   └── avefuzz             # Rust fuzzer binary
│
├── assets/
│   └── icon.png
│
└── .github/
    └── workflows/          # CI/CD para releases automáticas
```

---

## ⚖️ Legal & Ética

> **USE COM RESPONSABILIDADE**

O AveBrowser foi criado para **testes de segurança autorizados**, **bug bounty programs** e **fins educacionais**.

- ✅ **PERMITIDO:** Testar sistemas que você tem autorização explícita para testar
- ✅ **PERMITIDO:** Bug bounty em programas públicos (HackerOne, Bugcrowd, Intigriti)
- ✅ **PERMITIDO:** Testes em ambientes de laboratório próprios
- ✅ **PERMITIDO:** Pesquisa académica e educação em cibersegurança
- ❌ **PROIBIDO:** Acesso não autorizado a sistemas de terceiros
- ❌ **PROIBIDO:** Intercepção de tráfego sem consentimento
- ❌ **PROIBIDO:** Qualquer actividade ilegal

Os autores não se responsabilizam pelo uso indevido desta ferramenta.

---

## 🤝 Contribuir

Contribuições são bem-vindas! Veja como:

```bash
# Fork → Clone → Branch
git checkout -b feature/minha-feature

# Desenvolvimento
# ... faça as suas mudanças ...

# Commit + Push
git commit -m "feat: descrição da feature"
git push origin feature/minha-feature

# Abra um Pull Request
```

---

<div align="center">

**Feito com ❤️ pela equipa AveOne**

[![GitHub Stars](https://img.shields.io/github/stars/Charyflux/ave?style=social)](https://github.com/Charyflux/ave)
[![GitHub Forks](https://img.shields.io/github/forks/Charyflux/ave?style=social)](https://github.com/Charyflux/ave/fork)

*AveBrowser v1.3.6 BETA — Bug Bounty Edition*

**⚠️ VERSÃO BETA — Em desenvolvimento activo. Reporta bugs em [Issues](https://github.com/Charyflux/ave/issues)**

</div>
