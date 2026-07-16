import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const MEDIA = path.join(HERE, 'media');
const OUT = path.join(HERE, 'intake-timeline.html');

const b64 = (f) => readFileSync(path.join(MEDIA, f)).toString('base64');
const videoUri = `data:video/mp4;base64,${b64('combined-web.mp4')}`;
const thumb = (i) => `data:image/jpeg;base64,${b64(`thumb${i}.jpg`)}`;

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Real clip boundaries in the combined 20.4s video (from ffprobe durations).
const clips = [
  {
    n: 1, file: 'IMG_2037.mov', start: 0, end: 4.7, analyzed: true, thumb: thumb(1),
    count: '≈4 balls',
    summary:
      'Picks up and holds multiple purple balls, but the roller material and spacing need work to stop jamming and improve grip.',
    issues: [
      { sev: 'high', obs: 'Balls slip off the rollers when not held securely', fix: 'Switch to a higher-grip roller material — rubber or a textured surface' },
      { sev: 'medium', obs: 'Balls jam when they sit too close together', fix: 'Increase roller spacing so balls separate cleanly' },
    ],
  },
  {
    n: 2, file: 'IMG_2038.mov', start: 4.7, end: 8.23, analyzed: false, thumb: thumb(2),
    note: '3.5s clip — under TwelveLabs’ 4-second minimum to analyze on its own. Its footage is still covered by the combined pass.',
  },
  {
    n: 3, file: 'IMG_2040.mov', start: 8.23, end: 11.24, analyzed: false, thumb: thumb(3),
    note: '3.0s clip — under the 4-second minimum to analyze on its own. Covered by the combined pass.',
  },
  {
    n: 4, file: 'IMG_2041.mov', start: 11.24, end: 15.41, analyzed: true, thumb: thumb(4),
    count: '≈5 balls',
    summary:
      'Collects most balls but grip is inconsistent and it occasionally jams; it also misses balls on the first pass.',
    issues: [
      { sev: 'high', obs: 'Balls jam in the intake', fix: 'Adjust roller spacing so balls don’t get stuck' },
      { sev: 'high', obs: 'Doesn’t collect every ball on the first attempt', fix: 'Widen the intake geometry to cover more area' },
      { sev: 'medium', obs: 'Balls aren’t gripped consistently — some fall back out', fix: 'Add rollers or raise roller friction' },
    ],
  },
  {
    n: 5, file: 'IMG_2042.mov', start: 15.41, end: 20.4, analyzed: true, thumb: thumb(5),
    count: '4/4 purple · 0/3 green',
    summary:
      'Captures purple balls reliably but fails to engage green balls — they deflect or roll off. A center dead zone hurts angled approaches.',
    issues: [
      { sev: 'high', obs: 'Green balls are never captured — deflected or roll off the intake', fix: 'Reduce the roller gap ~3 mm and add a slight inward taper to form a converging intake zone' },
      { sev: 'medium', obs: 'Purple balls pick up with minimal slippage (good baseline)', fix: 'Move to high-friction soft rubber (~80A durometer) to grip both colors' },
      { sev: 'medium', obs: 'Dead zone at the center of the roller assembly, worst on angled approaches', fix: 'Add compliant centerline rollers or a rubber strip to kill the dead zone' },
    ],
  },
];

const recurring = [
  { title: 'Roller grip / material', body: 'Switch to high-friction soft rubber (~80A durometer). Rigid/low-grip rollers let balls slip and drop.', clips: '1 · 4 · 5' },
  { title: 'Roller spacing & gap', body: 'Tune the gap: too tight jams, too loose drops. Clip 5’s specific: reduce ~3 mm and add an inward taper.', clips: '1 · 4 · 5' },
  { title: 'Coverage & dead zone', body: 'Widen intake geometry and add compliant centerline rollers so misaligned / angled balls still get pulled in.', clips: '4 · 5' },
];

const total = 20.4;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (x) => ((x / total) * 100).toFixed(3);

const sevLabel = { high: 'High', medium: 'Medium', low: 'Low' };

