// Airs du domaine public, arrangés à la volée (piano FM, nappe, basse, batterie)
/* ================= Morceaux (domaine public), arrangés à la volée ================= */
const NOTE = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
const midi = n => { const m = /^([A-G]#?)(\d)$/.exec(n); return NOTE[m[1]] + 12 * (+m[2] + 1); };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const seq = s => s.split(',').map(x => { const [n, b] = x.trim().split(/\s+/); return [n, parseFloat(b)]; });
const tune = (title, tempo, meter, pickup, style, melody, chords) => ({title, tempo, meter, pickup, style, melody: seq(melody), chords: seq(chords)});
function chord(sym){ const m = /^([A-G]#?)(m?)(7?)$/.exec(sym); const iv = [0, m[2] ? 3 : 4, 7]; if(m[3]) iv.push(10); return {root: NOTE[m[1]], iv}; }

const CLAIR = 'C4 1,C4 1,C4 1,D4 1,E4 2,D4 2,C4 1,E4 1,D4 1,D4 1,C4 4', CLAIR_CH = 'C 4,C 2,G 2,C 2,G 2,C 4';
const TWINKLE = 'C4 1,C4 1,G4 1,G4 1,A4 1,A4 1,G4 2,F4 1,F4 1,E4 1,E4 1,D4 1,D4 1,C4 2', TWINKLE_CH = 'C 4,F 2,C 2,F 2,C 2,G 2,C 2';
const ODE = 'E4 1,E4 1,F4 1,G4 1,G4 1,F4 1,E4 1,D4 1,C4 1,C4 1,D4 1,E4 1,D4 1.5,C4 .5,C4 2', ODE_CH = 'C 4,C 2,G 2,C 4,G 2,C 2';
export const TUNES = [
  tune('Frère Jacques', 116, 4, 0, 'pop',
    'C4 1,D4 1,E4 1,C4 1,C4 1,D4 1,E4 1,C4 1,E4 1,F4 1,G4 2,E4 1,F4 1,G4 2,G4 .5,A4 .5,G4 .5,F4 .5,E4 1,C4 1,G4 .5,A4 .5,G4 .5,F4 .5,E4 1,C4 1,C4 1,G3 1,C4 2,C4 1,G3 1,C4 2',
    'C 4,C 4,C 4,C 4,C 4,C 4,C 1,G 1,C 2,C 1,G 1,C 2'),
  tune('Au clair de la lune', 112, 4, 0, 'pop',
    [CLAIR, CLAIR, 'D4 1,D4 1,D4 1,D4 1,A3 2,A3 2,D4 1,C4 1,B3 1,A3 1,G3 4', CLAIR].join(','),
    [CLAIR_CH, CLAIR_CH, 'G 4,Dm 4,G 4,G 4', CLAIR_CH].join(',')),
  tune('Ah ! vous dirai-je, maman', 112, 4, 0, 'pop',
    [TWINKLE, 'G4 1,G4 1,F4 1,F4 1,E4 1,E4 1,D4 2,G4 1,G4 1,F4 1,F4 1,E4 1,E4 1,D4 2', TWINKLE].join(','),
    [TWINKLE_CH, 'C 2,F 2,C 2,G 2,C 2,F 2,C 2,G 2', TWINKLE_CH].join(',')),
  tune('L’Hymne à la joie', 120, 4, 0, 'pop',
    ['E4 1,E4 1,F4 1,G4 1,G4 1,F4 1,E4 1,D4 1,C4 1,C4 1,D4 1,E4 1,E4 1.5,D4 .5,D4 2', ODE, 'D4 1,D4 1,E4 1,C4 1,D4 1,E4 .5,F4 .5,E4 1,C4 1,D4 1,E4 .5,F4 .5,E4 1,D4 1,C4 1,D4 1,G3 2', ODE].join(','),
    ['C 4,C 2,G 2,C 4,G 4', ODE_CH, 'G 2,C 2,G 2,C 2,G 4,D7 2,G 2', ODE_CH].join(',')),
  tune('Vive le vent', 140, 4, 0, 'pop',
    'E4 1,E4 1,E4 2,E4 1,E4 1,E4 2,E4 1,G4 1,C4 1.5,D4 .5,E4 4,F4 1,F4 1,F4 1.5,F4 .5,F4 1,E4 1,E4 1,E4 .5,E4 .5,E4 1,D4 1,D4 1,E4 1,D4 2,G4 2,E4 1,E4 1,E4 2,E4 1,E4 1,E4 2,E4 1,G4 1,C4 1.5,D4 .5,E4 4,F4 1,F4 1,F4 1,F4 1,F4 1,E4 1,E4 1,E4 .5,E4 .5,G4 1,G4 1,F4 1,D4 1,C4 4',
    'C 4,C 4,C 4,C 4,F 4,C 4,D7 4,G 4,C 4,C 4,C 4,C 4,F 4,C 4,G7 4,C 4'),
  tune('Joyeux anniversaire', 100, 3, 1, 'waltz',
    'G4 .75,G4 .25,A4 1,G4 1,C5 1,B4 2,G4 .75,G4 .25,A4 1,G4 1,D5 1,C5 2,G4 .75,G4 .25,G5 1,E5 1,C5 1,B4 1,A4 1,F5 .75,F5 .25,E5 1,C5 1,D5 1,C5 2',
    'G7 1,C 3,G7 3,G7 3,C 3,C7 3,F 3,C 2,G7 1,C 2'),
  tune('Alouette', 120, 4, 0, 'pop',
    'C4 1.5,D4 .5,E4 1,E4 1,D4 .5,C4 .5,D4 .5,E4 .5,C4 1,G3 1,C4 1.5,D4 .5,E4 1,E4 1,D4 .5,C4 .5,D4 .5,E4 .5,C4 2',
    'C 4,G 2,C 2,C 4,G 2,C 2'),
  tune('La Lettre à Élise', 150, 3, 1, 'classic',
    'E5 .5,D#5 .5,E5 .5,D#5 .5,E5 .5,B4 .5,D5 .5,C5 .5,A4 1,R .5,C4 .5,E4 .5,A4 .5,B4 1,R .5,E4 .5,G#4 .5,B4 .5,C5 1,R .5,E4 .5,E5 .5,D#5 .5,E5 .5,D#5 .5,E5 .5,B4 .5,D5 .5,C5 .5,A4 1,R .5,C4 .5,E4 .5,A4 .5,B4 1,R .5,E4 .5,C5 .5,B4 .5,A4 1,R 1',
    '- 1,- 3,Am 3,E 3,Am 3,- 3,Am 3,E 3,Am 2'),
  tune('Le thème de Tetris', 144, 4, 0, 'pop',
    'E5 1,B4 .5,C5 .5,D5 1,C5 .5,B4 .5,A4 1,A4 .5,C5 .5,E5 1,D5 .5,C5 .5,B4 1.5,C5 .5,D5 1,E5 1,C5 1,A4 1,A4 1,R 1,R .5,D5 1,F5 .5,A5 1,G5 .5,F5 .5,E5 1.5,C5 .5,E5 1,D5 .5,C5 .5,B4 1,B4 .5,C5 .5,D5 1,E5 1,C5 1,A4 1,A4 1,R 1',
    'E 4,Am 4,E 4,Am 4,Dm 4,C 4,E 4,Am 4'),
];

/* ---- petit orchestre hors ligne : piano FM, nappe, basse, batterie ---- */
const SR = 44100;
function lead(oc, out, f, t, d, vol, pan){
  const car = oc.createOscillator(), mod = oc.createOscillator(), mg = oc.createGain(), g = oc.createGain();
  car.frequency.value = f; mod.frequency.value = f;
  mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * .15, t + .4);
  mod.connect(mg); mg.connect(car.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006);
  g.gain.exponentialRampToValueAtTime(vol * .08, t + d + .25); g.gain.linearRampToValueAtTime(0, t + d + .32);
  car.connect(g);
  let node = g;
  if(pan){ const p = oc.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  node.connect(out);
  car.start(t); mod.start(t); car.stop(t + d + .35); mod.stop(t + d + .35);
}
function pad(oc, out, f, t, d, pan){
  const lp = oc.createBiquadFilter(), g = oc.createGain(), p = oc.createStereoPanner(), end = t + d;
  lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = .5;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.045, t + .06);
  g.gain.setValueAtTime(.045, Math.max(t + .06, end - .08)); g.gain.linearRampToValueAtTime(0, end + .05);
  [-8, 8].forEach(dt => { const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(t); o.stop(end + .1); });
  p.pan.value = pan; lp.connect(g); g.connect(p); p.connect(out);
}
function bass(oc, out, f, t, d){
  const o = oc.createOscillator(), lp = oc.createBiquadFilter(), g = oc.createGain();
  o.type = 'sawtooth'; o.frequency.value = f;
  lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(300, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + .005); g.gain.exponentialRampToValueAtTime(.05, t + d); g.gain.linearRampToValueAtTime(0, t + d + .03);
  o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05);
}
function kick(oc, out, t, v){
  const o = oc.createOscillator(), g = oc.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + .12);
  g.gain.setValueAtTime(.9 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + .32);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + .34);
}
function snare(oc, out, nb, t, v){
  const s = oc.createBufferSource(), bp = oc.createBiquadFilter(), g = oc.createGain();
  s.buffer = nb; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = .6;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .16);
  s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * .5); s.stop(t + .18);
  const o = oc.createOscillator(), og = oc.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + .08);
  og.gain.setValueAtTime(v * .6, t); og.gain.exponentialRampToValueAtTime(.001, t + .1);
  o.connect(og); og.connect(out); o.start(t); o.stop(t + .12);
}
function hat(oc, out, nb, t, v){
  const s = oc.createBufferSource(), hp = oc.createBiquadFilter(), g = oc.createGain(), p = oc.createStereoPanner();
  s.buffer = nb; hp.type = 'highpass'; hp.frequency.value = 7500; p.pan.value = .45;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .045);
  s.connect(hp); hp.connect(g); g.connect(p); p.connect(out); s.start(t, Math.random() * .5); s.stop(t + .06);
}
function accomp(oc, out, tn, sym, t0, beats, spb){
  const {root, iv} = chord(sym);
  let b = 36 + root; if(b < 40) b += 12;
  if(tn.style === 'classic'){ [0, 7, 12].forEach((s, k) => lead(oc, out, hz(b + s), t0 + k * .5 * spb, .48 * spb, .13, -.5)); return; }
  iv.forEach((s, k) => { let n = 48 + root + s; while(n < 55) n += 12; while(n > 67) n -= 12; pad(oc, out, hz(n), t0, beats * spb, k % 2 ? .6 : -.6); });
  if(tn.meter === 3) bass(oc, out, hz(b), t0, .95 * spb);
  else for(let j = 0; j < beats; j++) bass(oc, out, hz(b + (j % 2 ? 12 : 0)), t0 + j * spb, (j % 2 ? .45 : .9) * spb);
}
const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
/* une mesure de batterie rendue une seule fois, puis bouclée sous le morceau */
const drumLoops = new Map();
function drumLoop(meter, tempo){
  const key = meter + '/' + tempo;
  if(!drumLoops.has(key)){
    const spb = 60 / tempo, oc = new OAC(2, Math.ceil(meter * spb * SR), SR), out = oc.createGain();
    out.connect(oc.destination);
    const nb = oc.createBuffer(1, SR, SR), nd = nb.getChannelData(0);
    for(let i = 0; i < SR; i++) nd[i] = Math.random() * 2 - 1;
    for(let h = 0; h < meter * 2; h++){
      const pos = h / 2, t = pos * spb;
      if(meter === 4){
        if(pos === 0 || pos === 2) kick(oc, out, t, 1);
        if(pos === 2.5) kick(oc, out, t, .55);
        if(pos === 1 || pos === 3) snare(oc, out, nb, t, .45);
        hat(oc, out, nb, t, h % 2 ? .045 : .085);
      } else {
        if(pos === 0) kick(oc, out, t, 1);
        if(pos === 1 || pos === 2) snare(oc, out, nb, t, .16);
        if(pos % 1 === 0) hat(oc, out, nb, t, .07);
      }
    }
    drumLoops.set(key, oc.startRendering());
  }
  return drumLoops.get(key);
}
const renders = new Map();
export function renderTune(tn){
  if(!renders.has(tn)) renders.set(tn, doRender(tn).catch(e => { renders.delete(tn); throw e; }));
  return renders.get(tn);
}
/* Le morceau est rendu par tranches de 6 s (en parallèle), puis recollé : le coût reste proportionnel à la durée. */
async function doRender(tn){
  const spb = 60 / tn.tempo, beats = tn.melody.reduce((a, n) => a + n[1], 0);
  const loopDur = beats * spb, loops = Math.max(1, Math.ceil(12 / loopDur)), dur = loops * loopDur, total = Math.round(dur * SR);
  const ev = [];
  for(let L = 0; L < loops; L++){
    const base = L * loopDur;
    let b = 0;
    for(const [n, d] of tn.melody){ const f = n === 'R' ? 0 : hz(midi(n)); if(f) ev.push([base + b * spb, (oc, out, t) => lead(oc, out, f, t, d * spb, .3, 0)]); b += d; }
    b = 0;
    for(const [sym, d] of tn.chords){ if(sym !== '-') ev.push([base + b * spb, (oc, out, t) => accomp(oc, out, tn, sym, t, d, spb)]); b += d; }
  }
  const SEG = 6, TAIL = 3, jobs = [];
  for(let s0 = 0; s0 < dur; s0 += SEG){
    const oc = new OAC(2, Math.ceil((SEG + TAIL) * SR), SR), out = oc.createGain();
    out.connect(oc.destination);
    ev.forEach(([t, play]) => { if(t >= s0 && t < s0 + SEG) play(oc, out, t - s0); });
    jobs.push(oc.startRendering().then(buf => [buf, Math.round(s0 * SR)]));
  }
  const L = new Float32Array(total), R = new Float32Array(total);
  for(const [buf, o] of await Promise.all(jobs)){
    const a = buf.getChannelData(0), b = buf.getChannelData(1);
    for(let i = 0; i < a.length; i++){ const j = (o + i) % total; L[j] += a[i]; R[j] += b[i]; } // la fin déborde sur le début : boucle sans couture
  }
  if(tn.style !== 'classic'){
    const dl = await drumLoop(tn.meter, tn.tempo), da = dl.getChannelData(0), db = dl.getChannelData(1);
    const bar = Math.round(tn.meter * spb * SR), start = Math.round(((((-tn.pickup) % tn.meter) + tn.meter) % tn.meter) * spb * SR);
    for(let i = 0; i < total; i++){ const k = (i + start) % bar; if(k < da.length){ L[i] += da[k]; R[i] += db[k]; } }
  }
  let peak = .001, sq = 0;
  for(let i = 0; i < total; i += 2){ peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sq += L[i] * L[i] + R[i] * R[i]; }
  const g = Math.min(.9 / peak, .13 / Math.sqrt(sq / total + 1e-9)); // même volume ressenti d'un morceau à l'autre
  for(let i = 0; i < total; i++){ L[i] *= g; R[i] *= g; }
  const out = new AudioBuffer({length: total, numberOfChannels: 2, sampleRate: SR});
  out.copyToChannel(L, 0); out.copyToChannel(R, 1);
  return out;
}

