export namespace config {
	
	export class AppConfig {
	    tts_enabled: boolean;
	    tts_voice: string;
	    tts_speed: number;
	    tts_pitch: number;
	    tts_for_donates: boolean;
	    tts_for_subs: boolean;
	    min_donate_amount: number;
	    skip_links_and_emoji: boolean;
	    channel_name: string;
	    stream_platform: string;
	    viewer_count: number;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tts_enabled = source["tts_enabled"];
	        this.tts_voice = source["tts_voice"];
	        this.tts_speed = source["tts_speed"];
	        this.tts_pitch = source["tts_pitch"];
	        this.tts_for_donates = source["tts_for_donates"];
	        this.tts_for_subs = source["tts_for_subs"];
	        this.min_donate_amount = source["min_donate_amount"];
	        this.skip_links_and_emoji = source["skip_links_and_emoji"];
	        this.channel_name = source["channel_name"];
	        this.stream_platform = source["stream_platform"];
	        this.viewer_count = source["viewer_count"];
	    }
	}

}

export namespace eventbus {
	
	export class User {
	    id: string;
	    username: string;
	    color: string;
	    badges: string[];
	    is_subscriber: boolean;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.color = source["color"];
	        this.badges = source["badges"];
	        this.is_subscriber = source["is_subscriber"];
	    }
	}
	export class StreamEvent {
	    id: string;
	    type: string;
	    platform: string;
	    user: User;
	    message?: string;
	    extra?: Record<string, any>;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new StreamEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.platform = source["platform"];
	        this.user = this.convertValues(source["user"], User);
	        this.message = source["message"];
	        this.extra = source["extra"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
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

