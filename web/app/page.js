"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, RefreshCw, ShieldAlert, ShieldCheck, Terminal, Zap } from "lucide-react";
import Logo from "../components/Logo";
import { ArtLayout, ArtLive } from "../components/Art";
import { api, store } from "../lib/api";

const ID = /^\d{15,20}$/;
const CMDS = [
  ["/panic", "Lock everything down"],
  ["/status", "See settings and counters"],
  ["/limit", "Set the threshold"],
  ["/snapshot", "Save the layout"],
  ["/rebuild", "Restore what’s missing"],
  ["/release", "Clear the hold"],
  ["/risk", "AI verdicts on staff"],
  ["/verify-position", "Get a sign-up code"],
  ["Dashboard", "All of it, with buttons"],
];
const ACCESS = [
  ["Owner", "Full control. The only one who can reset the account."],
  ["Administrator", "Can create the account and use every control."],
  ["Moderator", "Can’t create an account."],
  ["Member", "No access."],
];

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
  const go = (v) => { setView(v); setErr(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
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
    <>
      <div className="sky">
        <header className="nav">
          <Logo />
          <nav className="pillnav" aria-label="Sections">
            <a href="#live">Live controls</a>
            <a href="#layout">Rebuild</a>
            <a href="#commands">Commands</a>
            <a href="#access">Access</a>
          </nav>
          <div className="pillpair">
            <button className="pp" onClick={() => go("in")}>Log in</button>
            <button className="pp sign" onClick={() => go("up1")}>Create account</button>
          </div>
        </header>

        <section className="hero">
          <div>
            <h1>Stop a raid <em>while it’s happening.</em></h1>
            <p className="lede">Worker watches for mass deletions and bans, locks out whoever is doing it, and rebuilds what was lost from your saved layout.</p>
            <ul className="points">
              <li><Zap size={18} />Everything updates live, for every staff member at once.</li>
              <li><RefreshCw size={18} />Rebuild roles and channels from your saved layout in one click.</li>
              <li><ShieldCheck size={18} />Only the server owner and administrators can sign in.</li>
            </ul>
          </div>

          <form className="auth" onSubmit={submit} noValidate>
            {view === "in" && (
              <>
                <h2>Log in</h2>
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
              {busy ? "Please wait…" : view === "in" ? "Log in" : view === "up1" ? "Continue" : "Create account"}
            </button>

            {view === "in" ? (
              <p className="alt">Don’t have an account? No problem. <button type="button" className="linkb" onClick={() => go("up1")}>Create an account</button></p>
            ) : (
              <p className="alt">
                {view === "up2" && <><button type="button" className="linkb" onClick={() => go("up1")}>Change server</button> · </>}
                <button type="button" className="linkb" onClick={() => go("in")}>Back to log in</button>
              </p>
            )}
          </form>
        </section>
      </div>

      <div className="fade">
        <section className="sec" id="live">
          <div>
            <h2>Live controls, no chaos</h2>
            <p>Flip panic mode, tune the threshold or save your layout. When one staff member changes something, everyone else sees it immediately. Prefer to talk it through? Ask the AI assistant instead.</p>
            <button className="btn pri" onClick={() => go("in")}>Log in</button>
          </div>
          <div className="art"><ArtLive /></div>
        </section>

        <section className="sec rev" id="layout">
          <div>
            <h2>A layout that remembers</h2>
            <p>Worker keeps a copy of your roles, categories and channels. If a raid wipes them out, rebuild what’s missing without touching what’s still there. After an incident, saving pauses until you’ve checked the server.</p>
            <button className="btn soft" onClick={() => go("up1")}>Create an account</button>
          </div>
          <div className="art"><ArtLayout /></div>
        </section>
      </div>

      <div className="band" id="commands">
        <section className="sec">
          <div>
            <h2>Prefer Discord? Everything works there too</h2>
            <p>Every control on the dashboard has a slash command. Use whichever is closer to hand; both stay in sync.</p>
          </div>
          <div className="tiles">
            {CMDS.map(([c, d]) => (
              <div className="tile" key={c}><code>{c}</code><small>{d}</small></div>
            ))}
          </div>
        </section>
      </div>

      <section className="sec" id="access">
        <div>
          <h2>Only the right people get in</h2>
          <p>The bot checks your real Discord permissions when you ask for a sign-up code, so nobody can create an account for a server they don’t run.</p>
        </div>
        <div className="rows">
          {ACCESS.map(([r, t]) => (
            <div key={r}><b>{r}</b><span>{t}</span></div>
          ))}
        </div>
      </section>

      <footer className="foot"><span>Worker: server defense for Discord.</span><span>Staff dashboard</span></footer>
    </>
  );
}
