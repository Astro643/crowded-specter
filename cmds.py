import secrets
from discord import app_commands as ac
from types import SimpleNamespace as NS

def setup(bot,g):
    x=NS(**g); T=bot.tree
    async def owner(i): return i.user.id==i.guild.owner_id
    def cmd(d):
        def w(f): return T.command(description=d)(ac.guild_only()(ac.check(owner)(f)))
        return w

    @T.error
    async def err(i,e):
        s=i.followup.send if i.response.is_done() else i.response.send_message
        await s("Owner only." if isinstance(e,ac.CheckFailure) else "Error.",ephemeral=True)

    @cmd("Toggle panic mode")
    async def panic(i,on:bool):
        await x.AR.set(x.K("panic_mode",i.guild.id),str(int(on)))
        await x.note(i.guild.id,f"/panic {'on' if on else 'off'} by {i.user}")
        await i.response.send_message(f"panic={on}",ephemeral=True)

    @cmd("Show config, counters and hold state")
    async def status(i):
        g=i.guild.id
        p,l,w,ev,nu,h=await x.AR.mget(x.K("panic_mode",g),x.K("limit",g),x.K("window",g),x.S("events",g),x.S("neutralized",g),f"server:hold:{g}")
        await i.response.send_message(f"panic={p=='1'} limit={l or 3}/{w or 10}s events={ev or 0} neutralized={nu or 0} snapshot_hold={bool(h)}",ephemeral=True)

    @cmd("Set anti-nuke threshold")
    async def limit(i,actions:ac.Range[int,1,50],seconds:ac.Range[int,1,300]):
        await x.AR.set(x.K("limit",i.guild.id),str(actions)); await x.AR.set(x.K("window",i.guild.id),str(seconds))
        await x.note(i.guild.id,f"/limit {actions}/{seconds}s by {i.user}")
        await i.response.send_message(f"limit={actions}/{seconds}s",ephemeral=True)

    @cmd("Overwrite this server's blueprint now")
    async def snapshot(i):
        if await x.AR.get(f"server:hold:{i.guild.id}"): return await i.response.send_message("On hold after an incident. Verify the server, then /release.",ephemeral=True)
        await x.AR.set(x.BP%i.guild.id,x.pack(i.guild)); await x.note(i.guild.id,f"/snapshot by {i.user}")
        await i.response.send_message("Blueprint saved.",ephemeral=True)

    @cmd("Rebuild missing assets from the blueprint")
    async def rebuild(i):
        await i.response.defer(ephemeral=True); await x.restore(i.guild)
        await x.note(i.guild.id,f"/rebuild by {i.user}"); await i.followup.send("Rebuild done.")

    @cmd("Clear post-incident snapshot hold")
    async def release(i):
        await x.AR.delete(f"server:hold:{i.guild.id}"); await x.note(i.guild.id,f"/release by {i.user}")
        await i.response.send_message("Hold cleared.",ephemeral=True)

    @cmd("Latest AI risk verdicts for admin sessions")
    async def risk(i):
        await i.response.defer(ephemeral=True); o=[]
        for k in await x.AR.smembers("server:sessions"):
            if k.startswith(f"server:session:{i.guild.id}:"):
                v=await x.AR.get("server:ai:"+k)
                if v: o.append(f"<@{k.split(':')[-1]}>: {v[:150]}")
        await i.followup.send("\n".join(o[:10]) or "No verdicts yet.")

    @T.command(name="verify-position",description="Get a code to create a dashboard account (staff only)")
    @ac.guild_only()
    async def verify_position(i):
        if not x.is_staff(i.user): return await i.response.send_message("Access denied.",ephemeral=True)
        uk=f"server:verify:user:{i.guild.id}:{i.user.id}"
        old=await x.AR.get(uk)
        if old: await x.AR.delete(f"server:verify:{old}")
        c=secrets.token_hex(4).upper()
        await x.AR.set(f"server:verify:{c}",f"{i.guild.id}:{i.user.id}",ex=600)
        await x.AR.set(uk,c,ex=600)
        await i.response.send_message(f"Code: `{c}` (valid 10 minutes, single use). Enter it with your Guild ID `{i.guild.id}` under Create account.",ephemeral=True)
