/** Browser-safe wire types and validation shared by both workspaces. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export const TALK_METHODS = [
  'talk.catalog',
  'talk.client.create',
  'talk.client.close',
  'talk.client.steer',
] as const;
export type TalkMethod = (typeof TALK_METHODS)[number];
export type RpcRequest = { type: 'rpc'; id: string; method: TalkMethod; params: JsonObject };
export type OfferRequest = {
  type: 'offer';
  id: string;
  offerUrl: string;
  clientSecret: string;
  sdp: string;
  offerHeaders: Record<string, string>;
};
export type ClientRequest = RpcRequest | OfferRequest;
export type Reply =
  | { type: 'result'; id: string; result: Json }
  | { type: 'error'; id: string; message: string };
export type TalkEvent = { type: string; sessionId: string; payload: JsonObject };
export type RelayMessage =
  | Reply
  | { type: 'auth.required' }
  | { type: 'auth.error'; message: string }
  | {
      type: 'auth.ok';
      bridgeConnected: boolean;
      gatewayReady: boolean;
      user: { id: number; firstName: string };
    }
  | { type: 'bridge.state'; connected: boolean; gatewayReady: boolean }
  | { type: 'event'; event: 'talk.event'; payload: Json };
export type BridgeMessage =
  | { type: 'bridge.ping' }
  | { type: 'bridge.auth'; secret: string }
  | { type: 'bridge.status'; ready: boolean }
  | { type: 'client.reply'; clientId: string; payload: Reply }
  | { type: 'event'; payload: Extract<RelayMessage, { type: 'event' }> };
export type ConnectorMessage =
  | { type: 'bridge.pong' }
  | { type: 'bridge.ready' }
  | { type: 'client.open' | 'client.close'; clientId: string }
  | { type: 'client.message'; clientId: string; payload: ClientRequest };
export type VoiceConfiguration = { sessionKey: string; model: string };
export type VoiceSession = {
  voiceSessionId: string;
  offerUrl: string;
  clientSecret: string;
  offerHeaders: Record<string, string>;
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return isObject(value) && Object.values(value).every(isJson);
}
export function isJsonObject(value: unknown): value is JsonObject {
  return isObject(value) && isJson(value);
}
export function isStringMap(value: unknown): value is Record<string, string> {
  return isObject(value) && Object.values(value).every((item) => typeof item === 'string');
}
export function parseObject(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw);
  if (!isObject(value)) throw new Error('Expected a JSON object');
  return value;
}
export function isTalkMethod(value: unknown): value is TalkMethod {
  return TALK_METHODS.some((method) => method === value);
}
export function isClientRequest(value: unknown): value is ClientRequest {
  if (!isObject(value) || typeof value.id !== 'string') return false;
  if (value.type === 'rpc') return isTalkMethod(value.method) && isJsonObject(value.params);
  return (
    value.type === 'offer' &&
    typeof value.offerUrl === 'string' &&
    typeof value.clientSecret === 'string' &&
    typeof value.sdp === 'string' &&
    isStringMap(value.offerHeaders)
  );
}
export function isReply(value: unknown): value is Reply {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    ((value.type === 'result' && isJson(value.result)) ||
      (value.type === 'error' && typeof value.message === 'string'))
  );
}
export function isTalkMessage(value: unknown): value is Extract<RelayMessage, { type: 'event' }> {
  return (
    isObject(value) &&
    value.type === 'event' &&
    value.event === 'talk.event' &&
    isJson(value.payload)
  );
}
export function readTalkEvent(raw: unknown): TalkEvent | null {
  const event = isObject(raw) && isObject(raw.talkEvent) ? raw.talkEvent : raw;
  if (!isObject(event) || typeof event.type !== 'string' || typeof event.sessionId !== 'string')
    return null;
  return {
    type: event.type,
    sessionId: event.sessionId,
    payload: isJsonObject(event.payload) ? event.payload : {},
  };
}
export function readVoiceSession(raw: unknown): VoiceSession {
  if (!isObject(raw) || !isObject(raw.clientControl) || raw.clientControl.owner !== 'gateway')
    throw new Error('Secure Gateway control was not negotiated');
  if (
    typeof raw.voiceSessionId !== 'string' ||
    typeof raw.offerUrl !== 'string' ||
    typeof raw.clientSecret !== 'string'
  )
    throw new Error('Invalid voice session');
  return {
    voiceSessionId: raw.voiceSessionId,
    offerUrl: raw.offerUrl,
    clientSecret: raw.clientSecret,
    offerHeaders: isStringMap(raw.offerHeaders) ? raw.offerHeaders : {},
  };
}