const clipCard = (c) => {
  if (!c.analyzed) {
    return `<article class="clip clip--skip" data-start="${c.start}" data-n="${c.n}">
      <div class="clip__head">
        <span class="clip__num">Clip ${c.n}</span>
        <span class="clip__file">${esc(c.file)}</span>
        <span class="clip__time">${fmt(c.start)}–${fmt(c.end)}</span>
      </div>
      <div class="clip__body">
        <button class="thumb thumb--skip" data-seek="${c.start}" aria-label="Play clip ${c.n} in the video">
          <img src="${c.thumb}" alt="Frame from clip ${c.n}" />
        </button>
        <p class="skipnote">${esc(c.note)}</p>
      </div>
    </article>`;
  }
  const issues = c.issues
    .map(
      (i) => `<li class="issue">
        <span class="chip chip--${i.sev}">${sevLabel[i.sev]}</span>
        <div class="issue__text">
          <p class="issue__obs">${esc(i.obs)}</p>
          <p class="issue__fix"><span class="arrow">→</span>${esc(i.fix)}</p>
        </div>
      </li>`,
    )
    .join('');
  return `<article class="clip" data-start="${c.start}" data-n="${c.n}">
    <div class="clip__head">
      <span class="clip__num">Clip ${c.n}</span>
      <span class="clip__file">${esc(c.file)}</span>
      <span class="clip__time">${fmt(c.start)}–${fmt(c.end)}</span>
      <span class="clip__count" title="AI estimate — treat as rough">${esc(c.count)}</span>
    </div>
    <div class="clip__body">
      <button class="thumb" data-seek="${c.start}" aria-label="Play clip ${c.n} in the video">
        <img src="${c.thumb}" alt="Frame from clip ${c.n}" />
        <span class="thumb__play" aria-hidden="true">▶</span>
      </button>
      <div class="clip__detail">
        <p class="clip__summary">${esc(c.summary)}</p>
        <ul class="issues">${issues}</ul>
      </div>
    </div>
  </article>`;
};

const segments = clips
  .map(
    (c) => `<button class="seg${c.analyzed ? '' : ' seg--skip'}" role="tab"
      data-n="${c.n}" data-seek="${c.start}"
      style="left:${pct(c.start)}%;width:${pct(c.end - c.start)}%"
      title="Clip ${c.n} · ${fmt(c.start)}–${fmt(c.end)}"
      aria-label="Clip ${c.n}, ${fmt(c.start)} to ${fmt(c.end)}">
      <span class="seg__n">${c.n}</span>
    </button>`,
  )
  .join('');

const recurCards = recurring
  .map(
    (r, i) => `<div class="recur">
      <span class="recur__idx">0${i + 1}</span>
      <div>
        <h3 class="recur__title">${esc(r.title)}</h3>
        <p class="recur__body">${esc(r.body)}</p>
        <span class="recur__clips">seen in clips ${esc(r.clips)}</span>
      </div>
    </div>`,
  )
  .join('');

const html = `<div class="page">
  <header class="head">
    <p class="eyebrow">Module Feedback · TwelveLabs Pegasus</p>
    <h1>Intake review</h1>
    <p class="lede">An AI watched five clips of the robot’s ball intake and flagged what to change. Scrub the footage, or jump to any clip to see what it saw.</p>
  </header>

  <section class="tiles" aria-label="Summary">
    <div class="tile"><span class="tile__v">5</span><span class="tile__k">clips reviewed</span></div>
    <div class="tile"><span class="tile__v">20.4<span class="tile__u">s</span></span><span class="tile__k">total footage</span></div>
    <div class="tile"><span class="tile__v">3</span><span class="tile__k">recurring fixes</span></div>
    <div class="tile tile--flag"><span class="tile__v">green balls</span><span class="tile__k">not being captured</span></div>
  </section>

  <section class="player">
    <video id="vid" playsinline preload="metadata" poster="${clips[0].thumb}">
      <source src="${videoUri}" type="video/mp4" />
    </video>
    <div class="scrub" role="tablist" aria-label="Clip timeline">
      <div class="scrub__track">
        <div id="progress" class="scrub__progress"></div>
        ${segments}
      </div>
      <div class="scrub__row">
        <button id="play" class="play" aria-label="Play or pause">▶ Play</button>
        <span id="tc" class="tc">0:00 / 0:20</span>
        <span class="scrub__hint">click a numbered block to jump to that clip</span>
      </div>
    </div>
  </section>

  <section class="breakdown">
    <h2 class="h2">Per-clip breakdown</h2>
    <div class="clips">${clips.map(clipCard).join('')}</div>
  </section>

  <section class="synth">
    <h2 class="h2">What kept coming up</h2>
    <p class="synth__lede">The same three fixes surfaced across independent clips — that repetition is the strongest signal here.</p>
    <div class="recurs">${recurCards}</div>
    <div class="insight">
      <span class="insight__tag">Sharpest finding</span>
      <p>Clip 5 captured <b class="pill pill--purple">4/4 purple</b> balls but <b class="pill pill--green">0/3 green</b>. Grip looks tuned for purple — check whether green elements differ in size or surface.</p>
    </div>
  </section>

  <footer class="foot">
    <p><b>On the numbers:</b> the ball counts above are the model’s rough estimates. A stricter structured pass over the joined footage went haywire and “counted” 103 balls, so don’t trust exact counts yet — the repeated <em>qualitative</em> fixes are the reliable signal. Reliable auto-counting is the next thing to try (TwelveLabs’ time-based segmentation).</p>
    <p class="foot__meta">Method 2 · TwelveLabs Pegasus 1.2 · per-clip analysis · proof-of-concept, not wired into the TeamTrack site.</p>
  </footer>
</div>`;

