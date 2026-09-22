package config

// Centralized store for all API Keys, Client IDs, URLs and application constants.

const (
	// Twitch OAuth & Client Credentials (public client identifier for OAuth Authorization Code Flow)
	TwitchClientID = "dubkqvo11x6o39aiyrqb70cqbtv8f5"

	// OAuth Server Settings
	OAuthPort         = "17777"
	OAuthCallbackURI  = "http://localhost:17777/callback"
	OAuthRedirectHost = "127.0.0.1:17777"

	// Twitch Network Endpoints
	TwitchIRCWebSocketURL                 = "wss://irc-ws.chat.twitch.tv:443"
	TwitchEventSubWebSocketURL            = "wss://eventsub.wss.twitch.tv/ws"
	TwitchHelixEventSubSubscriptionsURL   = "https://api.twitch.tv/helix/eventsub/subscriptions"
	TwitchHelixUsersURL                   = "https://api.twitch.tv/helix/users"
	TwitchHelixBadgesGlobalURL            = "https://api.twitch.tv/helix/chat/badges/global"
	TwitchHelixFollowersURL               = "https://api.twitch.tv/helix/channels/followers"
	TwitchOAuthAuthURL                    = "https://id.twitch.tv/oauth2/authorize"

	// Database File Name
	DBFileName = "settings.db"
)
