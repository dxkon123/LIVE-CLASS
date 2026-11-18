// All calls to the game server go through here. In the single-file build there is no server:
// a local, in-browser implementation (src/standalone/localServer.ts) answers instead.
type LocalApi = (path: string, method: string, body: unknown) => Promise<unknown>;
type Listener = (data: unknown) => void;
interface LocalEvents {
  open: (url: string, emit: (name: string, data: unknown) => void) => () => void;
}

let localApi: LocalApi | null = null;
let localEvents: LocalEvents | null = null;
export function setLocalServer(apiFn: LocalApi, events: LocalEvents) {
  localApi = apiFn;
  localEvents = events;
}

export interface ApiResponse {
  ok: boolean;
  json: () => Promise<any>;
}

/** fetch() replacement: `api('/api/game/save', { method: 'POST', body: JSON.stringify(x) })` */
export async function api(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<ApiResponse> {
  if (localApi) {
    let body: unknown = init.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // raw text
      }
    }
    const data = await localApi(path, (init.method || 'GET').toUpperCase(), body);
    return { ok: true, json: async () => data };
  }
  const r = await fetch(path, init as RequestInit);
  return { ok: r.ok, json: () => r.json() };
}

/** EventSource replacement with the same addEventListener / close / onerror shape */
export function openEvents(url: string) {
  if (!localEvents) return new EventSource(url);
  const map = new Map<string, Set<Listener>>();
  const src = {
    onerror: null as null | (() => void),
    addEventListener(name: string, fn: (e: { data: string }) => void) {
      let s = map.get(name);
      if (!s) map.set(name, (s = new Set()));
      s.add((d) => fn({ data: JSON.stringify(d) }));
    },
    close() {
      stop();
    },
  };
  // deliver asynchronously, like a real stream
  const stop = localEvents.open(url, (name, data) => {
    for (const fn of map.get(name) ?? []) fn(data);
  });
  return src as unknown as EventSource;
}
