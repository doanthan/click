(function(){
/* Click - Merchant portal (host business console). Feature parity with the live portal
   (dashboard, events & venues, bookings + check-in, finances/payouts, settings, apply flow),
   recast in the Click design system. Exports window.ScreensMerch = { Portal, Apply }. */
const { useState:uS, Icon:I, Btn, Field, Tag, Badge, Avatar:AV, Spark:SP } = window.CK;

/* ---------------- mock data ---------------- */
const BIZ = { name:"Inner West Fitness Mates", abn:"51 824 753 556", email:"hello@iwfm.au" };
const MEV = [
  { id:"m1", name:"Sunrise run club", venue:"Bay Run", suburb:"Rozelle", when:"Wed 15 Jul · 6:30 am", day:15, confirmed:14, cap:20, wait:0, status:"live", price:0 },
  { id:"m2", name:"Beginner boxing", venue:"Studio 44", suburb:"Marrickville", when:"Sat 18 Jul · 9:00 am", day:18, confirmed:11, cap:12, wait:3, status:"live", price:28 },
  { id:"m3", name:"Mobility & stretch", venue:"Studio 44", suburb:"Marrickville", when:"Tue 22 Jul · 6:00 pm", day:22, confirmed:4, cap:16, wait:0, status:"live", price:18 },
  { id:"m4", name:"Sunset trail jog", venue:"Callan Park", suburb:"Lilyfield", when:"Wed 8 Jul · 5:30 pm", day:8, confirmed:9, cap:12, wait:0, status:"ended", price:0 },
  { id:"m5", name:"Boxing fundamentals", venue:"Studio 44", suburb:"Marrickville", when:"Sat 4 Jul · 9:00 am", day:4, confirmed:12, cap:12, wait:2, status:"ended", price:28 },
];
const VENUES = [ { name:"Studio 44", suburb:"Marrickville", events:3 }, { name:"Bay Run", suburb:"Rozelle", events:1 }, { name:"Callan Park", suburb:"Lilyfield", events:1 } ];
const ATT = [
  { name:"Mia Rossi", email:"mia.rossi@gmail.com", ev:"m2", status:"confirmed", rsvp:"12 Jul, 7:15 pm" },
  { name:"Tom Becker", email:"tom.becker@hotmail.com", ev:"m2", status:"confirmed", rsvp:"11 Jul, 5:02 pm" },
  { name:"Priya Nair", email:"priya.n@gmail.com", ev:"m2", status:"waitlist", rsvp:"13 Jul, 12:59 pm" },
  { name:"Jordan Lee", email:"jordan.lee@gmail.com", ev:"m1", status:"confirmed", rsvp:"10 Jul, 11:29 am" },
  { name:"Ellen Park", email:"ellen.park@gmail.com", ev:"m1", status:"cancelled", rsvp:"8 Jul, 11:23 am" },
  { name:"Sam Okafor", email:"sam.okafor@gmail.com", ev:"m3", status:"confirmed", rsvp:"9 Jul, 4:56 pm" },
  { name:"Ruby Tran", email:"ruby.tran@gmail.com", ev:"m4", status:"confirmed", rsvp:"7 Jul, 9:40 am" },
  { name:"Leo Marchetti", email:"leo.m@gmail.com", ev:"m5", status:"confirmed", rsvp:"3 Jul, 6:12 pm" },
];
const PAYOUTS = [ { date:"30 Jun 2026", amount:"$612.40", status:"Paid" }, { date:"31 May 2026", amount:"$488.00", status:"Paid" } ];
const TXNS = [
  { who:"Mia Rossi", ev:"Beginner boxing", date:"12 Jul", amount:"$28.00", status:"Paid" },
  { who:"Tom Becker", ev:"Beginner boxing", date:"11 Jul", amount:"$28.00", status:"Paid" },
  { who:"Sam Okafor", ev:"Mobility & stretch", date:"9 Jul", amount:"$18.00", status:"Paid" },
  { who:"Ellen Park", ev:"Sunrise run club", date:"8 Jul", amount:"$0.00", status:"Refunded" },
];
const REV6 = [ ["Feb",210],["Mar",336],["Apr",302],["May",488],["Jun",612],["Jul",434] ];
const evName = (id)=>{ const e=MEV.find(x=>x.id===id); return e?e.name:""; };

/* ---------------- shared bits ---------------- */
const Eyebrow = ({children,style={}}) => <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-sans)",fontSize:12,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"var(--purple-600)",...style}}><span style={{width:18,height:1.5,background:"var(--purple-400)",flex:"none"}}/>{children}</div>;
function PageHead({ eyebrow, title, sub, web, action }) {
  return <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
    <div style={{minWidth:0,display:"flex",flexDirection:"column",gap:7}}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 style={{margin:0,fontSize:web?30:24,fontWeight:600,color:"var(--text-strong)",letterSpacing:"-.01em",lineHeight:1.15}}>{title}</h1>
      {sub&&<p style={{margin:0,fontSize:14,color:"var(--text-muted)",lineHeight:1.5,maxWidth:560}}>{sub}</p>}
    </div>
    {action}
  </div>;
}
const card = { background:"var(--white)",border:"1px solid var(--border-soft)",borderRadius:"var(--radius-lg)",boxShadow:"var(--shadow-sm)" };
const tint = { background:"var(--lavender-100)",border:"1px solid var(--lavender-200)",borderRadius:"var(--radius-lg)" };
function Stat({ label, value, note, hero }) {
  return <div style={{...(hero?{background:"var(--purple-600)",border:"1px solid var(--purple-600)",borderRadius:"var(--radius-lg)"}:card),padding:"16px 18px",display:"flex",flexDirection:"column",gap:5,minWidth:0}}>
    <span style={{fontSize:12,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:hero?"var(--lavender-300)":"var(--text-faint)"}}>{label}</span>
    <span style={{fontFamily:"var(--font-display)",fontSize:27,fontWeight:600,lineHeight:1.05,color:hero?"var(--cream)":"var(--text-strong)"}}>{value}</span>
    {note&&<span style={{fontSize:12,color:hero?"rgba(253,250,246,.75)":"var(--text-muted)"}}>{note}</span>}
  </div>;
}
function Meter({ num, den, hue="var(--purple-500)" }) {
  const pct = den>0?Math.min(100,Math.round(num/den*100)):0;
  return <div style={{display:"flex",flexDirection:"column",gap:5,minWidth:0}}>
    <span style={{fontSize:14,fontWeight:600,color:"var(--text-strong)",whiteSpace:"nowrap"}}>{num} / {den}</span>
    <span style={{display:"block",width:"100%",maxWidth:96,height:5,borderRadius:3,background:"var(--lavender-100)"}}><span style={{display:"block",width:pct+"%",height:"100%",borderRadius:3,background:hue}}/></span>
  </div>;
}
const STATUS_TONE = { live:["sage","Live"], ended:["cream","Ended"], pending:["amber","Pending"], cancelled:["coral","Cancelled"], confirmed:["lavender","Confirmed"], waitlist:["amber","Waitlist"] };
function StatusPill({ k }) { const [tone,label]=STATUS_TONE[k]||["cream",k]; return <Badge tone={tone}>{label}</Badge>; }
function Chips({ value, onChange, options }) {
  return <div className="ckRail" style={{display:"flex",gap:7,overflowX:"auto"}}>
    {options.map(([k,label])=><Tag key={k} selected={value===k} onClick={()=>onChange(k)} style={{height:30,padding:"0 13px",fontSize:12.5,flex:"none"}}>{label}</Tag>)}
  </div>;
}
function Empty({ icon="calendar", title, body, cta }) {
  return <div style={{...tint,padding:"30px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:9,textAlign:"center"}}>
    <span style={{width:42,height:42,borderRadius:"50%",background:"var(--white)",display:"flex",alignItems:"center",justifyContent:"center"}}><I name={icon} size={20} w={1.9} color="var(--purple-600)"/></span>
    <span style={{fontFamily:"var(--font-display)",fontSize:16.5,fontWeight:600,color:"var(--text-strong)"}}>{title}</span>
    {body&&<span style={{fontSize:13.5,color:"var(--text-body)",lineHeight:1.5,maxWidth:420}}>{body}</span>}
    {cta}
  </div>;
}

/* ---------------- portal shell: sidebar (web) / pill rail (mobile) ---------------- */
const NAVI = [ ["dash","Dashboard","home"], ["events","Events & venues","calendar"], ["bookings","Bookings","users"], ["finances","Finances","ticket"], ["settings","Settings","settings"] ];
function SideNav({ page, go, web, counts, createEvent }) {
  if(!web) return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:11}}>
      <AV name={BIZ.name} variant="initials" size={40}/>
      <div style={{minWidth:0}}>
        <div style={{fontFamily:"var(--font-display)",fontSize:15,fontWeight:600,color:"var(--text-strong)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{BIZ.name}</div>
        <div style={{fontSize:11.5,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--purple-600)"}}>Merchant portal</div>
      </div>
    </div>
    <Chips value={page} onChange={go} options={NAVI.map(([k,l])=>[k,l])}/>
  </div>;
  return <div style={{...card,flex:"none",width:224,alignSelf:"flex-start",position:"sticky",top:88,padding:14,display:"flex",flexDirection:"column",gap:4}}>
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 6px 12px"}}>
      <AV name={BIZ.name} variant="initials" size={38}/>
      <div style={{minWidth:0}}>
        <div style={{fontFamily:"var(--font-display)",fontSize:13.5,fontWeight:600,color:"var(--text-strong)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{BIZ.name}</div>
        <div style={{fontSize:10.5,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--purple-600)"}}>Merchant portal</div>
      </div>
    </div>
    {NAVI.map(([k,label,ic])=>{ const on=page===k;
      return <button key={k} onClick={()=>go(k)} style={{display:"flex",alignItems:"center",gap:11,width:"100%",border:"none",cursor:"pointer",textAlign:"left",borderRadius:12,padding:"0 12px",minHeight:42,background:on?"var(--purple-600)":"transparent",color:on?"var(--cream)":"var(--text-body)",fontFamily:"var(--font-sans)",fontSize:14,fontWeight:on?600:500,transition:"background .13s"}}
        onMouseEnter={(e)=>{if(!on)e.currentTarget.style.background="var(--surface-tint)";}} onMouseLeave={(e)=>{if(!on)e.currentTarget.style.background="transparent";}}>
        <I name={ic} size={17} w={1.9} color={on?"var(--cream)":"var(--text-muted)"}/>
        <span style={{flex:1}}>{label}</span>
        {k==="events"&&counts.events>0&&<span style={{flex:"none",minWidth:20,height:20,padding:"0 6px",borderRadius:10,background:on?"rgba(253,250,246,.2)":"var(--lavender-100)",color:on?"var(--cream)":"var(--purple-700)",fontSize:11.5,fontWeight:700,lineHeight:"20px",textAlign:"center",boxSizing:"border-box"}}>{counts.events}</span>}
      </button>;})}
    <div style={{height:1,background:"var(--border-soft)",margin:"8px 4px"}}/>
    <Btn size="sm" full icon="plus" onClick={createEvent}>Create event</Btn>
  </div>;
}

/* ---------------- setup checklist (dashboard, new merchants) ---------------- */
function SetupBanner({ web, onConnect }) {
  const steps = [ ["Business approved",true], ["Connect payments",false], ["Create your first event",false] ];
  const done = steps.filter(s=>s[1]).length;
  return <div style={{...tint,padding:web?"18px 22px":"16px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:0}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--purple-700)"}}><SP size={13} big="var(--purple-600)" small="var(--purple-400)"/>Finish setting up · {done}/{steps.length}</span>
        <span style={{fontSize:14,fontWeight:600,color:"var(--text-strong)"}}>Connect payments to start publishing paid events.</span>
      </div>
      <Btn size="sm" onClick={onConnect}>Connect payments</Btn>
    </div>
    <span style={{display:"block",height:6,borderRadius:3,background:"var(--white)"}}><span style={{display:"block",width:(done/steps.length*100)+"%",height:"100%",borderRadius:3,background:"var(--purple-500)"}}/></span>
    <div style={{display:"grid",gridTemplateColumns:web?"repeat(3,1fr)":"1fr",gap:8}}>
      {steps.map(([label,ok])=><span key={label} style={{display:"flex",alignItems:"center",gap:8,background:"var(--white)",borderRadius:"var(--radius-md)",padding:"9px 12px",fontSize:13,fontWeight:500,color:ok?"var(--text-strong)":"var(--text-muted)"}}>
        <span style={{flex:"none",width:19,height:19,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",background:ok?"var(--sage)":"var(--lavender-100)"}}>{ok?<I name="check" size={12} w={2.6} color="#fff"/>:<span style={{width:6,height:6,borderRadius:"50%",background:"var(--purple-400)"}}/>}</span>{label}</span>)}
    </div>
  </div>;
}

/* ---------------- hosting calendar (July 2026, Mon-first) ---------------- */
function HostCal({ web, events }) {
  const cells=[]; for(let d=29;d<=30;d++)cells.push({d,mute:true}); for(let d=1;d<=31;d++)cells.push({d}); for(let d=1;d<=2;d++)cells.push({d,mute:true,next:true});
  const byDay={}; events.forEach(e=>{ (byDay[e.day]=byDay[e.day]||[]).push(e); });
  const booked=events.reduce((s,e)=>s+e.confirmed,0), capT=events.reduce((s,e)=>s+e.cap,0);
  return <div style={{...card,overflow:"hidden"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:web?"16px 20px":"14px 16px",flexWrap:"wrap"}}>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontSize:11.5,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--text-faint)"}}>Hosting calendar</span>
        <span style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:600,color:"var(--text-strong)"}}>July 2026</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <Badge tone="lavender">{events.length} events · {booked}/{capT} booked</Badge>
        <Btn size="sm" variant="ghost" icon="chevL"> </Btn><Btn size="sm" variant="secondary">Today</Btn><Btn size="sm" variant="ghost" icon="chevR"> </Btn>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderTop:"1px solid var(--border-soft)"}}>
      {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><div key={d} style={{padding:"8px 8px",fontSize:11.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--text-faint)",background:"var(--surface-tint)",borderBottom:"1px solid var(--border-soft)",textAlign:web?"left":"center"}}>{web?d:d[0]}</div>)}
      {cells.map((c,i)=>{ const evs=(!c.mute&&byDay[c.d])||[]; const today=!c.mute&&c.d===14;
        return <div key={i} style={{minHeight:web?76:52,padding:web?"7px 8px":"5px 4px",borderBottom:i<cells.length-7?"1px solid var(--border-soft)":"none",borderRight:(i+1)%7?"1px solid var(--border-soft)":"none",background:c.mute?"var(--surface-tint)":"var(--white)",display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
          <span style={{alignSelf:web?"flex-start":"center",fontSize:12,fontWeight:600,color:c.mute?"var(--text-faint)":"var(--text-body)",...(today?{background:"var(--purple-600)",color:"var(--cream)",width:22,height:22,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center"}:{})}}>{c.d}</span>
          {evs.map(e=>{ const past=e.status==="ended";
            return web
              ? <span key={e.id} style={{display:"flex",flexDirection:"column",gap:1,background:past?"var(--surface-tint)":"var(--lavender-100)",border:"1px solid "+(past?"var(--border-soft)":"var(--lavender-200)"),borderRadius:8,padding:"4px 7px",minWidth:0}}>
                  <span style={{fontSize:11.5,fontWeight:600,color:past?"var(--text-muted)":"var(--purple-800)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</span>
                  <span style={{fontSize:11,color:past?"var(--text-faint)":"var(--purple-700)"}}>{e.confirmed}/{e.cap}{past?" · ended":""}</span>
                </span>
              : <span key={e.id} style={{alignSelf:"center",width:7,height:7,borderRadius:"50%",background:past?"var(--border-mid)":"var(--purple-500)"}}/>;})}
        </div>;})}
    </div>
  </div>;
}

/* ---------------- page: dashboard ---------------- */
function MDash({ web, fresh, go, createEvent }) {
  const upcoming = fresh?[]:MEV.filter(e=>e.status==="live");
  const confirmed = (fresh?MEV.filter(e=>e.status==="ended"):MEV).reduce((s,e)=>s+e.confirmed,0);
  const liveCap = upcoming.reduce((s,e)=>s+e.cap,0), liveConf = upcoming.reduce((s,e)=>s+e.confirmed,0);
  return <div style={{display:"flex",flexDirection:"column",gap:web?26:20}} data-screen-label="Merchant · Dashboard">
    {fresh&&<SetupBanner web={web} onConnect={()=>go("finances")}/>}
    <PageHead web={web} eyebrow="Overview" title="Your hosting dashboard." sub="Bookings and revenue across all your events, plus the month's calendar below." action={<Btn size="sm" icon="plus" onClick={createEvent}>Create event</Btn>}/>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Eyebrow style={{color:"var(--text-faint)"}}>July at a glance</Eyebrow>
      <div style={{display:"grid",gridTemplateColumns:web?"repeat(4,1fr)":"repeat(2,1fr)",gap:12}}>
        <Stat hero label="Upcoming" value={String(upcoming.length)} note={fresh?"none scheduled yet":"next: Wed 15 Jul"}/>
        <Stat label="Confirmed RSVPs" value={String(confirmed)} note="this month"/>
        <Stat label="Fill rate" value={liveCap?Math.round(liveConf/liveCap*100)+"%":"-"} note={liveCap?"upcoming events":"no upcoming events"}/>
        <Stat label="Revenue" value={fresh?"$0":"$434"} note={fresh?"free events so far":"July · paid events"}/>
      </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <Eyebrow style={{color:"var(--text-faint)"}}>Your events</Eyebrow>
        <Btn size="sm" variant="ghost" onClick={()=>go("events")}>View all events</Btn>
      </div>
      {upcoming.length===0
        ? <Empty title="No upcoming events." body="Your past events are in the Events tab. Ready for the next one?" cta={<Btn size="sm" icon="plus" onClick={createEvent}>Create event</Btn>}/>
        : <div style={{display:"grid",gridTemplateColumns:web?"repeat(3,1fr)":"1fr",gap:12}}>
            {upcoming.map(e=><div key={e.id} style={{...card,padding:16,display:"flex",flexDirection:"column",gap:9}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <span style={{fontFamily:"var(--font-display)",fontSize:15.5,fontWeight:600,color:"var(--text-strong)",lineHeight:1.25}}>{e.name}</span>
                <StatusPill k={e.status}/>
              </div>
              <span style={{fontSize:12.5,color:"var(--text-muted)"}}>{e.when} · {e.venue}, {e.suburb}</span>
              <Meter num={e.confirmed} den={e.cap} hue={e.confirmed/e.cap>0.85?"var(--coral)":"var(--purple-500)"}/>
            </div>)}
          </div>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Eyebrow style={{color:"var(--text-faint)"}}>Calendar</Eyebrow>
      <HostCal web={web} events={fresh?MEV.filter(e=>e.status==="ended"):MEV}/>
    </div>
  </div>;
}

/* ---------------- page: events & venues ---------------- */
function MEvents({ web, createEvent }) {
  const [q,setQ]=uS(""); const [f,setF]=uS("all");
  const rows = MEV.filter(e=>(f==="all"||e.status===f)&&e.name.toLowerCase().includes(q.toLowerCase()));
  return <div style={{display:"flex",flexDirection:"column",gap:web?26:20}} data-screen-label="Merchant · Events & venues">
    <PageHead web={web} eyebrow="My events" title="Events & venues." sub="Filter by status; open any row to manage attendees, edit, or cancel." action={<Btn size="sm" icon="plus" onClick={createEvent}>Create event</Btn>}/>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:web?"0 1 280px":"1 1 100%",display:"flex",alignItems:"center",gap:9,height:40,padding:"0 13px",background:"var(--white)",border:"1px solid var(--border-mid)",borderRadius:"var(--radius-pill)"}}>
          <I name="search" size={16} w={2} color="var(--text-muted)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search events" style={{flex:1,minWidth:0,border:"none",outline:"none",background:"none",fontFamily:"var(--font-sans)",fontSize:13.5,color:"var(--text-strong)"}}/>
        </div>
        <Chips value={f} onChange={setF} options={[["all","All"],["live","Live"],["pending","Pending"],["cancelled","Cancelled"],["ended","Past"]]}/>
      </div>
      {web
        ? <div style={{...card,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2.2fr 1.6fr 1fr .8fr .9fr",gap:14,padding:"11px 20px",background:"var(--surface-tint)",borderBottom:"1px solid var(--border-soft)",fontSize:11.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)"}}>
              <span>Event</span><span>When</span><span>Confirmed</span><span>Waitlist</span><span>Status</span>
            </div>
            {rows.map((e,i)=><div key={e.id} style={{display:"grid",gridTemplateColumns:"2.2fr 1.6fr 1fr .8fr .9fr",gap:14,alignItems:"center",padding:"14px 20px",borderBottom:i<rows.length-1?"1px solid var(--border-soft)":"none",cursor:"pointer"}}
              onMouseEnter={(ev)=>ev.currentTarget.style.background="var(--surface-tint)"} onMouseLeave={(ev)=>ev.currentTarget.style.background="transparent"}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14.5,fontWeight:600,color:"var(--text-strong)"}}>{e.name}</div>
                <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>{e.venue}, {e.suburb} · {e.price?("$"+e.price):"Free"}</div>
              </div>
              <span style={{fontSize:13,color:"var(--text-body)"}}>{e.when}</span>
              <Meter num={e.confirmed} den={e.cap}/>
              <span style={{fontSize:13.5,color:e.wait?"var(--text-strong)":"var(--text-faint)",fontWeight:e.wait?600:400}}>{e.wait||"-"}</span>
              <span><StatusPill k={e.status}/></span>
            </div>)}
            {rows.length===0&&<div style={{padding:"26px 20px",fontSize:13.5,color:"var(--text-muted)"}}>No events match - clear the search or filters.</div>}
          </div>
        : <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {rows.map(e=><div key={e.id} style={{...card,padding:15,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                <span style={{fontFamily:"var(--font-display)",fontSize:15,fontWeight:600,color:"var(--text-strong)"}}>{e.name}</span><StatusPill k={e.status}/>
              </div>
              <span style={{fontSize:12.5,color:"var(--text-muted)"}}>{e.when} · {e.venue}, {e.suburb} · {e.price?("$"+e.price):"Free"}{e.wait?` · ${e.wait} waitlisted`:""}</span>
              <Meter num={e.confirmed} den={e.cap}/>
            </div>)}
          </div>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Eyebrow style={{color:"var(--text-faint)"}}>Venues</Eyebrow>
      <p style={{margin:0,fontSize:13.5,color:"var(--text-muted)"}}>Distinct venues across your events - capacity and floor plans land with venue management.</p>
      <div style={{display:"grid",gridTemplateColumns:web?"repeat(3,1fr)":"1fr",gap:12}}>
        {VENUES.map(v=><div key={v.name} style={{...card,padding:16,display:"flex",flexDirection:"column",gap:6}}>
          <span style={{fontSize:11.5,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:"var(--text-faint)"}}>Venue</span>
          <span style={{fontFamily:"var(--font-display)",fontSize:17,fontWeight:600,color:"var(--text-strong)"}}>{v.name}</span>
          <span style={{fontSize:12.5,color:"var(--text-muted)"}}>{v.suburb}</span>
          <span><Badge tone="lavender">{v.events} {v.events===1?"event":"events"}</Badge></span>
        </div>)}
      </div>
    </div>
  </div>;
}

/* ---------------- page: bookings ---------------- */
function MBookings({ web }) {
  const [q,setQ]=uS(""); const [st,setSt]=uS("all"); const [evF,setEvF]=uS("all");
  const [checked,setChecked]=uS(()=>new Set(["Ruby Tran"]));
  const toggle=(n)=>setChecked(s=>{const x=new Set(s); x.has(n)?x.delete(n):x.add(n); return x;});
  const rows = ATT.filter(a=>(st==="all"||a.status===st)&&(evF==="all"||a.ev===evF)&&((a.name+a.email).toLowerCase().includes(q.toLowerCase())));
  const summary = MEV.map(e=>({ e, c:ATT.filter(a=>a.ev===e.id&&a.status==="confirmed").length+(e.confirmed-ATT.filter(a=>a.ev===e.id&&a.status==="confirmed").length), w:e.wait, x:ATT.filter(a=>a.ev===e.id&&a.status==="cancelled").length }));
  const canCheck=(a)=>{ const e=MEV.find(x=>x.id===a.ev); return e&&e.status==="ended"===false?false:true; };
  return <div style={{display:"flex",flexDirection:"column",gap:web?26:20}} data-screen-label="Merchant · Bookings">
    <PageHead web={web} eyebrow="Bookings" title="Everyone booked across your events." sub="Per-event counts up top; search, check in, or export the full door list below." action={<Btn size="sm" variant="secondary" icon="share">Export CSV</Btn>}/>
    <div style={{display:"grid",gridTemplateColumns:web?"repeat(2,1fr)":"1fr",gap:10}}>
      {summary.map(({e,w,x})=><div key={e.id} style={{...card,padding:"14px 17px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 150px",minWidth:0}}>
          <div style={{fontSize:11.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)"}}>Event</div>
          <div style={{fontFamily:"var(--font-display)",fontSize:15.5,fontWeight:600,color:"var(--text-strong)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <StatusPill k={e.status}/>
          <Badge tone="lavender">{e.confirmed} confirmed</Badge>
          {w>0&&<Badge tone="amber">{w} waitlist</Badge>}
          {x>0&&<Badge tone="cream">{x} cancelled</Badge>}
        </div>
      </div>)}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Eyebrow style={{color:"var(--text-faint)"}}>All attendees</Eyebrow>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:web?"0 1 260px":"1 1 100%",display:"flex",alignItems:"center",gap:9,height:40,padding:"0 13px",background:"var(--white)",border:"1px solid var(--border-mid)",borderRadius:"var(--radius-pill)"}}>
          <I name="search" size={16} w={2} color="var(--text-muted)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or email" style={{flex:1,minWidth:0,border:"none",outline:"none",background:"none",fontFamily:"var(--font-sans)",fontSize:13.5,color:"var(--text-strong)"}}/>
        </div>
        <Chips value={st} onChange={setSt} options={[["all","All statuses"],["confirmed","Confirmed"],["waitlist","Waitlist"],["cancelled","Cancelled"]]}/>
        {web&&<Chips value={evF} onChange={setEvF} options={[["all","All events"],...MEV.map(e=>[e.id,e.name])]}/>}
      </div>
      {web
        ? <div style={{...card,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1.4fr 1.8fr 1.4fr 1fr 1.1fr .9fr",gap:14,padding:"11px 20px",background:"var(--surface-tint)",borderBottom:"1px solid var(--border-soft)",fontSize:11.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)"}}>
              <span>Name</span><span>Email</span><span>Event</span><span>Status</span><span>RSVP</span><span>Check-in</span>
            </div>
            {rows.map((a,i)=><div key={a.name} style={{display:"grid",gridTemplateColumns:"1.4fr 1.8fr 1.4fr 1fr 1.1fr .9fr",gap:14,alignItems:"center",padding:"12px 20px",borderBottom:i<rows.length-1?"1px solid var(--border-soft)":"none"}}>
              <span style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}><AV name={a.name} variant="initials" size={30}/><span style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</span></span>
              <span style={{fontSize:12.5,color:"var(--text-muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.email}</span>
              <span style={{fontSize:12.5,color:"var(--text-body)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{evName(a.ev)}</span>
              <span><StatusPill k={a.status}/></span>
              <span style={{fontSize:12.5,color:"var(--text-muted)"}}>{a.rsvp}</span>
              <span>{a.status==="confirmed"
                ? (checked.has(a.name)
                  ? <Btn size="sm" variant="mutual" onClick={()=>toggle(a.name)}>In ✓</Btn>
                  : <Btn size="sm" variant="secondary" onClick={()=>toggle(a.name)}>Check in</Btn>)
                : <span style={{fontSize:12.5,color:"var(--text-faint)"}}>-</span>}</span>
            </div>)}
            {rows.length===0&&<div style={{padding:"26px 20px",fontSize:13.5,color:"var(--text-muted)"}}>No attendees match.</div>}
          </div>
        : <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {rows.map(a=><div key={a.name} style={{...card,padding:14,display:"flex",alignItems:"center",gap:11}}>
              <AV name={a.name} variant="initials" size={38}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text-strong)"}}>{a.name}</div>
                <div style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{evName(a.ev)} · {a.rsvp}</div>
              </div>
              {a.status==="confirmed"
                ? (checked.has(a.name)?<Btn size="sm" variant="mutual" onClick={()=>toggle(a.name)}>In ✓</Btn>:<Btn size="sm" variant="secondary" onClick={()=>toggle(a.name)}>Check in</Btn>)
                : <StatusPill k={a.status}/>}
            </div>)}
          </div>}
    </div>
  </div>;
}

/* ---------------- page: finances ---------------- */
function MFinances({ web, fresh }) {
  const max=Math.max(...REV6.map(r=>r[1]));
  return <div style={{display:"flex",flexDirection:"column",gap:web?26:20}} data-screen-label="Merchant · Finances">
    <PageHead web={web} eyebrow="Finances" title="Payouts + revenue." sub="Paid events route through Stripe; free events never appear here." action={<Btn size="sm" variant="secondary" icon="share">Export CSV</Btn>}/>
    <div style={{...card,padding:web?"16px 20px":15,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <span style={{flex:"none",width:40,height:40,borderRadius:12,background:fresh?"var(--lavender-100)":"color-mix(in srgb,var(--sage) 14%,var(--white))",display:"flex",alignItems:"center",justifyContent:"center"}}><I name={fresh?"unlock":"check"} size={19} w={2} color={fresh?"var(--purple-600)":"var(--sage)"}/></span>
      <div style={{flex:1,minWidth:180}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:14.5,fontWeight:600,color:"var(--text-strong)"}}>Payouts</span>
          {fresh?<Badge tone="amber">Not set up</Badge>:<Badge tone="sage">Connected</Badge>}
        </div>
        <div style={{fontSize:13,color:"var(--text-muted)",marginTop:2}}>{fresh?"Connect a Stripe account to accept paid bookings and get paid out automatically.":"Stripe pays out monthly to your linked account ending in ··4021."}</div>
      </div>
      {fresh?<Btn size="sm">Connect Stripe</Btn>:<Btn size="sm" variant="ghost">Manage in Stripe</Btn>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:web?"repeat(4,1fr)":"repeat(2,1fr)",gap:12}}>
      <Stat hero label="Total" value={fresh?"$0":"$1,742"} note="all time"/>
      <Stat label="Paid out" value={fresh?"$0":"$1,434"} note="to your bank"/>
      <Stat label="Pending" value={fresh?"$0":"$308"} note="next payout · 31 Jul"/>
      <Stat label="Refunded" value={fresh?"$0":"$56"} note="all time"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:web?"1.4fr 1fr":"1fr",gap:12,alignItems:"stretch"}}>
      <div style={{...card,padding:web?"16px 20px":15,display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10}}>
          <span style={{fontSize:11.5,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:"var(--text-faint)"}}>Revenue · last 6 months</span>
          {!fresh&&<span style={{fontSize:12.5,fontWeight:600,color:"var(--sage)"}}>$2,382 paid</span>}
        </div>
        {fresh
          ? <p style={{margin:0,fontSize:13.5,color:"var(--text-muted)",lineHeight:1.5}}>No paid revenue yet - paid-event sales chart here once Stripe is connected.</p>
          : <div style={{display:"flex",alignItems:"flex-end",gap:web?14:8,height:110}}>
              {REV6.map(([m,v])=><div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:0}}>
                <span style={{fontSize:11.5,fontWeight:600,color:"var(--text-muted)"}}>${v}</span>
                <span style={{width:"100%",maxWidth:34,height:Math.max(6,Math.round(v/max*66)),borderRadius:"6px 6px 3px 3px",background:m==="Jul"?"var(--purple-600)":"var(--lavender-300)"}}/>
                <span style={{fontSize:11.5,color:"var(--text-faint)"}}>{m}</span>
              </div>)}
            </div>}
      </div>
      <div style={{...card,padding:web?"16px 20px":15,display:"flex",flexDirection:"column",gap:11}}>
        <span style={{fontSize:11.5,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:"var(--text-faint)"}}>Recent payouts</span>
        {fresh
          ? <p style={{margin:0,fontSize:13.5,color:"var(--text-muted)",lineHeight:1.5}}>No payouts yet - Stripe pays out monthly once you have a connected balance.</p>
          : PAYOUTS.map(p=><div key={p.date} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,paddingBottom:10,borderBottom:"1px solid var(--border-soft)"}}>
              <div><div style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)"}}>{p.amount}</div><div style={{fontSize:12,color:"var(--text-muted)"}}>{p.date}</div></div>
              <Badge tone="sage">{p.status}</Badge>
            </div>)}
      </div>
    </div>
    {fresh
      ? <Empty icon="ticket" title="Paid bookings will land here." body="Once someone pays for one of your Click-managed paid events, the charge shows up here and rolls into the totals above." cta={<Btn size="sm">Create a paid event</Btn>}/>
      : <div style={{...card,overflow:"hidden"}}>
          <div style={{padding:"13px 20px",borderBottom:"1px solid var(--border-soft)",fontSize:11.5,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:"var(--text-faint)"}}>Transactions · July</div>
          {TXNS.map((tx,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<TXNS.length-1?"1px solid var(--border-soft)":"none",flexWrap:"wrap"}}>
            <AV name={tx.who} variant="initials" size={30}/>
            <div style={{flex:"1 1 140px",minWidth:0}}>
              <div style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)"}}>{tx.who}</div>
              <div style={{fontSize:12,color:"var(--text-muted)"}}>{tx.ev} · {tx.date}</div>
            </div>
            <span style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)"}}>{tx.amount}</span>
            <Badge tone={tx.status==="Refunded"?"cream":"sage"}>{tx.status}</Badge>
          </div>)}
        </div>}
  </div>;
}

/* ---------------- page: settings ---------------- */
function MSettings({ web }) {
  const [faq,setFaq]=uS(-1);
  const FAQ=[
    ["How long does merchant verification take?","Most ABN-verified merchants are approved within 24 business hours. We may ask for a venue photo or insurance certificate for higher-risk categories."],
    ["Can I run free + paid events under the same profile?","Yes. Free events skip Stripe entirely; paid events route via Stripe Connect - set up under Finances."],
    ["What happens if I cancel an event?","All confirmed attendees are refunded automatically (paid events) and notified. Repeated cancellations show on your profile."],
  ];
  const Info=({label,value,badge})=><div style={{...card,padding:"14px 17px",display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
    <span style={{fontSize:11.5,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:"var(--text-faint)"}}>{label}</span>
    <span style={{display:"flex",alignItems:"center",gap:8,fontSize:14.5,fontWeight:600,color:"var(--text-strong)"}}>{value}{badge}</span>
  </div>;
  return <div style={{display:"flex",flexDirection:"column",gap:web?26:20}} data-screen-label="Merchant · Settings">
    <PageHead web={web} eyebrow="Settings" title="Profile, discounts & support." sub="Business details and payout account, promo codes, and answers when you need them."/>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Eyebrow style={{color:"var(--text-faint)"}}>Profile + payouts</Eyebrow>
      <div style={{display:"grid",gridTemplateColumns:web?"repeat(3,1fr)":"1fr",gap:12}}>
        <Info label="Business name" value={BIZ.name}/>
        <Info label="ABN" value={BIZ.abn}/>
        <Info label="Verification" value="Approved" badge={<Badge tone="sage">Verified</Badge>}/>
      </div>
      <div style={{...tint,padding:"13px 16px",fontSize:13,color:"var(--text-body)",lineHeight:1.5}}>Editing business name / website / ABN ships with merchant self-service. Today, email <b style={{fontWeight:600,color:"var(--purple-700)"}}>merchants@click.au</b> to update details.</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Eyebrow style={{color:"var(--text-faint)"}}>Discounts</Eyebrow>
      <div style={{...card,padding:"16px 18px",display:"flex",alignItems:"center",gap:13,flexWrap:"wrap"}}>
        <span style={{flex:"none",width:38,height:38,borderRadius:12,background:"var(--lavender-100)",display:"flex",alignItems:"center",justifyContent:"center"}}><I name="ticket" size={18} w={2} color="var(--purple-600)"/></span>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontSize:14,fontWeight:600,color:"var(--text-strong)"}}>Promo codes & comp tickets</div>
          <div style={{fontSize:12.5,color:"var(--text-muted)",marginTop:2}}>The code generator ships next. For now, share a paid-event link with comp guests and refund from Finances.</div>
        </div>
        <Btn size="sm" variant="secondary" disabled>Coming soon</Btn>
      </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Eyebrow style={{color:"var(--text-faint)"}}>Support</Eyebrow>
      <p style={{margin:0,fontSize:13.5,color:"var(--text-muted)"}}>Need a human? Email <b style={{fontWeight:600,color:"var(--purple-700)"}}>merchants@click.au</b> - we reply same business day.</p>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {FAQ.map(([qq,aa],i)=><div key={i} style={{...card,overflow:"hidden"}}>
          <button onClick={()=>setFaq(faq===i?-1:i)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,width:"100%",textAlign:"left",border:"none",background:"none",cursor:"pointer",padding:"14px 17px",fontFamily:"var(--font-display)",fontSize:14.5,fontWeight:600,color:"var(--text-strong)"}}>
            {qq}<span style={{display:"flex",transition:"transform .15s",transform:faq===i?"rotate(180deg)":"none"}}><I name="chevD" size={16} w={2} color="var(--text-muted)"/></span>
          </button>
          {faq===i&&<div style={{padding:"0 17px 15px",fontSize:13.5,color:"var(--text-body)",lineHeight:1.55}}>{aa}</div>}
        </div>)}
      </div>
    </div>
  </div>;
}

/* ---------------- portal root ---------------- */
function Portal({ web, fresh, createEvent }) {
  const [page,setPage]=uS("dash");
  const body = page==="events"?<MEvents web={web} createEvent={createEvent}/>:page==="bookings"?<MBookings web={web}/>:page==="finances"?<MFinances web={web} fresh={fresh}/>:page==="settings"?<MSettings web={web}/>:<MDash web={web} fresh={fresh} go={setPage} createEvent={createEvent}/>;
  return <div style={{maxWidth:"var(--container-max)",margin:"0 auto",padding:web?"8px 40px 48px":"16px 16px 40px",display:"flex",gap:web?26:0,flexDirection:web?"row":"column",alignItems:"flex-start"}}>
    <SideNav page={page} go={setPage} web={web} counts={{events:MEV.length}} createEvent={createEvent}/>
    <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:web?0:18,paddingTop:web?0:18,width:"100%"}}>{body}</div>
  </div>;
}

/* ---------------- become a host - 3-step application ---------------- */
const CATS = ["Career","Community","Creative","Fitness","Food","Games","Learning","Nightlife","Outdoors","Social","Sports","Wellness"];
function Apply({ web, done }) {
  const [step,setStep]=uS(0);
  const [cats,setCats]=uS(new Set(["Fitness"]));
  const [sent,setSent]=uS(false);
  const steps=["Business","Contact","Review"];
  const toggleCat=(c)=>setCats(s=>{const x=new Set(s); x.has(c)?x.delete(c):x.add(c); return x;});
  const Panel=({children,title})=><div style={{...card,padding:web?"26px 30px":"20px 17px",display:"flex",flexDirection:"column",gap:16}}>
    <h2 style={{margin:0,fontSize:20,fontWeight:600,color:"var(--text-strong)"}}>{title}</h2>{children}</div>;
  if(sent) return <div style={{maxWidth:560,margin:"0 auto",padding:web?"56px 24px":"36px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:14,textAlign:"center"}} data-screen-label="Merchant · Application sent">
    <span style={{width:56,height:56,borderRadius:"50%",background:"var(--lavender-100)",display:"flex",alignItems:"center",justifyContent:"center"}}><SP size={28} big="var(--purple-600)" small="var(--purple-400)"/></span>
    <h1 style={{margin:0,fontSize:web?30:24,fontWeight:600,color:"var(--text-strong)"}}>Application in - nice one.</h1>
    <p style={{margin:0,fontSize:14.5,color:"var(--text-body)",lineHeight:1.55,maxWidth:420}}>Most ABN-verified businesses are approved within 24 business hours. We'll email you the moment the portal unlocks.</p>
    <Btn onClick={done}>Preview the merchant portal</Btn>
  </div>;
  return <div style={{maxWidth:720,margin:"0 auto",padding:web?"28px 24px 56px":"18px 16px 40px",display:"flex",flexDirection:"column",gap:18}} data-screen-label="Merchant · Become a host">
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <span><Badge tone="lavender">Become a host</Badge></span>
      <h1 style={{margin:0,fontSize:web?32:25,fontWeight:600,color:"var(--text-strong)",letterSpacing:"-.01em"}}>Tell us about you.</h1>
      <p style={{margin:0,fontSize:14,color:"var(--text-muted)",lineHeight:1.5}}>Your application goes to review and unlocks the portal once approved.</p>
    </div>
    <div style={{...tint,padding:"12px 15px",display:"flex",gap:10,alignItems:"flex-start",fontSize:13,color:"var(--text-body)",lineHeight:1.5}}>
      <I name="info" size={16} w={2} color="var(--purple-600)" style={{marginTop:1}}/>
      <span>We're piloting in Sydney first. Outside Sydney? Apply anyway - we'll waitlist you and email when we launch in your city.</span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {steps.map((s,i)=><React.Fragment key={s}>
        {i>0&&<span style={{flex:1,height:1.5,background:i<=step?"var(--purple-400)":"var(--border-mid)"}}/>}
        <span style={{display:"inline-flex",alignItems:"center",gap:7}}>
          <span style={{width:24,height:24,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,background:i<step?"var(--sage)":i===step?"var(--purple-600)":"var(--white)",color:i<=step?"#fff":"var(--text-muted)",border:i>step?"1.5px solid var(--border-mid)":"none"}}>{i<step?<I name="check" size={12} w={2.8} color="#fff"/>:i+1}</span>
          {web&&<span style={{fontSize:12,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:i===step?"var(--purple-700)":"var(--text-faint)"}}>{s}</span>}
        </span>
      </React.Fragment>)}
    </div>
    {step===0&&<Panel title="Business details">
      <Field label="Business name *" placeholder="e.g. Inner West Fitness Mates"/>
      <Field label="Trading name (if different)" placeholder="Optional"/>
      <div style={{display:"grid",gridTemplateColumns:web?"1fr 1fr":"1fr",gap:14}}>
        <Field label="ABN (optional)" placeholder="11 222 333 444" hint="Speeds up verification."/>
        <Field label="ACN (optional)" placeholder="000 000 000"/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <span style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)"}}>Event categories you host * <span style={{fontWeight:500,color:"var(--text-muted)"}}>· {cats.size} selected</span></span>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {CATS.map(c=><Tag key={c} selected={cats.has(c)} onClick={()=>toggleCat(c)} style={{height:30,padding:"0 13px",fontSize:12.5}}>{c}</Tag>)}
        </div>
      </div>
    </Panel>}
    {step===1&&<Panel title="Contact & address">
      <div style={{display:"grid",gridTemplateColumns:web?"1fr 1fr":"1fr",gap:14}}>
        <Field label="Contact email *" placeholder="you@business.com.au" icon="mail"/>
        <Field label="Phone * (AU)" placeholder="0412 345 678" hint="Mobile, landline or 1300 - +61 is fine."/>
      </div>
      <Field label="Website (optional)" placeholder="https://www.yourbusiness.com.au"/>
      <Field label="Instagram (optional)" placeholder="@yourbusiness" hint="Any network you're on - handy for verifying hosts without formal documents."/>
      <Field label="Street address *" placeholder="Start typing - e.g. 42 Crown Street, Surry Hills" icon="pin" hint="Pick a suggestion and we'll fill suburb, state & postcode."/>
      <div style={{display:"grid",gridTemplateColumns:web?"2fr 1fr 1fr":"1fr",gap:14}}>
        <Field label="Suburb *" placeholder="Surry Hills"/><Field label="State *" placeholder="NSW"/><Field label="Postcode *" placeholder="2010"/>
      </div>
    </Panel>}
    {step===2&&<Panel title="Documents & review">
      <p style={{margin:0,fontSize:13.5,color:"var(--text-body)",lineHeight:1.55}}>Optional but speeds things up: public liability insurance, a venue photo, or anything that shows you run real events.</p>
      <div style={{border:"1.5px dashed var(--border-mid)",borderRadius:"var(--radius-lg)",padding:"26px 18px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,textAlign:"center"}}>
        <I name="share" size={22} w={1.9} color="var(--purple-600)"/>
        <span style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)"}}>Drop files here or browse</span>
        <span style={{fontSize:12,color:"var(--text-muted)"}}>PDF, JPG or PNG · up to 10 MB each</span>
      </div>
      <div style={{...tint,padding:"12px 15px",fontSize:13,color:"var(--text-body)",lineHeight:1.5}}>By applying you agree to the host terms: real venues, accurate capacity, and cancellations refund attendees automatically.</div>
    </Panel>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <Btn variant="ghost" onClick={()=>step>0&&setStep(step-1)} style={{visibility:step>0?"visible":"hidden"}}>Back</Btn>
      <span style={{fontSize:12,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)"}}>Step {step+1} of 3 · {steps[step]}</span>
      {step<2?<Btn onClick={()=>setStep(step+1)}>Next</Btn>:<Btn onClick={()=>setSent(true)}>Submit application</Btn>}
    </div>
  </div>;
}

window.ScreensMerch = { Portal, Apply };
})();
