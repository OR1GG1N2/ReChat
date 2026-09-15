package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"ReChat/config"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type OAuthServer struct {
	ctx        context.Context
	server     *http.Server
	clientID   string
	onSuccess  func(username string)
	mu         sync.Mutex
	isFinished bool
}

type TwitchUser struct {
	ID          string `json:"id"`
	Login       string `json:"login"`
	DisplayName string `json:"display_name"`
}

type TwitchUserResponse struct {
	Data []TwitchUser `json:"data"`
}

func NewOAuthServer(ctx context.Context, clientID string, onSuccess func(username string)) *OAuthServer {
	return &OAuthServer{
		ctx:       ctx,
		clientID:  clientID,
		onSuccess: onSuccess,
	}
}

func (s *OAuthServer) Start() error {
	mux := http.NewServeMux()

	// Callback endpoint that extracts token from location.hash
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Twitch Auth Callback</title>
    <style>
        body { font-family: sans-serif; background: #0f0f0f; color: #fff; text-align: center; padding-top: 50px; }
        .card { background: #18181b; display: inline-block; padding: 30px; border-radius: 8px; border: 1px solid #27272a; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Authenticating with Twitch...</h2>
        <p id="status">Processing your login credentials...</p>
    </div>
    <script>
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (accessToken) {
            fetch('/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: accessToken })
            })
            .then(res => res.json())
            .then(data => {
                document.getElementById('status').innerText = 'Authentication successful! You can close this browser tab.';
            })
            .catch(err => {
                document.getElementById('status').innerText = 'Authentication failed: ' + err;
            });
        } else {
            document.getElementById('status').innerText = 'No access token found in URL.';
        }
    </script>
</body>
</html>`)
	})

	// Token receiver endpoint
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var body struct {
			Token string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" {
			http.Error(w, "Invalid token", http.StatusBadRequest)
			return
		}

		// Validate token with Twitch Helix API
		user, err := s.fetchTwitchUser(body.Token)
		if err != nil {
			log.Printf("Failed to fetch Twitch user: %v", err)
			http.Error(w, "Failed to validate user", http.StatusInternalServerError)
			return
		}

		// Save to SQLite
		settings := config.LoadSettings()
		settings.OAuthToken = body.Token
		settings.Username = user.Login
		settings.UserID = user.ID
		_ = config.SaveSettings(settings)

		// Trigger onSuccess callback (e.g. auto-join user's own channel)
		if s.onSuccess != nil {
			s.onSuccess(user.Login)
		}

		// Emit event to Wails frontend
		if s.ctx != nil {
			runtime.EventsEmit(s.ctx, "auth:updated", settings)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "username": user.Login})

		// Gracefully shutdown server in background
		go func() {
			time.Sleep(500 * time.Millisecond)
			s.Stop()
		}()
	})

	s.server = &http.Server{
		Addr:    config.OAuthRedirectHost,
		Handler: mux,
	}

	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("OAuth server error: %v", err)
		}
	}()

	return nil
}

func (s *OAuthServer) fetchTwitchUser(token string) (*TwitchUser, error) {
	req, err := http.NewRequest("GET", config.TwitchHelixUsersURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Client-Id", s.clientID)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Twitch API returned status: %d", resp.StatusCode)
	}

	var userResp TwitchUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		return nil, err
	}

	if len(userResp.Data) == 0 {
		return nil, fmt.Errorf("no user data returned from Twitch API")
	}

	return &userResp.Data[0], nil
}

func (s *OAuthServer) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.isFinished {
		return
	}
	s.isFinished = true
	if s.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.server.Shutdown(ctx)
	}
}
