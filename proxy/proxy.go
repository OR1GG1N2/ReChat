package proxy

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"ReChat/config"

	"github.com/gorilla/websocket"
	goproxy "golang.org/x/net/proxy"
)

var (
	mu               sync.RWMutex
	currentClient    *http.Client
	currentDialer    *websocket.Dialer
	currentSettings  config.AppSettings
	currentWGTunnel  *WireGuardTunnel
)

func init() {
	resetDirect()
}

func resetDirect() {
	if currentWGTunnel != nil {
		currentWGTunnel.Close()
		currentWGTunnel = nil
	}
	currentClient = &http.Client{
		Timeout:   30 * time.Second,
		Transport: defaultTransport(),
	}
	currentDialer = &websocket.Dialer{
		Proxy:            http.ProxyFromEnvironment,
		HandshakeTimeout: 15 * time.Second,
	}
}

func defaultTransport() *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
}

// Configure applies new proxy settings. Must be called with WireGuardInfo populated
// in AppSettings when proxy type is "wireguard".
func Configure(s config.AppSettings) {
	mu.Lock()
	defer mu.Unlock()

	currentSettings = s

	if !s.ProxyEnabled || strings.TrimSpace(s.ProxyAddress) == "" && s.ProxyType != "wireguard" {
		log.Printf("[Proxy] Disabled — using direct connection")
		resetDirect()
		clearEnvProxy()
		return
	}

	pType := strings.ToLower(strings.TrimSpace(s.ProxyType))
	log.Printf("[Proxy] Enabling %s proxy", strings.ToUpper(pType))

	switch pType {
	case "wireguard":
		// Close any existing tunnel before starting a new one
		if currentWGTunnel != nil {
			currentWGTunnel.Close()
			currentWGTunnel = nil
		}
		info := wgInfoFromSettings(s)
		if info.PrivateKey == "" || info.PublicKey == "" || info.Endpoint == "" {
			log.Printf("[Proxy] WireGuard: config incomplete (import a .conf file first)")
			resetDirect()
			return
		}
		tunnel, err := StartWireGuardTunnel(info)
		if err != nil {
			log.Printf("[Proxy] WireGuard tunnel failed: %v — falling back to direct", err)
			resetDirect()
			return
		}
		currentWGTunnel = tunnel
		buildFromTunnel(tunnel)

	case "socks5":
		addr := cleanAddr(s.ProxyAddress)
		buildSOCKS5(addr, s.ProxyAuth, s.ProxyUser, s.ProxyPassword)

	default:
		// http / https
		addr := cleanAddr(s.ProxyAddress)
		buildHTTP(pType, addr, s.ProxyAuth, s.ProxyUser, s.ProxyPassword)
	}
}

// ConfigureWithWireGuard is like Configure but accepts an explicit WireGuardInfo,
// used when the user just imported a conf and we want to start the tunnel immediately.
func ConfigureWithWireGuard(s config.AppSettings, info *WireGuardInfo) {
	mu.Lock()
	defer mu.Unlock()

	currentSettings = s

	if currentWGTunnel != nil {
		currentWGTunnel.Close()
		currentWGTunnel = nil
	}

	tunnel, err := StartWireGuardTunnel(info)
	if err != nil {
		log.Printf("[Proxy] WireGuard tunnel failed: %v — falling back to direct", err)
		resetDirect()
		return
	}
	currentWGTunnel = tunnel
	buildFromTunnel(tunnel)
	clearEnvProxy() // env proxy not applicable for WireGuard mode
}

func wgInfoFromSettings(s config.AppSettings) *WireGuardInfo {
	return &WireGuardInfo{
		PrivateKey:      s.WireGuardPrivateKey,
		PublicKey:       s.WireGuardPublicKey,
		Address:         s.WireGuardAddress,
		DNS:             s.WireGuardDNS,
		Endpoint:        s.WireGuardEndpoint,
		AllowedIPs:      s.WireGuardAllowedIPs,
		SuggestedSOCKS5: "127.0.0.1:25344",
	}
}

func buildFromTunnel(tunnel *WireGuardTunnel) {
	dialCtx := tunnel.DialContext
	currentClient = &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DialContext:           dialCtx,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
	currentDialer = &websocket.Dialer{
		NetDialContext:   dialCtx,
		HandshakeTimeout: 15 * time.Second,
	}
}

