import { useEffect, useRef, useState } from 'react';
import { CONFIG, CARDS } from './data.js';
import { boardState, initBoard, destroyBoard, measureAboveFold, computeAboveFold,
         SCREEN_W, SCREEN_H, FOLD_PX } from './board.js';

const rid = () => 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function Radio({ name, value, sel, set, children }) {
  return (
    <label className={'opt' + (sel === value ? ' sel' : '')}>
      <input type="radio" name={name} checked={sel === value} onChange={() => set(value)} value={value} />
      <span className="optlab">{children}</span>
    </label>
  );
}

function Check({ name, value, sel, set, children }) {
  const on = sel.includes(value);
  return (
    <label className={'opt' + (on ? ' sel' : '')}>
      <input type="checkbox" name={name} checked={on} value={value}
        onChange={() => set(on ? sel.filter(v => v !== value) : [...sel, value])} />
      <span className="optlab">{children}</span>
    </label>
  );
}

export default function App() {
  const [step, setStep] = useState('intro');
  const [freq, setFreq] = useState(null);
  const [wallets, setWallets] = useState(null);
  const [walletsAll, setWalletsAll] = useState(null);
  const [heldWhere, setHeldWhere] = useState([]);
  const [connect, setConnect] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [board, setBoard] = useState({ placed: 0, total: CARDS.length, inStack: 0 });
  const [aboveFold, setAboveFold] = useState([]);
  const [oneNumber, setOneNumber] = useState(null);
  const [lens, setLens] = useState(null);
  const [cashHome, setCashHome] = useState(null);
  const [screenScope, setScreenScope] = useState(null);
  const [actionScope, setActionScope] = useState(null);
  // Which action pieces the participant actually put on their first screen —
  // frozen when they leave the board so the follow-up only asks what applies.
  const [placedActions, setPlacedActions] = useState([]);
  const [missing, setMissing] = useState('');
  const [submitState, setSubmitState] = useState('idle'); // idle|busy|sent|noendpoint|failed
  const sortRef = useRef(null);
  const idRef = useRef(rid());
  const startRef = useRef(Date.now());
  const payloadRef = useRef(null);

  useEffect(() => {
    if (step !== 'sort') return;
    initBoard(sortRef.current, setBoard);
    return destroyBoard;
  }, [step]);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const screenerDone = freq && wallets && walletsAll && heldWhere.length && connect && privacy;
  const sortDone = board.placed === board.total && board.inStack > 0;
  const asksActionScope = placedActions.length > 0;
  const closersDone = oneNumber && lens && screenScope && cashHome && (!asksActionScope || actionScope);

  // Nobody is screened out: infrequent and non-users sort too. Their answers are
  // flagged via screener.freq so the analyzer can segment (or exclude) after the fact,
  // which beats throwing the response away at the door.
  function finishScreener() { setStep('sort'); }
  // Measure what actually fits above the fold before leaving the board — this is
  // the size-aware prioritisation signal that replaced the old "pick 4" squeeze.
  function finishSort() {
    setAboveFold(measureAboveFold());
    setPlacedActions(['actions', 'cash_act'].filter(id => boardState.stackOrder.includes(id)));
    setStep('closers');
  }
  function buildPayload(screenedOut = false) {
    const p = {
      study: CONFIG.STUDY_NAME,
      id: idRef.current,
      submittedAt: new Date().toISOString(),
      durationSec: Math.round((Date.now() - startRef.current) / 1000),
      screenedOut,
      screener: { freq, wallets, walletsAll, heldWhere, connect, privacy },
      stackOrder: boardState.stackOrder,
      aboveFold: aboveFold.length ? aboveFold : computeAboveFold(),
      parked: boardState.parked,
      closers: { oneNumber, lens, screenScope, cashHome, actionScope, askedActionScope: asksActionScope, missing },
      events: boardState.events.slice(0, 200),
      meta: { ua: navigator.userAgent, vw: innerWidth, vh: innerHeight,
              screenW: SCREEN_W, screenH: SCREEN_H, foldPx: FOLD_PX },
    };
    payloadRef.current = p;
    return p;
  }
  async function trySend(payload) {
    if (!CONFIG.ENDPOINT_URL) return 'noendpoint';
    const body = JSON.stringify(payload);
    // Primary first; the legacy alias second in case anything unexpected ever
    // blocks the primary path the way "/api/collect" was blocked by ad blockers.
    const urls = [CONFIG.ENDPOINT_URL, ...(CONFIG.ENDPOINT_FALLBACKS || [])];
    let sawNetworkError = false, saw404 = false;
    for (const url of urls) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body,
            keepalive: true, // survives the tab closing right after Submit
          });
          if (res.ok) return 'sent';
          if (res.status === 404) { saw404 = true; break; } // no function here — try next url
          if (res.status >= 400 && res.status < 500) break; // permanent — retrying can't help
        } catch (e) { sawNetworkError = true; }
        await sleep(700 * (attempt + 1));
      }
    }
    // Every url 404'd and nothing was actively blocked -> genuinely no endpoint (local preview).
    return saw404 && !sawNetworkError ? 'noendpoint' : 'failed';
  }
  async function submit() {
    setSubmitState('busy');
    const result = await trySend(buildPayload());
    setSubmitState(result === 'sent' ? 'sent' : result);
    setStep('done');
  }
  function downloadJSON() {
    const blob = new Blob([JSON.stringify(payloadRef.current || buildPayload(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cardsort-' + idRef.current + '.json';
    a.click();
  }
  function emailJSON() {
    const p = { ...(payloadRef.current || buildPayload()) };
    delete p.events; delete p.meta;
    const body = JSON.stringify(p);
    const subject = 'Card sort response ' + idRef.current;
    if (body.length < 1800) {
      location.href = 'mailto:' + CONFIG.CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    } else {
      downloadJSON();
      location.href = 'mailto:' + CONFIG.CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent('Attaching my card sort response file (it downloaded automatically).');
    }
  }

  return (
    <>
      {step === 'intro' && (
        <div className="step active intro" id="s-intro">
          <img className="brand" src="/blockstream-logo.svg" alt="Blockstream" width="309" height="69" />
          <div className="kicker">App design study</div>
          <h1>What should the first screen of your <span className="hl">self-custody bank</span> look like?</h1>
          <p className="lede">
            For years the app has been a place to hold bitcoin. We want it to become the place you run your
            money from — without ever handing over your keys.
          </p>

          <div className="shift">
            <div className="shift-card from">
              <div className="shift-lab">Today</div>
              <div className="shift-t">A wallet app</div>
              <div className="shift-d">You open it to send, receive and check one wallet at a time.</div>
            </div>
            <div className="shift-arrow" aria-hidden="true">→</div>
            <div className="shift-card to">
              <div className="shift-lab">Where we're going</div>
              <div className="shift-t">A financial OS</div>
              <div className="shift-d">Everything you hold — across your wallets, across chains and currencies — in one place. Still yours. Still self-custodied.</div>
            </div>
          </div>

          <p className="punch">One screen. Room for very little. You decide what earns a place.</p>

          <div className="steps3">
            <div className="s3"><span className="n">1</span> Six quick questions about how you hold today</div>
            <div className="s3"><span className="n">2</span> Build your ideal first screen from the real pieces</div>
            <div className="s3"><span className="n">3</span> Three last calls on what earns the top spot</div>
          </div>

          <button className="btn" onClick={() => setStep('screener')}>Start — about 4 minutes</button>
          <p className="fineprint">Anonymous. Used only to shape the next version of the app.</p>
        </div>
      )}

      {step === 'screener' && (
        <div className="step active" id="s-screener">
          <h1>First, how you hold today</h1>
          <p>Six quick questions — about a minute.</p>
          <div className="qbox">
            <div className="qt">How often do you use the Blockstream app?</div>
            <Radio name="freq" value="daily" sel={freq} set={setFreq}>Most days</Radio>
            <Radio name="freq" value="weekly" sel={freq} set={setFreq}>About weekly</Radio>
            <Radio name="freq" value="monthly" sel={freq} set={setFreq}>About monthly</Radio>
            <Radio name="freq" value="rarely" sel={freq} set={setFreq}>Less than monthly / I don't use it</Radio>
          </div>
          <div className="qbox">
            <div className="qt">How many wallets do you have set up in the Blockstream app?</div>
            <Radio name="wallets" value="one" sel={wallets} set={setWallets}>One</Radio>
            <Radio name="wallets" value="two" sel={wallets} set={setWallets}>Two</Radio>
            <Radio name="wallets" value="many" sel={wallets} set={setWallets}>More than two</Radio>
          </div>
          <div className="qbox">
            <div className="qt">And in total — across every app, device and exchange you use?</div>
            <Radio name="walletsAll" value="one" sel={walletsAll} set={setWalletsAll}>Just the one</Radio>
            <Radio name="walletsAll" value="two" sel={walletsAll} set={setWalletsAll}>Two</Radio>
            <Radio name="walletsAll" value="three_five" sel={walletsAll} set={setWalletsAll}>Three to five</Radio>
            <Radio name="walletsAll" value="six_plus" sel={walletsAll} set={setWalletsAll}>More than five</Radio>
          </div>
          <div className="qbox">
            <div className="qt">Where else do you keep bitcoin or other crypto? <span className="qsub">Tick everything that applies.</span></div>
            <Check name="heldWhere" value="hardware" sel={heldWhere} set={setHeldWhere}>A hardware wallet (Jade, Ledger, Trezor…)</Check>
            <Check name="heldWhere" value="other_app" sel={heldWhere} set={setHeldWhere}>Another phone app</Check>
            <Check name="heldWhere" value="desktop" sel={heldWhere} set={setHeldWhere}>A desktop wallet (Sparrow, Electrum…)</Check>
            <Check name="heldWhere" value="exchange" sel={heldWhere} set={setHeldWhere}>An exchange account</Check>
            <Check name="heldWhere" value="nowhere" sel={heldWhere} set={setHeldWhere}>Nowhere else — it's all in the Blockstream app</Check>
          </div>
          <div className="qbox">
            <div className="qt">If the Blockstream app could show those other wallets alongside your own, would you want that?</div>
            <Radio name="connect" value="full" sel={connect} set={setConnect}>Yes — see them and spend from them</Radio>
            <Radio name="connect" value="view" sel={connect} set={setConnect}>Yes, but view only — I'd still spend elsewhere</Radio>
            <Radio name="connect" value="no" sel={connect} set={setConnect}>No — I want them kept separate</Radio>
            <Radio name="connect" value="unsure" sel={connect} set={setConnect}>Not sure</Radio>
          </div>
          <div className="qbox">
            <div className="qt">Do you take extra steps to keep your money private?</div>
            <Radio name="privacy" value="agree" sel={privacy} set={setPrivacy}>Yes, often</Radio>
            <Radio name="privacy" value="neutral" sel={privacy} set={setPrivacy}>Sometimes</Radio>
            <Radio name="privacy" value="disagree" sel={privacy} set={setPrivacy}>No, not really</Radio>
          </div>
          <button className="btn" id="scrNext" disabled={!screenerDone} onClick={finishScreener}>Continue</button>
        </div>
      )}

      {step === 'sort' && (
        <div className="step active" id="s-sort" ref={sortRef}>
          <h1>Build your first screen</h1>
          <p><strong>This is the screen you'd land on every time you open the app.</strong> Whatever you put here is what you'd see and reach for first — and whatever you leave off, you'd have to go looking for. So build the one you'd actually want to use.</p>
          <p><strong>Every piece needs a home — all {board.total} of them.</strong> Tap or drag a piece into the phone (stacked in your ideal order), or send it to <strong>"Not on my first screen"</strong> with the <strong>✕</strong> or by dragging it to the red zone. Leaving a piece off doesn't delete it from the app; it just lives deeper in.</p>
          <p className="undoline">Changed your mind? Drag a piece back to the list, or tap a rejected piece to undo. Small pieces sit <strong>side by side</strong> automatically, and the phone scrolls inside — what fits in the frame is what you'd see <strong>without scrolling</strong>.</p>
          <div className="parkzone" id="park">
            <div className="zhead">
              <span className="zt">🚫 NOT ON MY FIRST SCREEN</span>
              <span className="zs">drop pieces here, or tap the <b>✕</b> on a piece — it still lives deeper in the app. Tap a piece below to put it back.</span>
            </div>
            <div className="cards" id="parkCards"></div>
          </div>
          <div className="sortwrap">
            <div className="pilecol">
              <h2>The pieces <span className="counts" id="pileCount">
                {board.placed < board.total ? `· ${board.total - board.placed} left to place` : '· all placed ✓'}
              </span></h2>
              <div className="pile" id="pile"></div>
              <div className="pileempty" id="pileEmpty" style={{ display: 'none' }}>
                ✓ Every piece has a home.<br />
                <span>Changed your mind? Drag one back here, or tap a rejected piece above.</span>
              </div>
            </div>
            <div className="phonecol">
              <div className="reorderhint" id="reorderHint" style={{ display: 'none' }}>
                ⠿ <b>Grab any piece</b> in the phone and drag it up or down to change the order
              </div>
              <div className="scalebox" id="scalebox">
                <div className="phone" id="phoneEl">
                  <div className="screen">
                    <div className="statusbar"><span>9:41</span><span className="sright">▮▮▮ ⌁ ▉</span></div>
                    <div className="stackwrap" id="stackwrap"><div className="stack" id="stack"></div></div>
                    <div className="fold"><span className="lab">screen ends here — scroll inside for more</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="parkdock" id="parkDock">🚫 Drop here — NOT ON MY FIRST SCREEN</div>
          <div className="bar">
            <div className="barleft">
              <div className="pbar" aria-hidden="true">
                <i style={{ width: `${Math.round(100 * board.placed / (board.total || 1))}%` }} />
              </div>
              <span className="hint" id="sortHint">
                {board.placed < board.total
                  ? `${board.placed} of ${board.total} pieces placed — every piece needs a home before you continue`
                  : board.inStack === 0 ? 'Your phone is empty — put at least one piece in it'
                  : `All ${board.total} placed. Continue when it feels right.`}
              </span>
            </div>
            <button className="btn" id="sortNext" disabled={!sortDone} onClick={finishSort}>Continue</button>
          </div>
        </div>
      )}

      {step === 'closers' && (
        <div className="step active" id="s-closers">
          <h1>Almost done</h1>
          <p>Three last calls on the screen you just built — the one you'd open the app to every day.</p>
          <div className="qbox">
            <div className="qt">The moment you open the app, the very top has room for <strong>one big number</strong>.</div>
            <p style={{ fontSize: 14, margin: '0 0 10px' }}>
              Your <strong>total</strong> means everything you hold added up — bitcoin, tether, <em>and</em> the dollars in your cash account. Which number belongs at the top?
            </p>
            <Radio name="oneNumber" value="total_usd" sel={oneNumber} set={setOneNumber}>
              My total in dollars — e.g. <strong>174,560 USD</strong>
            </Radio>
            <Radio name="oneNumber" value="total_btc" sel={oneNumber} set={setOneNumber}>
              My total in bitcoin — e.g. <strong>1.4534 BTC</strong> (cash and tether converted at today's price)
            </Radio>
            <Radio name="oneNumber" value="btc_only" sel={oneNumber} set={setOneNumber}>
              Only my bitcoin — e.g. <strong>1.4070 BTC</strong> (cash and tether not counted)
            </Radio>
            <Radio name="oneNumber" value="none" sel={oneNumber} set={setOneNumber}>
              No big number — take me straight to my wallets or assets
            </Radio>
          </div>
          <div className="qbox">
            <div className="qt">Your money, listed on the first screen — grouped how?</div>
            <Radio name="lens" value="wallet" sel={lens} set={setLens}>By wallet (Phone, Jade, multisig…)</Radio>
            <Radio name="lens" value="asset" sel={lens} set={setLens}>By asset (bitcoin, tether, cash…)</Radio>
            <Radio name="lens" value="toggle" sel={lens} set={setLens}>Both — let me toggle between them</Radio>
          </div>
          {/* Asked before anything reveals the answer — otherwise the question
              corrects the misconception it is trying to measure. */}
          <div className="qbox">
            <div className="qt">Think about the screen you just built. Whose money is it showing?</div>
            <Radio name="screenScope" value="one_wallet" sel={screenScope} set={setScreenScope}>One wallet — my main one</Radio>
            <Radio name="screenScope" value="all_wallets" sel={screenScope} set={setScreenScope}>All my wallets, added together</Radio>
            <Radio name="screenScope" value="all_plus_cash" sel={screenScope} set={setScreenScope}>All my wallets <em>and</em> my cash, added together</Radio>
            <Radio name="screenScope" value="unsure" sel={screenScope} set={setScreenScope}>I'm not sure</Radio>
          </div>
          {asksActionScope && (
            <div className="qbox">
              <div className="qt">
                You put {placedActions.includes('actions') ? <b>Buy · Send · Receive</b> : <b>the cash buttons</b>}
                {placedActions.length === 2 && <> and <b>the cash buttons</b></>} on your first screen.
              </div>
              <p style={{ fontSize: 14, margin: '0 0 10px' }}>
                To be clear: that screen shows <strong>everything at once</strong> — all your wallets and your cash together,
                not one wallet. So when you tap <strong>Send</strong> there, which money should it come from?
              </p>
              <Radio name="actionScope" value="one_wallet" sel={actionScope} set={setActionScope}>Wait — I thought I was in one wallet. That changes my answer</Radio>
              <Radio name="actionScope" value="ask" sel={actionScope} set={setActionScope}>Ask me which wallet, every time</Radio>
              <Radio name="actionScope" value="default" sel={actionScope} set={setActionScope}>Use one wallet I've set as the default — but let me switch</Radio>
              <Radio name="actionScope" value="last" sel={actionScope} set={setActionScope}>Whichever wallet I used last</Radio>
              <Radio name="actionScope" value="auto" sel={actionScope} set={setActionScope}>Let the app choose the best one for me</Radio>
              <Radio name="actionScope" value="unaware" sel={actionScope} set={setActionScope}>I hadn't thought about it — I assumed it would just know</Radio>
            </div>
          )}
          <div className="qbox">
            <div className="qt">Your cash (dollars) is held by Blockstream, not in a wallet you hold keys for. Where should it appear?</div>
            <Radio name="cashHome" value="own_row" sel={cashHome} set={setCashHome}>On its own row on the first screen</Radio>
            <Radio name="cashHome" value="in_assets" sel={cashHome} set={setCashHome}>Inside the asset list, next to bitcoin and tether</Radio>
            <Radio name="cashHome" value="in_wallets" sel={cashHome} set={setCashHome}>In the wallet list, as its own cash account</Radio>
            <Radio name="cashHome" value="not_first" sel={cashHome} set={setCashHome}>Not on the first screen at all</Radio>
          </div>
          <div className="qbox">
            <div className="qt">Anything missing from the pieces you sorted? (optional)</div>
            <textarea id="missing" value={missing} onChange={e => setMissing(e.target.value)}
              placeholder="e.g. something you'd want on the first screen that wasn't in the set" />
          </div>
          <button className="btn" id="clNext" disabled={!closersDone || submitState === 'busy'} onClick={submit}>
            {submitState === 'busy' ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="step active" id="s-done">
          <div className="done-ic" id="doneIc">{submitState === 'failed' ? '📨' : '✅'}</div>
          <h1 id="doneTitle">{submitState === 'failed' ? 'One tap to finish' : 'Thank you!'}</h1>
          <p id="doneMsg">
            {submitState === 'failed'
              ? 'Your design is ready — the network hiccupped on our side, so send it this way instead (nothing personal in it, just your card arrangement):'
              : 'Your first-screen design has been recorded. It goes straight into how we shape the next version of the app.'}
          </p>
          {submitState === 'failed' && (
            <div id="fallback">
              <button className="btn" onClick={emailJSON}>Send it by email — one tap</button>{' '}
              <button className="btn secondary" onClick={downloadJSON}>Or download the file</button>
            </div>
          )}
          {submitState === 'noendpoint' && (
            <p id="previewNote" style={{ fontSize: 13, color: 'var(--muted)' }}>
              Preview mode: the collection endpoint isn't reachable here (deploy to Netlify and <code>/api/entry</code> just works). Nothing was sent.
            </p>
          )}
        </div>
      )}

    </>
  );
}
