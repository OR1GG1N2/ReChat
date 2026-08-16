export namespace config {
	
	export class AppSettings {
	    defaultChannel: string;
	    fontSize: number;
	    showTimestamps: boolean;
	    showBadges: boolean;
	    maxMessages: number;
	    oauthToken: string;
	    username: string;
	    clientId: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultChannel = source["defaultChannel"];
	        this.fontSize = source["fontSize"];
	        this.showTimestamps = source["showTimestamps"];
	        this.showBadges = source["showBadges"];
	        this.maxMessages = source["maxMessages"];
	        this.oauthToken = source["oauthToken"];
	        this.username = source["username"];
	        this.clientId = source["clientId"];
	    }
	}

}

