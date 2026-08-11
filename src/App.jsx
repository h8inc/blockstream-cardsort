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
  const closersDone = oneNumber && lens && cashHome;

  // Nobody is screened out: infrequent and non-users sort too. Their answers are
  // flagged via screener.freq so the analyzer can segment (or exclude) after the fact,
  // which beats throwing the response away at the door.
  function finishScreener() { setStep('sort'); }
  // Measure what actually fits above the fold before leaving the board — this is
  // the size-aware prioritisation signal that replaced the old "pick 4" squeeze.
  function finishSort() {
    setAboveFold(measureAboveFold());
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
      closers: { oneNumber, lens, cashHome, missing },
      events: boardState.events.slice(0, 200),
      meta: { ua: navigator.userAgent, vw: innerWidth, vh: innerHeight,
              screenW: SCREEN_W, screenH: SCREEN_H, foldPx: FOLD_PX },
    };
    payloadRef.current = p;
    return p;
  }
  async function trySend(payload) {
    if (!CONFIG.ENDPOINT_URL) return 'noendpoint';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(CONFIG.ENDPOINT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return 'sent';
        if (res.status === 404) return 'noendpoint'; // running without the function (local file / plain host)
      } catch (e) {}
      await sleep(700 * (attempt + 1));
    }
    return 'failed';
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
            <div className="qt">"I go out of my way to protect my financial privacy."</div>
            <Radio name="privacy" value="agree" sel={privacy} set={setPrivacy}>Agree</Radio>
            <Radio name="privacy" value="neutral" sel={privacy} set={setPrivacy}>Somewhere in between</Radio>
            <Radio name="privacy" value="disagree" sel={privacy} set={setPrivacy}>Disagree</Radio>
          </div>
          <button className="btn" id="scrNext" disabled={!screenerDone} onClick={finishScreener}>Continue</button>
        </div>
      )}

      {step === 'sort' && (
        <div className="step active" id="s-sort" ref={sortRef}>
          <h1>Build your first screen</h1>
          <p>Imagine opening the app fresh tomorrow. Every piece needs a decision: <strong>tap or drag it into the phone</strong> (stacked in your ideal order), or send it to <strong>"Not on my first screen"</strong> — tap the <strong>✕</strong> on the piece, or drag it to the red zone by the phone. Rejecting a piece doesn't delete it from the app; it just stays off your first screen. Small pieces sit <strong>side by side</strong> automatically, and the phone scrolls inside — what fits in the frame is what you'd see <strong>without scrolling</strong>.</p>
          <div className="parkzone" id="park">
            <div className="zhead">
              <span className="zt">🚫 NOT ON MY FIRST SCREEN</span>
              <span className="zs">drop pieces here, or tap the <b>✕</b> on a piece — it can still live deeper in the app</span>
            </div>
            <div className="cards" id="parkCards"></div>
          </div>
          <div className="sortwrap">
            <div className="pilecol">
              <h2>The pieces <span className="counts" id="pileCount">
                {board.placed < board.total ? `· ${board.total - board.placed} left to place` : '· all placed ✓'}
              </span></h2>
              <div className="pile" id="pile"></div>
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
            <span className="hint" id="sortHint">
              {board.placed < board.total ? `Place all pieces to continue (${board.total - board.placed} left)`
                : board.inStack === 0 ? 'Your phone is empty — put at least one piece in it'
                : 'Nice. Continue when it feels right.'}
            </span>
            <button className="btn" id="sortNext" disabled={!sortDone} onClick={finishSort}>Continue</button>
          </div>
        </div>
      )}

      {step === 'closers' && (
        <div className="step active" id="s-closers">
          <h1>Almost done</h1>
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
              Preview mode: the collection endpoint isn't reachable here (deploy to Netlify and <code>/api/collect</code> just works). Nothing was sent.
            </p>
          )}
        </div>
      )}

    </>
  );
}
