const CONFIG = {
  // Paste your Google Apps Script web-app URL here (see README / apps-script.gs). Leave "" to use download-only mode.
  // NOTE: path must never contain ad-blocker bait words (collect/track/event/
  // beacon/stats) — "/api/collect" was silently blocked by uBlock/Brave for
  // privacy-minded participants, which is exactly our audience.
  ENDPOINT_URL: "/api/entry", // built-in Netlify Function; override with a full URL if needed
  ENDPOINT_FALLBACKS: ["/api/collect"], // legacy alias, tried only if the primary fails
  // Shown in the fallback message if submission fails:
  CONTACT_EMAIL: "nterziev@blockstream.com",
  STUDY_NAME: "blockstream-first-screen-v1"
};
// Card set — MUST stay identical (ids + labels) to the moderated FigJam set and analyze.html
// h = height in phone UNITS (1 unit = 1rem at full scale, real-component-ish
// heights on a 25.125-unit-wide / 402px screen). w = fraction of phone width.
// Small pieces (w<1) pack side by side when adjacent — like a real app row.
const IMG = {}; /*IMG_DATA*/
const SHORT = {total:"Total balance", total_chart:"Balance chart", px_num:"BTC price pill",
  px_chart:"BTC price chart", market:"BTC/USD market row", cash_act:"Cash buttons", wallets:"My wallets",
  assets:"My assets", actions:"Buy·Send·Receive", activity:"Recent activity",
  offers:"Offers", hide:"Hide balances", notif:"Notifications", jade:"Jade status"};
// Pile sections — order here is the order participants see them in.
const GROUPS = [
  {id:"balances", title:"Your money"},
  {id:"price",    title:"Bitcoin price (3 different takes)"},
  {id:"act",      title:"Action buttons"},
  {id:"updates",  title:"Activity & updates"},
  {id:"util",     title:"Small utilities"},
];
const CARDS = [
  // h = natural height of the designed component (Figma "01 Dashboard" / CardList)
  // label = short distinctive name (also used in analysis); desc = plain-language explanation shown in the pile.
  {id:"total",      label:"Total balance (number)", group:"balances", h:101, w:1,
   desc:"Your total worth in dollars — everything, across all wallets and assets."},
  {id:"total_chart",label:"Total balance — chart", group:"balances", h:106, w:1,
   desc:"How that total changed over time, as a chart."},
  {id:"wallets",    label:"Wallet list", group:"balances", h:413, w:1,
   desc:"Every wallet you have (Spending, Savings, Vault…) plus your cash, held as its own account."},
  {id:"assets",     label:"Asset list", group:"balances", h:226, w:1,
   desc:"The same money grouped by asset instead: bitcoin, tether, cash."},
  {id:"px_num",     label:"BTC price — tiny pill", group:"price", h:34, w:0.5,
   desc:"The bitcoin price squeezed into a small pill. Tap it to see a chart."},
  {id:"market",     label:"BTC/USD — market row", group:"price", h:64, w:1,
   desc:"One row with the BTC/USD price, 24h trading volume and a trend line. Tap it to expand the full chart."},
  {id:"px_chart",   label:"BTC price — full chart card", group:"price", h:260, w:1,
   desc:"The big version: price chart over time, timeframes, and a Buy button."},
  {id:"actions",    label:"Buy · Send · Receive buttons", group:"act", h:61, w:1, chips:["Buy","Send","Receive"],
   desc:"The three main bitcoin buttons."},
  {id:"cash_act",   label:"Cash buttons", group:"act", h:42, w:1,
   desc:"Add money, withdraw, or buy bitcoin with your cash."},
  {id:"activity",   label:"Recent activity", group:"updates", h:236, w:1,
   desc:"Your latest transactions."},
  {id:"offers",     label:"Offers & announcements", group:"updates", h:85, w:1,
   desc:"News and promos from Blockstream."},
  {id:"notif",      label:"Notifications bell", group:"updates", h:34, w:0.25,
   desc:"Alerts, with an unread count."},
  {id:"hide",       label:"Hide balances (eye)", group:"util", h:34, w:0.25,
   desc:"One tap to blur every amount on screen."},
  {id:"jade",       label:"Jade status row", group:"util", h:64, w:1,
   desc:"Whether your Jade hardware wallet is connected."},
];
/* ---- component faces: HTML in the design system's own tokens ---- */
const CHART_SVG = (w,h,vb)=>'<svg width="'+w+'" height="'+h+'" viewBox="0 0 360 '+vb+'" preserveAspectRatio="none" fill="none">'
  +'<defs><linearGradient id="g'+vb+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00bcff" stop-opacity=".22"/><stop offset="1" stop-color="#00bcff" stop-opacity="0"/></linearGradient></defs>'
  +'<path d="M0 95 C25 88 40 78 60 80 C80 82 95 90 115 84 C140 76 150 58 175 52 C200 46 210 55 235 48 C260 41 270 28 300 22 C325 17 345 14 358 8 L358 '+vb+' L0 '+vb+' Z" fill="url(#g'+vb+')"/>'
  +'<path d="M0 95 C25 88 40 78 60 80 C80 82 95 90 115 84 C140 76 150 58 175 52 C200 46 210 55 235 48 C260 41 270 28 300 22 C325 17 345 14 358 8" stroke="#00bcff" stroke-width="2.2"/>'
  +'<circle cx="358" cy="8" r="9" fill="rgba(0,188,255,.3)"/><circle cx="358" cy="8" r="4" fill="#181818" stroke="#00bcff" stroke-width="1.5"/></svg>';
