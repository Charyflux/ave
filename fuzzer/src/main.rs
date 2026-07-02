// avefuzz — AveBrowser fast async HTTP fuzzer
//
// Usage examples:
//   avefuzz -u "https://target.com/FUZZ" -w wordlist.txt
//   avefuzz -u "https://target.com/api/FUZZ" -w params.txt -X POST -d '{"id":"FUZZ"}' -H "Auth: Bearer TOKEN" -c 100 -mc 200,302 -ms 0
//   avefuzz -u "https://target.com/user/FUZZ" -w ids.txt --fuzz-headers "X-User-ID: FUZZ" -t 10 -o results.json
//   avefuzz -u "https://target.com/FUZZ" -w payloads.txt -fr "error|exception|stack" --proxy http://127.0.0.1:7777

use anyhow::{Context, Result};
use chrono::Local;
use clap::Parser;
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use regex::Regex;
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    Client, Proxy,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{BufRead, BufReader, Write},
    str::FromStr,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::sync::Semaphore;

// ─── CLI ──────────────────────────────────────────────────────────────────────

#[derive(Parser, Debug, Clone)]
#[command(
    name = "avefuzz",
    about = "AveBrowser • fast async HTTP fuzzer for bug hunters",
    version = "2.0.0",
    long_about = None
)]
struct Args {
    /// Target URL — use FUZZ as placeholder  e.g. https://target.com/FUZZ
    #[arg(short = 'u', long, required = true)]
    url: String,

    /// Wordlist file (one entry per line)
    #[arg(short = 'w', long, required = true)]
    wordlist: String,

    /// HTTP method  [default: GET]
    #[arg(short = 'X', long, default_value = "GET")]
    method: String,

    /// Request body — FUZZ is replaced in body too  e.g. '{"id":"FUZZ"}'
    #[arg(short = 'd', long)]
    data: Option<String>,

    /// Extra header  (repeatable)  -H "Name: Value"
    #[arg(short = 'H', long = "header", value_name = "HEADER")]
    headers: Vec<String>,

    /// Headers that also get FUZZ replaced  e.g. "X-User-ID: FUZZ"
    #[arg(long = "fuzz-headers", value_name = "HEADER")]
    fuzz_headers: Vec<String>,

    /// Concurrency — parallel requests  [default: 50]
    #[arg(short = 'c', long, default_value_t = 50)]
    concurrency: usize,

    /// Timeout per request in seconds  [default: 10]
    #[arg(short = 't', long, default_value_t = 10)]
    timeout: u64,

    /// Match status codes (comma-separated)  e.g. 200,301,302
    #[arg(long = "mc", value_delimiter = ',')]
    match_codes: Vec<u16>,

    /// Filter OUT status codes (comma-separated)  e.g. 404,400
    #[arg(long = "fc", value_delimiter = ',')]
    filter_codes: Vec<u16>,

    /// Match minimum response size in bytes  [default: disabled]
    #[arg(long = "ms")]
    match_size: Option<usize>,

    /// Filter responses that match this regex  e.g. "Not Found|Error"
    #[arg(long = "fr")]
    filter_regex: Option<String>,

    /// Match responses that contain this regex  e.g. "admin|dashboard"
    #[arg(long = "mr")]
    match_regex: Option<String>,

    /// Max response size to read in KB  [default: 512]
    #[arg(long, default_value_t = 512)]
    max_resp_kb: usize,

    /// HTTP proxy  e.g. http://127.0.0.1:7777
    #[arg(long = "proxy")]
    proxy: Option<String>,

    /// Disable TLS certificate verification
    #[arg(long, default_value_t = true)]
    no_verify: bool,

    /// Output results to file (JSON)
    #[arg(short = 'o', long)]
    output: Option<String>,

    /// Stop after this many successful matches  [default: unlimited]
    #[arg(long)]
    max_matches: Option<usize>,

    /// Add random delay (ms) between 0 and N between requests  [default: 0]
    #[arg(long, default_value_t = 0)]
    delay: u64,

    /// Follow redirects (up to N hops)  [default: 5]
    #[arg(long, default_value_t = 5)]
    max_redirects: usize,

    /// Cookie string  e.g. "session=abc123; csrf=xyz"
    #[arg(long)]
    cookie: Option<String>,

