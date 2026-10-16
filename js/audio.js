// Contexte audio partagé (créé au premier geste de l'utilisateur) et mise à niveau des extraits
let ctx = null;
export function AC(){
  if(!ctx){
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
  }
  if(ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/* Même volume ressenti pour tous les extraits : les pédales ont été réglées pour ce niveau. */
export function normalize(buf){
  const chans = [];
  for(let ch = 0; ch < buf.numberOfChannels; ch++) chans.push(buf.getChannelData(ch));
  let peak = .001, sq = 0, n = 0;
  for(const d of chans) for(let i = 0; i < d.length; i += 2){ const v = d[i]; if(v > peak) peak = v; else if(-v > peak) peak = -v; sq += v * v; n++; }
  const g = Math.min(.9 / peak, .13 / Math.sqrt(sq / Math.max(1, n) + 1e-9));
  for(const d of chans) for(let i = 0; i < d.length; i++) d[i] *= g;
  return buf;
}

const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

/* Mashup : les deux extraits joués ensemble, l'un un peu à gauche, l'autre un peu à droite. Le plus court tourne en boucle. */
export async function mixBuffers(a, b){
  const sr = AC().sampleRate, len = Math.ceil(Math.min(30, Math.max(a.duration, b.duration)) * sr);
  const oc = new OAC(2, len, sr);
  [[a, -.4], [b, .4]].forEach(([buf, pan]) => {
    const s = oc.createBufferSource(), p = oc.createStereoPanner();
    s.buffer = buf; s.loop = true; p.pan.value = pan;
    s.connect(p); p.connect(oc.destination); s.start(0);
  });
  return normalize(await oc.startRendering());
}
