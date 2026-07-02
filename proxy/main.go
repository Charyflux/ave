// AveBrowser — Go MITM Proxy
// Intercepts HTTP and HTTPS traffic with full request/response capture,
// dynamic per-host TLS cert generation, WebSocket streaming to the Electron
// renderer, request-replay API, and optional TOR SOCKS5 chaining.
//
// Proxy  → :7777   (HTTP CONNECT + plain HTTP proxy)
// API/WS → :7778   (/ws  /api/history  /api/replay  /api/clear
//                   /api/stats  /api/tor  /ca.crt)

package main

import (
	"bufio"
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/net/proxy"
)

// ─── Constants ────────────────────────────────────────────────────────────────

const (
	proxyAddr   = ":7777"
	controlAddr = ":7778"
	maxHistory  = 10000
	maxBodySize = 5 << 20 // 5 MB
)

// ─── Types ────────────────────────────────────────────────────────────────────

// Entry stores one captured HTTP exchange.
type Entry struct {
	ID          int64             `json:"id"`
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	Host        string            `json:"host"`
	Path        string            `json:"path"`
	Query       string            `json:"query"`
	HTTPS       bool              `json:"https"`
	ReqHeaders  map[string]string `json:"reqHeaders"`
	ReqBody     string            `json:"reqBody"`
	StatusCode  int               `json:"statusCode"`
	RespHeaders map[string]string `json:"respHeaders"`
	RespBody    string            `json:"respBody"`
	ContentType string            `json:"contentType"`
	Length      int               `json:"length"`
	DurationMs  int64             `json:"durationMs"`
	Timestamp   int64             `json:"timestamp"`
	Flags       []string          `json:"flags"` // vuln hints
}

// WsMsg is the envelope sent over WebSocket.
type WsMsg struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// ─── Global state ─────────────────────────────────────────────────────────────

var (
	entryCounter int64

	histMu  sync.RWMutex
	history []*Entry // newest first

	wsBroadcast = make(chan WsMsg, 4096)
	wsClientsMu sync.Mutex
	wsClients   = map[*websocket.Conn]bool{}

	caKey     *ecdsa.PrivateKey
	caCert    *x509.Certificate
	caCertPEM []byte

	leafCacheMu sync.RWMutex
	leafCache   = map[string]*tls.Certificate{}

	torMu      sync.Mutex
	torEnabled bool
	torAddr    = "127.0.0.1:9050"
)

// ─── Vulnerability scanner ────────────────────────────────────────────────────

type vulnRule struct {
	name string
	re   *regexp.Regexp
}

var vulnRules = []vulnRule{
	{name: "SQL-Error", re: regexp.MustCompile(`(?i)(sql syntax|mysql_fetch|ORA-\d{5}|sqlite3.*error|pg_query|SQLSTATE)`)},
	{name: "Stack-Trace", re: regexp.MustCompile(`(?i)(at\s+[\w\.\$]+\([\w\.]+\.\w+:\d+\)|Traceback \(most recent|Exception in thread "main")`)},
	{name: "AWS-Key", re: regexp.MustCompile(`AKIA[0-9A-Z]{16}`)},
	{name: "Private-Key", re: regexp.MustCompile(`-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----`)},
	{name: "JWT-Token", re: regexp.MustCompile(`eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+`)},
	{name: "Dir-Listing", re: regexp.MustCompile(`(?i)<title>\s*Index of\s*/`)},
	{name: "PHP-Error", re: regexp.MustCompile(`(?i)(Fatal error|Warning:|Notice:)\s*:.*on line \d+`)},
	{name: "Debug-Mode", re: regexp.MustCompile(`(?i)(debug mode enabled|development mode|whoops!|laravel.+exception)`)},
	{name: "SSRF-Hit", re: regexp.MustCompile(`(?i)(169\.254\.169\.254|metadata\.google\.internal|/latest/meta-data)`)},
	{name: "Open-Redirect", re: regexp.MustCompile(`(?i)(Location:\s*https?://[^/])`)},
	{name: "CORS-Wildcard", re: regexp.MustCompile(`Access-Control-Allow-Origin:\s*\*`)},
	{name: "Secret-Env", re: regexp.MustCompile(`(?i)(api[_-]?key|secret[_-]?key|password|passwd|token)\s*[=:]\s*["']?\w{8,}`)},
	{name: "GraphQL", re: regexp.MustCompile(`(?i)"__typename"|"errors"\s*:\s*\[`)},
	{name: "Spring-Boot", re: regexp.MustCompile(`(?i)(Whitelabel Error Page|application\.properties|spring\.datasource)`)},
}

