(function(){
/* Click - app shell: responsive device frame, nav, flow state machine, Tweaks. */
const { useState:uS, useEffect:uE, useRef:uR, Icon:I, Logo:L, Cmark:CM, Avatar:AV, Spark:SP, SiteFooter:Footer } = window.CK;
const SA = window.ScreensA, SB = window.ScreensB, Mech = window.ScreensMech;
const { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle } = window;

const DEVICES = { phone:375, tablet:768, laptop:1024, desktop:1440 };
const TABS = [["home","Home","home"],["discover","Discover","compass"],["click","click","spark"],["saved","Events","calendar"],["profile","You","user"]];

/* ---------------- loading skeletons live in skeletons.jsx (window.ScreensSkel) ---------------- */
/* ---------------- bottom tab bar (phone) ---------------- */
function BottomNav({ tab, go }) {
  return <div style={{display:"flex",alignItems:"flex-end",borderTop:"1px solid var(--border-soft)",background:"var(--cream)",padding:"8px 6px 22px",flex:"none"}}>
    {TABS.map(([k,label,ic])=>{
      const on=tab===k, center=k==="click";
      if(center) return <button key={k} onClick={()=>go(k)} style={{flex:1,background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}}>
        <span style={{width:46,height:46,borderRadius:"50%",background:"var(--purple-600)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"var(--shadow-md)",marginTop:-14}}><span style={{display:"flex",transform:"translateY(-2.5px)"}}><SP size={24} big="var(--cream)" small="var(--cream)"/></span></span>
        <span style={{fontSize:10.5,fontWeight:on?700:600,color:on?"var(--purple-600)":"var(--ink-muted)"}}>{label}</span>
      </button>;
      return <button key={k} onClick={()=>go(k)} style={{flex:1,background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",color:on?"var(--purple-600)":"var(--ink-muted)",paddingBottom:2}}>
        <I name={ic} size={23} w={on?2.3:1.9}/>
        <span style={{fontSize:10.5,fontWeight:on?700:500}}>{label}</span>
      </button>;
    })}
  </div>;
}
/* ---------------- account menu (avatar dropdown) - ONE component, web popover + mobile sheet ----------------
   Tap (never hover) the avatar to open; grouped destinations + account actions; full keyboard + a11y.
   active = the current destination key so the menu can place you; onNav(key) routes + closes. */
const ACCT_GROUPS = [
  [["profile","Your profile","user"],["people","People","users"],["events","Your events","calendar"],["saved","Saved","bookmark"]],
  [["howitworks","How it works","help"],["settings","Account settings","settings"]],
  [["signout","Sign out","logout"]],
];
function AccountMenu({ web, open, onClose, active, onNav, returnFocus }) {
  const menuRef = uR(null);
  uE(()=>{ if(!open) return; const t=setTimeout(()=>{ const f=menuRef.current&&menuRef.current.querySelector('[role="menuitem"]'); f&&f.focus(); },20); return ()=>clearTimeout(t); },[open]);
  uE(()=>{ if(!open) return;
    const onKey=(e)=>{ if(e.key==="Escape"){ e.preventDefault(); onClose(); returnFocus&&returnFocus.current&&returnFocus.current.focus(); } };
    window.addEventListener("keydown",onKey); return ()=>window.removeEventListener("keydown",onKey);
  },[open]);
  if(!open) return null;
  const onArrow=(e)=>{
    if(e.key!=="ArrowDown"&&e.key!=="ArrowUp") return;
    e.preventDefault();
    const items=[...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const i=items.indexOf(document.activeElement);
    const next=e.key==="ArrowDown"?(i+1)%items.length:(i-1+items.length)%items.length;
    items[next]&&items[next].focus();
  };
  let idx=0;
  const Row=([k,label,icon])=>{
    const on=active===k;
    return <button key={k} role="menuitem" tabIndex={-1} className="ckAcctRow" onClick={()=>onNav(k)}
      style={{display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",border:"none",cursor:"pointer",background:on?"var(--lavender-100)":"transparent",borderRadius:12,padding:web?"0 12px":"0 14px",minHeight:web?44:48,fontFamily:"var(--font-sans)",fontSize:web?14.5:15,fontWeight:on?600:500,color:on?"var(--purple-800)":"var(--text-strong)",transition:"background-color .12s"}}
      onMouseEnter={(ev)=>{ if(!on) ev.currentTarget.style.background="var(--surface-tint)"; }}
      onMouseLeave={(ev)=>{ if(!on) ev.currentTarget.style.background="transparent"; }}>
      <I name={icon} size={18} w={1.9} color={on?"var(--purple-600)":"var(--text-muted)"}/>{label}</button>;
  };
  const styleTag=<style dangerouslySetInnerHTML={{__html:".ckAcctRow:focus-visible{outline:2px solid var(--purple-600);outline-offset:-2px}@keyframes ckAcctPop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes ckAcctSheet{from{transform:translateY(100%)}to{transform:none}}@media (prefers-reduced-motion: reduce){.ckAcctAnim{animation:none!important}}"}}/>;
  const Header=<div style={{display:"flex",alignItems:"center",gap:11,padding:web?"10px 12px 12px":"6px 14px 14px"}}>
    <AV name="Ava Mendez" size={web?42:44}/>
    <div style={{minWidth:0,flex:1}}>
      <div style={{fontFamily:"var(--font-display)",fontSize:15,fontWeight:600,color:"var(--text-strong)",lineHeight:1.25,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Signed in as Ava</div>
      <div style={{fontSize:12.5,color:"var(--text-muted)",lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>ava.mendez@email.com</div>
    </div>
  </div>;
  const hair=<div style={{height:1,background:"var(--border-soft)",margin:web?"6px 4px":"8px 6px"}}/>;
  const groups=ACCT_GROUPS.map((g,gi)=><React.Fragment key={gi}>{gi>0&&hair}{g.map(Row)}</React.Fragment>);

  if(web){
    return <React.Fragment>
      {styleTag}
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:40,background:"transparent"}}/>
      <div ref={menuRef} role="menu" aria-label="Account menu" onKeyDown={onArrow}
        className="ckAcctAnim"
        style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:41,width:300,background:"var(--white)",borderRadius:16,border:"1px solid var(--border-soft)",boxShadow:"0 18px 44px rgba(76,55,140,.18)",padding:8,animation:"ckAcctPop .14s cubic-bezier(.2,.7,.3,1) both"}}>
        {Header}{hair}{groups}
      </div>
    </React.Fragment>;
  }
  /* mobile - bottom sheet */
  return <React.Fragment>
    {styleTag}
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:60,background:"rgba(25,19,58,.34)"}} className="ckAcctAnim"/>
    <div ref={menuRef} role="menu" aria-label="Account menu" onKeyDown={onArrow}
      className="ckAcctAnim"
      style={{position:"fixed",left:0,right:0,bottom:0,zIndex:61,background:"var(--white)",borderTopLeftRadius:18,borderTopRightRadius:18,boxShadow:"0 -16px 44px rgba(25,19,58,.28)",padding:"8px 8px max(16px,env(safe-area-inset-bottom))",animation:"ckAcctSheet .18s cubic-bezier(.2,.7,.3,1) both"}}>
      <div style={{display:"flex",justifyContent:"center",padding:"6px 0 10px"}}><span style={{width:38,height:4,borderRadius:2,background:"var(--border-mid)"}}/></div>
      {Header}{hair}{groups}
    </div>
  </React.Fragment>;
}
function AvatarMenuTrigger({ web, size, active, onNav }) {
  const [open,setOpen]=uS(false);
  const btnRef=uR(null);
  const nav=(k)=>{ setOpen(false); onNav(k); };
  const onProfile=active==="profile";
  return <span style={{position:"relative",display:"flex"}}>
    <button ref={btnRef} onClick={()=>setOpen(o=>!o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
      style={{display:"inline-flex",alignItems:"center",gap:4,border:"none",background:"none",cursor:"pointer",borderRadius:"var(--radius-pill)",padding:0}}>
      <span style={{display:"flex",borderRadius:"50%",boxShadow:(onProfile||open)?"0 0 0 2.5px var(--purple-300)":"none"}}><AV name="Ava Mendez" size={size}/></span>
      <span style={{display:"flex",transition:"transform .15s",transform:open?"rotate(180deg)":"none"}}><I name="chevD" size={14} w={2} color="var(--text-muted)"/></span>
    </button>
    <AccountMenu web={web} open={open} onClose={()=>setOpen(false)} active={active} onNav={nav} returnFocus={btnRef}/>
  </span>;
}
/* ---------------- top nav (web) ---------------- */
function TopNav({ tab, go, notify, onBell, acctActive, onAccount }) {
  return <div style={{position:"sticky",top:0,zIndex:20,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 40px",background:"var(--cream)",borderBottom:"1px solid var(--border-soft)"}}>
    <span onClick={()=>go("home")} style={{cursor:"pointer"}}><L size={26}/></span>
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      {TABS.filter(t=>t[0]!=="profile").map(([k,label,ic])=>{const on=tab===k;return <button key={k} onClick={()=>go(k)} style={{display:"inline-flex",alignItems:"center",gap:7,padding:"9px 15px",borderRadius:"var(--radius-pill)",border:"none",cursor:"pointer",background:on?"var(--lavender-100)":"transparent",color:on?"var(--purple-700)":"var(--text-body)",fontFamily:"var(--font-sans)",fontSize:14.5,fontWeight:on?600:500}}>
        {k==="click"?<span style={{display:"inline-flex",transform:"translateY(-2px)",marginRight:-1}}><SP size={20} big="var(--purple-600)" small="var(--purple-400)"/></span>:<I name={ic} size={18} w={2}/>}{label}</button>;})}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <button onClick={onBell} aria-label="Notifications" style={{position:"relative",border:"none",background:"none",cursor:"pointer",width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <I name="bell" size={20} w={1.9} color="var(--text-body)"/>
        {notify>0&&(notify>1
          ? <span style={{position:"absolute",top:3,right:3,minWidth:16,height:16,padding:"0 4px",borderRadius:9,background:"var(--purple-600)",color:"var(--cream)",fontSize:10.5,fontWeight:700,lineHeight:"16px",textAlign:"center",boxSizing:"border-box",boxShadow:"0 0 0 2px var(--cream)"}}>{notify>9?"9+":notify}</span>
          : <span style={{position:"absolute",top:7,right:8,width:8,height:8,borderRadius:"50%",background:"var(--purple-600)",boxShadow:"0 0 0 2px var(--cream)"}}/>)}
      </button>
      <AvatarMenuTrigger web size={38} active={acctActive} onNav={onAccount}/>
    </div>
  </div>;
}

/* push-style MUTUAL NOTIFICATION (bell + locked copy) - fires when a mutual happens while away */
function MutualToast({ web, name, onOpen, onClose }) {
  return <div style={{position:"fixed",top:web?20:64,left:0,right:0,zIndex:64,display:"flex",justifyContent:"center",padding:"0 14px",pointerEvents:"none"}}>
    <style dangerouslySetInnerHTML={{__html:"@keyframes ckToast{0%{opacity:0;transform:translateY(-14px)}100%{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.ckToast{animation:none!important}}"}}/>
    <div className="ckToast" onClick={onOpen} style={{pointerEvents:"auto",cursor:"pointer",width:"100%",maxWidth:380,display:"flex",alignItems:"center",gap:12,background:"var(--cream)",border:"1px solid var(--lavender-300)",borderRadius:14,boxShadow:"0 16px 40px rgba(25,19,58,.22)",padding:"12px 14px",animation:"ckToast .4s cubic-bezier(.2,.7,.3,1) both"}}>
      <span style={{flex:"none",width:36,height:36,borderRadius:11,background:"var(--purple-600)",display:"flex",alignItems:"center",justifyContent:"center"}}><I name="bell" size={18} w={2} color="var(--cream)"/></span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)",lineHeight:1.3}}>It's mutual - you clicked with {(name||"").split(" ")[0]}. <span aria-hidden="true">✨</span></div>
        <div style={{fontSize:12,color:"var(--text-muted)",marginTop:1}}>Tap to see who · Click</div>
      </div>
      <button onClick={(ev)=>{ev.stopPropagation();onClose();}} aria-label="Dismiss" style={{flex:"none",border:"none",background:"none",cursor:"pointer",display:"flex",padding:4}}><I name="x" size={15} w={2.2} color="var(--text-muted)"/></button>
    </div>
  </div>;
}

/* ---------------- phone frame: mobile WEB (browser on a phone, not a native app) ---------------- */
function PhoneFrame({ children }) {
  return <div style={{width:399,height:812,background:"var(--cream)",borderRadius:46,boxShadow:"0 30px 80px rgba(25,19,58,.34),0 0 0 11px #0f0b22,0 0 0 12px #2a2350",overflow:"hidden",position:"relative",display:"flex",flexDirection:"column"}}>
    {/* mobile browser chrome */}
    <div style={{flex:"none",height:52,background:"#ECE6DC",borderBottom:"1px solid #E0D8CA",display:"flex",alignItems:"center",gap:11,padding:"0 14px 0 16px"}}>
      <div style={{flex:1,background:"var(--white)",borderRadius:"var(--radius-pill)",padding:"7px 14px",fontSize:12.5,color:"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}><I name="lock" size={12} w={2} color="var(--text-muted)"/>click.au</div>
      <span style={{display:"flex",flexDirection:"column",gap:3,flex:"none"}}>{[0,1,2].map(i=><i key={i} style={{width:18,height:2,borderRadius:2,background:"var(--text-muted)"}}/>)}</span>
    </div>
    {children}
  </div>;
}
/* ---------------- mobile web site nav (top, scrollable pills) ---------------- */
function MobileTopNav({ tab, go, notify, onBell, acctActive, onAccount }) {
  return <div style={{position:"sticky",top:0,zIndex:20,background:"var(--cream)",borderBottom:"1px solid var(--border-soft)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px"}}>
      <span onClick={()=>go("home")} style={{cursor:"pointer",display:"flex"}}><L size={23}/></span>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <button onClick={onBell} aria-label="Notifications" style={{position:"relative",border:"none",background:"none",cursor:"pointer",width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <I name="bell" size={20} w={1.9} color="var(--text-body)"/>
          {notify&&<span style={{position:"absolute",top:8,right:9,minWidth:7,height:7,borderRadius:"50%",background:"var(--purple-600)",boxShadow:"0 0 0 2px var(--cream)"}}/>}
        </button>
        <AvatarMenuTrigger web={false} size={36} active={acctActive} onNav={onAccount}/>
      </div>
    </div>
  </div>;
}
/* ---------------- browser frame (web) ---------------- */
function BrowserFrame({ children, width, scrollRef }) {
  return <div style={{width,height:824,background:"var(--cream)",borderRadius:16,boxShadow:"0 30px 80px rgba(25,19,58,.28)",overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid var(--border-mid)"}}>
    <div style={{height:46,flex:"none",background:"#ECE6DC",display:"flex",alignItems:"center",gap:14,padding:"0 16px",borderBottom:"1px solid #E0D8CA"}}>
      <div style={{display:"flex",gap:7}}>{["#E66A5A","#E9B44C","#6BBF73"].map(c=><i key={c} style={{width:11,height:11,borderRadius:"50%",background:c}}/>)}</div>
      <div style={{flex:1,maxWidth:340,background:"var(--white)",borderRadius:"var(--radius-pill)",padding:"6px 16px",fontSize:12.5,color:"var(--text-muted)",display:"flex",alignItems:"center",gap:8}}><I name="lock" size={12} w={2} color="var(--text-muted)"/>click.au</div>
    </div>
    <div ref={scrollRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>{children}</div>
  </div>;
}

/* ---------------- notifications: data + panel (positive-only, grouped, read/unread) ---------------- */
const NOTIFS = [
  { id:"n1", group:"today",   kind:"mutual",    name:"Mia R.",  spark:true,  unread:true,  time:"2m",        text:"You clicked with Mia - suggest a plan", action:"coord" },
  { id:"n2", group:"today",   kind:"proposal",  name:"Mia R.",  unread:true,  time:"18m",       text:"Mia suggested Greenhouse terrarium - you in?", action:"coord" },
  { id:"n3", group:"today",   kind:"waitlist",  icon:"clock",  unread:true,  time:"40m",       text:"A spot opened at Wheel throwing - you've got 30 minutes", action:"event:ev6" },
  { id:"n4", group:"today",   kind:"both",      name:"Tom B.",  spark:true,  unread:false, time:"3h",        text:"You're both going to Greenhouse terrarium", action:"event:ev2" },
  { id:"n5", group:"earlier", kind:"postevent", icon:"users",  unread:false, time:"Yesterday", text:"Good night at Pasta from scratch? Did you click with anyone?", action:"window" },
  { id:"n6", group:"earlier", kind:"reminder",  icon:"calendar",unread:false, time:"Yesterday", text:"Wheel throwing is tomorrow, 6:30pm - venue's unlocked", action:"event:ev6" },
];

function NotifRow({ n, unread, onClick }) {
  const lead = n.name
    ? <span style={{position:"relative",flex:"none"}}><AV name={n.name} size={38}/>{n.spark&&<span style={{position:"absolute",bottom:-2,right:-3,width:18,height:18,borderRadius:"50%",background:"var(--cream)",display:"flex",alignItems:"center",justifyContent:"center"}}><SP size={13}/></span>}</span>
    : <span style={{flex:"none",width:38,height:38,borderRadius:"50%",background:"var(--lavender-100)",display:"flex",alignItems:"center",justifyContent:"center"}}><I name={n.icon||"bell"} size={18} w={1.9} color="var(--purple-600)"/></span>;
  return <button onClick={onClick} style={{display:"flex",gap:12,alignItems:"flex-start",width:"100%",textAlign:"left",border:"none",borderBottom:"1px solid var(--border-soft)",cursor:"pointer",padding:"13px 18px",background:unread?"var(--lavender-100)":"transparent"}}>
    {lead}
    <span style={{flex:1,minWidth:0}}>
      <span style={{display:"block",fontSize:14,color:"var(--text-strong)",lineHeight:1.42,fontWeight:unread?600:500}}>{n.text}</span>
      <span style={{display:"block",fontSize:12,color:"var(--text-faint)",marginTop:3}}>{n.time}</span>
    </span>
    {unread&&<span style={{flex:"none",width:8,height:8,borderRadius:"50%",background:"var(--purple-600)",marginTop:7}}/>}
  </button>;
}

function NotifPanel({ web, readSet, onClose, onRow, onMarkAll }) {
  const isUnread=(n)=>n.unread&&!readSet.has(n.id);
  const groups=[["Today","today"],["Earlier","earlier"]];
  const anyLeft=NOTIFS.length>0;
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:58,background:web?"transparent":"rgba(28,24,48,.4)",display:"flex",alignItems:web?"flex-start":"flex-end",justifyContent:web?"flex-end":"center"}}>
    <style dangerouslySetInnerHTML={{__html:"@keyframes ckNotif{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:none}}@keyframes ckSheet{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.ckNotif,.ckSheet{animation:none!important}}"}}/>
    <div className={web?"ckNotif":"ckSheet"} onClick={e=>e.stopPropagation()} style={{
      ...(web
        ? {margin:"56px 40px 0 0",width:374,borderRadius:18,maxHeight:"74vh"}
        : {width:"100%",borderRadius:"20px 20px 0 0",maxHeight:"82vh"}),
      background:"var(--cream)",boxShadow:"0 24px 60px rgba(25,19,58,.28)",border:"1px solid var(--border-soft)",overflow:"hidden",display:"flex",flexDirection:"column",animation:web?"ckNotif .22s ease both":"ckSheet .3s cubic-bezier(.2,.7,.3,1) both"}}>
      {!web&&<div style={{display:"flex",justifyContent:"center",padding:"9px 0 3px"}}><span style={{width:38,height:4,borderRadius:4,background:"var(--border-mid)"}}/></div>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:web?"15px 18px":"10px 18px 13px",borderBottom:"1px solid var(--border-soft)"}}>
        <span style={{fontFamily:"var(--font-display)",fontSize:16,fontWeight:600,color:"var(--text-strong)"}}>Notifications</span>
        {anyLeft&&<button onClick={onMarkAll} style={{border:"none",background:"none",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,color:"var(--purple-600)",padding:"2px 0"}}>Mark all as read</button>}
      </div>
      <div style={{overflowY:"auto"}}>
        {!anyLeft
          ? <div style={{padding:"44px 26px",textAlign:"center"}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><span style={{width:42,height:42,borderRadius:"50%",background:"var(--surface-tint)",display:"flex",alignItems:"center",justifyContent:"center"}}><I name="bell" size={20} w={1.8} color="var(--text-muted)"/></span></div>
              <p style={{margin:0,fontSize:14.5,color:"var(--text-body)"}}>You're all caught up.</p>
            </div>
          : groups.map(([label,key])=>{
              const rows=NOTIFS.filter(n=>n.group===key);
              if(rows.length===0) return null;
              return <div key={key}>
                <div style={{padding:"11px 18px 6px",fontSize:11.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)"}}>{label}</div>
                {rows.map(n=><NotifRow key={n.id} n={n} unread={isUnread(n)} onClick={()=>onRow(n)}/>)}
              </div>;
            })}
      </div>
    </div>
  </div>;
}

/* ---------------- root app ---------------- */
function Root() {
  const [t,setTweak]=useTweaks(TWEAK_DEFAULTS);
  const [device,setDevice]=uS("phone");
  const [view,setView]=uS("landing");      // landing | auth | howitworks | onboarding | app
  const [authStart,setAuthStart]=uS("signup");
  const [tab,setTab]=uS("home");
  const [screen,setScreen]=uS(null);        // null | event | window | suggest | coordinate | loading
  const [ev,setEv]=uS(window.DATA.byId("ev1"));
  const [booked,setBooked]=uS(false);
  const [waitlist,setWaitlist]=uS(false);
  const [picked,setPicked]=uS([]);
  const [winState,setWinState]=uS("locked");
  const [winMode,setWinMode]=uS("default");   // default | empty | closed | ineligible
  const [coordStep,setCoordStep]=uS("suggest");
  const [coordOpen,setCoordOpen]=uS(false);
  const [planWith,setPlanWith]=uS(null);     // drawer→page→drawer bridge: name we're locking a plan with
  const [coordReturn,setCoordReturn]=uS(null); // step to return to in the drawer after the booking
  const [mutualOpen,setMutualOpen]=uS(false);
  const [mutualToast,setMutualToast]=uS(false);
  const [mName,setMName]=uS("Mia R.");
  const [notifOpen,setNotifOpen]=uS(false);
  const [quizOpen,setQuizOpen]=uS(false);
  const [quizDone,setQuizDone]=uS(false);
  const [loadKind,setLoadKind]=uS("dashboard");   // which page's loading skeleton to show
  const [settingsSection,setSettingsSection]=uS("edit");
  const [myEventsTab,setMyEventsTab]=uS("upcoming");
  const [notifSeen,setNotifSeen]=uS(false);
  const [notifRead,setNotifRead]=uS(()=>new Set());
  const [scale,setScale]=uS(1);
  const [stripH,setStripH]=uS(64);
  const stageRef=uR(null);
  const stripRef=uR(null);
  const scrollRef=uR(null);

  const web=device!=="phone";
  const W=DEVICES[device];
  const frameW=web?W:399, frameH=web?824:812;
  const visible=t.visibility!=="off";


  uE(()=>{
    const fit=()=>{ const vw=window.innerWidth, vh=window.innerHeight; if(vw<200||vh<200) return; const sh=stripRef.current?stripRef.current.offsetHeight:64; setStripH(sh); setScale(Math.max(0.2,Math.min(1,(vw-48)/frameW,(vh-sh-48)/frameH))); };
    fit(); const raf=requestAnimationFrame(fit); const tid=setTimeout(fit,250);
    window.addEventListener("resize",fit);
    return ()=>{ window.removeEventListener("resize",fit); cancelAnimationFrame(raf); clearTimeout(tid); };
  },[frameW,frameH]);

  /* every navigation (tab / screen / view change) lands at the TOP of the page */
  uE(()=>{ const el=scrollRef.current; if(el) el.scrollTop=0; },[view,tab,screen,authStart]);

  /* ---- navigation helpers ---- */
  const open=(e)=>{ const bk=!!(e&&window.DATA.BOOKINGS.includes(e.id)); const fl=!!(e&&(e.full||e.status==="soldout"||(e.cap!=null&&e.count>=e.cap))); setEv(e); setBooked(bk); setWaitlist(!bk&&fl); setPlanWith(null); setCoordReturn(null); setScreen("event"); };
  /* drawer RSVP deep-link → Event Detail carrying the proposal context (planWith + coord_group),
     remembering the drawer step to return to once the booking is confirmed */
  const onCoordRSVP=(e,name)=>{ setCoordOpen(false); setMName(name); setPlanWith(name); setCoordReturn("both"); setEv(e); setBooked(false); setWaitlist(false); setScreen("event"); };
  /* booking confirm: if it came from a plan, return to the coordination drawer at "It's on" */
  const onEventBook=()=>{ setBooked(true); setWaitlist(false); setCoordReturn(null); };
  const [saved,setSaved]=uS(new Set(window.DATA.SAVED));
  const toggleSave=(id)=>setSaved(s=>{const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n;});
  const [discoverCat,setDiscoverCat]=uS("all");
  const goTab=(k)=>{ setScreen(null); setTab(k); };
  /* account/avatar dropdown - routes to the user's own surfaces + account actions */
  const accountNav=(k)=>{
    setScreen(null); setMutualOpen(false); setCoordOpen(false); setMutualToast(false); setNotifOpen(false);
    if(k==="profile"){ setView("app"); setTab("profile"); return; }
    if(k==="people"){ setView("app"); setTab("click"); return; }
    if(k==="events"){ setMyEventsTab("upcoming"); setView("app"); setTab("saved"); return; }
    if(k==="saved"){ setMyEventsTab("saved"); setView("app"); setTab("saved"); return; }
    if(k==="howitworks"){ setView("howitworks"); return; }
    if(k==="settings"){ setSettingsSection("edit"); setView("app"); setScreen("settings"); return; }
    if(k==="signout"){ setView("landing"); return; }
  };
  const acctActive=(()=>{
    if(view==="howitworks") return "howitworks";
    if(screen==="settings") return "settings";
    if(view!=="app") return null;
    if(tab==="profile") return "profile";
    if(tab==="click") return "people";
    if(tab==="saved") return myEventsTab==="saved"?"saved":"events";
    return null;
  })();
  /* "See all on your radar" → Click (people) page, scrolled to its radar section */
  const openRadar=()=>{ setScreen(null); setMutualOpen(false); setCoordOpen(false); setView("app"); setTab("click"); setTimeout(()=>{ const c=scrollRef.current, el=c&&c.querySelector("#click-radar"); if(c&&el){ c.scrollTop = el.offsetTop - 12; } }, 60); };
  const openDiscover=(key)=>{ setDiscoverCat(key && key !== "all" ? key : "all"); setScreen(null); setView("app"); setTab("discover"); setTimeout(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=0; }, 0); };
  const pickPerson=(n)=>setPicked(p=>p.includes(n)?p:(p.length>=3?p:[...p,n]));
  const openWin=(e,mode)=>{ setEv(e||window.DATA.byId(window.DATA.RECENT)); setWinMode(mode||"default"); setMutualOpen(false); setScreen("window"); };
  /* coordination is ONE overlay DRAWER over Your clicks - never a separate full page */
  const openCoord=(step)=>{ setMutualOpen(false); setMutualToast(false); setScreen(null); setView("app"); setTab("click"); setCoordStep(step||"suggest"); setCoordOpen(true); };
  const openSuggest=()=>openCoord("suggest");
  const footerNav=(k)=>{ setScreen(null); setMutualOpen(false); setCoordOpen(false); setMutualToast(false); if(k==="howitworks"){ setView("howitworks"); return; } if(k==="merchant"){ setView("app"); setTab("home"); setScreen("merchant"); return; } setView("app"); setTab(k); };

  /* ---- notifications (positive-only; bell dot clears on open) ---- */
  const unreadCount=NOTIFS.filter(n=>n.unread&&!notifRead.has(n.id)).length;
  const showNotifDot=unreadCount>0&&!notifSeen;
  const openNotifs=()=>{ setNotifSeen(true); setNotifOpen(true); };
  const markAllRead=()=>setNotifRead(new Set(NOTIFS.map(n=>n.id)));
  const onNotifRow=(n)=>{
    setNotifRead(s=>{ const x=new Set(s); x.add(n.id); return x; });
    setNotifOpen(false);
    const a=n.action||"";
    if(a==="coord"){
      if(n.kind==="mutual"){ setMName(n.name||"Mia R."); setMutualToast(false); setView("app"); setTab("click"); setMutualOpen(true); }
      else { openCoord("suggest"); }
      return;
    }
    if(a==="window"){ const recent=window.DATA.byId(window.DATA.RECENT); setMutualOpen(false); setCoordOpen(false); setEv(recent); setWinMode("default"); setView("app"); setScreen("window"); setTab("home"); return; }
    if(a.indexOf("event:")===0){ setMutualOpen(false); setCoordOpen(false); setView("app"); open(window.DATA.byId(a.slice(6))); return; }
  };

  /* ---- jump-to (Tweaks + top strip) ---- */
  const JUMPS=[["landing","1 · Landing"],["howitworks","1 · How it works"],["auth-signup","1 · Auth · sign up"],["auth-signin","1 · Auth · sign in"],["auth-error","1 · Auth · wrong credentials"],["auth-verify","1 · Auth · verify gate"],["auth-reset","1 · Auth · reset password"],["onboarding","1 · Onboarding (4 steps)"],["quiz","1 · Click quiz"],["home","2 · Home · returning (Mode B)"],["home-a","2 · Home · first-time (Mode A)"],["loading","2 · Home · loading"],["loading-discover","3 · Discover · loading"],["loading-event","3 · Event · loading"],["loading-myevents","3 · My events · loading"],["loading-window","4 · Who was there · loading"],["loading-clicks","5 · Your clicks · loading"],["loading-profile","6 · Profile · loading"],["discover","3 · Discover (status states)"],["event","3 · Event · locked"],["event-almostfull","3 · Event · almost full"],["event-trending","3 · Event · trending"],["event-free","3 · Event · free"],["event-waitlist","3 · Event · waitlist"],["event-booked","3 · Event · unlocked (booked)"],["saved","3 · My events (list + calendar)"],["window","4 · Who was there (post-event)"],["mutual","4 · Mutual reveal ✨"],["mutual-notify","4 · Mutual notification ✨"],["notifications","4 · Notifications panel"],["coord-suggest","4 · Suggest a plan"],["coord-onein","4 · One person in"],["coord-rsvp","4 · Agreed · save your spot"],["coord-both","4 · You're both going ✨"],["coord-seatfilled","4 · Recovery · just filled up"],["coord-connected","4 · Love that (closure) ✨"],["coord-released","4 · Soft-release"],["click","5+6 · Your clicks"],["profile","People · Profile + visibility"],["settings","6 · Settings (edit · privacy · account · notifications)"],["merchant","7 · Merchant portal"],["merchant-create","7 · Merchant · create event"],["merchant-apply","7 · Merchant · become a host"]];
  const jumpTo=(k)=>{
    setScreen(null); setMutualOpen(false); setCoordOpen(false); setMutualToast(false); setNotifOpen(false); setQuizOpen(false);
    if(k==="landing"){ setView("landing"); return; }
    if(k==="howitworks"){ setView("howitworks"); return; }
    if(k==="auth-signup"){ setAuthStart("signup"); setView("auth"); return; }
    if(k==="auth-signin"){ setAuthStart("signin"); setView("auth"); return; }
    if(k==="auth-error"){ setAuthStart("signin-error"); setView("auth"); return; }
    if(k==="auth-verify"){ setAuthStart("verify"); setView("auth"); return; }
    if(k==="auth-reset"){ setAuthStart("reset"); setView("auth"); return; }
    if(k==="onboarding"){ setView("onboarding"); return; }
    if(k==="quiz"){ setView("app"); setTab("home"); setQuizOpen(true); return; }
    setView("app");
    if(k==="loading"){ setLoadKind("dashboard"); setTab("home"); setScreen("loading"); return; }
    if(k&&k.indexOf("loading-")===0){ setLoadKind(k.slice(8)); setScreen("loading"); return; }
    if(k==="home"){ setTweak("dashMode","returning"); setTab("home"); return; }
    if(k==="home-a"){ setTweak("dashMode","firstrun"); setTab("home"); return; }
    if(["discover","saved","profile","click"].includes(k)){ setTab(k); return; }
    if(k==="event"){ setEv(window.DATA.byId("ev3")); setBooked(false); setWaitlist(false); setScreen("event"); return; }
    if(k==="event-almostfull"){ setEv(window.DATA.byId("ev6")); setBooked(false); setWaitlist(false); setScreen("event"); return; }
    if(k==="event-trending"){ setEv(window.DATA.byId("ev2")); setBooked(false); setWaitlist(false); setScreen("event"); return; }
    if(k==="event-free"){ setEv(window.DATA.byId("ev4")); setBooked(false); setWaitlist(false); setScreen("event"); return; }
    if(k==="event-waitlist"){ setEv(window.DATA.byId("ev6")); setBooked(false); setWaitlist(true); setScreen("event"); return; }
    if(k==="event-booked"){ setEv(window.DATA.byId("ev1")); setBooked(true); setWaitlist(false); setScreen("event"); return; }
    if(k==="settings"){ setSettingsSection("edit"); setScreen("settings"); return; }
    if(k==="merchant"){ setTab("home"); setScreen("merchant"); return; }
    if(k==="merchant-create"){ setTab("home"); setScreen("merchant-create"); return; }
    if(k==="merchant-apply"){ setTab("home"); setScreen("merchant-apply"); return; }
    const recent=window.DATA.byId(window.DATA.RECENT);
    if(k==="window"){ setEv(recent); setWinMode("default"); setScreen("window"); setTab("home"); return; }
    if(k==="mutual"){ setEv(recent); setWinMode("default"); setMName("Mia R."); setScreen("window"); setMutualOpen(true); setTab("home"); return; }
    if(k==="mutual-notify"){ setMName("Mia R."); setMutualToast(true); setTab("home"); return; }
    if(k==="notifications"){ setTab("home"); setNotifSeen(true); setNotifOpen(true); return; }
    if(k&&k.indexOf("coord-")===0){ setView("app"); setTab("click"); setScreen(null); setMName("Mia R."); setCoordStep(k.slice(6)); setCoordOpen(true); return; }
  };
  const curKey=(()=>{
    if(view==="landing") return "landing";
    if(view==="howitworks") return "howitworks";
    if(view==="auth") return authStart==="signin"?"auth-signin":authStart==="signin-error"?"auth-error":authStart==="verify"?"auth-verify":authStart==="reset"?"auth-reset":"auth-signup";
    if(view==="onboarding") return "onboarding";
    if(quizOpen) return "quiz";
    if(screen==="event"){ if(booked) return "event-booked"; if(waitlist) return "event-waitlist"; return ({ev6:"event-almostfull",ev2:"event-trending",ev4:"event-free"})[ev.id]||"event"; }
    if(screen==="settings") return "settings";
    if(screen==="merchant") return "merchant";
    if(screen==="merchant-create") return "merchant-create";
    if(screen==="merchant-apply") return "merchant-apply";
    if(mutualOpen) return "mutual";
    if(mutualToast) return "mutual-notify";
    if(notifOpen) return "notifications";
    if(coordOpen) return "coord-"+coordStep;
    if(screen==="window") return "window";
    if(screen==="loading") return loadKind==="dashboard"?"loading":"loading-"+loadKind;
    if(tab==="home") return t.dashMode==="firstrun"?"home-a":"home";
    return tab;
  })();

  /* ---- render current screen ---- */
  let body, dark=false, noChrome=false;
  if(view==="landing"){ body=<SA.Landing web={web} enter={()=>{setView("app");setTab("home");}} auth={(start)=>{setAuthStart(start||"signup");setView("auth");}}/>; noChrome=true; }
  else if(view==="howitworks"){ body=<window.ScreensHIW.HowItWorks web={web} enter={()=>{setView("app");setTab("home");}} founding={()=>{setView("app");setTab("home");}}/>; noChrome=true; }
  else if(view==="auth"){ body=<window.ScreensAuth.Auth key={authStart} web={web} start={authStart} done={()=>{setView("app");setTab("home");}}/>; noChrome=true; }
  else if(view==="onboarding"){ body=<window.ScreensOnb.Onboarding web={web} done={()=>{setView("app");setTab("home");}}/>; noChrome=true; }
  else if(screen==="event") body=<window.ScreensED.EventDetail e={ev} web={web} width={W} back={()=>setScreen(null)} booked={booked} book={onEventBook} saved={saved.has(ev.id)} toggleSave={()=>toggleSave(ev.id)} waitlist={waitlist} planWith={planWith}/>;
  else if(screen==="window") body=<Mech.WhoWasThere web={web} event={ev} mode={winMode} datingViewer={t.whoDating==="on"} onClose={()=>{setScreen(null);setTab("home");}} onDiscover={()=>openDiscover()} onMutual={(n)=>{setMName(n);setMutualOpen(true);}} onConnected={()=>openCoord("connected")} onSuggest={()=>openCoord("suggest")} onHow={()=>setView("howitworks")}/>;
  else if(screen==="loading") body=<window.ScreensSkel.Skeleton web={web} kind={loadKind}/>;
  else if(screen==="merchant") body=<window.ScreensMerch.Portal web={web} fresh={t.merchState==="new"} createEvent={()=>setScreen("merchant-create")}/>;
  else if(screen==="merchant-create") body=<window.ScreensMerchCreate.CreateEvent web={web} done={()=>setScreen("merchant")} cancel={()=>setScreen("merchant")}/>;
  else if(screen==="merchant-apply") body=<window.ScreensMerch.Apply web={web} done={()=>setScreen("merchant")}/>;
  else if(screen==="settings") body=<window.ScreensSet.Settings web={web} initialSection={settingsSection} back={()=>{setScreen(null);setTab("profile");}} quizDone={quizDone} openQuiz={()=>setQuizOpen(true)}/>;
  else if(tab==="home") body=<window.ScreensDash.Dashboard web={web} mode={t.dashMode==="firstrun"?"firstrun":"returning"} showPrompt={t.postPrompt!=="off"} open={open} saved={saved} toggleSave={toggleSave} openWin={openWin} openDiscover={openDiscover} openPeople={()=>goTab("click")} openEvents={()=>goTab("saved")} openRadar={openRadar} openQuiz={()=>setQuizOpen(true)} quizDone={quizDone} coordBanner={t.dashMode==="firstrun"?null:(t.dashBanner==="none"?null:t.dashBanner)} onCoordAction={(v)=>{ if(v==="consolidated"){ goTab("click"); return; } setMName("Mia R."); if(v==="agreed"){ openCoord("rsvp"); return; } openCoord("suggest"); }} onHow={()=>setView("howitworks")}/>;
  else if(tab==="discover") body=<window.ScreensDisc.Discover key={discoverCat} web={web} width={W} initialCat={discoverCat} open={open} saved={saved} toggleSave={toggleSave}/>;
  else if(tab==="saved") body=<window.ScreensME.MyEvents key={"me-"+myEventsTab} web={web} open={open} saved={saved} toggleSave={toggleSave} initialTab={myEventsTab}/>;
  else if(tab==="profile") body=<SA.Profile web={web} onEdit={()=>{setSettingsSection("edit");setScreen("settings");}}/>;
  else if(tab==="click") body=<SB.ClicksTab web={web} onHow={()=>setView("howitworks")} open={open} route={(c)=>{ setMName(c.name); const st = c.state==="plan" ? "both" : c.state==="connected" ? "connected" : c.coord==="proposed_waiting" ? "onein" : (c.coord==="their_turn"||c.coord==="yoursave") ? "rsvp" : "suggest"; openCoord(st); }}/>;

  const showTabs=view==="app";

  let frameInner;
  if(web){
    frameInner=<BrowserFrame width={W} scrollRef={scrollRef}>
      {view==="app"&&showTabs&&<TopNav tab={tab} go={goTab} notify={showNotifDot?unreadCount:0} onBell={openNotifs} acctActive={acctActive} onAccount={accountNav}/>}
      <div style={{flex:"1 0 auto",containerType:"inline-size",padding:view==="app"&&showTabs?"24px 0":"0"}}>{body}</div>
      <Footer web={web} onNav={footerNav}/>
      {mutualOpen&&<Mech.MutualReveal web={web} name={mName} onSuggest={openSuggest} onClose={()=>setMutualOpen(false)} onHow={()=>{setMutualOpen(false);setView("howitworks");}}/>}
      {coordOpen&&<Mech.Coordinate key={coordStep} web={web} start={coordStep} name={mName} onClose={()=>setCoordOpen(false)} onRSVP={onCoordRSVP} onOpenEvent={(e)=>{ setCoordOpen(false); open(e); }} onHow={()=>{setCoordOpen(false);setView("howitworks");}}/>}
      {mutualToast&&<MutualToast web={web} name={mName} onOpen={()=>{setMutualToast(false);setMutualOpen(true);}} onClose={()=>setMutualToast(false)}/>}
      {notifOpen&&<NotifPanel web={web} readSet={notifRead} onClose={()=>setNotifOpen(false)} onRow={onNotifRow} onMarkAll={markAllRead}/>}
      {quizOpen&&<window.ScreensQuiz.Quiz web={web} done={()=>{setQuizOpen(false);setQuizDone(true);}} onClose={()=>setQuizOpen(false)}/>}
    </BrowserFrame>;
  } else {
    frameInner=<PhoneFrame>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",overflowX:"hidden",display:"flex",flexDirection:"column"}}>
        {showTabs&&<MobileTopNav tab={tab} go={goTab} notify={showNotifDot} onBell={openNotifs} acctActive={acctActive} onAccount={accountNav}/>}
        <div style={{flex:"1 0 auto",containerType:"inline-size"}}>{body}</div>
        <Footer web={web} onNav={footerNav}/>
      </div>
      {showTabs&&screen!=="event"&&<BottomNav tab={tab} go={goTab}/>}
      <div id="ckModalLayer" style={{position:"absolute",inset:0,zIndex:55,pointerEvents:"none"}}></div>
      {mutualOpen&&<Mech.MutualReveal web={web} name={mName} onSuggest={openSuggest} onClose={()=>setMutualOpen(false)} onHow={()=>{setMutualOpen(false);setView("howitworks");}}/>}
      {coordOpen&&<Mech.Coordinate key={coordStep} web={web} start={coordStep} name={mName} onClose={()=>setCoordOpen(false)} onRSVP={onCoordRSVP} onOpenEvent={(e)=>{ setCoordOpen(false); open(e); }} onHow={()=>{setCoordOpen(false);setView("howitworks");}}/>}
      {mutualToast&&<MutualToast web={web} name={mName} onOpen={()=>{setMutualToast(false);setMutualOpen(true);}} onClose={()=>setMutualToast(false)}/>}
      {notifOpen&&<NotifPanel web={web} readSet={notifRead} onClose={()=>setNotifOpen(false)} onRow={onNotifRow} onMarkAll={markAllRead}/>}
      {quizOpen&&<window.ScreensQuiz.Quiz web={web} done={()=>{setQuizOpen(false);setQuizDone(true);}} onClose={()=>setQuizOpen(false)}/>}
    </PhoneFrame>;
  }

  return <div style={{minHeight:"100vh",background:"var(--sand-50)"}}>
    {/* control strip */}
    <div ref={stripRef} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"14px 22px",borderBottom:"1px solid var(--border-soft)",background:"var(--cream)",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><L size={22}/><span style={{fontSize:12.5,color:"var(--text-muted)",fontWeight:500}}>Responsive web · interactive mockup</span></div>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <Seg value={device} onChange={setDevice} options={[["phone","375"],["tablet","768"],["laptop","1024"],["desktop","1440"]]}/>
        <JumpSelect value={curKey} options={JUMPS} onChange={jumpTo}/>
      </div>
    </div>
    {/* stage */}
    <div ref={stageRef} style={{height:`calc(100vh - ${stripH}px)`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",padding:24,boxSizing:"border-box"}}>
      <div style={{width:frameW*scale,height:frameH*scale,flex:"none"}}>
        <div style={{width:frameW,height:frameH,transform:`scale(${scale})`,transformOrigin:"top left"}}>{frameInner}</div>
      </div>
    </div>

    <TweaksPanel>
      <TweakSection label="Jump to screen"/>
      <TweakSelect label="Screen" value={curKey} options={JUMPS.map(j=>({value:j[0],label:j[1]}))} onChange={jumpTo}/>
      <TweakSection label="Device"/>
      <TweakRadio label="Width" value={device} options={["phone","tablet","laptop","desktop"]} onChange={setDevice}/>
      <TweakSection label="Dashboard (Home)"/>
      <TweakSelect label="Mode" value={t.dashMode} options={[{value:"returning",label:"Returning (Mode B)"},{value:"firstrun",label:"First-time (Mode A)"}]} onChange={v=>setTweak("dashMode",v)}/>
      <TweakSelect label="Coordination banner" value={t.dashBanner} options={[{value:"mutual",label:"Fresh mutual"},{value:"proposed",label:"They proposed"},{value:"agreed",label:"Agreed · your RSVP"},{value:"consolidated",label:"2+ waiting on you"},{value:"none",label:"None"}]} onChange={v=>setTweak("dashBanner",v)}/>
      <TweakToggle label="Post-event prompt (48h window)" value={t.postPrompt!=="off"} onChange={v=>setTweak("postPrompt",v?"on":"off")}/>
      <TweakSection label="The mechanic"/>
      <TweakToggle label="Show me in attendee lists" value={t.visibility!=="off"} onChange={v=>setTweak("visibility",v?"on":"off")}/>
      <TweakToggle label="Dating mode (Who-was-there overlay)" value={t.whoDating==="on"} onChange={v=>setTweak("whoDating",v?"on":"off")}/>
      <TweakSection label="Merchant portal"/>
      <TweakSelect label="Merchant state" value={t.merchState} options={[{value:"active",label:"Established (revenue + events)"},{value:"new",label:"New (setup incomplete, $0)"}]} onChange={v=>setTweak("merchState",v)}/>
    </TweaksPanel>
  </div>;
}

/* segmented device control */
function Seg({ value, onChange, options }) {
  return <div style={{display:"inline-flex",background:"var(--white)",border:"1px solid var(--border-mid)",borderRadius:"var(--radius-pill)",padding:3,gap:2}}>
    {options.map(([k,label])=>{const on=value===k;return <button key={k} onClick={()=>onChange(k)} style={{border:"none",cursor:"pointer",borderRadius:"var(--radius-pill)",padding:"6px 13px",fontFamily:"var(--font-sans)",fontSize:12.5,fontWeight:on?700:500,background:on?"var(--purple-600)":"transparent",color:on?"var(--cream)":"var(--text-body)",transition:"background .15s"}}>{label}</button>;})}
  </div>;
}
function JumpSelect({ value, options, onChange }) {
  return <div style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{appearance:"none",WebkitAppearance:"none",background:"var(--white)",border:"1px solid var(--border-mid)",borderRadius:"var(--radius-pill)",padding:"8px 34px 8px 15px",fontFamily:"var(--font-sans)",fontSize:13,fontWeight:500,color:"var(--text-strong)",cursor:"pointer"}}>
      {options.map(([k,label])=><option key={k} value={k}>{label}</option>)}
    </select>
    <span style={{position:"absolute",right:13,pointerEvents:"none",display:"flex"}}><window.CK.Icon name="chevD" size={16} color="var(--text-muted)"/></span>
  </div>;
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dashMode": "returning",
  "dashBanner": "mutual",
  "postPrompt": "on",
  "yourIntent": "friends",
  "mutualMatch": "same",
  "visibility": "on",
  "merchState": "active"
}/*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById("root")).render(<Root/>);

})();