func cleanAddr(addr string) string {
	addr = strings.TrimSpace(addr)
	if idx := strings.Index(addr, "://"); idx != -1 {
		addr = addr[idx+3:]
	}
	return addr
}

func buildSOCKS5(addr string, useAuth bool, user, pass string) {
	var auth *goproxy.Auth
	if useAuth && user != "" {
		auth = &goproxy.Auth{User: user, Password: pass}
	}

	dialer, err := goproxy.SOCKS5("tcp", addr, auth, goproxy.Direct)
	if err != nil {
		log.Printf("[Proxy] SOCKS5 init error: %v — falling back to direct", err)
		resetDirect()
		return
	}

	dialCtx := makeDialContext(dialer)

	currentClient = &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DialContext:           dialCtx,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
	currentDialer = &websocket.Dialer{
		NetDialContext:   dialCtx,
		HandshakeTimeout: 15 * time.Second,
	}

	setEnvProxy(fmt.Sprintf("socks5://%s", addr))
}

func buildHTTP(scheme, addr string, useAuth bool, user, pass string) {
	if scheme != "https" {
		scheme = "http"
	}
	rawURL := fmt.Sprintf("%s://%s", scheme, addr)
	if useAuth && user != "" {
		rawURL = fmt.Sprintf("%s://%s:%s@%s", scheme, url.QueryEscape(user), url.QueryEscape(pass), addr)
	}

	proxyURL, err := url.Parse(rawURL)
	if err != nil {
		log.Printf("[Proxy] Invalid HTTP proxy URL %q: %v — falling back to direct", rawURL, err)
		resetDirect()
		return
	}

	currentClient = &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			Proxy: http.ProxyURL(proxyURL),
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
	currentDialer = &websocket.Dialer{
		Proxy:            http.ProxyURL(proxyURL),
		HandshakeTimeout: 15 * time.Second,
	}

	setEnvProxy(proxyURL.String())
}

func makeDialContext(d goproxy.Dialer) func(ctx context.Context, network, addr string) (net.Conn, error) {
	if cd, ok := d.(goproxy.ContextDialer); ok {
		return cd.DialContext
	}
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		type result struct {
			conn net.Conn
			err  error
		}
		ch := make(chan result, 1)
		go func() {
			c, e := d.Dial(network, addr)
			ch <- result{c, e}
		}()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case r := <-ch:
			return r.conn, r.err
		}
	}
}

func setEnvProxy(proxyURL string) {
	_ = os.Setenv("HTTP_PROXY", proxyURL)
	_ = os.Setenv("HTTPS_PROXY", proxyURL)
	_ = os.Setenv("ALL_PROXY", proxyURL)
	_ = os.Setenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", fmt.Sprintf("--proxy-server=%s", proxyURL))
}

func clearEnvProxy() {
	_ = os.Unsetenv("HTTP_PROXY")
	_ = os.Unsetenv("HTTPS_PROXY")
	_ = os.Unsetenv("ALL_PROXY")
	_ = os.Unsetenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
}

// GetHTTPClient returns the thread-safe HTTP client with configured proxy.
func GetHTTPClient() *http.Client {
	mu.RLock()
	defer mu.RUnlock()
	if currentClient != nil {
		return currentClient
	}
	return http.DefaultClient
}

// GetWebSocketDialer returns the thread-safe WebSocket dialer with configured proxy.
func GetWebSocketDialer() *websocket.Dialer {
	mu.RLock()
	defer mu.RUnlock()
	if currentDialer != nil {
		return currentDialer
	}
	return websocket.DefaultDialer
}

// WireGuardTunnelActive reports whether a WireGuard tunnel is currently running.
func WireGuardTunnelActive() bool {
	mu.RLock()
	defer mu.RUnlock()
	return currentWGTunnel != nil
}

// WireGuardInfo holds the parsed relevant fields from a WireGuard .conf file.
type WireGuardInfo struct {
	PrivateKey      string
	Address         string
	DNS             string
	PublicKey       string
	Endpoint        string
	AllowedIPs      string
	SuggestedSOCKS5 string
}

