export namespace config {
	
	export class AppSettings {
	    defaultChannel: string;
	    fontSize: number;
	    showTimestamps: boolean;
	    timestampFormat: string;
	    showBadges: boolean;
	    channelBadgeMode: string;
	    iconColor: string;
	    maxMessages: number;
	    oauthToken: string;
	    username: string;
	    clientId: string;
	    joinedChannels: string[];
	    channelColors: Record<string, string>;
	    ttsEnabled: boolean;
	    ttsVolume: number;
	    ttsEngine: string;
	    ttsVoice: string;
	    ttsVoiceLocal: string;
	    ignoreCommands: boolean;
	    commandPrefixes: string;
	    ignoreEmotesOnly: boolean;
	    ttsFilterEmotes: boolean;
	    ignoredUsers: string[];
	    hideIgnoredFromChat: boolean;
	
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
	        this.channelBadgeMode = source["channelBadgeMode"];
	        this.iconColor = source["iconColor"];
	        this.maxMessages = source["maxMessages"];
	        this.oauthToken = source["oauthToken"];
	        this.username = source["username"];
	        this.clientId = source["clientId"];
	        this.joinedChannels = source["joinedChannels"];
	        this.channelColors = source["channelColors"];
	        this.ttsEnabled = source["ttsEnabled"];
	        this.ttsVolume = source["ttsVolume"];
	        this.ttsEngine = source["ttsEngine"];
	        this.ttsVoice = source["ttsVoice"];
	        this.ttsVoiceLocal = source["ttsVoiceLocal"];
	        this.ignoreCommands = source["ignoreCommands"];
	        this.commandPrefixes = source["commandPrefixes"];
	        this.ignoreEmotesOnly = source["ignoreEmotesOnly"];
	        this.ttsFilterEmotes = source["ttsFilterEmotes"];
	        this.ignoredUsers = source["ignoredUsers"];
	        this.hideIgnoredFromChat = source["hideIgnoredFromChat"];
	    }
	}

}

