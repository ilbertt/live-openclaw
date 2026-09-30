import { createHash } from "node:crypto";
import faceJs from "./web/face.bundle.js.txt" with { type: "text" };
import appHtml from "./web/index.html.txt" with { type: "text" };
import { validateTelegramInitData, type TelegramIdentity } from "./telegram-auth";

const facePath = `/face-${createHash("sha256").update(faceJs).digest("hex").slice(0, 16)}.js`;
const versionedHtml = appHtml.replaceAll('"/face.js"', JSON.stringify(facePath));

type SocketData =
  | { role: "bridge"; authenticated: boolean }
  | { role: "client"; authenticated: boolean; id: string; user?: TelegramIdentity };

type AppSocket = Bun.ServerWebSocket<SocketData>;

const PORT = Number(process.env.PORT || process.env.NIBRUN_HTTP_PORT || 3000);
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "";
const BOT_ID = process.env.TELEGRAM_BOT_ID || "8402886387";
const ALLOWED_USER_ID = Number(process.env.TELEGRAM_ALLOWED_USER_ID || "397420856");

if (!BRIDGE_SECRET) throw new Error("BRIDGE_SECRET is required");
if (!Number.isSafeInteger(ALLOWED_USER_ID)) throw new Error("Invalid TELEGRAM_ALLOWED_USER_ID");

let bridge: AppSocket | null = null;
let gatewayReady = false;
const clients = new Map<string, AppSocket>();

function send(ws: AppSocket, value: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}

function broadcastBridgeState(): void {
  const connected = bridge?.readyState === WebSocket.OPEN && bridge.data.authenticated;
  for (const ws of clients.values()) send(ws, { type: "bridge.state", connected, gatewayReady: Boolean(connected && gatewayReady) });
}

function closeClient(ws: AppSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason.slice(0, 120));
  } catch {
    // Socket may already be closing.
  }
}

const server = Bun.serve<SocketData>({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(request, bunServer) {
    const url = new URL(request.url);
    if (url.pathname === facePath || url.pathname === "/face.js") {
      return new Response(faceJs, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", "x-content-type-options": "nosniff" } });
    }
    if (url.pathname === "/rpc") {
      const id = crypto.randomUUID();
      if (bunServer.upgrade(request, { data: { role: "client", authenticated: false, id } })) {
        return;
      }
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (url.pathname === "/bridge") {
      if (bunServer.upgrade(request, { data: { role: "bridge", authenticated: false } })) return;
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (url.pathname === "/healthz") {
      return Response.json({
        ok: true,
        bridgeConnected: bridge?.readyState === WebSocket.OPEN && bridge.data.authenticated,
        gatewayReady,
        clients: clients.size,
      });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(versionedHtml, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "content-security-policy":
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:; media-src 'self' blob:; img-src 'self' data:; frame-ancestors https://web.telegram.org https://*.telegram.org",
          "permissions-policy": "microphone=(self)",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      if (ws.data.role === "client") send(ws, { type: "auth.required" });
    },
    message(ws, raw) {
      let message: Record<string, unknown>;
      try {
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        message = JSON.parse(text) as Record<string, unknown>;
      } catch {
        closeClient(ws, 1003, "Invalid JSON");
        return;
      }

      if (ws.data.role === "bridge") {
        if (!ws.data.authenticated) {
          if (message.type !== "bridge.auth" || message.secret !== BRIDGE_SECRET) {
            closeClient(ws, 1008, "Unauthorized");
            return;
          }
          if (bridge && bridge !== ws) closeClient(bridge, 1012, "Bridge replaced");
          ws.data.authenticated = true;
          bridge = ws;
          gatewayReady = false;
          send(ws, { type: "bridge.ready" });
          broadcastBridgeState();
          return;
        }
        if (message.type === "bridge.status" && ws === bridge) {
          gatewayReady = message.ready === true;
          broadcastBridgeState();
          return;
        }
        if (message.type === "event") {
          for (const client of clients.values()) send(client, message.payload ?? message);
          return;
        }
        const clientId = typeof message.clientId === "string" ? message.clientId : "";
        const client = clients.get(clientId);
        if (client) send(client, message.payload);
        return;
      }

      if (!ws.data.authenticated) {
        if (message.type !== "auth" || typeof message.initData !== "string") {
          closeClient(ws, 1008, "Telegram authorization required");
          return;
        }
        try {
          const user = validateTelegramInitData(message.initData, {
            botId: BOT_ID,
            allowedUserId: ALLOWED_USER_ID,
          });
          ws.data.authenticated = true;
          ws.data.user = user;
          clients.set(ws.data.id, ws);
          send(ws, {
            type: "auth.ok",
            gatewayReady,
            user: { id: user.id, firstName: user.first_name || "Ilbert" },
            bridgeConnected: bridge?.readyState === WebSocket.OPEN && bridge.data.authenticated,
          });
          if (bridge?.data.authenticated) {
            send(bridge, { type: "client.open", clientId: ws.data.id });
          }
        } catch (error) {
          send(ws, { type: "auth.error", message: error instanceof Error ? error.message : "Unauthorized" });
          closeClient(ws, 1008, "Unauthorized");
        }
        return;
      }

      if (message.type === "audio.diagnostic") {
        const report = message.report as Record<string, unknown> | undefined;
        const allowed = ["packetsReceived", "bytesReceived", "totalAudioEnergy", "currentTime", "readyState", "paused", "trackMuted", "playRejected"];
        const safe: Record<string, number | boolean> = {};
        for (const key of allowed) {
          const value = report?.[key];
          if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) safe[key] = value;
        }
        console.log("audio.diagnostic", JSON.stringify(safe));
        return;
      }

      if (!bridge?.data.authenticated) {
        send(ws, { type: "error", id: message.id, message: "Friday is offline" });
        return;
      }
      if (message.type !== "rpc" && message.type !== "offer") {
        send(ws, { type: "error", id: message.id, message: "Unsupported request" });
        return;
      }
      send(bridge, { type: "client.message", clientId: ws.data.id, payload: message });
    },
    close(ws) {
      if (ws.data.role === "bridge") {
        if (bridge === ws) { bridge = null; gatewayReady = false; }
        broadcastBridgeState();
        return;
      }
      clients.delete(ws.data.id);
      if (bridge?.data.authenticated) send(bridge, { type: "client.close", clientId: ws.data.id });
    },
  },
});

console.log(`Friday Mini App listening on 0.0.0.0:${server.port}`);