const wcard=(name,emoji,amt,bar,legend)=>'<div class="f-card" style="padding:13px 14px;margin-bottom:14px">'
  +'<div style="display:flex;justify-content:space-between;align-items:center"><span class="f-name">'+name+' <span style="font-size:11px">'+emoji+'</span></span><span class="f-amt">'+amt+'</span></div>'
  +'<div class="f-bar">'+bar+'</div><div class="f-legend">'+legend+'</div></div>';
const frow=(coin,coincls,name,sub,right)=>'<div class="f-card f-row" style="margin-bottom:8px">'
  +'<span class="f-coin '+coincls+'">'+coin+'</span><span style="flex:1"><div class="f-name">'+name+'</div><div class="f-sub">'+sub+'</div></span>'
  +'<span class="f-amt">'+right+'</span></div>';
const FACES = {
  total:'<div style="padding:2px 0"><div class="f-lbl">Total Portfolio <span style="border:1px solid #5c6873;border-radius:50%;font-size:9px;padding:0 4px;color:#a0a0a0">i</span></div>'
    +'<div class="f-big">174,560 USD</div>'
    +'<div style="font-size:13px;margin-top:5px"><span class="f-pos" style="font-weight:600">+6,260 USD</span> <span class="f-pos" style="font-weight:600">+3.8%</span> <span class="f-dim" style="margin-left:6px">Past month</span></div>'
    +'<div style="display:flex;gap:6px;margin-top:9px"><span style="width:16px;height:6px;border-radius:3px;background:#fafafa"></span><span style="width:6px;height:6px;border-radius:3px;background:#2b333b"></span><span style="width:6px;height:6px;border-radius:3px;background:#2b333b"></span></div></div>',
  total_chart:CHART_SVG(357,87,120)+'<div class="f-axis"><span>May 18</span><span>May 25</span><span>Jun 1</span><span>Jun 8</span><span>Jun 15</span></div>',
  px_num:'<div style="display:flex;justify-content:center;align-items:center;height:100%"><span class="f-pill"><span class="f-coin c-b" style="width:16px;height:16px;font-size:10px">₿</span>120,000&nbsp;<span class="f-pos" style="font-size:12px">+0.85%</span></span></div>',
  px_chart:'<div class="f-sec" style="font-size:16px;color:#a0a0a0">Bitcoin Price</div>'
    +'<div class="f-card" style="padding:14px 16px">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span class="f-coin c-b" style="width:24px;height:24px;font-size:12px">₿</span><span class="f-name" style="flex:1;font-size:16px">Bitcoin</span>'
    +'<span style="text-align:right"><div class="f-pos" style="font-weight:600;font-size:14px">+4.56% ↗</div><div style="font-weight:600;font-size:12px">84,240.10 USD</div></span></div>'
    +CHART_SVG(323,64,120)
    +'<div class="f-tfrow"><span class="f-tf">1D</span><span class="f-tf">1W</span><span class="f-tf on">1M</span><span class="f-tf">1Y</span><span class="f-tf">ALL</span></div>'
    +'<div class="f-cta">Buy Now</div></div>',
  market:'<div class="f-card f-row" style="height:100%">'
    +'<span style="position:relative;flex:none"><span class="f-coin c-b">₿</span>'
    +'<span style="position:absolute;left:-4px;bottom:-4px;width:17px;height:17px;border-radius:50%;background:#0a0a0a;color:#fafafa;font-size:9.5px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid #181818">$</span></span>'
    +'<span style="flex:1"><div class="f-name">BTC<span style="color:#a0a0a0">/USD</span></div><div class="f-sub" style="font-size:12.5px">65.2M</div></span>'
    +'<span style="text-align:right"><div class="f-amt" style="font-size:16px">64,130.70</div>'
    +'<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:2px">'
    +'<svg width="76" height="20" viewBox="0 0 76 20" fill="none" style="display:block">'
    +'<polyline points="1,17 4,13 7,15 10,10 13,12 16,8 19,10 22,6 25,9 28,5 31,8 34,4 37,7 40,5 43,8 46,4 49,7 52,5 55,8 58,5 61,7 64,4 67,7 70,6 73,8 75,7" stroke="#00c60d" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>'
    +'<span class="f-pos" style="font-size:13px;font-weight:600">+1.00%</span></div></span></div>',
  cash_act:'<div class="f-btnrow"><span class="f-btn">＋ Add Money</span><span class="f-btn">↑ Withdraw</span><span class="f-btn">₿ Buy Bitcoin</span></div>',
  wallets:
    wcard('Spending','📱','9,000 USD','<i style="flex:667;background:#f7931a"></i><i style="flex:200;background:#ffd54f"></i><i style="flex:133;background:#26a69a"></i>',
      '<span><span class="f-dot" style="background:#f7931a"></span>0.05 On-chain</span><span><span class="f-dot" style="background:#ffd54f"></span>0.015 Lightning</span><span><span class="f-dot" style="background:#26a69a"></span>1,200 USDT</span>')
    +wcard('Savings','🔒','60,000 USD','<i style="flex:1;background:#f7931a"></i>','<span><span class="f-dot" style="background:#f7931a"></span>0.5 On-chain</span>')
    +wcard('Vault','📱🔒☁','101,040 USD','<i style="flex:1;background:#f7931a"></i>','<span><span class="f-dot" style="background:#f7931a"></span>0.842 On-chain</span>')
    // Cash is custodial, so it reads as an account rather than a key-holding wallet:
    // dashed border + "custodial" tag keep the grouping without implying self-custody.
    +'<div class="f-card" style="padding:13px 14px;margin-bottom:14px;border-style:dashed">'
    +'<div style="display:flex;justify-content:space-between;align-items:center">'
    +'<span class="f-name">Cash <span style="font-size:9px;font-weight:600;color:#a0a0a0;border:1px solid #2b333b;border-radius:99px;padding:1px 6px;margin-left:3px;vertical-align:2px">CUSTODIAL</span></span>'
    +'<span class="f-amt">4,520 USD</span></div>'
    +'<div class="f-sub" style="margin-top:4px">US dollars · held by Blockstream</div></div>'
    +'<div class="f-card" style="height:44px;display:flex;align-items:center;justify-content:center;color:#a0a0a0;font-weight:500;font-size:13.5px">＋&nbsp; Set Up a New Wallet</div>',
  assets:'<div class="f-card" style="padding:13px 14px;margin-bottom:8px">'
    +'<div style="display:flex;align-items:center;gap:10px"><span class="f-coin c-b" style="width:28px;height:28px;font-size:12px">₿</span><span class="f-name" style="flex:1;font-size:16px">Bitcoin</span>'
    +'<span style="text-align:right"><div style="color:#00bcff;font-weight:600;font-size:14px">1.40700000 BTC</div><div class="f-sub">168,840 USD</div></span></div>'
    +'<div class="f-bar"><i style="flex:989;background:#f7931a"></i><i style="flex:11;background:#ffd54f"></i></div>'
    +'<div class="f-legend"><span><span class="f-dot" style="background:#f7931a"></span>1.392 On-chain</span><span><span class="f-dot" style="background:#ffd54f"></span>0.015 Lightning</span></div></div>'
    +frow('T','c-t','Tether USD','In Spending','<span style="color:#00bcff">1,200 USDT</span><div class="f-sub">1,200 USD</div>')
    +frow('$','c-g','Cash','In your Cash account','4,520.00 USD'),
  actions:'<div class="f-acts"><span class="f-act pri"><span class="ic">＋</span>Buy</span><span class="f-act"><span class="ic">↗</span>Send</span><span class="f-act"><span class="ic">↙</span>Receive</span></div>',
  activity:'<div class="f-sec">Recent Activity</div>'
    +frow('↙','c-b','Received bitcoin','To Savings · Yesterday','<span style="color:#00bcff">+0.0210 BTC</span><div class="f-sub">2,520 USD</div>')
    +frow('＋','c-g','Added cash','Bank transfer · Jun 12','+2,000.00 USD')
    +frow('↗','c-b','Sent bitcoin','From Spending · Jun 10','−0.0050 BTC<div class="f-sub">600 USD</div>'),
  offers:'<div class="f-card" style="padding:15px 16px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="f-name">Offers &amp; announcements</span><span class="f-dim" style="font-size:17px">›</span></div>'
    +'<div class="f-sub" style="margin-top:6px">Jade Plus — 10% off for app users · New: Lightning swaps are live</div></div>',
  hide:'<div style="display:flex;justify-content:center;align-items:center;height:100%"><span class="f-pill" style="font-size:12px;padding:0 10px">👁 Hide</span></div>',
  notif:'<div style="display:flex;justify-content:center;align-items:center;height:100%"><span class="f-pill" style="font-size:12px;padding:0 10px">🔔 <span style="color:#ff7556;font-size:10px">●2</span></span></div>',
  jade:frow('🔒','c-g','Jade','Hardware wallet · Connected','<span class="f-pos" style="font-size:16px">✓</span>'),
};
export { CONFIG, CARDS, FACES, SHORT, GROUPS };
