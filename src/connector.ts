import { GatewayClient } from "@openclaw/gateway-client";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const REMOTE_URL = process.env.FRIDAY_MINIAPP_URL || "";
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const ALLOWED_METHODS = new Set([
  "talk.catalog",
  "talk.client.create",
  "talk.client.close",
  "talk.client.steer",
]);

if (!REMOTE_URL) throw new Error("FRIDAY_MINIAPP_URL is required");

function configPath(): string {
  return process.env.OPENCLAW_CONFIG_PATH || join(homedir(), ".openclaw", "openclaw.json");
}

async function bridgeSecret(): Promise<string> {
  if (process.env.FRIDAY_MINIAPP_BRIDGE_SECRET) return process.env.FRIDAY_MINIAPP_BRIDGE_SECRET;
  const config = (await Bun.file(configPath()).json()) as {
    channels?: { telegram?: { botToken?: unknown } };
  };
  const token = config.channels?.telegram?.botToken;
  if (typeof token !== "string" || !token.trim()) throw new Error("Telegram bot token is unavailable");
  return createHash("sha256").update(`${token}:friday-miniapp-bridge:v1`).digest("hex");
}

const BRIDGE_SECRET = await bridgeSecret();

async function gatewayToken(): Promise<string> {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;
  try {
    const config = (await Bun.file(configPath()).json()) as {
      gateway?: { auth?: { token?: unknown } };
    };
    const configured = config.gateway?.auth?.token;
    if (typeof configured === "string" && configured.trim()) return configured.trim();
  } catch {
    // Fall through to the CLI diagnostic below.
  }
  const proc = Bun.spawn(["openclaw", "gateway", "auth-token", "--show"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr.trim() || "Could not load Gateway token");
  const token = stdout.trim();
  if (!token) throw new Error("Gateway token is empty");
  return token;
}

function bridgeUrl(): string {
  const url = new URL(REMOTE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/bridge";
  url.search = "";
  return url.toString();
}

let remote: WebSocket | null = null;
let gateway: GatewayClient | null = null;
let gatewayReady = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function send(value: unknown): void {
  if (remote?.readyState === WebSocket.OPEN) remote.send(JSON.stringify(value));
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectRemote();
  }, 2_000);
}

async function ensureGateway(): Promise<GatewayClient> {
  if (gateway && gatewayReady) return gateway;
  gateway?.stop();
  const token = await gatewayToken();
  const next = new GatewayClient({
    url: GATEWAY_URL,
    token,
    clientName: "cli",
    clientDisplayName: "Friday Telegram Mini App bridge",
    clientVersion: "1.0.0",
    platform: process.platform,
    mode: "cli",
    role: "operator",
    scopes: ["operator.read", "operator.talk", "operator.write"],
    onHelloOk: () => {
      gatewayReady = true;
      send({ type: "bridge.status", ready: true });
    },
    onEvent: (event) => {
      if (event.event === "talk.event") {
        send({ type: "event", payload: { type: "event", event: event.event, payload: event.payload } });
      }
    },
    onClose: () => {
      gatewayReady = false;
      send({ type: "bridge.status", ready: false });
    },
    onConnectError: (error) => {
      console.error(`Gateway connection failed: ${error.message}`);
    },
  });
  gateway = next;
  next.start();
  const deadline = Date.now() + 10_000;
  while (!gatewayReady && Date.now() < deadline) await Bun.sleep(50);
  if (!gatewayReady) throw new Error("Gateway did not become ready");
  return next;
}

async function handleMessage(message: Record<string, unknown>): Promise<void> {
  if (message.type !== "client.message" || typeof message.clientId !== "string") return;
  const clientId = message.clientId;
  const payload = message.payload as Record<string, unknown> | undefined;
  const id = typeof payload?.id === "string" ? payload.id : crypto.randomUUID();

  try {
    if (payload?.type === "rpc") {
      const method = typeof payload.method === "string" ? payload.method : "";
      if (!ALLOWED_METHODS.has(method)) throw new Error("RPC method is not allowed");
      const client = await ensureGateway();
      const result = await client.request(method, payload.params ?? {}, { timeoutMs: 30_000 });
      send({ type: "client.reply", clientId, payload: { type: "result", id, result } });
      return;
    }
    if (payload?.type === "offer") {
      const offerUrl = typeof payload.offerUrl === "string" ? payload.offerUrl : "";
      const clientSecret = typeof payload.clientSecret === "string" ? payload.clientSecret : "";
      const sdp = typeof payload.sdp === "string" ? payload.sdp : "";
      const offerHeaders =
        payload.offerHeaders && typeof payload.offerHeaders === "object"
          ? (payload.offerHeaders as Record<string, string>)
          : {};
      if (!offerUrl.startsWith("/plugins/openai/") || !clientSecret || !sdp) {
        throw new Error("Invalid WebRTC offer request");
      }
      const gatewayHttp = new URL(GATEWAY_URL);
      gatewayHttp.protocol = gatewayHttp.protocol === "wss:" ? "https:" : "http:";
      const response = await fetch(new URL(offerUrl, gatewayHttp), {
        method: "POST",
        body: sdp,
        headers: {
          ...offerHeaders,
          authorization: `Bearer ${clientSecret}`,
          "content-type": "application/sdp",
        },
        signal: AbortSignal.timeout(30_000),
      });
      const answer = await response.text();
      if (!response.ok) throw new Error(`WebRTC setup failed (${response.status})`);
      send({ type: "client.reply", clientId, payload: { type: "result", id, result: { sdp: answer } } });
      return;
    }
    throw new Error("Unsupported bridge request");
  } catch (error) {
    send({
      type: "client.reply",
      clientId,
      payload: { type: "error", id, message: error instanceof Error ? error.message : "Bridge error" },
    });
  }
}

async function connectRemote(): Promise<void> {
  try {
    await ensureGateway();
    const ws = new WebSocket(bridgeUrl());
    remote = ws;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "bridge.auth", secret: BRIDGE_SECRET }));
    });
    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (message.type === "bridge.ready") {
          send({ type: "bridge.status", ready: gatewayReady });
          console.log("Friday Mini App bridge connected");
          return;
        }
        void handleMessage(message);
      } catch (error) {
        console.error("Invalid relay message", error);
      }
    });
    ws.addEventListener("close", scheduleReconnect);
    ws.addEventListener("error", () => ws.close());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    scheduleReconnect();
  }
}

await connectRemote();

process.on("SIGTERM", () => {
  remote?.close();
  gateway?.stop();
  process.exit(0);
});
