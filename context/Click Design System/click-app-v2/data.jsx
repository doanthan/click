(function(){
/* Click - v2 mockup data. Real inner-Sydney venues, prices, names (no placeholders).
   Intent-neutral attendees; locked language. window.DATA. */

const ATT = {
  mia:{    name:"Mia R.",    intent:"here for friends",        tags:["Ceramics","Natural wine","Pottery"], age:29, suburb:"Newtown, Sydney",     been:6, bio:"Here for the making and whoever's there for it too. I'll happily talk your ear off about glazes." },
  tom:{    name:"Tom K.",    intent:"here for the activities", tags:["Coffee","Film","Cycling"],           age:27, suburb:"Marrickville, Sydney", been:4, bio:"Always up for trying the thing once. I'll bring the good coffee." },
  priya:{  name:"Priya S.",  intent:"new to the area",         tags:["Ceramics","Hiking","Markets"],       age:30, suburb:"Erskineville, Sydney", been:5, bio:"Just moved across town and saying yes to most things. Slow hikes, slower coffees." },
  jules:{  name:"Jules M.",  intent:"open to dating",          tags:["Pottery","Live music","Film"],       age:31, suburb:"Inner West, Sydney",   been:11, bio:"Potter by hobby, gig-goer by habit. Looking for people to do both with - no small talk required." },
  hassan:{ name:"Hassan A.", intent:"growing my circle",       tags:["Cocktails","Cycling","Food"],        age:28, suburb:"Surry Hills, Sydney",  been:7, bio:"New-ish to the area, building a weekend crew. Will ride anywhere there's a good feed at the end." },
  bec:{    name:"Bec T.",    intent:"here for friends",        tags:["Plants","Cooking","Markets"],        age:26, suburb:"Redfern, Sydney",      been:3, bio:"Plant person, slow cook, market wanderer. Here for easy company." },
  daniel:{ name:"Daniel O.", intent:"here for the activities", tags:["Glass","Coffee","Design"],           age:33, suburb:"Marrickville, Sydney", been:8, bio:"Maker at heart - give me a workshop and a deadline and I'm happy." },
  linh:{   name:"Linh N.",   intent:"new to the area",         tags:["Running","Books","Coffee"],          age:29, suburb:"Dulwich Hill, Sydney", been:2, bio:"Sunrise runs and second-hand bookshops. New here and finding my feet." },
  sam:{    name:"Sam W.",    intent:"open to dating",          tags:["Cocktails","Vinyl","Film"],          age:30, suburb:"Darlington, Sydney",   been:5, bio:"Records, negronis, late films. Happiest somewhere with a good back catalogue." },
  aisha:{  name:"Aisha B.",  intent:"here for friends",        tags:["Pasta","Pottery","Wine"],            age:27, suburb:"Surry Hills, Sydney",  been:6, bio:"I cook when I'm nervous and when I'm happy, so basically always. Come hungry." },
};
const A = (...keys) => keys.map(k=>ATT[k]);

const EVENTS = [
  { id:"ev1", name:"Wheel throwing - make two mugs", venue:"Posy Ceramics", suburb:"Newtown", dist:"1.4km", when:"Thu 11 Jun · 6:30pm", category:"ceramics", price:"$110", status:"spots", count:9, cap:12, founding:true,
    going:["Mia","Tom","Priya","Jules","Ada"], photo:"clay rising on the wheel",
    blurb:"Two hours at the wheel with Posy's potters. Wedge, centre, pull - you'll leave with two mugs to fire and collect next week. Clay, aprons and a drink sorted.",
    attendees:A("mia","tom","priya","jules") },

  { id:"ev2", name:"Greenhouse terrarium build", venue:"Merchant & Green", suburb:"Redfern", dist:"0.9km", when:"Sat 13 Jun · 2:00pm", category:"workshops", price:"$120", status:"trending", count:16, cap:20, founding:false,
    going:["Bec","Daniel","Linh","Noa","Rae"], photo:"hands layering moss & gravel",
    blurb:"Build a closed terrarium that looks after itself. Glass vessel, plants, tools and a cutting to take home - plus tea and somewhere warm to potter for the afternoon.",
    attendees:A("bec","daniel","linh") },

  { id:"ev3", name:"Native cocktails, four pours", venue:"", suburb:"Surry Hills", dist:"0.5km", when:"Fri 12 Jun · 7:00pm", category:"wine", price:"$97", status:null, count:11, cap:16, founding:false,
    going:["Hassan","Aisha","Sam","Otis"], photo:"a pour over native botanicals",
    blurb:"Four cocktails built on Australian botanicals - wattleseed, finger lime, strawberry gum - with the bartender talking you through each. Snacks between rounds.",
    attendees:A("hassan","aisha","sam") },

  { id:"ev4", name:"Sunrise run + coffee, 5k", venue:"", suburb:"Marrickville", dist:"2.1km", when:"Sat 13 Jun · 6:15am", category:"run", price:"Free", status:"free", count:23, cap:40, founding:false,
    going:["Tom","Linh","Mia","Sol","Eli","Bo"], photo:"runners at first light",
    blurb:"An easy 5k along the Cooks River as the city wakes up, then coffee for whoever wants it. All paces - the slow group is the fun group.",
    attendees:A("tom","linh","mia") },

  { id:"ev5", name:"Glass-blowing taster", venue:"Mark Eliott Glass", suburb:"Marrickville", dist:"2.3km", when:"Sun 14 Jun · 11:00am", category:"art", price:"$182", status:null, count:10, cap:10, full:true, founding:true,
    going:["Daniel","Priya","Wren"], photo:"molten glass on the rod",
    blurb:"Gather, shape and blow your own glass piece at Mark Eliott's studio furnace. One-to-one with a maker; you'll come away with something you made in the heat.",
    attendees:A("daniel","priya") },

  { id:"ev6", name:"Pasta from scratch", venue:"", suburb:"Surry Hills", dist:"0.6km", when:"Wed 10 Jun · 6:30pm", category:"cooking", price:"$150", status:"almostfull", count:14, cap:15, founding:false,
    going:["Aisha","Jules","Bec","Cam"], photo:"fresh tagliatelle on the bench",
    blurb:"Make three shapes by hand - tagliatelle, orecchiette, filled parcels - then sit down and eat the lot together with a glass of red.",
    attendees:A("aisha","jules","bec") },
];

/* interest tags per event (neutral, up to 3 show on card + "+N"; full set on detail) */
const TAGS = {
  ev1: ["Ceramics", "Hands-on", "Small group", "BYO drink"],
  ev2: ["Plants", "Craft", "Take-home", "Beginner-friendly"],
  ev3: ["Cocktails", "Native botanicals", "Tasting"],
  ev4: ["Running", "Outdoors", "Coffee after", "All paces"],
  ev5: ["Glass", "Hands-on", "One-on-one"],
  ev6: ["Cooking", "Italian", "Sit-down", "Wine"]
};
EVENTS.forEach((e) => { e.tags = TAGS[e.id] || []; });

const BOOKINGS = ["ev1"];
const SAVED = ["ev2","ev4"];
const WAITLIST = ["ev5"];          // amber Waitlist badge in Saved & waitlist
const PAST = ["ev6","ev3"];        // events you've attended

/* demo calendar dates (July 2026) for the My Events calendar/agenda view */
const MYDATES = { ev6:"2026-07-01", ev3:"2026-07-03", ev1:"2026-07-09", ev2:"2026-07-11", ev5:"2026-07-12", ev4:"2026-07-18" };

/* suggested-for-you sets (matched to Ava's tags: ceramics / plants / run) */
const SUGGEST_A = ["ev2","ev4","ev3"];   // Mode A - near you this week
const SUGGEST_B = ["ev3","ev5","ev6"];   // Mode B - fresh, not already booked/saved

/* the recently-attended event inside its 48h window (post-event prompt) */
const RECENT = "ev6";              // Pasta from scratch

/* CLICK RADAR - the canonical EVENT strip (09 §9). Events near you that people you'd
   click with are going to. Each carries ONE anonymous, AGGREGATE social-proof line
   (≥3-attendee floor; never names/photos/who). Event-first, people-signal-second.
   COLD-START (new user) falls back to honest "trending" - see Radar component. */
const RADAR = { count: 3 };
const RADAR_EVENTS = [
  { id:"ev4", icon:"spark", line:"9 people who also love run clubs are going to" },  // shared-interest → event
  { id:"ev2", icon:"users", line:"6 people who are also into plants are going to" },  // shared-interest → event
  { id:"ev3", icon:"spark", line:"5 people who also enjoy cocktails are going to" },  // shared-interest → event
];
/* cold-start: top events by velocity, framed honestly as trending (no fake personalisation) */
const RADAR_COLD = ["ev2","ev4","ev1"];

/* Click-with-someone - the curated daily pool: 3 fresh people a day.
   Shared-context is CONDITIONAL and never fabricated: `sharedEvent` only when you
   were genuinely both in the room; otherwise the real overlap is shared intent +
   interest tags (`overlap`). Bio / prompt / lifeTags live in the PROFILE drawer only. */
const CLICK_SUGGEST = [
  { name:"Mia R.", age:29, intent:"here for friends",
    tags:["Ceramics","Natural wine","Pottery"],
    sharedEvent:"Wheel throwing - make two mugs", overlap:null,
    lifeTags:["New to Newtown","Dog person"], been:6,
    bio:"Here for the making and whoever's there for it too. I'll happily talk your ear off about glazes.",
    prompt:{ q:"You'll find me", a:"at the pottery studio most Sundays, then a wine bar to wind down." } },
  { name:"Jules M.", age:31, intent:"open to dating",
    tags:["Pottery","Live music","Film"],
    sharedEvent:null, sharedMusic:"house & techno",
    lifeTags:["Inner West","Plays in a band"], been:11,
    bio:"Potter by hobby, gig-goer by habit. Looking for people to do both with - no small talk required.",
    prompt:{ q:"A perfect Saturday", a:"a slow morning, a workshop, then something loud at night." } },
  { name:"Tom K.", age:27, intent:"here for the activities",
    tags:["Coffee","Film","Cycling"],
    sharedEvent:null, sharedMusic:null, proximity:"You're both nearby",
    lifeTags:["Marrickville","Early riser"], been:4,
    bio:"Always up for trying the thing once. I'll bring the good coffee.",
    prompt:{ q:"Ask me about", a:"the best filter coffee in the inner west - I have strong opinions." } },
];

/* Activity - quiet milestones, never a notification dump. Opportunity framing. */
const ACTIVITY = [
  { ic:"check",    text:"You went to Pasta from scratch",          when:"2 days ago" },
  { ic:"spark",    text:"Your radar updated - a few familiar faces", when:"3 days ago" },
  { ic:"bookmark", text:"You saved Greenhouse terrarium build",     when:"5 days ago" },
  { ic:"calendar", text:"You saved a spot at Wheel throwing",        when:"last week" },
];

/* neutral browse-by-category tags (not the coloured event category chips) */
const CATEGORIES = ["Pottery","Run clubs","Wine","Cooking","Live music","Markets"];

/* INTEREST TAGS (07 §interest_tags) — the SPECIFIC things a profile selects, grouped under
   their category heading. Canonical 16-category order; first 8 show by default, the rest behind
   "Show more". Dating is gated to dating-intent users. A profile picks TAGS, never categories. */
const INTEREST_TAGS = [
  { key:"wellness",  label:"Wellness",        tags:["Yoga","Pilates","Meditation","Breathwork","Sound baths","Cold plunge"] },
  { key:"food",      label:"Food & Drink",    tags:["Wine tasting","Natural wine","Cocktails","Cooking classes","Pasta making","Coffee","Long lunches","Baking"] },
  { key:"arts",      label:"Arts & Crafts",   tags:["Pottery","Ceramics","Life drawing","Painting","Printmaking","Glass-blowing","Candle making"] },
  { key:"social",    label:"Social",          tags:["Trivia nights","Board games","Book club","Dinner parties","Pub quizzes"] },
  { key:"music",     label:"Music",           tags:["Live music","Gigs","Vinyl","Open mic","Festivals","Jazz nights"] },
  { key:"fitness",   label:"Fitness & Sport", tags:["Run clubs","Bouldering","Tennis","Boxing","Swimming","Cycling"] },
  { key:"outdoors",  label:"Outdoors",        tags:["Hiking","Surfing","Kayaking","Beach days","Bushwalks","Camping"] },
  { key:"learning",  label:"Learning",        tags:["Workshops","Talks & lectures","Languages","Photography","Writing"] },
  { key:"networking",label:"Networking",      tags:["Founders","Tech meetups","Creative industries","Side projects"] },
  { key:"dance",     label:"Dance",           tags:["Salsa","Swing","Contemporary","Hip hop","Line dancing"] },
  { key:"creative",  label:"Creative",        tags:["Film","Design","DIY","Crafts","Zines"] },
  { key:"lifestyle", label:"Lifestyle",       tags:["Plants","Thrifting","Markets","Interiors","Slow living"] },
  { key:"community", label:"Community",       tags:["Volunteering","Local causes","Community gardens"] },
  { key:"travel",    label:"Travel",          tags:["Weekend trips","Road trips","Day trips","Backpacking"] },
  { key:"family",    label:"Family",          tags:["Kid-friendly","Playgroups","Family outings"] },
  { key:"dating",    label:"Dating", gated:true, tags:["Coffee dates","Walk & talk","Dinner dates","Day-date ideas"] },
];
/* MUSIC TAGS (07 §9) — a fixed 25-genre soft affinity signal; NOT a category, NOT used for filtering. */
const MUSIC_TAGS = ["Pop","Rock","Jazz","Electronic","House","Techno","Trance","Hip Hop","R&B","Indie","Folk","Classical","Lo-Fi","Reggae","Acoustic","Soul","Funk","Country","Latin","Punk","Afrobeats","Disco","Ambient","Metal","Blues"];

const CLICKS = [
  { id:"c1", name:"Mia R.",  event:"Wheel throwing - make two mugs", when:"Thu 6:30pm", met:"Saturday", intent:"friends", sharedEvent:"Wheel throwing - make two mugs", tags:["Ceramics","Natural wine"], dating:false, state:"mutual", coord:"their_turn", suburb:"Newtown" },
  { id:"c2", name:"Jules M.", event:"Open-decks vinyl night", when:"Fri", intent:"friends", sharedMusic:"house & live sets", tags:["Pottery","Live music"], dating:true, state:"mutual", coord:"open", suggestion:{ name:"Open-decks vinyl night", when:"Fri" }, suburb:"Marrickville" },
  { id:"c6", name:"Noa B.",  event:"Long lunch, four courses", when:"Sun 1pm", intent:"friends", commonLife:"Both pet owners", tags:["Wine","Cooking"], dating:false, state:"mutual", coord:"proposed_waiting", lastActive:"2h", suburb:"Surry Hills" },
  { id:"c4", name:"Priya S.", event:"Greenhouse terrarium build", when:"Sat · 2:00pm · Redfern", intent:"friends", tags:["Plants","Markets"], dating:false, state:"plan", planEvent:"ev2", suburb:"Redfern" },
  { id:"c5", name:"Tom K.",   event:"Sunrise run + coffee, 5k", plan:"Sunrise run + coffee", when:"last week", intent:"the activities", tags:["Coffee","Film"], dating:false, state:"connected", suburb:"Marrickville" },
  { id:"c7", name:"Eli W.",  intent:"friends", proximity:"You're both nearby", tags:["Film","Cycling"], dating:false, state:"mutual", coord:"open", suburb:"Newtown" },
  { id:"c3", name:"Hassan A.", event:"Native cocktails, four pours", when:"Fri", state:"released", suburb:"Surry Hills" },
];

/* relative-time from when an event ENDED - magic-protective (never a timer/countdown).
   same calendar day -> "earlier today"; day before -> "yesterday"; within ~6 days ->
   "on [weekday]"; older -> the date. Capitalised; lower-case it at the call site if needed. */
function relativeEventTime(end, now){
  now = now || new Date();
  const d0 = new Date(now); d0.setHours(0,0,0,0);
  const e0 = new Date(end); e0.setHours(0,0,0,0);
  const days = Math.round((d0 - e0) / 86400000);
  if(days <= 0) return "Earlier today";
  if(days === 1) return "Yesterday";
  if(days <= 6) return "On " + ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(end).getDay()];
  return new Date(end).toLocaleDateString("en-AU",{ day:"numeric", month:"short" });
}
/* the recent event ended ~a day ago in the demo -> "Yesterday" */
const RECENT_REL = relativeEventTime(new Date(Date.now() - 24*3600*1000));

/* attendance-gated pool for "Who was there" - everyone who attended RECENT (Pasta from
   scratch) and is visible. The commonality LINE carries a NON-interest axis (a different
   earlier event / shared music / cluster proximity); life tags stay private until mutual,
   so the pre-mutual who-was-there line never uses them. Interests live in the tags only. */
const WERE_THERE = [
  { ...ATT.bec,   sharedEvent:"Greenhouse terrarium build" },
  { ...ATT.aisha, sharedMusic:"jazz & soul" },
  { ...ATT.jules, dating:true, mutual:true, sharedMusic:"house & techno" },
  { ...ATT.mia,   proximity:"You're both nearby" },
  { ...ATT.sam,   dating:true },
  { ...ATT.priya },
  { ...ATT.hassan },
  { ...ATT.tom },
  { ...ATT.daniel },
  { ...ATT.linh },
  { name:"Otis P.",  intent:"open to dating",          tags:["Wine","Cooking","Film"],      age:32, suburb:"Chippendale, Sydney", been:4, dating:true, bio:"Long dinners, longer films. I'll bring a good bottle." },
  { name:"Rae M.",   intent:"here for friends",         tags:["Pasta","Markets","Coffee"],   age:28, suburb:"Camperdown, Sydney", been:5, sharedMusic:"folk & indie", bio:"Weekend markets then something on the stove. Easy company, no agenda." },
  { name:"Noa B.",   intent:"growing my circle",        tags:["Wine","Cooking","Hiking"],    age:30, suburb:"Stanmore, Sydney",   been:6, proximity:"You're both nearby", bio:"New-ish crew, always room for one more at the table." },
  { name:"Cam D.",   intent:"here for the activities",  tags:["Cycling","Coffee","Design"],  age:29, suburb:"Petersham, Sydney",  been:3, bio:"Here for the making. Will cycle a long way for a good flat white." },
  { name:"Wren L.",  intent:"open to dating",           tags:["Vinyl","Film","Cocktails"],   age:27, suburb:"Enmore, Sydney",     been:4, dating:true, bio:"Records, repertory cinema, a negroni after. That's the night." },
  { name:"Eli W.",   intent:"here for friends",         tags:["Film","Cycling","Coffee"],    age:31, suburb:"Lewisham, Sydney",   been:7, bio:"Up for most things midweek. Good chat, low stakes." },
];

window.DATA = { EVENTS, BOOKINGS, SAVED, WAITLIST, PAST, MYDATES, SUGGEST_A, SUGGEST_B, RECENT, RECENT_REL, relativeEventTime, WERE_THERE, RADAR, RADAR_EVENTS, RADAR_COLD, CLICK_SUGGEST, ACTIVITY, CATEGORIES, INTEREST_TAGS, MUSIC_TAGS, CLICKS, byId:(id)=>EVENTS.find(e=>e.id===id) };
})();