const css = String.raw`
:root{
  --bg:#0C0F14; --surface:#141A22; --surface-2:#1B232D; --border:#263140;
  --text:#E6EDF3; --muted:#8A97A6; --faint:#5C6875;
  --accent:#35E0C8; --accent-ink:#0C0F14; --accent-dim:rgba(53,224,200,.12);
  --sev-high:#F16571; --sev-med:#F0A93B; --sev-low:#7C8A99;
  --purple:#A279F2; --green:#4CC66A;
  --radius:10px; --maxw:1060px;
  --mono:ui-monospace,SFMono-Regular,"JetBrains Mono",Menlo,Consolas,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#EDF1F5; --surface:#FFFFFF; --surface-2:#F3F6F9; --border:#D5DDE6;
    --text:#16202B; --muted:#5A6675; --faint:#8A97A6;
    --accent:#0C9C86; --accent-ink:#FFFFFF; --accent-dim:rgba(12,156,134,.10);
    --sev-high:#D33A48; --sev-med:#B9760E; --sev-low:#6B7788;
    --purple:#7C4DD6; --green:#2E9E4C;
  }
}
:root[data-theme="dark"]{
  --bg:#0C0F14; --surface:#141A22; --surface-2:#1B232D; --border:#263140;
  --text:#E6EDF3; --muted:#8A97A6; --faint:#5C6875;
  --accent:#35E0C8; --accent-ink:#0C0F14; --accent-dim:rgba(53,224,200,.12);
  --sev-high:#F16571; --sev-med:#F0A93B; --sev-low:#7C8A99;
  --purple:#A279F2; --green:#4CC66A;
}
:root[data-theme="light"]{
  --bg:#EDF1F5; --surface:#FFFFFF; --surface-2:#F3F6F9; --border:#D5DDE6;
  --text:#16202B; --muted:#5A6675; --faint:#8A97A6;
  --accent:#0C9C86; --accent-ink:#FFFFFF; --accent-dim:rgba(12,156,134,.10);
  --sev-high:#D33A48; --sev-med:#B9760E; --sev-low:#6B7788;
  --purple:#7C4DD6; --green:#2E9E4C;
}

*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);
  line-height:1.55;-webkit-font-smoothing:antialiased;}
.page{max-width:var(--maxw);margin:0 auto;padding:clamp(20px,5vw,56px) clamp(16px,4vw,32px) 64px;}

.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);margin:0 0 14px;}
h1{font-size:clamp(30px,6vw,46px);line-height:1.02;letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance;font-weight:680;}
.lede{font-size:clamp(15px,2.2vw,18px);color:var(--muted);max-width:60ch;margin:0;}

.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:34px 0 40px;}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:16px 18px;display:flex;flex-direction:column;gap:4px;}
.tile__v{font-family:var(--mono);font-size:26px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}
.tile__u{font-size:15px;color:var(--muted);margin-left:1px;}
.tile__k{font-size:12.5px;color:var(--muted);letter-spacing:.01em;}
.tile--flag .tile__v{font-size:18px;color:var(--sev-high);}

.player{background:var(--surface);border:1px solid var(--border);border-radius:14px;
  padding:14px;margin-bottom:44px;}
#vid{width:100%;display:block;border-radius:8px;background:#000;aspect-ratio:854/480;}
.scrub{margin-top:14px;}
.scrub__track{position:relative;height:34px;background:var(--surface-2);border:1px solid var(--border);
  border-radius:8px;overflow:hidden;}
.scrub__progress{position:absolute;top:0;left:0;height:100%;width:0;background:var(--accent-dim);
  border-right:2px solid var(--accent);pointer-events:none;transition:width .08s linear;}
.seg{position:absolute;top:0;height:100%;border:none;border-right:1px solid var(--border);
  background:transparent;cursor:pointer;color:var(--muted);font-family:var(--mono);font-size:12px;
  display:flex;align-items:center;justify-content:center;transition:background .15s;}
.seg:last-child{border-right:none;}
.seg:hover{background:rgba(127,140,155,.14);color:var(--text);}
.seg--skip{color:var(--faint);background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(127,140,155,.09) 5px,rgba(127,140,155,.09) 10px);}
.seg.is-active{background:var(--accent-dim);color:var(--text);}
.seg.is-active .seg__n{color:var(--accent);}
.seg__n{font-weight:600;}
.seg:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;}
.scrub__row{display:flex;align-items:center;gap:14px;margin-top:10px;flex-wrap:wrap;}
.play{font-family:var(--mono);font-size:13px;background:var(--accent);color:var(--accent-ink);
  border:none;border-radius:7px;padding:7px 14px;cursor:pointer;font-weight:600;}
.play:hover{filter:brightness(1.06);}
.tc{font-family:var(--mono);font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;}
.scrub__hint{font-size:12.5px;color:var(--faint);margin-left:auto;}

.h2{font-size:22px;letter-spacing:-.01em;margin:0 0 18px;font-weight:640;}
.breakdown{margin-bottom:48px;}
.clips{display:flex;flex-direction:column;gap:14px;}
.clip{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  overflow:hidden;scroll-margin-top:16px;transition:border-color .2s,box-shadow .2s;}
.clip.is-active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);}
.clip__head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);
  background:var(--surface-2);font-family:var(--mono);font-size:12.5px;flex-wrap:wrap;}
.clip__num{color:var(--accent);font-weight:600;letter-spacing:.02em;}
.clip__file{color:var(--muted);}
.clip__time{color:var(--faint);font-variant-numeric:tabular-nums;}
.clip__count{margin-left:auto;color:var(--text);background:var(--surface);border:1px solid var(--border);
  padding:2px 9px;border-radius:20px;font-size:12px;}
.clip__body{display:grid;grid-template-columns:220px 1fr;gap:18px;padding:16px;}
.thumb{position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden;padding:0;
  cursor:pointer;background:#000;aspect-ratio:16/10;}
.thumb img{width:100%;height:100%;object-fit:cover;display:block;opacity:.9;transition:opacity .2s,transform .3s;}
.thumb:hover img{opacity:1;transform:scale(1.03);}
.thumb__play{position:absolute;inset:0;margin:auto;width:40px;height:40px;display:flex;align-items:center;
  justify-content:center;background:rgba(12,15,20,.55);color:#fff;border-radius:50%;font-size:15px;
  backdrop-filter:blur(2px);}
.thumb:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.thumb--skip img{opacity:.4;filter:grayscale(.5);}
.clip__summary{margin:0 0 14px;font-size:15px;color:var(--text);}
.issues{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px;}
.issue{display:flex;gap:11px;align-items:flex-start;}
.chip{font-family:var(--mono);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;
  padding:3px 8px;border-radius:5px;font-weight:600;white-space:nowrap;margin-top:1px;flex-shrink:0;}
.chip--high{color:var(--sev-high);background:color-mix(in srgb,var(--sev-high) 15%,transparent);}
.chip--medium{color:var(--sev-med);background:color-mix(in srgb,var(--sev-med) 15%,transparent);}
.chip--low{color:var(--sev-low);background:color-mix(in srgb,var(--sev-low) 15%,transparent);}
.issue__text{display:flex;flex-direction:column;gap:3px;}
.issue__obs{margin:0;font-size:14.5px;}
.issue__fix{margin:0;font-size:14px;color:var(--muted);}
.arrow{color:var(--accent);font-weight:700;margin-right:6px;}
.skipnote{margin:0;align-self:center;font-size:14px;color:var(--muted);font-style:italic;}
.clip--skip .clip__body{grid-template-columns:220px 1fr;align-items:center;}

.synth{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:clamp(20px,3vw,30px);margin-bottom:40px;}
.synth__lede{color:var(--muted);margin:0 0 22px;max-width:62ch;font-size:15px;}
.recurs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;}
.recur{display:flex;gap:13px;}
.recur__idx{font-family:var(--mono);font-size:13px;color:var(--accent);font-weight:600;padding-top:2px;}
.recur__title{font-size:15.5px;margin:0 0 6px;font-weight:620;}
.recur__body{font-size:14px;color:var(--muted);margin:0 0 9px;}
.recur__clips{font-family:var(--mono);font-size:11.5px;color:var(--faint);letter-spacing:.03em;}
.insight{display:flex;gap:14px;align-items:baseline;background:var(--surface-2);border:1px solid var(--border);
  border-left:3px solid var(--accent);border-radius:8px;padding:16px 18px;flex-wrap:wrap;}
.insight__tag{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);white-space:nowrap;}
.insight p{margin:0;font-size:15px;}
.pill{font-family:var(--mono);font-size:13px;padding:1px 8px;border-radius:20px;font-weight:600;}
.pill--purple{color:var(--purple);background:color-mix(in srgb,var(--purple) 16%,transparent);}
.pill--green{color:var(--green);background:color-mix(in srgb,var(--green) 16%,transparent);}

.foot{border-top:1px solid var(--border);padding-top:22px;color:var(--muted);font-size:14px;}
.foot p{margin:0 0 12px;max-width:74ch;}
.foot b{color:var(--text);}
.foot__meta{font-family:var(--mono);font-size:12px;color:var(--faint);}

@media (max-width:720px){
  .tiles{grid-template-columns:repeat(2,1fr);}
  .recurs{grid-template-columns:1fr;}
  .clip__body,.clip--skip .clip__body{grid-template-columns:1fr;}
  .thumb{max-width:280px;}
  .scrub__hint{display:none;}
}
@media (prefers-reduced-motion:reduce){
  *{transition:none!important;}
  .thumb:hover img{transform:none;}
}
`;

