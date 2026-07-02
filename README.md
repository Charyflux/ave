<div align="center">

<img src="https://raw.githubusercontent.com/Charyflux/ave/main/assets/icon.png" width="96" height="96" alt="AveBrowser Icon"/>

# AveBrowser

**O browser feito para hackers éticos**

[![Version](https://img.shields.io/badge/versão-1.3.6-7c3aed?style=for-the-badge&logo=github)](https://github.com/Charyflux/ave/releases/latest)
[![Platform](https://img.shields.io/badge/plataformas-Windows%20·%20macOS%20·%20Linux-00e5ff?style=for-the-badge&logo=electron)](https://github.com/Charyflux/ave/releases)
[![Electron](https://img.shields.io/badge/Electron-28.3.3-47848f?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![License](https://img.shields.io/badge/licença-Gratuito-4ade80?style=for-the-badge)](https://github.com/Charyflux/ave/releases)
[![AveOne](https://img.shields.io/badge/by-AveOne%20Security-a78bfa?style=for-the-badge)](https://aveone.com.br)

<br/>

> Browser especializado em **bug bounty** e **pentesting** — scanner automático de vulnerabilidades, +70 payloads, TOR integrado e suporte a extensões Chrome, tudo num único ambiente.

<br/>

[**⬇️ Download Windows**](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser.Setup.1.3.6.exe) &nbsp;·&nbsp;
[**⬇️ Download macOS**](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser-1.3.6-arm64.dmg) &nbsp;·&nbsp;
[**⬇️ Download Linux**](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser-1.3.6.AppImage) &nbsp;·&nbsp;
[**📄 Documentação**](https://github.com/Charyflux/ave/releases)

</div>

---

## ✦ O que é o AveBrowser?

O **AveBrowser** é um navegador Chromium construído especificamente para profissionais de **bug bounty** e **pentesting**. Integra num único ambiente o que normalmente requer dezenas de ferramentas separadas:

- 🔍 **Scanner automático** de vulnerabilidades em background (CORS, IDOR, Broken Auth, Mass Assignment)
- 💉 **Biblioteca de +70 payloads** categorizados (XSS, SQLi, LFI, SSRF, SSTI, CMDi, XXE)
- 👻 **TOR integrado** — anonimato com um clique, rotação de IP automática
- 🧩 **Extensões Chrome MV2** + Userscripts (Tampermonkey-style) + Plugins nativos
- 🔑 **Cookie Manager, JWT Decoder, Storage Explorer, Encoder/Decoder** no painel lateral
- 🌐 **CORS bypass** via processo principal (sem bloqueio do browser)
- 🔒 **SSL bypass** nativo — ideal para ambientes de teste e laboratórios

---

## 📦 Download

| Plataforma | Ficheiro | Tamanho |
|:---:|:---|:---:|
| 🪟 **Windows** | [`AveBrowser.Setup.1.3.6.exe`](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser.Setup.1.3.6.exe) | ~73 MB |
| 🍎 **macOS** (Apple Silicon) | [`AveBrowser-1.3.6-arm64.dmg`](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser-1.3.6-arm64.dmg) | ~90 MB |
| 🐧 **Linux** | [`AveBrowser-1.3.6.AppImage`](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser-1.3.6.AppImage) | ~99 MB |

> Todos os releases disponíveis em [**github.com/Charyflux/ave/releases**](https://github.com/Charyflux/ave/releases)

---

## 🚀 Instalação

<details>
<summary><strong>🪟 Windows</strong></summary>

1. Descarrega o [`AveBrowser.Setup.1.3.6.exe`](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser.Setup.1.3.6.exe)
2. Executa o instalador — sem necessidade de admin, pasta personalizável
3. O AveBrowser aparece no menu Iniciar e no Desktop

</details>

<details>
<summary><strong>🍎 macOS (Apple Silicon M1/M2/M3)</strong></summary>

1. Descarrega o [`AveBrowser-1.3.6-arm64.dmg`](https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser-1.3.6-arm64.dmg)
2. Abre o `.dmg` e arrasta para a pasta **Applications**
3. Na primeira execução: clique direito → **Abrir** (bypass Gatekeeper)

</details>

<details>
<summary><strong>🐧 Linux</strong></summary>

```bash
chmod +x AveBrowser-1.3.6.AppImage
./AveBrowser-1.3.6.AppImage
```

Não requer instalação — AppImage portátil. Para integração no launcher usa o [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

</details>

---

## 🛠️ Funcionalidades

### 👻 PHANTOM DevTools

Painel lateral com 6 ferramentas de segurança sempre disponíveis:

| Ferramenta | Descrição |
|:---:|:---|
| 🍪 **Cookie Manager** | Ver, copiar e deletar cookies da sessão ativa via IPC seguro |
| 💾 **Storage Explorer** | Lê `localStorage` e `sessionStorage` do site ativo |
| 🔑 **JWT Decoder** | Decodifica JWT, analisa algoritmo e mostra expiração |
| 🔄 **Encoder / Decoder** | Base64, URL, HTML entities, Hex, SHA-1, SHA-256, Reverse |
| 💉 **Payload Library** | +70 payloads: XSS, SQLi, LFI, SSRF, SSTI, CMDi, XXE, Open Redirect |
| 🔍 **RECON** | robots.txt, sitemap, link extractor, forms, Shodan, crt.sh, VirusTotal |

---

### 🔬 AveOne Inspector

Scanner automático em background — analisa cada request enquanto navegas:

| Teste | Descrição |
|:---:|:---|
| 🌐 **CORS Tester** | Origin marcada via IPC — sem falsos negativos |
| 🪪 **IDOR Detection** | IDs sequenciais em URLs e body de requests |
| 🔓 **Broken Auth** | Tokens previsíveis, JWT sem assinatura, refresh inseguro |
| 📋 **Mass Assignment** | Campos não esperados aceites pela API |
| 🌐 **HTTP Methods** | PUT, DELETE, PATCH não documentados |
| 📡 **Network Monitor** | Feed em tempo real de todos os requests capturados |

---

### 👁️ TOR & Anonimato

```
Toggle de um clique na toolbar → todo o tráfego vai pelo TOR (SOCKS5 127.0.0.1:9050)
Botão de rotação → novo circuito TOR, novo IP (Control Port 9051)
Integração Caido → proxy HTTP em localhost:8080
SSL bypass → ignore-certificate-errors por padrão
```

---

### 🧩 Sistema de Extensões

Três formas independentes de extender o browser:

<table>
<tr>
<th>Tipo</th>
<th>Como usar</th>
<th>Contexto</th>
</tr>
<tr>
<td><strong>Chrome Extensions (MV2)</strong></td>
<td>Clica em 🧩 na toolbar → seleciona pasta</td>
<td>Processo Chromium nativo</td>
</tr>
<tr>
<td><strong>Userscripts</strong></td>
<td>Import <code>.user.js</code> · header <code>@match</code></td>
<td>Contexto da página</td>
</tr>
<tr>
<td><strong>Native Plugins</strong></td>
<td>API <code>window.ave</code> completa</td>
<td>Renderer do browser</td>
</tr>
</table>

> ⚠️ **Nota:** `.crx` e Chrome Web Store não são suportados. Apenas extensões descompactadas (MV2).

---

### ⌨️ Atalhos de Teclado

| Atalho | Ação | Atalho | Ação |
|:---|:---|:---|:---|
| `Ctrl + T` | Nova aba | `Ctrl + W` | Fechar aba |
| `Ctrl + Shift + T` | Reabrir aba fechada | `Ctrl + Tab` | Próxima aba |
| `Ctrl + 1-9` | Ir para aba nº | `Ctrl + F` | Pesquisar na página |
| `Ctrl + +` / `-` / `0` | Zoom in / out / reset | `Ctrl + D` | Adicionar favorito |
| `Ctrl + Shift + B` | Mostrar/esconder favoritos | `F11` | Ecrã cheio |
| `Ctrl + P` | Imprimir | `Ctrl + U` | Ver código fonte |

---

## 🏗️ Arquitectura Técnica

```
AveBrowser v1.3.6
├── Main Process (Node.js + Electron 28)
│   ├── Gestão de janelas (frameless, titleBarStyle: hidden)
│   ├── TOR SOCKS5 proxy (127.0.0.1:9050 / Control Port 9051)
│   ├── SSL bypass (ignore-certificate-errors)
│   ├── IPC handlers: extensões, cookies, requests, CORS probe
│   ├── CORS bypass via electronNet.request() (sem forbidden headers)
│   └── Session persistente (partition: persist:avebrowser)
│
├── Renderer Process (Chromium)
│   ├── renderer/index.html   — UI principal do browser
│   ├── renderer/aveone-panel.js    — AveOne Inspector
│   ├── renderer/aveone-apitester.js — API Tester & CORS
│   ├── renderer/aveone-scanner.js  — Scanner automático
│   ├── renderer/aveone-formatter.js — Syntax highlighting
│   └── renderer/payloads.js        — Biblioteca de payloads
│
└── userData/
    ├── ave-extensions.json   — Extensões Chrome carregadas
    ├── userscripts/          — Userscripts Tampermonkey-style
    └── plugins/              — Plugins nativos AveBrowser
```

---

## 📋 Especificações

| Especificação | Valor |
|:---|:---|
| **Motor** | Chromium (via Electron 28.3.3) |
| **User Agent** | Chrome padrão (não revela AveBrowser) |
| **App ID** | `com.aveone.browser` |
| **SSL** | `ignore-certificate-errors` + `allow-insecure-localhost` |
| **TOR** | SOCKS5 `127.0.0.1:9050` · Control Port `9051` |
| **Proxy** | Caido `localhost:8080` |
| **Extensões** | Chrome MV2 · Userscripts · Native Plugins |
| **Plataformas** | Windows x64 · macOS arm64 · Linux AppImage |
| **Dependências runtime** | Nenhuma |

---

## 📅 Changelog

<details>
<summary><strong>v1.3.6</strong> — Glassmorphism & AveOne Brand (2026-06-30)</summary>

- Fundo gradiente preto (`#07070f`) → roxo escuro (`#110826`) com glow central AveOne
- Toolbar, navbar e painel com `backdrop-filter: blur` (glassmorphism real)
- Separadores com toque roxo sutil em vez de branco puro
- Webview container semi-transparente para o gradiente sangrar pelas superfícies

</details>

<details>
<summary><strong>v1.3.5</strong> — Barra de Favoritos + Auditoria de Segurança</summary>

- **NOVA:** barra de favoritos estilo Chrome (⭐, `Ctrl+D`, `Ctrl+Shift+B`)
- **FIX [CRASH]:** handlers IPC duplicados no macOS ao reabrir janela via dock
- **FIX [SEGURANÇA]:** falso negativo no teste CORS → origin marcada via IPC
- **FIX [XSS]:** favicon inserido em `innerHTML` sem escaping
- **FIX [LEAK]:** `window.ave.off()` nunca removia listeners reais

</details>

<details>
<summary><strong>v1.3.3 – v1.3.4</strong> — Ícones de Extensão na Toolbar</summary>

- Ícones reais de cada extensão na toolbar entre o botão 🧩 e TOOLS
- Popup flutuante ao clicar, fecha ao perder foco (estilo Chrome)
- Clique direito → remover extensão
- Fix: ícones carregados via `fs.readFileSync` como `data: URI` (bypassa `web_accessible_resources`)

</details>

<details>
<summary><strong>v1.3.0</strong> — Extension Manager Completo</summary>

- Nova tab **EXT** com 3 sistemas: Chrome Extensions MV2, Userscripts, Native Plugins
- `session.loadExtension()` com auto-reload no próximo arranque
- Userscripts: `@match` glob, `@name`, `@description`, import `.user.js`
- Plugins nativos: `window.ave` API completa, enable/disable, botão ▶ manual

</details>

<details>
<summary><strong>v1.2.2</strong> — Context Menu, Find-in-Page, Zoom, Atalhos</summary>

- Menu de contexto (clique direito) com 10+ opções
- Find in page (`Ctrl+F`) com prev/next e contador de resultados
- Zoom por aba (`Ctrl++/-/0`) com indicador que desaparece após 1.5s
- Todos os atalhos: `Ctrl+Shift+T`, `Ctrl+Tab`, `Ctrl+1-9`, `F11`, `Ctrl+P`
- Indicador de áudio: ícone na aba quando media está a tocar
- Notificações de download: toast ao iniciar e ao concluir

</details>

<details>
<summary><strong>v1.2.0</strong> — AveOne Inspector como Painel Nativo</summary>

- 5 sub-abas: Achados, Formatter, Network Monitor, Página Atual, API Tester
- Scanner automático em tempo real via eventos de captura de requests
- CORS bypass via `electronNet.request()` no processo principal
- Feed unificado de achados com notificações

</details>

<details>
<summary><strong>v1.1.0</strong> — PHANTOM DevTools (6 ferramentas)</summary>

- Cookie Manager, Storage Explorer, JWT Decoder, Encoder/Decoder
- +70 payloads: XSS, SQLi, LFI, SSRF, SSTI, CMDi, XXE, Open Redirect
- RECON: robots.txt, sitemap, link extractor, Shodan, crt.sh, VirusTotal

</details>

<details>
<summary><strong>v1.0.0</strong> — Primeira Release</summary>

- Browser Electron com multi-tab, barra de URL, botão GO
- TOR toggle + rotação de IP (SOCKS5 + Control Port)
- Integração Caido e AveOne (`aveone.com.br/app`)
- SSL bypass, Chrome user agent, sessão persistente
- CI/CD: GitHub Actions para Win/Mac/Linux em paralelo

</details>

---

## 🗺️ Roadmap

O que vem a seguir:

- [ ] 📄 **Export de relatórios** — PDF/HTML com achados, evidências e CVSS
- [ ] 🔄 **Auto-update** — atualização automática via GitHub Releases
- [ ] 🖥️ **Suporte Intel Mac (x64)** — build nativa para chips Intel
- [ ] 🤖 **AI Analysis** — integração com LLM para sugestões de ataque
- [ ] 🎬 **Session Recording** — gravar e reproduzir sessões de teste
- [ ] 🔌 **Burp Suite Integration** — além do Caido, suporte a Burp (porta configurável)
- [ ] 🌐 **User Agent Switcher** — biblioteca de UAs: móvel, tablet, browsers
- [ ] 👥 **Colaboração em equipa** — partilhar achados em tempo real via WebSocket
- [ ] 💼 **Workspaces** — organizar testes por projeto com favoritos e configurações independentes
- [ ] 🏪 **Chrome Web Store (MV3)** — suporte a Manifest V3

---

## ⚠️ Aviso Legal

O AveBrowser é desenvolvido **exclusivamente para uso ético e autorizado**:

- ✅ Bug bounty em programas que autorizam testes
- ✅ Pentesting com contrato e autorização escrita
- ✅ Ambientes de laboratório e CTF
- ✅ Investigação de segurança defensiva
- ❌ Nunca em sistemas sem autorização explícita do proprietário

O uso indevido desta ferramenta é da **exclusiva responsabilidade do utilizador**.

---

## 👥 Contribuidores

<table>
<tr>
<td align="center">
<a href="https://github.com/Andrevop"><img src="https://github.com/Andrevop.png" width="60px" alt="AndreV"/><br/><sub><b>AndreV</b></sub></a>
</td>
<td align="center">
<a href="https://github.com/claude"><img src="https://github.com/claude.png" width="60px" alt="Claude"/><br/><sub><b>Claude</b></sub></a>
</td>
</tr>
</table>

---

<div align="center">

**Desenvolvido por [AveOne Security](https://aveone.com.br)**

[aveone.com.br](https://aveone.com.br) &nbsp;·&nbsp; [contact@aveone.com.br](mailto:contact@aveone.com.br) &nbsp;·&nbsp; [Releases](https://github.com/Charyflux/ave/releases)

<br/>

*Feito com ❤️ para a comunidade de bug bounty*

</div>