func scanBody(body string) []string {
	var flags []string
	for _, r := range vulnRules {
		if r.re.MatchString(body) {
			flags = append(flags, r.name)
		}
	}
	return flags
}

// ─── CA + leaf cert generation ────────────────────────────────────────────────

func generateCA() error {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("CA key: %w", err)
	}
	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: "AveBrowser MITM CA", Organization: []string{"AveBrowser"}},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return fmt.Errorf("CA cert: %w", err)
	}
	caKey = key
	caCert, _ = x509.ParseCertificate(der)
	caCertPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	return nil
}

func leafCert(host string) (*tls.Certificate, error) {
	leafCacheMu.RLock()
	if c, ok := leafCache[host]; ok {
		leafCacheMu.RUnlock()
		return c, nil
	}
	leafCacheMu.RUnlock()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: host},
		DNSNames:     []string{host},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, caCert, &key.PublicKey, caKey)
	if err != nil {
		return nil, err
	}
	cert := &tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
	leafCacheMu.Lock()
	leafCache[host] = cert
	leafCacheMu.Unlock()
	return cert, nil
}

// ─── HTTP transport (plain or via TOR SOCKS5) ─────────────────────────────────

func makeTransport(skipVerify bool) *http.Transport {
	tr := &http.Transport{
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: skipVerify},
		MaxIdleConnsPerHost: 64,
		IdleConnTimeout:     90 * time.Second,
	}
	torMu.Lock()
	if torEnabled {
		dialer, err := proxy.SOCKS5("tcp", torAddr, nil, proxy.Direct)
		if err == nil {
			tr.Dial = dialer.Dial //nolint
		}
	}
	torMu.Unlock()
	return tr
}

// ─── History ─────────────────────────────────────────────────────────────────

func store(e *Entry) {
	histMu.Lock()
	history = append([]*Entry{e}, history...)
	if len(history) > maxHistory {
		history = history[:maxHistory]
	}
	histMu.Unlock()
	select {
	case wsBroadcast <- WsMsg{Type: "entry", Data: e}:
	default:
	}
}

func flattenHeaders(h http.Header) map[string]string {
	m := make(map[string]string, len(h))
	for k, vs := range h {
		m[k] = strings.Join(vs, "; ")
	}
	return m
}

// ─── Plain HTTP handler ───────────────────────────────────────────────────────

