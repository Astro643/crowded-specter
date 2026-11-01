import os,json,time,asyncio,hashlib,hmac,secrets,base64
from types import SimpleNamespace as NS
from fastapi import Header,HTTPException,Request,Depends
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"web","out")
TTL=7*86400
DENIED="You cannot create an account."

class Login(BaseModel):
    guild_id:str
    password:str

class Reg(Login):
    code:str

class Act(BaseModel):
    action:str
    on:bool|None=None
    actions:int|None=None
    seconds:int|None=None

class Chat(BaseModel):
    message:str
    history:list[dict]=[]

def setup(app,g):
    x=NS(**g)
    run=lambda c,t=90:asyncio.run_coroutine_threadsafe(c,x.bot.loop).result(t)
    sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
    b64=lambda b:base64.b64encode(b).decode()
    kdf=lambda pw,salt:hashlib.scrypt(pw[:128].encode(),salt=salt,n=2**14,r=8,p=1,dklen=32)

    # ---- auth helpers ----
    def guild_of(gid):
        if not(gid.isascii() and gid.isdigit() and 15<=len(gid)<=20): raise HTTPException(400,"Enter a valid numeric Guild ID.")
        return x.bot.get_guild(int(gid))

    def gate(req,gid):
        ip=(req.headers.get("x-forwarded-for") or "?").split(",")[-1].strip()
        ks=((f"server:rl:ip:{ip}",10),(f"server:rl:gid:{gid}",30))
        if any(int(x.R.get(k) or 0)>=n for k,n in ks): raise HTTPException(429,"Too many attempts. Try again in 15 minutes.")
        return ks

    def miss(ks):
        for k,_ in ks:
            if x.R.incr(k)==1: x.R.expire(k,900)

    def issue(gid):
        t=secrets.token_urlsafe(32); h=sha(t)
        x.R.set(f"server:dash:session:{h}",str(gid),ex=TTL); x.R.sadd(f"server:dash:sessions:{gid}",h)
        return t

    def sess(x_token:str=Header()):
        v=x.R.get(f"server:dash:session:{sha(x_token)}")
        if not v: raise HTTPException(401,"Session expired. Sign in again.")
        return int(v)

    @app.post("/api/auth/login")
    def login(d:Login,r:Request):
        gid=d.guild_id.strip(); gu=guild_of(gid); ks=gate(r,gid)
        raw=x.R.get(f"server:account:{gid}"); a=(raw if isinstance(raw,dict) else json.loads(raw)) if raw else None
        ok=hmac.compare_digest(kdf(d.password,base64.b64decode(a["s"]) if a else bytes(16)),base64.b64decode(a["h"]) if a else bytes(32))
        if not(a and ok): miss(ks); raise HTTPException(401,"Wrong Guild ID or password.")
        if not gu: raise HTTPException(404,"Worker is not in that server.")
        return {"token":issue(gu.id),"guild":gu.name}

    @app.post("/api/auth/register")
    def register(d:Reg,r:Request):
        gid=d.guild_id.strip(); gu=guild_of(gid); ks=gate(r,gid)
        if not 8<=len(d.password)<=128: raise HTTPException(400,"Password must be 8 to 128 characters.")
        code=d.code.strip().upper()[:16]
        gi,_,ui=(x.R.get(f"server:verify:{code}") or "").partition(":")
        m=gu.get_member(int(ui)) if gu and ui else None
        ok=bool(m and gi==gid and x.is_staff(m))
        if ok and x.R.exists(f"server:account:{gid}") and m.id!=gu.owner_id:
            miss(ks); raise HTTPException(403,"An account already exists for this server. Only the server owner can reset it.")
        if not ok or x.R.delete(f"server:verify:{code}")!=1:
            miss(ks); raise HTTPException(403,DENIED)
        x.R.delete(f"server:verify:user:{gid}:{ui}")
        salt=secrets.token_bytes(16)
        x.R.set(f"server:account:{gid}",json.dumps({"s":b64(salt),"h":b64(kdf(d.password,salt)),"by":ui}))
        for h in x.R.smembers(f"server:dash:sessions:{gid}"): x.R.delete(f"server:dash:session:{h}")
        x.R.delete(f"server:dash:sessions:{gid}")
        run(x.note(gu.id,f"Dashboard account created by {m}"))
        return {"token":issue(gu.id),"guild":gu.name}

    @app.post("/api/auth/logout")
    def logout(x_token:str=Header()):
        h=sha(x_token); gid=x.R.get(f"server:dash:session:{h}")
        x.R.delete(f"server:dash:session:{h}")
        if gid: x.R.srem(f"server:dash:sessions:{gid}",h)
        return {"ok":True}

    # ---- dashboard ----
    async def act(gid,d):
        a=d.get("action"); gu=x.bot.get_guild(gid)
        if not gu: raise ValueError("Worker is not in this server.")
        if a=="panic":
            on=bool(d.get("on")); await x.AR.set(x.K("panic_mode",gid),str(int(on))); m=f"Panic mode {'ON' if on else 'OFF'}"
        elif a=="limit":
            n,s=max(1,min(50,int(d.get("actions") or 3))),max(1,min(300,int(d.get("seconds") or 10)))
            await x.AR.set(x.K("limit",gid),str(n)); await x.AR.set(x.K("window",gid),str(s)); m=f"Threshold set to {n} actions / {s}s"
        elif a=="release":
            await x.AR.delete(f"server:hold:{gid}"); m="Snapshot hold released"
        elif a=="rebuild":
            if not await x.AR.set(f"server:rebuild:{gid}",1,ex=120,nx=True): raise ValueError("A rebuild is already running.")
            try: await x.restore(gu)
            finally: await x.AR.delete(f"server:rebuild:{gid}")
            m="Rebuild finished"
        elif a=="snapshot":
            if await x.AR.get(f"server:hold:{gid}"): raise ValueError("Snapshots are on hold. Release the hold first.")
            await x.AR.set(x.BP%gid,x.pack(gu)); m="Layout saved"
        else: raise ValueError("Unknown action")
        await x.note(gid,"Dashboard: "+m); return m

    def state(gid):
        gu=x.bot.get_guild(gid)
        v=x.R.mget(x.K("panic_mode",gid),x.K("limit",gid),x.K("window",gid),x.S("events",gid),x.S("neutralized",gid),f"server:hold:{gid}")
        return {"guild":gu.name if gu else str(gid),"panic":str(v[0])=="1","limit":int(v[1] or 3),"window":int(v[2] or 10),
                "events":int(v[3] or 0),"neutralized":int(v[4] or 0),"hold":bool(v[5]),"log":x.R.lrange(f"server:log:{gid}",0,29)}

    @app.get("/api/dashboard/state")
    def st(gid:int=Depends(sess)): return state(gid)

    @app.get("/api/dashboard/stream")
    def stream(gid:int=Depends(sess)):
        def gen():
            seen=-1
            while True:
                with x._cv:
                    if x._v[0]==seen: x._cv.wait(25)
                    cur=x._v[0]
                if cur!=seen:
                    seen=cur
                    try: yield "data: "+json.dumps(state(gid))+"\n\n"
                    except Exception: yield ": err\n\n"
                    time.sleep(.3)
                else: yield ": ka\n\n"
        return StreamingResponse(gen(),media_type="text/event-stream",headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

    @app.post("/api/dashboard/action")
    def action(d:Act,gid:int=Depends(sess)):
        try: return {"message":run(act(gid,d.model_dump()))}
        except Exception as e: raise HTTPException(400,str(e)[:120])

    @app.post("/api/dashboard/chat")
    def chat(c:Chat,gid:int=Depends(sess)):
        s=state(gid)
        p=("You are the admin assistant of Worker, a Discord security bot. Current state of this server: "+json.dumps({k:s[k] for k in("panic","limit","window","events","neutralized","hold")})
           +'. Available actions: {"action":"panic","on":bool}, {"action":"limit","actions":int,"seconds":int}, {"action":"snapshot"}. Rebuild and release-hold are manual-only: if asked, tell the user to open Manual mode. '
           +'Reply ONLY with JSON: {"reply":"short friendly text","actions":[...]}. Use an empty actions list for questions. Never invent actions.\n'
           +"\n".join(f"{m.get('role')}: {str(m.get('content'))[:500]}" for m in c.history[-8:])+"\nuser: "+c.message[:1000])
        t=run(x.ai(p)) or "UNAVAILABLE"
        if t=="UNAVAILABLE": raise HTTPException(503,"AI unavailable")
        try: j=json.loads(t[t.index("{"):t.rindex("}")+1])
        except Exception: return {"reply":t,"results":[]}
        r=[]
        for a in j.get("actions",[])[:5]:
            if not isinstance(a,dict) or a.get("action") in("rebuild","release"):
                r.append("✗ Use Manual mode for that (it needs confirmation)"); continue
            try: r.append("✓ "+run(act(gid,a)))
            except Exception as e: r.append("✗ "+str(e)[:80])
        return {"reply":j.get("reply",""),"results":r}

    # ---- web UI (Next.js static export), mounted last ----
    if os.path.isdir(OUT): app.mount("/",StaticFiles(directory=OUT,html=True),name="web")
    else: app.add_api_route("/",lambda:{"ok":True,"web":"not built"},methods=["GET","HEAD"])
