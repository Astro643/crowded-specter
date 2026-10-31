"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Eye, EyeOff, ShieldAlert, SlidersHorizontal } from "lucide-react";
import Logo from "../components/Logo";
import { api, store } from "../lib/api";

const MODES = [
  { id: "auto", Icon: Bot, name: "Automatic", text: "Tell the AI assistant what you need in plain language." },
  { id: "manual", Icon: SlidersHorizontal, name: "Manual", text: "Switches, sliders and buttons that act instantly." },
];

export default function Landing() {
  const router = useRouter();
  const [tab, setTab] = useState("in");
  const [mode, setMode] = useState("auto");
  const [f, setF] = useState({ guild: "", pw: "", code: "" });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const up = tab === "up";

  useEffect(() => {
    setMode(store.mode);
    if (!store.token) return;
    api("/api/dashboard/state").then(() => router.replace("/dashboard/")).catch(() => { store.token = ""; });
  }, [router]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pick = (t) => { setTab(t); setErr(null); };

  async function submit(e) {
    e.preventDefault(); setErr(null);
    const guild_id = f.guild.trim(), code = f.code.trim();
    if (!/^\d{17,20}$/.test(guild_id))
      return setErr({ m: "Enter your numeric Guild ID.", h: "In Discord, turn on Developer Mode, right-click your server and choose Copy Server ID." });
    if (!f.pw) return setErr({ m: "Enter your password." });
    if (up && f.pw.length < 8) return setErr({ m: "Use a password with at least 8 characters." });
    if (up && !code) return setErr({ m: "Enter the code from /verify-position." });
    setBusy(true);
    try {
      const r = await api(up ? "/api/auth/register" : "/api/auth/login", up ? { guild_id, password: f.pw, code } : { guild_id, password: f.pw });
      store.token = r.token; store.mode = mode;
      router.push("/dashboard/");
    } catch (x) {
      const denied = up && x.status === 403;
      setErr({ m: x.message, denied, h: denied ? "Only server staff can create an account. Staff run /verify-position in Discord and enter the code here within 10 minutes." : null });
      setBusy(false);
    }
  }

  return (
    <main className="land">
      <section>
        <Logo />
        <h1>Stop a server raid while it’s happening.</h1>
        <p className="lede">Worker watches for mass deletions and bans, locks out whoever is doing it, and rebuilds what was lost from your saved layout.</p>
        <div className="modes" role="radiogroup" aria-label="Dashboard mode">
          {MODES.map(({ id, Icon, name, text }) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} className="mode" onClick={() => setMode(id)}>
              <span className="ic"><Icon size={22} /></span>
              <span><b>{name}</b><small>{text}</small></span>
            </button>
          ))}
        </div>
        <p className="hint">You can switch modes any time from the top-right corner of the dashboard.</p>
      </section>

      <form className="auth" onSubmit={submit} noValidate>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={!up} className={!up ? "on" : ""} onClick={() => pick("in")}>Sign in</button>
          <button type="button" role="tab" aria-selected={up} className={up ? "on" : ""} onClick={() => pick("up")}>Create account</button>
        </div>

        <div className="f">
          <label htmlFor="g">Guild ID</label>
          <input id="g" inputMode="numeric" autoComplete="off" value={f.guild} onChange={set("guild")} placeholder="123456789012345678" />
        </div>
        {up && (
          <div className="f">
            <label htmlFor="c">Verification code</label>
            <input id="c" autoComplete="off" autoCapitalize="characters" maxLength={8} value={f.code} onChange={set("code")} placeholder="Code from /verify-position" />
          </div>
        )}
        <div className="f">
          <label htmlFor="p">Password</label>
          <div className="pw">
            <input id="p" type={show ? "text" : "password"} autoComplete={up ? "new-password" : "current-password"} value={f.pw} onChange={set("pw")} />
            <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {err && (
          <div className="alert" role="alert">
            <ShieldAlert size={20} />
            <div><strong>{err.m}</strong>{err.h && <p>{err.h}</p>}</div>
          </div>
        )}

        <button className="btn pri block" disabled={busy}>{busy ? "Please wait…" : up ? "Create account" : "Sign in"}</button>
      </form>
    </main>
  );
}