func handleHTTP(w http.ResponseWriter, r *http.Request) {
	id := atomic.AddInt64(&entryCounter, 1)
	t0 := time.Now()

	// Buffer request body
	var reqBuf []byte
	if r.Body != nil {
		reqBuf, _ = io.ReadAll(io.LimitReader(r.Body, maxBodySize))
		r.Body = io.NopCloser(bytes.NewReader(reqBuf))
	}

	// Remove proxy hop headers
	r.Header.Del("Proxy-Connection")
	r.Header.Del("Proxy-Authenticate")
	r.Header.Del("Proxy-Authorization")
	r.RequestURI = ""

	resp, err := makeTransport(true).RoundTrip(r)
	ms := time.Since(t0).Milliseconds()

	e := &Entry{
		ID:         id,
		Method:     r.Method,
		URL:        r.URL.String(),
		Host:       r.Host,
		Path:       r.URL.Path,
		Query:      r.URL.RawQuery,
		HTTPS:      false,
		ReqHeaders: flattenHeaders(r.Header),
		ReqBody:    string(reqBuf),
		DurationMs: ms,
		Timestamp:  time.Now().UnixMilli(),
	}

	if err != nil {
		e.StatusCode = 502
		store(e)
		http.Error(w, "Bad Gateway: "+err.Error(), 502)
		return
	}
	defer resp.Body.Close()

	respBuf, _ := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
	e.StatusCode = resp.StatusCode
	e.RespHeaders = flattenHeaders(resp.Header)
	e.RespBody = string(respBuf)
	e.Length = len(respBuf)
	e.ContentType = resp.Header.Get("Content-Type")
	e.Flags = scanBody(string(respBuf))

	store(e)

	for k, vs := range resp.Header {
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	w.Write(respBuf)
}

// ─── HTTPS CONNECT / MITM ─────────────────────────────────────────────────────

func handleCONNECT(w http.ResponseWriter, r *http.Request) {
	targetHost := r.Host
	if !strings.Contains(targetHost, ":") {
		targetHost += ":443"
	}
	hostname := targetHost
	if idx := strings.LastIndex(hostname, ":"); idx > 0 {
		hostname = hostname[:idx]
	}

	// Establish upstream TCP connection
	var targetConn net.Conn
	var err error

	torMu.Lock()
	isTor := torEnabled
	torMu.Unlock()

	if isTor {
		dialer, derr := proxy.SOCKS5("tcp", torAddr, nil, proxy.Direct)
		if derr != nil {
			http.Error(w, derr.Error(), 502)
			return
		}
		targetConn, err = dialer.Dial("tcp", targetHost)
	} else {
		targetConn, err = net.DialTimeout("tcp", targetHost, 15*time.Second)
	}
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer targetConn.Close()

	// Hijack the client connection
	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "hijack unavailable", 500)
		return
	}
	clientConn, _, err := hj.Hijack()
	if err != nil {
		return
	}
	defer clientConn.Close()
	clientConn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))

	// Generate leaf cert for this hostname
	cert, err := leafCert(hostname)
	if err != nil {
		// Fall back to raw tunnel — no capture
		tunnel(clientConn, targetConn)
		return
	}

	// TLS-wrap the client side (we are the server from the browser's point of view)
	tlsClient := tls.Server(clientConn, &tls.Config{
		Certificates: []tls.Certificate{*cert},
	})
	if err := tlsClient.Handshake(); err != nil {
		return
	}
	defer tlsClient.Close()

	// TLS-wrap the server side
	tlsServer := tls.Client(targetConn, &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         hostname,
	})
	if err := tlsServer.Handshake(); err != nil {
		return
	}
	defer tlsServer.Close()

	// Relay decoded HTTP through our MITM loop
	mitmHTTP(tlsClient, tlsServer, hostname)
}

func mitmHTTP(client, server net.Conn, host string) {
	cr := bufio.NewReader(client)
	for {
		req, err := http.ReadRequest(cr)
		if err != nil {
			return
		}

		id := atomic.AddInt64(&entryCounter, 1)
		t0 := time.Now()

		var reqBuf []byte
		if req.Body != nil {
			reqBuf, _ = io.ReadAll(io.LimitReader(req.Body, maxBodySize))
			req.Body = io.NopCloser(bytes.NewReader(reqBuf))
		}

		// Build full URL
		fullURL := fmt.Sprintf("https://%s%s", host, req.URL.RequestURI())

		req.URL, _ = url.Parse(fullURL)
		req.RequestURI = ""
		req.Header.Del("Proxy-Connection")

		resp, err := makeTransport(true).RoundTrip(req)
		ms := time.Since(t0).Milliseconds()

		e := &Entry{
			ID:         id,
			Method:     req.Method,
			URL:        fullURL,
			Host:       host,
			Path:       req.URL.Path,
			Query:      req.URL.RawQuery,
			HTTPS:      true,
			ReqHeaders: flattenHeaders(req.Header),
			ReqBody:    string(reqBuf),
			DurationMs: ms,
			Timestamp:  time.Now().UnixMilli(),
		}

		if err != nil {
			e.StatusCode = 502
			store(e)
			return
		}

		respBuf, _ := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
		resp.Body.Close()

		e.StatusCode = resp.StatusCode
		e.RespHeaders = flattenHeaders(resp.Header)
		e.RespBody = string(respBuf)
		e.Length = len(respBuf)
		e.ContentType = resp.Header.Get("Content-Type")
		e.Flags = scanBody(string(respBuf))
		store(e)

		resp.Body = io.NopCloser(bytes.NewReader(respBuf))
		if err := resp.Write(client); err != nil {
			return
		}
	}
}

func tunnel(a, b net.Conn) {
	var wg sync.WaitGroup
	wg.Add(2)
	copy := func(dst, src net.Conn) {
		defer wg.Done()
		io.Copy(dst, src)
		if c, ok := dst.(*net.TCPConn); ok {
			c.CloseWrite()
		}
	}
	go copy(a, b)
	go copy(b, a)
	wg.Wait()
}