// ParseWireGuardConf reads and parses a WireGuard .conf file.
func ParseWireGuardConf(path string) (*WireGuardInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("cannot open file: %w", err)
	}
	defer f.Close()

	info := &WireGuardInfo{
		SuggestedSOCKS5: "127.0.0.1:25344",
	}

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		switch strings.ToLower(key) {
		case "privatekey":
			info.PrivateKey = val
		case "address":
			info.Address = val
		case "dns":
			info.DNS = val
		case "publickey":
			info.PublicKey = val
		case "endpoint":
			info.Endpoint = val
		case "allowedips":
			info.AllowedIPs = val
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read error: %w", err)
	}
	if info.PrivateKey == "" && info.PublicKey == "" {
		return nil, fmt.Errorf("файл не содержит ключей WireGuard")
	}
	return info, nil
}

// GenerateWireproxyConf is kept for reference but no longer required —
// the tunnel now runs embedded in the app.
func GenerateWireproxyConf(info *WireGuardInfo, socks5Addr string) string {
	if socks5Addr == "" {
		socks5Addr = "127.0.0.1:25344"
	}
	return fmt.Sprintf(`[Interface]
PrivateKey = %s
Address = %s
DNS = %s

[Peer]
PublicKey = %s
Endpoint = %s
AllowedIPs = %s
PersistentKeepalive = 25

[Socks5]
BindAddress = %s
`,
		info.PrivateKey, info.Address, info.DNS,
		info.PublicKey, info.Endpoint, info.AllowedIPs,
		socks5Addr,
	)
}

// TestConnection tests connectivity to the Twitch API through the given proxy settings.
func TestConnection(proxyType, address string, useAuth bool, user, pass string) (bool, int64, string) {
	pType := strings.ToLower(strings.TrimSpace(proxyType))

	// For wireguard, test through the active tunnel if available
	if pType == "wireguard" {
		mu.RLock()
		tunnel := currentWGTunnel
		mu.RUnlock()
		if tunnel == nil {
			return false, 0, "WireGuard туннель не запущен — импортируйте .conf и включите прокси"
		}
		return testViaDialer(tunnel.DialContext)
	}

	if strings.TrimSpace(address) == "" {
		return false, 0, "адрес прокси не указан"
	}
	addr := cleanAddr(address)

	switch pType {
	case "socks5":
		var auth *goproxy.Auth
		if useAuth && user != "" {
			auth = &goproxy.Auth{User: user, Password: pass}
		}
		dialer, err := goproxy.SOCKS5("tcp", addr, auth, goproxy.Direct)
		if err != nil {
			return false, 0, fmt.Sprintf("SOCKS5 init failed: %v", err)
		}
		return testViaDialer(makeDialContext(dialer))

	default:
		scheme := "http"
		if pType == "https" {
			scheme = "https"
		}
		rawURL := fmt.Sprintf("%s://%s", scheme, addr)
		if useAuth && user != "" {
			rawURL = fmt.Sprintf("%s://%s:%s@%s", scheme, url.QueryEscape(user), url.QueryEscape(pass), addr)
		}
		proxyURL, err := url.Parse(rawURL)
		if err != nil {
			return false, 0, fmt.Sprintf("неверный адрес прокси: %v", err)
		}
		client := &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				Proxy: http.ProxyURL(proxyURL),
				DialContext: (&net.Dialer{
					Timeout:   10 * time.Second,
					KeepAlive: 10 * time.Second,
				}).DialContext,
				TLSHandshakeTimeout: 7 * time.Second,
			},
		}
		return doTestRequest(client)
	}
}

func testViaDialer(dialCtx func(ctx context.Context, network, addr string) (net.Conn, error)) (bool, int64, string) {
	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			DialContext:         dialCtx,
			TLSHandshakeTimeout: 10 * time.Second,
		},
	}
	return doTestRequest(client)
}

func doTestRequest(client *http.Client) (bool, int64, string) {
	start := time.Now()
	req, err := http.NewRequest("GET", "https://id.twitch.tv/oauth2/validate", nil)
	if err != nil {
		return false, 0, err.Error()
	}
	req.Header.Set("User-Agent", "ReChat-Twitch-Companion")

	resp, err := client.Do(req)
	duration := time.Since(start).Milliseconds()
	if err != nil {
		return false, duration, fmt.Sprintf("Ошибка: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusBadRequest {
		return true, duration, fmt.Sprintf("Подключено к Twitch (%dms)", duration)
	}
	return true, duration, fmt.Sprintf("HTTP %d (%dms)", resp.StatusCode, duration)
}