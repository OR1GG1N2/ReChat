package proxy

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"net/netip"
	"strings"

	"golang.zx2c4.com/wireguard/conn"
	"golang.zx2c4.com/wireguard/device"
	"golang.zx2c4.com/wireguard/tun/netstack"
)

// WireGuardTunnel holds a running userspace WireGuard tunnel backed by gVisor netstack.
// No kernel drivers, no wintun, no administrator rights required.
type WireGuardTunnel struct {
	dev  *device.Device
	tnet *netstack.Net
}

// DialContext dials an address through the WireGuard tunnel.
func (t *WireGuardTunnel) DialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	return t.tnet.DialContext(ctx, network, addr)
}

// Close tears down the WireGuard tunnel.
func (t *WireGuardTunnel) Close() {
	if t == nil {
		return
	}
	t.dev.Down()
	t.dev.Close()
}

// StartWireGuardTunnel brings up an in-process WireGuard tunnel from parsed config.
// Uses gVisor netstack so everything runs in userspace — no external tools needed.
func StartWireGuardTunnel(info *WireGuardInfo) (*WireGuardTunnel, error) {
	// Parse tunnel local address(es) — comma-separated CIDRs like "10.x.x.x/32,fd...::/128"
	var localAddrs []netip.Addr
	for _, raw := range strings.Split(info.Address, ",") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		// Accept both "1.2.3.4/32" and bare "1.2.3.4"
		if strings.Contains(raw, "/") {
			prefix, err := netip.ParsePrefix(raw)
			if err != nil {
				return nil, fmt.Errorf("invalid WireGuard Address %q: %w", raw, err)
			}
			localAddrs = append(localAddrs, prefix.Addr())
		} else {
			a, err := netip.ParseAddr(raw)
			if err != nil {
				return nil, fmt.Errorf("invalid WireGuard Address %q: %w", raw, err)
			}
			localAddrs = append(localAddrs, a)
		}
	}
	if len(localAddrs) == 0 {
		return nil, fmt.Errorf("WireGuard Address is empty or invalid")
	}

	// Parse DNS servers
	var dnsAddrs []netip.Addr
	for _, raw := range strings.Split(info.DNS, ",") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if a, err := netip.ParseAddr(raw); err == nil {
			dnsAddrs = append(dnsAddrs, a)
		}
	}
	if len(dnsAddrs) == 0 {
		// Fallback to Cloudflare DNS — will be routed through the tunnel
		dnsAddrs = []netip.Addr{netip.MustParseAddr("1.1.1.1")}
	}

	// MTU 1280 — safe for WireGuard overhead on any network
	tun, tnet, err := netstack.CreateNetTUN(localAddrs, dnsAddrs, 1280)
	if err != nil {
		return nil, fmt.Errorf("failed to create netstack TUN: %w", err)
	}

	// Create WireGuard device (silent logger to keep logs clean)
	logger := device.NewLogger(device.LogLevelError, "[WireGuard] ")
	dev := device.NewDevice(tun, conn.NewDefaultBind(), logger)

	// Build UAPI config and apply it
	uapi, err := buildWireGuardIPC(info)
	if err != nil {
		dev.Close()
		return nil, err
	}

	if err := dev.IpcSet(uapi); err != nil {
		dev.Close()
		return nil, fmt.Errorf("WireGuard IPC config error: %w", err)
	}

	if err := dev.Up(); err != nil {
		dev.Close()
		return nil, fmt.Errorf("WireGuard device Up() failed: %w", err)
	}

	log.Printf("[WireGuard] Tunnel started — local: %v, peer: %s", localAddrs, info.Endpoint)
	return &WireGuardTunnel{dev: dev, tnet: tnet}, nil
}

// buildWireGuardIPC converts a WireGuardInfo into the UAPI text format expected by
// device.IpcSet(). Keys must be hex-encoded (WireGuard UAPI protocol).
func buildWireGuardIPC(info *WireGuardInfo) (string, error) {
	privHex, err := wgKeyToHex(info.PrivateKey, "private key")
	if err != nil {
		return "", err
	}
	pubHex, err := wgKeyToHex(info.PublicKey, "peer public key")
	if err != nil {
		return "", err
	}

	var sb strings.Builder

	// [Interface] section equivalents
	fmt.Fprintf(&sb, "private_key=%s\n", privHex)

	// [Peer] section
	fmt.Fprintf(&sb, "public_key=%s\n", pubHex)
	fmt.Fprintf(&sb, "endpoint=%s\n", info.Endpoint)
	fmt.Fprintf(&sb, "persistent_keepalive_interval=25\n")

	// AllowedIPs — one per line
	for _, cidr := range strings.Split(info.AllowedIPs, ",") {
		cidr = strings.TrimSpace(cidr)
		if cidr != "" {
			fmt.Fprintf(&sb, "allowed_ip=%s\n", cidr)
		}
	}

	return sb.String(), nil
}

// wgKeyToHex decodes a standard base64 WireGuard key (44 chars) to lowercase hex.
func wgKeyToHex(b64key, name string) (string, error) {
	b64key = strings.TrimSpace(b64key)
	if b64key == "" {
		return "", fmt.Errorf("WireGuard %s is empty", name)
	}
	raw, err := base64.StdEncoding.DecodeString(b64key)
	if err != nil {
		return "", fmt.Errorf("WireGuard %s is not valid base64: %w", name, err)
	}
	if len(raw) != 32 {
		return "", fmt.Errorf("WireGuard %s must be 32 bytes (got %d)", name, len(raw))
	}
	return hex.EncodeToString(raw), nil
}