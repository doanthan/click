/* @ds-bundle: {"format":4,"namespace":"ClickDesignSystem_51aca0","components":[{"name":"AttendeeRow","sourcePath":"components/app/AttendeeRow.jsx"},{"name":"EventCard","sourcePath":"components/app/EventCard.jsx"},{"name":"IntentLine","sourcePath":"components/app/IntentLine.jsx"},{"name":"MutualCard","sourcePath":"components/app/MutualCard.jsx"},{"name":"PeopleCard","sourcePath":"components/app/PeopleCard.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"AvatarStack","sourcePath":"components/core/AvatarStack.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Spark","sourcePath":"components/core/Logo.jsx"},{"name":"Logo","sourcePath":"components/core/Logo.jsx"},{"name":"Cmark","sourcePath":"components/core/Logo.jsx"},{"name":"AppTile","sourcePath":"components/core/Logo.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Toggle","sourcePath":"components/forms/Toggle.jsx"},{"name":"CapacityMeter","sourcePath":"components/merchant/CapacityMeter.jsx"},{"name":"StatCard","sourcePath":"components/merchant/StatCard.jsx"},{"name":"StatusPill","sourcePath":"components/merchant/StatusPill.jsx"},{"name":"WizardStepper","sourcePath":"components/merchant/WizardStepper.jsx"}],"sourceHashes":{"click-app-v2/app-screens.jsx":"469cb0eed084","click-app-v2/auth.jsx":"7b258f1c4810","click-app-v2/coordination.jsx":"5d56b0fbcfca","click-app-v2/dashboard.jsx":"5a06f19755a7","click-app-v2/data.jsx":"a60c73dd46fc","click-app-v2/discovery.jsx":"af8ddf7fcdf9","click-app-v2/event-detail.jsx":"4d479e158b10","click-app-v2/howitworks.jsx":"29161994634e","click-app-v2/kit.jsx":"c4bd1f6109e2","click-app-v2/mechanic-screens.jsx":"6bbc9f5f7b58","click-app-v2/merchant-create.jsx":"f39aa5e61446","click-app-v2/merchant.jsx":"c4fce8a05283","click-app-v2/myevents.jsx":"2ac906e9a88b","click-app-v2/onboarding.jsx":"e7deba7f3e16","click-app-v2/quiz.jsx":"bce67571be30","click-app-v2/settings.jsx":"e4e9790bdbfc","click-app-v2/shell.jsx":"fc8749237c79","click-app-v2/skeletons.jsx":"dcf758940162","click-app-v2/tweaks-panel.jsx":"7fd7d9cae8ff","components/app/AttendeeRow.jsx":"46a9abfa8128","components/app/EventCard.jsx":"0eb60bab3def","components/app/IntentLine.jsx":"f9880496ba29","components/app/MutualCard.jsx":"b8a7bb38bb48","components/app/PeopleCard.jsx":"155c37acd2c3","components/core/Avatar.jsx":"2bb219ab32b5","components/core/AvatarStack.jsx":"fce91a838985","components/core/Badge.jsx":"f0fa002e5749","components/core/Button.jsx":"9ef487956e54","components/core/Logo.jsx":"fa273b48e587","components/core/Tag.jsx":"d78d6eb14d7a","components/forms/Input.jsx":"b38e47ffb4f7","components/forms/Select.jsx":"d74347eb94c9","components/forms/Toggle.jsx":"a2ca8f97a4b8","components/merchant/CapacityMeter.jsx":"87919daeef82","components/merchant/StatCard.jsx":"e16f4ac4800d","components/merchant/StatusPill.jsx":"bf6210b695eb","components/merchant/WizardStepper.jsx":"4b01250edd4d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ClickDesignSystem_51aca0 = window.ClickDesignSystem_51aca0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// click-app-v2/app-screens.jsx
try { (() => {
(function () {
  /* Click - marketing + profile + the SHARED EventCard. Reads primitives from window.CK, data from window.DATA.
     ONE-PAGE-PER-CONCEPT (structure audit, 28 Jun): this file owns only Landing, Profile, and the
     canonical EventCard (used by dashboard / discovery / myevents / quiz). The former duplicate
     Home / Discover / Saved page components were removed - the routed canon lives in
     dashboard.jsx (ScreensDash.Dashboard), discovery.jsx (ScreensDisc.Discover), myevents.jsx
     (ScreensME.MyEvents). Do NOT re-add page components here. */
  const {
    useState,
    CAT,
    STATUS,
    Icon,
    Logo,
    Spark,
    Cmark,
    AppTile,
    Btn,
    Field,
    Toggle,
    Avatar,
    Stack,
    Tag,
    FitTags,
    Badge,
    Status,
    IntentLine,
    Cover
  } = window.CK;
  const {
    EVENTS,
    BOOKINGS,
    SAVED,
    CLICKS,
    byId
  } = window.DATA;

  /* ---------------- shared bits ---------------- */
  function Eyebrow({
    children,
    color = "var(--purple-600)"
  }) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        font: "var(--role-overline)",
        fontWeight: 700,
        letterSpacing: "var(--tracking-overline)",
        textTransform: "uppercase",
        color
      }
    }, children);
  }
  function SaveBtn({
    saved,
    onClick,
    light
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        onClick && onClick();
      },
      "aria-label": "Save for later",
      style: {
        width: 38,
        height: 38,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: light ? "rgba(253,250,246,.92)" : "var(--white)",
        boxShadow: "var(--shadow-sm)",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bookmark",
      size: 18,
      w: 2,
      color: saved ? "var(--purple-600)" : "var(--ink-muted)",
      style: {
        fill: saved ? "var(--purple-600)" : "none"
      }
    }));
  }

  /* ---------------- event card (all status states) ---------------- */
  function EventCard({
    e,
    onClick,
    saved,
    onSave,
    booked,
    radarLine,
    mini
  }) {
    const [hov, setHov] = useState(false);
    const isBooked = booked != null ? booked : window.DATA.BOOKINGS.includes(e.id);
    const full = e.status === "soldout" || e.full || e.cap != null && e.count >= e.cap;
    const free = e.price === "Free";
    const tags = e.tags || [];
    const go = ev => {
      ev.stopPropagation();
      onClick && onClick();
    };

    /* ONE status badge, top-left (booked > full > status > free) */
    let badge = null;
    if (isBooked) badge = /*#__PURE__*/React.createElement(Status, {
      kind: "going"
    });else if (full) badge = /*#__PURE__*/React.createElement(Status, {
      kind: "full"
    });else if (e.status && e.status !== "free") badge = /*#__PURE__*/React.createElement(Status, {
      kind: e.status
    });else if (free) badge = /*#__PURE__*/React.createElement(Status, {
      kind: "free"
    });

    /* MOBILE MINI (2-up): 16:9 banner · date · title(2) · suburb · price + N going.
       No inline RSVP, no tag row - the whole card taps through to the event detail. */
    if (mini) return /*#__PURE__*/React.createElement("div", {
      onClick: onClick,
      style: {
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-soft)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: e.category,
      aspect: "16/9",
      dim: full,
      photo: e.photo
    }), badge && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 8,
        left: 8,
        transform: "scale(.9)",
        transformOrigin: "top left"
      }
    }, badge), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 8,
        right: 8
      }
    }, /*#__PURE__*/React.createElement(SaveBtn, {
      saved: saved,
      onClick: onSave,
      light: true
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: 11
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        minWidth: 0,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 12,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, e.when)), /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: "4px 0 0",
        fontFamily: "var(--font-display)",
        fontSize: "var(--card-title)",
        fontWeight: 600,
        letterSpacing: "-.01em",
        lineHeight: "22px",
        color: "var(--text-strong)",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        minWidth: 0
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        minWidth: 0,
        marginTop: 5,
        fontSize: 12.5,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 12,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, [e.suburb, e.dist].filter(Boolean).join(" · "))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: "auto",
        paddingTop: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 15,
        fontWeight: 600,
        color: free ? "var(--success)" : "var(--text-strong)"
      }
    }, e.price), e.count >= 3 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        fontWeight: 500,
        whiteSpace: "nowrap"
      }
    }, e.count, " going"))));
    return /*#__PURE__*/React.createElement("div", {
      onClick: onClick,
      onMouseEnter: () => setHov(true),
      onMouseLeave: () => setHov(false),
      style: {
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-soft)",
        boxShadow: hov ? "var(--shadow-lg)" : "var(--shadow-sm)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow .2s,transform .2s",
        transform: hov ? "translateY(-3px)" : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: e.category,
      aspect: "16/9",
      dim: full,
      photo: e.photo
    }), badge && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 13,
        left: 13
      }
    }, badge), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 13,
        right: 13
      }
    }, /*#__PURE__*/React.createElement(SaveBtn, {
      saved: saved,
      onClick: onSave,
      light: true
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, e.when)), /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: "6px 0 0",
        fontFamily: "var(--font-display)",
        fontSize: "var(--card-title)",
        fontWeight: 600,
        letterSpacing: "-.01em",
        lineHeight: "24px",
        color: "var(--text-strong)",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        minWidth: 0
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        marginTop: 6,
        fontSize: 13.5,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 14,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, isBooked ? [e.venue, e.suburb].filter(Boolean).join(" · ") : [e.suburb, e.dist].filter(Boolean).join(" · ")), !isBooked && /*#__PURE__*/React.createElement("span", {
      title: "Venue shown when you RSVP",
      "aria-label": "Venue shown when you RSVP",
      style: {
        flex: "none",
        display: "inline-flex",
        marginLeft: 1
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 11,
      w: 2,
      color: "var(--text-faint)"
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, tags.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(FitTags, {
      tags: tags,
      max: 3
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: tags.length > 0 ? 8 : 0
      }
    }, e.count >= 3 ? /*#__PURE__*/React.createElement(Stack, {
      people: e.going,
      size: 24,
      label: `${e.count} going`
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, "Be one of the first")), radarLine && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginTop: 8,
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--purple-700)",
        lineHeight: 1.3
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: radarLine.icon || "spark",
      size: 14,
      w: 1.9,
      color: "var(--purple-500)"
    }), /*#__PURE__*/React.createElement("span", null, radarLine.line))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: "auto",
        paddingTop: 12,
        borderTop: "1px solid var(--mist)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 16,
        fontWeight: 600,
        color: free ? "var(--success)" : "var(--text-strong)"
      }
    }, e.price), isBooked ? /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      size: "sm",
      onClick: go
    }, "View details") : full ? /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      onClick: go
    }, "Join waitlist") : /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      onClick: go
    }, "RSVP"))));
  }

  /* ---------------- candid "real life is happening" band - backlit warm gathering,
     people PRESENT but faces turned/cropped (silhouettes, never identifiable). ---------------- */
  function GatheringScene() {
    const figs = [70, 200, 330, 470, 600, 725];
    return /*#__PURE__*/React.createElement("svg", {
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block"
      },
      viewBox: "0 0 800 360",
      preserveAspectRatio: "xMidYMid slice"
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "rlSky",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#F4C56B"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: ".6",
      stopColor: "#D8924E"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#7A4A2E"
    })), /*#__PURE__*/React.createElement("radialGradient", {
      id: "rlGlow",
      cx: ".5",
      cy: ".3",
      r: ".55"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#FFE6A8",
      stopOpacity: ".9"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#FFE6A8",
      stopOpacity: "0"
    }))), /*#__PURE__*/React.createElement("rect", {
      width: "800",
      height: "360",
      fill: "url(#rlSky)"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "120",
      y: "18",
      width: "560",
      height: "180",
      rx: "12",
      fill: "#FBE3A0",
      opacity: ".5"
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "400",
      cy: "120",
      rx: "330",
      ry: "150",
      fill: "url(#rlGlow)"
    }), [80, 180, 300, 430, 560, 690, 745].map((x, i) => /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: x,
      cy: 28 + i % 3 * 10,
      r: 4 - i % 2,
      fill: "#FFEFC4",
      opacity: ".8"
    })), /*#__PURE__*/React.createElement("rect", {
      x: "0",
      y: "250",
      width: "800",
      height: "110",
      fill: "#5E3A24"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "0",
      y: "240",
      width: "800",
      height: "14",
      fill: "#7A4A2E"
    }), [120, 250, 400, 540, 670].map((x, i) => /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("ellipse", {
      cx: x,
      cy: "246",
      rx: "20",
      ry: "5",
      fill: "#3E2418"
    }), /*#__PURE__*/React.createElement("rect", {
      x: x - 5,
      y: "214",
      width: "10",
      height: "30",
      rx: "3",
      fill: "#C98A55",
      opacity: ".5"
    }), /*#__PURE__*/React.createElement("path", {
      d: `M${x - 8} 214 q8 -6 16 0 z`,
      fill: "#F4C56B",
      opacity: ".6"
    }))), figs.map((x, i) => {
      const hy = 150 + i % 2 * 8;
      return /*#__PURE__*/React.createElement("g", {
        key: i,
        fill: "#3A2014"
      }, /*#__PURE__*/React.createElement("ellipse", {
        cx: x,
        cy: hy,
        rx: "26",
        ry: "20"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M${x - 44} 250 q4 -54 44 -56 q40 2 44 56 z`
      }));
    }), /*#__PURE__*/React.createElement("g", {
      stroke: "#F4C56B",
      strokeWidth: "6",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M250 150 l18 -34"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M330 150 l-18 -34"
    })), /*#__PURE__*/React.createElement("ellipse", {
      cx: "270",
      cy: "112",
      rx: "9",
      ry: "6",
      fill: "#FBE3A0"
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "310",
      cy: "112",
      rx: "9",
      ry: "6",
      fill: "#FBE3A0"
    }));
  }
  function RealLifeBand({
    web
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...{
          maxWidth: web ? "var(--container-max)" : "none",
          margin: "0 auto",
          padding: web ? "8px 40px 18px" : "8px 22px 14px"
        },
        padding: "20px 40px 40px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        borderRadius: web ? 24 : 18,
        overflow: "hidden",
        minHeight: web ? 300 : 320,
        display: "flex",
        alignItems: "flex-end",
        boxShadow: "var(--shadow-md)"
      }
    }, /*#__PURE__*/React.createElement(GatheringScene, null), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        background: "linear-gradient(90deg,rgba(38,20,10,.66),rgba(38,20,10,.14) 58%,transparent)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        padding: web ? "36px 40px" : "24px 22px",
        maxWidth: 520
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: web ? "clamp(22px,2.6cqi,30px)" : 21,
        fontWeight: 600,
        lineHeight: 1.2,
        color: "var(--cream)",
        textWrap: "balance"
      }
    }, "Real things, real people - across inner Sydney."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "10px 0 0",
        fontSize: web ? 15.5 : 14,
        lineHeight: 1.55,
        color: "rgba(249,246,240,.92)",
        maxWidth: 420
      }
    }, "What's on this week across Newtown, Surry Hills & Redfern - small groups, real places, every week."))));
  }

  /* ---------------- 1 · LANDING (marketing, pre-signup) ---------------- */
  function Landing({
    web,
    enter,
    auth
  }) {
    const [postcode, setPostcode] = useState("");
    const [email, setEmail] = useState("");
    const [mode, setMode] = useState("pre");
    const [open, setOpen] = useState(false);
    const [sent, setSent] = useState(false);
    const steps = [["compass", "Find something on", "Real venues, real things to do - this week, near you. Browse what's on and RSVP."], ["users", "Show up", "The activity is the icebreaker. You're in the room with people who chose the same thing."], ["spark", "If you click, you both find out", "Quietly note who you clicked with. Nothing happens unless they feel the same."]];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100%",
        background: "var(--cream)",
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: web ? "22px 40px" : "16px 20px",
        maxWidth: web ? "var(--container-max)" : "none",
        margin: "0 auto"
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: web ? 16 : 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)",
        padding: 3,
        gap: 2
      }
    }, [["pre", "Pre-launch"], ["post", "Post-launch"]].map(([k, l]) => {
      const on = mode === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => {
          setMode(k);
          setOpen(false);
          setSent(false);
        },
        style: {
          border: "none",
          cursor: "pointer",
          borderRadius: "var(--radius-pill)",
          padding: "6px 12px",
          fontFamily: "var(--font-display)",
          fontSize: 12.5,
          fontWeight: on ? 700 : 500,
          background: on ? "var(--purple-600)" : "transparent",
          color: on ? "var(--cream)" : "var(--text-body)"
        }
      }, l);
    })), mode === "post" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: web ? 8 : 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => auth ? auth("signin") : enter(),
      style: {
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 500,
        color: "var(--text-body)",
        padding: "8px 10px"
      }
    }, "Log in"), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      onClick: () => auth ? auth("signup") : enter()
    }, "Sign up")))), /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? "var(--container-max)" : "none",
        margin: "0 auto",
        padding: web ? "clamp(24px,5cqi,56px) 40px 56px" : "14px 22px 36px",
        display: web ? "grid" : "block",
        gridTemplateColumns: web ? "1.1fr .9fr" : "none",
        gap: web ? 72 : 0,
        alignItems: "start"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 560
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: web ? 104 : 74
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: web ? "18px 0 0" : "14px 0 0",
        fontSize: web ? 19 : 16,
        color: "var(--text-muted)"
      }
    }, "/kl\u026Ak/ \xB7 ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontStyle: "italic"
      }
    }, "verb")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12,
        margin: "18px 0 0"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        fontFamily: "var(--font-display)",
        fontSize: web ? "clamp(22px,2.6cqi,28px)" : 21,
        fontWeight: 600,
        lineHeight: 1.5,
        color: "var(--purple-500)"
      }
    }, "1."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: web ? "clamp(22px,2.6cqi,28px)" : 21,
        lineHeight: 1.5,
        color: "var(--text-strong)",
        textWrap: "pretty"
      }
    }, "to connect effortlessly with someone through shared curiosity, energy, or experience.")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "12px 0 0 36px",
        fontSize: web ? 16 : 14.5,
        fontStyle: "italic",
        lineHeight: 1.55,
        color: "var(--text-muted)",
        textWrap: "pretty"
      }
    }, "\u201Cwe met at pickleball and just clicked!\u201D"), /*#__PURE__*/React.createElement("hr", {
      style: {
        border: "none",
        borderTop: "1px solid var(--border-mid)",
        margin: "28px 0 0",
        width: 110,
        marginLeft: 0
      }
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "24px 0 0",
        fontFamily: "var(--font-display)",
        fontSize: web ? 19 : 17,
        fontWeight: 500,
        lineHeight: 1.45,
        color: "var(--text-strong)",
        maxWidth: 440,
        textWrap: "pretty"
      }
    }, "We help people click in real life - not just online.")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: web ? 6 : 34
      }
    }, mode === "pre" ? sent ? /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 420
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--success) 16%,#fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 24,
      w: 2.6,
      color: "var(--success)"
    })), /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: "0 0 10px",
        fontFamily: "var(--font-display)",
        fontSize: web ? 24 : 21,
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: "var(--text-strong)"
      }
    }, "You're on the list."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 20px",
        fontSize: 15,
        lineHeight: 1.6,
        color: "var(--text-muted)"
      }
    }, "We'll be in touch when your suburb opens. No rush - good things are worth showing up for."), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        boxShadow: "var(--shadow-sm)"
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      color: "var(--text-muted)"
    }, "Want in sooner?"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "10px 0 14px",
        fontSize: 14.5,
        lineHeight: 1.6,
        color: "var(--text-strong)"
      }
    }, "Invite friends - every one moves you up. ", /*#__PURE__*/React.createElement("b", null, "Three guarantees you a spot in the first round.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--cream)",
        border: "1px solid var(--border-soft)",
        borderRadius: 10,
        padding: "10px 12px"
      }
    }, /*#__PURE__*/React.createElement("code", {
      style: {
        flex: 1,
        fontFamily: "ui-monospace,Menlo,monospace",
        fontSize: 13,
        color: "var(--text-strong)"
      }
    }, "click.au/i/ava-m"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--purple-600)"
      }
    }, "Copy link"))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 18
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      onClick: enter,
      icon: "arrowR"
    }, "Take me in"))) : /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 400
      }
    }, !open ? /*#__PURE__*/React.createElement(Btn, {
      size: "lg",
      onClick: () => setOpen(true)
    }, "Request an invite") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Field, {
      placeholder: "you@email.com",
      icon: "bell",
      value: email,
      onChange: setEmail
    }), /*#__PURE__*/React.createElement(Field, {
      placeholder: "Suburb or postcode",
      icon: "pin",
      value: postcode,
      onChange: setPostcode
    }), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      size: "lg",
      onClick: () => setSent(true)
    }, "Request an invite")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "18px 0 0",
        fontSize: 14,
        lineHeight: 1.55,
        color: "var(--text-muted)",
        maxWidth: 380
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text-strong)"
      }
    }, "Invite-only."), " Launching first in Sydney. 40+ events already in the works."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "10px 0 0",
        fontSize: 13.5,
        lineHeight: 1.55,
        color: "var(--text-muted)",
        maxWidth: 380
      }
    }, "Somewhere else? Join anyway - we'll tell you the moment Click reaches you."), /*#__PURE__*/React.createElement("span", {
      onClick: enter,
      style: {
        display: "inline-block",
        marginTop: 18,
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 500,
        color: "var(--purple-600)",
        borderBottom: "1px solid color-mix(in srgb,var(--purple-600) 30%,transparent)",
        paddingBottom: 1,
        cursor: "pointer"
      }
    }, "How clicking works \u2192")) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
      size: "lg",
      onClick: () => auth ? auth("signup") : enter()
    }, "Get in"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "16px 0 0",
        fontSize: 14.5,
        lineHeight: 1.55,
        color: "var(--text-muted)",
        maxWidth: 380
      }
    }, "Free to join. Live in Sydney. Somewhere else? Join anyway - we'll tell you the moment Click reaches you."), /*#__PURE__*/React.createElement("span", {
      onClick: enter,
      style: {
        display: "inline-block",
        marginTop: 18,
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 500,
        color: "var(--purple-600)",
        borderBottom: "1px solid color-mix(in srgb,var(--purple-600) 30%,transparent)",
        paddingBottom: 1,
        cursor: "pointer"
      }
    }, "How clicking works \u2192")))), mode === "post" && /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? "var(--container-max)" : "none",
        margin: "0 auto",
        padding: web ? "8px 40px 12px" : "0 22px 8px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.14375rem, 0.982rem + 0.69cqi, 1.5rem)",
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: "var(--text-strong)"
      }
    }, "What's on near you this week"), /*#__PURE__*/React.createElement("span", {
      onClick: enter,
      style: {
        flex: "none",
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-600)",
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "See everything on \u2192")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(auto-fill,minmax(280px,1fr))" : "repeat(2,1fr)",
        gap: web ? 22 : 12
      }
    }, EVENTS.slice(0, 3).map(e => /*#__PURE__*/React.createElement(EventCard, {
      key: e.id,
      e: e,
      mini: !web,
      onClick: enter,
      saved: false,
      onSave: () => {}
    })))), mode === "post" && /*#__PURE__*/React.createElement(RealLifeBand, {
      web: web
    }));
  }

  /* ---------------- Profile (with visibility opt-out) ---------------- */
  /* neutral interest/intent chip - white fill, Mist hairline, Ink (per Buttons_Tags) */
  function SelChip({
    active,
    onClick,
    children
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      style: {
        padding: "7px 15px",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        border: `1.5px solid ${active ? "var(--purple-600)" : "var(--border-mid)"}`,
        background: active ? "var(--purple-600)" : "var(--white)",
        color: active ? "var(--cream)" : "var(--text-body)",
        fontFamily: "var(--font-sans)",
        transition: "all .15s"
      }
    }, children);
  }
  function NeutralChip({
    children
  }) {
    return /*#__PURE__*/React.createElement(Tag, null, children);
  }
  function SectionLabel({
    children
  }) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 12px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-600)"
      }
    }, children);
  }
  function Profile({
    web,
    onEdit
  }) {
    /* warm-graded lifestyle photos (the app's canonical real-photo stand-in) - never empty dashed slots */
    const PHOTOS = [["ceramics", "Ava at the wheel", "bright"], ["run", "Sunrise run, Marrickville", "cool"], ["wine", "Wine bar evening", "warm"], ["music", "Open-decks night", "dusk"]];
    const HISTORY = [["Wheel throwing - two mugs", "Posy Ceramics, Newtown · Thu 6:30pm"], ["Sunrise run + coffee, 5k", "Marrickville · Sat 6:15am"], ["Native cocktails, four pours", "Surry Hills · Fri 7pm"]];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: web ? "8px 0 40px" : "0 0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 1060 : "none",
        margin: "0 auto",
        padding: web ? "0 40px" : "0 22px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 660 : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--white)",
        borderRadius: 18,
        border: "1px solid #EDE9F2",
        boxShadow: "0 2px 10px rgba(28,24,48,.05)",
        padding: web ? 30 : 22,
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: web ? 18 : 14,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: web ? 80 : 64,
        height: web ? 80 : 64,
        borderRadius: "50%",
        overflow: "hidden",
        flex: "none",
        boxShadow: "0 0 0 3px var(--white), 0 0 0 4px var(--lavender-300)"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: "wine",
      h: web ? 80 : 64,
      photo: "Ava - warm portrait",
      tone: "warm"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        marginBottom: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-600)"
      }
    }, "Your profile"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h1)",
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        color: "var(--ink)",
        lineHeight: 1.2
      }
    }, "Ava \xB7 28"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: web ? 14 : 13,
        color: "var(--text-muted)",
        fontWeight: 500,
        marginTop: 7,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 14,
      w: 1.9,
      color: "var(--text-muted)",
      style: {
        flex: "none"
      }
    }), "Newtown \xB7 ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--purple-600)",
        fontWeight: 600
      }
    }, web ? "been to 6 events" : "6 events")))), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      onClick: onEdit
    }, web ? "Edit profile" : "Edit")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "#EDE9F2",
        margin: "20px 0"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement(SectionLabel, null, "Bio"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 16.5,
        lineHeight: 1.6,
        color: "var(--text-strong)"
      }
    }, "Moved back to Sydney and after a steady weekend circle - pottery, runs, easy company.")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement(SectionLabel, null, "Here for"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }
    }, ["Here for friends", "Open to activities"].map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      style: {
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 13px",
        fontSize: 13,
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        background: "var(--lavender-wash)",
        border: "1px solid var(--lavender-300)",
        color: "var(--ink)",
        whiteSpace: "nowrap"
      }
    }, t)))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement(SectionLabel, null, "Into"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }
    }, ["Pottery", "Run clubs", "Live music", "Wine", "Plants", "Cocktails"].map(t => /*#__PURE__*/React.createElement(NeutralChip, {
      key: t
    }, t)))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement(SectionLabel, null, "Photos"), PHOTOS.length > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(4,1fr)" : "repeat(3,1fr)",
        gap: 10
      }
    }, PHOTOS.map(([cat, desc, tone], i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        aspectRatio: "1",
        borderRadius: "var(--radius-md)",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: cat,
      aspect: "1",
      photo: desc,
      tone: tone
    })))) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--lavender-100)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "camera",
      size: 20,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.3
      }
    }, "Add a few photos so people can put a face to the name"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        marginTop: 2
      }
    }, "A face helps people place you when you click after an event.")), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "secondary",
      icon: "plus"
    }, "Add photos"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionLabel, null, "Events you've been to"), /*#__PURE__*/React.createElement("div", null, HISTORY.map(([name, meta], i) => /*#__PURE__*/React.createElement("div", {
      key: name,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "12px 0",
        borderTop: i ? "1px solid #EDE9F2" : "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 38,
        height: 38,
        borderRadius: "var(--radius-sm)",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 17,
      w: 1.9,
      color: "var(--purple-500)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, meta)), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--success)",
        background: "color-mix(in srgb,var(--success) 12%,var(--white))",
        border: "1px solid color-mix(in srgb,var(--success) 24%,transparent)",
        borderRadius: "var(--radius-pill)"
      }
    }, "Attended")))))))));
  }
  window.ScreensA = {
    Landing,
    EventCard,
    Profile,
    Eyebrow
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/app-screens.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/auth.jsx
try { (() => {
(function () {
  /* Click - Auth (sign in / sign up). One page, two modes; verify gate; reset flow.
     Minimal by design: email + password or SSO only. Identity lives in onboarding. */
  const {
    useState,
    Btn,
    Icon,
    Logo,
    Spark,
    Field
  } = window.CK;
  const COMMON = ["password", "12345678", "qwerty123", "password1", "11111111", "iloveyou1"];
  const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

  /* ---- Google / Apple marks (SSO) ---- */
  function GoogleMark() {
    return /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 48 48",
      style: {
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement("path", {
      fill: "#4285F4",
      d: "M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1Z"
    }), /*#__PURE__*/React.createElement("path", {
      fill: "#34A853",
      d: "M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46Z"
    }), /*#__PURE__*/React.createElement("path", {
      fill: "#FBBC05",
      d: "M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7Z"
    }), /*#__PURE__*/React.createElement("path", {
      fill: "#EA4335",
      d: "M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9Z"
    }));
  }
  function AppleMark() {
    return /*#__PURE__*/React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "var(--ink)",
      style: {
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M17.05 12.94c-.03-2.7 2.2-3.99 2.3-4.06-1.25-1.84-3.2-2.09-3.9-2.12-1.66-.17-3.24.97-4.08.97-.84 0-2.14-.95-3.52-.92-1.81.03-3.48 1.05-4.41 2.67-1.88 3.27-.48 8.1 1.35 10.76.89 1.3 1.96 2.76 3.36 2.71 1.35-.05 1.86-.87 3.49-.87 1.63 0 2.09.87 3.52.84 1.45-.03 2.37-1.32 3.26-2.63.65-.94 1.16-1.95 1.46-2.99-.03-.01-2.83-1.08-2.86-4.29M14.4 5.31c.74-.9 1.24-2.15 1.1-3.39-1.07.04-2.36.71-3.12 1.6-.68.79-1.28 2.06-1.12 3.27 1.19.09 2.41-.6 3.14-1.48"
    }));
  }
  function SSOButton({
    children,
    mark,
    onClick
  }) {
    const [h, setH] = useState(false);
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        height: 50,
        padding: "0 16px",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)",
        background: h ? "var(--surface-tint)" : "var(--white)",
        border: "1.5px solid var(--border-mid)",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        transition: "background .15s"
      }
    }, mark, children);
  }

  /* ---- password field with show/hide + live hints ---- */
  function PwField({
    label,
    value,
    onChange,
    show,
    setShow,
    forgot,
    autoFocus
  }) {
    const [f, setF] = useState(false);
    return /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, label), forgot && /*#__PURE__*/React.createElement("a", {
      onClick: forgot,
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--purple-600)",
        cursor: "pointer"
      }
    }, "Forgot password?")), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 8px 0 14px",
        height: 50,
        background: "var(--white)",
        border: `1.5px solid ${f ? "var(--accent)" : "var(--border-mid)"}`,
        borderRadius: "var(--radius-md)",
        boxShadow: f ? "0 0 0 4px color-mix(in srgb,var(--lavender-300) 45%,transparent)" : "none",
        transition: "border .15s,box-shadow .15s"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 18,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("input", {
      type: show ? "text" : "password",
      value: value,
      autoFocus: autoFocus,
      onChange: e => onChange(e.target.value),
      onFocus: () => setF(true),
      onBlur: () => setF(false),
      style: {
        flex: 1,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: "none",
        fontFamily: "var(--font-sans)",
        fontSize: 15.5,
        color: "var(--text-strong)"
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => setShow(!show),
      "aria-label": show ? "Hide password" : "Show password",
      style: {
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        border: "none",
        background: "none",
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        color: show ? "var(--purple-600)" : "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "eye",
      size: 18,
      w: 1.9,
      color: "currentColor"
    }))));
  }
  function Hint({
    ok,
    children
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 500,
        color: ok ? "var(--success)" : "var(--text-muted)",
        transition: "color .2s"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 15,
        height: 15,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ok ? "color-mix(in srgb,var(--success) 16%,var(--white))" : "var(--surface-tint)",
        border: `1px solid ${ok ? "color-mix(in srgb,var(--success) 35%,transparent)" : "var(--border-mid)"}`,
        transition: "background .2s,border .2s"
      }
    }, ok && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 9,
      w: 3,
      color: "var(--success)"
    })), children);
  }
  function Divider() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        margin: "4px 0"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1,
        background: "var(--border-soft)"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 500,
        color: "var(--text-faint)"
      }
    }, "or"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1,
        background: "var(--border-soft)"
      }
    }));
  }
  function ErrorBanner({
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      role: "alert",
      "aria-live": "assertive",
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "11px 13px",
        background: "color-mix(in srgb,var(--error) 8%,var(--white))",
        border: "1px solid color-mix(in srgb,var(--error) 28%,transparent)",
        borderRadius: "var(--radius-md)",
        fontSize: 13.5,
        lineHeight: 1.45,
        color: "var(--error)",
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "info",
      size: 16,
      w: 2,
      color: "var(--error)",
      style: {
        flexShrink: 0,
        marginTop: 1
      }
    }), /*#__PURE__*/React.createElement("span", null, children));
  }
  function Frame({
    web,
    children
  }) {
    /* centered calm column on cream */
    const split = false;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: web ? 560 : "auto",
        display: "flex",
        background: "var(--cream)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: web ? "56px 40px 64px" : "30px 22px 48px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        maxWidth: 412
      }
    }, children)), split && /*#__PURE__*/React.createElement("div", {
      style: {
        width: 380,
        flex: "none",
        borderLeft: "1px solid var(--border-soft)",
        background: "var(--surface-tint)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "56px 48px"
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: 34
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "26px 0 6px",
        fontFamily: "var(--font-mono,ui-monospace,monospace)",
        fontSize: 14,
        color: "var(--purple-600)",
        letterSpacing: ".02em"
      }
    }, "click /kl\u026Ak/ \xB7 ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-muted)"
      }
    }, "verb")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 19,
        lineHeight: 1.5,
        fontWeight: 500,
        color: "var(--text-strong)",
        maxWidth: 250
      }
    }, "to connect effortlessly with someone through shared curiosity, energy, or experience."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "22px 0 0",
        fontSize: 13.5,
        lineHeight: 1.55,
        color: "var(--text-muted)"
      }
    }, "Real events. Real people. No endless scrolling.")));
  }

  /* ============================ main ============================ */
  function Auth({
    web,
    start = "signup",
    done
  }) {
    const [mode, setMode] = useState(start === "signin" || start === "signin-error" ? "signin" : "signup");
    const [stage, setStage] = useState(start === "verify" ? "verify" : start === "reset" ? "reset-req" : "form");
    const [email, setEmail] = useState(start === "verify" ? "ava@example.com" : "");
    const [pw, setPw] = useState("");
    const [show, setShow] = useState(false);
    const [keep, setKeep] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(start === "signin-error");
    const [touchedEmail, setTouchedEmail] = useState(false);
    const [resend, setResend] = useState(0);
    const len8 = pw.length >= 8;
    const notCommon = pw.length > 0 && !COMMON.includes(pw.toLowerCase());
    const emailValid = emailOk(email);
    const showEmailErr = touchedEmail && email.length > 0 && !emailValid;
    const runResend = () => {
      setResend(30);
      const t = setInterval(() => setResend(s => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      }), 1000);
    };
    const submit = () => {
      setErr(false);
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        if (mode === "signup") {
          runResend();
          setStage("verify");
        } else {
          if (!touchedEmail) {}
          done && done();
        }
      }, 1100);
    };
    const submitReset = () => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStage("reset-sent");
      }, 1000);
    };
    const saveNew = () => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStage("done-reset");
      }, 1000);
    };

    /* ---------- email-verification gate ---------- */
    if (stage === "verify") return /*#__PURE__*/React.createElement(Frame, {
      web: web
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: 28
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 60,
        height: 60,
        margin: "30px auto 22px",
        borderRadius: "50%",
        background: "var(--surface-tint)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bell",
      size: 26,
      w: 1.7,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 10px",
        font: "var(--role-h3)",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 24,
        color: "var(--text-strong)"
      }
    }, "Check your inbox"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 auto",
        maxWidth: 340,
        fontSize: 15,
        lineHeight: 1.6,
        color: "var(--text-body)"
      }
    }, "We sent a link to ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text-strong)"
      }
    }, email || "your email"), " to confirm it's you. Tap it and you're in.")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26,
        display: "flex",
        flexDirection: "column",
        gap: 11
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: done
    }, "Have a look around while you wait"), /*#__PURE__*/React.createElement("button", {
      onClick: resend ? undefined : runResend,
      disabled: !!resend,
      style: {
        height: 48,
        width: "100%",
        border: "1.5px solid var(--border-mid)",
        background: "var(--white)",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans)",
        fontSize: 14.5,
        fontWeight: 600,
        color: resend ? "var(--text-muted)" : "var(--text-strong)",
        cursor: resend ? "default" : "pointer"
      }
    }, resend ? `Resend email in ${resend}s` : "Resend email")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "18px 0 0",
        textAlign: "center",
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, "Wrong email? ", /*#__PURE__*/React.createElement("a", {
      onClick: () => {
        setStage("form");
        setErr(false);
      },
      style: {
        color: "var(--purple-600)",
        fontWeight: 600,
        cursor: "pointer"
      }
    }, "Change it")));

    /* ---------- password reset: request ---------- */
    if (stage === "reset-req") return /*#__PURE__*/React.createElement(Frame, {
      web: web
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setStage("form");
        setMode("signin");
      },
      style: {
        display: "flex",
        width: "fit-content",
        alignItems: "center",
        gap: 6,
        border: "none",
        background: "none",
        padding: 0,
        marginBottom: 18,
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-muted)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevL",
      size: 16,
      w: 2.2,
      color: "var(--text-muted)"
    }), "Back to sign in"), /*#__PURE__*/React.createElement(Logo, {
      size: 26
    }), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "22px 0 8px",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 25,
        color: "var(--text-strong)"
      }
    }, "Reset your password"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 24px",
        fontSize: 14.5,
        lineHeight: 1.55,
        color: "var(--text-body)"
      }
    }, "Enter your email and we'll send a reset link."), /*#__PURE__*/React.createElement(Field, {
      label: "Email",
      type: "email",
      placeholder: "you@email.com",
      value: email,
      onChange: setEmail,
      icon: "mail"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 18
      }
    }), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: submitReset,
      disabled: !emailValid || loading
    }, loading ? "Sending…" : "Send reset link"));

    /* ---------- password reset: confirmation (non-enumerating) ---------- */
    if (stage === "reset-sent") return /*#__PURE__*/React.createElement(Frame, {
      web: web
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: 28
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 60,
        height: 60,
        margin: "30px auto 22px",
        borderRadius: "50%",
        background: "var(--surface-tint)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "mail",
      size: 25,
      w: 1.7,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 10px",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 24,
        color: "var(--text-strong)"
      }
    }, "Check your email"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 auto",
        maxWidth: 330,
        fontSize: 15,
        lineHeight: 1.6,
        color: "var(--text-body)"
      }
    }, "If that email is registered, a reset link is on its way."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: () => setStage("set-new")
    }, "Open the link \u2192")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "16px 0 0",
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, "Didn't get it? ", /*#__PURE__*/React.createElement("a", {
      onClick: submitReset,
      style: {
        color: "var(--purple-600)",
        fontWeight: 600,
        cursor: "pointer"
      }
    }, "Resend"))));

    /* ---------- password reset: set new ---------- */
    if (stage === "set-new") return /*#__PURE__*/React.createElement(Frame, {
      web: web
    }, /*#__PURE__*/React.createElement(Logo, {
      size: 26
    }), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "22px 0 8px",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 25,
        color: "var(--text-strong)"
      }
    }, "Set a new password"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 22px",
        fontSize: 14.5,
        lineHeight: 1.55,
        color: "var(--text-body)"
      }
    }, "Choose something you'll remember."), /*#__PURE__*/React.createElement(PwField, {
      label: "New password",
      value: pw,
      onChange: setPw,
      show: show,
      setShow: setShow,
      autoFocus: true
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        margin: "12px 2px 20px"
      }
    }, /*#__PURE__*/React.createElement(Hint, {
      ok: len8
    }, "8+ characters"), /*#__PURE__*/React.createElement(Hint, {
      ok: notCommon
    }, "Not a common password")), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: saveNew,
      disabled: !len8 || !notCommon || loading
    }, loading ? "Saving…" : "Save & sign in"));
    if (stage === "done-reset") return /*#__PURE__*/React.createElement(Frame, {
      web: web
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: 28
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 60,
        height: 60,
        margin: "30px auto 22px",
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--success) 14%,var(--white))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 26,
      w: 2.4,
      color: "var(--success)"
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 10px",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 24,
        color: "var(--text-strong)"
      }
    }, "Password updated"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 auto 26px",
        maxWidth: 300,
        fontSize: 15,
        lineHeight: 1.6,
        color: "var(--text-body)"
      }
    }, "You're all set - let's get you back in."), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: done
    }, "Go to Click")));

    /* ---------- main sign in / sign up form ---------- */
    const isUp = mode === "signup";
    return /*#__PURE__*/React.createElement(Frame, {
      web: web
    }, !web && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 22
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: 28
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 6px",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: "-.01em",
        color: "var(--text-strong)"
      }
    }, isUp ? "Create your account" : "Welcome back"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 22px",
        fontSize: 14.5,
        lineHeight: 1.5,
        color: "var(--text-muted)"
      }
    }, isUp ? "One step to real-life events near you." : "Sign in to pick up where you left off."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        padding: 4,
        background: "var(--surface-tint)",
        borderRadius: "var(--radius-pill)",
        marginBottom: 22
      }
    }, [["signup", "Sign up"], ["signin", "Sign in"]].map(([k, lab]) => {
      const on = mode === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => {
          setMode(k);
          setErr(false);
        },
        style: {
          flex: 1,
          height: 38,
          border: "none",
          borderRadius: "var(--radius-pill)",
          background: on ? "var(--white)" : "transparent",
          color: on ? "var(--purple-700)" : "var(--text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: on ? "var(--shadow-sm)" : "none",
          transition: "background .18s,color .18s"
        }
      }, lab);
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginBottom: 18
      }
    }, /*#__PURE__*/React.createElement(SSOButton, {
      mark: /*#__PURE__*/React.createElement(GoogleMark, null),
      onClick: done
    }, "Continue with Google"), /*#__PURE__*/React.createElement(SSOButton, {
      mark: /*#__PURE__*/React.createElement(AppleMark, null),
      onClick: done
    }, "Continue with Apple")), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginTop: 16
      }
    }, err && /*#__PURE__*/React.createElement(ErrorBanner, null, "That email or password doesn't match. Have another go."), /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Email"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        height: 50,
        background: "var(--white)",
        border: `1.5px solid ${showEmailErr ? "var(--error)" : "var(--border-mid)"}`,
        borderRadius: "var(--radius-md)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "mail",
      size: 18,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("input", {
      type: "email",
      placeholder: "you@email.com",
      value: email,
      onChange: e => setEmail(e.target.value),
      onBlur: () => setTouchedEmail(true),
      style: {
        flex: 1,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: "none",
        fontFamily: "var(--font-sans)",
        fontSize: 15.5,
        color: "var(--text-strong)"
      }
    }), emailValid && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 17,
      w: 2.4,
      color: "var(--success)"
    })), showEmailErr && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--error)",
        fontWeight: 500
      }
    }, "Enter a valid email address.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PwField, {
      label: "Password",
      value: pw,
      onChange: setPw,
      show: show,
      setShow: setShow,
      forgot: isUp ? null : () => {
        setStage("reset-req");
        setErr(false);
      }
    }), isUp && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        margin: "11px 2px 0"
      }
    }, /*#__PURE__*/React.createElement(Hint, {
      ok: len8
    }, "8+ characters"), /*#__PURE__*/React.createElement(Hint, {
      ok: notCommon
    }, "Not a common password"))), !isUp && /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        cursor: "pointer",
        fontSize: 13.5,
        color: "var(--text-body)",
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => setKeep(!keep),
      style: {
        flex: "none",
        width: 19,
        height: 19,
        borderRadius: 5,
        border: `1.5px solid ${keep ? "var(--accent)" : "var(--border-mid)"}`,
        background: keep ? "var(--accent)" : "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background .15s,border .15s"
      }
    }, keep && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 12,
      w: 3,
      color: "var(--cream)"
    })), "Keep me signed in"), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: submit,
      disabled: loading || !emailValid || isUp && (!len8 || !notCommon) || !isUp && pw.length === 0
    }, loading ? isUp ? "Creating account…" : "Signing you in…" : isUp ? "Create account" : "Sign in")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "16px 0 0",
        fontSize: 12,
        lineHeight: 1.55,
        color: "var(--text-muted)",
        textAlign: "center"
      }
    }, "By continuing you agree to our ", /*#__PURE__*/React.createElement("a", {
      style: {
        color: "var(--text-body)",
        textDecoration: "underline",
        cursor: "pointer"
      }
    }, "Terms"), " & ", /*#__PURE__*/React.createElement("a", {
      style: {
        color: "var(--text-body)",
        textDecoration: "underline",
        cursor: "pointer"
      }
    }, "Privacy"), "."), isUp && /*#__PURE__*/React.createElement("div", {
      style: {
        margin: "14px 0 0",
        padding: "12px 14px",
        background: "var(--surface-tint)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        gap: 9,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        marginTop: 1
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: 15
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12.5,
        lineHeight: 1.5,
        color: "var(--text-body)"
      }
    }, "Invite-only - Click is piloting in inner Sydney. Outside the area? Sign up and we'll tell you the moment we reach you.")));
  }
  window.ScreensAuth = {
    Auth
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/auth.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/coordination.jsx
try { (() => {
(function () {
  /* Click - the post-event click surface (Who was there), the mutual reveal, and the
     no-chat coordination flow. WEB-only; anonymous-until-mutual; no timer ever shown.
     Inline styles; primitives from window.CK; events from window.DATA. */
  const {
    useState,
    useEffect,
    Icon,
    Spark,
    Cmark,
    Btn,
    ClickBtn,
    Avatar,
    Cover,
    Tag,
    PeopleCard
  } = window.CK;
  const useRefC = React.useRef;
  const FitTags = window.CK.FitTags;
  const D = window.DATA;
  const byId = D.byId;

  /* attendance-gated pool - only people who actually attended + are visible (window.DATA). */
  const WERE_THERE = D.WERE_THERE;
  const first = n => n.split(" ")[0];

  /* once-for-the-screen anonymous reassurance line */
  function AnonLine({
    how
  }) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0",
        fontSize: 13,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "flex-start",
        gap: 7,
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 14,
      w: 1.9,
      color: "var(--text-muted)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }), /*#__PURE__*/React.createElement("span", null, "Clicking is anonymous - we'll only show you if it's mutual. ", how && /*#__PURE__*/React.createElement("span", {
      onClick: how,
      style: {
        color: "var(--purple-600)",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "How clicking works \u2192")));
  }

  /* one attendee = the ONE canonical CK.PeopleCard (identical to discovery / dashboard); the
     post-event grid uses the narrow "grid" layout (paired bottom action row). Pre-mutual, so
     postMutual=false - the commonality line is event / music / proximity only, never a life tag. */
  function Tile({
    p,
    clicked,
    onClick,
    onView
  }) {
    /* p.mutual is the simulation flag ("this one will be mutual once you click") - pre-click the
       card must render the DEFAULT state; the Sage "clicked ✨" only appears after your click. */
    return /*#__PURE__*/React.createElement(PeopleCard, {
      p: p,
      layout: "grid",
      action: "click",
      postMutual: false,
      mutual: clicked && !!p.mutual,
      clicked: clicked,
      onClick: onClick,
      onView: onView
    });
  }

  /* ============================ WHO WAS THERE (Process 2) ============================ */
  function WhoWasThere({
    web,
    event,
    mode = "default",
    datingViewer = false,
    onMutual,
    onClose,
    onDiscover,
    onConnected,
    onSuggest,
    onHow
  }) {
    const e = event || byId(D.RECENT);
    const [clicked, setClicked] = useState(() => new Set());
    const [viewing, setViewing] = useState(null); // person whose profile modal is open
    const PAGE = 12; // initial batch; "Show more" lazy-loads the rest
    const [shown, setShown] = useState(PAGE);
    const PM = window.ScreensB && window.ScreensB.PersonProfileModal;
    const doClick = p => {
      setClicked(s => {
        const n = new Set(s);
        n.add(p.name);
        return n;
      });
      if (p.mutual && onMutual) setTimeout(() => onMutual(p.name, "friends"), 950);
    };
    const rel = (D.RECENT_REL || "Yesterday").toLowerCase();
    /* canonical quiet back link - same form/position as every other sub-page (Settings, Booking) */
    const back = /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "6px 0",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevL",
      size: 18,
      w: 2.4,
      color: "var(--text-muted)"
    }), "Back");
    /* ONE shared signed-in container (matches Dashboard / My Events): max ~1060 centred with
       40px gutters; the page content sits LEFT-aligned within it (capped at `max`), whitespace
       to the right - never a narrow column floating in the middle. */
    const Page = ({
      max,
      children
    }) => /*#__PURE__*/React.createElement("div", {
      style: {
        padding: web ? "10px 0 48px" : "4px 0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 1060 : "none",
        margin: "0 auto",
        padding: web ? "0 40px" : "0 22px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? max : "none"
      }
    }, children)));

    /* shared-context first (a real commonality line - event / music / proximity), then the rest */
    const hasCtx = x => !!(x.sharedEvent || x.sharedMusic || x.proximity);
    const people = WERE_THERE.slice().sort((a, b) => (hasCtx(b) ? 1 : 0) - (hasCtx(a) ? 1 : 0));
    const datingCount = people.filter(p => p.dating).length;
    const visible = people.slice(0, shown);
    const remaining = people.length - visible.length;
    return /*#__PURE__*/React.createElement(Page, {
      max: 880
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: web ? 16 : 14
      }
    }, back), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: "var(--purple-600)",
        marginBottom: 8
      }
    }, rel, " \xB7 ", e.name), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 9px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1.25,
        color: "var(--text-strong)"
      }
    }, "Did you click with anyone?"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 14px",
        fontSize: web ? 15 : 14,
        color: "var(--text-body)",
        lineHeight: 1.55
      }
    }, "Click anyone worth a second hang - we'll do the rest."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: datingViewer && datingCount >= 3 ? 12 : 20
      }
    }, /*#__PURE__*/React.createElement(AnonLine, {
      how: onHow
    })), people.length > 0 && datingViewer && datingCount >= 3 && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 20px",
        fontSize: 13,
        color: "var(--purple-700)",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        lineHeight: 1.5,
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: 15
    }), " A few people here are open to dating too."), people.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-tint)",
        borderRadius: "var(--radius-xl)",
        padding: "44px 26px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: 30
    })), /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: "0 0 8px",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.14375rem, 1.073rem + 0.30cqi, 1.3rem)",
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Quiet one"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.55
      }
    }, "No one to click with here. Your next event is where it happens.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        fontWeight: 600,
        marginBottom: 13
      }
    }, people.length, " people were there"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "1fr 1fr" : "1fr",
        gap: 16
      }
    }, visible.map((p, i) => /*#__PURE__*/React.createElement(Tile, {
      key: p.name,
      p: p,
      clicked: clicked.has(p.name),
      onClick: () => doClick(p),
      onView: () => setViewing(p)
    }))), remaining > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        marginTop: 18
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      onClick: () => setShown(s => s + PAGE)
    }, "Show more (", remaining, ")"))), viewing && PM && /*#__PURE__*/React.createElement(PM, {
      p: {
        ...viewing,
        sharedEvent: e.name
      },
      web: web,
      clicked: clicked.has(viewing.name),
      onClick: () => {
        doClick(viewing);
        setViewing(null);
      },
      onClose: () => setViewing(null)
    }));
  }

  /* ============================ MUTUAL REVEAL (the signature moment) ============================ */
  /* one-shot confetti burst - canvas + rAF (immune to re-render restarts, unlike CSS
     animations in this app); brand palette; honours prefers-reduced-motion; ~2s then stops. */
  function ConfettiBurst() {
    const ref = useRefC(null);
    useEffect(() => {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const cv = ref.current;
      if (!cv) return;
      const box = cv.parentElement.getBoundingClientRect();
      const W = cv.width = Math.max(1, Math.round(box.width));
      const H = cv.height = Math.max(1, Math.round(box.height));
      const ctx = cv.getContext("2d");
      const COLORS = ["#3B2F81", "#C8B8F8", "#8CA88F", "#E8B04B", "#F0ECF4"];
      const N = 90;
      const parts = Array.from({
        length: N
      }, () => {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const sp = 4 + Math.random() * 7.5;
        return {
          x: W / 2 + (Math.random() - 0.5) * 60,
          y: H * 0.34,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          w: 5 + Math.random() * 4,
          h: 8 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.28,
          c: COLORS[Math.random() * COLORS.length | 0],
          delay: Math.random() * 8
        };
      });
      let frame = 0,
        raf;
      const tick = () => {
        frame++;
        ctx.clearRect(0, 0, W, H);
        let alive = false;
        const fade = frame > 95 ? Math.max(0, 1 - (frame - 95) / 35) : 1;
        for (const p of parts) {
          if (frame < p.delay) {
            alive = true;
            continue;
          }
          p.vy += 0.22;
          p.vx *= 0.985;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          if (p.y < H + 20 && fade > 0) alive = true;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        if (alive && frame < 132) raf = requestAnimationFrame(tick);else ctx.clearRect(0, 0, W, H);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    return /*#__PURE__*/React.createElement("canvas", {
      ref: ref,
      "aria-hidden": "true",
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1
      }
    });
  }
  function MutualReveal({
    web,
    name = "Mia R.",
    intent,
    tags,
    dating,
    onSuggest,
    onClose,
    onHow
  }) {
    const mc = (window.DATA.CLICKS || []).find(c => c.name === name) || {};
    const it = intent || mc.intent || "friends";
    const tg = (tags || mc.tags || []).slice(0, 2);
    const dt = dating != null ? dating : !!mc.dating;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: web ? 28 : 18,
        background: "rgba(28,24,48,.55)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        width: "100%",
        maxWidth: 420,
        background: "var(--white)",
        borderRadius: "var(--radius-2xl)",
        padding: web ? "36px 32px 30px" : "30px 24px 26px",
        textAlign: "center",
        overflow: "hidden",
        boxShadow: "var(--shadow-xl)"
      }
    }, /*#__PURE__*/React.createElement(ConfettiBurst, null), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      style: {
        position: "absolute",
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "none",
        background: "rgba(28,24,48,.06)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 16,
      w: 2.2,
      color: "var(--text-muted)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 13,
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 74,
        height: 74,
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--purple-600) 9%,var(--cream))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: 42,
      big: "var(--purple-600)",
      small: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement(Avatar, {
      name: name,
      size: 54,
      ring: true
    })), /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: "0 0 8px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        color: "var(--text-strong)"
      }
    }, "You clicked with ", (name || "").split(" ")[0], "."), mc.event && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 14px",
        fontSize: 13.5,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, "You were both at ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 600,
        color: "var(--text-body)"
      }
    }, mc.event), mc.met ? ` on ${mc.met}` : ""), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 14px",
        borderRadius: "var(--radius-pill)",
        background: "color-mix(in srgb,var(--sage) 14%,var(--white))",
        marginBottom: tg.length ? 12 : 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--sage)"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--sage)"
      }
    }, "You're both here for ", it, dt ? " · both open to dating" : "")), tg.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginBottom: 16
      }
    }, tg.map(t => /*#__PURE__*/React.createElement(Tag, {
      key: t,
      dense: true
    }, t))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 22px",
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.55
      }
    }, "Find a thing you'd both enjoy, and just show up."), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      size: "lg",
      onClick: onSuggest
    }, "Suggest a plan"), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      style: {
        margin: "12px auto 2px",
        display: "block",
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        cursor: "pointer"
      }
    }, "Maybe later"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "8px 0 0",
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: onHow,
      style: {
        color: "var(--purple-600)",
        fontWeight: 600,
        cursor: "pointer"
      }
    }, "How clicking works \u2192")))));
  }

  /* ============================ COORDINATION (no-chat planning) ============================ */
  function Coordinate({
    web,
    start = "suggest",
    name = "Mia R.",
    onClose,
    onHow,
    onRSVP,
    onOpenEvent
  }) {
    const [step, setStep] = useState(start);
    useEffect(() => {
      setStep(start);
    }, [start]);
    const [evIdx, setEvIdx] = useState(0);
    const [customEv, setCustomEv] = useState(null); // chosen via "Suggest your own" picker
    const [picker, setPicker] = useState(false); // event picker open
    const [preview, setPreview] = useState(false); // read-only event-detail preview
    const [previewBooked, setPreviewBooked] = useState(false); // preview the UNLOCKED (booked) view (both-going)
    const [savedPlan, setSavedPlan] = useState(false); // in-flow bookmark from the suggest preview (zero commitment)
    const [q, setQ] = useState(""); // picker search
    const [qDeb, setQDeb] = useState(""); // debounced picker search (typeahead)
    useEffect(() => {
      const t = setTimeout(() => setQDeb(q), 250);
      return () => clearTimeout(t);
    }, [q]);
    const pool = ["ev2", "ev4", "ev3"].map(byId);
    const ev = customEv || pool[evIdx % pool.length];
    const fn = first(name);
    const goingTo = id => (D.BOOKINGS || []).includes(id);
    const Shell = ({
      children,
      eyebrow = "Suggest a plan"
    }) => /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 62,
        display: "flex",
        alignItems: web ? "center" : "flex-end",
        justifyContent: "center",
        padding: web ? 28 : 0,
        background: "rgba(28,24,48,.55)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        width: "100%",
        maxWidth: web ? 520 : "none",
        maxHeight: web ? "88vh" : "94vh",
        overflowY: "auto",
        background: "var(--white)",
        borderRadius: web ? "var(--radius-2xl)" : "var(--radius-2xl) var(--radius-2xl) 0 0",
        boxShadow: "var(--shadow-xl)",
        padding: web ? "20px 28px 28px" : "16px 20px 26px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--text-muted)"
      }
    }, eyebrow), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      "aria-label": "Close",
      style: {
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "none",
        background: "rgba(28,24,48,.06)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 16,
      w: 2.2,
      color: "var(--text-muted)"
    }))), children));

    /* mini event card used across steps; pass onTap to make it open the Event Detail page */
    const EventMini = ({
      e,
      dim,
      onTap
    }) => {
      const style = {
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--white)",
        border: "1px solid #EDE9F2",
        borderRadius: "var(--radius-lg)",
        padding: 13,
        boxShadow: dim ? "none" : "var(--shadow-sm)",
        opacity: dim ? .6 : 1
      };
      const inner = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 60,
          height: 60,
          borderRadius: 12,
          overflow: "hidden",
          flex: "none"
        }
      }, /*#__PURE__*/React.createElement(Cover, {
        category: e.category,
        h: 60,
        photo: e.photo
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-strong)",
          lineHeight: 1.2,
          marginBottom: 3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, e.name), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          color: "var(--text-muted)",
          fontWeight: 500
        }
      }, [e.when, e.suburb, e.price].filter(Boolean).join(" · "))), onTap && /*#__PURE__*/React.createElement(Icon, {
        name: "chevR",
        size: 18,
        w: 2.2,
        color: "var(--text-muted)",
        style: {
          flex: "none"
        }
      }));
      return onTap ? /*#__PURE__*/React.createElement("button", {
        onClick: onTap,
        "aria-label": `View ${e.name} details`,
        style: {
          ...style,
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit"
        }
      }, inner) : /*#__PURE__*/React.createElement("div", {
        style: style
      }, inner);
    };

    /* one-line interest tags with +N overflow (matches the People/Event card rule) */
    const TagRow = ({
      tags = [],
      max = 2
    }) => {
      const show = tags.slice(0, max),
        extra = tags.length - show.length;
      if (show.length === 0) return null;
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "nowrap",
          overflow: "hidden",
          minWidth: 0
        }
      }, show.map(t => /*#__PURE__*/React.createElement("span", {
        key: t,
        style: {
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          height: 24,
          padding: "0 10px",
          fontSize: 11.5,
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          borderRadius: "var(--radius-pill)",
          background: "var(--white)",
          border: "1px solid var(--border-mid)",
          color: "var(--text-strong)",
          whiteSpace: "nowrap"
        }
      }, t)), extra > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          flex: "none",
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--text-muted)"
        }
      }, "+", extra));
    };

    /* proposal card - the canonical COMPACT Event Card mini: small banner thumbnail (~110px),
       date · title · suburb+distance · price · tags. This card IS the preview - no separate overlay. */
    const ProposalCard = ({
      e
    }) => /*#__PURE__*/React.createElement("div", {
      style: {
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "var(--white)",
        border: "1px solid #EDE9F2",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: e.category,
      h: 110,
      photo: e.photo
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "13px 15px 15px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("span", null, e.when)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.25,
        marginBottom: 5
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        fontWeight: 500,
        display: "inline-flex",
        gap: 5,
        alignItems: "center",
        marginBottom: 11
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("span", null, [e.suburb, e.dist].filter(Boolean).join(" · "), " \xB7 ", e.price)), /*#__PURE__*/React.createElement(TagRow, {
      tags: e.tags
    })));
    const Peak = ({
      icon,
      tone,
      title,
      sub,
      eyebrow,
      children
    }) => /*#__PURE__*/React.createElement(Shell, {
      eyebrow: eyebrow
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: web ? "14px 0 0" : "6px 0 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        marginBottom: 16
      }
    }, icon), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 8px",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.36rem, 1.205rem + 0.66cqi, 1.7rem)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        color: "var(--text-strong)"
      }
    }, title), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 auto 22px",
        maxWidth: 380,
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.55
      }
    }, sub), children));

    /* PREVIEW overlay - the ONE in-drawer preview: a COMPACT read-only summary of the suggested
       event (small thumbnail + facts + tags + short description + what-you-get). The ONLY actions
       are "← Back to suggesting" + a quiet in-place "Save". NEVER a full Event Detail or RSVP here;
       every post-decision card taps through to the REAL Event Detail page via onOpenEvent. */
    /* "Suggest your own" picker - debounced typeahead + curated sections (no full-catalogue load) */
    if (step === "suggest" && picker) {
      const ql = qDeb.trim().toLowerCase();
      const match = e => (e.name + " " + (e.suburb || "")).toLowerCase().includes(ql);
      /* curated short sections by default; a debounced typeahead (capped ~20) when searching -
         never render or filter the whole catalogue at once (that was the lag) */
      const curated = [["Events you're going to", (D.BOOKINGS || []).map(byId).filter(Boolean)], ["Saved", (D.SAVED || []).map(byId).filter(Boolean)], ["You'd both like", (D.SUGGEST_B || []).map(byId).filter(Boolean).slice(0, 4)]];
      const results = ql ? D.EVENTS.filter(match).slice(0, 20) : null;
      const Row = ({
        e,
        going
      }) => /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          setCustomEv(e);
          setPicker(false);
        },
        style: {
          display: "flex",
          alignItems: "center",
          gap: 13,
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          background: "var(--white)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius-lg)",
          padding: 11,
          marginBottom: 8,
          boxShadow: "var(--shadow-xs)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 54,
          height: 54,
          borderRadius: 11,
          overflow: "hidden",
          flex: "none"
        }
      }, /*#__PURE__*/React.createElement(Cover, {
        category: e.category,
        h: 54,
        photo: e.photo
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, e.name), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          color: "var(--text-muted)",
          fontWeight: 500,
          marginTop: 2
        }
      }, [e.when, e.suburb, e.price].filter(Boolean).join(" · ")), going && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: 4,
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--sage)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        size: 12,
        w: 2.6,
        color: "var(--sage)"
      }), "You're going to this")), /*#__PURE__*/React.createElement(Icon, {
        name: "chevR",
        size: 17,
        w: 2.2,
        color: "var(--text-muted)",
        style: {
          flex: "none"
        }
      }));
      const seen = new Set();
      return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("button", {
        onClick: () => setPicker(false),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          border: "none",
          background: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--purple-700)",
          marginBottom: 12,
          padding: 0
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "chevL",
        size: 17,
        w: 2.4,
        color: "var(--purple-700)"
      }), "Back"), /*#__PURE__*/React.createElement("h1", {
        style: {
          margin: "0 0 14px",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.21625rem, 1.110rem + 0.45cqi, 1.45rem)",
          fontWeight: 600,
          letterSpacing: "-.01em",
          color: "var(--text-strong)"
        }
      }, "Choose an event for ", fn), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 9,
          background: "var(--white)",
          border: "1px solid var(--border-mid)",
          borderRadius: "var(--radius-md)",
          padding: "10px 13px",
          marginBottom: 18
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "search",
        size: 16,
        w: 2,
        color: "var(--text-muted)",
        style: {
          flex: "none"
        }
      }), /*#__PURE__*/React.createElement("input", {
        value: q,
        onChange: e => setQ(e.target.value),
        placeholder: "Search events",
        style: {
          flex: 1,
          border: "none",
          outline: "none",
          background: "none",
          fontFamily: "var(--font-sans)",
          fontSize: 14.5,
          color: "var(--text-strong)"
        }
      })), results ? results.length > 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 18
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          marginBottom: 9
        }
      }, "Results"), results.map(e => /*#__PURE__*/React.createElement(Row, {
        key: e.id,
        e: e,
        going: goingTo(e.id)
      }))) : /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "6px 2px",
          fontSize: 14,
          color: "var(--text-muted)",
          lineHeight: 1.55
        }
      }, "No events match \"", qDeb.trim(), "\" - try another search.") : curated.map(([label, list]) => {
        const rows = list.filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        if (rows.length === 0) return null;
        return /*#__PURE__*/React.createElement("div", {
          key: label,
          style: {
            marginBottom: 18
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            marginBottom: 9
          }
        }, label), rows.map(e => /*#__PURE__*/React.createElement(Row, {
          key: e.id,
          e: e,
          going: goingTo(e.id)
        })));
      }));
    }

    /* C1 - suggest an event (proposal) */
    if (step === "suggest") return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 7px",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.251875rem, 1.116rem + 0.58cqi, 1.55rem)",
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: "var(--text-strong)"
      }
    }, "Suggest something to do with ", fn), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 18px",
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.55
      }
    }, "Pick something you'd both enjoy - no back-and-forth, just a plan."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement(ProposalCard, {
      e: ev
    })), goingTo(ev.id) ? /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 8px",
        fontSize: 12.5,
        color: "var(--sage)",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 14,
      w: 2.6,
      color: "var(--sage)"
    }), " ", /*#__PURE__*/React.createElement("span", null, "You're going to this - once ", fn, "'s in, only they need to RSVP.")) : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 8px",
        fontSize: 12.5,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--purple-400)",
        flex: "none"
      }
    }), " You're both into this - and it's nearby."), onOpenEvent && /*#__PURE__*/React.createElement("button", {
      onClick: () => onOpenEvent(ev),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: 0,
        margin: "0 0 18px",
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-600)"
      }
    }, "See full details ", /*#__PURE__*/React.createElement(Icon, {
      name: "arrowR",
      size: 15,
      w: 2.2,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: () => setStep("onein")
    }, `Suggest this to ${fn}`), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      full: true,
      onClick: () => {
        setCustomEv(null);
        setEvIdx(i => i + 1);
      }
    }, "Show another"), /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      full: true,
      onClick: () => {
        setQ("");
        setPicker(true);
      }
    }, "Suggest your own \u2192"))));

    /* C2 - suggested, waiting for their reply (proposer; NOBODY booked yet - no "save your spot" here) */
    if (step === "onein") return /*#__PURE__*/React.createElement(Peak, {
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "color-mix(in srgb,var(--lavender-300) 28%,var(--cream))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "clock",
        size: 24,
        w: 2,
        color: "var(--purple-600)"
      })),
      title: `Suggested to ${fn}`,
      sub: `We'll let ${fn} know, and tell you the moment it's confirmed - no rush.`
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 18,
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement(EventMini, {
      e: ev,
      onTap: () => onOpenEvent && onOpenEvent(ev)
    })), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: onClose
    }, "Back to your clicks"));

    /* C2b - they're in, now you both RSVP (this is where the proposer books) */
    if (step === "rsvp") return /*#__PURE__*/React.createElement(Peak, {
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "color-mix(in srgb,var(--sage) 14%,var(--white))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        size: 26,
        w: 2.6,
        color: "var(--sage)"
      })),
      title: `${fn}'s keen - save your spot`,
      sub: `${fn}'s saved their spot - grab yours and you're both set.`
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 18,
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement(EventMini, {
      e: ev
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: () => onRSVP ? onRSVP(ev, name) : setStep("both")
    }, "Save my spot \xB7 RSVP"), /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      full: true,
      onClick: onClose
    }, "Back to your clicks")));

    /* C3 - both going (a peak) */
    if (step === "both") return /*#__PURE__*/React.createElement(Peak, {
      eyebrow: "Plan confirmed",
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "color-mix(in srgb,var(--purple-600) 9%,var(--cream))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Spark, {
        size: 38,
        big: "var(--purple-600)",
        small: "var(--purple-600)"
      })),
      title: "You're both going.",
      sub: `You and ${fn} are set for ${ev.name}. See you there.`
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 18,
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement(EventMini, {
      e: ev,
      onTap: () => onOpenEvent && onOpenEvent(ev)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: onClose
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 17,
      w: 2,
      color: "var(--cream)"
    }), " Add to calendar")), /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      full: true,
      onClick: onClose
    }, "Done")));

    /* recovery - seat filled first (NOT an error - neutral recovery, never coral/red) */
    if (step === "seatfilled") return /*#__PURE__*/React.createElement(Peak, {
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "var(--lavender-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "compass",
        size: 26,
        w: 1.9,
        color: "var(--purple-500)"
      })),
      title: "That one just filled up.",
      sub: `No drama - there's always another. Find one you'll both like.`
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 18,
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement(EventMini, {
      e: ev,
      dim: true
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: () => setStep("suggest")
    }, "Find another together"), /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      full: true,
      onClick: () => setStep("onein")
    }, "Join the waitlist together")));

    /* terminal - connected / closure (the win, a peak) */
    if (step === "connected") return /*#__PURE__*/React.createElement(Peak, {
      eyebrow: "Past clicks",
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "color-mix(in srgb,var(--purple-600) 9%,var(--cream))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Spark, {
        size: 38,
        big: "var(--purple-600)",
        small: "var(--purple-600)"
      })),
      title: "Love that.",
      sub: "That's what Click's for. This one rests in your past clicks - pick it back up anytime."
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: onClose
    }, "Back to your clicks"));

    /* terminal - soft-release (a click goes quiet - NOT a peak, no ✨) */
    if (step === "released") return /*#__PURE__*/React.createElement(Peak, {
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "var(--surface-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "clock",
        size: 24,
        w: 1.9,
        color: "var(--text-muted)"
      })),
      title: "Still out there",
      sub: "If you cross paths again, you can pick it back up. No rush - these things have their own timing."
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: onClose
    }, "Back to your clicks"));
    return null;
  }
  window.ScreensMech = {
    WhoWasThere,
    MutualReveal,
    Coordinate
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/coordination.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/dashboard.jsx
try { (() => {
(function () {
  /* Click - signed-in HOME dashboard. A calm, activity-first feed (NOT a data dashboard).
     Mode A = first-time (exactly 4 sections, progressive disclosure).
     Mode B = returning (conditional, ordered by time-sensitivity).
     Whitespace groups sections - never cards-in-boxes. Inline styles; primitives from window.CK. */
  const {
    useState,
    CAT,
    Icon,
    Spark,
    Btn,
    ClickBtn,
    Avatar,
    Stack,
    Status,
    Cover,
    Tag,
    PeopleCard
  } = window.CK;
  const D = window.DATA;
  const {
    byId
  } = D;
  const EventCard = window.ScreensA.EventCard;

  /* ---------------- section scaffold (whitespace-grouped, not boxed) ---------------- */
  function Section({
    web,
    first,
    title,
    sub,
    action,
    onAction,
    narrow,
    children
  }) {
    return /*#__PURE__*/React.createElement("section", {
      style: {
        marginTop: first ? web ? 30 : 20 : web ? 56 : 26,
        maxWidth: narrow && web ? 760 : undefined
      }
    }, (title || action) && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: web ? 18 : 14
      }
    }, /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.071875rem, 0.968rem + 0.44cqi, 1.3rem)",
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: "var(--text-strong)"
      }
    }, title), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "5px 0 0",
        fontSize: web ? 14 : 13.5,
        color: "var(--text-muted)",
        fontWeight: 500,
        lineHeight: 1.5,
        maxWidth: 520
      }
    }, sub)), action && /*#__PURE__*/React.createElement("button", {
      onClick: onAction,
      style: {
        flex: "none",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-600)",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        whiteSpace: "nowrap",
        padding: "11px 8px",
        margin: "-11px -8px"
      }
    }, action, /*#__PURE__*/React.createElement(Icon, {
      name: "arrowR",
      size: 15,
      w: 2.2
    }))), children);
  }

  /* ---------------- event row - 3-up grid (web) / horizontal scroll-row (mobile) ---------------- */
  function EventRow({
    web,
    events,
    open,
    saved,
    toggleSave
  }) {
    if (web) return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
        gap: 22
      }
    }, events.map(e => /*#__PURE__*/React.createElement(EventCard, {
      key: e.id,
      e: e,
      onClick: () => open(e),
      saved: saved.has(e.id),
      onSave: () => toggleSave(e.id)
    })));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(2,1fr)",
        gap: 12
      }
    }, events.map(e => /*#__PURE__*/React.createElement(EventCard, {
      key: e.id,
      e: e,
      mini: true,
      onClick: () => open(e),
      saved: saved.has(e.id),
      onSave: () => toggleSave(e.id)
    })));
  }

  /* ---------------- MOMENT BANNER - ONE consistent shell for EVERY time-sensitive top moment
       (post-event prompt + all coordination states). Same lavender wash, radius, padding and
       structure: icon-circle left · eyebrow · title · one subline · ONE action right. The
       finish-setting-up card is deliberately a DIFFERENT, quieter (white) treatment. ---------------- */
  function BannerIcon({
    name
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "var(--lavender-200)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: name,
      size: 20,
      w: 2,
      color: "var(--purple-700)"
    }));
  }
  function MomentBanner({
    web,
    lead,
    eyebrow,
    title,
    sub,
    actions
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: web ? "row" : "column",
        alignItems: web ? "center" : "stretch",
        gap: web ? 22 : 16,
        background: "var(--surface-section)",
        border: "1px solid var(--lavender-300)",
        borderRadius: "var(--radius-xl)",
        padding: web ? "20px 24px" : "16px 18px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        flex: 1,
        minWidth: 0
      }
    }, lead, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, eyebrow && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--purple-700)",
        marginBottom: 6
      }
    }, eyebrow), /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.108125rem, 1.021rem + 0.37cqi, 1.3rem)",
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: "var(--purple-800)",
        lineHeight: 1.2
      }
    }, title), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "5px 0 0",
        fontSize: web ? 14 : 13.5,
        lineHeight: 1.5,
        color: "var(--purple-800)",
        opacity: .8,
        maxWidth: 460
      }
    }, sub))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        flex: "none"
      }
    }, actions));
  }

  /* ---------------- 1 · POST-EVENT PROMPT (Mode B, conditional, leads when present) ---------------- */
  function PostEventPrompt({
    web,
    event,
    onYes,
    onLater
  }) {
    return /*#__PURE__*/React.createElement(MomentBanner, {
      web: web,
      lead: /*#__PURE__*/React.createElement(BannerIcon, {
        name: "calendar"
      }),
      eyebrow: (D.RECENT_REL || "Yesterday") + " · " + event.name,
      title: "Did you click with anyone?",
      sub: "Click anyone worth a second hang - we'll do the rest.",
      actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Btn, {
        onClick: onYes
      }, "See who was there"), /*#__PURE__*/React.createElement(Btn, {
        variant: "ghost",
        onClick: onLater
      }, "Maybe later"))
    });
  }

  /* ---------------- CLICK WITH SOMEONE - EXACTLY ONE rotated person (the wall lives on the
       Click page). Uses the ONE canonical CK.PeopleCard - the SAME card as discovery /
       who-was-there (avatar 52, inline name+intent, the commonality line, the click+View-profile
       pair); no drift. "View profile" opens the shared profile modal. ---------------- */
  function ClickSuggest({
    web,
    people,
    onHow
  }) {
    /* one person, rotated through the day from the curated pool (a drip, not a wall) */
    const person = people[Math.floor(Date.now() / 36e5) % people.length];
    const [clicked, setClicked] = useState(false);
    const [viewing, setViewing] = useState(false);
    const PM = window.ScreensB && window.ScreensB.PersonProfileModal;
    return /*#__PURE__*/React.createElement("div", {
      "data-comment-anchor": "5744b0851c-div-77-12"
    }, /*#__PURE__*/React.createElement(PeopleCard, {
      p: person,
      web: web,
      layout: "row",
      action: "click",
      clicked: clicked,
      onClick: () => setClicked(true),
      onView: () => setViewing(true)
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "13px 2px 0",
        fontSize: 13,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "flex-start",
        gap: 7,
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 14,
      w: 1.9,
      color: "var(--text-muted)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }), /*#__PURE__*/React.createElement("span", null, "Clicking is anonymous - we'll only show you if it's mutual. ", onHow && /*#__PURE__*/React.createElement("span", {
      onClick: onHow,
      style: {
        color: "var(--purple-600)",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "How clicking works \u2192"))), viewing && PM && /*#__PURE__*/React.createElement(PM, {
      p: person,
      web: web,
      clicked: clicked,
      onClick: () => {
        setClicked(true);
        setViewing(false);
      },
      onClose: () => setViewing(false)
    }));
  }

  /* ---------------- CLICK RADAR - a compact social-proof BAR (locked 27 Jun; NOT event cards).
       1–3 light one-line rows, each an anonymous AGGREGATE social-proof line tied to an event,
       that taps through to that event. Counts only, never names/photos (≥3 floor). Light on
       cream, hairline-separated rows - never a card grid, never a dark block. Cold-start →
       a single honest "trending" / "your radar sharpens" bar. Same bar on the Click page. ---- */
  function Radar({
    web,
    cold,
    open
  }) {
    const rows = cold ? D.RADAR_COLD.slice(0, 1).map(id => ({
      e: byId(id),
      icon: "trend",
      line: "As you go to events, your radar sharpens"
    })) : D.RADAR_EVENTS.map(r => ({
      e: byId(r.id),
      icon: r.icon,
      line: r.line
    }));
    const bars = rows.filter(x => x.e).slice(0, 1);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        background: "var(--cream)",
        overflow: "hidden"
      }
    }, bars.map(({
      e,
      icon,
      line
    }, i) => /*#__PURE__*/React.createElement(RadarBar, {
      key: e.id,
      e: e,
      icon: icon,
      line: line,
      first: i === 0,
      web: web,
      cold: cold,
      onClick: () => open(e)
    })));
  }
  function RadarBar({
    e,
    icon,
    line,
    first,
    web,
    cold,
    onClick
  }) {
    const [hov, setHov] = useState(false);
    return /*#__PURE__*/React.createElement("div", {
      onClick: cold ? undefined : onClick,
      onMouseEnter: () => setHov(true),
      onMouseLeave: () => setHov(false),
      role: cold ? undefined : "button",
      tabIndex: cold ? undefined : 0,
      style: {
        display: "flex",
        alignItems: "center",
        gap: web ? 14 : 12,
        padding: web ? "15px 18px" : "14px 15px",
        cursor: cold ? "default" : "pointer",
        borderTop: first ? "none" : "1px solid var(--border-soft)",
        background: hov && !cold ? "var(--surface-tint)" : "transparent",
        transition: "background .15s"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon && icon !== "spark" ? icon : "trend",
      size: 16,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: web ? 14.5 : 13.5,
        lineHeight: 1.4,
        color: "var(--text-body)"
      }
    }, /*#__PURE__*/React.createElement("span", null, line), !cold && /*#__PURE__*/React.createElement("span", null, " "), !cold && /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, e.name)), !cold && /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 16,
      w: 2,
      color: "var(--text-muted)"
    }));
  }

  /* ---------------- COORDINATION MOMENT BANNER - the SAME MomentBanner shell, content per state.
     Surfaces only YOUR-move states (fresh mutual · they proposed · agreed-your-RSVP), or ONE
     consolidated banner when 2+ are waiting on you. ✨ (Deep-Purple glyph) on the peak titles only. */
  function CoordBanner({
    web,
    variant,
    onAction
  }) {
    const name = "Mia R.",
      name2 = "Jules M.";
    const fn = name.split(" ")[0],
      fn2 = name2.split(" ")[0];
    const ev = byId("ev2");
    const evLine = ev.name + " · " + ev.when;
    const SPARK = /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        verticalAlign: "-2px"
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: web ? 20 : 18,
      big: "var(--purple-600)",
      small: "var(--purple-400)"
    }));
    const cfg = {
      mutual: {
        icon: "users",
        eyebrow: "it's mutual",
        title: /*#__PURE__*/React.createElement(React.Fragment, null, "You clicked with ", fn, ". ", SPARK),
        sub: "Find something you'd both enjoy and meet there.",
        cta: "Suggest a plan →"
      },
      proposed: {
        icon: "calendar",
        eyebrow: "from " + fn,
        title: /*#__PURE__*/React.createElement(React.Fragment, null, fn, " suggested a plan"),
        sub: evLine,
        cta: "See their plan →"
      },
      agreed: {
        icon: "check",
        eyebrow: "your plan with " + fn,
        title: /*#__PURE__*/React.createElement(React.Fragment, null, fn, "'s in - RSVP to lock it in"),
        sub: evLine,
        cta: "RSVP →"
      },
      consolidated: {
        icon: "users",
        eyebrow: "your clicks",
        title: /*#__PURE__*/React.createElement(React.Fragment, null, fn, " and ", fn2, " are waiting on you ", SPARK),
        sub: "Pick up where you left off.",
        cta: "See your clicks →"
      }
    }[variant];
    if (!cfg) return null;
    return /*#__PURE__*/React.createElement(MomentBanner, {
      web: web,
      lead: /*#__PURE__*/React.createElement(BannerIcon, {
        name: cfg.icon
      }),
      eyebrow: cfg.eyebrow,
      title: cfg.title,
      sub: cfg.sub,
      actions: /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        onClick: () => onAction && onAction(variant)
      }, cfg.cta)
    });
  }

  /* ---------------- SAVED & WAITLIST - SAME Event Card + 3-up grid as the other strips (capped at 3; rest via "See all") ---------------- */
  function SavedWaitlist({
    web,
    saved,
    open,
    toggleSave
  }) {
    const savedEvents = [...saved].map(byId).filter(Boolean);
    const wl = D.WAITLIST.map(id => ({
      ...byId(id),
      status: "waitlist"
    }));
    const list = [...savedEvents, ...wl];
    if (list.length === 0) return /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-tint)",
        borderRadius: "var(--radius-xl)",
        padding: web ? "30px 26px" : "24px 18px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: 28
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, "Nothing saved yet - your next event is where it happens."));
    return /*#__PURE__*/React.createElement(EventRow, {
      web: web,
      events: list.slice(0, 3),
      open: open,
      saved: saved,
      toggleSave: toggleSave
    });
  }

  /* ---------------- ACTIVITY - quiet timeline (no boxes) ---------------- */
  function Activity({
    items
  }) {
    return /*#__PURE__*/React.createElement("div", null, items.map((it, i) => {
      const last = i === items.length - 1;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          display: "flex",
          gap: 14,
          paddingBottom: last ? 0 : 18,
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "none",
          width: 34,
          display: "flex",
          justifyContent: "center",
          position: "relative"
        }
      }, !last && /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          top: 32,
          bottom: -18,
          width: 2,
          background: "var(--border-soft)"
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "var(--surface-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: it.ic,
        size: 16,
        w: 2,
        color: "var(--purple-500)"
      }))), /*#__PURE__*/React.createElement("div", {
        style: {
          paddingTop: 6
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 14.5,
          color: "var(--text-body)",
          fontWeight: 500,
          lineHeight: 1.35
        }
      }, it.text), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          color: "var(--text-faint)",
          marginTop: 2
        }
      }, it.when)));
    }));
  }

  /* ---------------- CATEGORIES - icon + label browse tiles → Discover (one icon treatment, shared with Discovery) ---------------- */
  function Categories({
    web,
    openDiscover
  }) {
    const DS = window.ScreensDisc;
    const CatChip = DS && DS.CatChip;
    if (!CatChip) return null;
    const CURATED = ["social", "food", "arts", "music", "fitness", "outdoors", "wellness", "learning"];
    const cats = DS.CATS.filter(c => CURATED.includes(c.key));
    return /*#__PURE__*/React.createElement("div", {
      className: "ckRail",
      style: {
        display: "flex",
        flexWrap: web ? "wrap" : "nowrap",
        overflowX: web ? "visible" : "auto",
        gap: web ? 6 : 4,
        margin: web ? 0 : "0 -22px",
        padding: web ? 0 : "2px 22px 4px",
        scrollbarWidth: "none"
      }
    }, cats.map(c => /*#__PURE__*/React.createElement(CatChip, {
      key: c.key,
      c: c,
      web: web,
      active: false,
      onClick: () => openDiscover(c.key)
    })));
  }

  /* ---------------- greeting ---------------- */
  function Greeting({
    web,
    compact,
    line
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 7px",
        fontSize: web ? 13.5 : 13,
        fontWeight: 600,
        color: "var(--text-muted)",
        fontFamily: "var(--font-display)"
      }
    }, "Good evening, Ava"), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: compact ? "clamp(1.5rem, 1.273rem + 0.97cqi, 2rem)" : "clamp(1.219rem, 1.091rem + 0.55cqi, 1.5rem)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: compact ? 1.25 : 1.32,
        color: "var(--text-strong)",
        maxWidth: 620,
        textWrap: "balance"
      }
    }, line));
  }

  /* ---------------- FINISH SETTING UP - the one restrained activation block ---------------- */
  function TaskRow({
    t,
    i,
    isDone,
    featured,
    onDo
  }) {
    const hi = featured && !isDone;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: hi ? "11px 12px" : "12px 2px",
        borderTop: i && !hi ? "1px solid var(--border-soft)" : "none",
        background: hi ? "color-mix(in srgb,var(--lavender-300) 15%,var(--white))" : "transparent",
        borderRadius: hi ? "var(--radius-md)" : 0,
        margin: hi ? "6px 0" : 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        flex: "none",
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isDone ? "var(--purple-600)" : "transparent",
        border: isDone ? "none" : "2px solid var(--border-mid)"
      }
    }, isDone && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 14,
      w: 3,
      color: "var(--cream)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: isDone ? "var(--text-muted)" : "var(--text-strong)"
      }
    }, t.label), hi && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--purple-700)",
        background: "var(--lavender-200)",
        borderRadius: "var(--radius-pill)",
        padding: "2px 9px"
      }
    }, "most useful")), t.sub && /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 12.5,
        color: "var(--text-faint)",
        marginTop: 2
      }
    }, t.sub)), isDone ? /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--text-faint)"
      }
    }, "Done") : /*#__PURE__*/React.createElement("button", {
      onClick: onDo,
      style: {
        flex: "none",
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--purple-600)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 2px"
      }
    }, t.cta));
  }
  function SetupChecklist({
    web,
    openQuiz,
    quizDone
  }) {
    const TASKS = [{
      k: "quiz",
      label: "Take the Click quiz",
      sub: "2 min · it's what sharpens who you meet",
      cta: "Start →"
    }, {
      k: "photo",
      label: "Add a photo",
      sub: "so people recognise you on the night",
      cta: "Add"
    }, {
      k: "bio",
      label: "Write a one-line bio",
      sub: "a line gives people a reason to say hi",
      cta: "Write"
    }, {
      k: "interests",
      label: "Pick 3 or more interests",
      sub: "so we suggest the right events",
      cta: "Pick"
    }, {
      k: "suburb",
      label: "Set your suburb",
      sub: "Surry Hills",
      cta: "Edit"
    }];
    const [done, setDone] = useState(() => new Set(["interests", "suburb"]));
    const allDone = quizDone && !done.has("quiz") ? new Set(done).add("quiz") : done;
    const [expanded, setExpanded] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const total = TASKS.length,
      n = allDone.size,
      pct = Math.round(n / total * 100),
      complete = n === total;
    const markDone = k => setDone(s => {
      const x = new Set(s);
      x.add(k);
      return x;
    });
    if (collapsed) return null;
    const next = TASKS.find(t => !allDone.has(t.k));
    /* compact by default: show only the next incomplete step; expand reveals the rest */
    const rows = expanded ? TASKS.filter(t => !allDone.has(t.k)) : next ? [next] : [];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-xs)",
        padding: web ? "20px 24px" : "16px 18px"
      }
    }, complete ? /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "10px 8px 6px"
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: "0 0 6px",
        fontFamily: "var(--font-display)",
        fontSize: 18,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "You're all set"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 16px",
        fontSize: 14,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, "Your suggestions just got sharper - for events and people."), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      onClick: () => setCollapsed(true)
    }, "Great")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.03625rem, 0.985rem + 0.22cqi, 1.15rem)",
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Finish setting up"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-700)"
      }
    }, n, " of ", total)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 8,
        borderRadius: 999,
        background: "var(--surface-tint)",
        overflow: "hidden",
        margin: "12px 0 4px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: pct + "%",
        background: "var(--purple-600)",
        borderRadius: 999,
        transition: "width .3s ease"
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4
      }
    }, rows.map((t, i) => /*#__PURE__*/React.createElement(TaskRow, {
      key: t.k,
      t: t,
      i: i,
      isDone: false,
      featured: t.k === "quiz",
      onDo: () => {
        if (t.k === "quiz" && openQuiz) {
          openQuiz();
        } else markDone(t.k);
      }
    }))), TASKS.filter(t => !allDone.has(t.k)).length > 1 && /*#__PURE__*/React.createElement("button", {
      onClick: () => setExpanded(v => !v),
      style: {
        marginTop: 8,
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--purple-600)",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 0"
      }
    }, expanded ? "Show less" : "See all · " + (total - n) + " left", /*#__PURE__*/React.createElement(Icon, {
      name: expanded ? "chevD" : "arrowR",
      size: 14,
      w: 2.2,
      style: {
        transform: expanded ? "rotate(180deg)" : "none",
        transition: "transform .2s"
      }
    }))));
  }

  /* ====================== DASHBOARD ====================== */
  function Dashboard({
    web,
    mode,
    showPrompt,
    open,
    saved,
    toggleSave,
    openWin,
    openDiscover,
    openPeople,
    openEvents,
    openRadar,
    openQuiz,
    quizDone,
    coordBanner,
    onCoordAction,
    onHow
  }) {
    const firstrun = mode === "firstrun";
    const recent = byId(D.RECENT);
    const booked = D.BOOKINGS.map(byId).filter(Boolean);
    const inner = {
      maxWidth: web ? 1060 : "none",
      margin: "0 auto",
      padding: web ? "12px 40px 56px" : "8px 22px 40px"
    };

    /* ---- Mode A: first-time - exactly 4 sections ---- */
    if (firstrun) return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: inner
    }, /*#__PURE__*/React.createElement(Greeting, {
      web: web,
      line: "Here's what's good near you this week, Ava."
    }), /*#__PURE__*/React.createElement(Section, {
      web: true,
      first: true,
      narrow: true
    }, /*#__PURE__*/React.createElement(SetupChecklist, {
      web: web,
      openQuiz: openQuiz,
      quizDone: quizDone
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "Suggested for you",
      sub: "This week, near you - matched to what you're into."
    }, /*#__PURE__*/React.createElement(EventRow, {
      web: web,
      events: D.SUGGEST_A.map(byId),
      open: open,
      saved: saved,
      toggleSave: toggleSave
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "click radar",
      sub: "People like you are showing up to these.",
      action: "See all on your radar",
      onAction: openRadar,
      narrow: true
    }, /*#__PURE__*/React.createElement(Radar, {
      web: web,
      cold: true,
      open: open
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "Or find your own thing",
      sub: "Browse by what you feel like doing.",
      action: "See all",
      onAction: () => openDiscover()
    }, /*#__PURE__*/React.createElement(Categories, {
      web: web,
      openDiscover: openDiscover
    }))));

    /* ---- Mode B: returning - conditional, time-sensitivity order ---- */
    /* empty (no your-move moment) - lead with a calm discovery nudge, never "nothing needs you" */
    const hasMoment = showPrompt && recent || coordBanner;
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: inner
    }, /*#__PURE__*/React.createElement(Greeting, {
      web: web,
      compact: true,
      line: hasMoment ? "Here's what's next." : "Here's what's good near you this week, Ava."
    }), showPrompt && recent && /*#__PURE__*/React.createElement(Section, {
      web: true,
      first: true
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 760 : "none"
      }
    }, /*#__PURE__*/React.createElement(PostEventPrompt, {
      web: web,
      event: recent,
      onYes: () => openWin(recent, "default"),
      onLater: () => {}
    }))), coordBanner && /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 760 : "none",
        marginTop: showPrompt && recent ? web ? 22 : 16 : web ? 24 : 18
      }
    }, /*#__PURE__*/React.createElement(CoordBanner, {
      web: web,
      variant: coordBanner,
      onAction: onCoordAction
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 760 : "none",
        marginTop: showPrompt && recent ? web ? 26 : 18 : web ? 30 : 22
      }
    }, /*#__PURE__*/React.createElement(SetupChecklist, {
      web: web,
      openQuiz: openQuiz,
      quizDone: quizDone
    })), booked.length > 0 && /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "You're going",
      action: "All bookings",
      onAction: openEvents
    }, /*#__PURE__*/React.createElement(EventRow, {
      web: web,
      events: booked,
      open: open,
      saved: saved,
      toggleSave: toggleSave
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "click with someone",
      sub: "Someone you might just click with - quietly picked, no pressure.",
      action: "See everyone",
      onAction: openPeople,
      narrow: true
    }, /*#__PURE__*/React.createElement(ClickSuggest, {
      web: web,
      people: D.CLICK_SUGGEST,
      onHow: onHow
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "click radar",
      sub: "People like you are showing up to these.",
      action: "See all on your radar",
      onAction: openRadar,
      narrow: true
    }, /*#__PURE__*/React.createElement(Radar, {
      web: web,
      open: open
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "Suggested for you",
      sub: "Fresh this week, matched to what you like.",
      action: "See all",
      onAction: openDiscover
    }, /*#__PURE__*/React.createElement(EventRow, {
      web: web,
      events: D.SUGGEST_B.map(byId),
      open: open,
      saved: saved,
      toggleSave: toggleSave
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "Saved & waitlist",
      action: "See all",
      onAction: openEvents
    }, /*#__PURE__*/React.createElement(SavedWaitlist, {
      web: web,
      saved: saved,
      open: open,
      toggleSave: toggleSave
    })), /*#__PURE__*/React.createElement(Section, {
      web: true,
      title: "Browse by category",
      action: "See all",
      onAction: () => openDiscover()
    }, /*#__PURE__*/React.createElement(Categories, {
      web: web,
      openDiscover: openDiscover
    }))));
  }
  window.ScreensDash = {
    Dashboard,
    Radar
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/dashboard.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/data.jsx
try { (() => {
(function () {
  /* Click - v2 mockup data. Real inner-Sydney venues, prices, names (no placeholders).
     Intent-neutral attendees; locked language. window.DATA. */

  const ATT = {
    mia: {
      name: "Mia R.",
      intent: "here for friends",
      tags: ["Ceramics", "Natural wine", "Pottery"],
      age: 29,
      suburb: "Newtown, Sydney",
      been: 6,
      bio: "Here for the making and whoever's there for it too. I'll happily talk your ear off about glazes."
    },
    tom: {
      name: "Tom K.",
      intent: "here for the activities",
      tags: ["Coffee", "Film", "Cycling"],
      age: 27,
      suburb: "Marrickville, Sydney",
      been: 4,
      bio: "Always up for trying the thing once. I'll bring the good coffee."
    },
    priya: {
      name: "Priya S.",
      intent: "new to the area",
      tags: ["Ceramics", "Hiking", "Markets"],
      age: 30,
      suburb: "Erskineville, Sydney",
      been: 5,
      bio: "Just moved across town and saying yes to most things. Slow hikes, slower coffees."
    },
    jules: {
      name: "Jules M.",
      intent: "open to dating",
      tags: ["Pottery", "Live music", "Film"],
      age: 31,
      suburb: "Inner West, Sydney",
      been: 11,
      bio: "Potter by hobby, gig-goer by habit. Looking for people to do both with - no small talk required."
    },
    hassan: {
      name: "Hassan A.",
      intent: "growing my circle",
      tags: ["Cocktails", "Cycling", "Food"],
      age: 28,
      suburb: "Surry Hills, Sydney",
      been: 7,
      bio: "New-ish to the area, building a weekend crew. Will ride anywhere there's a good feed at the end."
    },
    bec: {
      name: "Bec T.",
      intent: "here for friends",
      tags: ["Plants", "Cooking", "Markets"],
      age: 26,
      suburb: "Redfern, Sydney",
      been: 3,
      bio: "Plant person, slow cook, market wanderer. Here for easy company."
    },
    daniel: {
      name: "Daniel O.",
      intent: "here for the activities",
      tags: ["Glass", "Coffee", "Design"],
      age: 33,
      suburb: "Marrickville, Sydney",
      been: 8,
      bio: "Maker at heart - give me a workshop and a deadline and I'm happy."
    },
    linh: {
      name: "Linh N.",
      intent: "new to the area",
      tags: ["Running", "Books", "Coffee"],
      age: 29,
      suburb: "Dulwich Hill, Sydney",
      been: 2,
      bio: "Sunrise runs and second-hand bookshops. New here and finding my feet."
    },
    sam: {
      name: "Sam W.",
      intent: "open to dating",
      tags: ["Cocktails", "Vinyl", "Film"],
      age: 30,
      suburb: "Darlington, Sydney",
      been: 5,
      bio: "Records, negronis, late films. Happiest somewhere with a good back catalogue."
    },
    aisha: {
      name: "Aisha B.",
      intent: "here for friends",
      tags: ["Pasta", "Pottery", "Wine"],
      age: 27,
      suburb: "Surry Hills, Sydney",
      been: 6,
      bio: "I cook when I'm nervous and when I'm happy, so basically always. Come hungry."
    }
  };
  const A = (...keys) => keys.map(k => ATT[k]);
  const EVENTS = [{
    id: "ev1",
    name: "Wheel throwing - make two mugs",
    venue: "Posy Ceramics",
    suburb: "Newtown",
    dist: "1.4km",
    when: "Thu 11 Jun · 6:30pm",
    category: "ceramics",
    price: "$110",
    status: "spots",
    count: 9,
    cap: 12,
    founding: true,
    going: ["Mia", "Tom", "Priya", "Jules", "Ada"],
    photo: "clay rising on the wheel",
    blurb: "Two hours at the wheel with Posy's potters. Wedge, centre, pull - you'll leave with two mugs to fire and collect next week. Clay, aprons and a drink sorted.",
    attendees: A("mia", "tom", "priya", "jules")
  }, {
    id: "ev2",
    name: "Greenhouse terrarium build",
    venue: "Merchant & Green",
    suburb: "Redfern",
    dist: "0.9km",
    when: "Sat 13 Jun · 2:00pm",
    category: "workshops",
    price: "$120",
    status: "trending",
    count: 16,
    cap: 20,
    founding: false,
    going: ["Bec", "Daniel", "Linh", "Noa", "Rae"],
    photo: "hands layering moss & gravel",
    blurb: "Build a closed terrarium that looks after itself. Glass vessel, plants, tools and a cutting to take home - plus tea and somewhere warm to potter for the afternoon.",
    attendees: A("bec", "daniel", "linh")
  }, {
    id: "ev3",
    name: "Native cocktails, four pours",
    venue: "",
    suburb: "Surry Hills",
    dist: "0.5km",
    when: "Fri 12 Jun · 7:00pm",
    category: "wine",
    price: "$97",
    status: null,
    count: 11,
    cap: 16,
    founding: false,
    going: ["Hassan", "Aisha", "Sam", "Otis"],
    photo: "a pour over native botanicals",
    blurb: "Four cocktails built on Australian botanicals - wattleseed, finger lime, strawberry gum - with the bartender talking you through each. Snacks between rounds.",
    attendees: A("hassan", "aisha", "sam")
  }, {
    id: "ev4",
    name: "Sunrise run + coffee, 5k",
    venue: "",
    suburb: "Marrickville",
    dist: "2.1km",
    when: "Sat 13 Jun · 6:15am",
    category: "run",
    price: "Free",
    status: "free",
    count: 23,
    cap: 40,
    founding: false,
    going: ["Tom", "Linh", "Mia", "Sol", "Eli", "Bo"],
    photo: "runners at first light",
    blurb: "An easy 5k along the Cooks River as the city wakes up, then coffee for whoever wants it. All paces - the slow group is the fun group.",
    attendees: A("tom", "linh", "mia")
  }, {
    id: "ev5",
    name: "Glass-blowing taster",
    venue: "Mark Eliott Glass",
    suburb: "Marrickville",
    dist: "2.3km",
    when: "Sun 14 Jun · 11:00am",
    category: "art",
    price: "$182",
    status: null,
    count: 10,
    cap: 10,
    full: true,
    founding: true,
    going: ["Daniel", "Priya", "Wren"],
    photo: "molten glass on the rod",
    blurb: "Gather, shape and blow your own glass piece at Mark Eliott's studio furnace. One-to-one with a maker; you'll come away with something you made in the heat.",
    attendees: A("daniel", "priya")
  }, {
    id: "ev6",
    name: "Pasta from scratch",
    venue: "",
    suburb: "Surry Hills",
    dist: "0.6km",
    when: "Wed 10 Jun · 6:30pm",
    category: "cooking",
    price: "$150",
    status: "almostfull",
    count: 14,
    cap: 15,
    founding: false,
    going: ["Aisha", "Jules", "Bec", "Cam"],
    photo: "fresh tagliatelle on the bench",
    blurb: "Make three shapes by hand - tagliatelle, orecchiette, filled parcels - then sit down and eat the lot together with a glass of red.",
    attendees: A("aisha", "jules", "bec")
  }];

  /* interest tags per event (neutral, up to 3 show on card + "+N"; full set on detail) */
  const TAGS = {
    ev1: ["Ceramics", "Hands-on", "Small group", "BYO drink"],
    ev2: ["Plants", "Craft", "Take-home", "Beginner-friendly"],
    ev3: ["Cocktails", "Native botanicals", "Tasting"],
    ev4: ["Running", "Outdoors", "Coffee after", "All paces"],
    ev5: ["Glass", "Hands-on", "One-on-one"],
    ev6: ["Cooking", "Italian", "Sit-down", "Wine"]
  };
  EVENTS.forEach(e => {
    e.tags = TAGS[e.id] || [];
  });
  const BOOKINGS = ["ev1"];
  const SAVED = ["ev2", "ev4"];
  const WAITLIST = ["ev5"]; // amber Waitlist badge in Saved & waitlist
  const PAST = ["ev6", "ev3"]; // events you've attended

  /* demo calendar dates (July 2026) for the My Events calendar/agenda view */
  const MYDATES = {
    ev6: "2026-07-01",
    ev3: "2026-07-03",
    ev1: "2026-07-09",
    ev2: "2026-07-11",
    ev5: "2026-07-12",
    ev4: "2026-07-18"
  };

  /* suggested-for-you sets (matched to Ava's tags: ceramics / plants / run) */
  const SUGGEST_A = ["ev2", "ev4", "ev3"]; // Mode A - near you this week
  const SUGGEST_B = ["ev3", "ev5", "ev6"]; // Mode B - fresh, not already booked/saved

  /* the recently-attended event inside its 48h window (post-event prompt) */
  const RECENT = "ev6"; // Pasta from scratch

  /* CLICK RADAR - the canonical EVENT strip (09 §9). Events near you that people you'd
     click with are going to. Each carries ONE anonymous, AGGREGATE social-proof line
     (≥3-attendee floor; never names/photos/who). Event-first, people-signal-second.
     COLD-START (new user) falls back to honest "trending" - see Radar component. */
  const RADAR = {
    count: 3
  };
  const RADAR_EVENTS = [{
    id: "ev4",
    icon: "spark",
    line: "9 people who also love run clubs are going to"
  },
  // shared-interest → event
  {
    id: "ev2",
    icon: "users",
    line: "6 people who are also into plants are going to"
  },
  // shared-interest → event
  {
    id: "ev3",
    icon: "spark",
    line: "5 people who also enjoy cocktails are going to"
  } // shared-interest → event
  ];
  /* cold-start: top events by velocity, framed honestly as trending (no fake personalisation) */
  const RADAR_COLD = ["ev2", "ev4", "ev1"];

  /* Click-with-someone - the curated daily pool: 3 fresh people a day.
     Shared-context is CONDITIONAL and never fabricated: `sharedEvent` only when you
     were genuinely both in the room; otherwise the real overlap is shared intent +
     interest tags (`overlap`). Bio / prompt / lifeTags live in the PROFILE drawer only. */
  const CLICK_SUGGEST = [{
    name: "Mia R.",
    age: 29,
    intent: "here for friends",
    tags: ["Ceramics", "Natural wine", "Pottery"],
    sharedEvent: "Wheel throwing - make two mugs",
    overlap: null,
    lifeTags: ["New to Newtown", "Dog person"],
    been: 6,
    bio: "Here for the making and whoever's there for it too. I'll happily talk your ear off about glazes.",
    prompt: {
      q: "You'll find me",
      a: "at the pottery studio most Sundays, then a wine bar to wind down."
    }
  }, {
    name: "Jules M.",
    age: 31,
    intent: "open to dating",
    tags: ["Pottery", "Live music", "Film"],
    sharedEvent: null,
    sharedMusic: "house & techno",
    lifeTags: ["Inner West", "Plays in a band"],
    been: 11,
    bio: "Potter by hobby, gig-goer by habit. Looking for people to do both with - no small talk required.",
    prompt: {
      q: "A perfect Saturday",
      a: "a slow morning, a workshop, then something loud at night."
    }
  }, {
    name: "Tom K.",
    age: 27,
    intent: "here for the activities",
    tags: ["Coffee", "Film", "Cycling"],
    sharedEvent: null,
    sharedMusic: null,
    proximity: "You're both nearby",
    lifeTags: ["Marrickville", "Early riser"],
    been: 4,
    bio: "Always up for trying the thing once. I'll bring the good coffee.",
    prompt: {
      q: "Ask me about",
      a: "the best filter coffee in the inner west - I have strong opinions."
    }
  }];

  /* Activity - quiet milestones, never a notification dump. Opportunity framing. */
  const ACTIVITY = [{
    ic: "check",
    text: "You went to Pasta from scratch",
    when: "2 days ago"
  }, {
    ic: "spark",
    text: "Your radar updated - a few familiar faces",
    when: "3 days ago"
  }, {
    ic: "bookmark",
    text: "You saved Greenhouse terrarium build",
    when: "5 days ago"
  }, {
    ic: "calendar",
    text: "You saved a spot at Wheel throwing",
    when: "last week"
  }];

  /* neutral browse-by-category tags (not the coloured event category chips) */
  const CATEGORIES = ["Pottery", "Run clubs", "Wine", "Cooking", "Live music", "Markets"];

  /* INTEREST TAGS (07 §interest_tags) — the SPECIFIC things a profile selects, grouped under
     their category heading. Canonical 16-category order; first 8 show by default, the rest behind
     "Show more". Dating is gated to dating-intent users. A profile picks TAGS, never categories. */
  const INTEREST_TAGS = [{
    key: "wellness",
    label: "Wellness",
    tags: ["Yoga", "Pilates", "Meditation", "Breathwork", "Sound baths", "Cold plunge"]
  }, {
    key: "food",
    label: "Food & Drink",
    tags: ["Wine tasting", "Natural wine", "Cocktails", "Cooking classes", "Pasta making", "Coffee", "Long lunches", "Baking"]
  }, {
    key: "arts",
    label: "Arts & Crafts",
    tags: ["Pottery", "Ceramics", "Life drawing", "Painting", "Printmaking", "Glass-blowing", "Candle making"]
  }, {
    key: "social",
    label: "Social",
    tags: ["Trivia nights", "Board games", "Book club", "Dinner parties", "Pub quizzes"]
  }, {
    key: "music",
    label: "Music",
    tags: ["Live music", "Gigs", "Vinyl", "Open mic", "Festivals", "Jazz nights"]
  }, {
    key: "fitness",
    label: "Fitness & Sport",
    tags: ["Run clubs", "Bouldering", "Tennis", "Boxing", "Swimming", "Cycling"]
  }, {
    key: "outdoors",
    label: "Outdoors",
    tags: ["Hiking", "Surfing", "Kayaking", "Beach days", "Bushwalks", "Camping"]
  }, {
    key: "learning",
    label: "Learning",
    tags: ["Workshops", "Talks & lectures", "Languages", "Photography", "Writing"]
  }, {
    key: "networking",
    label: "Networking",
    tags: ["Founders", "Tech meetups", "Creative industries", "Side projects"]
  }, {
    key: "dance",
    label: "Dance",
    tags: ["Salsa", "Swing", "Contemporary", "Hip hop", "Line dancing"]
  }, {
    key: "creative",
    label: "Creative",
    tags: ["Film", "Design", "DIY", "Crafts", "Zines"]
  }, {
    key: "lifestyle",
    label: "Lifestyle",
    tags: ["Plants", "Thrifting", "Markets", "Interiors", "Slow living"]
  }, {
    key: "community",
    label: "Community",
    tags: ["Volunteering", "Local causes", "Community gardens"]
  }, {
    key: "travel",
    label: "Travel",
    tags: ["Weekend trips", "Road trips", "Day trips", "Backpacking"]
  }, {
    key: "family",
    label: "Family",
    tags: ["Kid-friendly", "Playgroups", "Family outings"]
  }, {
    key: "dating",
    label: "Dating",
    gated: true,
    tags: ["Coffee dates", "Walk & talk", "Dinner dates", "Day-date ideas"]
  }];
  /* MUSIC TAGS (07 §9) — a fixed 25-genre soft affinity signal; NOT a category, NOT used for filtering. */
  const MUSIC_TAGS = ["Pop", "Rock", "Jazz", "Electronic", "House", "Techno", "Trance", "Hip Hop", "R&B", "Indie", "Folk", "Classical", "Lo-Fi", "Reggae", "Acoustic", "Soul", "Funk", "Country", "Latin", "Punk", "Afrobeats", "Disco", "Ambient", "Metal", "Blues"];
  const CLICKS = [{
    id: "c1",
    name: "Mia R.",
    event: "Wheel throwing - make two mugs",
    when: "Thu 6:30pm",
    met: "Saturday",
    intent: "friends",
    sharedEvent: "Wheel throwing - make two mugs",
    tags: ["Ceramics", "Natural wine"],
    dating: false,
    state: "mutual",
    coord: "their_turn",
    suburb: "Newtown"
  }, {
    id: "c2",
    name: "Jules M.",
    event: "Open-decks vinyl night",
    when: "Fri",
    intent: "friends",
    sharedMusic: "house & live sets",
    tags: ["Pottery", "Live music"],
    dating: true,
    state: "mutual",
    coord: "open",
    suggestion: {
      name: "Open-decks vinyl night",
      when: "Fri"
    },
    suburb: "Marrickville"
  }, {
    id: "c6",
    name: "Noa B.",
    event: "Long lunch, four courses",
    when: "Sun 1pm",
    intent: "friends",
    commonLife: "Both pet owners",
    tags: ["Wine", "Cooking"],
    dating: false,
    state: "mutual",
    coord: "proposed_waiting",
    lastActive: "2h",
    suburb: "Surry Hills"
  }, {
    id: "c4",
    name: "Priya S.",
    event: "Greenhouse terrarium build",
    when: "Sat · 2:00pm · Redfern",
    intent: "friends",
    tags: ["Plants", "Markets"],
    dating: false,
    state: "plan",
    planEvent: "ev2",
    suburb: "Redfern"
  }, {
    id: "c5",
    name: "Tom K.",
    event: "Sunrise run + coffee, 5k",
    plan: "Sunrise run + coffee",
    when: "last week",
    intent: "the activities",
    tags: ["Coffee", "Film"],
    dating: false,
    state: "connected",
    suburb: "Marrickville"
  }, {
    id: "c7",
    name: "Eli W.",
    intent: "friends",
    proximity: "You're both nearby",
    tags: ["Film", "Cycling"],
    dating: false,
    state: "mutual",
    coord: "open",
    suburb: "Newtown"
  }, {
    id: "c3",
    name: "Hassan A.",
    event: "Native cocktails, four pours",
    when: "Fri",
    state: "released",
    suburb: "Surry Hills"
  }];

  /* relative-time from when an event ENDED - magic-protective (never a timer/countdown).
     same calendar day -> "earlier today"; day before -> "yesterday"; within ~6 days ->
     "on [weekday]"; older -> the date. Capitalised; lower-case it at the call site if needed. */
  function relativeEventTime(end, now) {
    now = now || new Date();
    const d0 = new Date(now);
    d0.setHours(0, 0, 0, 0);
    const e0 = new Date(end);
    e0.setHours(0, 0, 0, 0);
    const days = Math.round((d0 - e0) / 86400000);
    if (days <= 0) return "Earlier today";
    if (days === 1) return "Yesterday";
    if (days <= 6) return "On " + ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(end).getDay()];
    return new Date(end).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short"
    });
  }
  /* the recent event ended ~a day ago in the demo -> "Yesterday" */
  const RECENT_REL = relativeEventTime(new Date(Date.now() - 24 * 3600 * 1000));

  /* attendance-gated pool for "Who was there" - everyone who attended RECENT (Pasta from
     scratch) and is visible. The commonality LINE carries a NON-interest axis (a different
     earlier event / shared music / cluster proximity); life tags stay private until mutual,
     so the pre-mutual who-was-there line never uses them. Interests live in the tags only. */
  const WERE_THERE = [{
    ...ATT.bec,
    sharedEvent: "Greenhouse terrarium build"
  }, {
    ...ATT.aisha,
    sharedMusic: "jazz & soul"
  }, {
    ...ATT.jules,
    dating: true,
    mutual: true,
    sharedMusic: "house & techno"
  }, {
    ...ATT.mia,
    proximity: "You're both nearby"
  }, {
    ...ATT.sam,
    dating: true
  }, {
    ...ATT.priya
  }, {
    ...ATT.hassan
  }, {
    ...ATT.tom
  }, {
    ...ATT.daniel
  }, {
    ...ATT.linh
  }, {
    name: "Otis P.",
    intent: "open to dating",
    tags: ["Wine", "Cooking", "Film"],
    age: 32,
    suburb: "Chippendale, Sydney",
    been: 4,
    dating: true,
    bio: "Long dinners, longer films. I'll bring a good bottle."
  }, {
    name: "Rae M.",
    intent: "here for friends",
    tags: ["Pasta", "Markets", "Coffee"],
    age: 28,
    suburb: "Camperdown, Sydney",
    been: 5,
    sharedMusic: "folk & indie",
    bio: "Weekend markets then something on the stove. Easy company, no agenda."
  }, {
    name: "Noa B.",
    intent: "growing my circle",
    tags: ["Wine", "Cooking", "Hiking"],
    age: 30,
    suburb: "Stanmore, Sydney",
    been: 6,
    proximity: "You're both nearby",
    bio: "New-ish crew, always room for one more at the table."
  }, {
    name: "Cam D.",
    intent: "here for the activities",
    tags: ["Cycling", "Coffee", "Design"],
    age: 29,
    suburb: "Petersham, Sydney",
    been: 3,
    bio: "Here for the making. Will cycle a long way for a good flat white."
  }, {
    name: "Wren L.",
    intent: "open to dating",
    tags: ["Vinyl", "Film", "Cocktails"],
    age: 27,
    suburb: "Enmore, Sydney",
    been: 4,
    dating: true,
    bio: "Records, repertory cinema, a negroni after. That's the night."
  }, {
    name: "Eli W.",
    intent: "here for friends",
    tags: ["Film", "Cycling", "Coffee"],
    age: 31,
    suburb: "Lewisham, Sydney",
    been: 7,
    bio: "Up for most things midweek. Good chat, low stakes."
  }];
  window.DATA = {
    EVENTS,
    BOOKINGS,
    SAVED,
    WAITLIST,
    PAST,
    MYDATES,
    SUGGEST_A,
    SUGGEST_B,
    RECENT,
    RECENT_REL,
    relativeEventTime,
    WERE_THERE,
    RADAR,
    RADAR_EVENTS,
    RADAR_COLD,
    CLICK_SUGGEST,
    ACTIVITY,
    CATEGORIES,
    INTEREST_TAGS,
    MUSIC_TAGS,
    CLICKS,
    byId: id => EVENTS.find(e => e.id === id)
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/data.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/discovery.jsx
try { (() => {
(function () {
  /* Click - Discovery (/events). Responsive WEBSITE.
     Desktop (>=1024): category icon-strip + left Type/Date/Distance sidebar + sortable 3-up grid.
     Mobile (<768): sticky search -> horizontal category chips -> Filters bottom sheet (slide-up + dim)
       -> removable applied-filter chips -> single-column cards.
     Category icons = ONE on-brand treatment: purple line icon on lavender-tint circle;
     selected = circle fills Deep Purple, icon reverses to cream. No rainbow. Inline styles. */
  const {
    useState,
    useEffect,
    CAT,
    Icon,
    Btn
  } = window.CK;
  const D = window.DATA;
  const {
    EVENTS
  } = D;
  const EventCard = window.ScreensA.EventCard;

  /* ---------------- CANONICAL CATEGORY SYSTEM - the 16 (source of truth: TECH/07_INTEREST_TAGS).
       ONE Lucide line glyph per category on a Lavender tint circle; identical on Discovery,
       Dashboard, Onboarding. Selected = Deep Purple fill, glyph reverses to Cream. ---------------- */
  const CAT_ICONS = {
    all: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 6h16"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 12h16"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 18h10"
    })),
    wellness: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
    })),
    food: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M8 22h8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 10h10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 15v7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"
    })),
    arts: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 3a9 8 0 0 0 0 16 1.8 1.8 0 0 0 1.7-2.4 1.8 1.8 0 0 1 1.7-2.4H17a4 4 0 0 0 4-4 9 8 0 0 0-9-7.2Z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "8",
      cy: "9.5",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12.5",
      cy: "7",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "16",
      cy: "11",
      r: "1"
    })),
    social: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "7",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M22 21v-2a4 4 0 0 0-3-3.87"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16 3.13a4 4 0 0 1 0 7.75"
    })),
    music: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M9 18V5l12-2v13"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "18",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "16",
      r: "3"
    })),
    fitness: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "m6.5 6.5 11 11"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m21 21-1-1"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m3 3 1 1"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m18 22 4-4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m2 6 4-4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m3 10 7-7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m14 21 7-7"
    })),
    outdoors: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "m8 3 4 8 5-5 5 15H2L8 3z"
    })),
    learning: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-2.6H3z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M21 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-2.6h6z"
    })),
    networking: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "2",
      y: "7",
      width: "20",
      height: "13",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M2 13h20"
    })),
    dance: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M9 18V5l12-2v13"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m9 9 12-2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "18",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "16",
      r: "3"
    })),
    creative: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a9 9 0 0 1-16 0V5Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 9h.01"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M15 9h.01"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.5 13a4 4 0 0 0 7 0"
    })),
    lifestyle: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19 4v3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M20.5 5.5h-3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 17v2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M6 18H4"
    })),
    community: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M7 20h10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 20c5.5-2.5.8-6.4 3-10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"
    })),
    travel: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 4v14"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M15 6v14"
    })),
    family: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M9 12h.01"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M15 12h.01"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M17.6 7.6a9 9 0 0 1 3 4 1.8 1.8 0 0 1 0 1.6 9 9 0 0 1-17.2 0 1.8 1.8 0 0 1 0-1.6A9 9 0 0 1 12 3c1.6 0 3 .7 3 2s-.8 2-1.8 2c-.7 0-1.2-.4-1.2-.9"
    })),
    dating: () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
    }))
  };
  function CatGlyph({
    name,
    size = 20,
    w = 1.75,
    color = "currentColor"
  }) {
    const draw = CAT_ICONS[name] || CAT_ICONS.all;
    return /*#__PURE__*/React.createElement("svg", {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: w,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        flex: "none"
      }
    }, draw());
  }

  /* the canonical 16 + All (07 display order). `cats` maps to the mockup's event.category values;
     `gated` (Dating) renders only for dating-intent users, never in the default browse set. */
  const CATS = [{
    key: "all",
    label: "All",
    icon: "all",
    cats: null
  }, {
    key: "wellness",
    label: "Wellness",
    icon: "wellness",
    cats: []
  }, {
    key: "food",
    label: "Food & Drink",
    icon: "food",
    cats: ["wine", "cooking"]
  }, {
    key: "arts",
    label: "Arts & Crafts",
    icon: "arts",
    cats: ["ceramics", "art"]
  }, {
    key: "social",
    label: "Social",
    icon: "social",
    cats: []
  }, {
    key: "music",
    label: "Music",
    icon: "music",
    cats: ["music"]
  }, {
    key: "fitness",
    label: "Fitness & Sport",
    icon: "fitness",
    cats: ["run"]
  }, {
    key: "outdoors",
    label: "Outdoors",
    icon: "outdoors",
    cats: []
  }, {
    key: "learning",
    label: "Learning",
    icon: "learning",
    cats: ["workshops"]
  }, {
    key: "networking",
    label: "Networking",
    icon: "networking",
    cats: []
  }, {
    key: "dance",
    label: "Dance",
    icon: "dance",
    cats: []
  }, {
    key: "creative",
    label: "Creative",
    icon: "creative",
    cats: []
  }, {
    key: "lifestyle",
    label: "Lifestyle",
    icon: "lifestyle",
    cats: []
  }, {
    key: "community",
    label: "Community",
    icon: "community",
    cats: []
  }, {
    key: "travel",
    label: "Travel",
    icon: "travel",
    cats: []
  }, {
    key: "family",
    label: "Family",
    icon: "family",
    cats: []
  }, {
    key: "dating",
    label: "Dating",
    icon: "dating",
    cats: [],
    gated: true
  }];
  const TYPES = [["free", "Free"], ["under25", "Under $25"], ["trending", "Trending"], ["new", "New"], ["suggested", "Suggested for you"]];
  const DATES = [["any", "Any"], ["today", "Today"], ["weekend", "This weekend"], ["week", "This week"], ["month", "This month"]];
  const SORTS = [["soon", "Soonest"], ["near", "Nearest"], ["trending", "Trending"], ["price", "Price"]];
  const DAY = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };
  const priceNum = e => e.price === "Free" ? 0 : parseInt(e.price.replace(/[^0-9]/g, ""), 10) || 0;
  const distNum = e => parseFloat(e.dist) || 99;
  const dayOf = e => DAY[e.when.split(" ")[0]] || 9;
  const SUGGEST = new Set(D.SUGGEST_B);
  const TRENDY = {
    trending: 0,
    almostfull: 1,
    spots: 2,
    new: 3,
    free: 4
  };
  function matchType(e, k) {
    if (k === "free") return priceNum(e) === 0;
    if (k === "under25") return priceNum(e) > 0 && priceNum(e) < 25;
    if (k === "trending") return e.status === "trending" || e.status === "almostfull";
    if (k === "new") return e.status === "new";
    if (k === "suggested") return SUGGEST.has(e.id);
    return true;
  }
  function matchDate(e, d) {
    if (d === "any" || d === "week" || d === "month") return true;
    if (d === "today") return dayOf(e) === 4; // demo "today" = Thursday
    if (d === "weekend") return dayOf(e) >= 6;
    return true;
  }

  /* ---------------- category chip: icon-in-circle + label (the on-brand treatment) ---------------- */
  function CatChip({
    c,
    active,
    onClick,
    web
  }) {
    const [hov, setHov] = useState(false);
    const d = web ? 56 : 48;
    const bg = active ? "var(--purple-600)" : hov ? "color-mix(in srgb,var(--lavender-300) 32%,var(--cream))" : "color-mix(in srgb,var(--lavender-300) 18%,var(--cream))";
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      onMouseEnter: () => setHov(true),
      onMouseLeave: () => setHov(false),
      style: {
        flex: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        width: web ? 88 : 78,
        padding: 0,
        background: "none",
        border: "none",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: d,
        height: d,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background .15s"
      }
    }, /*#__PURE__*/React.createElement(CatGlyph, {
      name: c.icon,
      size: web ? 26 : 23,
      color: active ? "var(--cream)" : "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        lineHeight: 1.25,
        color: active ? "var(--purple-700)" : "var(--text-body)",
        textAlign: "center"
      }
    }, c.label));
  }
  function CatStrip({
    value,
    onChange,
    web
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "ckRail",
      style: {
        display: "flex",
        gap: web ? 6 : 4,
        overflowX: web ? "visible" : "auto",
        flexWrap: web ? "wrap" : "nowrap",
        margin: web ? 0 : "0 -22px",
        padding: web ? 0 : "2px 22px 2px"
      }
    }, CATS.filter(c => !c.gated).map(c => /*#__PURE__*/React.createElement(CatChip, {
      key: c.key,
      c: c,
      web: web,
      active: value === c.key,
      onClick: () => onChange(c.key)
    })));
  }

  /* ---------------- shared filter controls ---------------- */
  function FilterGroup({
    label,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 22
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 11px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-muted)"
      }
    }, label), children);
  }
  function Pill({
    active,
    onClick,
    children
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 14px",
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
        transition: "background .15s,border-color .15s",
        background: active ? "var(--purple-600)" : "var(--white)",
        color: active ? "var(--cream)" : "var(--text-body)",
        border: `1.5px solid ${active ? "var(--purple-600)" : "var(--border-mid)"}`
      }
    }, active && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 14,
      w: 2.6,
      color: "var(--cream)"
    }), children);
  }
  function FilterBody({
    types,
    toggleType,
    date,
    setDate,
    dist,
    setDist
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FilterGroup, {
      label: "Type"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, TYPES.map(([k, l]) => /*#__PURE__*/React.createElement(Pill, {
      key: k,
      active: types.includes(k),
      onClick: () => toggleType(k)
    }, l)))), /*#__PURE__*/React.createElement(FilterGroup, {
      label: "Date"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, DATES.map(([k, l]) => /*#__PURE__*/React.createElement(Pill, {
      key: k,
      active: date === k,
      onClick: () => setDate(k)
    }, l)))), /*#__PURE__*/React.createElement(FilterGroup, {
      label: "Distance"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, [[1, "1 km"], [3, "3 km"], [5, "5 km"], [10, "10 km"], [25, "Any distance"]].map(([v, l]) => /*#__PURE__*/React.createElement(Pill, {
      key: v,
      active: dist === v,
      onClick: () => setDist(v)
    }, l)))));
  }
  function SortSelect({
    value,
    onChange
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("select", {
      value: value,
      onChange: e => onChange(e.target.value),
      style: {
        appearance: "none",
        WebkitAppearance: "none",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)",
        padding: "8px 32px 8px 14px",
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-strong)",
        cursor: "pointer"
      }
    }, SORTS.map(([k, l]) => /*#__PURE__*/React.createElement("option", {
      key: k,
      value: k
    }, "Sort \xB7 ", l))), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        right: 11,
        pointerEvents: "none",
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevD",
      size: 15,
      color: "var(--text-muted)"
    })));
  }
  function SearchField({
    value,
    onChange,
    web
  }) {
    const [f, setF] = useState(false);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 15px",
        height: 48,
        background: "var(--white)",
        border: `1.5px solid ${f ? "var(--accent)" : "var(--border-mid)"}`,
        borderRadius: "var(--radius-md)",
        boxShadow: f ? "0 0 0 4px color-mix(in srgb,var(--lavender-300) 42%,transparent)" : "var(--shadow-xs)",
        width: "100%",
        transition: "border .15s,box-shadow .15s"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 19,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("input", {
      value: value,
      placeholder: "Search events, venues, or interests\u2026",
      onChange: e => onChange(e.target.value),
      onFocus: () => setF(true),
      onBlur: () => setF(false),
      style: {
        flex: 1,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: "none",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        color: "var(--text-strong)"
      }
    }), value && /*#__PURE__*/React.createElement("button", {
      onClick: () => onChange(""),
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        display: "flex",
        padding: 2
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 16,
      w: 2,
      color: "var(--text-muted)"
    })));
  }
  function AppliedChip({
    children,
    onRemove
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 8px 6px 13px",
        borderRadius: "var(--radius-pill)",
        background: "var(--lavender-100)",
        color: "var(--purple-700)",
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap"
      }
    }, children, /*#__PURE__*/React.createElement("button", {
      onClick: onRemove,
      style: {
        border: "none",
        background: "color-mix(in srgb,var(--purple-600) 14%,transparent)",
        borderRadius: "50%",
        width: 18,
        height: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 11,
      w: 2.6,
      color: "var(--purple-700)"
    })));
  }

  /* ====================== DISCOVERY ====================== */
  function Discover({
    web,
    width = 1440,
    open,
    saved,
    toggleSave,
    initialCat = "all"
  }) {
    /* the left filter SIDEBAR appears only ≥1024; 768 uses the Filters-button → sheet pattern (TEMPLATE §1a) */
    const sidebar = web && width >= 1024;
    const [q, setQ] = useState("");
    const [cat, setCat] = useState(initialCat);
    const [types, setTypes] = useState([]);
    const [date, setDate] = useState("any");
    const [dist, setDist] = useState(25);
    const [sort, setSort] = useState("soon");
    const [sheet, setSheet] = useState(false);
    const [layer, setLayer] = useState(null);
    useEffect(() => {
      setLayer(document.getElementById("ckModalLayer"));
    }, [sheet]);
    const toggleType = k => setTypes(t => t.includes(k) ? t.filter(x => x !== k) : [...t, k]);
    const catDef = CATS.find(c => c.key === cat) || CATS[0];
    const ql = q.trim().toLowerCase();
    let list = EVENTS.filter(e => (!catDef.cats || catDef.cats.includes(e.category)) && types.every(k => matchType(e, k)) && matchDate(e, date) && distNum(e) <= dist && (!ql || [e.name, e.venue, e.suburb].filter(Boolean).join(" ").toLowerCase().includes(ql)));
    list = list.slice().sort((a, b) => sort === "near" ? distNum(a) - distNum(b) : sort === "trending" ? (TRENDY[a.status] ?? 9) - (TRENDY[b.status] ?? 9) : sort === "price" ? priceNum(a) - priceNum(b) : dayOf(a) - dayOf(b));
    const filterCount = types.length + (date !== "any" ? 1 : 0) + (dist < 25 ? 1 : 0);
    const anyFilter = filterCount > 0 || ql || cat !== "all";
    const reset = () => {
      setTypes([]);
      setDate("any");
      setDist(25);
    };
    const resetAll = () => {
      reset();
      setQ("");
      setCat("all");
    };
    const coldStart = list.length === 0 && filterCount === 0 && !ql; // empty category only

    const Results = () => {
      if (list.length > 0) return /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: web ? "repeat(auto-fill,minmax(280px,1fr))" : "repeat(2,1fr)",
          gap: web ? 22 : 12
        }
      }, list.map(e => /*#__PURE__*/React.createElement(EventCard, {
        key: e.id,
        e: e,
        mini: !web,
        onClick: () => open(e),
        saved: saved.has(e.id),
        onSave: () => toggleSave(e.id)
      })));
      if (coldStart) return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 16,
          color: "var(--purple-700)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "spark",
        size: 18,
        w: 1.9,
        color: "var(--purple-500)"
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 14.5,
          fontWeight: 600
        }
      }, "Nothing on for that yet - new here? Start with these.")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: web ? "repeat(auto-fill,minmax(280px,1fr))" : "repeat(2,1fr)",
          gap: web ? 22 : 12
        }
      }, EVENTS.slice(0, 3).map(e => /*#__PURE__*/React.createElement(EventCard, {
        key: e.id,
        e: e,
        mini: !web,
        onClick: () => open(e),
        saved: saved.has(e.id),
        onSave: () => toggleSave(e.id)
      }))));
      return /*#__PURE__*/React.createElement("div", {
        style: {
          background: "var(--surface-tint)",
          borderRadius: "var(--radius-xl)",
          padding: web ? "48px 30px" : "36px 22px",
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "center",
          marginBottom: 14
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "compass",
        size: 32,
        w: 1.7,
        color: "var(--purple-400)"
      })), /*#__PURE__*/React.createElement("h3", {
        style: {
          margin: "0 0 8px",
          fontSize: 17,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, ql ? `No events match "${q.trim()}" yet` : "Nothing matches those filters."), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 18px",
          fontSize: 14.5,
          color: "var(--text-muted)",
          lineHeight: 1.55,
          maxWidth: 360,
          marginInline: "auto"
        }
      }, ql ? "Try a category below, or widen your filters." : "Try widening the date or distance - there's always more on next week."), /*#__PURE__*/React.createElement(Btn, {
        variant: "secondary",
        size: "sm",
        onClick: resetAll
      }, "Clear filters"));
    };

    /* applied-filter chips (visible state without reopening) */
    const chips = [...types.map(k => ({
      k,
      label: TYPES.find(t => t[0] === k)[1],
      remove: () => toggleType(k)
    })), ...(date !== "any" ? [{
      k: "date",
      label: DATES.find(d => d[0] === date)[1],
      remove: () => setDate("any")
    }] : []), ...(dist < 25 ? [{
      k: "dist",
      label: `${dist} km`,
      remove: () => setDist(25)
    }] : [])];

    /* ---------- DESKTOP (>=1024): sidebar layout ---------- */
    if (sidebar) return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "12px 40px 56px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1200,
        margin: "0 auto"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 4px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1.25,
        color: "var(--text-strong)"
      }
    }, "What's on near you"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 18px",
        fontSize: 14.5,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, EVENTS.length, " events this week"), /*#__PURE__*/React.createElement(SearchField, {
      value: q,
      onChange: setQ,
      web: true
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: "18px 0 8px"
      }
    }, /*#__PURE__*/React.createElement(CatStrip, {
      value: cat,
      onChange: setCat,
      web: true
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 36,
        alignItems: "flex-start",
        marginTop: 18
      }
    }, /*#__PURE__*/React.createElement("aside", {
      style: {
        flex: "none",
        width: 260,
        position: "sticky",
        top: 16
      }
    }, /*#__PURE__*/React.createElement(FilterBody, {
      types: types,
      toggleType: toggleType,
      date: date,
      setDate: setDate,
      dist: dist,
      setDist: setDist
    }), anyFilter && /*#__PURE__*/React.createElement("button", {
      onClick: resetAll,
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-600)",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 15,
      w: 2.2
    }), "Reset all")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, list.length, " ", list.length === 1 ? "event" : "events"), /*#__PURE__*/React.createElement(SortSelect, {
      value: sort,
      onChange: setSort
    })), chips.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        marginBottom: 18
      }
    }, chips.map(c => /*#__PURE__*/React.createElement(AppliedChip, {
      key: c.k,
      onRemove: c.remove
    }, c.label)), /*#__PURE__*/React.createElement("button", {
      onClick: reset,
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-muted)",
        whiteSpace: "nowrap",
        padding: "0 4px"
      }
    }, "Clear all")), /*#__PURE__*/React.createElement(Results, null)))));

    /* ---------- MOBILE (<768): sticky search -> chips -> filters sheet -> applied chips -> cards ---------- */
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "6px 0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "sticky",
        top: 0,
        padding: "6px 22px 0",
        background: "var(--cream)",
        zIndex: 6
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 12px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1.25,
        color: "var(--text-strong)"
      }
    }, "What's on near you"), /*#__PURE__*/React.createElement(SearchField, {
      value: q,
      onChange: setQ
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(CatStrip, {
      value: cat,
      onChange: setCat
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0 6px"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setSheet(true),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 14px",
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: 600,
        background: filterCount ? "var(--purple-600)" : "var(--white)",
        color: filterCount ? "var(--cream)" : "var(--text-body)",
        border: `1.5px solid ${filterCount ? "var(--purple-600)" : "var(--border-mid)"}`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "filter",
      size: 16,
      w: 2,
      color: filterCount ? "var(--cream)" : "var(--text-body)"
    }), "Filters", filterCount ? ` · ${filterCount}` : ""), /*#__PURE__*/React.createElement(SortSelect, {
      value: sort,
      onChange: setSort
    })), chips.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "ckRail",
      style: {
        display: "flex",
        gap: 8,
        overflowX: "auto",
        margin: "0 -22px",
        padding: "4px 22px 10px"
      }
    }, chips.map(c => /*#__PURE__*/React.createElement(AppliedChip, {
      key: c.k,
      onRemove: c.remove
    }, c.label)), /*#__PURE__*/React.createElement("button", {
      onClick: reset,
      style: {
        flex: "none",
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-muted)",
        whiteSpace: "nowrap"
      }
    }, "Clear"))), sheet && (() => {
      const overlay = /*#__PURE__*/React.createElement("div", {
        onClick: () => setSheet(false),
        style: {
          position: layer ? "absolute" : "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(28,24,48,.5)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          pointerEvents: "auto"
        }
      }, /*#__PURE__*/React.createElement("div", {
        onClick: e => e.stopPropagation(),
        style: {
          width: "100%",
          maxWidth: layer ? "none" : 560,
          maxHeight: "86%",
          display: "flex",
          flexDirection: "column",
          background: "var(--white)",
          borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "none",
          paddingTop: 8,
          display: "flex",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 40,
          height: 5,
          borderRadius: 999,
          background: "var(--mist-strong)"
        }
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 18px 10px"
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: reset,
        style: {
          border: "none",
          background: "none",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--purple-600)",
          minHeight: 44,
          display: "inline-flex",
          alignItems: "center"
        }
      }, "Reset"), /*#__PURE__*/React.createElement("h3", {
        style: {
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: 17,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, "Filters"), /*#__PURE__*/React.createElement("button", {
        onClick: () => setSheet(false),
        "aria-label": "Close filters",
        style: {
          border: "none",
          background: "none",
          cursor: "pointer",
          width: 44,
          height: 44,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "x",
        size: 20,
        w: 2.2,
        color: "var(--text-body)"
      }))), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          overflowY: "auto",
          padding: "0 18px 10px"
        }
      }, /*#__PURE__*/React.createElement(FilterBody, {
        types: types,
        toggleType: toggleType,
        date: date,
        setDate: setDate,
        dist: dist,
        setDist: setDist
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "none",
          padding: "10px 18px calc(16px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--border-soft)",
          background: "var(--white)"
        }
      }, /*#__PURE__*/React.createElement(Btn, {
        full: true,
        size: "lg",
        onClick: () => setSheet(false)
      }, "Show ", list.length, " ", list.length === 1 ? "event" : "events"))));
      return layer ? window.ReactDOM.createPortal(overlay, layer) : overlay;
    })(), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 22px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-muted)",
        margin: "2px 0 14px"
      }
    }, list.length, " ", list.length === 1 ? "event" : "events", coldStart ? "" : " near you"), /*#__PURE__*/React.createElement(Results, null)));
  }
  window.ScreensDisc = {
    Discover,
    CatGlyph,
    CATS,
    CAT_ICONS,
    CatChip
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/discovery.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/event-detail.jsx
try { (() => {
(function () {
  /* Click - EVENT DETAIL (responsive website). Three booking states:
     LOCKED (suburb only, venue hidden, aggregate FOMO) · WAITLIST (full, position + offer)
     · UNLOCKED (booked: venue revealed + map + attendees + manage + cancel).
     Desktop ≥1024 = two columns (content left + sticky booking panel right, NO bottom bar).
     Tablet 768–1024 = single column, panel in-flow after the title.
     Phone <768 = single column + a SLIM price+button sticky bottom bar (capacity/avatars in flow).
     NO "click with" anywhere. Aggregate social proof only. Inline styles. window.ScreensED. */
  const {
    useState,
    useEffect,
    CAT,
    Icon,
    Avatar,
    Stack,
    Btn,
    Cover,
    Tag,
    Spark,
    PeopleCard
  } = window.CK;
  const D = window.DATA;
  /* names you have an ACTIVE MUTUAL with - drives the attendee "clicked ✨" marker (mutual peak only) */
  const MUTUAL_NAMES = new Set((D.CLICKS || []).filter(c => c.state === "mutual").map(c => c.name));

  /* ---- helpers ---- */
  const priceNum = p => p === "Free" || !p ? 0 : Number(String(p).replace(/[^0-9.]/g, "")) || 0;
  const money = n => n === 0 ? "Free" : "$" + n;
  const firstName = (n = "") => n.split(/\s+/)[0].replace(/[^A-Za-z]/g, "");

  /* ---- guest-details (19_GUEST_RSVP v2): per-seat optional naming = first name + email + DOB,
     all required ONCE a seat is named; an unnamed seat is a frictionless +1; consent shows only
     when ≥1 named; DOB is the 18+ gate, nothing more (no last name, no postcode). ---- */
  const EVENT_DATE = new Date("2026-06-13");
  const PURCHASER_EMAIL = "ava.mendez@email.com";
  const emailOk = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((s || "").trim());
  const ageAt = (dob, when) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d)) return null;
    let a = when.getFullYear() - d.getFullYear();
    const m = when.getMonth() - d.getMonth();
    if (m < 0 || m === 0 && when.getDate() < d.getDate()) a--;
    return a;
  };
  function seatError(s, all) {
    if (!s.open) return null; // unnamed +1 is always valid
    if (!s.name || s.name.trim().length < 2) return {
      field: "name",
      msg: "Add their first name"
    };
    if (!emailOk(s.email)) return {
      field: "email",
      msg: "Add a valid email"
    };
    if (s.email.trim().toLowerCase() === PURCHASER_EMAIL) return {
      field: "email",
      msg: "That's your email - use theirs"
    };
    if (all.some(o => o !== s && o.open && o.email && o.email.trim().toLowerCase() === s.email.trim().toLowerCase())) return {
      field: "email",
      msg: "Already added on another seat"
    };
    if (!s.dob) return {
      field: "dob",
      msg: "Add their date of birth"
    };
    if ((ageAt(s.dob, EVENT_DATE) || 0) < 18) return {
      field: "dob",
      msg: "Guests need to be 18+ for this one"
    };
    return null;
  }
  function guestsReady(seats, consent) {
    const named = seats.filter(s => s.open);
    if (named.some(s => seatError(s, seats))) return false;
    if (named.length > 0 && !consent) return false;
    return true;
  }

  /* "When you're in, you'll get" — outcome-led value block (never withholding-framed) */
  function ValueBlock() {
    const items = [["pin", "The exact spot", "The full venue and address, and a map to get there."], ["users", "Who's going", "See who else is coming, and shared interests."], ["calendar", "It's in your calendar", "Add it in a tap so you don't miss it."]];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        margin: "0 0 14px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "var(--purple-600)",
        marginBottom: 10
      }
    }, "When you're in, you'll get"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, items.map(([ic, t, d]) => /*#__PURE__*/React.createElement("div", {
      key: t,
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 11
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ic,
      size: 15,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.3
      }
    }, t), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.45,
        marginTop: 1
      }
    }, d))))));
  }
  const gInput = {
    width: "100%",
    boxSizing: "border-box",
    height: 44,
    padding: "0 12px",
    background: "var(--white)",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border-mid)",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-sans)",
    fontSize: 14.5,
    color: "var(--text-strong)",
    outline: "none"
  };
  function SeatRow({
    i,
    s,
    err,
    update
  }) {
    const seatNo = i + 2; // purchaser is seat 1
    if (!s.open) return /*#__PURE__*/React.createElement("button", {
      onClick: () => update(i, {
        open: true
      }),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        textAlign: "left",
        padding: "11px 13px",
        borderRadius: "var(--radius-md)",
        border: "1px dashed var(--border-mid)",
        background: "var(--white)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-body)"
      }
    }, "Seat ", seatNo, " \xB7 add their details ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-faint)",
        fontWeight: 500
      }
    }, "(optional)")), /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 15,
      w: 2.2,
      color: "var(--purple-600)"
    }));
    const fieldErr = f => err && err.field === f;
    const errStyle = {
      borderColor: "#B5362F"
    };
    const msg = f => fieldErr(f) ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "#B5362F",
        marginTop: 4
      }
    }, err.msg) : null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "13px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-soft)",
        background: "var(--surface-tint)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, "Seat ", seatNo), /*#__PURE__*/React.createElement("button", {
      onClick: () => update(i, {
        open: false,
        name: "",
        email: "",
        dob: ""
      }),
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, "Leave as a +1")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
      value: s.name,
      onChange: e => update(i, {
        name: e.target.value
      }),
      placeholder: "First name",
      style: {
        ...gInput,
        ...(fieldErr("name") ? errStyle : {})
      }
    }), msg("name")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
      value: s.email,
      onChange: e => update(i, {
        email: e.target.value
      }),
      placeholder: "Email",
      inputMode: "email",
      style: {
        ...gInput,
        ...(fieldErr("email") ? errStyle : {})
      }
    }), msg("email")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
      value: s.dob,
      onChange: e => update(i, {
        dob: e.target.value
      }),
      type: "date",
      "aria-label": "Date of birth",
      style: {
        ...gInput,
        color: s.dob ? "var(--text-strong)" : "var(--text-faint)",
        ...(fieldErr("dob") ? errStyle : {})
      }
    }), fieldErr("dob") ? msg("dob") : /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "var(--text-faint)",
        marginTop: 4
      }
    }, "We just need to know everyone's 18+."))));
  }
  function ConsentBlock({
    consent,
    setConsent
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setConsent(!consent),
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 20,
        height: 20,
        marginTop: 1,
        borderRadius: 6,
        border: "1.5px solid " + (consent ? "var(--purple-600)" : "var(--border-mid)"),
        background: consent ? "var(--purple-600)" : "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, consent && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13,
      w: 3,
      color: "var(--cream)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, "I've got their OK to share these details. They'll get one invite from Click with a link to remove their details anytime.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 7,
        marginTop: 10,
        fontSize: 11.5,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "info",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }), "Their spot is part of your booking - refunds go to you, on the standard policy. They can hand the spot back anytime."));
  }
  /* the full guest section: seats stepper + per-seat optional naming + consent (when ≥1 named) */
  function GuestSection({
    seats,
    setSeats,
    consent,
    setConsent,
    max = 4
  }) {
    const n = seats.length;
    const setCount = next => {
      next = Math.max(0, Math.min(max, next));
      setSeats(prev => {
        const arr = prev.slice(0, next);
        while (arr.length < next) arr.push({
          open: false,
          name: "",
          email: "",
          dob: ""
        });
        return arr;
      });
    };
    const update = (i, patch) => setSeats(prev => prev.map((s, idx) => idx === i ? {
      ...s,
      ...patch
    } : s));
    const anyNamed = seats.some(s => s.open);
    const Step = ({
      dir,
      disabled
    }) => /*#__PURE__*/React.createElement("button", {
      onClick: () => !disabled && setCount(n + dir),
      disabled: disabled,
      "aria-label": dir > 0 ? "Add a guest" : "Remove a guest",
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "1.5px solid var(--border-mid)",
        background: "var(--white)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: dir > 0 ? "plus" : "x",
      size: dir > 0 ? 15 : 13,
      w: 2.4,
      color: "var(--purple-700)"
    }));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 11
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "13px 0 2px",
        borderTop: "1px solid var(--mist)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Bringing anyone?"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        marginTop: 1
      }
    }, "Add up to ", max, " - each is a seat")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Step, {
      dir: -1,
      disabled: n <= 0
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 18,
        textAlign: "center",
        fontSize: 16,
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, n), /*#__PURE__*/React.createElement(Step, {
      dir: 1,
      disabled: n >= max
    }))), n > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.5,
        padding: "0 2px"
      }
    }, "Adding their details saves them a spot and sends one invite from Click - so they're on the list and you're sorted."), seats.map((s, i) => /*#__PURE__*/React.createElement(SeatRow, {
      key: i,
      i: i,
      s: s,
      err: seatError(s, seats),
      update: update
    })), anyNamed && /*#__PURE__*/React.createElement(ConsentBlock, {
      consent: consent,
      setConsent: setConsent
    }));
  }

  /* per-event aggregate social-proof (life-tag powered, AGGREGATE only - never WHO). */
  const FOMO = {
    ev1: {
      life: "A couple of locals new to the area are going",
      belong: null,
      romantic: "Some singles are going"
    },
    ev2: {
      life: "Lots of plant people going - mostly in their 30s",
      belong: null,
      romantic: null
    },
    ev3: {
      life: "3 people you might click with are going",
      belong: "You're not the only one - others new to the area are going too.",
      romantic: "Some singles are going"
    },
    ev4: {
      life: "A big, easy crowd - all paces, all ages",
      belong: null,
      romantic: null
    },
    ev6: {
      life: "3 people over 30 are going",
      belong: null,
      romantic: "A few singles are going"
    }
  };

  /* neutral interest pill - white fill, mist hairline, ink (Buttons_Tags) */
  /* neutral interest pill - true-white fill, Mist-strong hairline, ink (Buttons_Tags) */
  function Pill({
    children,
    muted
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 12px",
        fontSize: 13,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        background: "var(--white)",
        color: muted ? "var(--text-muted)" : "var(--ink)",
        border: "1px solid var(--mist-strong)"
      }
    }, children);
  }
  function CircleBtn({
    icon,
    label,
    onClick,
    active
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      "aria-label": label,
      title: label,
      style: {
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(253,250,246,.93)",
        boxShadow: "var(--shadow-sm)",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 18,
      w: 2,
      color: active ? "var(--purple-600)" : "var(--purple-700)",
      style: {
        fill: active && icon === "bookmark" ? "var(--purple-600)" : "none"
      }
    }));
  }
  function ShareIco() {
    return /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--purple-700)",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "5",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "19",
      r: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"
    }));
  }

  /* ---- capacity bar (honest; reads count/cap = event_capacity_v) ---- */
  function CapacityBar({
    e
  }) {
    const left = Math.max(0, e.cap - e.count);
    const pct = Math.min(100, Math.round(e.count / e.cap * 100));
    const tight = left / e.cap < 0.15;
    const fill = tight ? "var(--coral)" : "var(--purple-600)";
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, e.count, " of ", e.cap, " spots taken"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: tight ? "var(--coral)" : "var(--text-muted)"
      }
    }, left, " left")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 7,
        borderRadius: 99,
        background: "var(--mist)",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: pct + "%",
        background: fill,
        borderRadius: 99
      }
    })));
  }

  /* ONE status tag (almost-full coral · trending amber · new teal · free sage) */
  function statusFor(e) {
    const left = e.cap - e.count,
      tight = left > 0 && left / e.cap < 0.15;
    if (e.price === "Free") return {
      label: "Free",
      bg: "var(--sage)"
    };
    if (e.status === "soldout" || e.full || left <= 0) return {
      label: "Full",
      bg: "var(--slate)"
    };
    if (e.status === "almostfull" || tight) return {
      label: "Almost full",
      bg: "var(--coral)"
    };
    if (e.status === "trending") return {
      label: "Trending",
      bg: "var(--amber)"
    };
    if (e.status === "new") return {
      label: "New",
      bg: "var(--teal)"
    };
    return null;
  }
  function StatusTag({
    e,
    style = {}
  }) {
    const s = statusFor(e);
    if (!s) return null;
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 11px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        background: s.bg,
        color: "#fff",
        ...style
      }
    }, s.label);
  }
  /* FULL (waitlist) tag - Slate, never "Almost full" */
  function FullBadge({
    style = {}
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 11px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        background: "var(--slate)",
        color: "#fff",
        ...style
      }
    }, "Full");
  }

  /* ---- a believable static street map (capture-safe; not a grey placeholder) ---- */
  function VenueMap({
    label
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        height: 168,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border-soft)"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "100%",
      height: "100%",
      viewBox: "0 0 400 168",
      preserveAspectRatio: "xMidYMid slice",
      style: {
        display: "block"
      },
      "aria-label": "Map of the venue location"
    }, /*#__PURE__*/React.createElement("rect", {
      width: "400",
      height: "168",
      fill: "#EDE7DA"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "20",
      y: "98",
      width: "92",
      height: "74",
      rx: "6",
      fill: "#CFE0C2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M300 -10 L360 0 L344 60 L388 110 L360 178 L300 178 Z",
      fill: "#Bcd4e6",
      opacity: "0.8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M300 -10 L360 0 L344 60 L388 110 L360 178 L300 178 Z",
      fill: "#B9D2E6"
    }), [[130, 24], [196, 24], [130, 70], [196, 70], [40, 24], [262, 96], [196, 116]].map(([x, y], i) => /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: x,
      y: y,
      width: "46",
      height: "30",
      rx: "3",
      fill: "#F6F2E8"
    })), /*#__PURE__*/React.createElement("g", {
      stroke: "#FBF8F0",
      strokeWidth: "11",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("line", {
      x1: "-10",
      y1: "62",
      x2: "410",
      y2: "50"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-10",
      y1: "110",
      x2: "300",
      y2: "118"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "110",
      y1: "-10",
      x2: "124",
      y2: "178"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "250",
      y1: "-10",
      x2: "262",
      y2: "178"
    })), /*#__PURE__*/React.createElement("g", {
      stroke: "#E4DBC9",
      strokeWidth: "1.4"
    }, /*#__PURE__*/React.createElement("line", {
      x1: "-10",
      y1: "62",
      x2: "410",
      y2: "50"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-10",
      y1: "110",
      x2: "300",
      y2: "118"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "110",
      y1: "-10",
      x2: "124",
      y2: "178"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "250",
      y1: "-10",
      x2: "262",
      y2: "178"
    })), /*#__PURE__*/React.createElement("g", {
      stroke: "#FBF8F0",
      strokeWidth: "5",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("line", {
      x1: "180",
      y1: "-10",
      x2: "188",
      y2: "178"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-10",
      y1: "148",
      x2: "300",
      y2: "156"
    })), /*#__PURE__*/React.createElement("text", {
      x: "30",
      y: "46",
      fontFamily: "var(--font-sans)",
      fontSize: "8",
      fill: "#A99F88",
      fontWeight: "600"
    }, "King St"), /*#__PURE__*/React.createElement("text", {
      x: "132",
      y: "142",
      fontFamily: "var(--font-sans)",
      fontSize: "8",
      fill: "#A99F88",
      fontWeight: "600"
    }, "Probert St")), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: "47%",
        top: "50%",
        transform: "translate(-50%,-100%)",
        filter: "drop-shadow(0 4px 5px rgba(25,19,58,.3))"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "30",
      height: "38",
      viewBox: "0 0 30 38",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M15 1C7.8 1 2 6.7 2 13.8 2 23 15 37 15 37s13-14 13-23.2C28 6.7 22.2 1 15 1Z",
      fill: "var(--purple-600)"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "15",
      cy: "14",
      r: "5",
      fill: "#fff"
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 12,
        bottom: 12,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: "var(--radius-pill)",
        background: "rgba(253,250,246,.95)",
        boxShadow: "var(--shadow-sm)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 13,
      w: 2,
      color: "var(--purple-600)"
    }), label));
  }

  /* ===== the booking content, by state - used in the right rail (desktop) / in-flow (tablet) ===== */
  function BookingBody({
    e,
    mode,
    book,
    saved,
    toggleSave,
    barCTA,
    onRSVP
  }) {
    const kind = e.price === "Free" ? "free" : "paid";
    const [step, setStep] = useState("idle"); // idle | rsvp (waitlist join only)
    const [reminded, setReminded] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [calOpen, setCalOpen] = useState(false);
    const addr = [e.venue || "The venue", "12 Probert St", e.suburb, "NSW 2042"].filter(Boolean).join(", ");
    const Price = () => /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 9,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: kind === "free" ? "var(--success)" : "var(--text-strong)"
      }
    }, e.price), kind !== "free" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, "per person"));
    const QuietRow = () => /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: toggleSave,
      style: {
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        height: 42,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-mid)",
        background: "var(--white)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        fontWeight: 600,
        color: saved ? "var(--purple-700)" : "var(--text-body)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bookmark",
      size: 16,
      w: 2,
      color: saved ? "var(--purple-600)" : "var(--text-muted)",
      style: {
        fill: saved ? "var(--purple-600)" : "none"
      }
    }), saved ? "Saved" : "Save"), /*#__PURE__*/React.createElement("button", {
      style: {
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        height: 42,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-mid)",
        background: "var(--white)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-body)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "share",
      size: 16,
      w: 2,
      color: "var(--text-muted)"
    }), "Share"));

    /* ---------------- UNLOCKED (booked) ---------------- */
    if (mode === "unlocked") {
      const refund = "Full refund - $" + priceNum(e.price) + " back to your card"; // >48h demo (in 3 days)
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 14
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "color-mix(in srgb,var(--success) 16%,#fff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        size: 17,
        w: 2.8,
        color: "var(--success)"
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: "var(--font-display)",
          fontSize: 19,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, "You're going")), /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 14
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          lineHeight: 1.4,
          marginBottom: 10
        }
      }, e.venue || "The venue", /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontWeight: 500,
          color: "var(--text-muted)",
          fontSize: 13.5,
          marginTop: 2
        }
      }, ["12 Probert St", e.suburb, "NSW 2042"].filter(Boolean).join(", "))), /*#__PURE__*/React.createElement(VenueMap, {
        label: e.venue || e.suburb
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 16,
          marginTop: 11
        }
      }, /*#__PURE__*/React.createElement("a", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--purple-600)",
          cursor: "pointer"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "pin",
        size: 15,
        w: 2,
        color: "var(--purple-600)"
      }), "Open in Maps"), /*#__PURE__*/React.createElement("a", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--purple-600)",
          cursor: "pointer"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "compass",
        size: 15,
        w: 2,
        color: "var(--purple-600)"
      }), "Directions"))), /*#__PURE__*/React.createElement("div", {
        style: {
          borderTop: "1px solid var(--border-soft)",
          paddingTop: 14,
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => setCalOpen(v => !v),
        style: {
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          height: 42,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-mid)",
          background: "var(--white)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-body)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "calendar",
        size: 16,
        w: 2,
        color: "var(--purple-600)"
      }), "Add to calendar", /*#__PURE__*/React.createElement(Icon, {
        name: "chevD",
        size: 15,
        w: 2,
        color: "var(--text-muted)",
        style: {
          transform: calOpen ? "rotate(180deg)" : "none",
          transition: "transform .15s"
        }
      })), calOpen && /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 8,
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)"
        }
      }, ["Google Calendar", "Apple Calendar", "Outlook", "Download .ics"].map((c, i) => /*#__PURE__*/React.createElement("button", {
        key: c,
        style: {
          width: "100%",
          textAlign: "left",
          padding: "10px 14px",
          border: "none",
          borderTop: i ? "1px solid var(--border-soft)" : "none",
          background: "var(--white)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 500,
          color: "var(--text-body)"
        }
      }, c)))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 8,
          marginBottom: 14
        }
      }, /*#__PURE__*/React.createElement("button", {
        style: {
          flex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          height: 42,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-mid)",
          background: "var(--white)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-body)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "users",
        size: 16,
        w: 2,
        color: "var(--text-muted)"
      }), "Manage +1s"), /*#__PURE__*/React.createElement("button", {
        style: {
          flex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          height: 42,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-mid)",
          background: "var(--white)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-body)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "share",
        size: 16,
        w: 2,
        color: "var(--text-muted)"
      }), "Share")), !cancelOpen ? /*#__PURE__*/React.createElement("button", {
        onClick: () => setCancelOpen(true),
        style: {
          border: "none",
          background: "none",
          padding: "2px 0",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-muted)",
          textDecoration: "underline",
          textUnderlineOffset: 3
        }
      }, "Cancel RSVP") : /*#__PURE__*/React.createElement("div", {
        style: {
          background: "var(--surface-tint)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius-md)",
          padding: "13px 14px"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          marginBottom: 4
        }
      }, "Cancel this RSVP?"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          color: "var(--text-body)",
          lineHeight: 1.5,
          marginBottom: 11
        }
      }, kind === "free" ? "No charge - your spot frees up for someone on the waitlist." : refund + ". You're more than 48 hours out, so it's the full amount."), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 8
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => setCancelOpen(false),
        style: {
          flex: 1,
          height: 40,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-mid)",
          background: "var(--white)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-body)"
        }
      }, "Keep my spot"), /*#__PURE__*/React.createElement("button", {
        onClick: () => setCancelOpen(false),
        style: {
          flex: 1,
          height: 40,
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb,#B5362F 45%,transparent)",
          background: "var(--white)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "#B5362F"
        }
      }, "Cancel RSVP"))));
    }

    /* ---------------- WAITLIST (full) ---------------- */
    if (mode === "waitlist") {
      if (step === "rsvp") return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Price, null), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 14
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "color-mix(in srgb,var(--amber) 20%,#fff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "clock",
        size: 17,
        w: 2.2,
        color: "#a86f12"
      })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 15.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          marginBottom: 3
        }
      }, "You're 3rd in line"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.5
        }
      }, "We'll let you know the moment a spot opens. Nothing to pay until you're in."))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          padding: "11px 13px",
          background: "var(--lavender-100)",
          borderRadius: "var(--radius-md)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "info",
        size: 16,
        w: 2,
        color: "var(--purple-600)",
        style: {
          marginTop: 1,
          flex: "none"
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          color: "var(--purple-800)",
          lineHeight: 1.5
        }
      }, "If a spot opens, you'll get ", /*#__PURE__*/React.createElement("b", {
        style: {
          fontWeight: 700
        }
      }, "30 minutes"), " to grab it before it passes on.")), /*#__PURE__*/React.createElement(QuietRow, null));
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Price, null), /*#__PURE__*/React.createElement(CapacityBar, {
        e: {
          ...e,
          count: e.cap
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "13px 0"
        }
      }, /*#__PURE__*/React.createElement(FullBadge, null), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          fontWeight: 500
        }
      }, "This one's full right now.")), !barCTA && /*#__PURE__*/React.createElement(Btn, {
        full: true,
        size: "lg",
        onClick: () => setStep("rsvp")
      }, "Join waitlist"), /*#__PURE__*/React.createElement(QuietRow, null));
    }

    /* ---------------- LOCKED (available) ---------------- */
    const loc = /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "11px 13px",
        background: "var(--lavender-wash)",
        borderRadius: "var(--radius-lg)",
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 16,
      w: 2,
      color: "var(--text-muted)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, e.suburb, " \xB7 ", e.dist), " - venue revealed when you RSVP."));
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Price, null), loc, /*#__PURE__*/React.createElement(CapacityBar, {
      e: e
    }), statusFor(e) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(StatusTag, {
      e: e
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        margin: "13px 0 15px",
        fontSize: 13,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "clock",
      size: 15,
      w: 2,
      color: "var(--purple-500)"
    }), e.when), !barCTA && /*#__PURE__*/React.createElement(Btn, {
      full: true,
      size: "lg",
      onClick: onRSVP
    }, "RSVP"), /*#__PURE__*/React.createElement(QuietRow, null), /*#__PURE__*/React.createElement("button", {
      onClick: () => setReminded(true),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        width: "100%",
        marginTop: 8,
        height: 38,
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 600,
        color: reminded ? "var(--success)" : "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: reminded ? "check" : "bell",
      size: 15,
      w: 2,
      color: reminded ? "var(--success)" : "var(--text-muted)"
    }), reminded ? "We'll remind you" : "Remind me"));
  }

  /* a bordered card wrapper for the panel (desktop rail / tablet in-flow) */
  function Panel({
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "20px 20px 22px"
      }
    }, children);
  }

  /* ===== RSVP MODAL — the single booking surface, opened from the panel/bottom-bar RSVP button =====
     Value block + guest details + refund line + ONE action. Free = confirm in-modal → "View event" → unlocked page.
     Paid = "Continue to payment · $X" → hosted-redirect mock (brief handoff) → unlocked page. (canon 05_BOOKING_LIFECYCLE) */
  function RSVPModal({
    e,
    web,
    onClose,
    onDone
  }) {
    const kind = e.price === "Free" ? "free" : "paid";
    const [gseats, setGseats] = useState([]);
    const [consent, setConsent] = useState(false);
    const [phase, setPhase] = useState("form"); // form | paying | success
    const seats = 1 + gseats.length;
    const total = priceNum(e.price) * seats;
    const ready = guestsReady(gseats, consent);
    useEffect(() => {
      const onKey = ev => {
        if (ev.key === "Escape" && phase !== "paying") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [phase, onClose]);
    const confirmFree = () => {
      if (ready) setPhase("success");
    };
    const goPay = () => {
      if (!ready) return;
      setPhase("paying");
      setTimeout(() => onDone && onDone(), 1400);
    };
    const scrim = {
      position: "fixed",
      inset: 0,
      zIndex: 70,
      background: "rgba(28,24,48,.5)",
      display: "flex",
      alignItems: web ? "center" : "flex-end",
      justifyContent: "center",
      padding: web ? 24 : 0
    };
    const card = {
      width: web ? 480 : "100%",
      maxWidth: "100%",
      maxHeight: web ? "88vh" : "92vh",
      display: "flex",
      flexDirection: "column",
      background: "var(--white)",
      borderRadius: web ? 20 : "20px 20px 0 0",
      boxShadow: "0 12px 32px rgba(28,24,48,.14), 0 2px 6px rgba(28,24,48,.08)",
      overflow: "hidden"
    };

    /* success (free path) */
    if (phase === "success") {
      return /*#__PURE__*/React.createElement("div", {
        style: scrim,
        onClick: onClose
      }, /*#__PURE__*/React.createElement("div", {
        style: card,
        onClick: ev => ev.stopPropagation()
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: web ? "40px 28px 28px" : "32px 22px 26px",
          textAlign: "center",
          overflowY: "auto"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 56,
          height: 56,
          margin: "0 auto 16px",
          borderRadius: "50%",
          background: "color-mix(in srgb,var(--success) 16%,#fff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        size: 30,
        w: 2.8,
        color: "var(--success)"
      })), /*#__PURE__*/React.createElement("h2", {
        style: {
          margin: "0 0 8px",
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, "You're going"), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 6px",
          fontSize: 14.5,
          color: "var(--text-body)",
          lineHeight: 1.55
        }
      }, "The venue's unlocked - it's all on the event page now."), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 22px",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, e.venue || "The venue", " \xB7 ", e.suburb), /*#__PURE__*/React.createElement(Btn, {
        full: true,
        size: "lg",
        onClick: onDone
      }, "View event"))));
    }
    const header = /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: web ? "20px 22px 14px" : "16px 18px 12px",
        borderBottom: "1px solid var(--border-soft)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.25,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        marginTop: 2
      }
    }, e.when, " \xB7 ", e.suburb)), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      "aria-label": "Close",
      style: {
        flex: "none",
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "none",
        background: "var(--surface-tint)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 16,
      w: 2.2,
      color: "var(--text-muted)"
    })));
    const priceTop = /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 9,
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: kind === "free" ? "var(--success)" : "var(--text-strong)"
      }
    }, e.price), kind !== "free" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, "per person"));
    return /*#__PURE__*/React.createElement("div", {
      style: scrim,
      onClick: () => phase !== "paying" && onClose()
    }, /*#__PURE__*/React.createElement("div", {
      style: card,
      onClick: ev => ev.stopPropagation()
    }, header, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: "auto",
        padding: web ? "18px 22px" : "16px 18px"
      }
    }, priceTop, /*#__PURE__*/React.createElement(ValueBlock, null), /*#__PURE__*/React.createElement(GuestSection, {
      seats: gseats,
      setSeats: setGseats,
      consent: consent,
      setConsent: setConsent
    }), kind !== "free" && total !== priceNum(e.price) && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement("span", null, seats, " \xD7 ", e.price), /*#__PURE__*/React.createElement("span", null, "$", total))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        padding: web ? "14px 22px 18px" : "12px 18px calc(14px + env(safe-area-inset-bottom))",
        borderTop: "1px solid var(--border-soft)",
        background: "var(--white)"
      }
    }, kind !== "free" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 11.5,
        color: "var(--text-muted)",
        lineHeight: 1.5,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "info",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }), "Full refund up to 48h before - 50% within 48h - none within 24h."), kind === "free" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 11.5,
        color: "var(--text-muted)",
        lineHeight: 1.5,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "info",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }), "Free to cancel any time - your spot frees up for someone else."), phase === "paying" ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 50
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 17,
        height: 17,
        borderRadius: "50%",
        border: "2.5px solid var(--lavender-300)",
        borderTopColor: "var(--purple-600)",
        display: "inline-block",
        animation: "ckSpin .7s linear infinite"
      }
    }), /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: "@keyframes ckSpin{to{transform:rotate(360deg)}}"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-body)"
      }
    }, "Taking you to secure checkout\u2026")) : kind === "free" ? /*#__PURE__*/React.createElement(Btn, {
      full: true,
      size: "lg",
      disabled: !ready,
      onClick: confirmFree
    }, "RSVP") : /*#__PURE__*/React.createElement(Btn, {
      full: true,
      size: "lg",
      disabled: !ready,
      onClick: goPay
    }, "Continue to payment \xB7 $", total), kind !== "free" && phase !== "paying" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        marginTop: 11,
        fontSize: 11.5,
        color: "var(--text-faint)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 12,
      w: 2,
      color: "var(--text-faint)"
    }), "Secure checkout \xB7 powered by Stripe"))));
  }

  /* ===== who's going - LOCKED aggregate / UNLOCKED named attendee grid ===== */
  function WhosGoing({
    e,
    web,
    mode,
    datingViewer,
    onView
  }) {
    const f = FOMO[e.id] || {};
    if (mode === "unlocked") {
      const att = e.attendees || [];
      return /*#__PURE__*/React.createElement("section", {
        style: {
          marginBottom: 24
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 13
        }
      }, /*#__PURE__*/React.createElement("h3", {
        style: {
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, "Who's going"), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          fontWeight: 500
        }
      }, e.count, " going")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10
        }
      }, att.map(p => {
        const mutual = MUTUAL_NAMES.has(p.name);
        /* the ONE canonical CK.PeopleCard - here in its no-action variant: NO "click with"
           (clicking is post-event only), the WHOLE CARD opens the profile modal, interests
           only (no intent line on the public attendee list). Same avatar/name/tags anatomy. */
        return /*#__PURE__*/React.createElement(PeopleCard, {
          key: p.name,
          p: p,
          web: web,
          layout: "grid",
          action: "none",
          interestsOnly: true,
          mutual: mutual,
          onOpen: () => onView && onView(p)
        });
      })));
    }
    /* LOCKED - aggregate only, ≥3 floor; COMPACT: cluster+count on one line, lead with the click line, ≤2 lines */
    const second = datingViewer && f.romantic ? f.romantic : f.belong || f.life;
    const lines = [{
      text: "A few people you might click with are going"
    }];
    if (second) lines.push({
      text: second
    });
    return /*#__PURE__*/React.createElement("section", {
      style: {
        background: "var(--lavender-wash)",
        border: "1px solid var(--lavender-300)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
        marginBottom: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: 16,
        fontWeight: 600,
        color: "var(--purple-800)"
      }
    }, "Who's going"), /*#__PURE__*/React.createElement(Stack, {
      people: e.going,
      size: 28,
      label: `${e.count} going`
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, lines.map((l, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-800)",
        lineHeight: 1.35
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "users",
      size: 15,
      w: 2,
      color: "var(--purple-500)"
    }), l.text))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "11px 0 0",
        fontSize: 12.5,
        lineHeight: 1.5,
        color: "var(--purple-800)",
        opacity: .82
      }
    }, "Same room, same reason - that's where you click."));
  }

  /* ===== photo nudge (only when viewer has no photo; dismissible) ===== */
  function PhotoNudge({
    onClose
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 6,
        background: "var(--lavender-wash)",
        border: "1px solid var(--lavender-300)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      "aria-label": "Dismiss",
      style: {
        position: "absolute",
        top: 8,
        right: 8,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: 4,
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 15,
      w: 2,
      color: "var(--purple-500)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "camera",
      size: 16,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("a", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--purple-800)",
        lineHeight: 1.35,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }
    }, "Add a photo so people recognise you ", /*#__PURE__*/React.createElement(Icon, {
      name: "arrowR",
      size: 15,
      w: 2,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--purple-800)",
        opacity: .82,
        lineHeight: 1.4
      }
    }, "A face helps people place you when you click after the event."));
  }

  /* ===== mobile slim sticky bar (price + one button) - opens the RSVP modal as a bottom sheet ===== */
  function MobileBar({
    e,
    mode,
    book,
    onRSVP
  }) {
    const kind = e.price === "Free" ? "free" : "paid";
    const [joined, setJoined] = useState(false);
    if (mode === "unlocked") return null;
    const bar = {
      position: "sticky",
      bottom: 0,
      left: 0,
      right: 0,
      background: "var(--cream)",
      borderTop: "1px solid var(--mist)",
      padding: "12px 18px calc(12px + env(safe-area-inset-bottom))",
      zIndex: 30
    };
    if (mode === "waitlist") {
      if (joined) return /*#__PURE__*/React.createElement("div", {
        style: bar
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 9
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "clock",
        size: 18,
        w: 2.2,
        color: "#a86f12"
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, "You're 3rd in line \xB7 30 min to claim a spot")));
      return /*#__PURE__*/React.createElement("div", {
        style: bar
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: "var(--font-display)",
          fontSize: 17,
          fontWeight: 600,
          color: "var(--text-strong)",
          flex: "none"
        }
      }, e.price), /*#__PURE__*/React.createElement(Btn, {
        full: true,
        onClick: () => setJoined(true)
      }, "Join waitlist")));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: bar
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 600,
        color: kind === "free" ? "var(--success)" : "var(--text-strong)",
        flex: "none"
      }
    }, e.price), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: onRSVP
    }, "RSVP")));
  }

  /* ===================== PAGE ===================== */
  function EventDetail({
    e,
    web,
    width,
    back,
    booked,
    book,
    saved,
    toggleSave,
    waitlist,
    planWith,
    datingViewer = true
  }) {
    const mode = booked ? "unlocked" : waitlist ? "waitlist" : "locked";
    const layout = !web ? "phone" : width >= 1024 ? "desktop" : "tablet";
    const [nudge, setNudge] = useState(true);
    const allTags = (e.tags || []).filter(t => t.toLowerCase() !== (CAT[e.category]?.label || "").toLowerCase());

    /* attendee tap → the SHARED profile modal (window.ScreensB.PersonProfileModal) - same
       component the click-with list opens. They're both at this event, so frame it as shared. */
    const [viewing, setViewing] = useState(null);
    const [clickedSet, setClickedSet] = useState(() => new Set());
    const [rsvpOpen, setRsvpOpen] = useState(false);
    const toProfile = p => {
      const rich = (D.CLICK_SUGGEST || []).find(s => s.name === p.name) || {};
      return {
        ...rich,
        ...p,
        sharedEvent: e.name,
        overlap: null,
        mutual: MUTUAL_NAMES.has(p.name),
        prompt: p.prompt || rich.prompt
      };
    };
    const PM = window.ScreensB && window.ScreensB.PersonProfileModal;
    const onDone = () => {
      setRsvpOpen(false);
      book && book();
    };
    const modal = /*#__PURE__*/React.createElement(React.Fragment, null, viewing && PM ? /*#__PURE__*/React.createElement(PM, {
      p: viewing,
      web: web,
      hideAction: true,
      clicked: clickedSet.has(viewing.name),
      onClick: () => setClickedSet(s => new Set(s).add(viewing.name)),
      onClose: () => setViewing(null)
    }) : null, rsvpOpen ? /*#__PURE__*/React.createElement(RSVPModal, {
      e: e,
      web: web,
      onClose: () => setRsvpOpen(false),
      onDone: onDone
    }) : null);

    /* plan banner - shown when arrived from a coordination proposal; this booking
       counts toward confirmed_together (coord_group_id carried in via planWith) */
    const PlanBanner = () => planWith ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        background: "var(--lavender-100)",
        border: "1px solid var(--lavender-300)",
        borderRadius: "var(--radius-lg)",
        padding: "13px 15px",
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "spark",
      size: 17,
      color: "var(--purple-600)"
    })), mode === "unlocked" ? /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        fontSize: 13.5,
        lineHeight: 1.4,
        color: "var(--purple-800)"
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 700
      }
    }, "You're going with ", firstName(planWith)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontWeight: 500,
        opacity: .82,
        marginTop: 1
      }
    }, "We'll let ", firstName(planWith), " know - you're both set.")) : /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        fontSize: 13.5,
        lineHeight: 1.4,
        color: "var(--purple-800)"
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 700
      }
    }, "RSVP to lock in your plan with ", firstName(planWith)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontWeight: 500,
        opacity: .82,
        marginTop: 1
      }
    }, "You're both set the moment you save your spot."))) : null;

    /* ---- hero (lives in the left/content column) ---- */
    const Hero = () => /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        borderRadius: layout === "phone" ? 0 : "var(--radius-xl)",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: e.category,
      h: layout === "phone" ? 220 : 300,
      radius: 0,
      photo: e.photo
    }), /*#__PURE__*/React.createElement("button", {
      onClick: back,
      "aria-label": "Back",
      style: {
        position: "absolute",
        top: 16,
        left: 16,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "rgba(253,250,246,.93)",
        border: "none",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevL",
      size: 20,
      w: 2.4,
      color: "var(--purple-700)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 16,
        right: 16,
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      "aria-label": "Share",
      style: {
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "rgba(253,250,246,.93)",
        border: "none",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(ShareIco, null)), /*#__PURE__*/React.createElement(CircleBtn, {
      icon: "bookmark",
      label: "Save",
      onClick: toggleSave,
      active: saved
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        bottom: 14,
        left: 16,
        display: "flex",
        gap: 8
      }
    }, mode === "unlocked" ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        background: "var(--sage)",
        color: "#fff"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13,
      w: 2.8
    }), "You're going") : mode === "waitlist" ? /*#__PURE__*/React.createElement(FullBadge, null) : /*#__PURE__*/React.createElement(StatusTag, {
      e: e
    })));

    /* ---- the title + tags + a single quiet context strip (facts live in the panel, not here) ---- */
    const TitleBlock = () => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 12px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1.25,
        color: "var(--text-strong)"
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        padding: "0 11px",
        fontSize: 12,
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        background: "var(--lavender-100)",
        color: "var(--purple-700)",
        whiteSpace: "nowrap"
      }
    }, CAT[e.category]?.label || "Event"), allTags.map(t => /*#__PURE__*/React.createElement(Tag, {
      key: t,
      dense: true
    }, t))));
    const About = ({
      pad
    }) => /*#__PURE__*/React.createElement("p", {
      style: {
        margin: pad || "20px 0 24px",
        fontSize: 15,
        lineHeight: 1.65,
        color: "var(--text-body)",
        textWrap: "pretty"
      }
    }, e.blurb);
    const Content = ({
      withTitle
    }) => /*#__PURE__*/React.createElement("div", null, withTitle && /*#__PURE__*/React.createElement(TitleBlock, null), /*#__PURE__*/React.createElement(WhosGoing, {
      e: e,
      web: web,
      mode: mode,
      datingViewer: datingViewer,
      onView: p => setViewing(toProfile(p))
    }), mode === "unlocked" && nudge && /*#__PURE__*/React.createElement(PhotoNudge, {
      onClose: () => setNudge(false)
    }));

    /* ---------- DESKTOP: two columns ---------- */
    if (layout === "desktop") {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: 1180,
          margin: "0 auto",
          padding: "8px 40px 56px"
        }
      }, modal, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 372px",
          gap: 36,
          alignItems: "start"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 24
        }
      }, /*#__PURE__*/React.createElement(Hero, null)), /*#__PURE__*/React.createElement(TitleBlock, null), /*#__PURE__*/React.createElement(About, null), /*#__PURE__*/React.createElement(WhosGoing, {
        e: e,
        web: web,
        mode: mode,
        datingViewer: datingViewer,
        onView: p => setViewing(toProfile(p))
      }), mode === "unlocked" && nudge && /*#__PURE__*/React.createElement(PhotoNudge, {
        onClose: () => setNudge(false)
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "sticky",
          top: 24
        }
      }, /*#__PURE__*/React.createElement(PlanBanner, null), /*#__PURE__*/React.createElement(Panel, null, /*#__PURE__*/React.createElement(BookingBody, {
        e: e,
        mode: mode,
        book: book,
        saved: saved,
        toggleSave: toggleSave,
        onRSVP: () => setRsvpOpen(true)
      })))));
    }

    /* ---------- TABLET: single column, panel in-flow after the title ---------- */
    if (layout === "tablet") {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: 720,
          margin: "0 auto",
          padding: "8px 32px 48px"
        }
      }, modal, /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 22
        }
      }, /*#__PURE__*/React.createElement(Hero, null)), /*#__PURE__*/React.createElement(TitleBlock, null), /*#__PURE__*/React.createElement("div", {
        style: {
          margin: "26px 0"
        }
      }, /*#__PURE__*/React.createElement(PlanBanner, null), /*#__PURE__*/React.createElement(Panel, null, /*#__PURE__*/React.createElement(BookingBody, {
        e: e,
        mode: mode,
        book: book,
        saved: saved,
        toggleSave: toggleSave,
        onRSVP: () => setRsvpOpen(true)
      }))), /*#__PURE__*/React.createElement(About, {
        pad: "0 0 24px"
      }), /*#__PURE__*/React.createElement(WhosGoing, {
        e: e,
        web: web,
        mode: mode,
        datingViewer: datingViewer,
        onView: p => setViewing(toProfile(p))
      }), mode === "unlocked" && nudge && /*#__PURE__*/React.createElement(PhotoNudge, {
        onClose: () => setNudge(false)
      }));
    }

    /* ---------- PHONE: single column + slim sticky bottom bar ---------- */
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100%"
      }
    }, modal, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "20px 22px 16px"
      }
    }, /*#__PURE__*/React.createElement(TitleBlock, null), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: "22px 0 24px"
      }
    }, /*#__PURE__*/React.createElement(PlanBanner, null), /*#__PURE__*/React.createElement(Panel, null, /*#__PURE__*/React.createElement(BookingBody, {
      e: e,
      mode: mode,
      book: book,
      saved: saved,
      toggleSave: toggleSave,
      barCTA: mode !== "unlocked",
      onRSVP: () => setRsvpOpen(true)
    }))), /*#__PURE__*/React.createElement(About, {
      pad: "0 0 24px"
    }), /*#__PURE__*/React.createElement(WhosGoing, {
      e: e,
      web: web,
      mode: mode,
      datingViewer: datingViewer,
      onView: p => setViewing(toProfile(p))
    }), mode === "unlocked" && nudge && /*#__PURE__*/React.createElement(PhotoNudge, {
      onClose: () => setNudge(false)
    }))), /*#__PURE__*/React.createElement(MobileBar, {
      e: e,
      mode: mode,
      book: book,
      onRSVP: () => setRsvpOpen(true)
    }));
  }
  window.ScreensED = {
    EventDetail
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/event-detail.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/howitworks.jsx
try { (() => {
(function () {
  /* Click - How it works (/how-it-works). Web v8 - the SLIM pass.
     Same philosophy spine ("Show up. Everything else is a bonus."; proximity effect;
     the click is a by-product, quiet until mutual; no chat; friends-first) - but
     straight to the point: 7 short sections, one idea each, no paragraph over ~3 lines.
     Adds a slim FOR HOSTS band so merchants get the concept too. Exactly ONE ✨.
     Hyphens, not em-dashes. Inline styles. */
  const {
    Icon,
    Logo,
    Btn,
    Cover
  } = window.CK;
  function Eyebrow({
    children
  }) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 12px",
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--purple-500)"
      }
    }, children);
  }
  function HowItWorks({
    web,
    enter,
    founding
  }) {
    const C = web ? "var(--container-max)" : "none";
    const H2 = {
      margin: "0 0 14px",
      fontFamily: "var(--font-display)",
      fontSize: "clamp(1.45rem, 1.1rem + 1.5cqi, 2.2rem)",
      fontWeight: 600,
      letterSpacing: "-.02em",
      lineHeight: 1.12,
      color: "var(--text-strong)",
      textWrap: "balance"
    };
    const BODY = {
      margin: 0,
      fontSize: web ? 17 : 15.5,
      lineHeight: 1.6,
      color: "var(--text-body)"
    };
    const STEPS = [["compass", "Pick something good", "Pottery in Newtown, a sunrise run, a wine-bar quiz. Real places, near you, this week."], ["calendar", "Show up", "You connect side by side, not face to face - and everyone in the room chose the same thing you did."], ["users", "That's it", "Great night, thing you love, maybe someone you click with. Show up, and everything else is a bonus."]];
    const INTENTS = ["Here for the activities", "Here for friends", "New in town", "Growing my circle", "Not here to date", "Open to dating"];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100%",
        background: "var(--cream)",
        fontFamily: "var(--font-sans)",
        color: "var(--text-strong)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: web ? "16px 40px" : "14px 22px",
        background: "color-mix(in srgb,var(--cream) 88%,transparent)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--border-soft)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: enter,
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: web ? 26 : 23
    })), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      onClick: enter
    }, "Request an invite")), /*#__PURE__*/React.createElement("section", {
      style: {
        maxWidth: C,
        margin: "0 auto",
        padding: web ? "clamp(40px,6cqi,76px) 40px 54px" : "36px 22px 42px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 720
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: web ? "clamp(32px,5cqi,56px)" : "30px",
        fontWeight: 600,
        letterSpacing: "-.025em",
        lineHeight: 1.06,
        color: "var(--text-strong)",
        textWrap: "balance",
        maxWidth: 660
      }
    }, "The best people you'll meet this year aren't on an app. They're across the room."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "18px 0 0",
        fontSize: web ? 19 : 16.5,
        lineHeight: 1.55,
        color: "var(--text-body)",
        maxWidth: 540
      }
    }, "Click gets you out doing things you love, in real life. The people you'll click with are already there."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      size: "lg",
      onClick: enter
    }, "Request an invite")))), /*#__PURE__*/React.createElement("section", {
      style: {
        background: "var(--surface-section)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: C,
        margin: "0 auto",
        padding: web ? "64px 40px" : "44px 22px"
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, null, "How it works"), /*#__PURE__*/React.createElement("h2", {
      style: H2
    }, "You don't click with a profile. You click in person."), /*#__PURE__*/React.createElement("p", {
      style: {
        ...BODY,
        maxWidth: 620
      }
    }, "Your closest people probably started as the person who kept showing up to the same thing you did. Psychologists call it the proximity effect. Click just rebuilds the rooms where it happens."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr",
        gap: web ? 36 : 28,
        marginTop: 36
      }
    }, STEPS.map(([ic, t, d], i) => /*#__PURE__*/React.createElement("div", {
      key: t
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 13,
        marginBottom: 13
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--lavender-300) 22%,var(--cream))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ic,
      size: 22,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 27,
        fontWeight: 600,
        color: "color-mix(in srgb,var(--purple-400) 60%,var(--cream))"
      }
    }, i + 1)), /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: "0 0 8px",
        fontFamily: "var(--font-display)",
        fontSize: 19,
        fontWeight: 600,
        letterSpacing: "-.01em",
        lineHeight: 1.2,
        color: "var(--text-strong)"
      }
    }, t), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 15,
        lineHeight: 1.58,
        color: "var(--text-body)"
      }
    }, d)))))), /*#__PURE__*/React.createElement("section", {
      style: {
        maxWidth: C,
        margin: "0 auto",
        padding: web ? "72px 40px" : "48px 22px",
        display: web ? "grid" : "block",
        gridTemplateColumns: web ? "1fr 1fr" : "none",
        gap: web ? 60 : 0,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "The bonus"), /*#__PURE__*/React.createElement("h2", {
      style: {
        ...H2,
        fontSize: web ? "clamp(28px,4cqi,46px)" : "1.85rem",
        letterSpacing: "-.025em",
        lineHeight: 1.08
      }
    }, "And every so often, you just click with someone."), /*#__PURE__*/React.createElement("p", {
      style: {
        ...BODY,
        marginBottom: 14
      }
    }, "Same event, same odd sense of humour, same reason for being there. Let Click know, quietly - if it's mutual, we suggest the next thing to do together."), /*#__PURE__*/React.createElement("p", {
      style: BODY
    }, "A new friend, a regular crew, sometimes something more. It all works the same.")), web && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: "run",
      aspect: "16/9",
      photo: "runners at dawn setting off, warm light",
      radius: 18
    }), [["Did you click with anyone?", "A quiet question after the event.", "lavender"], ["It's mutual ✨", "The good part: you both clicked.", "white"]].map(([t, d, bg], i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: bg === "lavender" ? "var(--lavender-100)" : "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        padding: "20px 22px",
        boxShadow: "var(--shadow-sm)"
      }
    }, /*#__PURE__*/React.createElement("h4", {
      style: {
        margin: "0 0 6px",
        fontFamily: "var(--font-display)",
        fontSize: 16.5,
        fontWeight: 600,
        color: "var(--purple-800)"
      }
    }, t), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--text-body)"
      }
    }, d))))), /*#__PURE__*/React.createElement("section", {
      style: {
        background: "var(--surface-section)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: C,
        margin: "0 auto",
        padding: web ? "64px 40px" : "44px 22px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 640
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, null, "On purpose"), /*#__PURE__*/React.createElement("h2", {
      style: H2
    }, "No swiping. No endless chat. Just real life."), /*#__PURE__*/React.createElement("p", {
      style: BODY
    }, "When two people click, Click suggests something to do next - the plan ", /*#__PURE__*/React.createElement("i", null, "is"), " the conversation. The magic was never in the app; it's in the room. We set the conditions, then get out of the way.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr",
        gap: web ? 28 : 18,
        marginTop: 32
      }
    }, [["check", "Only verified venues", "Every event is a real place run by real people."], ["user", "You're in control", "What you do, who you click with, whether you're visible at all."], ["compass", "Clicks are rare on purpose", "No feed of faces to scroll. That's what makes one feel real."]].map(([ic, t, d]) => /*#__PURE__*/React.createElement("div", {
      key: t,
      style: {
        display: "flex",
        gap: 13,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--lavender-300) 22%,var(--cream))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ic,
      size: 19,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: "0 0 4px",
        fontFamily: "var(--font-display)",
        fontSize: 16.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, t), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        lineHeight: 1.55,
        color: "var(--text-body)"
      }
    }, d))))))), /*#__PURE__*/React.createElement("section", {
      style: {
        maxWidth: C,
        margin: "0 auto",
        padding: web ? "64px 40px" : "44px 22px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 640
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, null, "Whatever you're here for"), /*#__PURE__*/React.createElement("h2", {
      style: H2
    }, "Come as you are."), /*#__PURE__*/React.createElement("p", {
      style: {
        ...BODY,
        color: "var(--text-muted)",
        marginBottom: 22
      }
    }, "Friendship, community, romance - equal footing. Pick what fits, or don't, and just show up.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        maxWidth: 720
      }
    }, INTENTS.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      style: {
        display: "inline-flex",
        alignItems: "center",
        padding: "9px 16px",
        borderRadius: "var(--radius-pill)",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        fontFamily: "var(--font-display)",
        fontSize: web ? 14.5 : 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, t)))), /*#__PURE__*/React.createElement("section", {
      style: {
        background: "var(--surface-section)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: C,
        margin: "0 auto",
        padding: web ? "60px 40px" : "42px 22px",
        display: web ? "grid" : "block",
        gridTemplateColumns: web ? "1.1fr .9fr" : "none",
        gap: web ? 56 : 0,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "For hosts"), /*#__PURE__*/React.createElement("h2", {
      style: H2
    }, "You bring the room. We fill it."), /*#__PURE__*/React.createElement("p", {
      style: {
        ...BODY,
        marginBottom: 12
      }
    }, "Run a studio, a bar, a run club? List your events on Click and meet a crowd that actually shows up - people who picked your thing on purpose."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: web ? 15 : 14,
        lineHeight: 1.6,
        color: "var(--text-muted)"
      }
    }, "Free events cost nothing to host. Paid events run through Stripe with a flat 5% fee, paid out monthly. Bookings, waitlists and door lists are handled for you."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 20
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "secondary",
      onClick: founding || enter
    }, "Host on Click"))), web && /*#__PURE__*/React.createElement(Cover, {
      category: "workshops",
      aspect: "4/3",
      photo: "a pottery studio owner setting up before class",
      radius: 18,
      tone: "bright"
    }))), /*#__PURE__*/React.createElement("section", {
      style: {
        maxWidth: C,
        margin: "0 auto",
        padding: web ? "72px 40px 84px" : "50px 22px 60px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        ...H2,
        fontSize: "clamp(1.55rem, 1.2rem + 1.6cqi, 2.4rem)",
        letterSpacing: "-.025em",
        lineHeight: 1.1,
        marginBottom: 12
      }
    }, "Something good is happening in Sydney this week."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 auto 26px",
        fontSize: web ? 17 : 15.5,
        lineHeight: 1.6,
        color: "var(--text-body)",
        maxWidth: 520
      }
    }, "Find it. Show up. Everything else is a bonus."), /*#__PURE__*/React.createElement(Btn, {
      size: "lg",
      onClick: enter
    }, "Request an invite"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "18px auto 0",
        fontSize: 13.5,
        lineHeight: 1.55,
        color: "var(--text-muted)",
        maxWidth: 460
      }
    }, "Somewhere else? Request an invite anyway - we'll tell you the moment Click reaches you.")));
  }
  window.ScreensHIW = {
    HowItWorks
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/howitworks.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/kit.jsx
try { (() => {
(function () {
  /* Click - App Screens mockup. Shared primitives, built on design-system tokens.
     Inline styles only; everything shared is exported on window.CK so the babel
     modules (which each get their own scope) can destructure it. */

  const {
    useState,
    useEffect,
    useRef
  } = React;

  /* ---------------- category + status maps ---------------- */
  /* Canonical activity taxonomy (single source of truth - see docs/Click_Design_Prompt_CategoryIcons.md).
     Categories carry NO colour (all Deep-Purple); meaning comes from the glyph + label only. */
  const CAT = {
    ceramics: {
      hue: "var(--purple-600)",
      label: "Pottery & ceramics"
    },
    run: {
      hue: "var(--purple-600)",
      label: "Run clubs & fitness"
    },
    wine: {
      hue: "var(--purple-600)",
      label: "Wine & bars"
    },
    cooking: {
      hue: "var(--purple-600)",
      label: "Cooking"
    },
    music: {
      hue: "var(--purple-600)",
      label: "Live music"
    },
    art: {
      hue: "var(--purple-600)",
      label: "Art & craft"
    },
    wellness: {
      hue: "var(--purple-600)",
      label: "Wellness"
    },
    trivia: {
      hue: "var(--purple-600)",
      label: "Trivia & games"
    },
    outdoors: {
      hue: "var(--purple-600)",
      label: "Outdoors"
    },
    markets: {
      hue: "var(--purple-600)",
      label: "Markets"
    },
    coffee: {
      hue: "var(--purple-600)",
      label: "Coffee"
    },
    workshops: {
      hue: "var(--purple-600)",
      label: "Workshops"
    }
  };
  /* Discovery status → colour map (design-system tokens; status colours are
     badge/large-text only - selection is ALWAYS deep purple). */
  const STATUS = {
    almostfull: {
      label: "Almost full",
      hue: "var(--coral)",
      text: "#fff"
    },
    spots: {
      label: "2 spots left",
      hue: "var(--coral)",
      text: "#fff"
    },
    trending: {
      label: "Trending",
      hue: "var(--amber)",
      text: "#fff"
    },
    waitlist: {
      label: "Waitlist",
      hue: "var(--amber)",
      text: "#fff"
    },
    free: {
      label: "Free",
      hue: "var(--sage)",
      text: "#fff"
    },
    new: {
      label: "New",
      hue: "var(--teal)",
      text: "#fff"
    },
    full: {
      label: "Full",
      hue: "var(--ink-muted)",
      text: "#fff"
    },
    going: {
      label: "You're going",
      hue: "var(--sage)",
      text: "#fff"
    },
    soldout: {
      label: "Fully booked",
      hue: "var(--ink-muted)",
      text: "#fff"
    }
  };
  const PALETTES = ["var(--purple-600)", "var(--purple-500)", "var(--lavender-500)", "var(--purple-700)", "var(--purple-400)"];
  const initials = (n = "") => {
    const p = n.trim().split(/\s+/);
    return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
  };

  /* ---------------- icons (lucide-style, even stroke, currentColor) ---------------- */
  const PATHS = {
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
    calendar: "M8 2v3M16 2v3M3.5 9h17M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
    pin: "M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
    heart: "M12 21s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 3.5C19 16.5 12 21 12 21Z",
    bookmark: "M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z",
    check: "M20 6 9 17l-5-5",
    chevL: "M15 18l-6-6 6-6",
    chevR: "M9 6l6 6-6 6",
    chevD: "M6 9l6 6 6-6",
    arrowR: "M5 12h14M13 6l6 6-6 6",
    lock: "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3",
    unlock: "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 7.5-2",
    users: "M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19a3.2 3.2 0 0 0-3-3.2M18 11.2A3 3 0 0 0 18 5.4",
    user: "M5 20a7 7 0 0 1 14 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    home: "M3 11l9-8 9 8M5 9.5V21h14V9.5",
    compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z",
    x: "M6 6l12 12M18 6 6 18",
    plus: "M12 5v14M5 12h14",
    bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
    share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
    ticket: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z",
    filter: "M3 5h18M6 12h12M10 19h4",
    spark: "M12 3c.7 4 1.6 4.9 5.6 5.6C13.6 9.3 12.7 10.2 12 14c-.7-3.8-1.6-4.7-5.6-5.4C10.4 7.9 11.3 7 12 3Z",
    send: "M5 12 20 4l-5 16-3.5-6.5L5 12Z",
    coffee: "M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9ZM17 10h2a2.5 2.5 0 0 1 0 5h-2M6 4v1.5M10 4v1.5M14 4v1.5",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    camera: "M3 8.5a2 2 0 0 1 2-2h2L8.5 4.5h7L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
    mail: "M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7ZM3.5 7.5l8.5 6 8.5-6",
    info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5h.01",
    help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.1 9.5a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V13Z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    trend: "M4 16l5-5 3.5 3.5L20 7M15 7h5v5",
    music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
  };
  function Icon({
    name,
    size = 22,
    w = 2,
    color = "currentColor",
    style = {}
  }) {
    return /*#__PURE__*/React.createElement("svg", {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: w,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        flex: "none",
        ...style
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: PATHS[name] || ""
    }));
  }

  /* ---------------- logo (Click Brand Package - Poppins wordmark + c-mark) ----------------
     Sparkle-pair i-dot: a large lavender glint + a small companion drifting up-right.
     Geometry ported from Click Brand Package.html with its locked tweak values. */
  const LAV = "var(--lavender-300)";
  function spkD(cx, cy, r, opt) {
    opt = opt || {};
    const top = (opt.top || 1) * r,
      right = (opt.right || 1) * r,
      bot = (opt.bottom || 1) * r,
      left = (opt.left || 1) * r,
      w = opt.w == null ? 0.46 : opt.w,
      p = opt.p == null ? 0.065 : opt.p;
    const n = v => Math.round(v * 100) / 100;
    return `M${n(cx)} ${n(cy - top)} C${n(cx + p * right)} ${n(cy - w * top)} ${n(cx + w * right)} ${n(cy - p * top)} ${n(cx + right)} ${n(cy)} C${n(cx + w * right)} ${n(cy + p * bot)} ${n(cx + p * right)} ${n(cy + w * bot)} ${n(cx)} ${n(cy + bot)} C${n(cx - p * left)} ${n(cy + w * bot)} ${n(cx - w * left)} ${n(cy + p * bot)} ${n(cx - left)} ${n(cy)} C${n(cx - w * left)} ${n(cy - p * top)} ${n(cx - p * left)} ${n(cy - w * top)} ${n(cx)} ${n(cy - top)} Z`;
  }
  /* sparkle pair - big glint + small companion (the brand signature) */
  function Spark({
    size = 20,
    big = LAV,
    small = LAV,
    off = 0.75
  }) {
    const sx = 50 + (82 - 50) * off,
      sy = 50 + (32 - 50) * off;
    return /*#__PURE__*/React.createElement("svg", {
      width: size,
      height: size,
      viewBox: "0 0 100 100",
      fill: "none",
      style: {
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: spkD(46, 66, 34, {
        w: 0.44
      }),
      fill: big
    }), /*#__PURE__*/React.createElement("path", {
      d: spkD(sx, sy, 13, {
        w: 0.40
      }),
      fill: small
    }));
  }
  /* primary wordmark - lowercase 'click', dotless i carrying the sparkle pair */
  function Logo({
    cream,
    size = 26
  }) {
    const col = cream ? "var(--cream)" : "var(--purple-600)";
    const sp = Math.round(size * 0.40),
      gap = Math.round(size * -0.34);
    return /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "baseline",
        whiteSpace: "nowrap",
        fontSize: size,
        color: col
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "Poppins"
      }
    }, "cl"), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        display: "inline-block",
        fontFamily: "Poppins"
      }
    }, "\u0131", /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: "50%",
        bottom: `calc(100% + ${gap}px)`,
        transform: "translateX(-42%)"
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: sp
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "Poppins"
      }
    }, "ck"));
  }
  /* the c-mark - bare 'c' letterform cradling the sparkle pair (app icon / favicon / avatar) */
  function Cmark({
    size = 40,
    cColor = "var(--purple-600)",
    accent = LAV
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        fontSize: size
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: "1em",
        color: cColor,
        letterSpacing: "-.02em"
      }
    }, "c"), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: "0.47em",
        top: "0.11em",
        width: "0.34em",
        height: "0.34em",
        lineHeight: 0
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "100%",
      height: "100%",
      viewBox: "0 0 100 100",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: spkD(50, 50, 44),
      fill: accent
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: "0.71em",
        top: "-0.1em",
        width: "0.15em",
        height: "0.15em",
        lineHeight: 0
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "100%",
      height: "100%",
      viewBox: "0 0 100 100",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: spkD(50, 50, 44, {
        w: 0.40
      }),
      fill: accent
    }))));
  }
  /* squircle app tile holding the c-mark */
  function AppTile({
    size = 56,
    bg = "var(--purple-600)",
    accent = LAV,
    cColor = "var(--cream)"
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        width: size,
        height: size,
        borderRadius: size * 0.225,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 20px rgba(25,19,58,.22)"
      }
    }, /*#__PURE__*/React.createElement(Cmark, {
      size: size * 0.6,
      cColor: cColor,
      accent: accent
    }));
  }

  /* ---------------- buttons / inputs ---------------- */
  function Btn({
    children,
    variant = "primary",
    size = "md",
    full,
    disabled,
    loading,
    onClick,
    icon,
    style = {}
  }) {
    const v = variant === "warm" ? "primary" : variant;
    const known = ["primary", "secondary", "ghost", "onPurple", "pending", "mutual"].includes(v);
    const cls = ["ck-btn", "ck-btn--" + size, known ? "ck-btn--" + v : "", full ? "ck-btn--full" : "", loading ? "ck-btn--loading" : ""].filter(Boolean).join(" ");
    const extra = !known ? {
      onPurpleGhost: {
        background: "transparent",
        color: "var(--cream)",
        border: "1.5px solid var(--border-onpurple)"
      }
    }[v] || {} : {};
    return /*#__PURE__*/React.createElement("button", {
      className: cls,
      onClick: disabled || loading ? undefined : onClick,
      disabled: disabled || loading,
      "aria-busy": loading || undefined,
      style: {
        ...extra,
        ...style
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "ck-btn__label"
    }, icon && /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 18,
      w: 2.2
    }), children), loading && /*#__PURE__*/React.createElement("span", {
      className: "ck-btn__spinner",
      "aria-hidden": "true"
    }));
  }
  /* stateful click-with control - ONE footprint across default → pending → mutual.
     Only the fill colour + label change (per Buttons_Tags A1b v4). Pending = muted
     "clicked" (NO ✨); mutual = Sage "clicked ✨" (✨ on the peak only). NO helper
     line on the card - the anonymous reassurance shows once per section. */
  function ClickBtn({
    name,
    state = "default",
    onClick,
    onView,
    full,
    size = "sm"
  }) {
    if (state === "mutual") return /*#__PURE__*/React.createElement(Btn, {
      variant: "mutual",
      size: size,
      full: full,
      onClick: onView
    }, "clicked ", /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true"
    }, "\u2728"));
    if (state === "pending") return /*#__PURE__*/React.createElement(Btn, {
      variant: "pending",
      size: size,
      full: full
    }, "clicked");
    return /*#__PURE__*/React.createElement(Btn, {
      variant: "primary",
      size: size,
      full: full,
      onClick: onClick
    }, `click with ${name}`);
  }
  function Field({
    label,
    placeholder,
    type = "text",
    value,
    onChange,
    hint,
    icon,
    style = {}
  }) {
    const [f, setF] = useState(false);
    return /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7,
        ...style
      }
    }, label && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        height: 50,
        background: "var(--white)",
        border: `1.5px solid ${f ? "var(--accent)" : "var(--border-mid)"}`,
        borderRadius: "var(--radius-md)",
        boxShadow: f ? "0 0 0 4px color-mix(in srgb,var(--lavender-300) 45%,transparent)" : "none",
        transition: "border .15s,box-shadow .15s"
      }
    }, icon && /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 18,
      w: 1.9,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("input", {
      type: type,
      placeholder: placeholder,
      value: value,
      onChange: e => onChange && onChange(e.target.value),
      onFocus: () => setF(true),
      onBlur: () => setF(false),
      style: {
        flex: 1,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: "none",
        fontFamily: "var(--font-sans)",
        fontSize: 15.5,
        color: "var(--text-strong)"
      }
    })), hint && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.4
      }
    }, hint));
  }
  function Toggle({
    checked,
    onChange,
    label,
    helper
  }) {
    return /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        gap: 13,
        cursor: "pointer",
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => onChange && onChange(!checked),
      style: {
        flex: "none",
        width: 48,
        height: 29,
        borderRadius: "var(--radius-pill)",
        background: checked ? "var(--accent)" : "var(--sand-300)",
        position: "relative",
        transition: "background .18s",
        marginTop: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 3,
        left: checked ? 22 : 3,
        width: 23,
        height: 23,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "var(--shadow-sm)",
        transition: "left .18s cubic-bezier(.3,.7,.4,1)"
      }
    })), (label || helper) && /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, label), helper && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, helper)));
  }

  /* ---------------- avatars / tags / badges ---------------- */
  /* no-photo placeholder: soft lavender disc + a deeper purple silhouette (anonymous-until-mutual).
     pass src for a real photo, variant="initials" for a monogram instead. */
  const PH_TINTS = [["var(--lavender-200)", "var(--purple-500)"], ["#E7DEFA", "var(--purple-600)"], ["var(--lavender-100)", "var(--purple-400)"], ["#EDE6FB", "var(--purple-500)"]];
  function Avatar({
    name = "",
    src,
    size = 40,
    ring,
    variant = "silhouette",
    style = {}
  }) {
    const [bg, fg] = PH_TINTS[(name.charCodeAt(0) || 0) % PH_TINTS.length];
    const common = {
      width: size,
      height: size,
      borderRadius: "50%",
      flex: "none",
      overflow: "hidden",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
      boxShadow: ring ? "0 0 0 2.5px var(--white),0 0 0 4px var(--lavender-300)" : style.boxShadow || "none"
    };
    if (src) return /*#__PURE__*/React.createElement("div", {
      style: {
        ...common,
        background: "var(--sand-100)"
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: src,
      alt: name,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }));
    if (variant === "initials" && name) return /*#__PURE__*/React.createElement("div", {
      style: {
        ...common,
        background: bg,
        color: fg,
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size * .36
      }
    }, initials(name));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...common,
        background: bg
      },
      role: "img",
      "aria-label": name ? name + " - no photo yet" : "No photo yet"
    }, /*#__PURE__*/React.createElement("svg", {
      width: size * .62,
      height: size * .62,
      viewBox: "0 0 24 24",
      fill: fg,
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "8.6",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7z"
    })));
  }
  function Stack({
    people = [],
    max = 4,
    size = 30,
    label
  }) {
    const sh = people.slice(0, max),
      ex = people.length - sh.length;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center"
      }
    }, sh.map((p, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        marginLeft: i ? -size * .34 : 0,
        zIndex: i,
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: p,
      size: size,
      style: {
        boxShadow: "0 0 0 2.5px var(--white)"
      }
    }))), ex > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        marginLeft: -size * .34,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--lavender-100)",
        color: "var(--purple-700)",
        boxShadow: "0 0 0 2.5px var(--white)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size * .34,
        lineHeight: 1
      }
    }, "+", ex)), label && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--text-muted)"
      }
    }, label));
  }
  function Tag({
    children,
    selected,
    dense,
    onClick,
    style = {}
  }) {
    return /*#__PURE__*/React.createElement("span", {
      onClick: onClick,
      className: onClick && !selected ? "ck-tag--select" : "",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: dense && !selected ? 22 : 24,
        padding: dense ? "0 8px" : "0 10px",
        fontSize: 12,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        cursor: onClick ? "pointer" : "default",
        background: selected ? "var(--purple-600)" : "var(--white)",
        color: selected ? "var(--cream)" : "var(--ink)",
        border: "1px solid " + (selected ? "transparent" : "var(--mist-strong)"),
        ...style
      }
    }, children);
  }
  /* measured fit-by-width tag row: render only whole tags that fit (with the +N chip reserved),
     collapse the rest into ONE trailing "+N" inside the card padding. Never wrap/scroll/shrink. */
  function FitTags({
    tags = [],
    dense = true,
    max = Infinity
  }) {
    const cap = Math.min(max, tags.length);
    const wrapRef = useRef(null);
    const measRef = useRef(null);
    const [count, setCount] = useState(cap);
    React.useLayoutEffect(() => {
      const wrap = wrapRef.current,
        meas = measRef.current;
      if (!wrap || !meas) return;
      const compute = () => {
        const avail = wrap.clientWidth;
        if (!avail) return;
        const gap = 6;
        const kids = [...meas.children];
        const plusW = kids.length ? kids[kids.length - 1].offsetWidth : 0;
        let used = 0,
          fit = 0;
        for (let i = 0; i < cap; i++) {
          const w = kids[i].offsetWidth + (i > 0 ? gap : 0);
          const needPlus = cap < tags.length || i < cap - 1;
          const reserve = needPlus ? gap + plusW : 0;
          if (used + w + reserve <= avail) {
            used += w;
            fit = i + 1;
          } else break;
        }
        setCount(Math.max(1, fit));
      };
      compute();
      const ro = new ResizeObserver(compute);
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [tags.join("|"), cap]);
    const overflow = tags.length - count;
    return /*#__PURE__*/React.createElement("div", {
      ref: wrapRef,
      style: {
        position: "relative",
        display: "flex",
        gap: 6,
        minWidth: 0,
        overflow: "hidden",
        width: "100%"
      }
    }, tags.slice(0, count).map(t => /*#__PURE__*/React.createElement(Tag, {
      key: t,
      dense: true
    }, t)), overflow > 0 && /*#__PURE__*/React.createElement(Tag, {
      dense: true,
      style: {
        color: "var(--text-muted)"
      }
    }, "+", overflow), /*#__PURE__*/React.createElement("div", {
      ref: measRef,
      "aria-hidden": "true",
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        visibility: "hidden",
        pointerEvents: "none",
        display: "flex",
        gap: 6
      }
    }, tags.map(t => /*#__PURE__*/React.createElement(Tag, {
      key: t,
      dense: true
    }, t)), /*#__PURE__*/React.createElement(Tag, {
      dense: true,
      style: {
        color: "var(--text-muted)"
      }
    }, "+", tags.length)));
  }
  /* ---------------- People Card - ONE component across all FOUR surfaces it appears on
     (discovery rows · dashboard rotated card · who-was-there grid · event attendee list).
     ANATOMY IS INVARIANT: avatar LEFT 52 · name + intent grouped tight & INLINE (name ~17 Ink,
     intent ~13 Slate, sentence case - never green, never stacked) · a CONDITIONAL commonality
     line (pin + "You were both at [event]" / overlap-glyph + "Both into [overlap]"; omitted
     cleanly if none) · ≤3 neutral tags (FitTags, one line + "+N") · the stateful click button
     (default → muted "clicked" → Sage "clicked ✨") PAIRED with the quiet "View profile" GHOST.
     ONLY the action LAYOUT + count vary per surface (right column on wide rows, paired bottom
     row on narrow cards); the attendee list drops the click action - clicking is post-event
     only - and opens the profile on a whole-card tap (interestsOnly = no intent/commonality). */
  const VennMark = ({
    s = 15
  }) => /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 1,
      flex: "none",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--purple-500)",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "12",
    r: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "12",
    r: "6"
  })));
  /* commonality LINE - a NON-interest axis only, so it never restates the interest tags.
     Priority: shared EVENT → shared MUSIC → (post-mutual only) a light life tag → cluster
     PROXIMITY → omit. Life tags are private until mutual, so pre-mutual cards pass postMutual
     false and never surface them. Interests appear ONLY in the tag row, never here. */
  function commonality(p, postMutual) {
    if (!p) return null;
    if (p.sharedEvent) return {
      icon: "pin",
      lead: "You were both at ",
      term: p.sharedEvent
    };
    if (p.sharedMusic) return {
      icon: "music",
      lead: "Both into ",
      term: p.sharedMusic
    };
    if (postMutual && p.commonLife) return {
      icon: "venn",
      lead: "",
      term: p.commonLife
    };
    if (p.proximity) return {
      icon: "venn",
      lead: "",
      term: p.proximity
    };
    return null;
  }
  function CommonalityLine({
    p,
    postMutual,
    style = {}
  }) {
    const c = commonality(p, postMutual);
    if (!c) return null;
    const glyph = c.icon === "pin" ? /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 14,
      w: 1.9,
      color: "var(--purple-500)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }) : c.icon === "music" ? /*#__PURE__*/React.createElement(Icon, {
      name: "music",
      size: 14,
      w: 1.9,
      color: "var(--purple-500)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }) : /*#__PURE__*/React.createElement(VennMark, null);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 7,
        fontSize: 12.5,
        color: "var(--text-body)",
        lineHeight: 1.4,
        ...style
      }
    }, glyph, /*#__PURE__*/React.createElement("span", null, c.lead, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text-strong)",
        fontWeight: 600
      }
    }, c.term)));
  }
  function PeopleCard({
    p,
    web,
    layout = "row",
    action = "click",
    clicked,
    mutual,
    postMutual,
    onClick,
    onView,
    onOpen,
    interestsOnly
  }) {
    const fn = (p.name || "").split(" ")[0];
    const isMutual = mutual != null ? mutual : !!p.mutual;
    const stacked = layout === "row" && web; // wide row → actions in a right column
    const tags = (p.tags || []).slice(0, 3);
    const commonalityLine = interestsOnly ? null : /*#__PURE__*/React.createElement(CommonalityLine, {
      p: p,
      postMutual: postMutual
    });

    /* identity pair - name + intent INLINE (baseline, wrap); intent Slate, sentence case */
    const identity = /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 9,
        flexWrap: "wrap",
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.2,
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, fn), action === "none" && isMutual && /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--radius-pill)",
        background: "color-mix(in srgb,var(--sage) 14%,var(--white))",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--sage)"
      }
    }, "clicked ", /*#__PURE__*/React.createElement(Spark, {
      size: 11,
      big: "var(--sage)",
      small: "var(--sage)"
    })), !interestsOnly && p.intent && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        fontWeight: 500,
        lineHeight: 1.3
      }
    }, p.intent.charAt(0).toUpperCase() + p.intent.slice(1)));
    const content = /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, identity, commonalityLine, tags.length > 0 && /*#__PURE__*/React.createElement(FitTags, {
      tags: tags
    }));

    /* actions - the SAME pair everywhere; only the layout adapts to width */
    let actions = null;
    if (action === "click") {
      if (isMutual) actions = /*#__PURE__*/React.createElement(ClickBtn, {
        state: "mutual",
        full: true,
        onView: onView
      });else if (stacked) actions = /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 9
        }
      }, /*#__PURE__*/React.createElement(ClickBtn, {
        name: fn,
        state: clicked ? "pending" : "default",
        onClick: onClick,
        full: true
      }), /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        variant: "ghost",
        full: true,
        onClick: onView
      }, "View profile"));else actions = /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement(ClickBtn, {
        name: fn,
        state: clicked ? "pending" : "default",
        onClick: onClick,
        full: true
      })), /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        variant: "ghost",
        onClick: onView
      }, "View profile"));
    }
    const cardBase = {
      boxSizing: "border-box",
      background: "var(--white)",
      border: "1px solid var(--border-soft)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-sm)"
    };

    /* attendee list - whole card opens the profile modal; no buttons; chevron affordance */
    if (action === "none") return /*#__PURE__*/React.createElement("button", {
      onClick: onOpen,
      "aria-label": `View ${fn}'s profile`,
      style: {
        ...cardBase,
        position: "relative",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "flex-start",
        gap: 13,
        padding: "16px 34px 16px 16px",
        width: "100%",
        height: "100%"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 16,
        right: 13,
        display: "inline-flex"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 16,
      w: 2,
      color: "var(--text-faint)"
    })), /*#__PURE__*/React.createElement(Avatar, {
      name: p.name,
      size: 52
    }), content);

    /* WIDE ROW (discovery / dashboard on web): avatar + content + right action column */
    if (stacked) return /*#__PURE__*/React.createElement("div", {
      style: {
        ...cardBase,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "18px 20px"
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: p.name,
      size: 52
    }), content, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        width: 190
      }
    }, actions));

    /* NARROW CARD (who-was-there grid / mobile stack): content on top, paired action bottom row */
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...cardBase,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 17,
        height: "100%"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 13,
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: p.name,
      size: 52
    }), content), actions);
  }
  function Badge({
    children,
    tone = "onImage",
    style = {}
  }) {
    const t = {
      onImage: {
        background: "rgba(28,24,48,.62)",
        color: "#fff"
      },
      coral: {
        background: "color-mix(in srgb,var(--coral) 12%,var(--white))",
        color: "var(--coral)"
      },
      amber: {
        background: "color-mix(in srgb,var(--amber) 16%,var(--white))",
        color: "#a86f12"
      },
      sage: {
        background: "color-mix(in srgb,var(--sage) 14%,var(--white))",
        color: "var(--sage)"
      },
      teal: {
        background: "color-mix(in srgb,var(--teal) 12%,var(--white))",
        color: "var(--teal)"
      },
      lavender: {
        background: "var(--lavender-100)",
        color: "var(--purple-700)"
      },
      cream: {
        background: "var(--cream)",
        color: "var(--text-strong)"
      }
    }[tone];
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 24,
        padding: "0 8px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        boxSizing: "border-box",
        borderRadius: 8,
        ...t,
        ...style
      }
    }, children);
  }
  /* status pill for discovery cards - solid status hue, large-text/badge use only */
  function Status({
    kind,
    style = {}
  }) {
    const s = STATUS[kind];
    if (!s) return null;
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".01em",
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        background: s.hue,
        color: s.text,
        boxShadow: "0 2px 8px rgba(25,19,58,.18)",
        ...style
      }
    }, kind === "going" && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13,
      w: 2.6
    }), kind === "free" && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13,
      w: 2.6
    }), s.label);
  }
  function IntentLine({
    yourIntent = "friends",
    theirIntent,
    onPurple,
    style = {}
  }) {
    const eq = !theirIntent || theirIntent === yourIntent;
    const skin = onPurple ? {
      background: "rgba(253,250,246,.16)",
      color: "var(--cream)",
      bold: "var(--cream)"
    } : {
      background: "var(--lavender-100)",
      color: "var(--text-body)",
      bold: "var(--purple-700)"
    };
    return /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.45,
        color: skin.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 15px",
        background: skin.background,
        borderRadius: "var(--radius-pill)",
        ...style
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true"
    }, "\u2728"), eq ? /*#__PURE__*/React.createElement("span", null, "You're both here for ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: skin.bold,
        fontWeight: 700
      }
    }, yourIntent), ".") : /*#__PURE__*/React.createElement("span", null, "You're here for ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: skin.bold,
        fontWeight: 700
      }
    }, yourIntent), " \xB7 they're open to ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: skin.bold,
        fontWeight: 700
      }
    }, theirIntent), "."));
  }

  /* ---------------- cover - warm-graded activity ART (photography stand-in: real venues
     have no faces; warm tonal grade unifies every surface). Fills the frame edge-to-edge;
     replaces the old grey placeholder. Used site-wide (cards, hero, strips). ---------------- */
  const WC = {
    w0: "#F6E7D2",
    w1: "#ECD0AC",
    w2: "#E0AE7E",
    w3: "#CF8B57",
    w4: "#B0683B",
    w5: "#834A2B",
    w6: "#4E2C1A",
    gold: "#F4C56B",
    cream: "#F9F6F0",
    sage: "#93A98C",
    sage2: "#7E9B78",
    slate: "#7E93A8"
  };
  function Scene({
    category,
    uid
  }) {
    const S = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      display: "block"
    };
    const slice = "xMidYMid slice";
    const svg = (kids, bg) => /*#__PURE__*/React.createElement("svg", {
      style: S,
      viewBox: "0 0 400 280",
      preserveAspectRatio: slice
    }, /*#__PURE__*/React.createElement("rect", {
      width: "400",
      height: "280",
      fill: bg
    }), kids);
    const runner = (x, y, s, i) => /*#__PURE__*/React.createElement("g", {
      key: i,
      transform: `translate(${x} ${y}) scale(${s})`,
      stroke: WC.w6,
      strokeWidth: "3.4",
      strokeLinecap: "round",
      fill: "none"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "0",
      cy: "-17",
      r: "4.2",
      fill: WC.w6,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M0 -13 q5 7 2 15"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M2 2 l9 9 M2 2 l-8 10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M0 -8 l-9 4 M0 -8 l10 2"
    }));
    switch (category) {
      case "ceramics":
        return svg(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
          y: "170",
          width: "400",
          height: "110",
          fill: WC.w3
        }), /*#__PURE__*/React.createElement("rect", {
          x: "18",
          y: "18",
          width: "150",
          height: "120",
          rx: "8",
          fill: WC.gold,
          opacity: ".42"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "200",
          cy: "206",
          rx: "122",
          ry: "26",
          fill: WC.w5
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "200",
          cy: "198",
          rx: "122",
          ry: "22",
          fill: "#9C5A33"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M168 200 q-6 -42 14 -72 q18 -22 36 0 q20 30 14 72 z",
          fill: WC.w4
        }), /*#__PURE__*/React.createElement("path", {
          d: "M183 200 q-4 -36 8 -64 q8 -16 17 -2 q4 18 2 66 z",
          fill: WC.w2
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "200",
          cy: "130",
          rx: "22",
          ry: "7",
          fill: WC.w2
        }), /*#__PURE__*/React.createElement("path", {
          d: "M150 150 q24 -10 41 6 q-6 18 -29 16 q-18 -2 -12 -22z",
          fill: "#7A4327"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M250 150 q-24 -10 -41 6 q6 18 29 16 q18 -2 12 -22z",
          fill: "#683921"
        }), /*#__PURE__*/React.createElement("circle", {
          cx: "120",
          cy: "232",
          r: "3",
          fill: WC.w5
        }), /*#__PURE__*/React.createElement("circle", {
          cx: "300",
          cy: "224",
          r: "2.5",
          fill: WC.w5
        })), "#E6C49B");
      case "workshops":
        return svg(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
          y: "190",
          width: "400",
          height: "90",
          fill: "#B97C4C"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "20",
          y: "18",
          width: "120",
          height: "92",
          rx: "8",
          fill: WC.gold,
          opacity: ".4"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M150 92 q50 -14 100 0 v68 q0 50 -50 56 q-50 -6 -50 -56z",
          fill: WC.cream,
          opacity: ".4"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M152 150 h96 v8 q0 46 -48 52 q-48 -6 -48 -52z",
          fill: "#8A5A33"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "158",
          y: "150",
          width: "84",
          height: "10",
          fill: "#C99A66"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M152 168 q48 14 96 0 q0 36 -48 40 q-48 -4 -48 -40z",
          fill: WC.sage
        }), /*#__PURE__*/React.createElement("path", {
          d: "M150 92 q50 -14 100 0 v68 q0 50 -50 56 q-50 -6 -50 -56z",
          fill: "none",
          stroke: WC.w0,
          strokeWidth: "3",
          opacity: ".7"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M200 96 q-10 -34 6 -56",
          stroke: "#6F8A6A",
          strokeWidth: "4",
          fill: "none",
          strokeLinecap: "round"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "198",
          cy: "50",
          rx: "10",
          ry: "5",
          fill: WC.sage2,
          transform: "rotate(-30 198 50)"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "214",
          cy: "58",
          rx: "9",
          ry: "4.5",
          fill: WC.sage,
          transform: "rotate(20 214 58)"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M250 122 q42 -6 56 18 q-10 16 -35 10 q-23 -6 -21 -28z",
          fill: "#7A4327"
        })), "#E3C49E");
      case "wine":
        return svg(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
          y: "200",
          width: "400",
          height: "80",
          fill: "#3E2418"
        }), /*#__PURE__*/React.createElement("rect", {
          y: "186",
          width: "400",
          height: "16",
          fill: "#7A4A2E"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "200",
          cy: "26",
          rx: "130",
          ry: "52",
          fill: WC.gold,
          opacity: ".26"
        }), [64, 148, 238, 322].map((x, i) => /*#__PURE__*/React.createElement("g", {
          key: i
        }, /*#__PURE__*/React.createElement("path", {
          d: `M${x - 26} 100 Q${x} 152 ${x + 26} 100 Z`,
          fill: "#F2D9A6",
          opacity: ".92"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M${x - 20} 104 Q${x} 140 ${x + 20} 104 Z`,
          fill: WC.gold
        }), /*#__PURE__*/React.createElement("rect", {
          x: x - 2,
          y: "150",
          width: "4",
          height: "24",
          fill: "#E8CFA0"
        }), /*#__PURE__*/React.createElement("rect", {
          x: x - 13,
          y: "174",
          width: "26",
          height: "5",
          rx: "2",
          fill: "#E8CFA0"
        }), /*#__PURE__*/React.createElement("circle", {
          cx: x + 11,
          cy: "100",
          r: "4",
          fill: WC.sage
        }))), /*#__PURE__*/React.createElement("path", {
          d: "M238 42 q5 30 0 56",
          stroke: WC.w0,
          strokeWidth: "3",
          opacity: ".7",
          fill: "none"
        })), "#5E3A28");
      case "run":
        return svg(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
          id: uid + "sky",
          x1: "0",
          y1: "0",
          x2: "0",
          y2: "1"
        }, /*#__PURE__*/React.createElement("stop", {
          offset: "0",
          stopColor: "#F6E7D2"
        }), /*#__PURE__*/React.createElement("stop", {
          offset: ".55",
          stopColor: "#F4C56B"
        }), /*#__PURE__*/React.createElement("stop", {
          offset: "1",
          stopColor: "#E0A06A"
        }))), /*#__PURE__*/React.createElement("rect", {
          width: "400",
          height: "280",
          fill: `url(#${uid}sky)`
        }), /*#__PURE__*/React.createElement("circle", {
          cx: "298",
          cy: "118",
          r: "46",
          fill: "#FBE3A0",
          opacity: ".85"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "58",
          cy: "150",
          rx: "34",
          ry: "44",
          fill: "#9A6B40",
          opacity: ".55"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "108",
          cy: "160",
          rx: "28",
          ry: "36",
          fill: "#7E4E2C",
          opacity: ".5"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M0 208 q200 -30 400 6 v66 H0z",
          fill: "#C98A55"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M0 248 q200 -20 400 8 v24 H0z",
          fill: "#A86B3C"
        }), [[150, 196, 1], [198, 202, 1.1], [240, 198, .9]].map(([x, y, s], i) => runner(x, y, s, i))), "#F4C56B");
      case "art":
        return svg(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
          id: uid + "f",
          cx: ".62",
          cy: ".52",
          r: ".55"
        }, /*#__PURE__*/React.createElement("stop", {
          offset: "0",
          stopColor: "#FFD98A"
        }), /*#__PURE__*/React.createElement("stop", {
          offset: ".5",
          stopColor: "#F4A24C",
          stopOpacity: ".65"
        }), /*#__PURE__*/React.createElement("stop", {
          offset: "1",
          stopColor: "#3A2014",
          stopOpacity: "0"
        }))), /*#__PURE__*/React.createElement("rect", {
          width: "400",
          height: "280",
          fill: `url(#${uid}f)`
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "250",
          cy: "150",
          rx: "42",
          ry: "46",
          fill: "#F49A3C",
          opacity: ".45"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "40",
          y: "150",
          width: "222",
          height: "7",
          rx: "3.5",
          fill: "#6E4A30",
          transform: "rotate(-6 150 153)"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "252",
          cy: "136",
          rx: "20",
          ry: "24",
          fill: "#F6B84E"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "252",
          cy: "136",
          rx: "11",
          ry: "15",
          fill: "#FFE39C"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M20 160 q42 -8 72 0 q-2 16 -37 16 q-35 0 -35 -16z",
          fill: "#2A170D"
        }), /*#__PURE__*/React.createElement("circle", {
          cx: "282",
          cy: "108",
          r: "2",
          fill: "#FFE39C"
        }), /*#__PURE__*/React.createElement("circle", {
          cx: "298",
          cy: "128",
          r: "1.6",
          fill: "#FFD98A"
        })), "#3A2014");
      case "cooking":
        return svg(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
          y: "120",
          width: "400",
          height: "160",
          fill: "#CE9A66"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "20",
          y: "14",
          width: "120",
          height: "70",
          rx: "8",
          fill: WC.gold,
          opacity: ".34"
        }), [60, 150, 250, 330].map((x, i) => /*#__PURE__*/React.createElement("circle", {
          key: i,
          cx: x,
          cy: 150 + i % 2 * 40,
          r: "2.4",
          fill: WC.w0,
          opacity: ".7"
        })), /*#__PURE__*/React.createElement("rect", {
          x: "60",
          y: "86",
          width: "180",
          height: "18",
          rx: "9",
          fill: "#B97C4C"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "44",
          y: "90",
          width: "20",
          height: "10",
          rx: "5",
          fill: "#9A6336"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "236",
          y: "90",
          width: "20",
          height: "10",
          rx: "5",
          fill: "#9A6336"
        }), [120, 210, 292].map((x, i) => /*#__PURE__*/React.createElement("g", {
          key: i
        }, /*#__PURE__*/React.createElement("ellipse", {
          cx: x,
          cy: "182",
          rx: "34",
          ry: "17",
          fill: "#E7B86A"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M${x - 26} 180 q26 -14 52 0 M${x - 22} 186 q22 -10 44 0 M${x - 24} 174 q24 -12 48 0`,
          stroke: "#D89B4E",
          strokeWidth: "2.6",
          fill: "none"
        }))), /*#__PURE__*/React.createElement("path", {
          d: "M332 150 q6 -20 -2 -34",
          stroke: "#6F8A6A",
          strokeWidth: "3",
          fill: "none"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "326",
          cy: "112",
          rx: "8",
          ry: "4",
          fill: WC.sage,
          transform: "rotate(-26 326 112)"
        })), "#E7C8A0");
      default:
        return svg(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
          y: "180",
          width: "400",
          height: "100",
          fill: "#C68C58"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "24",
          y: "20",
          width: "130",
          height: "100",
          rx: "8",
          fill: WC.gold,
          opacity: ".38"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "150",
          cy: "190",
          rx: "34",
          ry: "12",
          fill: "#7E4A2C"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M120 150 h60 v18 q0 22 -30 24 q-30 -2 -30 -24z",
          fill: "#F2DDBE"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M126 156 q24 8 48 0 q0 16 -24 18 q-24 -2 -24 -18z",
          fill: "#8A5A36"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M180 156 q22 0 22 16 q0 14 -22 14",
          fill: "none",
          stroke: "#F2DDBE",
          strokeWidth: "6"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M150 132 q6 -8 0 -16",
          stroke: "#F2DDBE",
          strokeWidth: "2.4",
          fill: "none",
          opacity: ".6"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "250",
          y: "150",
          width: "40",
          height: "36",
          rx: "6",
          fill: "#9A6336"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M270 150 q-8 -26 4 -42",
          stroke: "#6F8A6A",
          strokeWidth: "4",
          fill: "none"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "266",
          cy: "106",
          rx: "9",
          ry: "4.5",
          fill: WC.sage,
          transform: "rotate(-28 266 106)"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: "282",
          cy: "116",
          rx: "8",
          ry: "4",
          fill: WC.sage2,
          transform: "rotate(22 282 116)"
        })), "#E6C6A0");
    }
  }
  let _coverN = 0;
  /* tone: optional warm-graded wash variant so a set of Covers (e.g. a profile photo grid)
     reads with tonal VARIETY instead of one uniform brown wall. Omit = the canonical warm wash. */
  const COVER_WASH = {
    warm: ["#E6C49B", "linear-gradient(158deg,rgba(244,196,107,.10),rgba(110,58,30,.20))"],
    bright: ["#EBD3A6", "linear-gradient(158deg,rgba(255,216,146,.12),rgba(150,92,40,.13))"],
    cool: ["#B6C6D6", "linear-gradient(158deg,rgba(150,178,205,.13),rgba(46,62,92,.20))"],
    dusk: ["#D8B4C6", "linear-gradient(158deg,rgba(214,150,182,.11),rgba(72,40,82,.20))"]
  };
  function Cover({
    category,
    h = 180,
    aspect,
    children,
    dim,
    radius = 0,
    photo,
    tone
  }) {
    const [baseBg, washBg] = COVER_WASH[tone] || COVER_WASH.warm;
    const idRef = useRef(null);
    if (idRef.current === null) idRef.current = "cv" + ++_coverN;
    const box = aspect ? {
      position: "relative",
      width: "100%",
      aspectRatio: String(aspect),
      overflow: "hidden",
      borderRadius: radius,
      background: baseBg
    } : {
      position: "relative",
      height: h,
      overflow: "hidden",
      borderRadius: radius,
      background: baseBg
    };
    return /*#__PURE__*/React.createElement("div", {
      style: box
    }, /*#__PURE__*/React.createElement(Scene, {
      category: category,
      uid: idRef.current
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        background: washBg
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        boxShadow: "inset 0 0 58px rgba(48,24,10,.26)"
      }
    }), dim && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        background: "rgba(25,19,58,.42)"
      }
    }), children);
  }

  /* ---------------- site footer - small, global; same on every page (marketing + app) ----------------
     LOCKED: EXACTLY 2 rows, NO tagline. Row 1 = wordmark + essential links. Row 2 = copyright + social + email. */
  function SiteFooter({
    web,
    onNav = () => {}
  }) {
    const links = [["Discover", "discover"], ["How it works", "howitworks"], ["Host an event", "merchant"], ["Merchant", "merchant"], ["Help", null], ["Privacy", null], ["Terms", null]];
    const Link = ({
      label,
      k
    }) => {
      const [h, setH] = useState(false);
      return /*#__PURE__*/React.createElement("button", {
        onMouseEnter: () => setH(true),
        onMouseLeave: () => setH(false),
        onClick: () => k && onNav(k),
        style: {
          border: "none",
          background: "none",
          padding: "8px 2px",
          margin: "-8px -2px",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: web ? 13 : 11.5,
          fontWeight: 500,
          color: h ? "var(--purple-700)" : "var(--text-muted)",
          transition: "color .15s",
          whiteSpace: "nowrap"
        }
      }, label);
    };
    const dot = /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-faint)",
        fontSize: web ? 12 : 10.5
      },
      "aria-hidden": "true"
    }, "\xB7");
    /* monochrome line social icons - Slate → Deep-Purple on hover; aria-labelled link, aria-hidden glyph */
    const Social = ({
      label,
      href,
      children
    }) => {
      const [h, setH] = useState(false);
      return /*#__PURE__*/React.createElement("a", {
        href: href,
        "aria-label": label,
        target: "_blank",
        rel: "noopener noreferrer",
        onMouseEnter: () => setH(true),
        onMouseLeave: () => setH(false),
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: web ? 28 : 24,
          height: web ? 28 : 24,
          color: h ? "var(--purple-700)" : "var(--text-muted)",
          transition: "color .15s"
        }
      }, children);
    };
    return /*#__PURE__*/React.createElement("footer", {
      style: {
        flex: "none",
        background: "var(--cream)",
        borderTop: "1px solid var(--border-soft)",
        padding: web ? "16px 40px 0px" : "12px 16px 6px",
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: "var(--container-max)",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: web ? 10 : 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: web ? 16 : 8
      },
      "data-comment-anchor": "5707d9bb0f-div-337-9"
    }, /*#__PURE__*/React.createElement(Logo, {
      size: web ? 22 : 18
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: web ? 14 : 7,
        rowGap: web ? 6 : 3,
        justifyContent: "flex-end",
        flex: 1,
        minWidth: 0
      }
    }, links.map(([label, k], i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: label
    }, i > 0 && dot, /*#__PURE__*/React.createElement(Link, {
      label: label,
      k: k
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: web ? 8 : 8,
        alignItems: "center",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: web ? 12.5 : 11,
        color: "var(--text-faint)",
        whiteSpace: "nowrap"
      }
    }, "\xA9 2026 Click \xB7 Made in Sydney"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: web ? 6 : 3,
        fontSize: web ? 12.5 : 11,
        color: "var(--text-faint)"
      }
    }, /*#__PURE__*/React.createElement(Social, {
      label: "Click on Instagram",
      href: "https://instagram.com"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "3",
      width: "18",
      height: "18",
      rx: "5"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "17",
      cy: "7",
      r: "1",
      fill: "currentColor",
      stroke: "none"
    }))), /*#__PURE__*/React.createElement(Social, {
      label: "Click on Threads",
      href: "https://threads.net"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M16.5 11.2c-.2-3.1-2-4.7-4.6-4.7-2.4 0-4.3 1.5-4.3 3.8 0 2 1.5 3.3 3.6 3.3 2.4 0 3.6-1.6 3.6-3.9 0-2.9-1.9-4.2-3.6-4.2",
      transform: "translate(0 .3)"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 21c-4.4 0-7-2.9-7-9s2.6-9 7-9c3.5 0 5.7 1.8 6.6 4.5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9.3 13.2c.6 1.2 1.8 1.6 3 1.5 2-.2 3-1.6 2.8-4"
    }))), /*#__PURE__*/React.createElement("a", {
      href: "mailto:hello@click.au",
      style: {
        marginLeft: web ? 6 : 2,
        color: "var(--text-faint)",
        textDecoration: "none",
        fontSize: web ? 12.5 : 11
      }
    }, "hello@click.au")))));
  }
  window.CK = {
    useState,
    useEffect,
    useRef,
    CAT,
    STATUS,
    PALETTES,
    initials,
    LAV,
    Icon,
    Logo,
    Spark,
    Cmark,
    AppTile,
    Btn,
    Field,
    Toggle,
    Avatar,
    Stack,
    Tag,
    FitTags,
    Badge,
    Status,
    ClickBtn,
    IntentLine,
    Cover,
    PeopleCard,
    commonality,
    CommonalityLine,
    SiteFooter
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/kit.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/mechanic-screens.jsx
try { (() => {
(function () {
  /* Click - the mechanic flow. NO chat anywhere; anonymous until mutual; intent-neutral. */
  const {
    useState: useStateM,
    useEffect: useEffectM,
    CAT: CATM,
    Icon: IconM,
    Logo: LogoM,
    Spark: SparkM,
    Cmark: CmarkM,
    Btn: BtnM,
    ClickBtn: ClickBtnM,
    Toggle: ToggleM,
    Avatar: AvatarM,
    Stack: StackM,
    Tag: TagM,
    Badge: BadgeM,
    Status: StatusM,
    IntentLine: IntentLineM,
    Cover: CoverM,
    PeopleCard: PeopleCardM,
    CommonalityLine: CommonalityLineM
  } = window.CK;
  const {
    EVENTS: EVM,
    byId: byIdM
  } = window.DATA;
  function Centered({
    children,
    web,
    max = 560
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? max : "none",
        margin: "0 auto",
        minHeight: "100%"
      }
    }, children);
  }
  function TopBar({
    back,
    label
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "6px 22px 0"
      }
    }, back && /*#__PURE__*/React.createElement("button", {
      onClick: back,
      style: {
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(IconM, {
      name: "chevL",
      size: 20,
      w: 2.4,
      color: "var(--purple-700)"
    })), label && /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--role-overline)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--text-muted)"
      }
    }, label));
  }

  /* neutral interest chip - white fill, mist hairline, ink text (never status colour) */
  function Chip({
    children
  }) {
    return /*#__PURE__*/React.createElement(TagM, null, children);
  }

  /* PEOPLE CARD - the curated daily pool. Delegates to the ONE canonical CK.PeopleCard so the
     discovery rows read identically to the dashboard / who-was-there / attendee surfaces;
     only the action LAYOUT (wide right-column row vs narrow bottom-row) adapts to width. */
  function PersonClickCard({
    p,
    web,
    clicked,
    onClick,
    onView,
    row
  }) {
    return /*#__PURE__*/React.createElement(PeopleCardM, {
      p: p,
      web: web,
      layout: "row",
      action: "click",
      clicked: clicked,
      onClick: onClick,
      onView: onView
    });
  }

  /* PROFILE VIEW - the focused in-flow panel (bio + prompt + full tags live ONLY here).
     Opened via "View profile"; back returns to the list. No page navigation. */
  /* MODE B - VIEWING SOMEONE: a CENTERED MODAL over a dimmed page (was an in-flow panel).
     Public subset only; the ONE place age appears. Esc / scrim / ✕ dismiss - never navigates. */
  function PersonProfileModal({
    p,
    web,
    clicked,
    onClick,
    onClose,
    hideAction
  }) {
    const first = p.name.split(" ")[0];
    useEffectM(() => {
      const k = e => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", k);
      return () => window.removeEventListener("keydown", k);
    }, [onClose]);
    const intents = (p.intent || "").split("·").join(",").split(",").map(s => s.trim()).filter(Boolean);
    /* map interest tags → warm-graded Cover scenes so the gallery reads as real lifestyle photos */
    const TAGCAT = {
      Ceramics: "ceramics",
      Pottery: "ceramics",
      Glass: "art",
      Design: "art",
      Film: "art",
      "Natural wine": "wine",
      Wine: "wine",
      Cocktails: "wine",
      Vinyl: "music",
      "Live music": "music",
      Cooking: "cooking",
      Pasta: "cooking",
      Coffee: "cooking",
      "Run clubs": "run",
      Running: "run",
      Cycling: "run",
      Hiking: "run",
      Plants: "wellness",
      Markets: "wellness",
      Books: "art"
    };
    const photoCats = [...new Set((p.tags || []).map(t => TAGCAT[t]).filter(Boolean))].slice(0, 3);
    while (photoCats.length < 3) photoCats.push(["wine", "ceramics", "cooking"][photoCats.length]);
    const Venn = ({
      s = 16
    }) => /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 1,
        flex: "none",
        display: "inline-flex"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: s,
      height: s,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--purple-500)",
      strokeWidth: "1.8",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "12",
      r: "6"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "15",
      cy: "12",
      r: "6"
    })));
    return /*#__PURE__*/React.createElement("div", {
      onClick: onClose,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "color-mix(in srgb,var(--ink) 44%,transparent)",
        display: "flex",
        alignItems: web ? "center" : "stretch",
        justifyContent: "center",
        padding: web ? 24 : 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation(),
      role: "dialog",
      "aria-modal": "true",
      style: {
        position: "relative",
        width: "100%",
        maxWidth: web ? 580 : "none",
        maxHeight: web ? "85vh" : "none",
        height: web ? "auto" : "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        borderRadius: web ? "var(--radius-2xl)" : 0,
        boxShadow: web ? "var(--shadow-xl)" : "none",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      "aria-label": "Close",
      style: {
        position: "absolute",
        top: 14,
        right: 16,
        zIndex: 2,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(IconM, {
      name: "x",
      size: 18,
      w: 2.2,
      color: "var(--text-muted)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: "auto",
        padding: web ? "28px 30px 24px" : "22px 22px 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 18,
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 80,
        height: 80,
        borderRadius: "50%",
        overflow: "hidden",
        flex: "none",
        boxShadow: "0 0 0 3px var(--white), 0 0 0 4px var(--lavender-300)"
      }
    }, /*#__PURE__*/React.createElement(CoverM, {
      category: photoCats[0],
      h: 80,
      photo: `${first} - warm portrait`,
      tone: "warm"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h1)",
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        color: "var(--ink)",
        letterSpacing: "-.02em",
        lineHeight: 1.2
      }
    }, first, " \xB7 ", p.age), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        color: "var(--text-muted)",
        fontWeight: 500,
        marginTop: 7
      }
    }, /*#__PURE__*/React.createElement(IconM, {
      name: "pin",
      size: 14,
      w: 1.9,
      color: "var(--text-muted)"
    }), p.suburb ? p.suburb + " · " : "", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--purple-600)",
        fontWeight: 600
      }
    }, "been to ", p.been, " Click events")))), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "#EDE9F2",
        margin: "0 0 20px"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--lavender-wash)",
        borderRadius: "var(--radius-lg)",
        padding: "15px 17px",
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 9
      }
    }, "Why you're seeing ", first), (() => {
      const cm = window.CK.commonality(p, false);
      if (cm) {
        const g = cm.icon === "pin" ? /*#__PURE__*/React.createElement(IconM, {
          name: "pin",
          size: 15,
          w: 1.9,
          color: "var(--purple-500)",
          style: {
            marginTop: 2,
            flex: "none"
          }
        }) : cm.icon === "music" ? /*#__PURE__*/React.createElement(IconM, {
          name: "music",
          size: 15,
          w: 1.9,
          color: "var(--purple-500)",
          style: {
            marginTop: 2,
            flex: "none"
          }
        }) : /*#__PURE__*/React.createElement(Venn, null);
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 14,
            color: "var(--text-body)",
            lineHeight: 1.5
          }
        }, g, /*#__PURE__*/React.createElement("span", null, cm.lead, /*#__PURE__*/React.createElement("b", {
          style: {
            color: "var(--text-strong)"
          }
        }, cm.term), "."));
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          fontSize: 14,
          color: "var(--text-body)",
          lineHeight: 1.5
        }
      }, /*#__PURE__*/React.createElement(Venn, null), /*#__PURE__*/React.createElement("span", null, "You're both here for similar things."));
    })()), p.bio && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 16px",
        fontSize: 15,
        lineHeight: 1.6,
        color: "var(--text-body)"
      }
    }, p.bio), p.prompt && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 20,
        paddingLeft: 14,
        borderLeft: "2px solid var(--lavender-300)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--text-muted)",
        marginBottom: 3
      }
    }, p.prompt.q), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        color: "var(--text-strong)",
        lineHeight: 1.5
      }
    }, p.prompt.a)), intents.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-600)",
        marginBottom: 10
      }
    }, "Here for"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 22
      }
    }, intents.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      style: {
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 13px",
        fontSize: 13,
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        background: "var(--lavender-wash)",
        border: "1px solid var(--lavender-300)",
        color: "var(--ink)",
        whiteSpace: "nowrap"
      }
    }, t.charAt(0).toUpperCase() + t.slice(1))))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-600)",
        marginBottom: 10
      }
    }, "Into"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7,
        marginBottom: 22
      }
    }, p.tags.map(t => /*#__PURE__*/React.createElement(Chip, {
      key: t
    }, t))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-600)",
        marginBottom: 10
      }
    }, "Photos"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        marginBottom: 4,
        flexWrap: "wrap"
      }
    }, photoCats.map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        width: 88,
        height: 88,
        flex: "none",
        borderRadius: "var(--radius-md)",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement(CoverM, {
      category: c,
      h: 88,
      photo: `${first} - ${c}`,
      tone: ["bright", "cool", "dusk"][i % 3]
    }))))), !hideAction && /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        padding: web ? "14px 30px 18px" : "12px 22px 18px",
        borderTop: "1px solid var(--border-soft)",
        background: "var(--white)"
      }
    }, p.mutual ? /*#__PURE__*/React.createElement(ClickBtnM, {
      state: "mutual",
      full: true,
      size: "lg"
    }) : clicked ? /*#__PURE__*/React.createElement(ClickBtnM, {
      state: "pending",
      full: true,
      size: "lg"
    }) : /*#__PURE__*/React.createElement(BtnM, {
      full: true,
      size: "lg",
      onClick: onClick
    }, `click with ${first}`), clicked && !p.mutual && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "10px 0 0",
        fontSize: 12.5,
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(IconM, {
      name: "lock",
      size: 14,
      w: 1.9,
      color: "var(--text-muted)"
    }), "Clicking is anonymous - we'll only show you if it's mutual."))));
  }

  /* ---------------- E · YOUR CLICKS - the hub, grouped by state (not a queue) ---------------- */
  function ClicksTab({
    web,
    route,
    onHow,
    open
  }) {
    const CL = window.DATA.CLICKS;
    const live = CL.filter(c => c.state === "mutual");
    const plans = CL.filter(c => c.state === "plan");
    const past = CL.filter(c => c.state === "connected" || c.state === "released");
    const connectedPast = past.filter(c => c.state === "connected");
    const releasedPast = past.filter(c => c.state === "released");
    const Group = ({
      title,
      hint,
      sub,
      children
    }) => /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 30
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: sub ? 4 : 12
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.014375rem, 0.953rem + 0.26cqi, 1.15rem)",
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title), hint && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-faint)",
        fontWeight: 500
      }
    }, hint)), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 14px",
        fontSize: 13.5,
        color: "var(--text-muted)",
        fontWeight: 500,
        lineHeight: 1.5
      }
    }, sub), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, children));
    const Row = ({
      c
    }) => {
      const released = c.state === "released";
      const fn = released ? "Someone from " + c.suburb : c.name.split(" ")[0];
      const common = (c.tags || []).slice(0, 2);
      /* ONE card, ONE earned accent: a soft --lavender-wash FILL on YOUR-MOVE cards only (open / their-proposal / save-your-spot) so they read at a glance; waiting, Plans, and past = the clean neutral white card (the section header carries their state). One emphasis mechanism - no left-rule. Low-chroma wash, never a full-strength fill; all card content stays as-is (Slate on wash = 4.74:1, AA). */
      /* coord_state status line is YOUR move (deep-purple) or a calm honest wait (slate) - never a verdict/passive pile.
         OPEN is ALWAYS actionable (no dormant): a system suggestion fills it when available, else a quiet prompt - never empty/hanging. */
      const sug = c.suggestion;
      const CO = {
        open: sug ? {
          a: "Suggest it →",
          s: `We think you'd both like ${sug.name}`,
          when: sug.when,
          suggest: 1
        } : {
          a: "Suggest a plan →",
          s: "Pick something you'd both enjoy",
          muted: 1
        },
        their_turn: {
          a: "See their plan →",
          s: `${fn} suggested ${c.event}`,
          when: c.when,
          mine: 1
        },
        yoursave: {
          a: "Save your spot →",
          s: `${fn}'s in - save your spot`,
          mine: 1
        },
        proposed_waiting: {
          a: `Waiting on ${fn}`,
          waiting: 1
        }
      };
      const co = c.state === "mutual" ? CO[c.coord] || CO.open : null;
      const action = co ? {
        label: co.a,
        variant: co.variant || "primary",
        waiting: co.waiting
      } : c.state === "plan" ? {
        label: "See the plan →",
        variant: "secondary"
      } : c.state === "connected" ? {
        label: "We clicked 👍",
        variant: "secondary"
      } : null;
      const yourMove = !!co && !co.waiting;
      const actionEl = action ? action.waiting ? /*#__PURE__*/React.createElement("button", {
        onClick: () => route(c),
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 36,
          padding: "0 14px",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--surface-tint)",
          color: "var(--text-muted)",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          width: web ? "auto" : "100%"
        }
      }, /*#__PURE__*/React.createElement(IconM, {
        name: "clock",
        size: 14,
        w: 1.9,
        color: "var(--text-muted)"
      }), action.label) : /*#__PURE__*/React.createElement(BtnM, {
        size: "sm",
        variant: action.variant,
        full: !web,
        onClick: () => route(c)
      }, action.label) : null;
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: web ? "row" : "column",
          alignItems: web ? "center" : "stretch",
          gap: web ? 18 : 12,
          background: yourMove ? "var(--lavender-wash)" : "var(--white)",
          border: "1px solid " + (yourMove ? "var(--lavender-300)" : "var(--border-soft)"),
          borderRadius: "var(--radius-xl)",
          padding: web ? "16px 20px" : "14px 16px",
          boxShadow: released ? "none" : "var(--shadow-sm)",
          opacity: released ? .7 : 1
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: web ? "center" : "flex-start",
          gap: web ? 18 : 13,
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement(AvatarM, {
        name: released ? "·" : c.name,
        size: 52
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 7
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: "var(--font-display)",
          fontSize: web ? 17.5 : 16,
          fontWeight: 600,
          color: "var(--text-strong)",
          lineHeight: 1.2
        }
      }, fn), !released && c.intent && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          fontWeight: 500,
          lineHeight: 1.3
        }
      }, `You're both here for ${c.intent}${c.dating ? " · both open to dating" : ""}`)), released && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.45
        }
      }, "Still out there - if you cross paths again, you can pick it back up."), co && co.s && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 2
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 14,
          fontWeight: 600,
          color: co.muted ? "var(--text-muted)" : co.mine ? "var(--purple-700)" : "var(--text-strong)"
        }
      }, co.suggest ? /*#__PURE__*/React.createElement(IconM, {
        name: "calendar",
        size: 13,
        w: 1.9,
        color: "var(--purple-500)",
        style: {
          flex: "none"
        }
      }) : null, co.s, co.when ? ` · ${co.when}` : ""), co.sub && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11.5,
          color: "var(--text-muted)"
        }
      }, co.sub)), c.state === "mutual" && /*#__PURE__*/React.createElement(CommonalityLineM, {
        p: c,
        postMutual: true
      }), c.state === "mutual" && common.length > 0 && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6
        }
      }, common.map(t => /*#__PURE__*/React.createElement(TagM, {
        key: t,
        dense: true
      }, t))), c.state === "plan" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-strong)",
          lineHeight: 1.4,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement(IconM, {
        name: "calendar",
        size: 14,
        w: 1.9,
        color: "var(--purple-500)",
        style: {
          flex: "none"
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, "You're both going to ", c.event, " ", /*#__PURE__*/React.createElement("span", {
        "aria-hidden": "true"
      }, "\uD83C\uDF89"))), c.state === "connected" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 13.5,
          color: "var(--text-body)",
          lineHeight: 1.4,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement(IconM, {
        name: "check",
        size: 14,
        w: 2,
        color: "var(--sage)",
        style: {
          flex: "none"
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, c.plan ? `You went to ${c.plan} together · ${c.when}` : `You clicked at ${c.event} · ${c.when}`)))), actionEl && /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: web ? "flex-end" : "stretch"
        }
      }, actionEl));
    };
    const empty = live.length + plans.length + past.length === 0;
    const pool = window.DATA.CLICK_SUGGEST;
    const [clicked, setClicked] = useStateM(() => new Set());
    const [viewing, setViewing] = useStateM(null);
    const [showReleased, setShowReleased] = useStateM(false);
    const isClicked = p => clicked.has(p.name);
    const doClick = p => setClicked(s => new Set(s).add(p.name));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: web ? "8px 0 40px" : "0 0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 1060 : "none",
        margin: "0 auto",
        padding: web ? "0 40px" : "0 22px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 720 : "none"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "6px 0 0",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1.25,
        color: "var(--text-strong)"
      }
    }, "click with someone"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "8px 0 30px",
        fontSize: 14,
        color: "var(--text-muted)",
        lineHeight: 1.55,
        fontWeight: 500
      }
    }, onHow && /*#__PURE__*/React.createElement("span", {
      onClick: onHow,
      style: {
        color: "var(--purple-600)",
        fontWeight: 600,
        cursor: "pointer",
        borderBottom: "1px solid color-mix(in srgb,var(--purple-600) 30%,transparent)"
      }
    }, "How clicking works \u2192")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.071875rem, 0.991rem + 0.35cqi, 1.25rem)",
        fontWeight: 600,
        lineHeight: 1.4,
        color: "var(--text-strong)"
      }
    }, "3 people you might click with today")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 12px",
        fontSize: 14,
        color: "var(--text-body)",
        lineHeight: 1.5,
        fontWeight: 500
      }
    }, "Three new people, every day."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 18px",
        fontSize: 13,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(IconM, {
      name: "lock",
      size: 14,
      w: 1.9,
      color: "var(--text-muted)"
    }), "Clicking is anonymous - we'll only show you if it's mutual."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, web ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, pool.map((p, i) => /*#__PURE__*/React.createElement(PersonClickCard, {
      key: i,
      p: p,
      web: true,
      row: true,
      clicked: isClicked(p),
      onClick: () => doClick(p),
      onView: () => setViewing(p)
    }))) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 13
      }
    }, pool.map((p, i) => /*#__PURE__*/React.createElement(PersonClickCard, {
      key: i,
      p: p,
      clicked: isClicked(p),
      onClick: () => doClick(p),
      onView: () => setViewing(p)
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "var(--border-soft)",
        margin: "0 0 26px"
      }
    }), /*#__PURE__*/React.createElement("div", {
      id: "click-radar",
      style: {
        margin: "0 0 13px",
        scrollMarginTop: 16
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: "0 0 4px",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.071875rem, 0.991rem + 0.35cqi, 1.25rem)",
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: "-.01em",
        color: "var(--text-strong)"
      }
    }, "click radar"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        color: "var(--text-muted)",
        fontWeight: 500,
        lineHeight: 1.5
      }
    }, "People like you are showing up to these.")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 32
      }
    }, window.ScreensDash.Radar({
      web,
      open: open || (() => {})
    })), /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: "0 0 18px",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.108125rem, 1.021rem + 0.37cqi, 1.3rem)",
        fontWeight: 600,
        letterSpacing: "-.01em",
        color: "var(--text-strong)"
      }
    }, "Your clicks"), empty ? /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-tint)",
        borderRadius: "var(--radius-xl)",
        padding: "40px 26px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(SparkM, {
      size: 32
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, "No clicks yet - your next event is where it happens.")) : /*#__PURE__*/React.createElement(React.Fragment, null, live.length > 0 && /*#__PURE__*/React.createElement(Group, {
      title: "Live mutuals",
      sub: "You both clicked. Now plan something you'd both enjoy."
    }, live.map(c => /*#__PURE__*/React.createElement(Row, {
      key: c.id,
      c: c
    }))), plans.length > 0 && /*#__PURE__*/React.createElement(Group, {
      title: "Plans",
      hint: "you're both going"
    }, plans.map(c => /*#__PURE__*/React.createElement(Row, {
      key: c.id,
      c: c
    }))), (connectedPast.length > 0 || releasedPast.length > 0) && /*#__PURE__*/React.createElement(Group, {
      title: "Past clicks",
      hint: ""
    }, connectedPast.map(c => /*#__PURE__*/React.createElement(Row, {
      key: c.id,
      c: c
    })), releasedPast.length > 0 && (showReleased ? releasedPast.map(c => /*#__PURE__*/React.createElement(Row, {
      key: c.id,
      c: c
    })) : /*#__PURE__*/React.createElement("button", {
      onClick: () => setShowReleased(true),
      style: {
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "2px 2px",
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(IconM, {
      name: "plus",
      size: 15,
      w: 2.2,
      color: "var(--text-muted)"
    }), releasedPast.length, " past click", releasedPast.length > 1 ? "s" : "")))))), viewing && /*#__PURE__*/React.createElement(PersonProfileModal, {
      p: viewing,
      web: web,
      clicked: isClicked(viewing),
      onClick: () => doClick(viewing),
      onClose: () => setViewing(null)
    }));
  }
  window.ScreensB = {
    ClicksTab,
    PersonProfileModal
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/mechanic-screens.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/merchant-create.jsx
try { (() => {
(function () {
  /* Click - Merchant event creation wizard. 4 steps: Basics → When & where → Tickets → Review.
     window.ScreensMerchCreate = { CreateEvent }. Uses CK primitives; Click design system. */
  const {
    useState: uS,
    Icon: I,
    Btn,
    Field,
    Tag,
    Badge,
    Toggle,
    Spark: SP
  } = window.CK;
  const card = {
    background: "var(--white)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-sm)"
  };
  const tint = {
    background: "var(--lavender-100)",
    border: "1px solid var(--lavender-200)",
    borderRadius: "var(--radius-lg)"
  };
  const CATS = ["Fitness", "Food", "Creative", "Social", "Games", "Wellness", "Outdoors", "Learning", "Nightlife", "Sports"];
  const VENUES = ["Studio 44 · Marrickville", "Bay Run · Rozelle", "Callan Park · Lilyfield", "+ New venue"];
  function Label({
    children
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, children);
  }
  function Seg({
    value,
    onChange,
    options
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)",
        padding: 3,
        gap: 2,
        alignSelf: "flex-start"
      }
    }, options.map(([k, label]) => {
      const on = value === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => onChange(k),
        style: {
          border: "none",
          cursor: "pointer",
          borderRadius: "var(--radius-pill)",
          padding: "7px 15px",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: on ? 700 : 500,
          background: on ? "var(--purple-600)" : "transparent",
          color: on ? "var(--cream)" : "var(--text-body)",
          transition: "background .15s"
        }
      }, label);
    }));
  }
  function Stepper({
    value,
    onChange,
    min = 1,
    max = 200
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        border: "1.5px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)",
        background: "var(--white)",
        alignSelf: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => onChange(Math.max(min, value - 1)),
      "aria-label": "Decrease",
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--purple-600)",
        fontSize: 20,
        fontWeight: 600
      }
    }, "\u2212"), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 44,
        textAlign: "center",
        fontFamily: "var(--font-display)",
        fontSize: 16.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, value), /*#__PURE__*/React.createElement("button", {
      onClick: () => onChange(Math.min(max, value + 1)),
      "aria-label": "Increase",
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--purple-600)",
        fontSize: 20,
        fontWeight: 600
      }
    }, "+"));
  }
  function Panel({
    title,
    sub,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        padding: "clamp(17px,3vw,28px)",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 20,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, sub)), children);
  }
  function Select({
    label,
    value,
    onChange,
    options,
    hint
  }) {
    return /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(Label, null, label), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement("select", {
      value: value,
      onChange: e => onChange(e.target.value),
      style: {
        appearance: "none",
        WebkitAppearance: "none",
        width: "100%",
        height: 50,
        padding: "0 40px 0 14px",
        background: "var(--white)",
        border: "1.5px solid var(--border-mid)",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        color: "var(--text-strong)",
        cursor: "pointer"
      }
    }, options.map(o => /*#__PURE__*/React.createElement("option", {
      key: o,
      value: o
    }, o))), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        right: 14,
        top: "50%",
        transform: "translateY(-50%)",
        pointerEvents: "none",
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "chevD",
      size: 16,
      color: "var(--text-muted)"
    }))), hint && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.4
      }
    }, hint));
  }
  function CreateEvent({
    web,
    done,
    cancel
  }) {
    const [step, setStep] = uS(0);
    const [name, setName] = uS("");
    const [cat, setCat] = uS("Fitness");
    const [desc, setDesc] = uS("");
    const [venue, setVenue] = uS(VENUES[0]);
    const [repeat, setRepeat] = uS("once");
    const [cap, setCap] = uS(12);
    const [priced, setPriced] = uS("free");
    const [price, setPrice] = uS("28");
    const [waitlist, setWaitlist] = uS(true);
    const [visibility, setVisibility] = uS("public");
    const [published, setPublished] = uS(false);
    const steps = ["Basics", "When & where", "Tickets", "Review"];
    const evName = name.trim() || "Beginner boxing";
    if (published) return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 560,
        margin: "0 auto",
        padding: web ? "56px 24px" : "36px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center"
      },
      "data-screen-label": "Merchant \xB7 Event published"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(SP, {
      size: 28,
      big: "var(--purple-600)",
      small: "var(--purple-400)"
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: web ? 30 : 24,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, evName, " is live."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.55,
        maxWidth: 420
      }
    }, "It's on Discover now. We'll email you as bookings come in - the door list lives in Bookings."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      onClick: done
    }, "Back to dashboard"), /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      icon: "share"
    }, "Share event link")));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 720,
        margin: "0 auto",
        padding: web ? "28px 24px 56px" : "18px 16px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 18
      },
      "data-screen-label": "Merchant \xB7 Create event"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
      tone: "lavender"
    }, "Create event")), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: web ? 32 : 25,
        fontWeight: 600,
        color: "var(--text-strong)",
        letterSpacing: "-.01em"
      }
    }, "What are you hosting?"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, "Four quick steps - you can save a draft and finish later.")), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "ghost",
      onClick: cancel
    }, "Cancel")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, steps.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: s
    }, i > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1.5,
        background: i <= step ? "var(--purple-400)" : "var(--border-mid)"
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => i < step && setStep(i),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: "none",
        background: "none",
        padding: 0,
        cursor: i < step ? "pointer" : "default"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        background: i < step ? "var(--sage)" : i === step ? "var(--purple-600)" : "var(--white)",
        color: i <= step ? "#fff" : "var(--text-muted)",
        border: i > step ? "1.5px solid var(--border-mid)" : "none"
      }
    }, i < step ? /*#__PURE__*/React.createElement(I, {
      name: "check",
      size: 12,
      w: 2.8,
      color: "#fff"
    }) : i + 1), web && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: i === step ? "var(--purple-700)" : "var(--text-faint)"
      }
    }, s))))), step === 0 && /*#__PURE__*/React.createElement(Panel, {
      title: "The basics",
      sub: "Name it the way you'd say it out loud - attendees see this on Discover."
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Event name *",
      placeholder: "e.g. Beginner boxing",
      value: name,
      onChange: setName
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Label, null, "Category *"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7
      }
    }, CATS.map(c => /*#__PURE__*/React.createElement(Tag, {
      key: c,
      selected: cat === c,
      onClick: () => setCat(c),
      style: {
        height: 30,
        padding: "0 13px",
        fontSize: 12.5
      }
    }, c)))), /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(Label, null, "Description *"), /*#__PURE__*/React.createElement("textarea", {
      value: desc,
      onChange: e => setDesc(e.target.value),
      placeholder: "What happens, who it's for, what to bring. Keep it warm - this is the icebreaker.",
      rows: 4,
      style: {
        resize: "vertical",
        padding: "12px 14px",
        background: "var(--white)",
        border: "1.5px solid var(--border-mid)",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        color: "var(--text-strong)",
        lineHeight: 1.5,
        outline: "none"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, "Tip: events that say \"no experience needed\" fill ~2\xD7 faster.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Label, null, "Cover photo"), /*#__PURE__*/React.createElement("div", {
      style: {
        border: "1.5px dashed var(--border-mid)",
        borderRadius: "var(--radius-lg)",
        padding: "24px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "camera",
      size: 22,
      w: 1.9,
      color: "var(--purple-600)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Drop a photo here or browse"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, "Real photos of your space fill events faster than stock. JPG or PNG \xB7 up to 10 MB.")))), step === 1 && /*#__PURE__*/React.createElement(Panel, {
      title: "When & where",
      sub: "Attendees see the suburb up front; the exact address unlocks after they book."
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "1fr 1fr" : "1fr",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Date *",
      placeholder: "Sat 18 Jul 2026",
      icon: "calendar"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Starts *",
      placeholder: "9:00 am",
      icon: "clock"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Ends *",
      placeholder: "10:30 am",
      icon: "clock"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Label, null, "Repeats"), /*#__PURE__*/React.createElement(Seg, {
      value: repeat,
      onChange: setRepeat,
      options: [["once", "One-off"], ["weekly", "Weekly"], ["fortnightly", "Fortnightly"]]
    }), repeat !== "once" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, "We'll create the next 8 dates - each one takes bookings separately.")), /*#__PURE__*/React.createElement(Select, {
      label: "Venue *",
      value: venue,
      onChange: setVenue,
      options: VENUES,
      hint: "Saved venues autofill the address and directions."
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: "12px 15px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "lock",
      size: 16,
      w: 2,
      color: "var(--purple-600)",
      style: {
        marginTop: 1
      }
    }), /*#__PURE__*/React.createElement("span", null, "Address privacy: Discover shows \"", venue.split(" · ")[1] || "Marrickville", "\" only. Booked attendees get the full address and arrival notes."))), step === 2 && /*#__PURE__*/React.createElement(Panel, {
      title: "Tickets & capacity",
      sub: "Small caps make better icebreakers - most hosts run 8 to 16 spots."
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Label, null, "Capacity *"), /*#__PURE__*/React.createElement(Stepper, {
      value: cap,
      onChange: setCap
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Label, null, "Pricing *"), /*#__PURE__*/React.createElement(Seg, {
      value: priced,
      onChange: setPriced,
      options: [["free", "Free"], ["paid", "Paid"]]
    }), priced === "paid" ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "180px 1fr" : "1fr",
        gap: 14,
        alignItems: "start"
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Price per spot (AUD)",
      placeholder: "28",
      value: price,
      onChange: setPrice
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: "12px 15px",
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5,
        alignSelf: "end"
      }
    }, "Paid bookings route via Stripe. You keep ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 600,
        color: "var(--purple-700)"
      }
    }, "$", (Math.max(0, parseFloat(price) || 0) * 0.95).toFixed(2)), " per spot after the 5% platform fee - paid out monthly.")) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, "Free events skip Stripe entirely - no payment setup needed.")), /*#__PURE__*/React.createElement(Toggle, {
      checked: waitlist,
      onChange: setWaitlist,
      label: "Waitlist when full",
      helper: "If someone cancels, the first person on the waitlist gets 30 minutes to claim the spot."
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Label, null, "Visibility"), /*#__PURE__*/React.createElement(Seg, {
      value: visibility,
      onChange: setVisibility,
      options: [["public", "On Discover"], ["link", "Link only"]]
    }), visibility === "link" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, "Hidden from Discover - only people with the link can book. Handy for comp guests and private groups."))), step === 3 && /*#__PURE__*/React.createElement(Panel, {
      title: "Review & publish",
      sub: "Here's how it lands on Discover - tap any row to jump back and edit."
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        overflow: "hidden",
        boxShadow: "none"
      }
    }, [["Event", `${evName} · ${cat}`, 0], ["Description", desc.trim() || "Add a description before publishing", 0], ["When", "Sat 18 Jul · 9:00-10:30 am" + (repeat !== "once" ? ` · repeats ${repeat}` : ""), 1], ["Where", venue, 1], ["Capacity", `${cap} spots · waitlist ${waitlist ? "on" : "off"}`, 2], ["Price", priced === "paid" ? `$${price} per spot` : "Free", 2], ["Visibility", visibility === "public" ? "Listed on Discover" : "Link only", 2]].map(([k, v, go], i, arr) => /*#__PURE__*/React.createElement("button", {
      key: k,
      onClick: () => setStep(go),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "13px 17px",
        borderBottom: i < arr.length - 1 ? "1px solid var(--border-soft)" : "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: web ? 110 : 84,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, k), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 13.5,
        color: "var(--text-strong)",
        lineHeight: 1.45
      }
    }, v), /*#__PURE__*/React.createElement(I, {
      name: "chevR",
      size: 15,
      w: 2,
      color: "var(--text-faint)"
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: "12px 15px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(SP, {
      size: 15,
      big: "var(--purple-600)",
      small: "var(--purple-400)"
    }), /*#__PURE__*/React.createElement("span", null, "Once live, attendees can book instantly. Cancelling later refunds everyone automatically and notifies them."))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: () => step > 0 && setStep(step - 1),
      style: {
        visibility: step > 0 ? "visible" : "hidden"
      }
    }, "Back"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Step ", step + 1, " of 4 \xB7 ", steps[step]), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 9
      }
    }, step < 3 && /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      onClick: done
    }, "Save draft"), step < 3 ? /*#__PURE__*/React.createElement(Btn, {
      onClick: () => setStep(step + 1)
    }, "Next") : /*#__PURE__*/React.createElement(Btn, {
      onClick: () => setPublished(true)
    }, "Publish event"))));
  }
  window.ScreensMerchCreate = {
    CreateEvent
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/merchant-create.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/merchant.jsx
try { (() => {
(function () {
  /* Click - Merchant portal (host business console). Feature parity with the live portal
     (dashboard, events & venues, bookings + check-in, finances/payouts, settings, apply flow),
     recast in the Click design system. Exports window.ScreensMerch = { Portal, Apply }. */
  const {
    useState: uS,
    Icon: I,
    Btn,
    Field,
    Tag,
    Badge,
    Avatar: AV,
    Spark: SP
  } = window.CK;

  /* ---------------- mock data ---------------- */
  const BIZ = {
    name: "Inner West Fitness Mates",
    abn: "51 824 753 556",
    email: "hello@iwfm.au"
  };
  const MEV = [{
    id: "m1",
    name: "Sunrise run club",
    venue: "Bay Run",
    suburb: "Rozelle",
    when: "Wed 15 Jul · 6:30 am",
    day: 15,
    confirmed: 14,
    cap: 20,
    wait: 0,
    status: "live",
    price: 0
  }, {
    id: "m2",
    name: "Beginner boxing",
    venue: "Studio 44",
    suburb: "Marrickville",
    when: "Sat 18 Jul · 9:00 am",
    day: 18,
    confirmed: 11,
    cap: 12,
    wait: 3,
    status: "live",
    price: 28
  }, {
    id: "m3",
    name: "Mobility & stretch",
    venue: "Studio 44",
    suburb: "Marrickville",
    when: "Tue 22 Jul · 6:00 pm",
    day: 22,
    confirmed: 4,
    cap: 16,
    wait: 0,
    status: "live",
    price: 18
  }, {
    id: "m4",
    name: "Sunset trail jog",
    venue: "Callan Park",
    suburb: "Lilyfield",
    when: "Wed 8 Jul · 5:30 pm",
    day: 8,
    confirmed: 9,
    cap: 12,
    wait: 0,
    status: "ended",
    price: 0
  }, {
    id: "m5",
    name: "Boxing fundamentals",
    venue: "Studio 44",
    suburb: "Marrickville",
    when: "Sat 4 Jul · 9:00 am",
    day: 4,
    confirmed: 12,
    cap: 12,
    wait: 2,
    status: "ended",
    price: 28
  }];
  const VENUES = [{
    name: "Studio 44",
    suburb: "Marrickville",
    events: 3
  }, {
    name: "Bay Run",
    suburb: "Rozelle",
    events: 1
  }, {
    name: "Callan Park",
    suburb: "Lilyfield",
    events: 1
  }];
  const ATT = [{
    name: "Mia Rossi",
    email: "mia.rossi@gmail.com",
    ev: "m2",
    status: "confirmed",
    rsvp: "12 Jul, 7:15 pm"
  }, {
    name: "Tom Becker",
    email: "tom.becker@hotmail.com",
    ev: "m2",
    status: "confirmed",
    rsvp: "11 Jul, 5:02 pm"
  }, {
    name: "Priya Nair",
    email: "priya.n@gmail.com",
    ev: "m2",
    status: "waitlist",
    rsvp: "13 Jul, 12:59 pm"
  }, {
    name: "Jordan Lee",
    email: "jordan.lee@gmail.com",
    ev: "m1",
    status: "confirmed",
    rsvp: "10 Jul, 11:29 am"
  }, {
    name: "Ellen Park",
    email: "ellen.park@gmail.com",
    ev: "m1",
    status: "cancelled",
    rsvp: "8 Jul, 11:23 am"
  }, {
    name: "Sam Okafor",
    email: "sam.okafor@gmail.com",
    ev: "m3",
    status: "confirmed",
    rsvp: "9 Jul, 4:56 pm"
  }, {
    name: "Ruby Tran",
    email: "ruby.tran@gmail.com",
    ev: "m4",
    status: "confirmed",
    rsvp: "7 Jul, 9:40 am"
  }, {
    name: "Leo Marchetti",
    email: "leo.m@gmail.com",
    ev: "m5",
    status: "confirmed",
    rsvp: "3 Jul, 6:12 pm"
  }];
  const PAYOUTS = [{
    date: "30 Jun 2026",
    amount: "$612.40",
    status: "Paid"
  }, {
    date: "31 May 2026",
    amount: "$488.00",
    status: "Paid"
  }];
  const TXNS = [{
    who: "Mia Rossi",
    ev: "Beginner boxing",
    date: "12 Jul",
    amount: "$28.00",
    status: "Paid"
  }, {
    who: "Tom Becker",
    ev: "Beginner boxing",
    date: "11 Jul",
    amount: "$28.00",
    status: "Paid"
  }, {
    who: "Sam Okafor",
    ev: "Mobility & stretch",
    date: "9 Jul",
    amount: "$18.00",
    status: "Paid"
  }, {
    who: "Ellen Park",
    ev: "Sunrise run club",
    date: "8 Jul",
    amount: "$0.00",
    status: "Refunded"
  }];
  const REV6 = [["Feb", 210], ["Mar", 336], ["Apr", 302], ["May", 488], ["Jun", 612], ["Jul", 434]];
  const evName = id => {
    const e = MEV.find(x => x.id === id);
    return e ? e.name : "";
  };

  /* ---------------- shared bits ---------------- */
  const Eyebrow = ({
    children,
    style = {}
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: ".12em",
      textTransform: "uppercase",
      color: "var(--purple-600)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 1.5,
      background: "var(--purple-400)",
      flex: "none"
    }
  }), children);
  function PageHead({
    eyebrow,
    title,
    sub,
    web,
    action
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, null, eyebrow), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: web ? 30 : 24,
        fontWeight: 600,
        color: "var(--text-strong)",
        letterSpacing: "-.01em",
        lineHeight: 1.15
      }
    }, title), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        color: "var(--text-muted)",
        lineHeight: 1.5,
        maxWidth: 560
      }
    }, sub)), action);
  }
  const card = {
    background: "var(--white)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-sm)"
  };
  const tint = {
    background: "var(--lavender-100)",
    border: "1px solid var(--lavender-200)",
    borderRadius: "var(--radius-lg)"
  };
  function Stat({
    label,
    value,
    note,
    hero
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...(hero ? {
          background: "var(--purple-600)",
          border: "1px solid var(--purple-600)",
          borderRadius: "var(--radius-lg)"
        } : card),
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: hero ? "var(--lavender-300)" : "var(--text-faint)"
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 27,
        fontWeight: 600,
        lineHeight: 1.05,
        color: hero ? "var(--cream)" : "var(--text-strong)"
      }
    }, value), note && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: hero ? "rgba(253,250,246,.75)" : "var(--text-muted)"
      }
    }, note));
  }
  function Meter({
    num,
    den,
    hue = "var(--purple-500)"
  }) {
    const pct = den > 0 ? Math.min(100, Math.round(num / den * 100)) : 0;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 5,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-strong)",
        whiteSpace: "nowrap"
      }
    }, num, " / ", den), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        width: "100%",
        maxWidth: 96,
        height: 5,
        borderRadius: 3,
        background: "var(--lavender-100)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        width: pct + "%",
        height: "100%",
        borderRadius: 3,
        background: hue
      }
    })));
  }
  const STATUS_TONE = {
    live: ["sage", "Live"],
    ended: ["cream", "Ended"],
    pending: ["amber", "Pending"],
    cancelled: ["coral", "Cancelled"],
    confirmed: ["lavender", "Confirmed"],
    waitlist: ["amber", "Waitlist"]
  };
  function StatusPill({
    k
  }) {
    const [tone, label] = STATUS_TONE[k] || ["cream", k];
    return /*#__PURE__*/React.createElement(Badge, {
      tone: tone
    }, label);
  }
  function Chips({
    value,
    onChange,
    options
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "ckRail",
      style: {
        display: "flex",
        gap: 7,
        overflowX: "auto"
      }
    }, options.map(([k, label]) => /*#__PURE__*/React.createElement(Tag, {
      key: k,
      selected: value === k,
      onClick: () => onChange(k),
      style: {
        height: 30,
        padding: "0 13px",
        fontSize: 12.5,
        flex: "none"
      }
    }, label)));
  }
  function Empty({
    icon = "calendar",
    title,
    body,
    cta
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: "30px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 9,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: icon,
      size: 20,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 16.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title), body && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        color: "var(--text-body)",
        lineHeight: 1.5,
        maxWidth: 420
      }
    }, body), cta);
  }

  /* ---------------- portal shell: sidebar (web) / pill rail (mobile) ---------------- */
  const NAVI = [["dash", "Dashboard", "home"], ["events", "Events & venues", "calendar"], ["bookings", "Bookings", "users"], ["finances", "Finances", "ticket"], ["settings", "Settings", "settings"]];
  function SideNav({
    page,
    go,
    web,
    counts,
    createEvent
  }) {
    if (!web) return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: BIZ.name,
      variant: "initials",
      size: 40
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, BIZ.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-600)"
      }
    }, "Merchant portal"))), /*#__PURE__*/React.createElement(Chips, {
      value: page,
      onChange: go,
      options: NAVI.map(([k, l]) => [k, l])
    }));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        flex: "none",
        width: 224,
        alignSelf: "flex-start",
        position: "sticky",
        top: 88,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 6px 12px"
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: BIZ.name,
      variant: "initials",
      size: 38
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, BIZ.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-600)"
      }
    }, "Merchant portal"))), NAVI.map(([k, label, ic]) => {
      const on = page === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => go(k),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 11,
          width: "100%",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          borderRadius: 12,
          padding: "0 12px",
          minHeight: 42,
          background: on ? "var(--purple-600)" : "transparent",
          color: on ? "var(--cream)" : "var(--text-body)",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: on ? 600 : 500,
          transition: "background .13s"
        },
        onMouseEnter: e => {
          if (!on) e.currentTarget.style.background = "var(--surface-tint)";
        },
        onMouseLeave: e => {
          if (!on) e.currentTarget.style.background = "transparent";
        }
      }, /*#__PURE__*/React.createElement(I, {
        name: ic,
        size: 17,
        w: 1.9,
        color: on ? "var(--cream)" : "var(--text-muted)"
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1
        }
      }, label), k === "events" && counts.events > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          flex: "none",
          minWidth: 20,
          height: 20,
          padding: "0 6px",
          borderRadius: 10,
          background: on ? "rgba(253,250,246,.2)" : "var(--lavender-100)",
          color: on ? "var(--cream)" : "var(--purple-700)",
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: "20px",
          textAlign: "center",
          boxSizing: "border-box"
        }
      }, counts.events));
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "var(--border-soft)",
        margin: "8px 4px"
      }
    }), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      full: true,
      icon: "plus",
      onClick: createEvent
    }, "Create event"));
  }

  /* ---------------- setup checklist (dashboard, new merchants) ---------------- */
  function SetupBanner({
    web,
    onConnect
  }) {
    const steps = [["Business approved", true], ["Connect payments", false], ["Create your first event", false]];
    const done = steps.filter(s => s[1]).length;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: web ? "18px 22px" : "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-700)"
      }
    }, /*#__PURE__*/React.createElement(SP, {
      size: 13,
      big: "var(--purple-600)",
      small: "var(--purple-400)"
    }), "Finish setting up \xB7 ", done, "/", steps.length), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Connect payments to start publishing paid events.")), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      onClick: onConnect
    }, "Connect payments")), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        height: 6,
        borderRadius: 3,
        background: "var(--white)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        width: done / steps.length * 100 + "%",
        height: "100%",
        borderRadius: 3,
        background: "var(--purple-500)"
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr",
        gap: 8
      }
    }, steps.map(([label, ok]) => /*#__PURE__*/React.createElement("span", {
      key: label,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--white)",
        borderRadius: "var(--radius-md)",
        padding: "9px 12px",
        fontSize: 13,
        fontWeight: 500,
        color: ok ? "var(--text-strong)" : "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 19,
        height: 19,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: ok ? "var(--sage)" : "var(--lavender-100)"
      }
    }, ok ? /*#__PURE__*/React.createElement(I, {
      name: "check",
      size: 12,
      w: 2.6,
      color: "#fff"
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--purple-400)"
      }
    })), label))));
  }

  /* ---------------- hosting calendar (July 2026, Mon-first) ---------------- */
  function HostCal({
    web,
    events
  }) {
    const cells = [];
    for (let d = 29; d <= 30; d++) cells.push({
      d,
      mute: true
    });
    for (let d = 1; d <= 31; d++) cells.push({
      d
    });
    for (let d = 1; d <= 2; d++) cells.push({
      d,
      mute: true,
      next: true
    });
    const byDay = {};
    events.forEach(e => {
      (byDay[e.day] = byDay[e.day] || []).push(e);
    });
    const booked = events.reduce((s, e) => s + e.confirmed, 0),
      capT = events.reduce((s, e) => s + e.cap, 0);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: web ? "16px 20px" : "14px 16px",
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Hosting calendar"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 20,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "July 2026")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "lavender"
    }, events.length, " events \xB7 ", booked, "/", capT, " booked"), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "ghost",
      icon: "chevL"
    }, " "), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "secondary"
    }, "Today"), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "ghost",
      icon: "chevR"
    }, " "))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7,1fr)",
        borderTop: "1px solid var(--border-soft)"
      }
    }, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        padding: "8px 8px",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".07em",
        textTransform: "uppercase",
        color: "var(--text-faint)",
        background: "var(--surface-tint)",
        borderBottom: "1px solid var(--border-soft)",
        textAlign: web ? "left" : "center"
      }
    }, web ? d : d[0])), cells.map((c, i) => {
      const evs = !c.mute && byDay[c.d] || [];
      const today = !c.mute && c.d === 14;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          minHeight: web ? 76 : 52,
          padding: web ? "7px 8px" : "5px 4px",
          borderBottom: i < cells.length - 7 ? "1px solid var(--border-soft)" : "none",
          borderRight: (i + 1) % 7 ? "1px solid var(--border-soft)" : "none",
          background: c.mute ? "var(--surface-tint)" : "var(--white)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          alignSelf: web ? "flex-start" : "center",
          fontSize: 12,
          fontWeight: 600,
          color: c.mute ? "var(--text-faint)" : "var(--text-body)",
          ...(today ? {
            background: "var(--purple-600)",
            color: "var(--cream)",
            width: 22,
            height: 22,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          } : {})
        }
      }, c.d), evs.map(e => {
        const past = e.status === "ended";
        return web ? /*#__PURE__*/React.createElement("span", {
          key: e.id,
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 1,
            background: past ? "var(--surface-tint)" : "var(--lavender-100)",
            border: "1px solid " + (past ? "var(--border-soft)" : "var(--lavender-200)"),
            borderRadius: 8,
            padding: "4px 7px",
            minWidth: 0
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11.5,
            fontWeight: 600,
            color: past ? "var(--text-muted)" : "var(--purple-800)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }
        }, e.name), /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            color: past ? "var(--text-faint)" : "var(--purple-700)"
          }
        }, e.confirmed, "/", e.cap, past ? " · ended" : "")) : /*#__PURE__*/React.createElement("span", {
          key: e.id,
          style: {
            alignSelf: "center",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: past ? "var(--border-mid)" : "var(--purple-500)"
          }
        });
      }));
    })));
  }

  /* ---------------- page: dashboard ---------------- */
  function MDash({
    web,
    fresh,
    go,
    createEvent
  }) {
    const upcoming = fresh ? [] : MEV.filter(e => e.status === "live");
    const confirmed = (fresh ? MEV.filter(e => e.status === "ended") : MEV).reduce((s, e) => s + e.confirmed, 0);
    const liveCap = upcoming.reduce((s, e) => s + e.cap, 0),
      liveConf = upcoming.reduce((s, e) => s + e.confirmed, 0);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: web ? 26 : 20
      },
      "data-screen-label": "Merchant \xB7 Dashboard"
    }, fresh && /*#__PURE__*/React.createElement(SetupBanner, {
      web: web,
      onConnect: () => go("finances")
    }), /*#__PURE__*/React.createElement(PageHead, {
      web: web,
      eyebrow: "Overview",
      title: "Your hosting dashboard.",
      sub: "Bookings and revenue across all your events, plus the month's calendar below.",
      action: /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        icon: "plus",
        onClick: createEvent
      }, "Create event")
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "July at a glance"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(4,1fr)" : "repeat(2,1fr)",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      hero: true,
      label: "Upcoming",
      value: String(upcoming.length),
      note: fresh ? "none scheduled yet" : "next: Wed 15 Jul"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Confirmed RSVPs",
      value: String(confirmed),
      note: "this month"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Fill rate",
      value: liveCap ? Math.round(liveConf / liveCap * 100) + "%" : "-",
      note: liveCap ? "upcoming events" : "no upcoming events"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Revenue",
      value: fresh ? "$0" : "$434",
      note: fresh ? "free events so far" : "July · paid events"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "Your events"), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "ghost",
      onClick: () => go("events")
    }, "View all events")), upcoming.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
      title: "No upcoming events.",
      body: "Your past events are in the Events tab. Ready for the next one?",
      cta: /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        icon: "plus",
        onClick: createEvent
      }, "Create event")
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr",
        gap: 12
      }
    }, upcoming.map(e => /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        ...card,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 9
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 15.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.25
      }
    }, e.name), /*#__PURE__*/React.createElement(StatusPill, {
      k: e.status
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, e.when, " \xB7 ", e.venue, ", ", e.suburb), /*#__PURE__*/React.createElement(Meter, {
      num: e.confirmed,
      den: e.cap,
      hue: e.confirmed / e.cap > 0.85 ? "var(--coral)" : "var(--purple-500)"
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "Calendar"), /*#__PURE__*/React.createElement(HostCal, {
      web: web,
      events: fresh ? MEV.filter(e => e.status === "ended") : MEV
    })));
  }

  /* ---------------- page: events & venues ---------------- */
  function MEvents({
    web,
    createEvent
  }) {
    const [q, setQ] = uS("");
    const [f, setF] = uS("all");
    const rows = MEV.filter(e => (f === "all" || e.status === f) && e.name.toLowerCase().includes(q.toLowerCase()));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: web ? 26 : 20
      },
      "data-screen-label": "Merchant \xB7 Events & venues"
    }, /*#__PURE__*/React.createElement(PageHead, {
      web: web,
      eyebrow: "My events",
      title: "Events & venues.",
      sub: "Filter by status; open any row to manage attendees, edit, or cancel.",
      action: /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        icon: "plus",
        onClick: createEvent
      }, "Create event")
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: web ? "0 1 280px" : "1 1 100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        height: 40,
        padding: "0 13px",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "search",
      size: 16,
      w: 2,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("input", {
      value: q,
      onChange: e => setQ(e.target.value),
      placeholder: "Search events",
      style: {
        flex: 1,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: "none",
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        color: "var(--text-strong)"
      }
    })), /*#__PURE__*/React.createElement(Chips, {
      value: f,
      onChange: setF,
      options: [["all", "All"], ["live", "Live"], ["pending", "Pending"], ["cancelled", "Cancelled"], ["ended", "Past"]]
    })), web ? /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "2.2fr 1.6fr 1fr .8fr .9fr",
        gap: 14,
        padding: "11px 20px",
        background: "var(--surface-tint)",
        borderBottom: "1px solid var(--border-soft)",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, /*#__PURE__*/React.createElement("span", null, "Event"), /*#__PURE__*/React.createElement("span", null, "When"), /*#__PURE__*/React.createElement("span", null, "Confirmed"), /*#__PURE__*/React.createElement("span", null, "Waitlist"), /*#__PURE__*/React.createElement("span", null, "Status")), rows.map((e, i) => /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        display: "grid",
        gridTemplateColumns: "2.2fr 1.6fr 1fr .8fr .9fr",
        gap: 14,
        alignItems: "center",
        padding: "14px 20px",
        borderBottom: i < rows.length - 1 ? "1px solid var(--border-soft)" : "none",
        cursor: "pointer"
      },
      onMouseEnter: ev => ev.currentTarget.style.background = "var(--surface-tint)",
      onMouseLeave: ev => ev.currentTarget.style.background = "transparent"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        marginTop: 2
      }
    }, e.venue, ", ", e.suburb, " \xB7 ", e.price ? "$" + e.price : "Free")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--text-body)"
      }
    }, e.when), /*#__PURE__*/React.createElement(Meter, {
      num: e.confirmed,
      den: e.cap
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        color: e.wait ? "var(--text-strong)" : "var(--text-faint)",
        fontWeight: e.wait ? 600 : 400
      }
    }, e.wait || "-"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(StatusPill, {
      k: e.status
    })))), rows.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "26px 20px",
        fontSize: 13.5,
        color: "var(--text-muted)"
      }
    }, "No events match - clear the search or filters.")) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, rows.map(e => /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        ...card,
        padding: 15,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, e.name), /*#__PURE__*/React.createElement(StatusPill, {
      k: e.status
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, e.when, " \xB7 ", e.venue, ", ", e.suburb, " \xB7 ", e.price ? "$" + e.price : "Free", e.wait ? ` · ${e.wait} waitlisted` : ""), /*#__PURE__*/React.createElement(Meter, {
      num: e.confirmed,
      den: e.cap
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "Venues"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        color: "var(--text-muted)"
      }
    }, "Distinct venues across your events - capacity and floor plans land with venue management."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr",
        gap: 12
      }
    }, VENUES.map(v => /*#__PURE__*/React.createElement("div", {
      key: v.name,
      style: {
        ...card,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Venue"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, v.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, v.suburb), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
      tone: "lavender"
    }, v.events, " ", v.events === 1 ? "event" : "events")))))));
  }

  /* ---------------- page: bookings ---------------- */
  function MBookings({
    web
  }) {
    const [q, setQ] = uS("");
    const [st, setSt] = uS("all");
    const [evF, setEvF] = uS("all");
    const [checked, setChecked] = uS(() => new Set(["Ruby Tran"]));
    const toggle = n => setChecked(s => {
      const x = new Set(s);
      x.has(n) ? x.delete(n) : x.add(n);
      return x;
    });
    const rows = ATT.filter(a => (st === "all" || a.status === st) && (evF === "all" || a.ev === evF) && (a.name + a.email).toLowerCase().includes(q.toLowerCase()));
    const summary = MEV.map(e => ({
      e,
      c: ATT.filter(a => a.ev === e.id && a.status === "confirmed").length + (e.confirmed - ATT.filter(a => a.ev === e.id && a.status === "confirmed").length),
      w: e.wait,
      x: ATT.filter(a => a.ev === e.id && a.status === "cancelled").length
    }));
    const canCheck = a => {
      const e = MEV.find(x => x.id === a.ev);
      return e && e.status === "ended" === false ? false : true;
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: web ? 26 : 20
      },
      "data-screen-label": "Merchant \xB7 Bookings"
    }, /*#__PURE__*/React.createElement(PageHead, {
      web: web,
      eyebrow: "Bookings",
      title: "Everyone booked across your events.",
      sub: "Per-event counts up top; search, check in, or export the full door list below.",
      action: /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        variant: "secondary",
        icon: "share"
      }, "Export CSV")
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(2,1fr)" : "1fr",
        gap: 10
      }
    }, summary.map(({
      e,
      w,
      x
    }) => /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        ...card,
        padding: "14px 17px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "1 1 150px",
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Event"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 15.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, e.name)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(StatusPill, {
      k: e.status
    }), /*#__PURE__*/React.createElement(Badge, {
      tone: "lavender"
    }, e.confirmed, " confirmed"), w > 0 && /*#__PURE__*/React.createElement(Badge, {
      tone: "amber"
    }, w, " waitlist"), x > 0 && /*#__PURE__*/React.createElement(Badge, {
      tone: "cream"
    }, x, " cancelled"))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "All attendees"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: web ? "0 1 260px" : "1 1 100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        height: 40,
        padding: "0 13px",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "search",
      size: 16,
      w: 2,
      color: "var(--text-muted)"
    }), /*#__PURE__*/React.createElement("input", {
      value: q,
      onChange: e => setQ(e.target.value),
      placeholder: "Search name or email",
      style: {
        flex: 1,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: "none",
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        color: "var(--text-strong)"
      }
    })), /*#__PURE__*/React.createElement(Chips, {
      value: st,
      onChange: setSt,
      options: [["all", "All statuses"], ["confirmed", "Confirmed"], ["waitlist", "Waitlist"], ["cancelled", "Cancelled"]]
    }), web && /*#__PURE__*/React.createElement(Chips, {
      value: evF,
      onChange: setEvF,
      options: [["all", "All events"], ...MEV.map(e => [e.id, e.name])]
    })), web ? /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1.4fr 1.8fr 1.4fr 1fr 1.1fr .9fr",
        gap: 14,
        padding: "11px 20px",
        background: "var(--surface-tint)",
        borderBottom: "1px solid var(--border-soft)",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, /*#__PURE__*/React.createElement("span", null, "Name"), /*#__PURE__*/React.createElement("span", null, "Email"), /*#__PURE__*/React.createElement("span", null, "Event"), /*#__PURE__*/React.createElement("span", null, "Status"), /*#__PURE__*/React.createElement("span", null, "RSVP"), /*#__PURE__*/React.createElement("span", null, "Check-in")), rows.map((a, i) => /*#__PURE__*/React.createElement("div", {
      key: a.name,
      style: {
        display: "grid",
        gridTemplateColumns: "1.4fr 1.8fr 1.4fr 1fr 1.1fr .9fr",
        gap: 14,
        alignItems: "center",
        padding: "12px 20px",
        borderBottom: i < rows.length - 1 ? "1px solid var(--border-soft)" : "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: a.name,
      variant: "initials",
      size: 30
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, a.name)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, a.email), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-body)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, evName(a.ev)), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(StatusPill, {
      k: a.status
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)"
      }
    }, a.rsvp), /*#__PURE__*/React.createElement("span", null, a.status === "confirmed" ? checked.has(a.name) ? /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "mutual",
      onClick: () => toggle(a.name)
    }, "In \u2713") : /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "secondary",
      onClick: () => toggle(a.name)
    }, "Check in") : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-faint)"
      }
    }, "-")))), rows.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "26px 20px",
        fontSize: 13.5,
        color: "var(--text-muted)"
      }
    }, "No attendees match.")) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, rows.map(a => /*#__PURE__*/React.createElement("div", {
      key: a.name,
      style: {
        ...card,
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 11
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: a.name,
      variant: "initials",
      size: 38
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, a.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, evName(a.ev), " \xB7 ", a.rsvp)), a.status === "confirmed" ? checked.has(a.name) ? /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "mutual",
      onClick: () => toggle(a.name)
    }, "In \u2713") : /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "secondary",
      onClick: () => toggle(a.name)
    }, "Check in") : /*#__PURE__*/React.createElement(StatusPill, {
      k: a.status
    }))))));
  }

  /* ---------------- page: finances ---------------- */
  function MFinances({
    web,
    fresh
  }) {
    const max = Math.max(...REV6.map(r => r[1]));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: web ? 26 : 20
      },
      "data-screen-label": "Merchant \xB7 Finances"
    }, /*#__PURE__*/React.createElement(PageHead, {
      web: web,
      eyebrow: "Finances",
      title: "Payouts + revenue.",
      sub: "Paid events route through Stripe; free events never appear here.",
      action: /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        variant: "secondary",
        icon: "share"
      }, "Export CSV")
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        padding: web ? "16px 20px" : 15,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 40,
        height: 40,
        borderRadius: 12,
        background: fresh ? "var(--lavender-100)" : "color-mix(in srgb,var(--sage) 14%,var(--white))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: fresh ? "unlock" : "check",
      size: 19,
      w: 2,
      color: fresh ? "var(--purple-600)" : "var(--sage)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 180
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Payouts"), fresh ? /*#__PURE__*/React.createElement(Badge, {
      tone: "amber"
    }, "Not set up") : /*#__PURE__*/React.createElement(Badge, {
      tone: "sage"
    }, "Connected")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        marginTop: 2
      }
    }, fresh ? "Connect a Stripe account to accept paid bookings and get paid out automatically." : "Stripe pays out monthly to your linked account ending in ··4021.")), fresh ? /*#__PURE__*/React.createElement(Btn, {
      size: "sm"
    }, "Connect Stripe") : /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "ghost"
    }, "Manage in Stripe")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(4,1fr)" : "repeat(2,1fr)",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      hero: true,
      label: "Total",
      value: fresh ? "$0" : "$1,742",
      note: "all time"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Paid out",
      value: fresh ? "$0" : "$1,434",
      note: "to your bank"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Pending",
      value: fresh ? "$0" : "$308",
      note: "next payout \xB7 31 Jul"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Refunded",
      value: fresh ? "$0" : "$56",
      note: "all time"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "1.4fr 1fr" : "1fr",
        gap: 12,
        alignItems: "stretch"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        padding: web ? "16px 20px" : 15,
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Revenue \xB7 last 6 months"), !fresh && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--sage)"
      }
    }, "$2,382 paid")), fresh ? /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, "No paid revenue yet - paid-event sales chart here once Stripe is connected.") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-end",
        gap: web ? 14 : 8,
        height: 110
      }
    }, REV6.map(([m, v]) => /*#__PURE__*/React.createElement("div", {
      key: m,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, "$", v), /*#__PURE__*/React.createElement("span", {
      style: {
        width: "100%",
        maxWidth: 34,
        height: Math.max(6, Math.round(v / max * 66)),
        borderRadius: "6px 6px 3px 3px",
        background: m === "Jul" ? "var(--purple-600)" : "var(--lavender-300)"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: "var(--text-faint)"
      }
    }, m))))), /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        padding: web ? "16px 20px" : 15,
        display: "flex",
        flexDirection: "column",
        gap: 11
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Recent payouts"), fresh ? /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, "No payouts yet - Stripe pays out monthly once you have a connected balance.") : PAYOUTS.map(p => /*#__PURE__*/React.createElement("div", {
      key: p.date,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        paddingBottom: 10,
        borderBottom: "1px solid var(--border-soft)"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, p.amount), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, p.date)), /*#__PURE__*/React.createElement(Badge, {
      tone: "sage"
    }, p.status))))), fresh ? /*#__PURE__*/React.createElement(Empty, {
      icon: "ticket",
      title: "Paid bookings will land here.",
      body: "Once someone pays for one of your Click-managed paid events, the charge shows up here and rolls into the totals above.",
      cta: /*#__PURE__*/React.createElement(Btn, {
        size: "sm"
      }, "Create a paid event")
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "13px 20px",
        borderBottom: "1px solid var(--border-soft)",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Transactions \xB7 July"), TXNS.map((tx, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        borderBottom: i < TXNS.length - 1 ? "1px solid var(--border-soft)" : "none",
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: tx.who,
      variant: "initials",
      size: 30
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "1 1 140px",
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, tx.who), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, tx.ev, " \xB7 ", tx.date)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, tx.amount), /*#__PURE__*/React.createElement(Badge, {
      tone: tx.status === "Refunded" ? "cream" : "sage"
    }, tx.status)))));
  }

  /* ---------------- page: settings ---------------- */
  function MSettings({
    web
  }) {
    const [faq, setFaq] = uS(-1);
    const FAQ = [["How long does merchant verification take?", "Most ABN-verified merchants are approved within 24 business hours. We may ask for a venue photo or insurance certificate for higher-risk categories."], ["Can I run free + paid events under the same profile?", "Yes. Free events skip Stripe entirely; paid events route via Stripe Connect - set up under Finances."], ["What happens if I cancel an event?", "All confirmed attendees are refunded automatically (paid events) and notified. Repeated cancellations show on your profile."]];
    const Info = ({
      label,
      value,
      badge
    }) => /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        padding: "14px 17px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, value, badge));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: web ? 26 : 20
      },
      "data-screen-label": "Merchant \xB7 Settings"
    }, /*#__PURE__*/React.createElement(PageHead, {
      web: web,
      eyebrow: "Settings",
      title: "Profile, discounts & support.",
      sub: "Business details and payout account, promo codes, and answers when you need them."
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "Profile + payouts"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Info, {
      label: "Business name",
      value: BIZ.name
    }), /*#__PURE__*/React.createElement(Info, {
      label: "ABN",
      value: BIZ.abn
    }), /*#__PURE__*/React.createElement(Info, {
      label: "Verification",
      value: "Approved",
      badge: /*#__PURE__*/React.createElement(Badge, {
        tone: "sage"
      }, "Verified")
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: "13px 16px",
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, "Editing business name / website / ABN ships with merchant self-service. Today, email ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 600,
        color: "var(--purple-700)"
      }
    }, "merchants@click.au"), " to update details.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "Discounts"), /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 13,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 38,
        height: 38,
        borderRadius: 12,
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "ticket",
      size: 18,
      w: 2,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 180
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Promo codes & comp tickets"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        marginTop: 2
      }
    }, "The code generator ships next. For now, share a paid-event link with comp guests and refund from Finances.")), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      variant: "secondary",
      disabled: true
    }, "Coming soon"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Eyebrow, {
      style: {
        color: "var(--text-faint)"
      }
    }, "Support"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        color: "var(--text-muted)"
      }
    }, "Need a human? Email ", /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 600,
        color: "var(--purple-700)"
      }
    }, "merchants@click.au"), " - we reply same business day."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 9
      }
    }, FAQ.map(([qq, aa], i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        ...card,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setFaq(faq === i ? -1 : i),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "14px 17px",
        fontFamily: "var(--font-display)",
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, qq, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        transition: "transform .15s",
        transform: faq === i ? "rotate(180deg)" : "none"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "chevD",
      size: 16,
      w: 2,
      color: "var(--text-muted)"
    }))), faq === i && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "0 17px 15px",
        fontSize: 13.5,
        color: "var(--text-body)",
        lineHeight: 1.55
      }
    }, aa))))));
  }

  /* ---------------- portal root ---------------- */
  function Portal({
    web,
    fresh,
    createEvent
  }) {
    const [page, setPage] = uS("dash");
    const body = page === "events" ? /*#__PURE__*/React.createElement(MEvents, {
      web: web,
      createEvent: createEvent
    }) : page === "bookings" ? /*#__PURE__*/React.createElement(MBookings, {
      web: web
    }) : page === "finances" ? /*#__PURE__*/React.createElement(MFinances, {
      web: web,
      fresh: fresh
    }) : page === "settings" ? /*#__PURE__*/React.createElement(MSettings, {
      web: web
    }) : /*#__PURE__*/React.createElement(MDash, {
      web: web,
      fresh: fresh,
      go: setPage,
      createEvent: createEvent
    });
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: "var(--container-max)",
        margin: "0 auto",
        padding: web ? "8px 40px 48px" : "16px 16px 40px",
        display: "flex",
        gap: web ? 26 : 0,
        flexDirection: web ? "row" : "column",
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement(SideNav, {
      page: page,
      go: setPage,
      web: web,
      counts: {
        events: MEV.length
      },
      createEvent: createEvent
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: web ? 0 : 18,
        paddingTop: web ? 0 : 18,
        width: "100%"
      }
    }, body));
  }

  /* ---------------- become a host - 3-step application ---------------- */
  const CATS = ["Career", "Community", "Creative", "Fitness", "Food", "Games", "Learning", "Nightlife", "Outdoors", "Social", "Sports", "Wellness"];
  function Apply({
    web,
    done
  }) {
    const [step, setStep] = uS(0);
    const [cats, setCats] = uS(new Set(["Fitness"]));
    const [sent, setSent] = uS(false);
    const steps = ["Business", "Contact", "Review"];
    const toggleCat = c => setCats(s => {
      const x = new Set(s);
      x.has(c) ? x.delete(c) : x.add(c);
      return x;
    });
    const Panel = ({
      children,
      title
    }) => /*#__PURE__*/React.createElement("div", {
      style: {
        ...card,
        padding: web ? "26px 30px" : "20px 17px",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 20,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title), children);
    if (sent) return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 560,
        margin: "0 auto",
        padding: web ? "56px 24px" : "36px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center"
      },
      "data-screen-label": "Merchant \xB7 Application sent"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(SP, {
      size: 28,
      big: "var(--purple-600)",
      small: "var(--purple-400)"
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: web ? 30 : 24,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Application in - nice one."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-body)",
        lineHeight: 1.55,
        maxWidth: 420
      }
    }, "Most ABN-verified businesses are approved within 24 business hours. We'll email you the moment the portal unlocks."), /*#__PURE__*/React.createElement(Btn, {
      onClick: done
    }, "Preview the merchant portal"));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 720,
        margin: "0 auto",
        padding: web ? "28px 24px 56px" : "18px 16px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 18
      },
      "data-screen-label": "Merchant \xB7 Become a host"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
      tone: "lavender"
    }, "Become a host")), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: web ? 32 : 25,
        fontWeight: 600,
        color: "var(--text-strong)",
        letterSpacing: "-.01em"
      }
    }, "Tell us about you."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, "Your application goes to review and unlocks the portal once approved.")), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: "12px 15px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "info",
      size: 16,
      w: 2,
      color: "var(--purple-600)",
      style: {
        marginTop: 1
      }
    }), /*#__PURE__*/React.createElement("span", null, "We're piloting in Sydney first. Outside Sydney? Apply anyway - we'll waitlist you and email when we launch in your city.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, steps.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: s
    }, i > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1.5,
        background: i <= step ? "var(--purple-400)" : "var(--border-mid)"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        background: i < step ? "var(--sage)" : i === step ? "var(--purple-600)" : "var(--white)",
        color: i <= step ? "#fff" : "var(--text-muted)",
        border: i > step ? "1.5px solid var(--border-mid)" : "none"
      }
    }, i < step ? /*#__PURE__*/React.createElement(I, {
      name: "check",
      size: 12,
      w: 2.8,
      color: "#fff"
    }) : i + 1), web && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: i === step ? "var(--purple-700)" : "var(--text-faint)"
      }
    }, s))))), step === 0 && /*#__PURE__*/React.createElement(Panel, {
      title: "Business details"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Business name *",
      placeholder: "e.g. Inner West Fitness Mates"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Trading name (if different)",
      placeholder: "Optional"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "1fr 1fr" : "1fr",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "ABN (optional)",
      placeholder: "11 222 333 444",
      hint: "Speeds up verification."
    }), /*#__PURE__*/React.createElement(Field, {
      label: "ACN (optional)",
      placeholder: "000 000 000"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Event categories you host * ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500,
        color: "var(--text-muted)"
      }
    }, "\xB7 ", cats.size, " selected")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7
      }
    }, CATS.map(c => /*#__PURE__*/React.createElement(Tag, {
      key: c,
      selected: cats.has(c),
      onClick: () => toggleCat(c),
      style: {
        height: 30,
        padding: "0 13px",
        fontSize: 12.5
      }
    }, c))))), step === 1 && /*#__PURE__*/React.createElement(Panel, {
      title: "Contact & address"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "1fr 1fr" : "1fr",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Contact email *",
      placeholder: "you@business.com.au",
      icon: "mail"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Phone * (AU)",
      placeholder: "0412 345 678",
      hint: "Mobile, landline or 1300 - +61 is fine."
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Website (optional)",
      placeholder: "https://www.yourbusiness.com.au"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Instagram (optional)",
      placeholder: "@yourbusiness",
      hint: "Any network you're on - handy for verifying hosts without formal documents."
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Street address *",
      placeholder: "Start typing - e.g. 42 Crown Street, Surry Hills",
      icon: "pin",
      hint: "Pick a suggestion and we'll fill suburb, state & postcode."
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "2fr 1fr 1fr" : "1fr",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Suburb *",
      placeholder: "Surry Hills"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "State *",
      placeholder: "NSW"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Postcode *",
      placeholder: "2010"
    }))), step === 2 && /*#__PURE__*/React.createElement(Panel, {
      title: "Documents & review"
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        color: "var(--text-body)",
        lineHeight: 1.55
      }
    }, "Optional but speeds things up: public liability insurance, a venue photo, or anything that shows you run real events."), /*#__PURE__*/React.createElement("div", {
      style: {
        border: "1.5px dashed var(--border-mid)",
        borderRadius: "var(--radius-lg)",
        padding: "26px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "share",
      size: 22,
      w: 1.9,
      color: "var(--purple-600)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Drop files here or browse"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, "PDF, JPG or PNG \xB7 up to 10 MB each")), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tint,
        padding: "12px 15px",
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5
      }
    }, "By applying you agree to the host terms: real venues, accurate capacity, and cancellations refund attendees automatically.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: () => step > 0 && setStep(step - 1),
      style: {
        visibility: step > 0 ? "visible" : "hidden"
      }
    }, "Back"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-faint)"
      }
    }, "Step ", step + 1, " of 3 \xB7 ", steps[step]), step < 2 ? /*#__PURE__*/React.createElement(Btn, {
      onClick: () => setStep(step + 1)
    }, "Next") : /*#__PURE__*/React.createElement(Btn, {
      onClick: () => setSent(true)
    }, "Submit application")));
  }
  window.ScreensMerch = {
    Portal,
    Apply
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/merchant.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/myevents.jsx
try { (() => {
(function () {
  /* Click - My Events (the bookings hub, distinct from Discovery). Tabs: Upcoming · Waitlist ·
     Saved · Past, with a List / Calendar toggle. List is default; calendar = month grid (desktop)
     / agenda (mobile). Reuses the event-card system as a compact row. Inline styles. */
  const {
    useState,
    CAT,
    Icon,
    Btn,
    Cover,
    Status,
    Badge
  } = window.CK;
  const D = window.DATA;
  const {
    byId
  } = D;
  const TABS = [["upcoming", "Upcoming"], ["waitlist", "Waitlist"], ["saved", "Saved"], ["past", "Past"]];
  const SETS = {
    upcoming: D.BOOKINGS,
    waitlist: D.WAITLIST,
    saved: D.SAVED,
    past: D.PAST
  };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmtDay = iso => {
    const d = new Date(iso + "T00:00");
    return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  /* ---------------- compact event row (the card system, row variant) ---------------- */
  function Row({
    e,
    tab,
    open,
    toggleSave
  }) {
    const booked = tab === "upcoming" || tab === "past";
    const loc = booked ? [e.venue, e.suburb].filter(Boolean).join(" · ") : `${e.suburb} · ${e.dist}`;
    const past = tab === "past";
    let badge = null,
      control = null;
    if (tab === "upcoming") {
      badge = /*#__PURE__*/React.createElement(Status, {
        kind: "going"
      });
      control = /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 8,
          flexWrap: "wrap"
        }
      }, /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        variant: "secondary",
        icon: "calendar",
        onClick: ev => {
          ev.stopPropagation();
        }
      }, "Add to calendar"), /*#__PURE__*/React.createElement("button", {
        onClick: ev => ev.stopPropagation(),
        style: ghost
      }, "Can't make it?"));
    } else if (tab === "waitlist") {
      badge = /*#__PURE__*/React.createElement(Badge, {
        tone: "amber",
        style: {
          fontWeight: 700
        }
      }, "Waitlist \xB7 #3");
      control = /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)"
        }
      }, "We'll let you know if a spot opens."), /*#__PURE__*/React.createElement("button", {
        onClick: ev => ev.stopPropagation(),
        style: ghost
      }, "Leave waitlist"));
    } else if (tab === "saved") {
      control = /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 8
        }
      }, /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        onClick: ev => {
          ev.stopPropagation();
          open(e);
        }
      }, "RSVP"), /*#__PURE__*/React.createElement("button", {
        onClick: ev => {
          ev.stopPropagation();
          toggleSave(e.id);
        },
        style: ghost
      }, "Remove"));
    } else if (tab === "past") {
      badge = /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--text-muted)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        size: 13,
        w: 2.4,
        color: "var(--text-muted)"
      }), "You went");
      control = /*#__PURE__*/React.createElement(Btn, {
        size: "sm",
        variant: "secondary",
        onClick: ev => {
          ev.stopPropagation();
          open(e);
        }
      }, "Book again");
    }
    return /*#__PURE__*/React.createElement("div", {
      onClick: () => open(e),
      style: {
        display: "flex",
        gap: 15,
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        opacity: past ? .85 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 76,
        height: 76,
        borderRadius: 14,
        overflow: "hidden",
        flex: "none",
        filter: past ? "saturate(.8)" : "none"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: e.category,
      h: 76,
      photo: e.photo
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        marginBottom: 5,
        flexWrap: "wrap"
      }
    }, badge, tab === "saved" && /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bookmark",
      size: 15,
      w: 2,
      color: "var(--purple-600)",
      style: {
        fill: "var(--purple-600)"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.2,
        marginBottom: 4
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontSize: 13,
        color: "var(--text-muted)",
        fontWeight: 500,
        marginBottom: 12,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)"
    }), e.when), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 13,
      w: 1.9,
      color: "var(--text-muted)"
    }), loc), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        color: e.price === "Free" ? "var(--success)" : "var(--text-strong)"
      }
    }, e.price)), control));
  }
  const ghost = {
    border: "none",
    background: "none",
    cursor: "pointer",
    fontFamily: "var(--font-display)",
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--purple-600)",
    padding: 0
  };
  const EMPTY = {
    upcoming: ["No plans yet", "Find something good near you and RSVP - it'll show up here."],
    waitlist: ["No waitlists right now", "When something's full, join the waitlist and we'll watch it for you."],
    saved: ["Nothing saved yet", "Tap the bookmark on any event to keep it here."],
    past: ["Nothing in the past yet", "Once you've been to something, it'll rest here - re-book anytime."]
  };

  /* ---------------- calendar: month grid (desktop) / agenda (mobile) ---------------- */
  function MonthGrid({
    web,
    open
  }) {
    const dated = Object.entries(D.MYDATES).map(([id, iso]) => ({
      e: byId(id),
      iso,
      d: new Date(iso + "T00:00")
    })).filter(x => x.e);
    const byDate = {};
    dated.forEach(x => {
      (byDate[x.iso] = byDate[x.iso] || []).push(x.e);
    });
    const [sel, setSel] = useState(null);
    const year = 2026,
      month = 6; // July
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const today = "2026-07-08";
    const iso = day => `2026-07-${String(day).padStart(2, "0")}`;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    if (!web) {
      // mobile agenda - date-grouped list
      const dates = Object.keys(byDate).sort();
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 22
        }
      }, dates.map(dt => /*#__PURE__*/React.createElement("div", {
        key: dt
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: "var(--font-display)",
          fontSize: 13.5,
          fontWeight: 700,
          color: dt === today ? "var(--purple-700)" : "var(--text-strong)",
          marginBottom: 10,
          letterSpacing: ".01em"
        }
      }, fmtDay(dt), dt === today ? " · Today" : ""), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 10
        }
      }, byDate[dt].map(e => /*#__PURE__*/React.createElement("div", {
        key: e.id,
        onClick: () => open(e),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 13,
          background: "var(--white)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius-lg)",
          padding: 11,
          boxShadow: "var(--shadow-sm)",
          cursor: "pointer"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 50,
          height: 50,
          borderRadius: 11,
          overflow: "hidden",
          flex: "none"
        }
      }, /*#__PURE__*/React.createElement(Cover, {
        category: e.category,
        h: 50,
        photo: e.photo
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          lineHeight: 1.2,
          marginBottom: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, e.name), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          color: "var(--text-muted)"
        }
      }, e.when, " \xB7 ", e.suburb)), /*#__PURE__*/React.createElement(Icon, {
        name: "chevR",
        size: 18,
        color: "var(--ink-faint)"
      })))))));
    }
    // desktop month grid
    const selList = sel && byDate[sel] ? byDate[sel] : null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr",
        gap: 28,
        alignItems: "start"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "1.25rem",
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "July 2026"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, [["chevL", -1], ["chevR", 1]].map(([ic]) => /*#__PURE__*/React.createElement("span", {
      key: ic,
      style: {
        width: 32,
        height: 32,
        borderRadius: 9,
        border: "1px solid var(--border-mid)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ic,
      size: 16,
      w: 2
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7,1fr)",
        gap: 4
      }
    }, DOW.map(d => /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        textAlign: "center",
        fontSize: 11.5,
        fontWeight: 700,
        color: "var(--text-faint)",
        padding: "0 0 6px"
      }
    }, d[0])), cells.map((d, i) => {
      if (!d) return /*#__PURE__*/React.createElement("div", {
        key: i
      });
      const dt = iso(d),
        evs = byDate[dt],
        isToday = dt === today,
        on = sel === dt;
      return /*#__PURE__*/React.createElement("button", {
        key: i,
        onClick: () => evs && setSel(dt),
        style: {
          aspectRatio: "1",
          border: `1px solid ${on ? "var(--purple-500)" : "var(--border-soft)"}`,
          borderRadius: 11,
          background: on ? "var(--lavender-100)" : isToday ? "var(--surface-tint)" : "var(--white)",
          cursor: evs ? "pointer" : "default",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "7px 4px 4px",
          gap: 4
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: isToday ? 700 : 500,
          color: isToday ? "var(--purple-700)" : "var(--text-body)"
        }
      }, d), evs && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "flex",
          gap: 3
        }
      }, evs.slice(0, 3).map((e, j) => /*#__PURE__*/React.createElement("i", {
        key: j,
        style: {
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--purple-600)"
        }
      }))));
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-tint)",
        borderRadius: "var(--radius-xl)",
        padding: "20px 20px"
      }
    }, /*#__PURE__*/React.createElement("h4", {
      style: {
        margin: "0 0 12px",
        fontFamily: "var(--font-display)",
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, selList ? fmtDay(sel) : "Pick a day"), selList ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, selList.map(e => /*#__PURE__*/React.createElement("div", {
      key: e.id,
      onClick: () => open(e),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-md)",
        padding: 10,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 10,
        overflow: "hidden",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Cover, {
      category: e.category,
      h: 44,
      photo: e.photo
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.2,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, e.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, e.when))))) : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        color: "var(--text-muted)",
        lineHeight: 1.55
      }
    }, "Days with a dot have something on. Pick one to see what's on.")));
  }
  function MyEvents({
    web,
    open,
    saved,
    toggleSave,
    initialTab
  }) {
    const [tab, setTab] = useState(initialTab || "upcoming");
    const [view, setView] = useState("list");
    const counts = {
      upcoming: D.BOOKINGS.length,
      waitlist: D.WAITLIST.length,
      saved: [...saved].length,
      past: D.PAST.length
    };
    const list = (tab === "saved" ? [...saved] : SETS[tab]).map(byId).filter(Boolean);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: web ? "10px 0 48px" : "4px 0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 1060 : "none",
        margin: "0 auto",
        padding: web ? "0 40px" : "0 22px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 18,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "6px 0 4px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1.25,
        color: "var(--text-strong)"
      }
    }, "Your events"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-muted)",
        fontWeight: "500"
      }
    }, "Everything you've RSVP'd to, saved, or been to.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)",
        padding: 3,
        gap: 2
      }
    }, [["list", "List"], ["calendar", "Calendar"]].map(([k, l]) => {
      const on = view === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => setView(k),
        style: {
          border: "none",
          cursor: "pointer",
          borderRadius: "var(--radius-pill)",
          padding: "7px 16px",
          fontFamily: "var(--font-display)",
          fontSize: 13.5,
          fontWeight: on ? 700 : 500,
          background: on ? "var(--purple-600)" : "transparent",
          color: on ? "var(--cream)" : "var(--text-body)"
        }
      }, l);
    }))), view === "list" ? /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 780 : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ckRail",
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 22,
        overflowX: "auto",
        borderBottom: "1px solid var(--border-soft)",
        paddingBottom: 0
      }
    }, TABS.map(([k, l]) => {
      const on = tab === k;
      const n = counts[k];
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => setTab(k),
        style: {
          flex: "none",
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: "8px 4px 12px",
          marginBottom: -1,
          borderBottom: `2.5px solid ${on ? "var(--purple-600)" : "transparent"}`,
          fontFamily: "var(--font-display)",
          fontSize: 14.5,
          fontWeight: on ? 600 : 500,
          color: on ? "var(--purple-700)" : "var(--text-muted)",
          display: "inline-flex",
          alignItems: "center",
          gap: 7
        }
      }, l, n > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: on ? "var(--purple-600)" : "var(--text-faint)"
        }
      }, n));
    })), list.length > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, list.map(e => /*#__PURE__*/React.createElement(Row, {
      key: e.id,
      e: e,
      tab: tab,
      open: open,
      toggleSave: toggleSave
    }))) : /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-tint)",
        borderRadius: "var(--radius-xl)",
        padding: web ? "44px 30px" : "34px 22px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: "0 0 8px",
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, EMPTY[tab][0]), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-muted)",
        lineHeight: 1.55,
        maxWidth: 360,
        marginInline: "auto"
      }
    }, EMPTY[tab][1]))) : /*#__PURE__*/React.createElement(MonthGrid, {
      web: web,
      open: open
    })));
  }
  window.ScreensME = {
    MyEvents
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/myevents.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/onboarding.jsx
try { (() => {
(function () {
  /* Click - Onboarding. Progressive profiling: 4 steps + done. Collect only the minimum
     to make the first feed good; everything else defers to the dashboard checklist.
     One decision per screen, endowed progress, per-step completion tick. Inline styles. */
  const {
    useState,
    Icon,
    Logo,
    Spark,
    Btn,
    Field,
    Avatar,
    Tag
  } = window.CK;
  const CG = window.ScreensDisc.CatGlyph;
  const GENDERS = ["Woman", "Man", "Non-binary", "Prefer not to say"];
  const INTENTS = [["dating", "Open to dating", "If you click with someone, see where it goes."], ["friends", "Friends", "Good people, low stakes, no agenda."], ["locals", "Locals", "Find your feet, and your people nearby."], ["activities", "Activities", "The plan is the point - who you meet is a bonus."], ["networking", "Networking", "A few more good faces in your week."], ["platonic", "Here to meet people, not to date", "Here for friends and good company."]];
  function Chip({
    active,
    onClick,
    children
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      style: {
        padding: "10px 16px",
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        backgroundColor: active ? "var(--purple-600)" : "var(--white)",
        color: active ? "var(--cream)" : "var(--text-body)",
        border: `1.5px solid ${active ? "var(--purple-600)" : "var(--border-mid)"}`,
        transition: "background-color .15s"
      }
    }, children);
  }
  function Tick() {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
        color: "var(--success)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "var(--success)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 11,
      w: 3,
      color: "#fff"
    })), "Looks good");
  }
  function StepHead({
    eyebrow,
    title,
    sub
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 22
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 8px",
        font: "var(--role-overline)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--purple-500)"
      }
    }, eyebrow), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 8px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        lineHeight: 1.12,
        color: "var(--text-strong)"
      }
    }, title), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 15,
        color: "var(--text-muted)",
        lineHeight: 1.55
      }
    }, sub));
  }
  function Spot({
    web,
    icon,
    glyph
  }) {
    const d = web ? 80 : 66;
    return /*#__PURE__*/React.createElement("div", {
      className: "ckSpot",
      style: {
        position: "relative",
        width: d,
        height: d,
        margin: "0 auto 22px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--lavender-300) 22%,var(--cream))"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        width: Math.round(d * 0.4),
        height: Math.round(d * 0.4),
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--purple-400) 18%,var(--cream))",
        top: -3,
        right: -1
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "ckSpotInner",
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, glyph ? /*#__PURE__*/React.createElement(CG, {
      name: glyph,
      size: Math.round(d * 0.4),
      color: "var(--purple-600)"
    }) : /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: Math.round(d * 0.4),
      w: 1.7,
      color: "var(--purple-600)"
    })));
  }
  function Onboarding({
    web,
    done
  }) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("");
    const [postcode, setPostcode] = useState("");
    const [picks, setPicks] = useState(new Set());
    const [datingVisible, setDatingVisible] = useState(true);
    const [openTo, setOpenTo] = useState("");
    const [interests, setInterests] = useState(new Set());
    const [moreOpen, setMoreOpen] = useState(false);
    const total = 4;
    const pcOk = /^\d{4}$/.test(postcode);
    const PILOT_PC = ["2042", "2010", "2016", "2204", "2008", "2017", "2021", "2037", "2015"];
    const pcInCluster = PILOT_PC.includes(postcode);
    const valid1 = name.trim().length > 1 && dob && gender && pcOk;
    const valid2 = picks.size > 0 && (!picks.has("dating") || openTo);
    const togglePick = k => setPicks(s => {
      const x = new Set(s);
      if (x.has(k)) {
        x.delete(k);
        if (k === "dating") setOpenTo("");
      } else {
        x.add(k);
        if (k === "dating") x.delete("platonic");
        if (k === "platonic") {
          x.delete("dating");
          setOpenTo("");
        }
      }
      return x;
    });
    const toggleInt = k => setInterests(s => {
      const x = new Set(s);
      x.has(k) ? x.delete(k) : x.add(k);
      return x;
    });
    const next = () => setStep(s => s + 1);
    const back = () => setStep(s => Math.max(1, s - 1));

    /* ---- DONE ---- */
    if (step > total) return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100%",
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: web ? "60px 40px" : "40px 26px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 440
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "0 0 12px",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h1)",
        fontWeight: 600,
        letterSpacing: "-.02em",
        color: "var(--text-strong)"
      }
    }, "You're all set ", /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        verticalAlign: "-4px",
        marginLeft: 3
      }
    }, /*#__PURE__*/React.createElement(Spark, {
      size: web ? 34 : 28,
      big: "var(--purple-600)",
      small: "var(--purple-600)"
    }))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 26px",
        fontSize: 16,
        lineHeight: 1.6,
        color: "var(--text-body)"
      }
    }, "No swiping, no endless chat - you meet people by doing things you like. Here's what's good near you this week."), /*#__PURE__*/React.createElement(Btn, {
      size: "lg",
      onClick: done,
      icon: "arrowR"
    }, "See what's on near you"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "20px 0 0",
        fontSize: 13.5,
        color: "var(--text-muted)",
        lineHeight: 1.55
      }
    }, "Finish your profile anytime from your dashboard - a photo, a line about you, the Click quiz.")));
    let content,
      canNext = true,
      onNext = next,
      skip = null;
    if (step === 1) {
      content = /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Spot, {
        web: web,
        icon: "pin"
      }), /*#__PURE__*/React.createElement(StepHead, {
        eyebrow: "About you",
        title: "The basics",
        sub: "Just enough to find you good things nearby."
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 16
        }
      }, /*#__PURE__*/React.createElement(Field, {
        label: "First name",
        placeholder: "Ava",
        value: name,
        onChange: setName,
        icon: "user"
      }), /*#__PURE__*/React.createElement("label", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 7
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, "Date of birth"), /*#__PURE__*/React.createElement("span", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
          height: 50,
          background: "var(--white)",
          border: "1.5px solid var(--border-mid)",
          borderRadius: "var(--radius-md)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "calendar",
        size: 18,
        w: 1.9,
        color: "var(--text-muted)"
      }), /*#__PURE__*/React.createElement("input", {
        type: "date",
        value: dob,
        onChange: e => setDob(e.target.value),
        style: {
          flex: 1,
          border: "none",
          outline: "none",
          background: "none",
          fontFamily: "var(--font-sans)",
          fontSize: 15.5,
          color: "var(--text-strong)"
        }
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12.5,
          color: "var(--text-muted)"
        }
      }, "Click is 18+. We use this for eligibility only.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          marginBottom: 9
        }
      }, "Gender"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }
      }, GENDERS.map(g => /*#__PURE__*/React.createElement(Chip, {
        key: g,
        active: gender === g,
        onClick: () => setGender(g)
      }, g)))), /*#__PURE__*/React.createElement("label", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 7
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text-strong)"
        }
      }, "Postcode"), /*#__PURE__*/React.createElement("span", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
          height: 50,
          background: "var(--white)",
          border: `1.5px solid ${pcOk ? "var(--border-mid)" : "var(--border-mid)"}`,
          borderRadius: "var(--radius-md)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "pin",
        size: 18,
        w: 1.9,
        color: "var(--text-muted)"
      }), /*#__PURE__*/React.createElement("input", {
        type: "text",
        inputMode: "numeric",
        maxLength: 4,
        placeholder: "2042",
        value: postcode,
        onChange: e => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4)),
        style: {
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "none",
          fontFamily: "var(--font-sans)",
          fontSize: 15.5,
          letterSpacing: ".04em",
          color: "var(--text-strong)"
        }
      }), pcOk && /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        size: 17,
        w: 2.4,
        color: "var(--success)"
      })), !pcOk && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12.5,
          color: "var(--text-muted)",
          lineHeight: 1.5
        }
      }, "Click is piloting in inner Sydney first. Pop in your postcode - we'll show you what's near, and email you the moment we reach your area."), pcOk && pcInCluster && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12.5,
          color: "var(--success)",
          fontWeight: 500,
          lineHeight: 1.5
        }
      }, "You're right in our first suburbs - plenty on near you."), pcOk && !pcInCluster && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12.5,
          color: "var(--text-body)",
          lineHeight: 1.5
        }
      }, "You're a little outside our first suburbs - you're in, and we'll let you know the moment Click reaches you."))), valid1 && /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 18
        }
      }, /*#__PURE__*/React.createElement(Tick, null)));
      canNext = valid1;
    } else if (step === 2) {
      content = /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Spot, {
        web: web,
        icon: "users"
      }), /*#__PURE__*/React.createElement(StepHead, {
        eyebrow: "What you're after",
        title: "What brings you to Click?",
        sub: "Pick any that fit - it just tunes what we show you. You can change it later."
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 10
        }
      }, INTENTS.map(([k, label, desc]) => {
        const on = picks.has(k);
        return /*#__PURE__*/React.createElement("div", {
          key: k
        }, /*#__PURE__*/React.createElement("button", {
          onClick: () => togglePick(k),
          "aria-pressed": on,
          style: {
            display: "flex",
            alignItems: "center",
            gap: 13,
            width: "100%",
            textAlign: "left",
            padding: "15px 16px",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            background: on ? "var(--lavender-100)" : "var(--white)",
            border: `1.5px solid ${on ? "var(--purple-500)" : "var(--border-soft)"}`,
            transition: "background .15s,border-color .15s"
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            flex: 1,
            minWidth: 0
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            display: "block",
            fontSize: 15.5,
            fontWeight: 600,
            color: "var(--text-strong)"
          }
        }, label), /*#__PURE__*/React.createElement("span", {
          style: {
            display: "block",
            fontSize: 13,
            color: "var(--text-muted)",
            marginTop: 2
          }
        }, desc)), /*#__PURE__*/React.createElement("span", {
          "aria-hidden": "true",
          style: {
            flex: "none",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--purple-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: on ? 1 : 0,
            transform: on ? "scale(1)" : "scale(.7)",
            transition: "opacity .15s,transform .15s"
          }
        }, /*#__PURE__*/React.createElement(Icon, {
          name: "check",
          size: 13,
          w: 3,
          color: "var(--cream)"
        }))), on && k === "dating" && /*#__PURE__*/React.createElement("div", {
          style: {
            margin: "10px 0 2px",
            padding: "14px 16px",
            background: "var(--surface-tint)",
            borderRadius: "var(--radius-md)"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 14
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            minWidth: 0
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            display: "block",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--text-strong)"
          }
        }, "Show I'm open to dating"), /*#__PURE__*/React.createElement("span", {
          style: {
            display: "block",
            fontSize: 12.5,
            color: "var(--text-muted)",
            marginTop: 2,
            lineHeight: 1.45
          }
        }, "Only shown to others also open to dating.")), /*#__PURE__*/React.createElement("button", {
          role: "switch",
          "aria-checked": datingVisible,
          "aria-label": "Show I'm open to dating",
          onClick: () => setDatingVisible(v => !v),
          style: {
            flex: "none",
            width: 44,
            height: 26,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: datingVisible ? "var(--purple-600)" : "var(--border-mid)",
            position: "relative",
            transition: "background .2s"
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            position: "absolute",
            top: 3,
            left: datingVisible ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "var(--white)",
            boxShadow: "var(--shadow-sm)",
            transition: "left .2s"
          }
        }))), /*#__PURE__*/React.createElement("span", {
          style: {
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-strong)",
            marginBottom: 9
          }
        }, "Open to meeting"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 8
          }
        }, ["Women", "Men", "Everyone"].map(o => /*#__PURE__*/React.createElement(Chip, {
          key: o,
          active: openTo === o,
          onClick: () => setOpenTo(o)
        }, o)))));
      })));
      canNext = valid2;
    } else if (step === 3) {
      const IT = (window.DATA.INTEREST_TAGS || []).filter(c => !c.gated || picks.has("dating"));
      const groups = moreOpen ? IT : IT.slice(0, 8);
      content = /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Spot, {
        web: web,
        glyph: "arts"
      }), /*#__PURE__*/React.createElement(StepHead, {
        eyebrow: "Interests",
        title: "What do you like doing?",
        sub: "Pick a few - three or more is the sweet spot."
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 18
        }
      }, groups.map((cat, ci) => /*#__PURE__*/React.createElement("div", {
        key: cat.key
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 10
        }
      }, cat.label), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }
      }, cat.tags.map((t, ti) => /*#__PURE__*/React.createElement("span", {
        key: t,
        style: {
          display: "inline-flex"
        }
      }, /*#__PURE__*/React.createElement(Tag, {
        selected: interests.has(t),
        onClick: () => toggleInt(t),
        style: {
          height: 32,
          padding: "0 14px",
          fontSize: 13.5,
          cursor: "pointer"
        }
      }, t)))))), !moreOpen && IT.length > 8 && /*#__PURE__*/React.createElement("button", {
        onClick: () => setMoreOpen(true),
        style: {
          alignSelf: "flex-start",
          border: "none",
          background: "none",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--purple-600)",
          padding: "2px 0",
          display: "inline-flex",
          alignItems: "center",
          gap: 5
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 15,
        w: 2.4,
        color: "var(--purple-600)"
      }), "Show more")), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "22px 2px 0",
          fontSize: 13.5,
          fontWeight: 600,
          color: interests.size >= 3 ? "var(--sage)" : "var(--text-muted)"
        }
      }, interests.size === 0 ? "Pick a few to get started" : interests.size >= 3 ? `Nice - ${interests.size} picked` : `${interests.size} picked · pick ${3 - interests.size} more for better suggestions`));
      skip = () => next();
    } else if (step === 4) {
      content = /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Spot, {
        web: web,
        icon: "user"
      }), /*#__PURE__*/React.createElement(StepHead, {
        eyebrow: "One last thing",
        title: "Add a photo?",
        sub: "Optional - people show up more for a face. You can always add one later."
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "10px 0"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement(Avatar, {
        name: name || "Ava",
        size: 112
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          bottom: 2,
          right: 2,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--purple-600)",
          border: "3px solid var(--cream)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 18,
        w: 2.4,
        color: "var(--cream)"
      }))), /*#__PURE__*/React.createElement(Btn, {
        variant: "secondary",
        icon: "share"
      }, "Upload a photo")));
      onNext = next;
      skip = next;
    }
    const pct = Math.round((step - 0.5) / total * 100); /* endowed: ahead of bare step/total */
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100%",
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column"
      }
    }, /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: "@keyframes ckSpotFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}.ckSpotInner{animation:ckSpotFloat 4.5s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.ckSpotInner{animation:none!important}}"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        padding: web ? "20px 40px 0" : "16px 22px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      size: web ? 26 : 23
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, "Step ", step, " of ", total)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        borderRadius: 999,
        background: "var(--surface-tint)",
        overflow: "hidden",
        maxWidth: web ? 460 : "none",
        margin: "0 auto"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: pct + "%",
        background: "var(--purple-600)",
        borderRadius: 999,
        transition: "width .35s cubic-bezier(.3,.7,.4,1)"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: "auto",
        padding: web ? "32px 40px" : "24px 22px 16px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      key: step,
      style: {
        maxWidth: 460,
        margin: "0 auto"
      }
    }, content)), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        position: "sticky",
        bottom: 0,
        zIndex: 5,
        padding: web ? "14px 40px 26px" : "12px 22px 22px",
        borderTop: "1px solid var(--border-soft)",
        background: "var(--cream)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 460,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, step > 1 && /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      onClick: back
    }, "Back"), web && /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), skip && /*#__PURE__*/React.createElement("button", {
      onClick: skip,
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-muted)",
        whiteSpace: "nowrap",
        padding: "10px 4px",
        margin: "-10px -4px"
      }
    }, "Skip for now"), /*#__PURE__*/React.createElement(Btn, {
      onClick: onNext,
      disabled: !canNext,
      icon: "arrowR",
      style: web ? undefined : {
        flex: 1
      }
    }, "Continue"))));
  }
  window.ScreensOnb = {
    Onboarding
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/onboarding.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/quiz.jsx
try { (() => {
(function () {
  /* Click - the Click quiz (full-screen MODAL takeover). Warm, optional, all questions skippable.
     Reordered fun-first / sensitive-last (5 steps). Feeds the silent life-tag + persona system -
     the result is NEVER shown back to the user. NO spark glyph anywhere (reserved for the three
     mechanic peaks); hyphens, never em-dashes. Inline styles. window.ScreensQuiz. */
  const {
    useState,
    useEffect,
    Icon,
    Logo,
    Btn,
    Cover
  } = window.CK;
  const D = window.DATA;
  const EventCard = window.ScreensA && window.ScreensA.EventCard;

  /* one screen per step; each holds 1-4 questions. Sensitive items live LAST (step 5). */
  const STEPS = [{
    eyebrow: "YOUR KIND OF ROOM",
    title: "Set the scene",
    icon: "compass",
    sub: "The rooms you enjoy most - pick whatever fits.",
    questions: [{
      id: "size",
      prompt: "Size that suits you",
      multi: true,
      options: ["Small and intimate", "Medium", "Big and buzzing"]
    }, {
      id: "vibe",
      prompt: "The vibe you're after",
      multi: true,
      options: ["Hands-on and creative", "Active and physical", "Social and easygoing", "Learning something new", "Calm and restorative"]
    }, {
      id: "structure",
      prompt: "You'd rather it be",
      options: ["With a plan", "Loose and free-flowing", "Don't mind either way"]
    }]
  }, {
    eyebrow: "HOW YOU CONNECT",
    title: "Your social style",
    icon: "users",
    sub: "No right answers - just what's true for you.",
    questions: [{
      id: "recharge",
      prompt: "You recharge by",
      options: ["Time on your own", "A bit of both", "Being around people"]
    }, {
      id: "strangers",
      prompt: "Walking into a room of strangers, you",
      options: ["Hang back and read the room", "Dive in and say hi", "Depends on the day"]
    }, {
      id: "clickwith",
      prompt: "You tend to click with people who are",
      multi: true,
      options: ["Thoughtful and deep", "Fun and spontaneous", "Driven and ambitious", "Warm and caring"]
    }, {
      id: "pace",
      prompt: "Your social pace",
      options: ["Slow and steady", "Somewhere in between", "Fast, I love variety"]
    }]
  }, {
    eyebrow: "WHAT YOU'RE AFTER LATELY",
    title: "Right about now",
    icon: "clock",
    sub: "This can shift - update it whenever.",
    questions: [{
      id: "intent",
      prompt: "What brings you to Click?",
      multi: true,
      gateDating: true,
      options: ["Doing more of what I love", "Meeting new people", "Making local friends", "Growing my circle", "Networking", "Open to dating"]
    }, {
      id: "socially",
      prompt: "Socially, right now you're",
      options: ["Open and curious", "Keen to widen your circle", "In a good place, just here for fun"]
    }]
  }, {
    eyebrow: "YOUR WEEK & RANGE",
    title: "Timing and distance",
    icon: "calendar",
    sub: "So we lean toward what actually fits your life.",
    questions: [{
      id: "free",
      prompt: "When you're usually free",
      multi: true,
      options: ["Weekday mornings", "Weekday evenings", "Saturdays", "Sundays", "Varies week to week"]
    }, {
      id: "distance",
      prompt: "How far you'll travel for a good one",
      options: ["Keep it in my suburb", "Up to ~20 minutes", "Across the city for the right thing", "Distance doesn't faze me"]
    }]
  }, {
    eyebrow: "A LITTLE ABOUT YOU",
    title: "Anything you'd like us to know?",
    icon: "user",
    sub: "All optional - it just helps us connect you with people in a similar chapter.",
    questions: [{
      id: "stage",
      prompt: "Any of these fit right now?",
      multi: true,
      options: ["New in town", "New parent", "Student", "Recently retired", "None of these"]
    }, {
      id: "pet",
      prompt: "A pet in your life?",
      options: ["Yes", "No"]
    }, {
      id: "lgbtq",
      prompt: "Do you identify as LGBTQ+?",
      sensitive: true,
      options: ["Yes", "No", "Prefer not to say"],
      note: "Optional and private to you - it helps us keep events welcoming."
    }]
  }];
  const TOTAL = STEPS.length;
  const PCT = [0, 22, 44, 62, 80, 96]; // endowed: pre-filled, fast early, slower late

  /* Lucide glyph on a Lavender circle (NEVER a spark) */
  function Glyph({
    web,
    icon
  }) {
    const d = web ? 50 : 44;
    return /*#__PURE__*/React.createElement("div", {
      className: "ckQGlyph",
      style: {
        position: "relative",
        width: d,
        height: d,
        margin: "0 auto 13px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        background: "color-mix(in srgb,var(--lavender-300) 26%,var(--cream))"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: Math.round(d * 0.42),
      w: 1.8,
      color: "var(--purple-600)"
    })));
  }

  /* one neutral option pill - 12px radius, >=44px tap. Selected = Deep-Purple fill, no tick. */
  function Opt({
    on,
    onClick,
    children
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      "aria-pressed": on,
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "11px 16px",
        boxSizing: "border-box",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 14.5,
        fontWeight: on ? 600 : 500,
        backgroundColor: on ? "var(--purple-600)" : "var(--white)",
        color: on ? "var(--cream)" : "var(--text-body)",
        border: "1.5px solid " + (on ? "var(--purple-600)" : "var(--border-mid)"),
        transition: "background-color .15s,border-color .15s"
      }
    }, children);
  }
  function Question({
    q,
    value,
    setValue
  }) {
    const isOn = o => q.multi ? (value || []).includes(o) : value === o;
    const pick = o => {
      if (q.multi) {
        const cur = value || [];
        setValue(cur.includes(o) ? cur.filter(x => x !== o) : [...cur, o]);
      } else setValue(value === o ? null : o);
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 9,
        marginBottom: 9,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 15.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.3
      }
    }, q.prompt), q.multi && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-faint)",
        fontWeight: 500
      }
    }, "pick any"), q.sensitive && /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 12,
      w: 2,
      color: "var(--text-muted)"
    }), "optional")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, q.options.map(o => /*#__PURE__*/React.createElement(Opt, {
      key: o,
      on: isOn(o),
      onClick: () => pick(o)
    }, o))), q.note && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginTop: 11,
        padding: "10px 13px",
        background: "var(--lavender-wash)",
        borderRadius: "var(--radius-md)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 13,
      w: 1.9,
      color: "var(--purple-600)",
      style: {
        marginTop: 1,
        flex: "none"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--purple-800)",
        lineHeight: 1.5
      }
    }, q.note)));
  }

  /* gated dating sub-block - animates in only when "Open to dating" is selected */
  function DatingBlock({
    meet,
    setMeet,
    ageMin,
    ageMax,
    setAge
  }) {
    const lo = 18,
      hi = 65,
      span = hi - lo;
    const onMin = v => setAge(Math.min(Number(v), ageMax - 1), ageMax);
    const onMax = v => setAge(ageMin, Math.max(Number(v), ageMin + 1));
    return /*#__PURE__*/React.createElement("div", {
      className: "ckQDate",
      style: {
        marginBottom: 22,
        padding: "16px 16px 14px",
        background: "var(--lavender-wash)",
        borderRadius: "var(--radius-lg)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 14px",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--purple-800)"
      }
    }, "Nice - a couple of quick ones, just for this."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        marginBottom: 9
      }
    }, "You'd like to meet"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, ["Men", "Women", "Everyone"].map(o => /*#__PURE__*/React.createElement(Opt, {
      key: o,
      on: meet === o,
      onClick: () => setMeet(meet === o ? null : o)
    }, o)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Age range"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 700,
        color: "var(--purple-700)"
      }
    }, ageMin, " - ", ageMax)), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        height: 28
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 12,
        left: 0,
        right: 0,
        height: 5,
        borderRadius: 99,
        background: "var(--mist)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 12,
        height: 5,
        borderRadius: 99,
        background: "var(--purple-500)",
        left: (ageMin - lo) / span * 100 + "%",
        right: 100 - (ageMax - lo) / span * 100 + "%"
      }
    }), /*#__PURE__*/React.createElement("input", {
      className: "ckQRange",
      type: "range",
      min: lo,
      max: hi,
      value: ageMin,
      onChange: e => onMin(e.target.value),
      "aria-label": "Minimum age"
    }), /*#__PURE__*/React.createElement("input", {
      className: "ckQRange",
      type: "range",
      min: lo,
      max: hi,
      value: ageMax,
      onChange: e => onMax(e.target.value),
      "aria-label": "Maximum age"
    }))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "12px 0 0",
        fontSize: 12,
        color: "var(--purple-800)",
        opacity: .82,
        lineHeight: 1.5
      }
    }, "Only shapes who we suggest - never shown on your profile."));
  }
  function Quiz({
    web,
    done,
    onClose
  }) {
    const [step, setStep] = useState(0); // 0 = intro · 1..5 = steps · 6 = finish
    const [ans, setAns] = useState({});
    const [meet, setMeet] = useState(null);
    const [ageMin, setAgeMin] = useState(25);
    const [ageMax, setAgeMax] = useState(38);
    const set = (id, v) => setAns(a => ({
      ...a,
      [id]: v
    }));
    const next = () => setStep(s => s + 1);
    const back = () => setStep(s => Math.max(0, s - 1));
    useEffect(() => {
      const onKey = e => {
        if (e.key === "Escape" && onClose) onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    let body;
    if (step === 0) {
      /* INTRO */
      body = /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: 410,
          margin: "0 auto",
          textAlign: "center",
          paddingTop: web ? 4 : 2
        }
      }, /*#__PURE__*/React.createElement(Glyph, {
        web: web,
        icon: "compass"
      }), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 6px",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--purple-500)"
        }
      }, "The Click quiz"), /*#__PURE__*/React.createElement("h1", {
        style: {
          margin: "0 0 9px",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.288125rem, 1.169rem + 0.51cqi, 1.55rem)",
          fontWeight: 600,
          letterSpacing: "-.02em",
          lineHeight: 1.15,
          color: "var(--text-strong)"
        }
      }, "Find your kind of night"), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 14px",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--text-body)"
        }
      }, "A handful of quick questions, so we surface fewer, better things - the events and rooms that feel like you. About two minutes."), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "inline-flex",
          alignItems: "flex-start",
          gap: 8,
          textAlign: "left",
          maxWidth: 360,
          padding: "10px 13px",
          background: "var(--lavender-wash)",
          borderRadius: "var(--radius-md)",
          marginBottom: 18
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "lock",
        size: 15,
        w: 1.9,
        color: "var(--purple-600)",
        style: {
          marginTop: 1,
          flex: "none"
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: "var(--purple-800)",
          lineHeight: 1.5
        }
      }, "Private to you - these tune your suggestions and never show on your profile.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
        size: "lg",
        onClick: next,
        icon: "arrowR"
      }, "Start the quiz")), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "13px 0 0"
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: onClose,
        style: {
          border: "none",
          background: "none",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-muted)"
        }
      }, "Maybe later")));
    } else if (step > TOTAL) {
      /* FINISH - the silent payoff: never lists the user's tags; tight + centered */
      body = /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: 400,
          margin: "0 auto",
          textAlign: "center",
          paddingTop: web ? 14 : 6
        }
      }, /*#__PURE__*/React.createElement(Glyph, {
        web: web,
        icon: "check"
      }), /*#__PURE__*/React.createElement("h1", {
        style: {
          margin: "0 0 9px",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.32375rem, 1.175rem + 0.63cqi, 1.65rem)",
          fontWeight: 600,
          letterSpacing: "-.02em",
          color: "var(--text-strong)"
        }
      }, "You're all set"), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 20px",
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--text-body)"
        }
      }, "Thanks - that helps a lot. We'll start leaning toward your kind of thing."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
        size: "lg",
        onClick: done,
        icon: "arrowR"
      }, "See what's on")), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "13px 0 0",
          fontSize: 13,
          color: "var(--text-muted)"
        }
      }, "Change your answers anytime in Settings."));
    } else {
      /* a step */
      const sec = STEPS[step - 1];
      const datingOn = (ans.intent || []).includes("Open to dating");
      body = /*#__PURE__*/React.createElement("div", {
        key: step,
        style: {
          maxWidth: 440,
          margin: "0 auto"
        }
      }, /*#__PURE__*/React.createElement(Glyph, {
        web: web,
        icon: sec.icon
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 16,
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 6px",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--purple-500)"
        }
      }, sec.eyebrow), /*#__PURE__*/React.createElement("h1", {
        style: {
          margin: "0 0 6px",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.18rem, 1.103rem + 0.33cqi, 1.35rem)",
          fontWeight: 600,
          letterSpacing: "-.02em",
          lineHeight: 1.15,
          color: "var(--text-strong)"
        }
      }, sec.title), /*#__PURE__*/React.createElement("p", {
        style: {
          margin: 0,
          fontSize: 14,
          color: "var(--text-muted)",
          lineHeight: 1.5
        }
      }, sec.sub)), sec.questions.map(q => /*#__PURE__*/React.createElement(React.Fragment, {
        key: q.id
      }, /*#__PURE__*/React.createElement(Question, {
        q: q,
        value: ans[q.id],
        setValue: v => set(q.id, v)
      }), q.gateDating && datingOn && /*#__PURE__*/React.createElement(DatingBlock, {
        meet: meet,
        setMeet: setMeet,
        ageMin: ageMin,
        ageMax: ageMax,
        setAge: (a, b) => {
          setAgeMin(a);
          setAgeMax(b);
        }
      }))));
    }
    const showBar = step >= 1 && step <= TOTAL;
    const sec = STEPS[step - 1];
    const answeredHere = sec ? sec.questions.some(q => {
      const v = ans[q.id];
      return Array.isArray(v) ? v.length : v != null;
    }) : false;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 62,
        background: "rgba(28,24,48,.55)",
        display: "flex",
        alignItems: web ? "center" : "stretch",
        justifyContent: "center",
        padding: web ? 28 : 0
      }
    }, /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: "@keyframes ckQModalIn{0%{transform:translateY(12px) scale(.985)}100%{transform:none}}.ckQModal{animation:ckQModalIn .42s cubic-bezier(.2,.7,.3,1) both}@keyframes ckQIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}@keyframes ckQSlide{0%{transform:translateY(-6px)}100%{transform:none}}.ckQGlyph{animation:ckQIn .45s cubic-bezier(.2,.7,.3,1) both}.ckQDate{animation:ckQSlide .3s ease both}.ckQRange{-webkit-appearance:none;appearance:none;background:transparent;position:absolute;top:0;left:0;width:100%;height:28px;margin:0;pointer-events:none}.ckQRange::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:22px;height:22px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);box-shadow:var(--shadow-sm);cursor:pointer;margin-top:-9px}.ckQRange::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);cursor:pointer}.ckQRange::-webkit-slider-runnable-track{height:5px;background:transparent}.ckQRange::-moz-range-track{height:5px;background:transparent}@media (prefers-reduced-motion: reduce){.ckQGlyph,.ckQDate,.ckQModal{animation:none!important}}"
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "ckQModal",
      style: {
        position: "relative",
        width: "100%",
        maxWidth: web ? 520 : "none",
        height: web ? "auto" : "100%",
        maxHeight: web ? "86vh" : "none",
        display: "flex",
        flexDirection: "column",
        background: "var(--cream)",
        borderRadius: web ? "var(--radius-2xl)" : 0,
        boxShadow: web ? "var(--shadow-xl)" : "none",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        padding: web ? "14px 28px 0" : "12px 18px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        marginBottom: showBar ? 12 : 0
      }
    }, showBar ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, "Step ", step, " of ", TOTAL) : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      "aria-label": "Close quiz",
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        display: "flex",
        padding: 2
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 18,
      w: 2.2,
      color: "var(--text-muted)"
    }))), showBar && /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        borderRadius: 999,
        background: "var(--surface-tint)",
        overflow: "hidden",
        maxWidth: web ? 460 : "none",
        margin: "0 auto"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: PCT[step] + "%",
        background: "var(--purple-600)",
        borderRadius: 999,
        transition: "width .4s cubic-bezier(.3,.7,.4,1)"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: "auto",
        padding: web ? "20px 30px 22px" : "18px 20px 20px"
      }
    }, body), showBar && /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        padding: web ? "12px 30px 18px" : "10px 20px 16px",
        borderTop: "1px solid var(--border-soft)",
        background: "var(--cream)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 460,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, step > 1 && /*#__PURE__*/React.createElement(Btn, {
      variant: "secondary",
      onClick: back
    }, "Back"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: next,
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, "Skip"), /*#__PURE__*/React.createElement(Btn, {
      onClick: next,
      icon: "arrowR"
    }, answeredHere ? step === TOTAL ? "Finish" : "Next" : "Skip section")))));
  }
  window.ScreensQuiz = {
    Quiz
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/quiz.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/settings.jsx
try { (() => {
(function () {
  /* Click - SETTINGS (its own PAGE, reached from the profile's "Edit profile" deep-link).
     ONE page, four sections: Edit profile · Privacy & visibility · Account · Notifications.
     - Edit profile  = profile CONTENT only (photos, about, bio, intent, interests).
     - Privacy & visibility = "Show me in attendee lists" + Open-to-dating toggle + dating prefs (gated).
     - Account = name / email / password / sign-out.
     - Notifications = notification preferences (distinct from the bell panel).
     Desktop: sticky left sub-nav + content. Mobile: a sectioned list that drills into a section.
     NOT an overlay. Hyphens, not em-dashes. window.ScreensSet. */
  const {
    useState,
    useEffect,
    Icon,
    Btn,
    Toggle,
    Avatar,
    Tag
  } = window.CK;
  const SECTIONS = [["edit", "Edit profile", "user"], ["privacy", "Privacy & visibility", "lock"], ["account", "Account", "settings"], ["notifications", "Notifications", "bell"]];
  /* the six canonical intents - single source, same labels/order as onboarding (do not reword) */
  const INTENTS = ["Open to dating", "Friends", "Locals", "Activities", "Networking", "Here to meet people, not to date"];
  function SectionHead({
    children,
    sub
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--text-muted)"
      }
    }, children), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "5px 0 0",
        fontSize: 13,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, sub));
  }
  function Group({
    children,
    last
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "24px 0",
        borderBottom: last ? "none" : "1px solid var(--border-soft)"
      }
    }, children);
  }
  function FieldRow({
    label,
    children,
    note
  }) {
    return /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        marginBottom: 7
      }
    }, label), children, note && /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 12,
        color: "var(--text-faint)",
        marginTop: 5
      }
    }, note));
  }
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    height: 48,
    padding: "0 14px",
    background: "var(--white)",
    border: "1.5px solid var(--border-mid)",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-sans)",
    fontSize: 15.5,
    color: "var(--text-strong)",
    outline: "none"
  };
  function IntentCard({
    label,
    on,
    onClick
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      "aria-pressed": on,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        textAlign: "left",
        padding: "13px 15px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        background: on ? "var(--lavender-100)" : "var(--white)",
        border: "1.5px solid " + (on ? "var(--purple-500)" : "var(--border-soft)"),
        transition: "background-color .15s,border-color .15s"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        flex: "none",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "var(--purple-600)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: on ? 1 : 0,
        transform: on ? "scale(1)" : "scale(.7)",
        transition: "opacity .15s,transform .15s"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13,
      w: 3,
      color: "var(--cream)"
    })));
  }
  function AgeRange({
    min,
    max,
    setRange
  }) {
    const lo = 18,
      hi = 65,
      span = hi - lo;
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Age range I'm open to"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 700,
        color: "var(--purple-700)"
      }
    }, min, " - ", max)), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        height: 28
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 12,
        left: 0,
        right: 0,
        height: 5,
        borderRadius: 99,
        background: "var(--mist)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 12,
        height: 5,
        borderRadius: 99,
        background: "var(--purple-500)",
        left: (min - lo) / span * 100 + "%",
        right: 100 - (max - lo) / span * 100 + "%"
      }
    }), /*#__PURE__*/React.createElement("input", {
      className: "ckPERange",
      type: "range",
      min: lo,
      max: hi,
      value: min,
      onChange: e => setRange(Math.min(Number(e.target.value), max - 1), max),
      "aria-label": "Minimum age"
    }), /*#__PURE__*/React.createElement("input", {
      className: "ckPERange",
      type: "range",
      min: lo,
      max: hi,
      value: max,
      onChange: e => setRange(min, Math.max(Number(e.target.value), min + 1)),
      "aria-label": "Maximum age"
    })));
  }

  /* primary save with a Sage saved-tick (no navigation - Settings is a page) */
  function SaveBar({
    web,
    saved,
    onSave
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: web ? "static" : "sticky",
        bottom: 0,
        marginTop: 8,
        paddingTop: 18,
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
        background: web ? "transparent" : "linear-gradient(to top,var(--cream) 70%,transparent)"
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      onClick: onSave
    }, saved ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 15,
      w: 2.6,
      color: "var(--cream)"
    }), "Saved") : "Save changes"));
  }
  function RowToggle({
    title,
    desc,
    checked,
    onChange
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title), desc && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.5,
        marginTop: 3,
        maxWidth: 460
      }
    }, desc)), /*#__PURE__*/React.createElement(Toggle, {
      checked: checked,
      onChange: onChange
    }));
  }
  function Settings({
    web,
    initialSection,
    back,
    quizDone,
    openQuiz
  }) {
    /* desktop: nav always visible, default to deep-linked section. mobile: list root unless deep-linked. */
    const [active, setActive] = useState(() => initialSection || (web ? "edit" : null));
    useEffect(() => {
      setActive(initialSection || (web ? "edit" : null));
    }, [initialSection, web]);

    /* lifted form state (sections share it) */
    const [intents, setIntents] = useState(() => new Set(["Friends", "Activities"]));
    const [datingMode, setDatingMode] = useState(true); // On/Paused (romantic_visible) - inline with the Open-to-dating intent
    const [bio, setBio] = useState("Moved back to Sydney and after a steady weekend circle - pottery, runs, easy company.");
    const [suburb, setSuburb] = useState("Newtown");
    const [interests, setInterests] = useState(() => new Set(["Pottery", "Run clubs", "Live music", "Wine tasting", "Plants", "Cocktails"]));
    const [music, setMusic] = useState(() => new Set(["Jazz", "Indie", "Soul"]));
    const [showMore, setShowMore] = useState(false);
    const [attendeeVisible, setAttendeeVisible] = useState(true);
    const [dating, setDating] = useState(false);
    const [meet, setMeet] = useState("Everyone");
    const [ageMin, setAgeMin] = useState(25);
    const [ageMax, setAgeMax] = useState(38);
    const [notif, setNotif] = useState({
      mutuals: true,
      plans: true,
      reminders: true,
      digest: true,
      product: false
    });
    const [savedSec, setSavedSec] = useState(null);
    const toggleIntent = k => setIntents(s => {
      const x = new Set(s);
      x.has(k) ? x.delete(k) : x.add(k);
      return x;
    });
    const datingOpen = intents.has("Open to dating");
    const TAGGROUPS = window.DATA.INTEREST_TAGS;
    const GENRES = window.DATA.MUSIC_TAGS;
    const toggleInt = t => setInterests(s => {
      const x = new Set(s);
      x.has(t) ? x.delete(t) : x.add(t);
      return x;
    });
    const toggleMusic = t => setMusic(s => {
      const x = new Set(s);
      x.has(t) ? x.delete(t) : x.add(t);
      return x;
    });
    const save = sec => {
      setSavedSec(sec);
      setTimeout(() => setSavedSec(v => v === sec ? null : v), 1600);
    };
    const renderTagGroup = g => /*#__PURE__*/React.createElement("div", {
      key: g.key,
      style: {
        marginBottom: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: ".03em",
        color: "var(--text-muted)",
        marginBottom: 9
      }
    }, g.label), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, g.tags.map(t => /*#__PURE__*/React.createElement(Tag, {
      key: t,
      selected: interests.has(t),
      onClick: () => toggleInt(t)
    }, t))));
    useEffect(() => {
      const onKey = e => {
        if (e.key === "Escape") {
          if (!web && active) setActive(null);else if (back) back();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [active, web, back]);
    const PHOTOS = 1,
      SLOTS = 5;

    /* ---------------- section bodies ---------------- */
    const EditProfile = () => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, null, "Photos"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(5,1fr)" : "repeat(3,1fr)",
        gap: 10
      }
    }, Array.from({
      length: SLOTS
    }).map((_, i) => i < PHOTOS ? /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        aspectRatio: "1",
        borderRadius: "var(--radius-md)",
        background: "var(--lavender-200)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: "Ava Mendez",
      size: 40
    })) : /*#__PURE__*/React.createElement("button", {
      key: i,
      style: {
        aspectRatio: "1",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-tint)",
        border: "1.5px dashed var(--border-mid)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 18,
      w: 2,
      color: "var(--purple-400)"
    })))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "10px 0 0",
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.5
      }
    }, "Add a few - photos help people put a face to the name.")), /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, null, "About you"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: web ? "grid" : "block",
        gridTemplateColumns: "1fr 1fr",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(FieldRow, {
      label: "Name",
      note: "Managed in Account"
    }, /*#__PURE__*/React.createElement("input", {
      value: "Ava",
      readOnly: true,
      style: {
        ...inputStyle,
        background: "var(--surface-tint)",
        color: "var(--text-muted)"
      }
    })), /*#__PURE__*/React.createElement(FieldRow, {
      label: "Age",
      note: "From your date of birth"
    }, /*#__PURE__*/React.createElement("input", {
      value: "28",
      readOnly: true,
      style: {
        ...inputStyle,
        background: "var(--surface-tint)",
        color: "var(--text-muted)"
      }
    }))), /*#__PURE__*/React.createElement(FieldRow, {
      label: "Suburb"
    }, /*#__PURE__*/React.createElement("input", {
      value: suburb,
      onChange: e => setSuburb(e.target.value),
      style: inputStyle
    }))), /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, null, "Bio"), /*#__PURE__*/React.createElement("textarea", {
      className: "ckPEArea",
      value: bio,
      onChange: e => setBio(e.target.value),
      placeholder: "A line or two in your own words - e.g. potter by hobby, gig-goer by habit."
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "6px 0 0",
        fontSize: 12,
        color: "var(--text-faint)"
      }
    }, bio.length, "/180 - keep it short and yours.")), /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, {
      sub: "Pick any that fit - it just tunes what we show you."
    }, "Here for"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "1fr 1fr" : "1fr",
        gap: 10
      }
    }, INTENTS.map(label => /*#__PURE__*/React.createElement(IntentCard, {
      key: label,
      label: label,
      on: intents.has(label),
      onClick: () => toggleIntent(label)
    }))), datingOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        padding: "14px 16px",
        background: "var(--lavender-100)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--lavender-200)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Dating mode ", datingMode ? "· On" : "· Paused"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.5,
        marginTop: 2
      }
    }, "Only people also open to dating ever see this.")), /*#__PURE__*/React.createElement(Toggle, {
      checked: datingMode,
      onChange: setDatingMode
    })))), /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, {
      sub: "The specific things you're into - not just the broad categories."
    }, "Interests"), TAGGROUPS.slice(0, 8).map(renderTagGroup), showMore && TAGGROUPS.slice(8).filter(g => !g.gated || datingOpen).map(renderTagGroup), /*#__PURE__*/React.createElement("button", {
      onClick: () => setShowMore(v => !v),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-600)"
      }
    }, showMore ? "Show fewer interests" : "+ Show more interests", /*#__PURE__*/React.createElement(Icon, {
      name: showMore ? "chevD" : "chevR",
      size: 15,
      w: 2.2,
      color: "var(--purple-600)",
      style: {
        transform: showMore ? "rotate(180deg)" : "none"
      }
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "16px 0 0",
        fontSize: 13.5,
        fontWeight: 600,
        color: interests.size >= 3 ? "var(--sage)" : "var(--text-muted)"
      }
    }, interests.size === 0 ? "Pick a few you're into" : `${interests.size} picked${interests.size >= 3 ? " - nice" : ""}`)), /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, {
      sub: "A few genres, if you like - optional."
    }, "Music you're into"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, GENRES.map(t => /*#__PURE__*/React.createElement(Tag, {
      key: t,
      selected: music.has(t),
      onClick: () => toggleMusic(t)
    }, t)))), /*#__PURE__*/React.createElement(Group, {
      last: true
    }, /*#__PURE__*/React.createElement("button", {
      onClick: openQuiz,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        padding: web ? "16px 18px" : "15px 16px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-soft)",
        background: "var(--white)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 40,
        height: 40,
        borderRadius: "var(--radius-md)",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "spark",
      size: 20,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, quizDone ? "Update your Click quiz" : "Take the Click quiz"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.45,
        marginTop: 2
      }
    }, quizDone ? "Last updated today" : "It makes your suggestions a lot more relevant.")), /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 18,
      w: 2.1,
      color: "var(--text-faint)"
    }))), /*#__PURE__*/React.createElement(SaveBar, {
      web: web,
      saved: savedSec === "edit",
      onSave: () => save("edit")
    }));
    const Privacy = () => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, null, "Event visibility"), /*#__PURE__*/React.createElement(RowToggle, {
      title: "Show me in event attendee lists",
      desc: "Off means people at your events can't click with you. You'll still see everyone and book anything.",
      checked: attendeeVisible,
      onChange: setAttendeeVisible
    })), /*#__PURE__*/React.createElement(Group, {
      last: true
    }, /*#__PURE__*/React.createElement(SectionHead, {
      sub: "Private to you. The rest of Click stays intent-neutral - this never shows on your profile or in attendee lists."
    }, "Dating"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: dating ? 18 : 0
      }
    }, /*#__PURE__*/React.createElement(RowToggle, {
      title: "Open to dating",
      desc: "When on, we may quietly suggest people who are also open to it. It's never shown publicly.",
      checked: dating,
      onChange: setDating
    })), dating && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "16px 16px 14px",
        background: "var(--lavender-100)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--lavender-200)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        marginBottom: 9
      }
    }, "I'm interested in"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 18
      }
    }, ["Men", "Women", "Everyone"].map(o => /*#__PURE__*/React.createElement("button", {
      key: o,
      onClick: () => setMeet(o),
      "aria-pressed": meet === o,
      style: {
        minHeight: 40,
        padding: "8px 16px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        fontWeight: meet === o ? 600 : 500,
        backgroundColor: meet === o ? "var(--purple-600)" : "var(--white)",
        color: meet === o ? "var(--cream)" : "var(--text-body)",
        border: "1.5px solid " + (meet === o ? "var(--purple-600)" : "var(--border-mid)")
      }
    }, o))), /*#__PURE__*/React.createElement(AgeRange, {
      min: ageMin,
      max: ageMax,
      setRange: (a, b) => {
        setAgeMin(a);
        setAgeMax(b);
      }
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "12px 0 0",
        fontSize: 12,
        color: "var(--purple-800)",
        opacity: .82,
        lineHeight: 1.5
      }
    }, "Only shapes who we suggest - never shown on your profile."))), /*#__PURE__*/React.createElement(SaveBar, {
      web: web,
      saved: savedSec === "privacy",
      onSave: () => save("privacy")
    }));
    const Account = () => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Group, null, /*#__PURE__*/React.createElement(SectionHead, null, "Login"), /*#__PURE__*/React.createElement(FieldRow, {
      label: "Name"
    }, /*#__PURE__*/React.createElement("input", {
      value: "Ava Mendez",
      readOnly: true,
      style: {
        ...inputStyle,
        background: "var(--surface-tint)",
        color: "var(--text-muted)"
      }
    })), /*#__PURE__*/React.createElement(FieldRow, {
      label: "Email"
    }, /*#__PURE__*/React.createElement("input", {
      value: "ava.mendez@email.com",
      readOnly: true,
      style: {
        ...inputStyle,
        background: "var(--surface-tint)",
        color: "var(--text-muted)"
      }
    })), /*#__PURE__*/React.createElement(FieldRow, {
      label: "Date of birth",
      note: "Sets your age; can't be changed here."
    }, /*#__PURE__*/React.createElement("input", {
      value: "14 March 1997",
      readOnly: true,
      style: {
        ...inputStyle,
        background: "var(--surface-tint)",
        color: "var(--text-muted)"
      }
    })), /*#__PURE__*/React.createElement("a", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--purple-600)",
        cursor: "pointer"
      }
    }, "Change password ", /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 15,
      w: 2.1,
      color: "var(--purple-600)"
    }))), /*#__PURE__*/React.createElement(Group, {
      last: true
    }, /*#__PURE__*/React.createElement(SectionHead, null, "Membership"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("a", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-body)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 15,
      w: 2.1,
      color: "var(--text-muted)"
    }), "Sign out"), /*#__PURE__*/React.createElement("a", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        fontWeight: 600,
        color: "var(--coral, #C0563C)",
        cursor: "pointer"
      }
    }, "Pause or delete account"))));
    const Notifications = () => {
      const items = [["mutuals", "New mutuals", "When you and someone both click."], ["plans", "Plan updates", "When a plan is suggested, agreed, or changes."], ["reminders", "Event reminders", "A nudge before something you've booked."], ["digest", "Weekly digest", "What's on near you, once a week."], ["product", "Product news", "Occasional updates from Click."]];
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Group, {
        last: true
      }, /*#__PURE__*/React.createElement(SectionHead, {
        sub: "What we email and notify you about. Separate from the in-app bell."
      }, "Notify me about"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 20
        }
      }, items.map(([k, title, desc]) => /*#__PURE__*/React.createElement(RowToggle, {
        key: k,
        title: title,
        desc: desc,
        checked: notif[k],
        onChange: v => setNotif(s => ({
          ...s,
          [k]: v
        }))
      })))), /*#__PURE__*/React.createElement(SaveBar, {
        web: web,
        saved: savedSec === "notifications",
        onSave: () => save("notifications")
      }));
    };
    const bodyFor = k => k === "edit" ? /*#__PURE__*/React.createElement(EditProfile, null) : k === "privacy" ? /*#__PURE__*/React.createElement(Privacy, null) : k === "account" ? /*#__PURE__*/React.createElement(Account, null) : /*#__PURE__*/React.createElement(Notifications, null);
    const labelFor = k => (SECTIONS.find(s => s[0] === k) || [, "Settings"])[1];

    /* ---------------- chrome ---------------- */
    const styleTag = /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: ".ckPERange{-webkit-appearance:none;appearance:none;background:transparent;position:absolute;top:0;left:0;width:100%;height:28px;margin:0;pointer-events:none}.ckPERange::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:22px;height:22px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);box-shadow:var(--shadow-sm);cursor:pointer;margin-top:-9px}.ckPERange::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);cursor:pointer}.ckPEArea{width:100%;box-sizing:border-box;min-height:90px;padding:12px 14px;background:var(--white);border:1.5px solid var(--border-mid);border-radius:var(--radius-md);font-family:var(--font-sans);font-size:15px;line-height:1.55;color:var(--text-strong);outline:none;resize:vertical}"
      }
    });
    const BackBtn = ({
      onClick,
      label
    }) => /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "6px 0",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevL",
      size: 18,
      w: 2.4,
      color: "var(--text-muted)"
    }), label);

    /* DESKTOP - sticky sub-nav + content */
    if (web) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "8px 0 48px"
        }
      }, styleTag, /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: 1040,
          margin: "0 auto",
          padding: "0 40px"
        }
      }, /*#__PURE__*/React.createElement(BackBtn, {
        onClick: back,
        label: "Back to profile"
      }), /*#__PURE__*/React.createElement("h1", {
        style: {
          margin: "6px 0 26px",
          fontFamily: "var(--font-serif)",
          fontSize: "2.1rem",
          fontWeight: 500,
          letterSpacing: "-.02em",
          color: "var(--text-strong)"
        }
      }, "Settings"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "232px minmax(0,1fr)",
          gap: 44,
          alignItems: "start"
        }
      }, /*#__PURE__*/React.createElement("nav", {
        style: {
          position: "sticky",
          top: 24,
          display: "flex",
          flexDirection: "column",
          gap: 4
        }
      }, SECTIONS.map(([k, label, icon]) => {
        const on = active === k;
        return /*#__PURE__*/React.createElement("button", {
          key: k,
          onClick: () => setActive(k),
          style: {
            display: "flex",
            alignItems: "center",
            gap: 11,
            textAlign: "left",
            padding: "11px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            cursor: "pointer",
            backgroundColor: on ? "var(--lavender-100)" : "transparent",
            color: on ? "var(--purple-800)" : "var(--text-body)",
            fontFamily: "var(--font-sans)",
            fontSize: 14.5,
            fontWeight: on ? 700 : 500
          }
        }, /*#__PURE__*/React.createElement(Icon, {
          name: icon,
          size: 18,
          w: 1.9,
          color: on ? "var(--purple-600)" : "var(--text-muted)"
        }), label);
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("h2", {
        style: {
          margin: "0 0 4px",
          fontFamily: "var(--font-display)",
          fontSize: "1.4rem",
          fontWeight: 600,
          letterSpacing: "-.01em",
          color: "var(--text-strong)"
        }
      }, labelFor(active)), /*#__PURE__*/React.createElement("div", {
        style: {
          height: 1,
          background: "var(--border-soft)",
          margin: "16px 0 0"
        }
      }), bodyFor(active)))));
    }

    /* MOBILE - sectioned list, drill into a section */
    if (active) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "0 0 32px"
        }
      }, styleTag, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "8px 22px 0"
        }
      }, /*#__PURE__*/React.createElement(BackBtn, {
        onClick: () => setActive(null),
        label: "Settings"
      }), /*#__PURE__*/React.createElement("h1", {
        style: {
          margin: "4px 0 0",
          fontFamily: "var(--font-serif)",
          fontSize: "1.7rem",
          fontWeight: 500,
          letterSpacing: "-.02em",
          color: "var(--text-strong)"
        }
      }, labelFor(active))), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "0 22px"
        }
      }, bodyFor(active)));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "0 0 32px"
      }
    }, styleTag, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 22px 0"
      }
    }, /*#__PURE__*/React.createElement(BackBtn, {
      onClick: back,
      label: "Back to profile"
    }), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: "4px 0 18px",
        fontFamily: "var(--font-serif)",
        fontSize: "1.8rem",
        fontWeight: 500,
        letterSpacing: "-.02em",
        color: "var(--text-strong)"
      }
    }, "Settings")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "0 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, SECTIONS.map(([k, label, icon]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      onClick: () => setActive(k),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 16px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-soft)",
        background: "var(--white)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 38,
        height: 38,
        borderRadius: "var(--radius-sm)",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 18,
      w: 1.9,
      color: "var(--purple-600)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 15.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, label), /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 18,
      w: 2.1,
      color: "var(--text-faint)"
    })))));
  }
  window.ScreensSet = {
    Settings
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/settings.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/shell.jsx
try { (() => {
(function () {
  /* Click - app shell: responsive device frame, nav, flow state machine, Tweaks. */
  const {
    useState: uS,
    useEffect: uE,
    useRef: uR,
    Icon: I,
    Logo: L,
    Cmark: CM,
    Avatar: AV,
    Spark: SP,
    SiteFooter: Footer
  } = window.CK;
  const SA = window.ScreensA,
    SB = window.ScreensB,
    Mech = window.ScreensMech;
  const {
    useTweaks,
    TweaksPanel,
    TweakSection,
    TweakRadio,
    TweakSelect,
    TweakToggle
  } = window;
  const DEVICES = {
    phone: 375,
    tablet: 768,
    laptop: 1024,
    desktop: 1440
  };
  const TABS = [["home", "Home", "home"], ["discover", "Discover", "compass"], ["click", "click", "spark"], ["saved", "Events", "calendar"], ["profile", "You", "user"]];

  /* ---------------- loading skeletons live in skeletons.jsx (window.ScreensSkel) ---------------- */
  /* ---------------- bottom tab bar (phone) ---------------- */
  function BottomNav({
    tab,
    go
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-end",
        borderTop: "1px solid var(--border-soft)",
        background: "var(--cream)",
        padding: "8px 6px 22px",
        flex: "none"
      }
    }, TABS.map(([k, label, ic]) => {
      const on = tab === k,
        center = k === "click";
      if (center) return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => go(k),
        style: {
          flex: 1,
          background: "none",
          border: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          cursor: "pointer"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: "var(--purple-600)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-md)",
          marginTop: -14
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          display: "flex",
          transform: "translateY(-2.5px)"
        }
      }, /*#__PURE__*/React.createElement(SP, {
        size: 24,
        big: "var(--cream)",
        small: "var(--cream)"
      }))), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10.5,
          fontWeight: on ? 700 : 600,
          color: on ? "var(--purple-600)" : "var(--ink-muted)"
        }
      }, label));
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => go(k),
        style: {
          flex: 1,
          background: "none",
          border: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          cursor: "pointer",
          color: on ? "var(--purple-600)" : "var(--ink-muted)",
          paddingBottom: 2
        }
      }, /*#__PURE__*/React.createElement(I, {
        name: ic,
        size: 23,
        w: on ? 2.3 : 1.9
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10.5,
          fontWeight: on ? 700 : 500
        }
      }, label));
    }));
  }
  /* ---------------- account menu (avatar dropdown) - ONE component, web popover + mobile sheet ----------------
     Tap (never hover) the avatar to open; grouped destinations + account actions; full keyboard + a11y.
     active = the current destination key so the menu can place you; onNav(key) routes + closes. */
  const ACCT_GROUPS = [[["profile", "Your profile", "user"], ["people", "People", "users"], ["events", "Your events", "calendar"], ["saved", "Saved", "bookmark"]], [["howitworks", "How it works", "help"], ["settings", "Account settings", "settings"]], [["signout", "Sign out", "logout"]]];
  function AccountMenu({
    web,
    open,
    onClose,
    active,
    onNav,
    returnFocus
  }) {
    const menuRef = uR(null);
    uE(() => {
      if (!open) return;
      const t = setTimeout(() => {
        const f = menuRef.current && menuRef.current.querySelector('[role="menuitem"]');
        f && f.focus();
      }, 20);
      return () => clearTimeout(t);
    }, [open]);
    uE(() => {
      if (!open) return;
      const onKey = e => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          returnFocus && returnFocus.current && returnFocus.current.focus();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open]);
    if (!open) return null;
    const onArrow = e => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
      const i = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next] && items[next].focus();
    };
    let idx = 0;
    const Row = ([k, label, icon]) => {
      const on = active === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        role: "menuitem",
        tabIndex: -1,
        className: "ckAcctRow",
        onClick: () => onNav(k),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          textAlign: "left",
          border: "none",
          cursor: "pointer",
          background: on ? "var(--lavender-100)" : "transparent",
          borderRadius: 12,
          padding: web ? "0 12px" : "0 14px",
          minHeight: web ? 44 : 48,
          fontFamily: "var(--font-sans)",
          fontSize: web ? 14.5 : 15,
          fontWeight: on ? 600 : 500,
          color: on ? "var(--purple-800)" : "var(--text-strong)",
          transition: "background-color .12s"
        },
        onMouseEnter: ev => {
          if (!on) ev.currentTarget.style.background = "var(--surface-tint)";
        },
        onMouseLeave: ev => {
          if (!on) ev.currentTarget.style.background = "transparent";
        }
      }, /*#__PURE__*/React.createElement(I, {
        name: icon,
        size: 18,
        w: 1.9,
        color: on ? "var(--purple-600)" : "var(--text-muted)"
      }), label);
    };
    const styleTag = /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: ".ckAcctRow:focus-visible{outline:2px solid var(--purple-600);outline-offset:-2px}@keyframes ckAcctPop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes ckAcctSheet{from{transform:translateY(100%)}to{transform:none}}@media (prefers-reduced-motion: reduce){.ckAcctAnim{animation:none!important}}"
      }
    });
    const Header = /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: web ? "10px 12px 12px" : "6px 14px 14px"
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: "Ava Mendez",
      size: web ? 42 : 44
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.25,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, "Signed in as Ava"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, "ava.mendez@email.com")));
    const hair = /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "var(--border-soft)",
        margin: web ? "6px 4px" : "8px 6px"
      }
    });
    const groups = ACCT_GROUPS.map((g, gi) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: gi
    }, gi > 0 && hair, g.map(Row)));
    if (web) {
      return /*#__PURE__*/React.createElement(React.Fragment, null, styleTag, /*#__PURE__*/React.createElement("div", {
        onClick: onClose,
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "transparent"
        }
      }), /*#__PURE__*/React.createElement("div", {
        ref: menuRef,
        role: "menu",
        "aria-label": "Account menu",
        onKeyDown: onArrow,
        className: "ckAcctAnim",
        style: {
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          zIndex: 41,
          width: 300,
          background: "var(--white)",
          borderRadius: 16,
          border: "1px solid var(--border-soft)",
          boxShadow: "0 18px 44px rgba(76,55,140,.18)",
          padding: 8,
          animation: "ckAcctPop .14s cubic-bezier(.2,.7,.3,1) both"
        }
      }, Header, hair, groups));
    }
    /* mobile - bottom sheet */
    return /*#__PURE__*/React.createElement(React.Fragment, null, styleTag, /*#__PURE__*/React.createElement("div", {
      onClick: onClose,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(25,19,58,.34)"
      },
      className: "ckAcctAnim"
    }), /*#__PURE__*/React.createElement("div", {
      ref: menuRef,
      role: "menu",
      "aria-label": "Account menu",
      onKeyDown: onArrow,
      className: "ckAcctAnim",
      style: {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 61,
        background: "var(--white)",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        boxShadow: "0 -16px 44px rgba(25,19,58,.28)",
        padding: "8px 8px max(16px,env(safe-area-inset-bottom))",
        animation: "ckAcctSheet .18s cubic-bezier(.2,.7,.3,1) both"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        padding: "6px 0 10px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 38,
        height: 4,
        borderRadius: 2,
        background: "var(--border-mid)"
      }
    })), Header, hair, groups));
  }
  function AvatarMenuTrigger({
    web,
    size,
    active,
    onNav
  }) {
    const [open, setOpen] = uS(false);
    const btnRef = uR(null);
    const nav = k => {
      setOpen(false);
      onNav(k);
    };
    const onProfile = active === "profile";
    return /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement("button", {
      ref: btnRef,
      onClick: () => setOpen(o => !o),
      "aria-haspopup": "menu",
      "aria-expanded": open,
      "aria-label": "Account menu",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: "none",
        background: "none",
        cursor: "pointer",
        borderRadius: "var(--radius-pill)",
        padding: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        borderRadius: "50%",
        boxShadow: onProfile || open ? "0 0 0 2.5px var(--purple-300)" : "none"
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: "Ava Mendez",
      size: size
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        transition: "transform .15s",
        transform: open ? "rotate(180deg)" : "none"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "chevD",
      size: 14,
      w: 2,
      color: "var(--text-muted)"
    }))), /*#__PURE__*/React.createElement(AccountMenu, {
      web: web,
      open: open,
      onClose: () => setOpen(false),
      active: active,
      onNav: nav,
      returnFocus: btnRef
    }));
  }
  /* ---------------- top nav (web) ---------------- */
  function TopNav({
    tab,
    go,
    notify,
    onBell,
    acctActive,
    onAccount
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 40px",
        background: "var(--cream)",
        borderBottom: "1px solid var(--border-soft)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => go("home"),
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(L, {
      size: 26
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, TABS.filter(t => t[0] !== "profile").map(([k, label, ic]) => {
      const on = tab === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => go(k),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 15px",
          borderRadius: "var(--radius-pill)",
          border: "none",
          cursor: "pointer",
          background: on ? "var(--lavender-100)" : "transparent",
          color: on ? "var(--purple-700)" : "var(--text-body)",
          fontFamily: "var(--font-sans)",
          fontSize: 14.5,
          fontWeight: on ? 600 : 500
        }
      }, k === "click" ? /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-flex",
          transform: "translateY(-2px)",
          marginRight: -1
        }
      }, /*#__PURE__*/React.createElement(SP, {
        size: 20,
        big: "var(--purple-600)",
        small: "var(--purple-400)"
      })) : /*#__PURE__*/React.createElement(I, {
        name: ic,
        size: 18,
        w: 2
      }), label);
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onBell,
      "aria-label": "Notifications",
      style: {
        position: "relative",
        border: "none",
        background: "none",
        cursor: "pointer",
        width: 38,
        height: 38,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "bell",
      size: 20,
      w: 1.9,
      color: "var(--text-body)"
    }), notify > 0 && (notify > 1 ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 3,
        right: 3,
        minWidth: 16,
        height: 16,
        padding: "0 4px",
        borderRadius: 9,
        background: "var(--purple-600)",
        color: "var(--cream)",
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: "16px",
        textAlign: "center",
        boxSizing: "border-box",
        boxShadow: "0 0 0 2px var(--cream)"
      }
    }, notify > 9 ? "9+" : notify) : /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 7,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--purple-600)",
        boxShadow: "0 0 0 2px var(--cream)"
      }
    }))), /*#__PURE__*/React.createElement(AvatarMenuTrigger, {
      web: true,
      size: 38,
      active: acctActive,
      onNav: onAccount
    })));
  }

  /* push-style MUTUAL NOTIFICATION (bell + locked copy) - fires when a mutual happens while away */
  function MutualToast({
    web,
    name,
    onOpen,
    onClose
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        top: web ? 20 : 64,
        left: 0,
        right: 0,
        zIndex: 64,
        display: "flex",
        justifyContent: "center",
        padding: "0 14px",
        pointerEvents: "none"
      }
    }, /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: "@keyframes ckToast{0%{opacity:0;transform:translateY(-14px)}100%{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.ckToast{animation:none!important}}"
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "ckToast",
      onClick: onOpen,
      style: {
        pointerEvents: "auto",
        cursor: "pointer",
        width: "100%",
        maxWidth: 380,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--cream)",
        border: "1px solid var(--lavender-300)",
        borderRadius: 14,
        boxShadow: "0 16px 40px rgba(25,19,58,.22)",
        padding: "12px 14px",
        animation: "ckToast .4s cubic-bezier(.2,.7,.3,1) both"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 36,
        height: 36,
        borderRadius: 11,
        background: "var(--purple-600)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "bell",
      size: 18,
      w: 2,
      color: "var(--cream)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)",
        lineHeight: 1.3
      }
    }, "It's mutual - you clicked with ", (name || "").split(" ")[0], ". ", /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true"
    }, "\u2728")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        marginTop: 1
      }
    }, "Tap to see who \xB7 Click")), /*#__PURE__*/React.createElement("button", {
      onClick: ev => {
        ev.stopPropagation();
        onClose();
      },
      "aria-label": "Dismiss",
      style: {
        flex: "none",
        border: "none",
        background: "none",
        cursor: "pointer",
        display: "flex",
        padding: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "x",
      size: 15,
      w: 2.2,
      color: "var(--text-muted)"
    }))));
  }

  /* ---------------- phone frame: mobile WEB (browser on a phone, not a native app) ---------------- */
  function PhoneFrame({
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        width: 399,
        height: 812,
        background: "var(--cream)",
        borderRadius: 46,
        boxShadow: "0 30px 80px rgba(25,19,58,.34),0 0 0 11px #0f0b22,0 0 0 12px #2a2350",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        height: 52,
        background: "#ECE6DC",
        borderBottom: "1px solid #E0D8CA",
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "0 14px 0 16px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        background: "var(--white)",
        borderRadius: "var(--radius-pill)",
        padding: "7px 14px",
        fontSize: 12.5,
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "lock",
      size: 12,
      w: 2,
      color: "var(--text-muted)"
    }), "click.au"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3,
        flex: "none"
      }
    }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("i", {
      key: i,
      style: {
        width: 18,
        height: 2,
        borderRadius: 2,
        background: "var(--text-muted)"
      }
    })))), children);
  }
  /* ---------------- mobile web site nav (top, scrollable pills) ---------------- */
  function MobileTopNav({
    tab,
    go,
    notify,
    onBell,
    acctActive,
    onAccount
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--cream)",
        borderBottom: "1px solid var(--border-soft)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => go("home"),
      style: {
        cursor: "pointer",
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement(L, {
      size: 23
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onBell,
      "aria-label": "Notifications",
      style: {
        position: "relative",
        border: "none",
        background: "none",
        cursor: "pointer",
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "bell",
      size: 20,
      w: 1.9,
      color: "var(--text-body)"
    }), notify && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 8,
        right: 9,
        minWidth: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--purple-600)",
        boxShadow: "0 0 0 2px var(--cream)"
      }
    })), /*#__PURE__*/React.createElement(AvatarMenuTrigger, {
      web: false,
      size: 36,
      active: acctActive,
      onNav: onAccount
    }))));
  }
  /* ---------------- browser frame (web) ---------------- */
  function BrowserFrame({
    children,
    width,
    scrollRef
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        width,
        height: 824,
        background: "var(--cream)",
        borderRadius: 16,
        boxShadow: "0 30px 80px rgba(25,19,58,.28)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border-mid)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 46,
        flex: "none",
        background: "#ECE6DC",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 16px",
        borderBottom: "1px solid #E0D8CA"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 7
      }
    }, ["#E66A5A", "#E9B44C", "#6BBF73"].map(c => /*#__PURE__*/React.createElement("i", {
      key: c,
      style: {
        width: 11,
        height: 11,
        borderRadius: "50%",
        background: c
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        maxWidth: 340,
        background: "var(--white)",
        borderRadius: "var(--radius-pill)",
        padding: "6px 16px",
        fontSize: 12.5,
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "lock",
      size: 12,
      w: 2,
      color: "var(--text-muted)"
    }), "click.au")), /*#__PURE__*/React.createElement("div", {
      ref: scrollRef,
      style: {
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column"
      }
    }, children));
  }

  /* ---------------- notifications: data + panel (positive-only, grouped, read/unread) ---------------- */
  const NOTIFS = [{
    id: "n1",
    group: "today",
    kind: "mutual",
    name: "Mia R.",
    spark: true,
    unread: true,
    time: "2m",
    text: "You clicked with Mia - suggest a plan",
    action: "coord"
  }, {
    id: "n2",
    group: "today",
    kind: "proposal",
    name: "Mia R.",
    unread: true,
    time: "18m",
    text: "Mia suggested Greenhouse terrarium - you in?",
    action: "coord"
  }, {
    id: "n3",
    group: "today",
    kind: "waitlist",
    icon: "clock",
    unread: true,
    time: "40m",
    text: "A spot opened at Wheel throwing - you've got 30 minutes",
    action: "event:ev6"
  }, {
    id: "n4",
    group: "today",
    kind: "both",
    name: "Tom B.",
    spark: true,
    unread: false,
    time: "3h",
    text: "You're both going to Greenhouse terrarium",
    action: "event:ev2"
  }, {
    id: "n5",
    group: "earlier",
    kind: "postevent",
    icon: "users",
    unread: false,
    time: "Yesterday",
    text: "Good night at Pasta from scratch? Did you click with anyone?",
    action: "window"
  }, {
    id: "n6",
    group: "earlier",
    kind: "reminder",
    icon: "calendar",
    unread: false,
    time: "Yesterday",
    text: "Wheel throwing is tomorrow, 6:30pm - venue's unlocked",
    action: "event:ev6"
  }];
  function NotifRow({
    n,
    unread,
    onClick
  }) {
    const lead = n.name ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(AV, {
      name: n.name,
      size: 38
    }), n.spark && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        bottom: -2,
        right: -3,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(SP, {
      size: 13
    }))) : /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "var(--lavender-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: n.icon || "bell",
      size: 18,
      w: 1.9,
      color: "var(--purple-600)"
    }));
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      style: {
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderBottom: "1px solid var(--border-soft)",
        cursor: "pointer",
        padding: "13px 18px",
        background: unread ? "var(--lavender-100)" : "transparent"
      }
    }, lead, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 14,
        color: "var(--text-strong)",
        lineHeight: 1.42,
        fontWeight: unread ? 600 : 500
      }
    }, n.text), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 12,
        color: "var(--text-faint)",
        marginTop: 3
      }
    }, n.time)), unread && /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--purple-600)",
        marginTop: 7
      }
    }));
  }
  function NotifPanel({
    web,
    readSet,
    onClose,
    onRow,
    onMarkAll
  }) {
    const isUnread = n => n.unread && !readSet.has(n.id);
    const groups = [["Today", "today"], ["Earlier", "earlier"]];
    const anyLeft = NOTIFS.length > 0;
    return /*#__PURE__*/React.createElement("div", {
      onClick: onClose,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 58,
        background: web ? "transparent" : "rgba(28,24,48,.4)",
        display: "flex",
        alignItems: web ? "flex-start" : "flex-end",
        justifyContent: web ? "flex-end" : "center"
      }
    }, /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: "@keyframes ckNotif{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:none}}@keyframes ckSheet{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.ckNotif,.ckSheet{animation:none!important}}"
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: web ? "ckNotif" : "ckSheet",
      onClick: e => e.stopPropagation(),
      style: {
        ...(web ? {
          margin: "56px 40px 0 0",
          width: 374,
          borderRadius: 18,
          maxHeight: "74vh"
        } : {
          width: "100%",
          borderRadius: "20px 20px 0 0",
          maxHeight: "82vh"
        }),
        background: "var(--cream)",
        boxShadow: "0 24px 60px rgba(25,19,58,.28)",
        border: "1px solid var(--border-soft)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: web ? "ckNotif .22s ease both" : "ckSheet .3s cubic-bezier(.2,.7,.3,1) both"
      }
    }, !web && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        padding: "9px 0 3px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 38,
        height: 4,
        borderRadius: 4,
        background: "var(--border-mid)"
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: web ? "15px 18px" : "10px 18px 13px",
        borderBottom: "1px solid var(--border-soft)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 16,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Notifications"), anyLeft && /*#__PURE__*/React.createElement("button", {
      onClick: onMarkAll,
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--purple-600)",
        padding: "2px 0"
      }
    }, "Mark all as read")), /*#__PURE__*/React.createElement("div", {
      style: {
        overflowY: "auto"
      }
    }, !anyLeft ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "44px 26px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "var(--surface-tint)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(I, {
      name: "bell",
      size: 20,
      w: 1.8,
      color: "var(--text-muted)"
    }))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14.5,
        color: "var(--text-body)"
      }
    }, "You're all caught up.")) : groups.map(([label, key]) => {
      const rows = NOTIFS.filter(n => n.group === key);
      if (rows.length === 0) return null;
      return /*#__PURE__*/React.createElement("div", {
        key: key
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "11px 18px 6px",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-faint)"
        }
      }, label), rows.map(n => /*#__PURE__*/React.createElement(NotifRow, {
        key: n.id,
        n: n,
        unread: isUnread(n),
        onClick: () => onRow(n)
      })));
    }))));
  }

  /* ---------------- root app ---------------- */
  function Root() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const [device, setDevice] = uS("phone");
    const [view, setView] = uS("landing"); // landing | auth | howitworks | onboarding | app
    const [authStart, setAuthStart] = uS("signup");
    const [tab, setTab] = uS("home");
    const [screen, setScreen] = uS(null); // null | event | window | suggest | coordinate | loading
    const [ev, setEv] = uS(window.DATA.byId("ev1"));
    const [booked, setBooked] = uS(false);
    const [waitlist, setWaitlist] = uS(false);
    const [picked, setPicked] = uS([]);
    const [winState, setWinState] = uS("locked");
    const [winMode, setWinMode] = uS("default"); // default | empty | closed | ineligible
    const [coordStep, setCoordStep] = uS("suggest");
    const [coordOpen, setCoordOpen] = uS(false);
    const [planWith, setPlanWith] = uS(null); // drawer→page→drawer bridge: name we're locking a plan with
    const [coordReturn, setCoordReturn] = uS(null); // step to return to in the drawer after the booking
    const [mutualOpen, setMutualOpen] = uS(false);
    const [mutualToast, setMutualToast] = uS(false);
    const [mName, setMName] = uS("Mia R.");
    const [notifOpen, setNotifOpen] = uS(false);
    const [quizOpen, setQuizOpen] = uS(false);
    const [quizDone, setQuizDone] = uS(false);
    const [loadKind, setLoadKind] = uS("dashboard"); // which page's loading skeleton to show
    const [settingsSection, setSettingsSection] = uS("edit");
    const [myEventsTab, setMyEventsTab] = uS("upcoming");
    const [notifSeen, setNotifSeen] = uS(false);
    const [notifRead, setNotifRead] = uS(() => new Set());
    const [scale, setScale] = uS(1);
    const [stripH, setStripH] = uS(64);
    const stageRef = uR(null);
    const stripRef = uR(null);
    const scrollRef = uR(null);
    const web = device !== "phone";
    const W = DEVICES[device];
    const frameW = web ? W : 399,
      frameH = web ? 824 : 812;
    const visible = t.visibility !== "off";
    uE(() => {
      const fit = () => {
        const vw = window.innerWidth,
          vh = window.innerHeight;
        if (vw < 200 || vh < 200) return;
        const sh = stripRef.current ? stripRef.current.offsetHeight : 64;
        setStripH(sh);
        setScale(Math.max(0.2, Math.min(1, (vw - 48) / frameW, (vh - sh - 48) / frameH)));
      };
      fit();
      const raf = requestAnimationFrame(fit);
      const tid = setTimeout(fit, 250);
      window.addEventListener("resize", fit);
      return () => {
        window.removeEventListener("resize", fit);
        cancelAnimationFrame(raf);
        clearTimeout(tid);
      };
    }, [frameW, frameH]);

    /* every navigation (tab / screen / view change) lands at the TOP of the page */
    uE(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = 0;
    }, [view, tab, screen, authStart]);

    /* ---- navigation helpers ---- */
    const open = e => {
      const bk = !!(e && window.DATA.BOOKINGS.includes(e.id));
      const fl = !!(e && (e.full || e.status === "soldout" || e.cap != null && e.count >= e.cap));
      setEv(e);
      setBooked(bk);
      setWaitlist(!bk && fl);
      setPlanWith(null);
      setCoordReturn(null);
      setScreen("event");
    };
    /* drawer RSVP deep-link → Event Detail carrying the proposal context (planWith + coord_group),
       remembering the drawer step to return to once the booking is confirmed */
    const onCoordRSVP = (e, name) => {
      setCoordOpen(false);
      setMName(name);
      setPlanWith(name);
      setCoordReturn("both");
      setEv(e);
      setBooked(false);
      setWaitlist(false);
      setScreen("event");
    };
    /* booking confirm: if it came from a plan, return to the coordination drawer at "It's on" */
    const onEventBook = () => {
      setBooked(true);
      setWaitlist(false);
      setCoordReturn(null);
    };
    const [saved, setSaved] = uS(new Set(window.DATA.SAVED));
    const toggleSave = id => setSaved(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    const [discoverCat, setDiscoverCat] = uS("all");
    const goTab = k => {
      setScreen(null);
      setTab(k);
    };
    /* account/avatar dropdown - routes to the user's own surfaces + account actions */
    const accountNav = k => {
      setScreen(null);
      setMutualOpen(false);
      setCoordOpen(false);
      setMutualToast(false);
      setNotifOpen(false);
      if (k === "profile") {
        setView("app");
        setTab("profile");
        return;
      }
      if (k === "people") {
        setView("app");
        setTab("click");
        return;
      }
      if (k === "events") {
        setMyEventsTab("upcoming");
        setView("app");
        setTab("saved");
        return;
      }
      if (k === "saved") {
        setMyEventsTab("saved");
        setView("app");
        setTab("saved");
        return;
      }
      if (k === "howitworks") {
        setView("howitworks");
        return;
      }
      if (k === "settings") {
        setSettingsSection("edit");
        setView("app");
        setScreen("settings");
        return;
      }
      if (k === "signout") {
        setView("landing");
        return;
      }
    };
    const acctActive = (() => {
      if (view === "howitworks") return "howitworks";
      if (screen === "settings") return "settings";
      if (view !== "app") return null;
      if (tab === "profile") return "profile";
      if (tab === "click") return "people";
      if (tab === "saved") return myEventsTab === "saved" ? "saved" : "events";
      return null;
    })();
    /* "See all on your radar" → Click (people) page, scrolled to its radar section */
    const openRadar = () => {
      setScreen(null);
      setMutualOpen(false);
      setCoordOpen(false);
      setView("app");
      setTab("click");
      setTimeout(() => {
        const c = scrollRef.current,
          el = c && c.querySelector("#click-radar");
        if (c && el) {
          c.scrollTop = el.offsetTop - 12;
        }
      }, 60);
    };
    const openDiscover = key => {
      setDiscoverCat(key && key !== "all" ? key : "all");
      setScreen(null);
      setView("app");
      setTab("discover");
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      }, 0);
    };
    const pickPerson = n => setPicked(p => p.includes(n) ? p : p.length >= 3 ? p : [...p, n]);
    const openWin = (e, mode) => {
      setEv(e || window.DATA.byId(window.DATA.RECENT));
      setWinMode(mode || "default");
      setMutualOpen(false);
      setScreen("window");
    };
    /* coordination is ONE overlay DRAWER over Your clicks - never a separate full page */
    const openCoord = step => {
      setMutualOpen(false);
      setMutualToast(false);
      setScreen(null);
      setView("app");
      setTab("click");
      setCoordStep(step || "suggest");
      setCoordOpen(true);
    };
    const openSuggest = () => openCoord("suggest");
    const footerNav = k => {
      setScreen(null);
      setMutualOpen(false);
      setCoordOpen(false);
      setMutualToast(false);
      if (k === "howitworks") {
        setView("howitworks");
        return;
      }
      if (k === "merchant") {
        setView("app");
        setTab("home");
        setScreen("merchant");
        return;
      }
      setView("app");
      setTab(k);
    };

    /* ---- notifications (positive-only; bell dot clears on open) ---- */
    const unreadCount = NOTIFS.filter(n => n.unread && !notifRead.has(n.id)).length;
    const showNotifDot = unreadCount > 0 && !notifSeen;
    const openNotifs = () => {
      setNotifSeen(true);
      setNotifOpen(true);
    };
    const markAllRead = () => setNotifRead(new Set(NOTIFS.map(n => n.id)));
    const onNotifRow = n => {
      setNotifRead(s => {
        const x = new Set(s);
        x.add(n.id);
        return x;
      });
      setNotifOpen(false);
      const a = n.action || "";
      if (a === "coord") {
        if (n.kind === "mutual") {
          setMName(n.name || "Mia R.");
          setMutualToast(false);
          setView("app");
          setTab("click");
          setMutualOpen(true);
        } else {
          openCoord("suggest");
        }
        return;
      }
      if (a === "window") {
        const recent = window.DATA.byId(window.DATA.RECENT);
        setMutualOpen(false);
        setCoordOpen(false);
        setEv(recent);
        setWinMode("default");
        setView("app");
        setScreen("window");
        setTab("home");
        return;
      }
      if (a.indexOf("event:") === 0) {
        setMutualOpen(false);
        setCoordOpen(false);
        setView("app");
        open(window.DATA.byId(a.slice(6)));
        return;
      }
    };

    /* ---- jump-to (Tweaks + top strip) ---- */
    const JUMPS = [["landing", "1 · Landing"], ["howitworks", "1 · How it works"], ["auth-signup", "1 · Auth · sign up"], ["auth-signin", "1 · Auth · sign in"], ["auth-error", "1 · Auth · wrong credentials"], ["auth-verify", "1 · Auth · verify gate"], ["auth-reset", "1 · Auth · reset password"], ["onboarding", "1 · Onboarding (4 steps)"], ["quiz", "1 · Click quiz"], ["home", "2 · Home · returning (Mode B)"], ["home-a", "2 · Home · first-time (Mode A)"], ["loading", "2 · Home · loading"], ["loading-discover", "3 · Discover · loading"], ["loading-event", "3 · Event · loading"], ["loading-myevents", "3 · My events · loading"], ["loading-window", "4 · Who was there · loading"], ["loading-clicks", "5 · Your clicks · loading"], ["loading-profile", "6 · Profile · loading"], ["discover", "3 · Discover (status states)"], ["event", "3 · Event · locked"], ["event-almostfull", "3 · Event · almost full"], ["event-trending", "3 · Event · trending"], ["event-free", "3 · Event · free"], ["event-waitlist", "3 · Event · waitlist"], ["event-booked", "3 · Event · unlocked (booked)"], ["saved", "3 · My events (list + calendar)"], ["window", "4 · Who was there (post-event)"], ["mutual", "4 · Mutual reveal ✨"], ["mutual-notify", "4 · Mutual notification ✨"], ["notifications", "4 · Notifications panel"], ["coord-suggest", "4 · Suggest a plan"], ["coord-onein", "4 · One person in"], ["coord-rsvp", "4 · Agreed · save your spot"], ["coord-both", "4 · You're both going ✨"], ["coord-seatfilled", "4 · Recovery · just filled up"], ["coord-connected", "4 · Love that (closure) ✨"], ["coord-released", "4 · Soft-release"], ["click", "5+6 · Your clicks"], ["profile", "People · Profile + visibility"], ["settings", "6 · Settings (edit · privacy · account · notifications)"], ["merchant", "7 · Merchant portal"], ["merchant-create", "7 · Merchant · create event"], ["merchant-apply", "7 · Merchant · become a host"]];
    const jumpTo = k => {
      setScreen(null);
      setMutualOpen(false);
      setCoordOpen(false);
      setMutualToast(false);
      setNotifOpen(false);
      setQuizOpen(false);
      if (k === "landing") {
        setView("landing");
        return;
      }
      if (k === "howitworks") {
        setView("howitworks");
        return;
      }
      if (k === "auth-signup") {
        setAuthStart("signup");
        setView("auth");
        return;
      }
      if (k === "auth-signin") {
        setAuthStart("signin");
        setView("auth");
        return;
      }
      if (k === "auth-error") {
        setAuthStart("signin-error");
        setView("auth");
        return;
      }
      if (k === "auth-verify") {
        setAuthStart("verify");
        setView("auth");
        return;
      }
      if (k === "auth-reset") {
        setAuthStart("reset");
        setView("auth");
        return;
      }
      if (k === "onboarding") {
        setView("onboarding");
        return;
      }
      if (k === "quiz") {
        setView("app");
        setTab("home");
        setQuizOpen(true);
        return;
      }
      setView("app");
      if (k === "loading") {
        setLoadKind("dashboard");
        setTab("home");
        setScreen("loading");
        return;
      }
      if (k && k.indexOf("loading-") === 0) {
        setLoadKind(k.slice(8));
        setScreen("loading");
        return;
      }
      if (k === "home") {
        setTweak("dashMode", "returning");
        setTab("home");
        return;
      }
      if (k === "home-a") {
        setTweak("dashMode", "firstrun");
        setTab("home");
        return;
      }
      if (["discover", "saved", "profile", "click"].includes(k)) {
        setTab(k);
        return;
      }
      if (k === "event") {
        setEv(window.DATA.byId("ev3"));
        setBooked(false);
        setWaitlist(false);
        setScreen("event");
        return;
      }
      if (k === "event-almostfull") {
        setEv(window.DATA.byId("ev6"));
        setBooked(false);
        setWaitlist(false);
        setScreen("event");
        return;
      }
      if (k === "event-trending") {
        setEv(window.DATA.byId("ev2"));
        setBooked(false);
        setWaitlist(false);
        setScreen("event");
        return;
      }
      if (k === "event-free") {
        setEv(window.DATA.byId("ev4"));
        setBooked(false);
        setWaitlist(false);
        setScreen("event");
        return;
      }
      if (k === "event-waitlist") {
        setEv(window.DATA.byId("ev6"));
        setBooked(false);
        setWaitlist(true);
        setScreen("event");
        return;
      }
      if (k === "event-booked") {
        setEv(window.DATA.byId("ev1"));
        setBooked(true);
        setWaitlist(false);
        setScreen("event");
        return;
      }
      if (k === "settings") {
        setSettingsSection("edit");
        setScreen("settings");
        return;
      }
      if (k === "merchant") {
        setTab("home");
        setScreen("merchant");
        return;
      }
      if (k === "merchant-create") {
        setTab("home");
        setScreen("merchant-create");
        return;
      }
      if (k === "merchant-apply") {
        setTab("home");
        setScreen("merchant-apply");
        return;
      }
      const recent = window.DATA.byId(window.DATA.RECENT);
      if (k === "window") {
        setEv(recent);
        setWinMode("default");
        setScreen("window");
        setTab("home");
        return;
      }
      if (k === "mutual") {
        setEv(recent);
        setWinMode("default");
        setMName("Mia R.");
        setScreen("window");
        setMutualOpen(true);
        setTab("home");
        return;
      }
      if (k === "mutual-notify") {
        setMName("Mia R.");
        setMutualToast(true);
        setTab("home");
        return;
      }
      if (k === "notifications") {
        setTab("home");
        setNotifSeen(true);
        setNotifOpen(true);
        return;
      }
      if (k && k.indexOf("coord-") === 0) {
        setView("app");
        setTab("click");
        setScreen(null);
        setMName("Mia R.");
        setCoordStep(k.slice(6));
        setCoordOpen(true);
        return;
      }
    };
    const curKey = (() => {
      if (view === "landing") return "landing";
      if (view === "howitworks") return "howitworks";
      if (view === "auth") return authStart === "signin" ? "auth-signin" : authStart === "signin-error" ? "auth-error" : authStart === "verify" ? "auth-verify" : authStart === "reset" ? "auth-reset" : "auth-signup";
      if (view === "onboarding") return "onboarding";
      if (quizOpen) return "quiz";
      if (screen === "event") {
        if (booked) return "event-booked";
        if (waitlist) return "event-waitlist";
        return {
          ev6: "event-almostfull",
          ev2: "event-trending",
          ev4: "event-free"
        }[ev.id] || "event";
      }
      if (screen === "settings") return "settings";
      if (screen === "merchant") return "merchant";
      if (screen === "merchant-create") return "merchant-create";
      if (screen === "merchant-apply") return "merchant-apply";
      if (mutualOpen) return "mutual";
      if (mutualToast) return "mutual-notify";
      if (notifOpen) return "notifications";
      if (coordOpen) return "coord-" + coordStep;
      if (screen === "window") return "window";
      if (screen === "loading") return loadKind === "dashboard" ? "loading" : "loading-" + loadKind;
      if (tab === "home") return t.dashMode === "firstrun" ? "home-a" : "home";
      return tab;
    })();

    /* ---- render current screen ---- */
    let body,
      dark = false,
      noChrome = false;
    if (view === "landing") {
      body = /*#__PURE__*/React.createElement(SA.Landing, {
        web: web,
        enter: () => {
          setView("app");
          setTab("home");
        },
        auth: start => {
          setAuthStart(start || "signup");
          setView("auth");
        }
      });
      noChrome = true;
    } else if (view === "howitworks") {
      body = /*#__PURE__*/React.createElement(window.ScreensHIW.HowItWorks, {
        web: web,
        enter: () => {
          setView("app");
          setTab("home");
        },
        founding: () => {
          setView("app");
          setTab("home");
        }
      });
      noChrome = true;
    } else if (view === "auth") {
      body = /*#__PURE__*/React.createElement(window.ScreensAuth.Auth, {
        key: authStart,
        web: web,
        start: authStart,
        done: () => {
          setView("app");
          setTab("home");
        }
      });
      noChrome = true;
    } else if (view === "onboarding") {
      body = /*#__PURE__*/React.createElement(window.ScreensOnb.Onboarding, {
        web: web,
        done: () => {
          setView("app");
          setTab("home");
        }
      });
      noChrome = true;
    } else if (screen === "event") body = /*#__PURE__*/React.createElement(window.ScreensED.EventDetail, {
      e: ev,
      web: web,
      width: W,
      back: () => setScreen(null),
      booked: booked,
      book: onEventBook,
      saved: saved.has(ev.id),
      toggleSave: () => toggleSave(ev.id),
      waitlist: waitlist,
      planWith: planWith
    });else if (screen === "window") body = /*#__PURE__*/React.createElement(Mech.WhoWasThere, {
      web: web,
      event: ev,
      mode: winMode,
      datingViewer: t.whoDating === "on",
      onClose: () => {
        setScreen(null);
        setTab("home");
      },
      onDiscover: () => openDiscover(),
      onMutual: n => {
        setMName(n);
        setMutualOpen(true);
      },
      onConnected: () => openCoord("connected"),
      onSuggest: () => openCoord("suggest"),
      onHow: () => setView("howitworks")
    });else if (screen === "loading") body = /*#__PURE__*/React.createElement(window.ScreensSkel.Skeleton, {
      web: web,
      kind: loadKind
    });else if (screen === "merchant") body = /*#__PURE__*/React.createElement(window.ScreensMerch.Portal, {
      web: web,
      fresh: t.merchState === "new",
      createEvent: () => setScreen("merchant-create")
    });else if (screen === "merchant-create") body = /*#__PURE__*/React.createElement(window.ScreensMerchCreate.CreateEvent, {
      web: web,
      done: () => setScreen("merchant"),
      cancel: () => setScreen("merchant")
    });else if (screen === "merchant-apply") body = /*#__PURE__*/React.createElement(window.ScreensMerch.Apply, {
      web: web,
      done: () => setScreen("merchant")
    });else if (screen === "settings") body = /*#__PURE__*/React.createElement(window.ScreensSet.Settings, {
      web: web,
      initialSection: settingsSection,
      back: () => {
        setScreen(null);
        setTab("profile");
      },
      quizDone: quizDone,
      openQuiz: () => setQuizOpen(true)
    });else if (tab === "home") body = /*#__PURE__*/React.createElement(window.ScreensDash.Dashboard, {
      web: web,
      mode: t.dashMode === "firstrun" ? "firstrun" : "returning",
      showPrompt: t.postPrompt !== "off",
      open: open,
      saved: saved,
      toggleSave: toggleSave,
      openWin: openWin,
      openDiscover: openDiscover,
      openPeople: () => goTab("click"),
      openEvents: () => goTab("saved"),
      openRadar: openRadar,
      openQuiz: () => setQuizOpen(true),
      quizDone: quizDone,
      coordBanner: t.dashMode === "firstrun" ? null : t.dashBanner === "none" ? null : t.dashBanner,
      onCoordAction: v => {
        if (v === "consolidated") {
          goTab("click");
          return;
        }
        setMName("Mia R.");
        if (v === "agreed") {
          openCoord("rsvp");
          return;
        }
        openCoord("suggest");
      },
      onHow: () => setView("howitworks")
    });else if (tab === "discover") body = /*#__PURE__*/React.createElement(window.ScreensDisc.Discover, {
      key: discoverCat,
      web: web,
      width: W,
      initialCat: discoverCat,
      open: open,
      saved: saved,
      toggleSave: toggleSave
    });else if (tab === "saved") body = /*#__PURE__*/React.createElement(window.ScreensME.MyEvents, {
      key: "me-" + myEventsTab,
      web: web,
      open: open,
      saved: saved,
      toggleSave: toggleSave,
      initialTab: myEventsTab
    });else if (tab === "profile") body = /*#__PURE__*/React.createElement(SA.Profile, {
      web: web,
      onEdit: () => {
        setSettingsSection("edit");
        setScreen("settings");
      }
    });else if (tab === "click") body = /*#__PURE__*/React.createElement(SB.ClicksTab, {
      web: web,
      onHow: () => setView("howitworks"),
      open: open,
      route: c => {
        setMName(c.name);
        const st = c.state === "plan" ? "both" : c.state === "connected" ? "connected" : c.coord === "proposed_waiting" ? "onein" : c.coord === "their_turn" || c.coord === "yoursave" ? "rsvp" : "suggest";
        openCoord(st);
      }
    });
    const showTabs = view === "app";
    let frameInner;
    if (web) {
      frameInner = /*#__PURE__*/React.createElement(BrowserFrame, {
        width: W,
        scrollRef: scrollRef
      }, view === "app" && showTabs && /*#__PURE__*/React.createElement(TopNav, {
        tab: tab,
        go: goTab,
        notify: showNotifDot ? unreadCount : 0,
        onBell: openNotifs,
        acctActive: acctActive,
        onAccount: accountNav
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "1 0 auto",
          containerType: "inline-size",
          padding: view === "app" && showTabs ? "24px 0" : "0"
        }
      }, body), /*#__PURE__*/React.createElement(Footer, {
        web: web,
        onNav: footerNav
      }), mutualOpen && /*#__PURE__*/React.createElement(Mech.MutualReveal, {
        web: web,
        name: mName,
        onSuggest: openSuggest,
        onClose: () => setMutualOpen(false),
        onHow: () => {
          setMutualOpen(false);
          setView("howitworks");
        }
      }), coordOpen && /*#__PURE__*/React.createElement(Mech.Coordinate, {
        key: coordStep,
        web: web,
        start: coordStep,
        name: mName,
        onClose: () => setCoordOpen(false),
        onRSVP: onCoordRSVP,
        onOpenEvent: e => {
          setCoordOpen(false);
          open(e);
        },
        onHow: () => {
          setCoordOpen(false);
          setView("howitworks");
        }
      }), mutualToast && /*#__PURE__*/React.createElement(MutualToast, {
        web: web,
        name: mName,
        onOpen: () => {
          setMutualToast(false);
          setMutualOpen(true);
        },
        onClose: () => setMutualToast(false)
      }), notifOpen && /*#__PURE__*/React.createElement(NotifPanel, {
        web: web,
        readSet: notifRead,
        onClose: () => setNotifOpen(false),
        onRow: onNotifRow,
        onMarkAll: markAllRead
      }), quizOpen && /*#__PURE__*/React.createElement(window.ScreensQuiz.Quiz, {
        web: web,
        done: () => {
          setQuizOpen(false);
          setQuizDone(true);
        },
        onClose: () => setQuizOpen(false)
      }));
    } else {
      frameInner = /*#__PURE__*/React.createElement(PhoneFrame, null, /*#__PURE__*/React.createElement("div", {
        ref: scrollRef,
        style: {
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column"
        }
      }, showTabs && /*#__PURE__*/React.createElement(MobileTopNav, {
        tab: tab,
        go: goTab,
        notify: showNotifDot,
        onBell: openNotifs,
        acctActive: acctActive,
        onAccount: accountNav
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "1 0 auto",
          containerType: "inline-size"
        }
      }, body), /*#__PURE__*/React.createElement(Footer, {
        web: web,
        onNav: footerNav
      })), showTabs && screen !== "event" && /*#__PURE__*/React.createElement(BottomNav, {
        tab: tab,
        go: goTab
      }), /*#__PURE__*/React.createElement("div", {
        id: "ckModalLayer",
        style: {
          position: "absolute",
          inset: 0,
          zIndex: 55,
          pointerEvents: "none"
        }
      }), mutualOpen && /*#__PURE__*/React.createElement(Mech.MutualReveal, {
        web: web,
        name: mName,
        onSuggest: openSuggest,
        onClose: () => setMutualOpen(false),
        onHow: () => {
          setMutualOpen(false);
          setView("howitworks");
        }
      }), coordOpen && /*#__PURE__*/React.createElement(Mech.Coordinate, {
        key: coordStep,
        web: web,
        start: coordStep,
        name: mName,
        onClose: () => setCoordOpen(false),
        onRSVP: onCoordRSVP,
        onOpenEvent: e => {
          setCoordOpen(false);
          open(e);
        },
        onHow: () => {
          setCoordOpen(false);
          setView("howitworks");
        }
      }), mutualToast && /*#__PURE__*/React.createElement(MutualToast, {
        web: web,
        name: mName,
        onOpen: () => {
          setMutualToast(false);
          setMutualOpen(true);
        },
        onClose: () => setMutualToast(false)
      }), notifOpen && /*#__PURE__*/React.createElement(NotifPanel, {
        web: web,
        readSet: notifRead,
        onClose: () => setNotifOpen(false),
        onRow: onNotifRow,
        onMarkAll: markAllRead
      }), quizOpen && /*#__PURE__*/React.createElement(window.ScreensQuiz.Quiz, {
        web: web,
        done: () => {
          setQuizOpen(false);
          setQuizDone(true);
        },
        onClose: () => setQuizOpen(false)
      }));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        background: "var(--sand-50)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      ref: stripRef,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 22px",
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--cream)",
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(L, {
      size: 22
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        fontWeight: 500
      }
    }, "Responsive web \xB7 interactive mockup")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(Seg, {
      value: device,
      onChange: setDevice,
      options: [["phone", "375"], ["tablet", "768"], ["laptop", "1024"], ["desktop", "1440"]]
    }), /*#__PURE__*/React.createElement(JumpSelect, {
      value: curKey,
      options: JUMPS,
      onChange: jumpTo
    }))), /*#__PURE__*/React.createElement("div", {
      ref: stageRef,
      style: {
        height: `calc(100vh - ${stripH}px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: 24,
        boxSizing: "border-box"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: frameW * scale,
        height: frameH * scale,
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: frameW,
        height: frameH,
        transform: `scale(${scale})`,
        transformOrigin: "top left"
      }
    }, frameInner))), /*#__PURE__*/React.createElement(TweaksPanel, null, /*#__PURE__*/React.createElement(TweakSection, {
      label: "Jump to screen"
    }), /*#__PURE__*/React.createElement(TweakSelect, {
      label: "Screen",
      value: curKey,
      options: JUMPS.map(j => ({
        value: j[0],
        label: j[1]
      })),
      onChange: jumpTo
    }), /*#__PURE__*/React.createElement(TweakSection, {
      label: "Device"
    }), /*#__PURE__*/React.createElement(TweakRadio, {
      label: "Width",
      value: device,
      options: ["phone", "tablet", "laptop", "desktop"],
      onChange: setDevice
    }), /*#__PURE__*/React.createElement(TweakSection, {
      label: "Dashboard (Home)"
    }), /*#__PURE__*/React.createElement(TweakSelect, {
      label: "Mode",
      value: t.dashMode,
      options: [{
        value: "returning",
        label: "Returning (Mode B)"
      }, {
        value: "firstrun",
        label: "First-time (Mode A)"
      }],
      onChange: v => setTweak("dashMode", v)
    }), /*#__PURE__*/React.createElement(TweakSelect, {
      label: "Coordination banner",
      value: t.dashBanner,
      options: [{
        value: "mutual",
        label: "Fresh mutual"
      }, {
        value: "proposed",
        label: "They proposed"
      }, {
        value: "agreed",
        label: "Agreed · your RSVP"
      }, {
        value: "consolidated",
        label: "2+ waiting on you"
      }, {
        value: "none",
        label: "None"
      }],
      onChange: v => setTweak("dashBanner", v)
    }), /*#__PURE__*/React.createElement(TweakToggle, {
      label: "Post-event prompt (48h window)",
      value: t.postPrompt !== "off",
      onChange: v => setTweak("postPrompt", v ? "on" : "off")
    }), /*#__PURE__*/React.createElement(TweakSection, {
      label: "The mechanic"
    }), /*#__PURE__*/React.createElement(TweakToggle, {
      label: "Show me in attendee lists",
      value: t.visibility !== "off",
      onChange: v => setTweak("visibility", v ? "on" : "off")
    }), /*#__PURE__*/React.createElement(TweakToggle, {
      label: "Dating mode (Who-was-there overlay)",
      value: t.whoDating === "on",
      onChange: v => setTweak("whoDating", v ? "on" : "off")
    }), /*#__PURE__*/React.createElement(TweakSection, {
      label: "Merchant portal"
    }), /*#__PURE__*/React.createElement(TweakSelect, {
      label: "Merchant state",
      value: t.merchState,
      options: [{
        value: "active",
        label: "Established (revenue + events)"
      }, {
        value: "new",
        label: "New (setup incomplete, $0)"
      }],
      onChange: v => setTweak("merchState", v)
    })));
  }

  /* segmented device control */
  function Seg({
    value,
    onChange,
    options
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)",
        padding: 3,
        gap: 2
      }
    }, options.map(([k, label]) => {
      const on = value === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => onChange(k),
        style: {
          border: "none",
          cursor: "pointer",
          borderRadius: "var(--radius-pill)",
          padding: "6px 13px",
          fontFamily: "var(--font-sans)",
          fontSize: 12.5,
          fontWeight: on ? 700 : 500,
          background: on ? "var(--purple-600)" : "transparent",
          color: on ? "var(--cream)" : "var(--text-body)",
          transition: "background .15s"
        }
      }, label);
    }));
  }
  function JumpSelect({
    value,
    options,
    onChange
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("select", {
      value: value,
      onChange: e => onChange(e.target.value),
      style: {
        appearance: "none",
        WebkitAppearance: "none",
        background: "var(--white)",
        border: "1px solid var(--border-mid)",
        borderRadius: "var(--radius-pill)",
        padding: "8px 34px 8px 15px",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--text-strong)",
        cursor: "pointer"
      }
    }, options.map(([k, label]) => /*#__PURE__*/React.createElement("option", {
      key: k,
      value: k
    }, label))), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        right: 13,
        pointerEvents: "none",
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement(window.CK.Icon, {
      name: "chevD",
      size: 16,
      color: "var(--text-muted)"
    })));
  }
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "dashMode": "returning",
    "dashBanner": "mutual",
    "postPrompt": "on",
    "yourIntent": "friends",
    "mutualMatch": "same",
    "visibility": "on",
    "merchState": "active"
  } /*EDITMODE-END*/;
  ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(Root, null));
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/shell.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/skeletons.jsx
try { (() => {
(function () {
  /* Click - loading SKELETONS ("shadow" pages). One per real screen, matching its layout so the
     load feels like the page settling in, not a spinner. Calm shimmer (pulse + a soft sweep),
     lavender-tinted blocks on cream; no spinners, no full-screen blockers. window.ScreensSkel. */
  const {
    useState
  } = window.CK;
  const SK = "color-mix(in srgb,var(--purple-600) 9%,var(--cream))";
  const SK2 = "color-mix(in srgb,var(--purple-600) 14%,var(--cream))";

  /* a single placeholder block; circle when r==="50%" */
  function B({
    w = "100%",
    h = 12,
    r = 10,
    mb = 0,
    mt = 0,
    style = {}
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        width: w,
        height: h,
        borderRadius: r,
        background: SK,
        marginBottom: mb,
        marginTop: mt,
        flex: "none",
        ...style
      }
    });
  }
  function Wrap({
    web,
    children,
    max = 960,
    pad
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? max : "none",
        margin: "0 auto",
        padding: pad || (web ? "8px 40px 48px" : "6px 22px 28px")
      }
    }, /*#__PURE__*/React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: "@keyframes ckSkPulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes ckSkSweep{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}@media (prefers-reduced-motion: reduce){.ckSk{animation:none!important}.ckSk-sweep{display:none!important}}"
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "ckSk",
      style: {
        animation: "ckSkPulse 1.5s ease-in-out infinite"
      }
    }, children));
  }
  /* an event card shell (matches EventCard: 16:9 + grouped body + pinned footer) */
  function CardSk() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--white)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-soft)",
        overflow: "hidden",
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        aspectRatio: "16/9",
        background: SK2
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "16px 16px 16px"
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "38%",
      h: 10,
      mb: 12
    }), /*#__PURE__*/React.createElement(B, {
      w: "88%",
      h: 16,
      mb: 7
    }), /*#__PURE__*/React.createElement(B, {
      w: "64%",
      h: 16,
      mb: 12
    }), /*#__PURE__*/React.createElement(B, {
      w: "52%",
      h: 11,
      mb: 14
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 54,
      h: 20,
      r: 999
    }), /*#__PURE__*/React.createElement(B, {
      w: 46,
      h: 20,
      r: 999
    }), /*#__PURE__*/React.createElement(B, {
      w: 62,
      h: 20,
      r: 999
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: "1px solid var(--border-soft)",
        paddingTop: 12
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 48,
      h: 16
    }), /*#__PURE__*/React.createElement(B, {
      w: 84,
      h: 34,
      r: 12
    }))));
  }
  /* the 375 MINI card shell (2-up; banner + date + title + suburb + price - no CTA/tags, per TEMPLATE §1b) */
  function MiniCardSk() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--white)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-soft)",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        aspectRatio: "16/9",
        background: SK2
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "10px 11px 12px"
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "48%",
      h: 9,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "92%",
      h: 13,
      mb: 6
    }), /*#__PURE__*/React.createElement(B, {
      w: "66%",
      h: 13,
      mb: 9
    }), /*#__PURE__*/React.createElement(B, {
      w: "55%",
      h: 10,
      mb: 9
    }), /*#__PURE__*/React.createElement(B, {
      w: "42%",
      h: 11
    })));
  }
  function Grid({
    web,
    n = 3
  }) {
    if (!web) return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(2,1fr)",
        gap: 12
      }
    }, Array.from({
      length: Math.max(n, 2) * 2
    }).map((_, i) => /*#__PURE__*/React.createElement(MiniCardSk, {
      key: i
    })));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))",
        gap: 22
      }
    }, Array.from({
      length: n
    }).map((_, i) => /*#__PURE__*/React.createElement(CardSk, {
      key: i
    })));
  }
  /* people-card shell (matches PeopleCard: avatar-left row + bottom action pair on narrow) */
  function PersonRowSk({
    web
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: web ? "row" : "column",
        alignItems: web ? "center" : "stretch",
        gap: web ? 16 : 12,
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        padding: web ? "16px 18px" : "14px 15px",
        boxShadow: "var(--shadow-sm)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: web ? 16 : 13,
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 52,
      h: 52,
      r: "50%"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "34%",
      h: 15,
      mb: 9
    }), /*#__PURE__*/React.createElement(B, {
      w: "56%",
      h: 11,
      mb: 10
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 56,
      h: 20,
      r: 999
    }), /*#__PURE__*/React.createElement(B, {
      w: 48,
      h: 20,
      r: 999
    }), /*#__PURE__*/React.createElement(B, {
      w: 40,
      h: 20,
      r: 999
    })))), web ? /*#__PURE__*/React.createElement(B, {
      w: 96,
      h: 36,
      r: 12
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "58%",
      h: 40,
      r: 12,
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(B, {
      w: 92,
      h: 40,
      r: 12
    })));
  }
  const SectionHead = ({
    web
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: web ? 18 : 14
    }
  }, /*#__PURE__*/React.createElement(B, {
    w: 180,
    h: 20
  }), /*#__PURE__*/React.createElement(B, {
    w: 70,
    h: 13
  }));

  /* ---------------- DASHBOARD ---------------- */
  function Dashboard({
    web
  }) {
    return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      max: 1060
    }, /*#__PURE__*/React.createElement(B, {
      w: web ? 180 : "36%",
      h: 12,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: web ? 320 : "70%",
      h: web ? 30 : 24,
      r: 12,
      mb: web ? 26 : 18
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 760 : "none",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: web ? 36 : 24
      }
    }, Array.from({
      length: 2
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: "var(--lavender-wash)",
        border: "1px solid var(--lavender-300)",
        borderRadius: 16,
        padding: web ? "16px 18px" : "14px 15px",
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 40,
      h: 40,
      r: "50%",
      style: {
        background: SK2
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "30%",
      h: 9,
      mb: 8,
      style: {
        background: SK2
      }
    }), /*#__PURE__*/React.createElement(B, {
      w: "64%",
      h: 14,
      style: {
        background: SK2
      }
    })), web && /*#__PURE__*/React.createElement(B, {
      w: 132,
      h: 38,
      r: 12,
      style: {
        background: SK2
      }
    })))), /*#__PURE__*/React.createElement(SectionHead, {
      web: web
    }), /*#__PURE__*/React.createElement(Grid, {
      web: web,
      n: web ? 3 : 1
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        height: web ? 52 : 24
      }
    }), /*#__PURE__*/React.createElement(SectionHead, {
      web: web
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: web ? 760 : "none"
      }
    }, /*#__PURE__*/React.createElement(PersonRowSk, {
      web: web
    })));
  }

  /* ---------------- DISCOVER ---------------- */
  function Discover({
    web
  }) {
    return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      max: 1180
    }, /*#__PURE__*/React.createElement(B, {
      w: web ? 360 : "62%",
      h: web ? 30 : 24,
      r: 12,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: web ? 300 : "80%",
      h: 13,
      mb: 16
    }), /*#__PURE__*/React.createElement(B, {
      w: "100%",
      h: 48,
      r: 999,
      mb: 16
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: web ? 10 : 8,
        marginBottom: 18,
        overflow: "hidden"
      }
    }, Array.from({
      length: web ? 9 : 6
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: web ? 56 : 48,
      h: web ? 56 : 48,
      r: "50%"
    }), /*#__PURE__*/React.createElement(B, {
      w: web ? 44 : 38,
      h: 9
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: web ? "grid" : "block",
        gridTemplateColumns: web ? "260px minmax(0,1fr)" : "none",
        gap: 36,
        alignItems: "start"
      }
    }, web && /*#__PURE__*/React.createElement("div", {
      style: {
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        background: "var(--white)",
        padding: 18
      }
    }, Array.from({
      length: 3
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        marginBottom: 22
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "50%",
      h: 11,
      mb: 12
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, Array.from({
      length: 5
    }).map((_, j) => /*#__PURE__*/React.createElement(B, {
      key: j,
      w: 66,
      h: 28,
      r: 999
    })))))), /*#__PURE__*/React.createElement(Grid, {
      web: web,
      n: web ? 6 : 3
    })));
  }

  /* ---------------- EVENT DETAIL ---------------- */
  function EventDetail({
    web
  }) {
    const Content = () => /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "100%",
      h: 0,
      style: {
        aspectRatio: "16/9",
        height: "auto"
      },
      r: 16,
      mb: 20
    }), /*#__PURE__*/React.createElement(B, {
      w: "40%",
      h: 12,
      mb: 12
    }), /*#__PURE__*/React.createElement(B, {
      w: "86%",
      h: 28,
      r: 12,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: "60%",
      h: 28,
      r: 12,
      mb: 18
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 24
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 64,
      h: 26,
      r: 999
    }), /*#__PURE__*/React.createElement(B, {
      w: 52,
      h: 26,
      r: 999
    }), /*#__PURE__*/React.createElement(B, {
      w: 72,
      h: 26,
      r: 999
    })), /*#__PURE__*/React.createElement(B, {
      w: "30%",
      h: 14,
      mb: 12
    }), /*#__PURE__*/React.createElement(B, {
      w: "100%",
      h: 12,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "100%",
      h: 12,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "80%",
      h: 12,
      mb: 26
    }), /*#__PURE__*/React.createElement(B, {
      w: "32%",
      h: 18,
      mb: 14
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10
      }
    }, Array.from({
      length: 4
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 12,
        padding: 14,
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        background: "var(--white)"
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 44,
      h: 44,
      r: "50%"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "60%",
      h: 13,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "80%",
      h: 10
    }))))));
    const PanelSk = () => /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "20px 20px 22px"
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 120,
      h: 26,
      r: 10,
      mb: 16
    }), /*#__PURE__*/React.createElement(B, {
      w: "100%",
      h: 44,
      r: 12,
      mb: 12
    }), /*#__PURE__*/React.createElement(B, {
      w: "70%",
      h: 12,
      mb: 18
    }), /*#__PURE__*/React.createElement(B, {
      w: "100%",
      h: 50,
      r: 12,
      mb: 12
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "50%",
      h: 42,
      r: 12
    }), /*#__PURE__*/React.createElement(B, {
      w: "50%",
      h: 42,
      r: 12
    })));
    if (!web) return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      pad: "6px 22px 28px"
    }, /*#__PURE__*/React.createElement(Content, null), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22
      }
    }, /*#__PURE__*/React.createElement(PanelSk, null)));
    return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      max: 1180
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 372px",
        gap: 36,
        alignItems: "start"
      }
    }, /*#__PURE__*/React.createElement(Content, null), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "sticky",
        top: 24
      }
    }, /*#__PURE__*/React.createElement(PanelSk, null))));
  }

  /* ---------------- PROFILE ---------------- */
  function Profile({
    web
  }) {
    return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      max: 660
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 0 8px"
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 68,
      h: 68,
      r: "50%"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 90,
      h: 10,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: "46%",
      h: 22,
      r: 10,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "62%",
      h: 13
    })), /*#__PURE__*/React.createElement(B, {
      w: 104,
      h: 36,
      r: 12
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "var(--border-soft)",
        margin: "18px 0 24px"
      }
    }), ["Bio", "Here for", "Into", "Photos"].map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        marginBottom: 26
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 70,
      h: 11,
      mb: 12
    }), s === "Photos" ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(5,1fr)" : "repeat(3,1fr)",
        gap: 10
      }
    }, Array.from({
      length: web ? 5 : 3
    }).map((_, j) => /*#__PURE__*/React.createElement("div", {
      key: j,
      style: {
        aspectRatio: "1",
        borderRadius: "var(--radius-md)",
        background: SK
      }
    }))) : s === "Bio" ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(B, {
      w: "100%",
      h: 12,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "74%",
      h: 12
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }
    }, Array.from({
      length: s === "Into" ? 6 : 2
    }).map((_, j) => /*#__PURE__*/React.createElement(B, {
      key: j,
      w: s === "Into" ? 78 : 120,
      h: 28,
      r: 999
    }))))));
  }

  /* ---------------- MY EVENTS ---------------- */
  function MyEvents({
    web
  }) {
    return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      max: 960
    }, /*#__PURE__*/React.createElement(B, {
      w: web ? 220 : "55%",
      h: web ? 28 : 23,
      r: 12,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: web ? 320 : "78%",
      h: 13,
      mb: 20
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 18,
        marginBottom: 22,
        borderBottom: "1px solid var(--border-soft)",
        paddingBottom: 12
      }
    }, ["Upcoming", "Waitlist", "Saved", "Past"].map((_, i) => /*#__PURE__*/React.createElement(B, {
      key: i,
      w: 74,
      h: 14
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, Array.from({
      length: 4
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 15,
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        boxShadow: "var(--shadow-sm)"
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 96,
      h: 72,
      r: 12
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 70,
      h: 20,
      r: 999,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: "60%",
      h: 15,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "44%",
      h: 11
    })), /*#__PURE__*/React.createElement(B, {
      w: 84,
      h: 34,
      r: 12
    })))));
  }

  /* ---------------- YOUR CLICKS (people) ---------------- */
  function Clicks({
    web
  }) {
    return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      max: 720
    }, /*#__PURE__*/React.createElement(B, {
      w: web ? 280 : "60%",
      h: web ? 26 : 22,
      r: 12,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: "80%",
      h: 13,
      mb: 22
    }), /*#__PURE__*/React.createElement(B, {
      w: 300,
      h: 18,
      mb: 14
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14,
        marginBottom: 26
      }
    }, Array.from({
      length: 3
    }).map((_, i) => /*#__PURE__*/React.createElement(PersonRowSk, {
      key: i,
      web: web
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "var(--border-soft)",
        margin: "0 0 24px"
      }
    }), /*#__PURE__*/React.createElement(B, {
      w: 140,
      h: 18,
      mb: 14
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        background: "var(--cream)",
        padding: "15px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginBottom: 30
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 32,
      h: 32,
      r: "50%"
    }), /*#__PURE__*/React.createElement(B, {
      w: "64%",
      h: 13
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(B, {
      w: 16,
      h: 16,
      r: "50%"
    })), /*#__PURE__*/React.createElement(B, {
      w: 120,
      h: 20,
      mb: 16
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, Array.from({
      length: 2
    }).map((_, i) => /*#__PURE__*/React.createElement(PersonRowSk, {
      key: i,
      web: web
    }))));
  }

  /* ---------------- WHO WAS THERE (post-event) - canonical PeopleCard grid, 2-up web / 1-up mobile */
  function WhoWasThere({
    web
  }) {
    return /*#__PURE__*/React.createElement(Wrap, {
      web: web,
      max: 860
    }, /*#__PURE__*/React.createElement(B, {
      w: 200,
      h: 11,
      mb: 14
    }), /*#__PURE__*/React.createElement(B, {
      w: web ? 480 : "78%",
      h: web ? 30 : 24,
      r: 12,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: web ? 360 : "66%",
      h: 13,
      mb: 10
    }), /*#__PURE__*/React.createElement(B, {
      w: web ? 300 : "80%",
      h: 12,
      mb: 26
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: web ? "repeat(2,1fr)" : "1fr",
        gap: web ? 16 : 12
      }
    }, Array.from({
      length: web ? 6 : 4
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        padding: 16,
        boxShadow: "var(--shadow-sm)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 13,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 52,
      h: 52,
      r: "50%"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "46%",
      h: 14,
      mb: 8
    }), /*#__PURE__*/React.createElement(B, {
      w: "64%",
      h: 11,
      mb: 10
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: 48,
      h: 18,
      r: 999
    }), /*#__PURE__*/React.createElement(B, {
      w: 40,
      h: 18,
      r: 999
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(B, {
      w: "58%",
      h: 40,
      r: 12,
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(B, {
      w: 92,
      h: 40,
      r: 12
    }))))));
  }
  const MAP = {
    dashboard: Dashboard,
    discover: Discover,
    event: EventDetail,
    profile: Profile,
    myevents: MyEvents,
    clicks: Clicks,
    window: WhoWasThere
  };
  function Skeleton({
    web,
    kind
  }) {
    const C = MAP[kind] || Dashboard;
    return /*#__PURE__*/React.createElement(C, {
      web: web
    });
  }
  window.ScreensSkel = {
    Skeleton,
    MAP
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/skeletons.jsx", error: String((e && e.message) || e) }); }

// click-app-v2/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling - build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react - the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability - if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag - ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char - so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings - map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick - checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor - curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts - a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "click-app-v2/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// components/app/IntentLine.jsx
try { (() => {
/**
 * Intent line - the locked legibility guarantee shown on every mutual click and
 * on the meeting-point screen. Two variants: equal intents and different
 * intents (the "they're open to" framing states the other's intent without
 * pressure). Never force symmetry.
 */
function IntentLine({
  yourIntent = "friends",
  theirIntent = null,
  style = {}
}) {
  const equal = !theirIntent || theirIntent === yourIntent;
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: "14.5px",
      fontWeight: 500,
      lineHeight: 1.45,
      color: "var(--text-body)",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 14px",
      background: "var(--lavender-100)",
      borderRadius: "var(--radius-pill)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: "15px"
    }
  }, "\u2728"), equal ? /*#__PURE__*/React.createElement("span", null, "You're both here for ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--purple-700)",
      fontWeight: 700
    }
  }, yourIntent), ".") : /*#__PURE__*/React.createElement("span", null, "You're here for ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--purple-700)",
      fontWeight: 700
    }
  }, yourIntent), " \xB7 they're open to ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--purple-700)",
      fontWeight: 700
    }
  }, theirIntent), "."));
}
Object.assign(__ds_scope, { IntentLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/IntentLine.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
/* No-photo placeholder palette - soft lavender disc + a deeper purple glyph/initial.
   A few tonal pairs so a stack of placeholders isn't monotonous. Flat, on-brand. */
const PLACEHOLDER = [["var(--lavender-200)", "var(--purple-500)"], ["#E7DEFA", "var(--purple-600)"], ["var(--lavender-100)", "var(--purple-400)"], ["#EDE6FB", "var(--purple-500)"]];
function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/**
 * Avatar - a person at an event. If `src` is given it shows the photo; otherwise
 * it falls back to the no-photo PLACEHOLDER: a flat person silhouette on a soft
 * lavender disc (fits Click's anonymous-until-mutual feel). Pass variant="initials"
 * for a monogram instead of the silhouette. Always round; first name only in social
 * surfaces (the product never shows surnames).
 */
function Avatar({
  name = "",
  src = null,
  size = 40,
  ring = false,
  variant = "silhouette",
  style = {}
}) {
  const [bg, fg] = PLACEHOLDER[(name.charCodeAt(0) || 0) % PLACEHOLDER.length];
  const common = {
    width: size,
    height: size,
    borderRadius: "50%",
    flex: "none",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
    boxShadow: ring ? "0 0 0 2.5px var(--white), 0 0 0 4px var(--lavender-300)" : style.boxShadow || "none"
  };
  if (src) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...common,
        background: "var(--sand-100)"
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: src,
      alt: name,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }));
  }
  if (variant === "initials" && name) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...common,
        background: bg,
        color: fg,
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size * 0.36,
        letterSpacing: "0.01em"
      }
    }, initials(name));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...common,
      background: bg
    },
    role: "img",
    "aria-label": name ? `${name} - no photo yet` : "No photo yet"
  }, /*#__PURE__*/React.createElement("svg", {
    width: size * 0.62,
    height: size * 0.62,
    viewBox: "0 0 24 24",
    fill: fg,
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8.6",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7z"
  })));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/AvatarStack.jsx
try { (() => {
/**
 * A compact overlapping cluster of avatars + a count - the "Who's going" social
 * proof on event cards. Only render when there are enough people to avoid
 * outing early RSVPs (the product threshold is 3).
 */
function AvatarStack({
  people = [],
  max = 4,
  size = 32,
  label = null,
  style = {}
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center"
    }
  }, shown.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginLeft: i === 0 ? 0 : -size * 0.34,
      position: "relative",
      zIndex: i,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: typeof p === "string" ? p : p.name,
    src: typeof p === "object" ? p.src : null,
    size: size,
    style: {
      boxShadow: "0 0 0 2.5px var(--white)"
    }
  }))), extra > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      marginLeft: -size * 0.34,
      width: size,
      height: size,
      borderRadius: "50%",
      background: "var(--lavender-100)",
      color: "var(--purple-700)",
      boxShadow: "0 0 0 2.5px var(--white)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: size * 0.34,
      lineHeight: 1
    }
  }, "+", extra)), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "13px",
      fontWeight: 500,
      color: "var(--text-muted)"
    }
  }, label));
}
Object.assign(__ds_scope, { AvatarStack });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/AvatarStack.jsx", error: String((e && e.message) || e) }); }

// components/app/EventCard.jsx
try { (() => {
/* Category is NOT colour-coded (canonical) - the cover is one calm lavender wash on
   every card; `category` survives for the label only. */
const COVER_HUE = "var(--lavender-400)";

/* Status badge - the ONLY place colour appears on a card. Rounded RECT, status text
   on a soft tint of the same hue (matches the Badge component). */
const STATUS = {
  free: {
    label: "Free",
    c: "var(--sage)",
    t: 14
  },
  almostfull: {
    label: "Almost full",
    c: "var(--coral)",
    t: 12
  },
  spots: {
    label: "spots left",
    c: "var(--coral)",
    t: 12
  },
  trending: {
    label: "Trending",
    c: "var(--amber)",
    t: 16
  },
  new: {
    label: "New",
    c: "var(--teal)",
    t: 12
  },
  waitlist: {
    label: "Waitlist",
    c: "var(--amber)",
    t: 16
  },
  soldout: {
    label: "Sold out",
    c: "var(--slate)",
    t: 0
  }
};
function StatusBadge({
  status,
  spotsLeft
}) {
  const s = STATUS[status];
  if (!s) return null;
  const label = status === "spots" && spotsLeft != null ? `${spotsLeft} spots left` : s.label;
  const bg = status === "soldout" ? "var(--mist)" : `color-mix(in srgb, ${s.c} ${s.t}%, var(--white))`;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 24,
      padding: "0 8px",
      borderRadius: 8,
      background: bg,
      color: s.c,
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: ".005em"
    }
  }, label);
}

/* Neutral interest tag - white fill, mist hairline, ink text, no dot (matches Tag). Compact. */
function InterestTag({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 9px",
      borderRadius: "var(--radius-pill)",
      background: "var(--white)",
      border: "1px solid var(--border-mid)",
      color: "var(--text-strong)",
      fontFamily: "var(--font-sans)",
      fontSize: 11.5,
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: "nowrap"
    }
  }, children);
}
function SaveBtn({
  saved,
  onSave
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onSave && onSave();
    },
    "aria-label": saved ? "Saved" : "Save",
    style: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      background: "rgba(253,250,246,.92)",
      boxShadow: "var(--shadow-xs)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: saved ? "var(--purple-600)" : "none",
    stroke: saved ? "var(--purple-600)" : "var(--text-strong)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"
  })));
}

/**
 * EventCard - the heart of the product and the marketing feed. One component,
 * reused across discovery, dashboard, landing and My Events. Equal-height in a
 * row (flex column, the meta area grows so the price + CTA footer pins to the
 * bottom and aligns across cards). Cover carries ONE status badge + Save only.
 *
 * Venue privacy (the locked rule): before booking, the card shows
 * suburb · distance + a lock ("Venue shown when you RSVP"); once `booked`,
 * the venue name is revealed (venue · suburb).
 */
function EventCard({
  name = "",
  venue = "",
  suburb = "",
  dist = "",
  when = "",
  category = "ceramics",
  categoryLabel = null,
  cover = null,
  tags = [],
  going = [],
  goingCount = 0,
  status = null,
  spotsLeft = null,
  price = "Free",
  booked = false,
  waitlisted = false,
  saved = false,
  onSave,
  onCta,
  onClick = () => {},
  style = {}
}) {
  const hue = COVER_HUE;
  const count = goingCount || going.length;
  const [hover, setHover] = React.useState(false);

  // CTA + price logic
  const full = status === "soldout" || status === "waitlist";
  const ctaLabel = waitlisted ? "Joined waitlist" : booked ? "View details" : full ? "Join waitlist" : "RSVP";
  const ctaPrimary = !booked && !waitlisted;
  const ctaMuted = waitlisted; // muted, same footprint - the "joined" resting state

  // up to 3 interest tags + overflow
  const shown = tags.slice(0, 3);
  const extra = tags.length - shown.length;
  const isFree = !price || price === "Free" || price === "$0";
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: "var(--surface-card)",
      borderRadius: "var(--radius-xl)",
      border: "1px solid var(--border-soft)",
      boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
      overflow: "hidden",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      transition: "box-shadow .2s ease, transform .2s ease",
      transform: hover ? "translateY(-3px)" : "translateY(0)",
      display: "flex",
      flexDirection: "column",
      alignSelf: "start",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 150,
      flex: "none",
      background: cover ? `center/cover no-repeat url(${cover})` : `radial-gradient(120% 140% at 18% 12%, color-mix(in srgb, ${hue} 38%, var(--cream)) 0%, color-mix(in srgb, ${hue} 18%, var(--cream)) 45%, var(--cream) 100%)`,
      overflow: "hidden"
    }
  }, !cover && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: "50%",
      background: hue,
      opacity: 0.22,
      top: -28,
      right: 30
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      width: 84,
      height: 84,
      borderRadius: "50%",
      background: "var(--lavender-300)",
      opacity: 0.5,
      bottom: -24,
      right: -10
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: "var(--lavender-200)",
      opacity: 0.7,
      bottom: 16,
      left: 26
    }
  })), status && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 13,
      left: 13
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: status,
    spotsLeft: spotsLeft
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 13,
      right: 13
    }
  }, /*#__PURE__*/React.createElement(SaveBtn, {
    saved: saved,
    onSave: onSave
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-muted)",
      letterSpacing: ".01em",
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.1",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "17",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9h18M8 2v4M16 2v4"
  })), when), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "4px 0 0",
      fontFamily: "var(--font-display)",
      fontSize: "var(--card-title)",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: "var(--text-strong)",
      lineHeight: "24px",
      minHeight: "48px",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
      minWidth: 0
    }
  }, name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: 13.5,
      color: "var(--text-muted)",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.1",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "2.4"
  })), booked ? /*#__PURE__*/React.createElement("span", null, venue, venue && suburb ? " · " : "", suburb) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, suburb, dist ? ` · ${dist}` : "", /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-faint)",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    role: "img",
    "aria-label": "Venue shown when you RSVP"
  }, /*#__PURE__*/React.createElement("title", null, "Venue shown when you RSVP"), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "11",
    width: "14",
    height: "9",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11V8a4 4 0 0 1 8 0v3"
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, shown.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "nowrap",
      gap: 6,
      minWidth: 0,
      overflow: "hidden"
    }
  }, shown.map((t, i) => /*#__PURE__*/React.createElement(InterestTag, {
    key: i
  }, t)), extra > 0 && /*#__PURE__*/React.createElement(InterestTag, null, "+", extra)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: shown.length > 0 ? 8 : 0
    }
  }, count >= 3 ? /*#__PURE__*/React.createElement(__ds_scope.AvatarStack, {
    people: going,
    max: 4,
    size: 26,
    label: `${count} going`
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)",
      fontWeight: 500
    }
  }, "Be one of the first"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 16,
      paddingTop: 12,
      borderTop: "1px solid var(--mist)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 16,
      fontWeight: 600,
      color: isFree ? "var(--success)" : "var(--text-strong)"
    }
  }, isFree ? "Free" : price), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      (onCta || onClick)();
    },
    style: {
      padding: "9px 18px",
      borderRadius: "var(--radius-pill)",
      cursor: "pointer",
      fontFamily: "var(--font-display)",
      fontSize: 14,
      fontWeight: 600,
      lineHeight: 1,
      background: ctaMuted ? "var(--lavender-100)" : ctaPrimary ? "var(--purple-600)" : "var(--white)",
      color: ctaMuted ? "var(--purple-700)" : ctaPrimary ? "var(--cream)" : "var(--purple-700)",
      border: ctaMuted ? "1.5px solid transparent" : ctaPrimary ? "1.5px solid var(--purple-600)" : "1.5px solid var(--border-mid)"
    }
  }, ctaLabel))));
}
Object.assign(__ds_scope, { EventCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/EventCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
/**
 * Badge - the ONLY place status colour lives. A rounded RECTANGLE (radius ~8px),
 * so it can never be mistaken for a pill Tag now that tags carry no dot. Status
 * text on a soft tint of the same hue. Used for event status - "Almost full",
 * "New", "You're going", "Sold out", date pills on imagery. Never a CTA, and never
 * the click state (pending/mutual live on the action button, not a badge).
 */
function Badge({
  children,
  tone = "neutral",
  icon = null,
  style = {}
}) {
  const tones = {
    neutral: {
      background: "var(--sand-100)",
      color: "var(--text-body)"
    },
    purple: {
      background: "var(--purple-600)",
      color: "var(--cream)"
    },
    lavender: {
      background: "var(--lavender-100)",
      color: "var(--purple-700)"
    },
    coral: {
      background: "color-mix(in srgb, var(--coral) 12%, var(--white))",
      color: "var(--coral)"
    },
    amber: {
      background: "color-mix(in srgb, var(--amber) 16%, var(--white))",
      color: "#a86f12"
    },
    sage: {
      background: "color-mix(in srgb, var(--sage) 14%, var(--white))",
      color: "var(--sage)"
    },
    teal: {
      background: "color-mix(in srgb, var(--teal) 12%, var(--white))",
      color: "var(--teal)"
    },
    onImage: {
      background: "rgba(28,24,48,0.62)",
      color: "var(--white)"
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      height: "24px",
      padding: "0 8px",
      fontFamily: "var(--font-sans)",
      fontSize: "12px",
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: "0.005em",
      borderRadius: "8px",
      boxSizing: "border-box",
      whiteSpace: "nowrap",
      ...t,
      ...style
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Click's action control. Filled Deep Purple = primary (the ONLY filled CTA);
 * secondary / ghost step down. States (hover / pressed / focus-visible / disabled
 * / loading) are REAL CSS - see components.css - so every button behaves the same
 * on mouse, touch and keyboard. Flat purple: never a glow or gradient.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  disabled = false,
  loading = false,
  iconLeft = null,
  iconRight = null,
  className = "",
  style = {},
  ...rest
}) {
  const cls = ["ck-btn", "ck-btn--" + variant, "ck-btn--" + size, full ? "ck-btn--full" : "", loading ? "ck-btn--loading" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    disabled: disabled || loading,
    "aria-busy": loading || undefined,
    style: style
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "ck-btn__label"
  }, iconLeft, children, iconRight), loading && /*#__PURE__*/React.createElement("span", {
    className: "ck-btn__spinner",
    "aria-hidden": "true"
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Logo.jsx
try { (() => {
/* Click - brand marks (Brand Package). Poppins wordmark with a lavender
   sparkle-pair i-dot, the bare 'c' letterform icon, and the standalone double
   spark. Keep the spark lavender; keep it singular; give it room. */

const LAV = "var(--lavender-300)";
const WORDMARK_FONT = "var(--font-wordmark, 'Poppins', sans-serif)";
function spkD(cx, cy, r, opt = {}) {
  const top = (opt.top || 1) * r,
    right = (opt.right || 1) * r,
    bot = (opt.bottom || 1) * r,
    left = (opt.left || 1) * r;
  const w = opt.w == null ? 0.46 : opt.w,
    p = opt.p == null ? 0.065 : opt.p;
  const n = v => Math.round(v * 100) / 100;
  return `M${n(cx)} ${n(cy - top)} C${n(cx + p * right)} ${n(cy - w * top)} ${n(cx + w * right)} ${n(cy - p * top)} ${n(cx + right)} ${n(cy)} C${n(cx + w * right)} ${n(cy + p * bot)} ${n(cx + p * right)} ${n(cy + w * bot)} ${n(cx)} ${n(cy + bot)} C${n(cx - p * left)} ${n(cy + w * bot)} ${n(cx - w * left)} ${n(cy + p * bot)} ${n(cx - left)} ${n(cy)} C${n(cx - w * left)} ${n(cy - p * top)} ${n(cx - p * left)} ${n(cy - w * top)} ${n(cx)} ${n(cy - top)} Z`;
}

/**
 * Spark - the brand signature: a large glint and a small companion drifting
 * up-right. The single spot of lavender. Use it at genuine payoff moments.
 */
function Spark({
  size = 24,
  color = LAV,
  style = {}
}) {
  const off = 0.75,
    sx = 50 + (82 - 50) * off,
    sy = 50 + (32 - 50) * off;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    fill: "none",
    style: {
      flex: "none",
      ...style
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: spkD(46, 66, 34, {
      w: 0.44
    }),
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: spkD(sx, sy, 13, {
      w: 0.40
    }),
    fill: color
  }));
}

/**
 * Logo - the primary wordmark. Lowercase `click` in Poppins SemiBold; the i-dot
 * is the sparkle pair. The everyday signature - use it wherever space allows.
 */
function Logo({
  size = 28,
  cream = false,
  style = {}
}) {
  const col = cream ? "var(--cream)" : "var(--purple-600)";
  const sp = Math.round(size * 0.40),
    gap = Math.round(size * -0.34);
  return /*#__PURE__*/React.createElement("span", {
    "aria-label": "click",
    style: {
      fontFamily: WORDMARK_FONT,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "baseline",
      whiteSpace: "nowrap",
      fontSize: size,
      color: col,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", null, "cl"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-block"
    }
  }, "\u0131", /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: "50%",
      bottom: `calc(100% + ${gap}px)`,
      transform: "translateX(-42%)"
    }
  }, /*#__PURE__*/React.createElement(Spark, {
    size: sp
  }))), /*#__PURE__*/React.createElement("span", null, "ck"));
}

/**
 * Cmark - the bare `c` letterform cradling the sparkle pair in its aperture.
 * The basis for the app icon, favicon and avatar. Holds down to 16px.
 */
function Cmark({
  size = 40,
  cColor = "var(--purple-600)",
  accent = LAV,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-label": "Click",
    style: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      fontSize: size,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: WORDMARK_FONT,
      fontWeight: 600,
      fontSize: "1em",
      color: cColor,
      letterSpacing: "-0.02em"
    }
  }, "c"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: "0.47em",
      top: "0.11em",
      width: "0.34em",
      height: "0.34em",
      lineHeight: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "100%",
    viewBox: "0 0 100 100",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: spkD(50, 50, 44),
    fill: accent
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: "0.71em",
      top: "-0.1em",
      width: "0.15em",
      height: "0.15em",
      lineHeight: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "100%",
    viewBox: "0 0 100 100",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: spkD(50, 50, 44, {
      w: 0.40
    }),
    fill: accent
  }))));
}

/**
 * AppTile - the c-mark on a deep-purple squircle. The home-screen icon / favicon.
 */
function AppTile({
  size = 56,
  bg = "var(--purple-600)",
  cColor = "var(--cream)",
  accent = LAV,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: size * 0.225,
      background: bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "var(--shadow-sm)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(Cmark, {
    size: size * 0.6,
    cColor: cColor,
    accent: accent
  }));
}
Object.assign(__ds_scope, { Spark, Logo, Cmark, AppTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tag - interest / category chip. ONE neutral look on every surface (true-white
 * fill, Mist-strong #DDD7EA hairline, Ink text, NO dot) so a tag always reads as a
 * tag and lifts off the warm cream canvas. The only time
 * a tag goes purple is when `selected` (Deep Purple fill + leading check) - used
 * in onboarding grids and filters. Status colour NEVER appears on a tag - that
 * lives on Badge. Pill shape + ~28px height keep it visibly lighter than a button.
 */
function Tag({
  children,
  selected = false,
  dense = false,
  selectable = false,
  style = {},
  ...rest
}) {
  const interactive = selectable || rest.onClick;
  const cls = ["ck-tag", interactive && !selected ? "ck-tag--select" : ""].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined,
    "aria-pressed": interactive ? selected : undefined,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      height: dense && !selected ? "22px" : "24px",
      padding: dense ? "0 8px" : "0 10px",
      fontFamily: "var(--font-sans)",
      fontSize: "12px",
      fontWeight: 500,
      lineHeight: 1,
      borderRadius: "var(--radius-pill)",
      whiteSpace: "nowrap",
      boxSizing: "border-box",
      background: selected ? "var(--purple-600)" : "var(--white)",
      color: selected ? "var(--cream)" : "var(--ink)",
      border: "1px solid " + (selected ? "transparent" : "var(--mist-strong)"),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/app/AttendeeRow.jsx
try { (() => {
/**
 * Attendee row - one person on the Who's-going (pre-event) or Who-was-there
 * (post-event) list. First name only, shared interest tags, intent label, and a
 * "Click with [name]" action. After clicking, shows the locked quiet state.
 * Identical UI for receivers - never signals that someone clicked with you.
 */
function AttendeeRow({
  name = "",
  src = null,
  intent = null,
  tags = [],
  clicked = false,
  disabled = false,
  onClick = () => {},
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "13px",
      padding: "14px 0",
      borderBottom: "1px solid var(--border-soft)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    src: src,
    size: 48,
    ring: clicked
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "16px",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, name), intent && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "12.5px",
      color: "var(--text-muted)",
      fontWeight: 500,
      marginTop: "2px"
    }
  }, intent.charAt(0).toUpperCase() + intent.slice(1)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      marginTop: "8px"
    }
  }, tags.slice(0, 3).map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t,
    dense: true
  }, t)))), clicked ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "pending",
    size: "sm",
    style: {
      whiteSpace: "nowrap",
      flex: "none"
    }
  }, "clicked") : /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    size: "sm",
    disabled: disabled,
    onClick: onClick,
    style: {
      whiteSpace: "nowrap"
    }
  }, "click with ", name));
}
Object.assign(__ds_scope, { AttendeeRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/AttendeeRow.jsx", error: String((e && e.message) || e) }); }

// components/app/MutualCard.jsx
try { (() => {
/**
 * MutualCard - the payoff surface. "You clicked with [Name]." Activity-led, NOT
 * a dating match: a single Deep-Purple spark glyph + the person's ONE avatar (no
 * paired/overlapping "you + them" avatars, no heavy purple gradient). Cream card,
 * Poppins headline at 600, a Sage intent pill, neutral shared-interest tags, and
 * the calm activity-first line. The "Not feeling it" exit is silent to the other
 * person. Mirrors the in-app reveal modal so the reveal reads the same everywhere.
 */
function MutualCard({
  name = "",
  src = null,
  event = "",
  yourIntent = "friends",
  dating = false,
  tags = [],
  variant = "preEvent",
  ctaLabel = null,
  onCta = () => {},
  onDecline = () => {},
  style = {}
}) {
  const first = (name || "").split(" ")[0] || "them";
  const cta = ctaLabel || "Suggest a plan";
  const tg = (tags || []).slice(0, 2);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "var(--cream)",
      borderRadius: "var(--radius-2xl)",
      padding: "32px 28px 26px",
      textAlign: "center",
      overflow: "hidden",
      boxShadow: "var(--shadow-lg)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: "50%",
      background: "var(--lavender-300)",
      opacity: 0.3,
      top: -90,
      left: -50
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      width: 130,
      height: 130,
      borderRadius: "50%",
      background: "var(--lavender-200)",
      opacity: 0.5,
      bottom: -60,
      right: -30
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 13,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 74,
      height: 74,
      borderRadius: "50%",
      background: "color-mix(in srgb, var(--purple-600) 9%, var(--cream))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Spark, {
    size: 42,
    color: "var(--purple-600)"
  })), /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    src: src,
    size: 54,
    ring: true
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 8px",
      fontFamily: "var(--font-display)",
      fontSize: "23px",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      color: "var(--text-strong)"
    }
  }, "You clicked with ", first, "."), event && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 14px",
      fontSize: "13.5px",
      color: "var(--text-muted)",
      lineHeight: 1.5
    }
  }, variant === "preEvent" ? /*#__PURE__*/React.createElement(React.Fragment, null, "You're both going to ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 600,
      color: "var(--text-body)"
    }
  }, event)) : /*#__PURE__*/React.createElement(React.Fragment, null, "You were both at ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 600,
      color: "var(--text-body)"
    }
  }, event))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "6px 14px",
      borderRadius: "var(--radius-pill)",
      background: "color-mix(in srgb, var(--sage) 14%, var(--white))",
      marginBottom: tg.length ? 12 : 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--sage)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "13.5px",
      fontWeight: 600,
      color: "var(--sage)"
    }
  }, "You're both here for ", yourIntent, dating ? " · both open to dating" : "")), tg.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginBottom: 16
    }
  }, tg.map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t,
    dense: true
  }, t))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 22px",
      fontSize: "14.5px",
      color: "var(--text-body)",
      lineHeight: 1.55
    }
  }, "Find a thing you'd both enjoy, and just show up."), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onCta
  }, cta), /*#__PURE__*/React.createElement("button", {
    onClick: onDecline,
    style: {
      marginTop: 12,
      background: "none",
      border: "none",
      color: "var(--text-muted)",
      fontFamily: "var(--font-sans)",
      fontSize: "13px",
      cursor: "pointer"
    }
  }, "Not feeling it? No worries - just ignore this.")));
}
Object.assign(__ds_scope, { MutualCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/MutualCard.jsx", error: String((e && e.message) || e) }); }

// components/app/PeopleCard.jsx
try { (() => {
/**
 * PeopleCard - the canonical "person you can click with" card. ONE component,
 * reused identically on the Click-with-someone page (one per line), the dashboard
 * "click with someone" section, and as the profile-drawer header. Distinct from the
 * EventCard: a face + the real overlap + one intention - no banner, no price, no RSVP.
 *
 * The hook is the OVERLAP, never a bio. Bios/prompts/full interests live in the
 * profile drawer (opened via "View profile") - never on the card.
 *
 * The click action is ONE control across states (default → pending → mutual): the
 * Button keeps an identical footprint, only its fill + label change. Pending is a
 * muted "clicked" (no ✨, unresolved); mutual is Sage "clicked ✨" (✨ = the peak).
 * Name only - no age (age lives on the profile drawer). No anonymous helper on the
 * card; that reassurance shows once at the top of the section.
 */

const sentence = (s = "") => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* plain overlap glyph (a venn) - NEVER a ✨; the sparkle is reserved for the button state */
function VennGlyph({
  size = 15
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--purple-500)",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    "aria-hidden": "true",
    style: {
      flex: "none",
      marginTop: "1px"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "12",
    r: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "12",
    r: "6"
  }));
}
function PinGlyph({
  size = 14
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--purple-500)",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: {
      flex: "none",
      marginTop: "2px"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "2.4"
  }));
}

/* shared-context line - CONDITIONAL, never fabricated. Shared event wins; else the
   interest overlap; else nothing renders (NEVER a bare "You were both at"). */
function ContextLine({
  sharedEvent,
  overlap
}) {
  if (!sharedEvent && !overlap) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: "7px",
      fontSize: "13px",
      color: "var(--text-body)",
      lineHeight: 1.45
    }
  }, sharedEvent ? /*#__PURE__*/React.createElement(PinGlyph, null) : /*#__PURE__*/React.createElement(VennGlyph, null), /*#__PURE__*/React.createElement("span", null, sharedEvent ? /*#__PURE__*/React.createElement(React.Fragment, null, "You were both at ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--text-strong)",
      fontWeight: 600
    }
  }, sharedEvent)) : /*#__PURE__*/React.createElement(React.Fragment, null, "Both into ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--text-strong)",
      fontWeight: 600
    }
  }, overlap))));
}
function TagRow({
  tags = [],
  max
}) {
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  if (!tags.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px"
    }
  }, shown.map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t,
    dense: true
  }, t)), extra > 0 && /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    dense: true
  }, "+", extra));
}

/* the stateful action - ONE footprint across default → pending → mutual. Pending =
   muted "clicked" (no ✨); mutual = Sage "clicked ✨". No helper line on the card. */
function ClickAction({
  name,
  state,
  onClick,
  onView,
  full
}) {
  if (state === "mutual") return /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "mutual",
    size: "sm",
    full: full,
    onClick: onView
  }, "clicked ", /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u2728"));
  if (state === "pending") return /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "pending",
    size: "sm",
    full: full
  }, "clicked");
  return /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    size: "sm",
    full: full,
    onClick: onClick
  }, "click with ", name);
}

/* loading skeleton - matches THIS card's shape, not a spinner */
function Bar({
  w,
  h = 12
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      width: w,
      height: h,
      borderRadius: "6px",
      background: "var(--mist)"
    }
  });
}
function PeopleCardSkeleton({
  layout
}) {
  const row = layout === "row";
  const shell = {
    display: "flex",
    gap: row ? "20px" : "14px",
    alignItems: row ? "center" : "flex-start",
    flexDirection: row ? "row" : "column",
    background: "var(--white)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-sm)",
    padding: row ? "18px 22px" : "18px",
    fontFamily: "var(--font-sans)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: shell,
    "aria-busy": "true"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: row ? 66 : 56,
      height: row ? 66 : 56,
      borderRadius: "50%",
      background: "var(--mist)",
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "9px",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement(Bar, {
    w: "140px",
    h: 15
  }), /*#__PURE__*/React.createElement(Bar, {
    w: "180px"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "6px"
    }
  }, /*#__PURE__*/React.createElement(Bar, {
    w: "64px",
    h: 20
  }), /*#__PURE__*/React.createElement(Bar, {
    w: "80px",
    h: 20
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: row ? 152 : "100%"
    }
  }, /*#__PURE__*/React.createElement(Bar, {
    w: "100%",
    h: 36
  })));
}
function PeopleCard({
  name = "",
  src = null,
  intent = null,
  sharedEvent = null,
  overlap = null,
  tags = [],
  state = "default",
  layout = "row",
  onClick = () => {},
  onView = () => {},
  style = {}
}) {
  if (state === "loading") return /*#__PURE__*/React.createElement(PeopleCardSkeleton, {
    layout: layout
  });
  const first = name.split(" ")[0];
  const row = layout === "row";
  const identity = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "10px",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "18px",
      fontWeight: 600,
      lineHeight: "24px",
      color: "var(--text-strong)",
      letterSpacing: "-0.01em"
    }
  }, first), intent && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "13px",
      color: "var(--text-muted)",
      fontWeight: 500
    }
  }, sentence(intent))));
  if (row) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "20px",
        background: "var(--white)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-sm)",
        padding: "18px 22px",
        fontFamily: "var(--font-sans)",
        ...style
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
      name: name,
      src: src,
      size: 66,
      ring: state === "mutual"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }
    }, identity, /*#__PURE__*/React.createElement(ContextLine, {
      sharedEvent: sharedEvent,
      overlap: overlap
    }), /*#__PURE__*/React.createElement(TagRow, {
      tags: tags,
      max: 4
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        width: "172px",
        display: "flex",
        flexDirection: "column",
        gap: "9px"
      }
    }, /*#__PURE__*/React.createElement(ClickAction, {
      name: first,
      state: state,
      onClick: onClick,
      onView: onView,
      full: true
    }), state !== "mutual" && /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "secondary",
      size: "sm",
      full: true,
      onClick: onView
    }, "View profile")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "11px",
      background: "var(--white)",
      border: "1px solid var(--border-soft)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-sm)",
      padding: "18px",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "14px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    src: src,
    size: 56,
    ring: state === "mutual"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, identity)), /*#__PURE__*/React.createElement(ContextLine, {
    sharedEvent: sharedEvent,
    overlap: overlap
  }), /*#__PURE__*/React.createElement(TagRow, {
    tags: tags,
    max: 3
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: "2px"
    }
  }, state === "default" ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement(ClickAction, {
    name: first,
    state: "default",
    onClick: onClick,
    full: true
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "sm",
    onClick: onView
  }, "View profile")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ClickAction, {
    name: first,
    state: state,
    onClick: onClick,
    onView: onView,
    full: true
  }), state !== "mutual" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "9px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "sm",
    full: true,
    onClick: onView
  }, "View profile")))));
}
Object.assign(__ds_scope, { PeopleCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/PeopleCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input with optional label, helper and leading icon. Cream-white field,
 * lavender focus ring. Used in waitlist forms, search, profile setup.
 */
function Input({
  label = null,
  helper = null,
  iconLeft = null,
  error = false,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? "in-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "7px",
      fontFamily: "var(--font-sans)"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "9px",
      background: "var(--white)",
      border: "1.5px solid " + (error ? "var(--error)" : focus ? "var(--lavender-400)" : "var(--border-mid)"),
      borderRadius: "var(--radius-md)",
      padding: "0 14px",
      boxShadow: focus ? "0 0 0 4px color-mix(in srgb, var(--lavender-400) 22%, transparent)" : "var(--shadow-xs)",
      transition: "border-color .15s ease, box-shadow .15s ease"
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-muted)",
      display: "inline-flex"
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    onFocus: e => {
      setFocus(true);
      rest.onFocus?.(e);
    },
    onBlur: e => {
      setFocus(false);
      rest.onBlur?.(e);
    },
    style: {
      flex: 1,
      border: "none",
      outline: "none",
      background: "transparent",
      padding: "12px 0",
      fontFamily: "var(--font-sans)",
      fontSize: "15px",
      color: "var(--text-strong)",
      minWidth: 0,
      ...style
    }
  }, rest))), helper && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12.5px",
      color: error ? "var(--error)" : "var(--text-muted)"
    }
  }, helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Select / dropdown - e.g. the suburb dropdown on the waitlist form. Styled
 * native select with a chevron, matching Input's field treatment.
 */
function Select({
  label = null,
  helper = null,
  options = [],
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const selId = id || (label ? "sel-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "7px",
      fontFamily: "var(--font-sans)"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: selId,
    style: {
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "var(--white)",
      border: "1.5px solid " + (focus ? "var(--lavender-400)" : "var(--border-mid)"),
      borderRadius: "var(--radius-md)",
      boxShadow: focus ? "0 0 0 4px color-mix(in srgb, var(--lavender-400) 22%, transparent)" : "var(--shadow-xs)",
      transition: "border-color .15s ease, box-shadow .15s ease"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: selId,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: "100%",
      appearance: "none",
      WebkitAppearance: "none",
      border: "none",
      outline: "none",
      background: "transparent",
      padding: "13px 40px 13px 14px",
      fontFamily: "var(--font-sans)",
      fontSize: "15px",
      color: "var(--text-strong)",
      cursor: "pointer",
      ...style
    }
  }, rest), options.map(o => {
    const val = typeof o === "string" ? o : o.value;
    const lab = typeof o === "string" ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: val,
      value: val
    }, lab);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 14,
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })))), helper && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12.5px",
      color: "var(--text-muted)"
    }
  }, helper));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Toggle.jsx
try { (() => {
/**
 * Toggle switch - the visibility control ("Show me in event attendee lists")
 * and other on/off settings. Purple when on, with an optional locked helper.
 */
function Toggle({
  checked = false,
  onChange = () => {},
  label = null,
  helper = null,
  disabled = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: "13px",
      fontFamily: "var(--font-sans)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange(!checked),
    style: {
      flex: "none",
      width: 46,
      height: 28,
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--accent)" : "var(--sand-300)",
      position: "relative",
      transition: "background .18s ease",
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: checked ? 21 : 3,
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: "var(--white)",
      boxShadow: "var(--shadow-sm)",
      transition: "left .18s cubic-bezier(.3,.7,.4,1)"
    }
  })), (label || helper) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "3px"
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "14.5px",
      fontWeight: 600,
      color: "var(--text-strong)",
      lineHeight: 1.3
    }
  }, label), helper && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "13px",
      color: "var(--text-muted)",
      lineHeight: 1.45,
      maxWidth: 360
    }
  }, helper)));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/merchant/CapacityMeter.jsx
try { (() => {
/**
 * CapacityMeter - "confirmed / cap" count with a slim fill bar. The single way
 * capacity renders across the merchant portal (event tables, dashboard cards).
 * Fill turns Coral above 85% (nearly full), otherwise Purple.
 */
function CapacityMeter({
  confirmed = 0,
  cap = 0,
  maxWidth = 96,
  style = {}
}) {
  const pct = cap > 0 ? Math.min(100, Math.round(confirmed / cap * 100)) : 0;
  const hue = cap > 0 && confirmed / cap > 0.85 ? "var(--coral)" : "var(--purple-500)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 5,
      minWidth: 0,
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--text-strong)",
      whiteSpace: "nowrap"
    }
  }, confirmed, " / ", cap), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      width: "100%",
      maxWidth,
      height: 5,
      borderRadius: 3,
      background: "var(--lavender-100)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      width: pct + "%",
      height: "100%",
      borderRadius: 3,
      background: hue
    }
  })));
}
Object.assign(__ds_scope, { CapacityMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/merchant/CapacityMeter.jsx", error: String((e && e.message) || e) }); }

// components/merchant/StatCard.jsx
try { (() => {
/**
 * StatCard - merchant portal KPI tile. One hero (Deep Purple) tile per row max;
 * the rest are plain white. Always period-scoped via `note` (never a bare number).
 */
function StatCard({
  label = "",
  value = "",
  note = null,
  hero = false,
  style = {}
}) {
  const base = hero ? {
    background: "var(--purple-600)",
    border: "1px solid var(--purple-600)"
  } : {
    background: "var(--white)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-sm)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...base,
      borderRadius: "var(--radius-lg)",
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 5,
      minWidth: 0,
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: ".09em",
      textTransform: "uppercase",
      color: hero ? "var(--lavender-300)" : "var(--text-faint)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 27,
      fontWeight: 600,
      lineHeight: 1.05,
      color: hero ? "var(--cream)" : "var(--text-strong)"
    }
  }, value), note && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: hero ? "rgba(253,250,246,.75)" : "var(--text-muted)"
    }
  }, note));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/merchant/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/merchant/StatusPill.jsx
try { (() => {
/* Canonical merchant status → Badge tone map. Sage = live/money-good, Amber =
   waiting states, Coral = cancelled, Lavender = confirmed bookings, neutral = past. */
const MAP = {
  live: ["sage", "Live"],
  ended: ["cream", "Ended"],
  pending: ["amber", "Pending"],
  cancelled: ["coral", "Cancelled"],
  confirmed: ["lavender", "Confirmed"],
  waitlist: ["amber", "Waitlist"],
  draft: ["cream", "Draft"],
  paid: ["sage", "Paid"],
  refunded: ["cream", "Refunded"]
};

/**
 * StatusPill - the single status vocabulary for merchant surfaces (events,
 * bookings, transactions). Wraps core Badge so tones stay consistent.
 */
function StatusPill({
  status = "live",
  style = {}
}) {
  const [tone, label] = MAP[status] || ["cream", status];
  return /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: tone,
    style: style
  }, label);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/merchant/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/merchant/WizardStepper.jsx
try { (() => {
/**
 * WizardStepper - numbered progress dots joined by hairlines, used by merchant
 * multi-step flows (become a host, create event). Completed steps turn Sage
 * with a check and become clickable; the current step is Deep Purple.
 */
function WizardStepper({
  steps = [],
  current = 0,
  onStep = null,
  showLabels = true,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: s
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1.5,
      background: i <= current ? "var(--purple-400)" : "var(--border-mid)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onStep && i < current && onStep(i),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      border: "none",
      background: "none",
      padding: 0,
      cursor: onStep && i < current ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 700,
      background: i < current ? "var(--sage)" : i === current ? "var(--purple-600)" : "var(--white)",
      color: i <= current ? "#fff" : "var(--text-muted)",
      border: i > current ? "1.5px solid var(--border-mid)" : "none"
    }
  }, i < current ? /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  })) : i + 1), showLabels && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: i === current ? "var(--purple-700)" : "var(--text-faint)"
    }
  }, s)))));
}
Object.assign(__ds_scope, { WizardStepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/merchant/WizardStepper.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AttendeeRow = __ds_scope.AttendeeRow;

__ds_ns.EventCard = __ds_scope.EventCard;

__ds_ns.IntentLine = __ds_scope.IntentLine;

__ds_ns.MutualCard = __ds_scope.MutualCard;

__ds_ns.PeopleCard = __ds_scope.PeopleCard;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.AvatarStack = __ds_scope.AvatarStack;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Spark = __ds_scope.Spark;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Cmark = __ds_scope.Cmark;

__ds_ns.AppTile = __ds_scope.AppTile;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.CapacityMeter = __ds_scope.CapacityMeter;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.WizardStepper = __ds_scope.WizardStepper;

})();
