export namespace config {
	
	export class AppSettings {
	    defaultChannel: string;
	    fontSize: number;
	    showTimestamps: boolean;
	    timestampFormat: string;
	    showBadges: boolean;
	    showFollows: boolean;
	    channelBadgeMode: string;
	    iconColor: string;
	    maxMessages: number;
	    oauthToken: string;
	    username: string;
	    userId: string;
	    clientId: string;
	    joinedChannels: string[];
	    channelColors: Record<string, string>;
	    ttsEnabled: boolean;
	    ttsVolume: number;
	    ttsEngine: string;
	    ttsVoice: string;
	    ttsVoiceLocal: string;
	    ttsSpeed: number;
	    ttsAudioDevice: string;
	    ttsSkipHotkey: string;
	    ttsAllMessages: boolean;
	    ttsRepliesOnly: boolean;
	    ttsHighlightedOnly: boolean;
	    ttsSubscribersOnly: boolean;
	    ttsVipOnly: boolean;
	    ttsModOnly: boolean;
	    ttsIncludeUsername: boolean;
	    ttsIncludeLinks: boolean;
	    ttsIncludeEmotes: boolean;
	    ttsIncludeEmoji: boolean;
	    ttsIncludeMentions: boolean;
	    ttsSkipMentions: boolean;
	    ttsRemoveWords: string;
	    ignoreCommands: boolean;
	    commandPrefixes: string;
	    ignoreEmotesOnly: boolean;
	    ttsFilterEmotes: boolean;
	    ignoredUsers: string[];
	    hideIgnoredFromChat: boolean;
	    alwaysOnTop: boolean;
	    fontFamily: string;
	    messageSpacing: string;
	    textAlign: string;
	    proxyEnabled: boolean;
	    proxyType: string;
	    proxyAddress: string;
	    proxyAuth: boolean;
	    proxyUser: string;
	    proxyPassword: string;
	    wireGuardPrivateKey: string;
	    wireGuardPublicKey: string;
	    wireGuardAddress: string;
	    wireGuardDNS: string;
	    wireGuardEndpoint: string;
	    wireGuardAllowedIPs: string;
	    musicStyle: string;
	    musicAccentColor: string;
	    musicShowCover: boolean;
	    musicShowVisualizer: boolean;
	    musicShowArtist: boolean;
	    musicHideOnPause: boolean;
	    musicPauseDelay: number;
	    musicScale: number;
	    musicBgOpacity: number;
	    daEnabled: boolean;
	    daToken: string;
	    daShowInChat: boolean;
	    daMinChatAmount: number;
	    daTTS: boolean;
	    daMinTTSAmount: number;
	    daShowGoalBar: boolean;
	    kickEnabled: boolean;
	    kickChannels: string[];
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultChannel = source["defaultChannel"];
	        this.fontSize = source["fontSize"];
	        this.showTimestamps = source["showTimestamps"];
	        this.timestampFormat = source["timestampFormat"];
	        this.showBadges = source["showBadges"];
	        this.showFollows = source["showFollows"];
	        this.channelBadgeMode = source["channelBadgeMode"];
	        this.iconColor = source["iconColor"];
	        this.maxMessages = source["maxMessages"];
	        this.oauthToken = source["oauthToken"];
	        this.username = source["username"];
	        this.userId = source["userId"];
	        this.clientId = source["clientId"];
	        this.joinedChannels = source["joinedChannels"];
	        this.channelColors = source["channelColors"];
	        this.ttsEnabled = source["ttsEnabled"];
	        this.ttsVolume = source["ttsVolume"];
	        this.ttsEngine = source["ttsEngine"];
	        this.ttsVoice = source["ttsVoice"];
	        this.ttsVoiceLocal = source["ttsVoiceLocal"];
	        this.ttsSpeed = source["ttsSpeed"];
	        this.ttsAudioDevice = source["ttsAudioDevice"];
	        this.ttsSkipHotkey = source["ttsSkipHotkey"];
	        this.ttsAllMessages = source["ttsAllMessages"];
	        this.ttsRepliesOnly = source["ttsRepliesOnly"];
	        this.ttsHighlightedOnly = source["ttsHighlightedOnly"];
	        this.ttsSubscribersOnly = source["ttsSubscribersOnly"];
	        this.ttsVipOnly = source["ttsVipOnly"];
	        this.ttsModOnly = source["ttsModOnly"];
	        this.ttsIncludeUsername = source["ttsIncludeUsername"];
	        this.ttsIncludeLinks = source["ttsIncludeLinks"];
	        this.ttsIncludeEmotes = source["ttsIncludeEmotes"];
	        this.ttsIncludeEmoji = source["ttsIncludeEmoji"];
	        this.ttsIncludeMentions = source["ttsIncludeMentions"];
	        this.ttsSkipMentions = source["ttsSkipMentions"];
	        this.ttsRemoveWords = source["ttsRemoveWords"];
	        this.ignoreCommands = source["ignoreCommands"];
	        this.commandPrefixes = source["commandPrefixes"];
	        this.ignoreEmotesOnly = source["ignoreEmotesOnly"];
	        this.ttsFilterEmotes = source["ttsFilterEmotes"];
	        this.ignoredUsers = source["ignoredUsers"];
	        this.hideIgnoredFromChat = source["hideIgnoredFromChat"];
	        this.alwaysOnTop = source["alwaysOnTop"];
	        this.fontFamily = source["fontFamily"];
	        this.messageSpacing = source["messageSpacing"];
	        this.textAlign = source["textAlign"];
	        this.proxyEnabled = source["proxyEnabled"];
	        this.proxyType = source["proxyType"];
	        this.proxyAddress = source["proxyAddress"];
	        this.proxyAuth = source["proxyAuth"];
	        this.proxyUser = source["proxyUser"];
	        this.proxyPassword = source["proxyPassword"];
	        this.wireGuardPrivateKey = source["wireGuardPrivateKey"];
	        this.wireGuardPublicKey = source["wireGuardPublicKey"];
	        this.wireGuardAddress = source["wireGuardAddress"];
	        this.wireGuardDNS = source["wireGuardDNS"];
	        this.wireGuardEndpoint = source["wireGuardEndpoint"];
	        this.wireGuardAllowedIPs = source["wireGuardAllowedIPs"];
	        this.musicStyle = source["musicStyle"];
	        this.musicAccentColor = source["musicAccentColor"];
	        this.musicShowCover = source["musicShowCover"];
	        this.musicShowVisualizer = source["musicShowVisualizer"];
	        this.musicShowArtist = source["musicShowArtist"];
	        this.musicHideOnPause = source["musicHideOnPause"];
	        this.musicPauseDelay = source["musicPauseDelay"];
	        this.musicScale = source["musicScale"];
	        this.musicBgOpacity = source["musicBgOpacity"];
	        this.daEnabled = source["daEnabled"];
	        this.daToken = source["daToken"];
	        this.daShowInChat = source["daShowInChat"];
	        this.daMinChatAmount = source["daMinChatAmount"];
	        this.daTTS = source["daTTS"];
	        this.daMinTTSAmount = source["daMinTTSAmount"];
	        this.daShowGoalBar = source["daShowGoalBar"];
	        this.kickEnabled = source["kickEnabled"];
	        this.kickChannels = source["kickChannels"];
	    }
	}

}

