import WebSocket from "ws";

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export default class TdBridgeClient {
  constructor() {
    this.ws = null;
    this.url = null;
    this.token = null;
    this.nextId = 1;
    this.pending = new Map();
    this.lastError = null;
    this.connectionState = "disconnected";
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectBaseDelayMs = 800;
    this.manualDisconnect = false;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.heartbeatIntervalMs = 15000;
    this.lastConnectedAt = null;
    this.lastHeartbeatAt = null;
    this.capabilityManager = null;
  }

  isConnected() {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  setCapabilityManager(capabilityManager) {
    this.capabilityManager = capabilityManager;
  }

  getStatus() {
    return {
      connected: this.isConnected(),
      state: this.connectionState,
      url: this.url,
      pendingRequests: this.pending.size,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      lastConnectedAt: this.lastConnectedAt,
      lastHeartbeatAt: this.lastHeartbeatAt
    };
  }

  async connect({
    url = "ws://127.0.0.1:9981",
    token,
    timeoutMs = 5000,
    maxReconnectAttempts = 5,
    heartbeatIntervalMs = 15000
  } = {}) {
    if (this.isConnected()) {
      if (token !== undefined) {
        this.token = token;
      }
      this.maxReconnectAttempts = maxReconnectAttempts;
      this.heartbeatIntervalMs = heartbeatIntervalMs;
      return this.getStatus();
    }

    this.connectionState = "connecting";
    await this.disconnect();
    this.manualDisconnect = false;
    this.url = url;
    if (token !== undefined) {
      this.token = token;
    }
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.heartbeatIntervalMs = heartbeatIntervalMs;

    await this.#openSocket(timeoutMs);
    this.reconnectAttempts = 0;
    this.connectionState = "connected";
    this.lastConnectedAt = new Date().toISOString();
    this.#startHeartbeat();

    return this.getStatus();
  }

  async disconnect() {
    this.manualDisconnect = true;
    this.connectionState = "disconnected";
    this.#stopHeartbeat();
    this.#clearReconnectTimer();
    this.#failAllPending(new Error("TouchDesigner bridge disconnected"));
    if (!this.ws) {
      return this.getStatus();
    }

    const ws = this.ws;
    this.ws = null;

    await new Promise((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      const done = () => resolve();
      ws.once("close", done);
      try {
        ws.close();
      } catch (_error) {
        resolve();
      }
      setTimeout(resolve, 300);
    });

    return this.getStatus();
  }

  async send(action, data = {}, timeoutMs = 5000) {
    if (this.capabilityManager) {
      if (typeof this.capabilityManager.assertActionAllowedWithData === "function") {
        this.capabilityManager.assertActionAllowedWithData(action, data);
      } else {
        this.capabilityManager.assertActionAllowed(action);
      }
    }

    if (!this.isConnected()) {
      throw new Error("Not connected to TouchDesigner bridge. Call td_connect first.");
    }

    const id = this.nextId++;
    const payload = {
      id,
      action,
      data
    };
    if (this.token) {
      payload.token = this.token;
    }

    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out after ${timeoutMs}ms for action '${action}'`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.ws.send(JSON.stringify(payload));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async #openSocket(timeoutMs) {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        try {
          ws.close();
        } catch (_error) {
          // no-op
        }
        reject(new Error(`Connection timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onError = (error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timer);
        ws.off("open", onOpen);
        ws.off("error", onError);
      };

      ws.once("open", onOpen);
      ws.once("error", onError);
    });

    ws.on("message", (messageBuffer) => {
      this.#handleMessage(messageBuffer.toString("utf8"));
    });

    ws.on("close", () => {
      this.#stopHeartbeat();
      this.#failAllPending(new Error("TouchDesigner bridge disconnected"));
      this.ws = null;
      if (!this.manualDisconnect) {
        this.connectionState = "degraded";
        this.#scheduleReconnect();
      }
    });

    ws.on("error", (error) => {
      this.lastError = error.message;
    });
  }

  #scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionState = "disconnected";
      this.lastError = `Reconnect failed after ${this.reconnectAttempts} attempts`;
      return;
    }

    this.#clearReconnectTimer();
    const delay = Math.min(this.reconnectBaseDelayMs * (2 ** this.reconnectAttempts), 15000);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(async () => {
      try {
        this.connectionState = "connecting";
        await this.#openSocket(4000);
        this.connectionState = "connected";
        this.lastConnectedAt = new Date().toISOString();
        this.reconnectAttempts = 0;
        this.#startHeartbeat();
      } catch (error) {
        this.lastError = error.message;
        this.connectionState = "degraded";
        this.#scheduleReconnect();
      }
    }, delay);
  }

  #clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isConnected()) {
        return;
      }
      try {
        await this.send("ping", {}, 2500);
        this.lastHeartbeatAt = new Date().toISOString();
      } catch (error) {
        this.lastError = error.message;
      }
    }, this.heartbeatIntervalMs);
  }

  #stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  #handleMessage(rawMessage) {
    const message = safeJsonParse(rawMessage);
    if (!message || typeof message !== "object") {
      this.lastError = "Received non-JSON bridge message";
      return;
    }

    if (typeof message.id !== "number") {
      this.lastError = "Received bridge message without numeric id";
      return;
    }

    const entry = this.pending.get(message.id);
    if (!entry) {
      return;
    }

    clearTimeout(entry.timer);
    this.pending.delete(message.id);

    if (message.ok) {
      entry.resolve(message.result);
      return;
    }

    const errorMessage = message.error?.message || "Unknown TouchDesigner bridge error";
    const error = new Error(errorMessage);
    error.code = message.error?.code;
    error.details = message.error?.details;
    entry.reject(error);
  }

  #failAllPending(error) {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }
}
