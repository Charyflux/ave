<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AveBrowser · bug bounty browser</title>
    <!-- Font & Icons -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0b0b12;
            color: #eaeef5;
            line-height: 1.6;
            padding: 2rem 1rem;
        }

        .container {
            max-width: 1280px;
            margin: 0 auto;
            background: rgba(15, 15, 28, 0.75);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 2.5rem;
            padding: 2.5rem 2.8rem;
            box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(124, 58, 237, 0.15);
            border: 1px solid rgba(124, 58, 237, 0.08);
        }

        /* ---- header / brand ---- */
        .brand {
            display: flex;
            align-items: center;
            gap: 1.2rem;
            flex-wrap: wrap;
            margin-bottom: 1.8rem;
        }

        .brand-icon {
            width: 72px;
            height: 72px;
            background: linear-gradient(145deg, #1e132f, #110826);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 20px -6px rgba(124, 58, 237, 0.3);
            border: 1px solid rgba(124, 58, 237, 0.2);
        }

        .brand-icon img {
            width: 48px;
            height: 48px;
            filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.3));
        }

        .brand h1 {
            font-size: 2.4rem;
            font-weight: 700;
            letter-spacing: -0.03em;
            background: linear-gradient(135deg, #f0eaff 0%, #c4b5fd 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .brand .tag {
            font-size: 0.9rem;
            font-weight: 500;
            background: rgba(124, 58, 237, 0.15);
            padding: 0.25rem 0.9rem;
            border-radius: 40px;
            border: 1px solid rgba(124, 58, 237, 0.2);
            color: #a78bfa;
            letter-spacing: 0.01em;
            margin-left: 0.5rem;
        }

        .badge-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.6rem 1.2rem;
            margin: 1.2rem 0 1.8rem 0;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            background: rgba(255, 255, 255, 0.04);
            padding: 0.3rem 1rem 0.3rem 0.8rem;
            border-radius: 40px;
            font-size: 0.8rem;
            font-weight: 500;
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(4px);
        }

        .badge i {
            color: #a78bfa;
            font-size: 0.9rem;
        }

        .badge strong {
            color: #e2e8f0;
            font-weight: 600;
        }

        .lead {
            font-size: 1.2rem;
            color: #b9c4d9;
            max-width: 780px;
            margin: 0.5rem 0 2rem 0;
            border-left: 3px solid #7c3aed;
            padding-left: 1.2rem;
            background: linear-gradient(90deg, rgba(124, 58, 237, 0.06), transparent);
        }

        /* ---- download buttons ---- */
        .download-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin: 2rem 0 2.5rem 0;
        }

        .btn-download {
            display: inline-flex;
            align-items: center;
            gap: 0.7rem;
            background: rgba(124, 58, 237, 0.12);
            padding: 0.65rem 1.5rem 0.65rem 1.3rem;
            border-radius: 60px;
            font-weight: 600;
            font-size: 0.95rem;
            color: #e2e8f0;
            border: 1px solid rgba(124, 58, 237, 0.2);
            transition: all 0.2s ease;
            text-decoration: none;
            backdrop-filter: blur(4px);
        }

        .btn-download i {
            color: #a78bfa;
            font-size: 1.1rem;
        }

        .btn-download:hover {
            background: rgba(124, 58, 237, 0.25);
            border-color: #7c3aed;
            transform: translateY(-2px);
            box-shadow: 0 8px 25px -8px rgba(124, 58, 237, 0.3);
            color: #f1f5f9;
        }

        .btn-download .size {
            font-weight: 400;
            font-size: 0.7rem;
            background: rgba(0, 0, 0, 0.25);
            padding: 0.1rem 0.6rem;
            border-radius: 30px;
            color: #94a3b8;
        }

        .btn-download .os {
            font-weight: 500;
            color: #c4b5fd;
        }

        /* ---- sections ---- */
        .section-title {
            font-size: 1.7rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin: 2.8rem 0 1.2rem 0;
            display: flex;
            align-items: center;
            gap: 0.8rem;
            color: #f1f5f9;
        }

        .section-title i {
            color: #7c3aed;
            font-size: 1.6rem;
        }

        .section-sub {
            font-size: 0.95rem;
            color: #94a3b8;
            margin-top: -0.5rem;
            margin-bottom: 1.8rem;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 1.2rem;
        }

        .feature-card {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 20px;
            padding: 1.2rem 1.4rem;
            border: 1px solid rgba(255, 255, 255, 0.03);
            transition: 0.2s;
        }

        .feature-card:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(124, 58, 237, 0.15);
        }

        .feature-card .emoji {
            font-size: 1.6rem;
            margin-bottom: 0.3rem;
        }

        .feature-card h4 {
            font-weight: 600;
            font-size: 1rem;
            color: #e2e8f0;
            margin-bottom: 0.2rem;
        }

        .feature-card p {
            font-size: 0.85rem;
            color: #94a3b8;
        }

        /* ---- tables / code blocks ---- */
        .table-wrap {
            overflow-x: auto;
            margin: 1.2rem 0 1.8rem 0;
            border-radius: 18px;
            border: 1px solid rgba(255, 255, 255, 0.04);
            background: rgba(0, 0, 0, 0.2);
            padding: 0.2rem;
        }

        .table-wrap table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        .table-wrap th {
            text-align: left;
            padding: 0.8rem 1rem;
            font-weight: 600;
            color: #c4b5fd;
            background: rgba(124, 58, 237, 0.05);
            border-bottom: 1px solid rgba(124, 58, 237, 0.1);
        }

        .table-wrap td {
            padding: 0.7rem 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            color: #d1d9e8;
        }

        .table-wrap tr:last-child td {
            border-bottom: none;
        }

        .code-block {
            background: #0e0e1a;
            border-radius: 16px;
            padding: 1.2rem 1.6rem;
            font-family: 'Fira Code', 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            border: 1px solid rgba(124, 58, 237, 0.08);
            color: #d4dcec;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
            margin: 1.2rem 0;
        }

        .badge-group {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem 0.8rem;
            margin: 0.8rem 0;
        }

        .badge-sm {
            background: rgba(124, 58, 237, 0.08);
            padding: 0.15rem 0.8rem;
            border-radius: 40px;
            font-size: 0.75rem;
            font-weight: 500;
            color: #b9a9f0;
            border: 1px solid rgba(124, 58, 237, 0.05);
        }

        hr {
            border: none;
            border-top: 1px solid rgba(255, 255, 255, 0.04);
            margin: 2.5rem 0;
        }

        .footer {
            text-align: center;
            margin-top: 2.5rem;
            color: #64748b;
            font-size: 0.85rem;
        }

        .footer a {
            color: #a78bfa;
            text-decoration: none;
            border-bottom: 1px dotted rgba(167, 139, 250, 0.2);
        }

        .footer a:hover {
            color: #c4b5fd;
            border-bottom-color: #7c3aed;
        }

        .legal {
            background: rgba(124, 58, 237, 0.04);
            border-radius: 20px;
            padding: 1.2rem 1.6rem;
            border-left: 3px solid #7c3aed;
            font-size: 0.9rem;
            color: #b9c4d9;
            margin: 2rem 0 0.5rem 0;
        }

        .legal strong {
            color: #e2e8f0;
        }

        @media (max-width: 700px) {
            .container {
                padding: 1.5rem 1.2rem;
                border-radius: 1.8rem;
            }
            .brand h1 {
                font-size: 1.8rem;
            }
            .download-grid {
                flex-direction: column;
            }
            .btn-download {
                justify-content: center;
            }
            .lead {
                font-size: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">

        <!-- BRAND -->
        <div class="brand">
            <div class="brand-icon">
                <img src="https://raw.githubusercontent.com/Charyflux/ave/main/assets/icon.png" alt="AveBrowser" />
            </div>
            <div>
                <h1>AveBrowser <span class="tag">v1.3.6</span></h1>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.1rem;">
                    <span class="badge"><i class="fas fa-bolt"></i> bug bounty</span>
                    <span class="badge"><i class="fas fa-skull"></i> pentesting</span>
                    <span class="badge"><i class="fas fa-shield-alt"></i> TOR + scanner</span>
                </div>
            </div>
        </div>

        <div class="badge-grid">
            <span class="badge"><i class="fas fa-check-circle" style="color:#4ade80;"></i> <strong>+70</strong> payloads</span>
            <span class="badge"><i class="fas fa-robot"></i> scanner automático</span>
            <span class="badge"><i class="fas fa-ghost"></i> TOR integrado</span>
            <span class="badge"><i class="fas fa-puzzle-piece"></i> Chrome MV2</span>
            <span class="badge"><i class="fas fa-code"></i> Userscripts</span>
            <span class="badge"><i class="fas fa-lock-open"></i> SSL bypass</span>
        </div>

        <div class="lead">
            <i class="fas fa-terminal" style="color:#7c3aed; margin-right: 0.6rem;"></i>
            Browser especializado em <strong>bug bounty</strong> e <strong>pentesting</strong> — scanner de vulnerabilidades, payload library, TOR anónimo e extensões Chrome num só ambiente.
        </div>

        <!-- DOWNLOAD -->
        <div class="download-grid">
            <a href="https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser.Setup.1.3.6.exe" class="btn-download">
                <i class="fab fa-windows"></i> <span class="os">Windows</span> <span class="size">73 MB</span>
            </a>
            <a href="https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser-1.3.6-arm64.dmg" class="btn-download">
                <i class="fab fa-apple"></i> <span class="os">macOS (arm64)</span> <span class="size">90 MB</span>
            </a>
            <a href="https://github.com/Charyflux/ave/releases/download/v1.3.6/AveBrowser-1.3.6.AppImage" class="btn-download">
                <i class="fab fa-linux"></i> <span class="os">Linux</span> <span class="size">99 MB</span>
            </a>
            <a href="https://github.com/Charyflux/ave/releases" class="btn-download" style="background:rgba(255,255,255,0.02);">
                <i class="fas fa-tag"></i> todas as releases
            </a>
        </div>

        <!-- FEATURES HIGHLIGHT -->
        <div class="section-title"><i class="fas fa-bolt"></i> Funcionalidades principais</div>
        <div class="feature-grid">
            <div class="feature-card"><div class="emoji">🔍</div><h4>Scanner automático</h4><p>CORS, IDOR, Broken Auth, Mass Assignment em background</p></div>
            <div class="feature-card"><div class="emoji">💉</div><h4>+70 payloads</h4><p>XSS, SQLi, LFI, SSRF, SSTI, CMDi, XXE e mais</p></div>
            <div class="feature-card"><div class="emoji">👻</div><h4>TOR integrado</h4><p>Anonimato com um clique, rotação de IP automática</p></div>
            <div class="feature-card"><div class="emoji">🧩</div><h4>Extensões Chrome MV2</h4><p>Carrega pastas de extensões descompactadas</p></div>
            <div class="feature-card"><div class="emoji">🛡️</div><h4>CORS + SSL bypass</h4><p>Sem bloqueios, ideal para laboratórios e testes</p></div>
            <div class="feature-card"><div class="emoji">📡</div><h4>Network monitor</h4><p>Feed em tempo real de requests capturados</p></div>
        </div>

        <!-- PHANTOM DEVTOOLS -->
        <div class="section-title"><i class="fas fa-tools"></i> PHANTOM DevTools</div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Ferramenta</th><th>Descrição</th></tr></thead>
                <tbody>
                    <tr><td><i class="fas fa-cookie-bite" style="color:#a78bfa;"></i> Cookie Manager</td><td>Ver, copiar e deletar cookies da sessão ativa</td></tr>
                    <tr><td><i class="fas fa-database" style="color:#a78bfa;"></i> Storage Explorer</td><td>localStorage e sessionStorage do site</td></tr>
                    <tr><td><i class="fas fa-key" style="color:#a78bfa;"></i> JWT Decoder</td><td>Decodifica JWT, analisa algoritmo e expiração</td></tr>
                    <tr><td><i class="fas fa-exchange-alt" style="color:#a78bfa;"></i> Encoder/Decoder</td><td>Base64, URL, HTML, Hex, SHA‑1, SHA‑256</td></tr>
                    <tr><td><i class="fas fa-syringe" style="color:#a78bfa;"></i> Payload Library</td><td>+70 payloads organizados por categoria</td></tr>
                    <tr><td><i class="fas fa-map" style="color:#a78bfa;"></i> RECON</td><td>robots.txt, sitemap, Shodan, crt.sh, VirusTotal</td></tr>
                </tbody>
            </table>
        </div>

        <!-- ARCHITECTURE -->
        <div class="section-title"><i class="fas fa-cubes"></i> Arquitectura</div>
        <div class="code-block">
AveBrowser v1.3.6
├── Main Process (Node.js + Electron 28)
│   ├── TOR SOCKS5 (127.0.0.1:9050 / Control 9051)
│   ├── SSL bypass (ignore-certificate-errors)
│   ├── CORS bypass via electronNet.request()
│   └── Session persistente (partition: persist:avebrowser)
├── Renderer Process (Chromium)
│   ├── AveOne Inspector (scanner, formatter, network)
│   ├── API Tester &amp; CORS probe
│   └── Payload library (+70)
└── userData/
    ├── ave-extensions.json
    ├── userscripts/
    └── plugins/
        </div>

        <!-- CHANGELOG SHORT -->
        <div class="section-title"><i class="fas fa-history"></i> Últimas melhorias</div>
        <div class="badge-group">
            <span class="badge-sm"><i class="fas fa-palette"></i> v1.3.6 · glassmorphism UI</span>
            <span class="badge-sm"><i class="fas fa-star"></i> v1.3.5 · barra de favoritos + crash fix macOS</span>
            <span class="badge-sm"><i class="fas fa-puzzle-piece"></i> v1.3.0 · Extension Manager (MV2 + Userscripts + Plugins)</span>
            <span class="badge-sm"><i class="fas fa-terminal"></i> v1.2.2 · context menu, find-in-page, zoom</span>
            <span class="badge-sm"><i class="fas fa-bug"></i> v1.2.0 · AveOne Inspector nativo</span>
        </div>
        <div style="margin-top: 0.2rem;">
            <a href="https://github.com/Charyflux/ave/releases" style="color:#a78bfa; font-size:0.9rem;">changelog completo →</a>
        </div>

        <!-- ROADMAP -->
        <div class="section-title"><i class="fas fa-road"></i> Roadmap</div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; font-size:0.9rem; color:#cbd5e1;">
            <span><i class="fas fa-file-pdf" style="color:#a78bfa;"></i> Export PDF/HTML</span>
            <span><i class="fas fa-sync-alt" style="color:#a78bfa;"></i> Auto-update</span>
            <span><i class="fas fa-microchip" style="color:#a78bfa;"></i> Intel Mac (x64)</span>
            <span><i class="fas fa-brain" style="color:#a78bfa;"></i> AI attack suggestions</span>
            <span><i class="fas fa-video" style="color:#a78bfa;"></i> Session recording</span>
            <span><i class="fas fa-plug" style="color:#a78bfa;"></i> Burp Suite integration</span>
        </div>

        <!-- LEGAL -->
        <div class="legal">
            <strong><i class="fas fa-gavel"></i> Uso ético e autorizado</strong> — AveBrowser é exclusivo para <strong>bug bounty</strong>, <strong>pentesting</strong> com contrato, CTF e investigação defensiva. Nunca utilize em sistemas sem autorização explícita.
        </div>

        <hr />

        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; font-size:0.9rem; color:#94a3b8;">
            <span><i class="fas fa-code"></i> Electron 28.3.3 · Chromium</span>
            <span><i class="fas fa-shield-alt"></i> AveOne Security</span>
            <span><a href="https://aveone.com.br" style="color:#a78bfa;">aveone.com.br</a> · <a href="mailto:contact@aveone.com.br" style="color:#a78bfa;">contact@aveone.com.br</a></span>
        </div>

        <div class="footer">
            <i class="fas fa-heart" style="color:#7c3aed;"></i> Feito para a comunidade de bug bounty · <a href="https://github.com/Charyflux/ave">GitHub</a>
        </div>

    </div>
</body>
</html>
