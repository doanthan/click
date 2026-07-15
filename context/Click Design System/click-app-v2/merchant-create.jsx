(function(){
/* Click - Merchant event creation wizard. 4 steps: Basics → When & where → Tickets → Review.
   window.ScreensMerchCreate = { CreateEvent }. Uses CK primitives; Click design system. */
const { useState:uS, Icon:I, Btn, Field, Tag, Badge, Toggle, Spark:SP } = window.CK;

const card = { background:"var(--white)",border:"1px solid var(--border-soft)",borderRadius:"var(--radius-lg)",boxShadow:"var(--shadow-sm)" };
const tint = { background:"var(--lavender-100)",border:"1px solid var(--lavender-200)",borderRadius:"var(--radius-lg)" };
const CATS = ["Fitness","Food","Creative","Social","Games","Wellness","Outdoors","Learning","Nightlife","Sports"];
const VENUES = ["Studio 44 · Marrickville","Bay Run · Rozelle","Callan Park · Lilyfield","+ New venue"];

function Label({children}){ return <span style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)"}}>{children}</span>; }
function Seg({ value, onChange, options }) {
  return <div style={{display:"inline-flex",background:"var(--white)",border:"1px solid var(--border-mid)",borderRadius:"var(--radius-pill)",padding:3,gap:2,alignSelf:"flex-start"}}>
    {options.map(([k,label])=>{const on=value===k;return <button key={k} onClick={()=>onChange(k)} style={{border:"none",cursor:"pointer",borderRadius:"var(--radius-pill)",padding:"7px 15px",fontFamily:"var(--font-sans)",fontSize:13,fontWeight:on?700:500,background:on?"var(--purple-600)":"transparent",color:on?"var(--cream)":"var(--text-body)",transition:"background .15s"}}>{label}</button>;})}
  </div>;
}
function Stepper({ value, onChange, min=1, max=200 }) {
  return <div style={{display:"inline-flex",alignItems:"center",gap:0,border:"1.5px solid var(--border-mid)",borderRadius:"var(--radius-pill)",background:"var(--white)",alignSelf:"flex-start"}}>
    <button onClick={()=>onChange(Math.max(min,value-1))} aria-label="Decrease" style={{border:"none",background:"none",cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--purple-600)",fontSize:20,fontWeight:600}}>−</button>
    <span style={{minWidth:44,textAlign:"center",fontFamily:"var(--font-display)",fontSize:16.5,fontWeight:600,color:"var(--text-strong)"}}>{value}</span>
    <button onClick={()=>onChange(Math.min(max,value+1))} aria-label="Increase" style={{border:"none",background:"none",cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--purple-600)",fontSize:20,fontWeight:600}}>+</button>
  </div>;
}
function Panel({ title, sub, children }) {
  return <div style={{...card,padding:"clamp(17px,3vw,28px)",display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <h2 style={{margin:0,fontSize:20,fontWeight:600,color:"var(--text-strong)"}}>{title}</h2>
      {sub&&<p style={{margin:0,fontSize:13.5,color:"var(--text-muted)",lineHeight:1.5}}>{sub}</p>}
    </div>
    {children}
  </div>;
}
function Select({ label, value, onChange, options, hint }) {
  return <label style={{display:"flex",flexDirection:"column",gap:7}}>
    <Label>{label}</Label>
    <span style={{position:"relative",display:"flex"}}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{appearance:"none",WebkitAppearance:"none",width:"100%",height:50,padding:"0 40px 0 14px",background:"var(--white)",border:"1.5px solid var(--border-mid)",borderRadius:"var(--radius-md)",fontFamily:"var(--font-sans)",fontSize:15,color:"var(--text-strong)",cursor:"pointer"}}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",display:"flex"}}><I name="chevD" size={16} color="var(--text-muted)"/></span>
    </span>
    {hint&&<span style={{fontSize:12.5,color:"var(--text-muted)",lineHeight:1.4}}>{hint}</span>}
  </label>;
}

function CreateEvent({ web, done, cancel }) {
  const [step,setStep]=uS(0);
  const [name,setName]=uS("");
  const [cat,setCat]=uS("Fitness");
  const [desc,setDesc]=uS("");
  const [venue,setVenue]=uS(VENUES[0]);
  const [repeat,setRepeat]=uS("once");
  const [cap,setCap]=uS(12);
  const [priced,setPriced]=uS("free");
  const [price,setPrice]=uS("28");
  const [waitlist,setWaitlist]=uS(true);
  const [visibility,setVisibility]=uS("public");
  const [published,setPublished]=uS(false);
  const steps=["Basics","When & where","Tickets","Review"];
  const evName = name.trim()||"Beginner boxing";

  if(published) return <div style={{maxWidth:560,margin:"0 auto",padding:web?"56px 24px":"36px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:14,textAlign:"center"}} data-screen-label="Merchant · Event published">
    <span style={{width:56,height:56,borderRadius:"50%",background:"var(--lavender-100)",display:"flex",alignItems:"center",justifyContent:"center"}}><SP size={28} big="var(--purple-600)" small="var(--purple-400)"/></span>
    <h1 style={{margin:0,fontSize:web?30:24,fontWeight:600,color:"var(--text-strong)"}}>{evName} is live.</h1>
    <p style={{margin:0,fontSize:14.5,color:"var(--text-body)",lineHeight:1.55,maxWidth:420}}>It's on Discover now. We'll email you as bookings come in - the door list lives in Bookings.</p>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
      <Btn onClick={done}>Back to dashboard</Btn>
      <Btn variant="secondary" icon="share">Share event link</Btn>
    </div>
  </div>;

  return <div style={{maxWidth:720,margin:"0 auto",padding:web?"28px 24px 56px":"18px 16px 40px",display:"flex",flexDirection:"column",gap:18}} data-screen-label="Merchant · Create event">
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <span><Badge tone="lavender">Create event</Badge></span>
        <h1 style={{margin:0,fontSize:web?32:25,fontWeight:600,color:"var(--text-strong)",letterSpacing:"-.01em"}}>What are you hosting?</h1>
        <p style={{margin:0,fontSize:14,color:"var(--text-muted)",lineHeight:1.5}}>Four quick steps - you can save a draft and finish later.</p>
      </div>
      <Btn size="sm" variant="ghost" onClick={cancel}>Cancel</Btn>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {steps.map((s,i)=><React.Fragment key={s}>
        {i>0&&<span style={{flex:1,height:1.5,background:i<=step?"var(--purple-400)":"var(--border-mid)"}}/>}
        <button onClick={()=>i<step&&setStep(i)} style={{display:"inline-flex",alignItems:"center",gap:7,border:"none",background:"none",padding:0,cursor:i<step?"pointer":"default"}}>
          <span style={{width:24,height:24,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,background:i<step?"var(--sage)":i===step?"var(--purple-600)":"var(--white)",color:i<=step?"#fff":"var(--text-muted)",border:i>step?"1.5px solid var(--border-mid)":"none"}}>{i<step?<I name="check" size={12} w={2.8} color="#fff"/>:i+1}</span>
          {web&&<span style={{fontSize:12,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:i===step?"var(--purple-700)":"var(--text-faint)"}}>{s}</span>}
        </button>
      </React.Fragment>)}
    </div>

    {step===0&&<Panel title="The basics" sub="Name it the way you'd say it out loud - attendees see this on Discover.">
      <Field label="Event name *" placeholder="e.g. Beginner boxing" value={name} onChange={setName}/>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <Label>Category *</Label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {CATS.map(c=><Tag key={c} selected={cat===c} onClick={()=>setCat(c)} style={{height:30,padding:"0 13px",fontSize:12.5}}>{c}</Tag>)}
        </div>
      </div>
      <label style={{display:"flex",flexDirection:"column",gap:7}}>
        <Label>Description *</Label>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What happens, who it's for, what to bring. Keep it warm - this is the icebreaker." rows={4}
          style={{resize:"vertical",padding:"12px 14px",background:"var(--white)",border:"1.5px solid var(--border-mid)",borderRadius:"var(--radius-md)",fontFamily:"var(--font-sans)",fontSize:15,color:"var(--text-strong)",lineHeight:1.5,outline:"none"}}/>
        <span style={{fontSize:12.5,color:"var(--text-muted)"}}>Tip: events that say "no experience needed" fill ~2× faster.</span>
      </label>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <Label>Cover photo</Label>
        <div style={{border:"1.5px dashed var(--border-mid)",borderRadius:"var(--radius-lg)",padding:"24px 18px",display:"flex",flexDirection:"column",alignItems:"center",gap:7,textAlign:"center"}}>
          <I name="camera" size={22} w={1.9} color="var(--purple-600)"/>
          <span style={{fontSize:13.5,fontWeight:600,color:"var(--text-strong)"}}>Drop a photo here or browse</span>
          <span style={{fontSize:12,color:"var(--text-muted)"}}>Real photos of your space fill events faster than stock. JPG or PNG · up to 10 MB.</span>
        </div>
      </div>
    </Panel>}

    {step===1&&<Panel title="When & where" sub="Attendees see the suburb up front; the exact address unlocks after they book.">
      <div style={{display:"grid",gridTemplateColumns:web?"1fr 1fr":"1fr",gap:14}}>
        <Field label="Date *" placeholder="Sat 18 Jul 2026" icon="calendar"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Field label="Starts *" placeholder="9:00 am" icon="clock"/>
          <Field label="Ends *" placeholder="10:30 am" icon="clock"/>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <Label>Repeats</Label>
        <Seg value={repeat} onChange={setRepeat} options={[["once","One-off"],["weekly","Weekly"],["fortnightly","Fortnightly"]]}/>
        {repeat!=="once"&&<span style={{fontSize:12.5,color:"var(--text-muted)"}}>We'll create the next 8 dates - each one takes bookings separately.</span>}
      </div>
      <Select label="Venue *" value={venue} onChange={setVenue} options={VENUES} hint="Saved venues autofill the address and directions."/>
      <div style={{...tint,padding:"12px 15px",display:"flex",gap:10,alignItems:"flex-start",fontSize:13,color:"var(--text-body)",lineHeight:1.5}}>
        <I name="lock" size={16} w={2} color="var(--purple-600)" style={{marginTop:1}}/>
        <span>Address privacy: Discover shows "{venue.split(" · ")[1]||"Marrickville"}" only. Booked attendees get the full address and arrival notes.</span>
      </div>
    </Panel>}

    {step===2&&<Panel title="Tickets & capacity" sub="Small caps make better icebreakers - most hosts run 8 to 16 spots.">
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <Label>Capacity *</Label>
        <Stepper value={cap} onChange={setCap}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <Label>Pricing *</Label>
        <Seg value={priced} onChange={setPriced} options={[["free","Free"],["paid","Paid"]]}/>
        {priced==="paid"
          ? <div style={{display:"grid",gridTemplateColumns:web?"180px 1fr":"1fr",gap:14,alignItems:"start"}}>
              <Field label="Price per spot (AUD)" placeholder="28" value={price} onChange={setPrice}/>
              <div style={{...tint,padding:"12px 15px",fontSize:13,color:"var(--text-body)",lineHeight:1.5,alignSelf:"end"}}>Paid bookings route via Stripe. You keep <b style={{fontWeight:600,color:"var(--purple-700)"}}>${(Math.max(0,parseFloat(price)||0)*0.95).toFixed(2)}</b> per spot after the 5% platform fee - paid out monthly.</div>
            </div>
          : <span style={{fontSize:12.5,color:"var(--text-muted)"}}>Free events skip Stripe entirely - no payment setup needed.</span>}
      </div>
      <Toggle checked={waitlist} onChange={setWaitlist} label="Waitlist when full" helper="If someone cancels, the first person on the waitlist gets 30 minutes to claim the spot."/>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <Label>Visibility</Label>
        <Seg value={visibility} onChange={setVisibility} options={[["public","On Discover"],["link","Link only"]]}/>
        {visibility==="link"&&<span style={{fontSize:12.5,color:"var(--text-muted)"}}>Hidden from Discover - only people with the link can book. Handy for comp guests and private groups.</span>}
      </div>
    </Panel>}

    {step===3&&<Panel title="Review & publish" sub="Here's how it lands on Discover - tap any row to jump back and edit.">
      <div style={{...card,overflow:"hidden",boxShadow:"none"}}>
        {[["Event",`${evName} · ${cat}`,0],["Description",desc.trim()||"Add a description before publishing",0],["When","Sat 18 Jul · 9:00-10:30 am"+(repeat!=="once"?` · repeats ${repeat}`:""),1],["Where",venue,1],["Capacity",`${cap} spots · waitlist ${waitlist?"on":"off"}`,2],["Price",priced==="paid"?`$${price} per spot`:"Free",2],["Visibility",visibility==="public"?"Listed on Discover":"Link only",2]].map(([k,v,go],i,arr)=>
          <button key={k} onClick={()=>setStep(go)} style={{display:"flex",alignItems:"center",gap:14,width:"100%",textAlign:"left",border:"none",background:"none",cursor:"pointer",padding:"13px 17px",borderBottom:i<arr.length-1?"1px solid var(--border-soft)":"none"}}>
            <span style={{flex:"none",width:web?110:84,fontSize:11.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)"}}>{k}</span>
            <span style={{flex:1,minWidth:0,fontSize:13.5,color:"var(--text-strong)",lineHeight:1.45}}>{v}</span>
            <I name="chevR" size={15} w={2} color="var(--text-faint)"/>
          </button>)}
      </div>
      <div style={{...tint,padding:"12px 15px",display:"flex",gap:10,alignItems:"flex-start",fontSize:13,color:"var(--text-body)",lineHeight:1.5}}>
        <SP size={15} big="var(--purple-600)" small="var(--purple-400)"/>
        <span>Once live, attendees can book instantly. Cancelling later refunds everyone automatically and notifies them.</span>
      </div>
    </Panel>}

    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <Btn variant="ghost" onClick={()=>step>0&&setStep(step-1)} style={{visibility:step>0?"visible":"hidden"}}>Back</Btn>
      <span style={{fontSize:12,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)"}}>Step {step+1} of 4 · {steps[step]}</span>
      <div style={{display:"flex",gap:9}}>
        {step<3&&<Btn variant="secondary" onClick={done}>Save draft</Btn>}
        {step<3?<Btn onClick={()=>setStep(step+1)}>Next</Btn>:<Btn onClick={()=>setPublished(true)}>Publish event</Btn>}
      </div>
    </div>
  </div>;
}

window.ScreensMerchCreate = { CreateEvent };
})();