    /// Suppress banner and info output (quiet mode)
    #[arg(short = 'q', long)]
    quiet: bool,

    /// Show errors (connection refused, timeouts)
    #[arg(short = 'e', long)]
    show_errors: bool,
}

// ─── Result record ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FuzzResult {
    word: String,
    url: String,
    status: u16,
    length: usize,
    duration_ms: u128,
    timestamp: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    vuln_hints: Vec<String>,
}

// ─── Vulnerability pattern scan ───────────────────────────────────────────────

lazy_static::lazy_static! {
    static ref VULN_PATTERNS: Vec<(&'static str, Regex)> = vec![
        ("SQL-Error",     Regex::new(r"(?i)(sql syntax|mysql_fetch|ORA-\d{5}|sqlite3.*error|SQLSTATE)").unwrap()),
        ("Stack-Trace",   Regex::new(r"(?i)(Traceback \(most recent|Exception in thread|at .+\.java:\d+\))").unwrap()),
        ("AWS-Key",       Regex::new(r"AKIA[0-9A-Z]{16}").unwrap()),
        ("Private-Key",   Regex::new(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----").unwrap()),
        ("Debug-Mode",    Regex::new(r"(?i)(debug mode|whoops|laravel.*exception|werkzeug debugger)").unwrap()),
        ("Dir-Listing",   Regex::new(r"(?i)<title>\s*Index of\s*/").unwrap()),
        ("PHP-Error",     Regex::new(r"(?i)(Fatal error|Warning:|Notice:)\s*:.*on line \d+").unwrap()),
        ("Secret-Env",    Regex::new(r"(?i)(api[_-]?key|secret|password|token)\s*[=:]\s*[\"']?\w{10,}").unwrap()),
        ("Open-Redirect", Regex::new(r"(?i)location:\s*https?://(?!target\.)").unwrap()),
        ("CORS-Any",      Regex::new(r"access-control-allow-origin:\s*\*").unwrap()),
    ];
}

fn scan_vulns(body: &str) -> Vec<String> {
    VULN_PATTERNS
        .iter()
        .filter(|(_, re)| re.is_match(body))
        .map(|(name, _)| name.to_string())
        .collect()
}

// ─── Build request client ─────────────────────────────────────────────────────

fn build_client(args: &Args) -> Result<Client> {
    let mut builder = Client::builder()
        .danger_accept_invalid_certs(args.no_verify)
        .timeout(Duration::from_secs(args.timeout))
        .redirect(reqwest::redirect::Policy::limited(args.max_redirects))
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AveBrowser/2.0 avefuzz/2.0");

    if let Some(proxy_url) = &args.proxy {
        let p = Proxy::all(proxy_url).context("invalid proxy URL")?;
        builder = builder.proxy(p);
    }

    if let Some(cookie) = &args.cookie {
        let jar = reqwest::cookie::Jar::default();
        // Set cookie for the base URL domain
        if let Ok(parsed) = reqwest::Url::parse(&args.url.replace("FUZZ", "probe")) {
            jar.add_cookie_str(cookie, &parsed);
        }
        builder = builder.cookie_provider(std::sync::Arc::new(jar));
    }

    Ok(builder.build()?)
}

// ─── Parse headers ────────────────────────────────────────────────────────────

fn parse_headers(raw: &[String]) -> Result<HeaderMap> {
    let mut map = HeaderMap::new();
    for h in raw {
        let (name, val) = h.split_once(':').context(format!("invalid header: {h}"))?;
        map.insert(
            HeaderName::from_str(name.trim())?,
            HeaderValue::from_str(val.trim())?,
        );
    }
    Ok(map)
}

// ─── Single request ───────────────────────────────────────────────────────────

async fn fuzz_one(
    client: &Client,
    args: &Args,
    word: &str,
    base_headers: &HeaderMap,
    filter_re: Option<&Regex>,
    match_re: Option<&Regex>,
    match_codes: &HashSet<u16>,
    filter_codes: &HashSet<u16>,
    max_body: usize,
) -> Option<FuzzResult> {
    let url = args.url.replace("FUZZ", word);
    let body = args.data.as_deref().map(|d| d.replace("FUZZ", word));

    // Build per-request headers — replace FUZZ in fuzz-headers
    let mut headers = base_headers.clone();
    for fh in &args.fuzz_headers {
        let replaced = fh.replace("FUZZ", word);
        if let Some((k, v)) = replaced.split_once(':') {
            if let (Ok(name), Ok(val)) = (HeaderName::from_str(k.trim()), HeaderValue::from_str(v.trim())) {
                headers.insert(name, val);
            }
        }
    }

    if args.delay > 0 {
        let ms = rand_delay(args.delay);
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }

    let t0 = Instant::now();
    let mut req = client.request(
        reqwest::Method::from_str(args.method.to_uppercase().as_str()).unwrap_or(reqwest::Method::GET),
        &url,
    )
    .headers(headers);

    if let Some(b) = body {
        req = req.body(b);
    }

    let res = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            if args.show_errors {
                eprintln!("{} {} → {}", "ERR".red().bold(), word.dimmed(), e);
            }
            return None;
        }
    };

    let status = res.status().as_u16();
    let duration_ms = t0.elapsed().as_millis();

    // Read body up to limit
    let bytes = res
        .bytes()
        .await
        .unwrap_or_default();
    let bytes = if bytes.len() > max_body { &bytes[..max_body] } else { &bytes };
    let body_str = String::from_utf8_lossy(bytes);
    let length = bytes.len();

    // Apply filters / matchers
    if !match_codes.is_empty() && !match_codes.contains(&status) {
        return None;
    }
    if filter_codes.contains(&status) {
        return None;
    }
    if let Some(ms) = args.match_size {
        if length < ms {
            return None;
        }
    }
    if let Some(re) = filter_re {
        if re.is_match(&body_str) {
            return None;
        }
    }
    if let Some(re) = match_re {
        if !re.is_match(&body_str) {
            return None;
        }
    }

    let vuln_hints = scan_vulns(&body_str);

    Some(FuzzResult {
        word: word.to_string(),
        url,
        status,
        length,
        duration_ms,
        timestamp: Local::now().to_rfc3339(),
        vuln_hints,
    })
}