// ─── Proxy entry point ────────────────────────────────────────────────────────

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		handleCONNECT(w, r)
	} else {
		handleHTTP(w, r)
	}
}

// ─── WebSocket hub ────────────────────────────────────────────────────────────

var wsUpgrader = websocket.Upgrader{CheckOrigin: func(_ *http.Request) bool { return true }}

func wsHub() {
	for msg := range wsBroadcast {
		data, _ := json.Marshal(msg)
		wsClientsMu.Lock()
		for c := range wsClients {
			c.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
				c.Close()
				delete(wsClients, c)
			}
		}
		wsClientsMu.Unlock()
	}
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	wsClientsMu.Lock()
	wsClients[conn] = true
	wsClientsMu.Unlock()

	// Flush history on connect
	histMu.RLock()
	snap := make([]*Entry, len(history))
	copy(snap, history)
	histMu.RUnlock()
	if data, err := json.Marshal(WsMsg{Type: "history", Data: snap}); err == nil {
		conn.WriteMessage(websocket.TextMessage, data)
	}

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
	wsClientsMu.Lock()
	delete(wsClients, conn)
	wsClientsMu.Unlock()
	conn.Close()
}

// ─── Control API ──────────────────────────────────────────────────────────────

func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func jsonOK(w http.ResponseWriter, v interface{}) {
	cors(w)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func setupControlAPI() *http.ServeMux {
	mux := http.NewServeMux()

	// WebSocket
	mux.HandleFunc("/ws", wsHandler)

	// CA cert download — browser must install this to trust MITM certs
	mux.HandleFunc("/ca.crt", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-x509-ca-cert")
		w.Header().Set("Content-Disposition", `attachment; filename="avebrowser-ca.crt"`)
		w.Write(caCertPEM)
	})

	// History
	mux.HandleFunc("/api/history", func(w http.ResponseWriter, r *http.Request) {
		limitStr := r.URL.Query().Get("limit")
		limit, _ := strconv.Atoi(limitStr)
		histMu.RLock()
		snap := make([]*Entry, len(history))
		copy(snap, history)
		histMu.RUnlock()
		if limit > 0 && limit < len(snap) {
			snap = snap[:limit]
		}
		jsonOK(w, snap)
	})

	// Clear
	mux.HandleFunc("/api/clear", func(w http.ResponseWriter, r *http.Request) {
		histMu.Lock()
		history = nil
		histMu.Unlock()
		atomic.StoreInt64(&entryCounter, 0)
		jsonOK(w, map[string]bool{"ok": true})
		wsBroadcast <- WsMsg{Type: "clear", Data: nil}
	})

	// Stats
	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		histMu.RLock()
		total := len(history)
		flagged, https, api := 0, 0, 0
		for _, e := range history {
			if len(e.Flags) > 0 {
				flagged++
			}
			if e.HTTPS {
				https++
			}
			if strings.Contains(e.ContentType, "json") || strings.HasPrefix(e.Path, "/api") {
				api++
			}
		}
		histMu.RUnlock()
		jsonOK(w, map[string]interface{}{
			"total": total, "flagged": flagged,
			"https": https, "api": api,
			"counter": atomic.LoadInt64(&entryCounter),
		})
	})

	// Toggle TOR
	mux.HandleFunc("/api/tor", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			cors(w)
			return
		}
		var body struct {
			Enable bool   `json:"enable"`
			Addr   string `json:"addr"` // optional override
		}
		json.NewDecoder(r.Body).Decode(&body)
		torMu.Lock()
		torEnabled = body.Enable
		if body.Addr != "" {
			torAddr = body.Addr
		}
		torMu.Unlock()
		jsonOK(w, map[string]interface{}{"ok": true, "tor": torEnabled, "addr": torAddr})
	})

	// Replay any request
	mux.HandleFunc("/api/replay", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			cors(w)
			return
		}
		var req struct {
			Method  string            `json:"method"`
			URL     string            `json:"url"`
			Headers map[string]string `json:"headers"`
			Body    string            `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		hreq, err := http.NewRequest(req.Method, req.URL, strings.NewReader(req.Body))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		for k, v := range req.Headers {
			hreq.Header.Set(k, v)
		}
		t0 := time.Now()
		resp, err := makeTransport(true).RoundTrip(hreq)
		if err != nil {
			jsonOK(w, map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
		jsonOK(w, map[string]interface{}{
			"status":  resp.StatusCode,
			"headers": flattenHeaders(resp.Header),
			"body":    string(body),
			"ms":      time.Since(t0).Milliseconds(),
			"length":  len(body),
			"flags":   scanBody(string(body)),
		})
	})

	// Search history
	mux.HandleFunc("/api/search", func(w http.ResponseWriter, r *http.Request) {
		q := strings.ToLower(r.URL.Query().Get("q"))
		flag := r.URL.Query().Get("flag")
		histMu.RLock()
		var out []*Entry
		for _, e := range history {
			if q != "" && !strings.Contains(strings.ToLower(e.URL), q) &&
				!strings.Contains(strings.ToLower(e.RespBody), q) {
				continue
			}
			if flag != "" {
				found := false
				for _, f := range e.Flags {
					if strings.EqualFold(f, flag) {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			out = append(out, e)
		}
		histMu.RUnlock()
		jsonOK(w, out)
	})

	// Export as HAR
	mux.HandleFunc("/api/export/har", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="avebrowser-capture.har"`)
		histMu.RLock()
		snap := make([]*Entry, len(history))
		copy(snap, history)
		histMu.RUnlock()

		// Build minimal HAR
		entries := make([]map[string]interface{}, 0, len(snap))
		for _, e := range snap {
			reqHeaders := []map[string]string{}
			for k, v := range e.ReqHeaders {
				reqHeaders = append(reqHeaders, map[string]string{"name": k, "value": v})
			}
			respHeaders := []map[string]string{}
			for k, v := range e.RespHeaders {
				respHeaders = append(respHeaders, map[string]string{"name": k, "value": v})
			}
			entries = append(entries, map[string]interface{}{
				"startedDateTime": time.UnixMilli(e.Timestamp).Format(time.RFC3339),
				"time":            e.DurationMs,
				"request": map[string]interface{}{
					"method":      e.Method,
					"url":         e.URL,
					"httpVersion": "HTTP/1.1",
					"headers":     reqHeaders,
					"postData":    map[string]string{"mimeType": "application/octet-stream", "text": e.ReqBody},
					"headersSize": -1,
					"bodySize":    len(e.ReqBody),
					"cookies":     []string{},
					"queryString": []string{},
				},
				"response": map[string]interface{}{
					"status":      e.StatusCode,
					"statusText":  http.StatusText(e.StatusCode),
					"httpVersion": "HTTP/1.1",
					"headers":     respHeaders,
					"content":     map[string]interface{}{"size": e.Length, "mimeType": e.ContentType, "text": e.RespBody},
					"redirectURL": "",
					"headersSize": -1,
					"bodySize":    e.Length,
					"cookies":     []string{},
				},
				"_flags": e.Flags,
			})
		}
		har := map[string]interface{}{
			"log": map[string]interface{}{
				"version": "1.2",
				"creator": map[string]string{"name": "AveBrowser", "version": "2.0"},
				"entries": entries,
			},
		}
		json.NewEncoder(w).Encode(har)
	})

	return mux
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	if err := generateCA(); err != nil {
		log.Fatalf("CA generation failed: %v", err)
	}
	log.Printf("[AVE-PROXY] CA ready  CN=%s", caCert.Subject.CommonName)

	go wsHub()

	// Control API server
	go func() {
		log.Printf("[AVE-PROXY] Control API  %s", controlAddr)
		if err := http.ListenAndServe(controlAddr, setupControlAPI()); err != nil {
			log.Fatalf("Control API: %v", err)
		}
	}()

	// Proxy server
	proxySrv := &http.Server{
		Addr:    proxyAddr,
		Handler: http.HandlerFunc(proxyHandler),
		// Disable read timeout — CONNECT tunnels are long-lived
		ReadHeaderTimeout: 30 * time.Second,
	}

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("[AVE-PROXY] shutting down")
		os.Exit(0)
	}()

	log.Printf("[AVE-PROXY] Proxy listening  %s  (HTTP + HTTPS MITM)", proxyAddr)
	log.Printf("[AVE-PROXY] CA cert available at  http://localhost%s/ca.crt", controlAddr)
	log.Fatal(proxySrv.ListenAndServe())
}
