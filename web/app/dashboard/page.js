"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Ban, Bot, Gauge, Hammer, Lock, LogOut, Save, Send, ShieldCheck, Siren, SlidersHorizontal, Unlock } from "lucide-react";
import Logo from "../../components/Logo";
import { api, store, stream } from "../../lib/api";

const fmt = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const TIPS = ["Turn panic mode on", "Set the limit to 5 actions per 10 seconds", "Save the server layout", "What’s the current status?"];

export default function Dashboard() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [live, setLive] = useState(false);
  const [mode, setModeState] = useState(null);   // null = show the Automatic/Manual picker
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState("");
  const [ask, setAsk] = useState(false);
  const dlg = useRef();

  const signOut = useCallback((call = true) => {
    if (call) api("/api/auth/logout", {}).catch(() => {});
    store.token = ""; router.replace("/");
  }, [router]);

  useEffect(() => {
    if (!store.token) { router.replace("/"); return; }
    try { setModeState(sessionStorage.getItem("wp") ? store.mode : null); } catch { setModeState(store.mode); }
    return stream(setS, setLive, () => signOut(false));
  }, [router, signOut]);

  useEffect(() => {
    document.body.classList.toggle("armed", !!s?.panic);
    return () => document.body.classList.remove("armed");
  }, [s?.panic]);

  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (ask && !d.open) d.showModal(); else if (!ask && d.open) d.close();
  }, [ask]);

  const setMode = (m) => { store.mode = m; try { sessionStorage.setItem("wp", "1"); } catch {} setModeState(m); };
  const flash = (m, bad) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, m, bad }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };
  const sync = async () => { try { setS(await api("/api/dashboard/state")); } catch {} };
  const act = async (b, key = "") => {
    setBusy(key);
    try { const r = await api("/api/dashboard/action", b); flash(r.message); if (!live) await sync(); }
    catch (e) { e.status === 401 ? signOut(false) : flash(e.message, true); }
    setBusy("");
  };

  if (!s) return <main className="boot">Connecting to Worker…</main>;

  return (
    <>
      <header className="top">
        <Logo />
        <span className="guild">{s.guild}</span>
        <span className="sp" />
        <span className={"live" + (live ? " on" : "")}><i />{live ? "Live" : "Reconnecting…"}</span>
        {mode && <div className="seg" role="group" aria-label="Dashboard mode">
          {[["auto", "Automatic", Bot], ["manual", "Manual", SlidersHorizontal]].map(([id, l, Icon]) => (
            <button key={id} className={mode === id ? "on" : ""} aria-pressed={mode === id} onClick={() => setMode(id)}>
              <Icon size={16} /><span>{l}</span>
            </button>
          ))}
        </div>}
        <button className="icb" onClick={() => signOut()} aria-label="Sign out"><LogOut size={18} /></button>
      </header>

      <main className="wrap">
        {!mode ? <Picker onPick={setMode} /> : mode === "manual" ? (
          <>
            <Stats s={s} />
            <div className="grid">
              <section className="panel panic">
                <div>
                  <h2><Siren size={22} />Panic mode</h2>
                  <p>{s.panic ? "Active. Any channel or role delete, or ban, locks the person out immediately." : "Off. The normal threshold applies."}</p>
                </div>
                <button className="sw" role="switch" aria-checked={s.panic} aria-label="Panic mode" onClick={() => act({ action: "panic", on: !s.panic }, "panic")} />
              </section>

              <Thresholds s={s} act={act} />

              <section className="panel">
                <h2><ShieldCheck size={20} />Server layout</h2>
                {s.hold && <div className="hold"><Lock size={16} />Layout saving is paused after an incident. Check the server, then release the hold.</div>}
                <div className="acts">
                  <button className="btn pri" disabled={s.hold || busy === "snapshot"} onClick={() => act({ action: "snapshot" }, "snapshot")}><Save size={18} />Save layout</button>
                  <button className="btn" disabled={busy === "rebuild"} onClick={() => setAsk(true)}><Hammer size={18} />{busy === "rebuild" ? "Rebuilding…" : "Rebuild server"}</button>
                  {s.hold && <button className="btn" disabled={busy === "release"} onClick={() => act({ action: "release" }, "release")}><Unlock size={18} />Release hold</button>}
                </div>
              </section>

              <section className="panel wide">
                <h2><Activity size={20} />Recent activity</h2>
                <div className="feed">
                  {s.log.length ? s.log.map((l, i) => {
                    const [t, ...m] = l.split("|");
                    return <div key={i}><time>{fmt(t)}</time>{m.join("|")}</div>;
                  }) : <p className="empty">No activity yet.</p>}
                </div>
              </section>
            </div>
          </>
        ) : (
          <Chat s={s} onManual={() => setMode("manual")} onDenied={() => signOut(false)} onDone={() => !live && sync()} />
        )}
      </main>

      <dialog ref={dlg} className="dlg" onClose={() => setAsk(false)}>
        <h3>Rebuild server?</h3>
        <p>Missing roles, categories and channels are recreated from the saved layout. Anything that still exists stays as it is.</p>
        <div className="row">
          <button className="btn" onClick={() => setAsk(false)}>Cancel</button>
          <button className="btn pri" onClick={() => { setAsk(false); act({ action: "rebuild" }, "rebuild"); }}>Rebuild</button>
        </div>
      </dialog>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={"toast" + (t.bad ? " bad" : "")}>{t.m}</div>)}
      </div>
    </>
  );
}