fn rand_delay(max_ms: u64) -> u64 {
    use std::time::SystemTime;
    let seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64)
        .unwrap_or(42);
    seed % (max_ms + 1)
}

// ─── Status color ─────────────────────────────────────────────────────────────

fn colorize_status(s: u16) -> colored::ColoredString {
    match s {
        200..=299 => s.to_string().green().bold(),
        300..=399 => s.to_string().cyan(),
        400..=499 => s.to_string().yellow(),
        500..=599 => s.to_string().red().bold(),
        _ => s.to_string().white(),
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Print banner
    if !args.quiet {
        println!("{}", r#"
  ╔═══════════════════════════════════════════╗
  ║   AveFuzz v2.0  •  AveBrowser Toolkit    ║
  ║   Fast Async HTTP Fuzzer  •  Rust         ║
  ╚═══════════════════════════════════════════╝"#.cyan().bold());
        println!(" {} {}", "Target:".bold(), args.url.yellow());
        println!(" {} {}", "Wordlist:".bold(), args.wordlist.yellow());
        println!(" {} {}   {} {}   {} {}",
            "Method:".bold(), args.method.cyan(),
            "Concurrency:".bold(), args.concurrency.to_string().cyan(),
            "Timeout:".bold(), format!("{}s", args.timeout).cyan()
        );
        if let Some(p) = &args.proxy {
            println!(" {} {}", "Proxy:".bold(), p.yellow());
        }
        println!();
    }

    // Load wordlist
    let file = File::open(&args.wordlist)
        .with_context(|| format!("cannot open wordlist: {}", args.wordlist))?;
    let words: Vec<String> = BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .collect();
    let total = words.len();

    if !args.quiet {
        println!(" {} {}", "Words loaded:".bold(), total.to_string().green());
        println!(" {}", "─".repeat(60).dimmed());
        println!(" {:<20} {:<8} {:<10} {}", "WORD".bold(), "STATUS".bold(), "LENGTH".bold(), "TIME".bold());
        println!(" {}", "─".repeat(60).dimmed());
    }

    // Pre-compile filters
    let filter_re = args.filter_regex.as_deref().map(|r| Regex::new(r)).transpose()?;
    let match_re = args.match_regex.as_deref().map(|r| Regex::new(r)).transpose()?;
    let match_codes: HashSet<u16> = args.match_codes.iter().cloned().collect();
    let filter_codes: HashSet<u16> = args.filter_codes.iter().cloned().collect();
    let max_body = args.max_resp_kb * 1024;

    // Build HTTP client
    let client = Arc::new(build_client(&args)?);
    let base_headers = parse_headers(&args.headers)?;

    // Progress bar
    let pb = if !args.quiet {
        let bar = ProgressBar::new(total as u64);
        bar.set_style(
            ProgressStyle::default_bar()
                .template(" [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({per_sec}) ETA:{eta}")?
                .progress_chars("█▓░"),
        );
        bar.enable_steady_tick(Duration::from_millis(100));
        Some(bar)
    } else {
        None
    };

    // Shared counters
    let sem = Arc::new(Semaphore::new(args.concurrency));
    let done = Arc::new(AtomicU64::new(0));
    let matched = Arc::new(AtomicU64::new(0));
    let results: Arc<tokio::sync::Mutex<Vec<FuzzResult>>> = Arc::new(tokio::sync::Mutex::new(Vec::new()));

    let args = Arc::new(args);
    let base_headers = Arc::new(base_headers);
    let filter_re = Arc::new(filter_re);
    let match_re = Arc::new(match_re);
    let match_codes = Arc::new(match_codes);
    let filter_codes = Arc::new(filter_codes);

    let mut handles = Vec::with_capacity(words.len());
    let t_start = Instant::now();

    for word in words {
        let permit = sem.clone().acquire_owned().await.unwrap();
        let client = client.clone();
        let args2 = args.clone();
        let bh = base_headers.clone();
        let fr = filter_re.clone();
        let mr = match_re.clone();
        let mc = match_codes.clone();
        let fc = filter_codes.clone();
        let done2 = done.clone();
        let matched2 = matched.clone();
        let results2 = results.clone();
        let pb2 = pb.clone();

        handles.push(tokio::spawn(async move {
            let _permit = permit;

            // Check max_matches limit
            if let Some(limit) = args2.max_matches {
                if matched2.load(Ordering::Relaxed) >= limit as u64 {
                    done2.fetch_add(1, Ordering::Relaxed);
                    if let Some(bar) = &pb2 { bar.inc(1); }
                    return;
                }
            }

            if let Some(result) = fuzz_one(
                &client, &args2, &word,
                &bh,
                fr.as_deref(),
                mr.as_deref(),
                &mc, &fc, max_body,
            ).await {
                matched2.fetch_add(1, Ordering::Relaxed);

                // Print result line (above progress bar)
                let hints = if result.vuln_hints.is_empty() {
                    String::new()
                } else {
                    format!("  {}", result.vuln_hints.join(",").red().bold())
                };

                if let Some(bar) = &pb2 {
                    bar.println(format!(
                        " {:<20} {}   {:<10} {}ms{}",
                        result.word.yellow().bold(),
                        colorize_status(result.status),
                        result.length.to_string().white(),
                        result.duration_ms.to_string().dimmed(),
                        hints
                    ));
                } else {
                    println!("{} {} {} {}ms{}",
                        result.word, result.status, result.length, result.duration_ms, hints);
                }

                results2.lock().await.push(result);
            }

            done2.fetch_add(1, Ordering::Relaxed);
            if let Some(bar) = &pb2 { bar.inc(1); }
        }));
    }

    for h in handles { h.await?; }
    if let Some(bar) = &pb { bar.finish_and_clear(); }

    let elapsed = t_start.elapsed();
    let results_lock = results.lock().await;
    let total_matched = results_lock.len();
    let rps = done.load(Ordering::Relaxed) as f64 / elapsed.as_secs_f64();

    if !args.quiet {
        println!("\n {}", "─".repeat(60).dimmed());
        println!(" {} {}   {} {:.0} req/s   {} {}",
            "Matched:".bold(), total_matched.to_string().green().bold(),
            "Speed:".bold(), rps,
            "Elapsed:".bold(), format!("{:.2}s", elapsed.as_secs_f64()).cyan()
        );
    }

    // Save JSON output
    if let Some(out_path) = &args.output {
        let mut f = File::create(out_path)?;
        let json = serde_json::to_string_pretty(&*results_lock)?;
        f.write_all(json.as_bytes())?;
        if !args.quiet {
            println!(" {} {}", "Saved:".bold(), out_path.green());
        }
    }

    Ok(())
}
