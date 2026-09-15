/**
 * Minimal Ring Partner API client: only the endpoints Doorstep needs, and none that return
 * media. Base URL https://api.amazonvision.com, `Authorization: Bearer <access_token>`.
 *
 *   GET /v1/users/me                               account id
 *   GET /v1/devices                                devices the household granted
 *   GET /v1/history/devices/{device_id}/events     event history (metadata only)
 *   PATCH /v1/accounts/me/app-integrations         { status: "awaiting" | "completed" }
 */
import { DoorstepError } from "../errors.js";
import type { FetchLike } from "./oauth.js";

export interface RingDevice {
  id: string;
  name: string | null;
  kind: string | null;
}

export interface RingHistoryEvent {
  id: string;
  eventType: string | null;
  start: number | null;
  end: number | null;
}

export interface RingClientOptions {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export class RingClient {
  private readonly base: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: RingClientOptions) {
    this.base = opts.apiBaseUrl.replace(/\/+$/, "");
    this.token = opts.accessToken;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    const res = await this.fetchImpl(`${this.base}${path}`, init);
    const text = await res.text();
    if (!res.ok) {
      throw new DoorstepError(
        res.status === 429 ? "RING_RATE_LIMITED" : "RING_API_ERROR",
        `Ring API ${method} ${path} returned ${res.status}.`,
        res.status === 429
          ? `Retry after ${res.headers.get("Retry-After") ?? "a few"} seconds.`
          : text.slice(0, 200),
      );
    }
    return text ? (JSON.parse(text) as unknown) : null;
  }

  async getAccountId(): Promise<string> {
    const json = await this.request("GET", "/v1/users/me");
    const data = isRecord(json) && isRecord(json.data) ? json.data : isRecord(json) ? json : {};
    const attrs = isRecord(data.attributes) ? data.attributes : data;
    const id =
      (typeof attrs.account_id === "string" && attrs.account_id) ||
      (typeof data.id === "string" && data.id) ||
      (typeof attrs.id === "string" && attrs.id) ||
      "";
    if (!id) {
      throw new DoorstepError("RING_API_ERROR", "GET /v1/users/me returned no account id.", JSON.stringify(json).slice(0, 200));
    }
    return id;
  }

  async listDevices(): Promise<RingDevice[]> {
    const json = await this.request("GET", "/v1/devices");
    const list = isRecord(json) && Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    return list.filter(isRecord).map((d) => {
      const attrs = isRecord(d.attributes) ? d.attributes : {};
      return {
        id: String(d.id ?? ""),
        name: typeof attrs.name === "string" ? attrs.name : null,
        kind: typeof attrs.kind === "string" ? attrs.kind : typeof d.type === "string" ? d.type : null,
      };
    });
  }

  async getEventHistory(deviceId: string, opts: { eventTypes?: string[] } = {}): Promise<RingHistoryEvent[]> {
    const q = new URLSearchParams();
    if (opts.eventTypes?.length) q.set("event_types", opts.eventTypes.join(","));
    const qs = q.toString();
    const json = await this.request(
      "GET",
      `/v1/history/devices/${encodeURIComponent(deviceId)}/events${qs ? `?${qs}` : ""}`,
    );
    const list = isRecord(json) && Array.isArray(json.data) ? json.data : [];
    return list.filter(isRecord).map((e) => {
      const attrs = isRecord(e.attributes) ? e.attributes : {};
      const num = (v: unknown): number | null => {
        if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
        if (typeof v === "string") {
          const t = Date.parse(v);
          return Number.isNaN(t) ? null : t;
        }
        return null;
      };
      return {
        id: String(e.id ?? ""),
        eventType: typeof attrs.event_type === "string" ? attrs.event_type : null,
        start: num(attrs.start),
        end: num(attrs.end),
      };
    });
  }

  setIntegrationStatus(status: "awaiting" | "completed"): Promise<unknown> {
    return this.request("PATCH", "/v1/accounts/me/app-integrations", { status });
  }
}
