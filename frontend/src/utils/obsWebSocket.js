/**
 * OBS Studio WebSocket v5 Client for ReChat
 * Connects to obs-websocket (port 4455 by default) to fetch stream status, scenes, and stats.
 */

class OBSClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isStreaming = false;
    this.streamTimecode = '00:00:00';
    this.streamDurationMs = 0;
    this.currentScene = '';
    this.activeFps = 60;
    this.listeners = new Set();
    this.reconnectTimer = null;
    this.pollTimer = null;
    this.host = localStorage.getItem('rechat_obs_host') || '127.0.0.1';
    this.port = localStorage.getItem('rechat_obs_port') || '4455';
    this.password = localStorage.getItem('rechat_obs_password') || '';
    this.autoConnect = localStorage.getItem('rechat_obs_autoconnect') !== 'false';
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error('OBS listener error:', err);
      }
    });
  }

  getState() {
    return {
      isConnected: this.isConnected,
      isStreaming: this.isStreaming,
      streamTimecode: this.streamTimecode,
      streamDurationMs: this.streamDurationMs,
      currentScene: this.currentScene,
      activeFps: this.activeFps,
      host: this.host,
      port: this.port,
      password: this.password,
    };
  }

  saveConfig(host, port, password) {
    this.host = host || '127.0.0.1';
    this.port = port || '4455';
    this.password = password || '';
    localStorage.setItem('rechat_obs_host', this.host);
    localStorage.setItem('rechat_obs_port', this.port);
    localStorage.setItem('rechat_obs_password', this.password);
  }

  async connect(host = this.host, port = this.port, password = this.password) {
    this.saveConfig(host, port, password);
    this.disconnect();

    const url = `ws://${this.host}:${this.port}`;
    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.warn('OBS WebSocket creation failed:', err);
      this.isConnected = false;
      this.notify();
      return;
    }

    this.ws.onopen = () => {
      // Wait for Hello (op 0) from OBS
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.handleMessage(msg);
      } catch (err) {
        console.error('Failed to parse OBS message:', err);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.isStreaming = false;
      this.stopPolling();
      this.notify();
    };

    this.ws.onerror = (err) => {
      console.warn('OBS WebSocket error:', err);
      this.isConnected = false;
      this.notify();
    };
  }

  disconnect() {
    this.stopPolling();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isStreaming = false;
    this.notify();
  }

  async handleMessage(msg) {
    // Op 0: Hello from OBS
    if (msg.op === 0) {
      const auth = msg.d?.authentication;
      let authResponse = undefined;

      if (auth && this.password) {
        authResponse = await this.generateAuth(
          this.password,
          auth.salt,
          auth.challenge
        );
      }

      // Send Identify (Op 1)
      const identify = {
        op: 1,
        d: {
          rpcVersion: 1,
          authentication: authResponse,
          eventSubscriptions: 33, // General + StreamStateChanged
        },
      };
      this.send(identify);
      return;
    }

    // Op 2: Identified (Successfully authenticated)
    if (msg.op === 2) {
      this.isConnected = true;
      this.notify();
      this.fetchInitialState();
      this.startPolling();
      return;
    }

    // Op 5: Event
    if (msg.op === 5) {
      const eventType = msg.d?.eventType;
      const data = msg.d?.eventData;

      if (eventType === 'StreamStateChanged') {
        this.isStreaming = Boolean(data?.outputActive);
        this.notify();
      } else if (eventType === 'CurrentProgramSceneChanged') {
        this.currentScene = data?.sceneName || '';
        this.notify();
      }
      return;
    }

    // Op 7: RequestResponse
    if (msg.op === 7) {
      const reqType = msg.d?.requestType;
      const resData = msg.d?.responseData;

      if (reqType === 'GetStreamStatus' && resData) {
        this.isStreaming = Boolean(resData.outputActive);
        if (resData.outputTimecode) {
          this.streamTimecode = resData.outputTimecode.split('.')[0] || '00:00:00';
        }
        if (typeof resData.outputDuration === 'number') {
          this.streamDurationMs = resData.outputDuration;
        }
        this.notify();
      } else if (reqType === 'GetStats' && resData) {
        if (typeof resData.activeFps === 'number') {
          this.activeFps = Math.round(resData.activeFps);
        }
        this.notify();
      } else if (reqType === 'GetCurrentProgramScene' && resData) {
        this.currentScene = resData.currentProgramSceneName || '';
        this.notify();
      }
    }
  }

  fetchInitialState() {
    this.sendRequest('GetStreamStatus');
    this.sendRequest('GetCurrentProgramScene');
    this.sendRequest('GetStats');
  }

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendRequest('GetStreamStatus');
        this.sendRequest('GetStats');
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendRequest(requestType, requestData = {}) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.send({
      op: 6,
      d: {
        requestType,
        requestId,
        requestData,
      },
    });
  }

  // Switch scene in OBS
  setScene(sceneName) {
    if (!this.isConnected) return;
    this.sendRequest('SetCurrentProgramScene', { sceneName });
  }

  // Toggle stream in OBS
  toggleStream() {
    if (!this.isConnected) return;
    this.sendRequest('ToggleStream');
  }

  // Create stream marker in OBS (record chapter or Twitch marker)
  createStreamMarker() {
    if (!this.isConnected) return;
    this.sendRequest('CreateStreamMarker', { description: 'ReChat Marker' });
  }

  async generateAuth(password, salt, challenge) {
    try {
      const encoder = new TextEncoder();
      const secretHash = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(password + salt)
      );
      const secretBase64 = btoa(String.fromCharCode(...new Uint8Array(secretHash)));
      const authHash = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(secretBase64 + challenge)
      );
      return btoa(String.fromCharCode(...new Uint8Array(authHash)));
    } catch (err) {
      console.error('OBS Auth hashing failed:', err);
      return '';
    }
  }
}

export const obsClient = new OBSClient();