export namespace music {
	
	export class MusicRules {
	    ordersEnabled: boolean;
	    chatCommandEnabled: boolean;
	    twitchRewardEnabled: boolean;
	    donationOrdersEnabled: boolean;
	    webOrdersEnabled: boolean;
	    source: string;
	    twitchPoints: number;
	    rewardTitle: string;
	    minDonation: number;
	    maxTracksPerUser: number;
	    blockPlaylists: boolean;
	    maxDurationSec: number;
	    manualApproval: boolean;
	    interruptOnRequest: boolean;
	    pauseSystemMedia: boolean;
	    blacklistChannels: string[];
	    blacklistTracks: string[];
	    youtubeApiKey: string;
	    fallbackQuery: string;
	
	    static createFrom(source: any = {}) {
	        return new MusicRules(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ordersEnabled = source["ordersEnabled"];
	        this.chatCommandEnabled = source["chatCommandEnabled"];
	        this.twitchRewardEnabled = source["twitchRewardEnabled"];
	        this.donationOrdersEnabled = source["donationOrdersEnabled"];
	        this.webOrdersEnabled = source["webOrdersEnabled"];
	        this.source = source["source"];
	        this.twitchPoints = source["twitchPoints"];
	        this.rewardTitle = source["rewardTitle"];
	        this.minDonation = source["minDonation"];
	        this.maxTracksPerUser = source["maxTracksPerUser"];
	        this.blockPlaylists = source["blockPlaylists"];
	        this.maxDurationSec = source["maxDurationSec"];
	        this.manualApproval = source["manualApproval"];
	        this.interruptOnRequest = source["interruptOnRequest"];
	        this.pauseSystemMedia = source["pauseSystemMedia"];
	        this.blacklistChannels = source["blacklistChannels"];
	        this.blacklistTracks = source["blacklistTracks"];
	        this.youtubeApiKey = source["youtubeApiKey"];
	        this.fallbackQuery = source["fallbackQuery"];
	    }
	}
	export class Track {
	    id: string;
	    videoId: string;
	    title: string;
	    author: string;
	    duration: number;
	    durationStr: string;
	    thumbnail: string;
	    requestedBy: string;
	    platform: string;
	    cost: string;
	    status: string;
	    rejectReason: string;
	    position: number;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Track(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.videoId = source["videoId"];
	        this.title = source["title"];
	        this.author = source["author"];
	        this.duration = source["duration"];
	        this.durationStr = source["durationStr"];
	        this.thumbnail = source["thumbnail"];
	        this.requestedBy = source["requestedBy"];
	        this.platform = source["platform"];
	        this.cost = source["cost"];
	        this.status = source["status"];
	        this.rejectReason = source["rejectReason"];
	        this.position = source["position"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MusicState {
	    currentTrack?: Track;
	    queue: Track[];
	    moderation: Track[];
	    history: Track[];
	    totalQueueCount: number;
	    totalQueueDuration: number;
	    totalQueueDurationStr: string;
	    isPlaying: boolean;
	    currentTime: number;
	    volume: number;
	    rules: MusicRules;
	
	    static createFrom(source: any = {}) {
	        return new MusicState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentTrack = this.convertValues(source["currentTrack"], Track);
	        this.queue = this.convertValues(source["queue"], Track);
	        this.moderation = this.convertValues(source["moderation"], Track);
	        this.history = this.convertValues(source["history"], Track);
	        this.totalQueueCount = source["totalQueueCount"];
	        this.totalQueueDuration = source["totalQueueDuration"];
	        this.totalQueueDurationStr = source["totalQueueDurationStr"];
	        this.isPlaying = source["isPlaying"];
	        this.currentTime = source["currentTime"];
	        this.volume = source["volume"];
	        this.rules = this.convertValues(source["rules"], MusicRules);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace tts {
	
	export class SupertonicStatus {
	    installed: boolean;
	    downloading: boolean;
	    progress: number;
	    currentFile: string;
	    downloadedBytes: number;
	    totalBytes: number;
	    speed: string;
	    modelDir: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new SupertonicStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.downloading = source["downloading"];
	        this.progress = source["progress"];
	        this.currentFile = source["currentFile"];
	        this.downloadedBytes = source["downloadedBytes"];
	        this.totalBytes = source["totalBytes"];
	        this.speed = source["speed"];
	        this.modelDir = source["modelDir"];
	        this.error = source["error"];
	    }
	}

}

export namespace widget {
	
	export class TTSStatusMessage {
	    state: string;
	    author: string;
	    text: string;
	    voice: string;
	    engine: string;
	    duration?: number;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new TTSStatusMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.state = source["state"];
	        this.author = source["author"];
	        this.text = source["text"];
	        this.voice = source["voice"];
	        this.engine = source["engine"];
	        this.duration = source["duration"];
	        this.timestamp = source["timestamp"];
	    }
	}

}

