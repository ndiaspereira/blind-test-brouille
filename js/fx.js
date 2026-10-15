// Les pédales d'effet et les variantes du disque (à l'envers, 8 bits)
/* ================= Les pédales ================= */
const G = (c, v = 1) => { const n = c.createGain(); n.gain.value = v; return n; };
const F = (c, type, f, q) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; if(q !== undefined) n.Q.value = q; return n; };
const mono = (c, v = 1) => { const n = G(c, v); n.channelCount = 1; n.channelCountMode = 'explicit'; n.channelInterpretation = 'speakers'; return n; };
function shaper(c, fn){ const w = c.createWaveShaper(), n = 2048, cv = new Float32Array(n); for(let i = 0; i < n; i++) cv[i] = fn(i * 2 / (n - 1) - 1); w.curve = cv; w.oversample = '2x'; return w; }
function lfo(c, f, depth, target){ const o = c.createOscillator(), g = G(c, depth); o.frequency.value = f; o.connect(g); g.connect(target); o.start(); return o; }
function impulse(c, sec, decay){
  const len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
  for(let ch = 0; ch < 2; ch++){ const d = b.getChannelData(ch); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}
function noise(c, kind){
  const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  if(kind === 'crackle'){
    for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .012;
    for(let i = 0; i < len; i += 1 + (Math.random() * 6000 | 0)){
      const a = (Math.random() < .5 ? -1 : 1) * (.25 + Math.random() * .6);
      for(let k = 0; k < 24 && i + k < len; k++) d[i + k] += a * Math.pow(.72, k) * (k % 2 ? -1 : 1);
    }
  } else for(let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s;
}

export const FX = [
  {id:'helium', name:'Hélium', desc:'Tout va plus vite et plus aigu, voix de souris garantie.', c:'#FFD23F', t:'#2A1F05', tp:{rate:1.5}},
  {id:'geant', name:'Géant', desc:'Tout ralentit et plonge dans les graves.', c:'#3E4BD8', t:'#F7F0E3', tp:{rate:.66},
    wire(c, i, o){ const s = F(c, 'lowshelf', 220); s.gain.value = 5; i.connect(s).connect(G(c, .75)).connect(o); }},
  {id:'envers', name:'À l’envers', desc:'Le morceau est lu de la fin vers le début.', c:'#FF5FA2', t:'#2B0A18', tp:{variant:'rev'}},
  {id:'bits', name:'8 bits', desc:'Comme sur une vieille console de jeu.', c:'#A5E05A', t:'#15260A', tp:{variant:'crush'}},
  {id:'raye', name:'Disque rayé', desc:'Le disque saute et répète le même bout.', c:'#F1E3C4', t:'#2A2116', tp:{stutter:true}},
  {id:'eau', name:'Sous l’eau', desc:'Écouté la tête dans la piscine.', c:'#1FC8B0', t:'#04231E',
    wire(c, i, o, k){ const d = c.createDelay(.1); d.delayTime.value = .015; k.push(lfo(c, 1.3, .004, d.delayTime)); const lp = F(c, 'lowpass', 520, 7); k.push(lfo(c, .35, 300, lp.frequency)); i.connect(d).connect(lp).connect(G(c, .75)).connect(o); }},
  {id:'voisins', name:'Chez les voisins', desc:'La fête bat son plein de l’autre côté du mur.', c:'#8B6CFF', t:'#140A2E',
    wire(c, i, o){ const lp = F(c, 'lowpass', 280, 1.5), pk = F(c, 'peaking', 120, 1); pk.gain.value = 6; const cv = c.createConvolver(); cv.buffer = impulse(c, .9, 3); i.connect(lp).connect(pk); pk.connect(G(c, .62)).connect(o); pk.connect(cv).connect(G(c, .34)).connect(o); }},
  {id:'gramo', name:'Gramophone', desc:'Un 78 tours de 1930, craquements compris.', c:'#B5764A', t:'#1E0F05',
    wire(c, i, o, k){ const pk = F(c, 'peaking', 1500, 1); pk.gain.value = 7; i.connect(F(c, 'highpass', 480)).connect(F(c, 'lowpass', 2900)).connect(pk).connect(shaper(c, x => Math.tanh(2.4 * x))).connect(mono(c, .6)).connect(o); const n = noise(c, 'crackle'); k.push(n); n.connect(G(c, .5)).connect(o); }},
  {id:'robot', name:'Robot', desc:'Une voix métallique venue de l’espace.', c:'#C9CED6', t:'#1A1D24',
    wire(c, i, o, k){ const d = c.createDelay(.05); d.delayTime.value = 1 / 210; d.connect(G(c, .7)).connect(d); const mix = G(c, .6); i.connect(mix); i.connect(d); d.connect(mix); const ring = G(c, 0); k.push(lfo(c, 42, 1, ring.gain)); mix.connect(ring).connect(G(c, .9)).connect(o); mix.connect(G(c, .3)).connect(o); }},
  {id:'cathedrale', name:'Cathédrale', desc:'Joué tout au fond d’une immense église.', c:'#FF9F1C', t:'#2B1600',
    wire(c, i, o){ const pre = c.createDelay(.2); pre.delayTime.value = .04; const cv = c.createConvolver(); cv.buffer = impulse(c, 4, 2.3); i.connect(G(c, .4)).connect(o); i.connect(pre).connect(cv).connect(G(c, 1.5)).connect(o); }},
  {id:'echo', name:'Écho de montagne', desc:'Chaque note rebondit de gauche à droite.', c:'#3FA9F5', t:'#04182A',
    wire(c, i, o){ const dl = c.createDelay(1), dr = c.createDelay(1), pl = c.createStereoPanner(), pr = c.createStereoPanner(); dl.delayTime.value = .33; dr.delayTime.value = .33; pl.pan.value = -1; pr.pan.value = 1; i.connect(G(c, .55)).connect(o); i.connect(F(c, 'lowpass', 2400)).connect(G(c, .6)).connect(dl); dl.connect(pl).connect(o); dl.connect(G(c, .55)).connect(dr); dr.connect(pr).connect(o); dr.connect(G(c, .55)).connect(dl); }},
  {id:'jet', name:'Décollage', desc:'Le souffle d’un avion à réaction.', c:'#E8423F', t:'#2A0606',
    wire(c, i, o, k){ const d = c.createDelay(.05); d.delayTime.value = .0055; k.push(lfo(c, .25, .0045, d.delayTime)); d.connect(G(c, .8)).connect(d); i.connect(G(c, .45)).connect(o); i.connect(d); d.connect(G(c, .45)).connect(o); }},
  {id:'talkie', name:'Talkie-walkie', desc:'Grésillements et voix saturée. À vous !', c:'#2FBF71', t:'#04210F',
    wire(c, i, o, k){ i.connect(F(c, 'highpass', 600)).connect(F(c, 'lowpass', 2300)).connect(shaper(c, x => Math.tanh(7 * x))).connect(mono(c, .4)).connect(o); const n = noise(c, 'hiss'); k.push(n); const ng = G(c, 0), now = c.currentTime; ng.gain.setValueAtTime(.22, now); ng.gain.exponentialRampToValueAtTime(.015, now + .4); n.connect(F(c, 'bandpass', 2200, .8)).connect(ng).connect(o); }},
  {id:'wah', name:'Wah-wah', desc:'La pédale de guitare des années 70.', c:'#D946EF', t:'#23052A',
    wire(c, i, o, k){ const bp = F(c, 'bandpass', 1000, 4); k.push(lfo(c, 2.2, 750, bp.frequency)); i.connect(bp).connect(G(c, 3.4)).connect(o); i.connect(G(c, .2)).connect(o); }},
  {id:'k7', name:'Cassette fondue', desc:'Une K7 oubliée tout l’été sur la plage arrière.', c:'#FF8A65', t:'#2B0D04',
    wire(c, i, o, k){ const d = c.createDelay(.2); d.delayTime.value = .03; k.push(lfo(c, .55, .01, d.delayTime)); k.push(lfo(c, 7, .0006, d.delayTime)); i.connect(d).connect(F(c, 'lowpass', 3600)).connect(shaper(c, x => Math.tanh(1.7 * x))).connect(G(c, .6)).connect(o); const n = noise(c, 'hiss'); k.push(n); n.connect(F(c, 'highpass', 3500)).connect(G(c, .015)).connect(o); }},
  {id:'attente', name:'Mis en attente', desc:'La musique d’attente du service client.', c:'#6EE7C5', t:'#06261D',
    wire(c, i, o){ i.connect(F(c, 'highpass', 420, 1)).connect(F(c, 'lowpass', 3000, 1.2)).connect(shaper(c, x => Math.round(Math.tanh(1.5 * x) * 24) / 24)).connect(mono(c, .9)).connect(o); }},
  {id:'karaoke', name:'Karaoké', desc:'La mélodie principale disparaît.', c:'#B9F3FF', t:'#072530', stereo:true,
    wire(c, i, o){ const sp = c.createChannelSplitter(2), inv = G(c, -1), m = mono(c, 4); i.connect(sp); sp.connect(m, 0); sp.connect(inv, 1); inv.connect(m); m.connect(o); }},
  {id:'mega', name:'Mégaphone', desc:'Hurlé dans un porte-voix au stade.', c:'#4B4F5C', t:'#FFD23F',
    wire(c, i, o){ i.connect(F(c, 'bandpass', 1500, 1.1)).connect(shaper(c, x => Math.sign(x) * (1 - Math.exp(-6 * Math.abs(x))))).connect(F(c, 'highpass', 650)).connect(G(c, .75)).connect(o); }},
];
export const CLEAN = {id:'clean', name:'Sans pédale', desc:'Le son d’origine, pendant deux secondes.', c:'#F7F0E3', t:'#1B1628'};

/* ---- variantes du disque : à l'envers, 8 bits ---- */
const emptyLike = b => new AudioBuffer({length: b.length, numberOfChannels: b.numberOfChannels, sampleRate: b.sampleRate});
export function reverseBuf(b){
  const r = emptyLike(b);
  for(let ch = 0; ch < b.numberOfChannels; ch++){ const s = b.getChannelData(ch), d = r.getChannelData(ch), n = s.length; for(let i = 0; i < n; i++) d[i] = s[n - 1 - i]; }
  return r;
}
export function crushBuf(b){
  const r = emptyLike(b), hold = Math.max(1, Math.round(b.sampleRate / 6000));
  for(let ch = 0; ch < b.numberOfChannels; ch++){
    const s = b.getChannelData(ch), d = r.getChannelData(ch), n = s.length;
    let peak = .001; for(let i = 0; i < n; i += 7) peak = Math.max(peak, Math.abs(s[i]));
    for(let i = 0; i < n; i += hold){ const v = Math.round(s[i] / peak * 8) / 8 * peak; for(let k = 0; k < hold && i + k < n; k++) d[i + k] = v; }
  }
  return r;
}
export function hasSide(b){
  if(b._side !== undefined) return b._side;
  if(b.numberOfChannels < 2) return (b._side = false);
  const L = b.getChannelData(0), R = b.getChannelData(1); let m = 0, s = 0;
  for(let i = 0; i < L.length; i += 97){ const x = L[i], y = R[i]; m += (x + y) * (x + y); s += (x - y) * (x - y); }
  return (b._side = m > 0 && s / m > .01);
}