function Stats({ s }) {
  const items = [
    ["Panic mode", s.panic ? "Active" : "Off", Siren, s.panic],
    ["Events seen", s.events.toLocaleString(), Activity],
    ["Users locked out", s.neutralized.toLocaleString(), Ban],
    ["Threshold", `${s.limit} / ${s.window}s`, Gauge],
  ];
  return (
    <div className="stats">
      {items.map(([l, v, Icon, hot]) => (
        <div className="stat" key={l}>
          <Icon size={20} />
          <div><small>{l}</small><b className={hot ? "hot" : ""}>{v}</b></div>
        </div>
      ))}
    </div>
  );
}

function Thresholds({ s, act }) {
  const [a, setA] = useState(s.limit), [w, setW] = useState(s.window);
  const drag = useRef(false), t = useRef();
  useEffect(() => { if (!drag.current) { setA(s.limit); setW(s.window); } }, [s.limit, s.window]);
  const push = (na, nw) => {
    drag.current = true; clearTimeout(t.current);
    t.current = setTimeout(() => { drag.current = false; act({ action: "limit", actions: na, seconds: nw }); }, 450);
  };
  const p = (v, lo, hi) => ({ "--p": ((v - lo) / (hi - lo)) * 100 + "%" });
  return (
    <section className="panel">
      <h2><SlidersHorizontal size={20} />Anti-nuke threshold</h2>
      <div className="sl">
        <label htmlFor="ra">Actions allowed<b>{a}</b></label>
        <input id="ra" type="range" min="1" max="50" value={a} style={p(a, 1, 50)} onChange={(e) => { const v = +e.target.value; setA(v); push(v, w); }} />
      </div>
      <div className="sl">
        <label htmlFor="rw">Within<b>{w}s</b></label>
        <input id="rw" type="range" min="1" max="300" value={w} style={p(w, 1, 300)} onChange={(e) => { const v = +e.target.value; setW(v); push(a, v); }} />
      </div>
      <p className="hint">Anyone who does more than {a} deletes or bans within {w} seconds is locked out.</p>
    </section>
  );
}

function Chat({ s, onManual, onDenied, onDone }) {
  const [msgs, setMsgs] = useState([{ r: "a", t: "Hi! I can turn panic mode on or off, change the threshold, or save the layout. For a rebuild or releasing a snapshot hold, use Manual mode. What do you need?" }]);
  const [txt, setTxt] = useState(""), [wait, setWait] = useState(false);
  const hist = useRef([]), box = useRef();
  useEffect(() => { box.current && (box.current.scrollTop = box.current.scrollHeight); }, [msgs, wait]);

  async function send(t) {
    t = t.trim(); if (!t || wait) return;
    const h = hist.current.slice(-8);
    hist.current.push({ role: "user", content: t });
    setMsgs((m) => [...m, { r: "u", t }]); setTxt(""); setWait(true);
    try {
      const r = await api("/api/dashboard/chat", { message: t, history: h });
      hist.current.push({ role: "assistant", content: r.reply || "" });
      setMsgs((m) => [...m, { r: "a", t: r.reply || "Done.", res: r.results }]);
      onDone();
    } catch (e) {
      if (e.status === 401) return onDenied();
      setMsgs((m) => [...m, { r: "e", t: e.status === 503 ? "The AI is unavailable right now. Every control is also in Manual mode." : e.message, sw: e.status === 503 }]);
    }
    setWait(false);
  }

  return (
    <section className="panel chat">
      <div className="bar">
        <span className={"chip" + (s.panic ? " hot" : "")}><Siren size={14} />Panic {s.panic ? "on" : "off"}</span>
        <span className="chip"><Gauge size={14} />{s.limit} actions / {s.window}s</span>
        {s.hold && <span className="chip hot"><Lock size={14} />Snapshot hold</span>}
        <span className="sp" />
        <button className="chip btnchip" onClick={onManual}><SlidersHorizontal size={14} />Manual controls</button>
      </div>
      <div className="msgs" ref={box}>
        {msgs.map((m, i) => (
          <div key={i} className={"m " + m.r}>
            {m.t}
            {m.res?.length > 0 && <div className="res">{m.res.map((x, j) => <span key={j}>{x}</span>)}</div>}
            {m.sw && <div><button className="btn pri" onClick={onManual}>Switch to Manual</button></div>}
          </div>
        ))}
        {wait && <div className="m a wait">Thinking…</div>}
      </div>
      {msgs.length === 1 && (
        <div className="sugg">{TIPS.map((t) => <button key={t} className="chip btnchip" onClick={() => send(t)}>{t}</button>)}</div>
      )}
      <form className="in" onSubmit={(e) => { e.preventDefault(); send(txt); }}>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ask Worker to change something…" aria-label="Message" maxLength={1000} />
        <button className="btn pri" disabled={wait || !txt.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
    </section>
  );
}

function Picker({ onPick }) {
  const M = [
    ["auto", "Automatic", Bot, "Tell the AI assistant what you need in plain language."],
    ["manual", "Manual", SlidersHorizontal, "Switches, sliders and buttons that act instantly."],
  ];
  return (
    <section className="pick">
      <h1>How do you want to work?</h1>
      <p className="lede">You can switch any time from the top-right corner.</p>
      <div className="modes">
        {M.map(([id, n, Icon, t]) => (
          <button key={id} className="mode" onClick={() => onPick(id)}>
            <span className="ic"><Icon size={22} /></span>
            <span><b>{n}</b><small>{t}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}
