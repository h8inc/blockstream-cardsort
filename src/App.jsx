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
      {children}
    </label>
  );
}

export default function App() {
  const [step, setStep] = useState('intro');
  const [freq, setFreq] = useState(null);
  const [wallets, setWallets] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [board, setBoard] = useState({ placed: 0, total: CARDS.length, inStack: 0 });
  const [aboveFold, setAboveFold] = useState([]);
  const [keep, setKeep] = useState([]);
  const [oneNumber, setOneNumber] = useState(null);
  const [oneButton, setOneButton] = useState(null);
  const [lens, setLens] = useState(null);
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

  const screenerDone = freq && wallets && privacy;
  const sortDone = board.placed === board.total && board.inStack > 0;
  const closersDone = oneNumber && oneButton && lens;

  function finishScreener() {
    if (freq === 'rarely') {
      trySend(buildPayload(true));
      setStep('out');
    } else setStep('sort');
  }
  function startSqueeze() {
    const above = measureAboveFold();
    setAboveFold(above);
    setKeep(above.slice(0, 4));
    setStep('squeeze');
  }
  function toggleKeep(id) {
    setKeep(k => k.includes(id) ? k.filter(x => x !== id) : (k.length < 4 ? [...k, id] : k));
  }
  function buildPayload(screenedOut = false) {
    const p = {
      study: CONFIG.STUDY_NAME,
      id: idRef.current,
      submittedAt: new Date().toISOString(),
      durationSec: Math.round((Date.now() - startRef.current) / 1000),
      screenedOut,
      screener: { freq, wallets, privacy },
      stackOrder: boardState.stackOrder,
      aboveFold: aboveFold.length ? aboveFold : computeAboveFold(),
      parked: boardState.parked,
      squeezeKeep: keep,
      closers: { oneNumber, oneButton, lens, missing },
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
        <div className="step active" id="s-intro">
          <h1>Design your ideal first screen</h1>
          <p>We're rethinking the first screen of the Blockstream app and want it built around how <strong>you</strong> think, not how we do. This takes about <strong>5 minutes</strong>: you'll answer 3 quick questions, then arrange the pieces of the app into your ideal first screen.</p>
          <p>Responses are anonymous and used only to inform the app's design.</p>
          <button className="btn" onClick={() => setStep('screener')}>Start</button>
        </div>
      )}

      {step === 'screener' && (
        <div className="step active" id="s-screener">
          <h1>Three quick questions</h1>
          <div className="qbox">
            <div className="qt">How often do you use the Blockstream app?</div>
            <Radio name="freq" value="daily" sel={freq} set={setFreq}>Most days</Radio>
            <Radio name="freq" value="weekly" sel={freq} set={setFreq}>About weekly</Radio>
            <Radio name="freq" value="monthly" sel={freq} set={setFreq}>About monthly</Radio>
            <Radio name="freq" value="rarely" sel={freq} set={setFreq}>Less than monthly / I don't use it</Radio>
          </div>
          <div className="qbox">
            <div className="qt">How many wallets do you have set up in the app?</div>
            <Radio name="wallets" value="one" sel={wallets} set={setWallets}>One</Radio>
            <Radio name="wallets" value="multi" sel={wallets} set={setWallets}>Two or more</Radio>
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
              <div className="parkzone" id="park">
                <div className="zt">🚫 NOT ON MY FIRST SCREEN</div>
                <div className="zs">drop pieces here, or tap the <b>✕</b> on a piece — it can still live deeper in the app</div>
                <div className="cards" id="parkCards"></div>
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
            <button className="btn" id="sortNext" disabled={!sortDone} onClick={startSqueeze}>Continue</button>
          </div>
        </div>
      )}

      {step === 'squeeze' && (
        <div className="step active" id="s-squeeze">
          <h1>One last squeeze</h1>
          <p>Phone screens are cruel — realistically only <strong>4 pieces</strong> fit on screen before you scroll. From everything you kept, pick the <strong>4 that must stay visible</strong> the moment the app opens.</p>
          <div className="qbox sq" id="sqList">
            {boardState.stackOrder.map(id => {
              const c = CARDS.find(x => x.id === id);
              const on = keep.includes(id);
              return (
                <label key={id} className={'opt' + (on ? ' sel' : '')}>
                  <input type="checkbox" checked={on} disabled={!on && keep.length >= 4} onChange={() => toggleKeep(id)} value={id} />
                  {c.label}
                </label>
              );
            })}
          </div>
          <div className="bar">
            <span className="hint">Selected: <span className="sqcount" id="sqCount">{keep.length}</span> / 4</span>
            <button className="btn" id="sqNext" disabled={keep.length !== 4} onClick={() => setStep('closers')}>Continue</button>
          </div>
        </div>
      )}

      {step === 'closers' && (
        <div className="step active" id="s-closers">
          <h1>Almost done</h1>
          <div className="qbox">
            <div className="qt">The very top of the screen fits <strong>one glanceable number</strong>. Which one?</div>
            <Radio name="oneNumber" value="total_usd" sel={oneNumber} set={setOneNumber}>My total, in dollars</Radio>
            <Radio name="oneNumber" value="total_btc" sel={oneNumber} set={setOneNumber}>My total, in bitcoin</Radio>
            <Radio name="oneNumber" value="cash" sel={oneNumber} set={setOneNumber}>My cash balance</Radio>
          </div>
          <div className="qbox">
            <div className="qt">Only <strong>one action button</strong> fits next to it. Which one?</div>
            <Radio name="oneButton" value="buy" sel={oneButton} set={setOneButton}>Buy</Radio>
            <Radio name="oneButton" value="send" sel={oneButton} set={setOneButton}>Send</Radio>
            <Radio name="oneButton" value="receive" sel={oneButton} set={setOneButton}>Receive</Radio>
            <Radio name="oneButton" value="swap" sel={oneButton} set={setOneButton}>Swap</Radio>
          </div>
          <div className="qbox">
            <div className="qt">Your money, listed on the first screen — grouped how?</div>
            <Radio name="lens" value="wallet" sel={lens} set={setLens}>By wallet (Phone, Jade, multisig…)</Radio>
            <Radio name="lens" value="asset" sel={lens} set={setLens}>By asset (bitcoin, tether, cash…)</Radio>
            <Radio name="lens" value="toggle" sel={lens} set={setLens}>Both — let me toggle between them</Radio>
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

      {step === 'out' && (
        <div className="step active" id="s-out">
          <div className="done-ic">🙏</div>
          <h1>Thanks for your interest!</h1>
          <p>This particular study is for people currently using the Blockstream app at least monthly, so we'll stop here — but we appreciate you taking the time.</p>
        </div>
      )}
    </>
  );
}
