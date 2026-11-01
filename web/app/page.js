"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldAlert, ShieldCheck, Terminal, Zap, RefreshCw } from "lucide-react";
import Logo from "../components/Logo";
import { api, store } from "../lib/api";

const ID = /^\d{15,20}$/;

export default function Landing() {
  const router = useRouter();
  const [view, setView] = useState("in"); // in | up1 | up2
  const [f, setF] = useState({ guild: "", pw: "", pw2: "", code: "" });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!store.token) return;
    api("/api/dashboard/state").then(() => router.replace("/dashboard/")).catch(() => { store.token = ""; });
  }, [router]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = (v) => { setView(v); setErr(null); };
  const badId = () => setErr({ m: "Enter your numeric Guild ID.", h: "In Discord, turn on Developer Mode, right-click your server and choose Copy Server ID." });

  async function submit(e) {
    e.preventDefault(); setErr(null);
    const guild_id = f.guild.trim();
    if (!ID.test(guild_id)) return badId();
    if (view === "up1") return go("up2");

    const up = view === "up2", code = f.code.trim();
    if (!f.pw) return setErr({ m: "Enter your password." });
    if (up) {
      if (!code) return setErr({ m: "Enter the code from /verify-position." });
      if (f.pw.length < 8) return setErr({ m: "Use a password with at least 8 characters." });
      if (f.pw !== f.pw2) return setErr({ m: "The two passwords don't match." });
    }
    setBusy(true);
    try {
      const r = await api(up ? "/api/auth/register" : "/api/auth/login", up ? { guild_id, password: f.pw, code } : { guild_id, password: f.pw });
      store.token = r.token;
      router.push("/dashboard/");
    } catch (x) {
      setErr({ m: x.message, h: up && x.status === 403 ? "Only the server owner and administrators can create an account. Moderators and members can't." : null });
      setBusy(false);
    }
  }

  const pwField = (id, label, key, auto) => (
    <div className="f">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input id={id} type={show ? "text" : "password"} autoComplete={auto} value={f[key]} onChange={set(key)} />
        <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <main className="land">
      <section>
        <Logo />
        <h1>Stop a server raid while it’s happening.</h1>
        <p className="lede">Worker watches for mass deletions and bans, locks out whoever is doing it, and rebuilds what was lost from your saved layout.</p>
        <ul className="points">
          <li><Zap size={18} />Live controls: what one staff member changes, everyone sees at once.</li>
          <li><RefreshCw size={18} />One-click rebuild from your saved server layout.</li>
          <li><ShieldCheck size={18} />For the server owner and administrators only.</li>
        </ul>
      </section>

      <form className="auth" onSubmit={submit} noValidate>
        {view === "in" && (
          <>
            <h2>Sign in</h2>
            <p className="sub">Use your Guild ID and dashboard password.</p>
            <div className="f">
              <label htmlFor="g">Guild ID</label>
              <input id="g" inputMode="numeric" autoComplete="off" value={f.guild} onChange={set("guild")} placeholder="123456789012345678" />
            </div>
            {pwField("p", "Password", "pw", "current-password")}
          </>
        )}

        {view === "up1" && (
          <>
            <h2>Create an account</h2>
            <p className="sub">No problem. First, which server is it for?</p>
            <div className="f">
              <label htmlFor="g">Guild ID</label>
              <input id="g" inputMode="numeric" autoComplete="off" value={f.guild} onChange={set("guild")} placeholder="123456789012345678" />
            </div>
          </>
        )}

        {view === "up2" && (
          <>
            <h2>Verify your position</h2>
            <div className="step">
              <Terminal size={20} />
              <p>In your server, run <code>/verify-position</code>. The bot replies privately with a code. Only the owner and administrators get one.</p>
            </div>
            <div className="f">
              <label htmlFor="c">Verification code</label>
              <input id="c" autoComplete="off" autoCapitalize="characters" maxLength={8} value={f.code} onChange={set("code")} placeholder="8-character code" />
            </div>
            {pwField("p", "Choose a password", "pw", "new-password")}
            {pwField("p2", "Confirm password", "pw2", "new-password")}
          </>
        )}

        {err && (
          <div className="alert" role="alert">
            <ShieldAlert size={20} />
            <div><strong>{err.m}</strong>{err.h && <p>{err.h}</p>}</div>
          </div>
        )}

        <button className="btn pri block" disabled={busy}>
          {busy ? "Please wait…" : view === "in" ? "Sign in" : view === "up1" ? "Continue" : "Create account"}
        </button>

        {view === "in" ? (
          <p className="alt">Don’t have an account? No problem. <button type="button" className="linkb" onClick={() => go("up1")}>Create an account</button></p>
        ) : (
          <p className="alt">
            {view === "up2" && <><button type="button" className="linkb" onClick={() => go("up1")}>Change server</button> · </>}
            <button type="button" className="linkb" onClick={() => go("in")}>Back to sign in</button>
          </p>
        )}
      </form>
    </main>
  );
}
