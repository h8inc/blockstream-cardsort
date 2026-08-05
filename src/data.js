const CONFIG = {
  // Paste your Google Apps Script web-app URL here (see README / apps-script.gs). Leave "" to use download-only mode.
  ENDPOINT_URL: "/api/collect", // built-in Netlify Function; override with a full URL if needed
  // Shown in the fallback message if submission fails:
  CONTACT_EMAIL: "nterziev@blockstream.com",
  STUDY_NAME: "blockstream-first-screen-v1"
};
// Card set — MUST stay identical (ids + labels) to the moderated FigJam set and analyze.html
// h = height in phone UNITS (1 unit = 1rem at full scale, real-component-ish
// heights on a 25.125-unit-wide / 402px screen). w = fraction of phone width.
// Small pieces (w<1) pack side by side when adjacent — like a real app row.
const IMG = {}; /*IMG_DATA*/
const SHORT = {total:"Total balance", total_chart:"Balance chart", px_num:"BTC price",
  px_chart:"Price chart", cash:"Cash", cash_act:"Cash actions", wallets:"My wallets",
  assets:"My assets", actions:"Buy·Send·Receive", activity:"Recent activity",
  offers:"Offers", hide:"Hide balances", notif:"Notifications", jade:"Jade status"};
const CARDS = [
  // h = natural height of the designed component (Figma "01 Dashboard" / CardList)
  {id:"total",      label:"Total balance in USD/EUR (across assets & wallets)", h:101, w:1},
  {id:"total_chart",label:"Balance chart (my total balance, over time)",        h:106, w:1},
  {id:"px_num",     label:"Bitcoin price (number + % change, tap for chart)",   h:34,  w:0.5},
  {id:"px_chart",   label:"Price chart (bitcoin price, over time)",             h:260, w:1},
  {id:"cash",    label:"Cash balance (dollars)",                 h:60,  w:1},
  {id:"cash_act",label:"Add money / Withdraw / Buy buttons",     h:42,  w:1},
  {id:"wallets", label:"List of my wallets",                     h:329, w:1},
  {id:"assets",  label:"List of my assets (bitcoin, tether, …)", h:226, w:1},
  {id:"actions", label:"Buy · Send · Receive", h:61, w:1, chips:["Buy","Send","Receive"]},
  {id:"activity",label:"Recent activity (latest transactions)",  h:236, w:1},
  {id:"offers",  label:"Offers & announcements",                 h:85,  w:1},
  {id:"hide",    label:"Hide / show balances (eye)",             h:34,  w:0.25},
  {id:"notif",   label:"Notifications",                          h:34,  w:0.25},
  {id:"jade",    label:"Jade / hardware wallet status",          h:64,  w:1},
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
  cash:frow('$','c-g','Cash','Global · outside your wallets','4,520.00 USD'),
  cash_act:'<div class="f-btnrow"><span class="f-btn">＋ Add Money</span><span class="f-btn">↑ Withdraw</span><span class="f-btn">₿ Buy Bitcoin</span></div>',
  wallets:
    wcard('Spending','📱','9,000 USD','<i style="flex:667;background:#f7931a"></i><i style="flex:200;background:#ffd54f"></i><i style="flex:133;background:#26a69a"></i>',
      '<span><span class="f-dot" style="background:#f7931a"></span>0.05 On-chain</span><span><span class="f-dot" style="background:#ffd54f"></span>0.015 Lightning</span><span><span class="f-dot" style="background:#26a69a"></span>1,200 USDT</span>')
    +wcard('Savings','🔒','60,000 USD','<i style="flex:1;background:#f7931a"></i>','<span><span class="f-dot" style="background:#f7931a"></span>0.5 On-chain</span>')
    +wcard('Vault','📱🔒☁','101,040 USD','<i style="flex:1;background:#f7931a"></i>','<span><span class="f-dot" style="background:#f7931a"></span>0.842 On-chain</span>')
    +'<div class="f-card" style="height:44px;display:flex;align-items:center;justify-content:center;color:#a0a0a0;font-weight:500;font-size:13.5px">＋&nbsp; Set Up a New Wallet</div>',
  assets:'<div class="f-card" style="padding:13px 14px;margin-bottom:8px">'
    +'<div style="display:flex;align-items:center;gap:10px"><span class="f-coin c-b" style="width:28px;height:28px;font-size:12px">₿</span><span class="f-name" style="flex:1;font-size:16px">Bitcoin</span>'
    +'<span style="text-align:right"><div style="color:#00bcff;font-weight:600;font-size:14px">1.40700000 BTC</div><div class="f-sub">168,840 USD</div></span></div>'
    +'<div class="f-bar"><i style="flex:989;background:#f7931a"></i><i style="flex:11;background:#ffd54f"></i></div>'
    +'<div class="f-legend"><span><span class="f-dot" style="background:#f7931a"></span>1.392 On-chain</span><span><span class="f-dot" style="background:#ffd54f"></span>0.015 Lightning</span></div></div>'
    +frow('T','c-t','Tether USD','In Spending','<span style="color:#00bcff">1,200 USDT</span><div class="f-sub">1,200 USD</div>')
    +frow('$','c-g','Cash','Global · outside your wallets','4,520.00 USD'),
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
export { CONFIG, CARDS, FACES, SHORT };