const js = String.raw`
const vid=document.getElementById('vid'),prog=document.getElementById('progress'),
  tc=document.getElementById('tc'),playBtn=document.getElementById('play'),
  segs=[...document.querySelectorAll('.seg')],cards=[...document.querySelectorAll('.clip')],
  TOTAL=20.4;
const bounds=segs.map(s=>({n:+s.dataset.n,start:+s.dataset.seek}));
function fmt(s){s=Math.max(0,s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');}
function activeN(t){let n=bounds[0].n;for(const b of bounds){if(t>=b.start-0.001)n=b.n;}return n;}
function paint(){
  const t=vid.currentTime||0;
  prog.style.width=(t/TOTAL*100)+'%';
  tc.textContent=fmt(t)+' / '+fmt(vid.duration||TOTAL);
  const n=activeN(t);
  segs.forEach(s=>s.classList.toggle('is-active',+s.dataset.n===n));
  cards.forEach(c=>c.classList.toggle('is-active',+c.dataset.n===n));
}
function seek(t){vid.currentTime=t;if(vid.paused)vid.play().catch(()=>{});}
document.querySelectorAll('[data-seek]').forEach(el=>{
  el.addEventListener('click',()=>seek(+el.dataset.seek));
});
segs.forEach(s=>s.addEventListener('click',()=>{
  const card=document.querySelector('.clip[data-n="'+s.dataset.n+'"]');
  if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
}));
vid.addEventListener('timeupdate',paint);
vid.addEventListener('loadedmetadata',paint);
vid.addEventListener('play',()=>playBtn.textContent='❚❚ Pause');
vid.addEventListener('pause',()=>playBtn.textContent='▶ Play');
playBtn.addEventListener('click',()=>{vid.paused?vid.play():vid.pause();});
paint();
`;

const doc = `<title>Intake Review — Robot Module Feedback</title><style>${css}</style>${html}<script>${js}<\/script>`;
writeFileSync(OUT, doc);
console.log('wrote', OUT, (Buffer.byteLength(doc) / 1e6).toFixed(2) + 'MB');
