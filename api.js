const BASE = process.env.NEXT_PUBLIC_API || "";

const ls = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
  } catch {}
  return null;
};

export const store = {
  get token() { return ls("ws") || ""; },
  set token(v) { ls("ws", v); },
  get mode() { return ls("wm") === "manual" ? "manual" : "auto"; },
  set mode(v) { ls("wm", v); },
};

export class ApiError extends Error {
  constructor(m, status) { super(m); this.status = status; }
}

export async function api(path, body) {
  let r;
  try {
    r = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-Token": store.token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach Worker right now.", 0);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(typeof j.detail === "string" ? j.detail : "Request failed.", r.status);
  return j;
}

// Live state over server-sent events (fetch-based so the X-Token header can be sent).
export function stream(onState, onLive, onDenied) {
  let stop = false, ctl;
  (async () => {
    let wait = 1000;
    while (!stop) {
      try {
        ctl = new AbortController();
        const r = await fetch(BASE + "/api/dashboard/stream", { headers: { "X-Token": store.token }, signal: ctl.signal });
        if (r.status === 401) return onDenied();
        if (!r.ok || !r.body) throw 0;
        onLive(true); wait = 1000;
        const rd = r.body.getReader(), dc = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          buf += dc.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const c = buf.slice(0, i); buf = buf.slice(i + 2);
            if (c.startsWith("data: ")) onState(JSON.parse(c.slice(6)));
          }
        }
      } catch {}
      if (stop) return;
      onLive(false);
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(wait * 2, 10000);
    }
  })();
  return () => { stop = true; ctl?.abort(); };
}
