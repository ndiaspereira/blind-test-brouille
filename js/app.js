// Brouillé : le blind test qui déraille. Écrans, cartes, tours de jeu.
import {AC, normalize, mixBuffers} from './audio.js';
import {TUNES, renderTune} from './music.js';
import {FX, hasSide} from './fx.js';
import {Player} from './player.js';
import {THEMES, themeTracks, tracks, playlistInfo, searchPlaylists, playlistFromLink, looksLikeLink, loadPreview} from './deezer.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
const shuffle = a => { a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d){ try{ const v = localStorage.getItem('brouille.' + k); return v === null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('brouille.' + k, JSON.stringify(v)); }catch(e){} },
};

/* ================= Accueil : le labo des pédales ================= */
const ANGLES = [-60, -20, 10, 45, 80, -35, 60, -75];
$('board').innerHTML = FX.map((f, n) => `<button class="pedal" data-id="${f.id}" aria-pressed="false" style="--c:${f.c};--t:${f.t}" aria-label="${esc(f.name)} : ${esc(f.desc)}"><span class="knobs"><i class="knob" style="--r:${ANGLES[n % 8]}deg"></i><i class="knob" style="--r:${ANGLES[(n + 3) % 8]}deg"></i></span><span class="led"></span><span class="pname">${esc(f.name)}</span><span class="foot"></span></button>`).join('');

const lab = {p: null, fx: null, idx: 0, loading: null};
const labTune = () => TUNES[lab.idx % TUNES.length];
function labMark(){ document.querySelectorAll('.pedal').forEach(el => el.setAttribute('aria-pressed', String(!!lab.fx && el.dataset.id === lab.fx.id))); }
function labPlayer(){
  if(lab.p) return Promise.resolve(lab.p);
  if(!lab.loading){
    const tn = labTune();
    lab.loading = renderTune(tn).then(buf => { lab.loading = null; if(!lab.fx || labTune() !== tn) return null; lab.p = new Player(buf, 0); return lab.p; });
  }
  return lab.loading;
}
async function labPlay(fx){
  AC(); lab.fx = fx; labMark();
  const p = await labPlayer();
  if(p && lab.fx && p === lab.p) p.setFx(lab.fx);
}
function labStop(){ lab.fx = null; if(lab.p){ lab.p.stop(); lab.p = null; } labMark(); }
$('board').addEventListener('click', e => {
  const el = e.target.closest('.pedal'); if(!el) return;
  const fx = FX.find(f => f.id === el.dataset.id);
  if(lab.fx === fx) labStop(); else labPlay(fx);
});
$('labnext').addEventListener('click', () => {
  const fx = lab.fx;
  if(lab.p){ lab.p.stop(); lab.p = null; }
  lab.idx++; $('labtune').textContent = labTune().title;
  if(fx) labPlay(fx); else renderTune(labTune());
});
/* les airs connus de la prochaine partie sont préparés pendant qu'on regarde l'accueil */
let planned = shuffle(TUNES);
const prepare = list => list.reduce((p, tn) => p.then(() => renderTune(tn)).catch(() => {}), Promise.resolve());
setTimeout(() => prepare([labTune(), planned[0]]), 300);

/* ================= Joueurs ================= */
const PCOL = [['#FFD23F', '#2A1F05'], ['#FF5FA2', '#2B0A18'], ['#1FC8B0', '#04231E'], ['#8B6CFF', '#140A2E'], ['#3FA9F5', '#04182A'], ['#A5E05A', '#15260A'], ['#FF8A65', '#2B0D04'], ['#B9F3FF', '#072530']];
let names = store.get('names', ['', '']), rounds = store.get('rounds', 3);
if(!Array.isArray(names) || !names.length || names.length > 8) names = ['', ''];
if(![3, 5, 8].includes(rounds)) rounds = 3;
function renderPlayers(){
  $('players').innerHTML = names.map((n, i) => `<li class="prow"><span class="pnum" style="--c:${PCOL[i][0]};--t:${PCOL[i][1]}">${i + 1}</span><input id="pname${i}" type="text" maxlength="16" autocomplete="off" enterkeyhint="done" placeholder="Joueur ${i + 1}" value="${esc(n)}" aria-label="Nom du joueur ${i + 1}">${names.length > 1 ? `<button class="premove" data-i="${i}" aria-label="Retirer le joueur ${i + 1}">✕</button>` : ''}</li>`).join('');
  $('addPlayer').hidden = names.length >= 8;
}
$('players').addEventListener('input', e => { const m = /^pname(\d)$/.exec(e.target.id); if(m) names[+m[1]] = e.target.value; });
$('players').addEventListener('click', e => { const b = e.target.closest('.premove'); if(!b) return; names.splice(+b.dataset.i, 1); renderPlayers(); });
$('addPlayer').addEventListener('click', () => { if(names.length >= 8) return; names.push(''); renderPlayers(); $('pname' + (names.length - 1)).focus(); });
function markRounds(){ document.querySelectorAll('[data-rounds]').forEach(x => x.setAttribute('aria-checked', String(+x.dataset.rounds === rounds))); }
document.querySelectorAll('[data-rounds]').forEach(b => b.addEventListener('click', () => { rounds = +b.dataset.rounds; markRounds(); }));
renderPlayers(); markRounds();

/* ================= La musique : thèmes Deezer, playlist, airs connus, fichiers ================= */
const SOURCES = [
  ...THEMES.map(t => ({...t, kind: 'deezer'})),
  {id: 'tunes', name: 'Airs connus', note: 'sans internet', kind: 'tunes'},
  {id: 'files', name: 'Mes MP3', kind: 'files'},
];
let custom = null;            // playlist choisie par recherche ou par lien
let src = null;               // source sélectionnée
let pool = null;              // morceaux prêts pour la partie
let srcToken = 0, fileToken = 0, searchToken = 0;
let userSongs = [];
const lists = new Map();      // listes Deezer déjà chargées (ou en cours) : {at, p}
function loadList(s){
  const hit = lists.get(s.id);
  if(hit && Date.now() - hit.at < 10 * 60e3) return hit.p;
  const p = s.playlist ? tracks(`/playlist/${s.playlist}/tracks`) : themeTracks(s);
  lists.set(s.id, {at: Date.now(), p});
  p.catch(() => { if(lists.get(s.id)?.p === p) lists.delete(s.id); });
  return p;
}

const allSources = () => custom ? [custom, ...SOURCES] : SOURCES;
function renderSources(){
  $('themes').innerHTML = allSources().map(s => `<button type="button" class="theme" role="radio" data-src="${esc(s.id)}" aria-checked="${src === s}">${esc(s.name)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</button>`).join('');
}
function info(text, cls = ''){ $('srcinfo').className = 'srcinfo ' + cls; $('srcinfo').textContent = text; }
function ready(songs){ pool = songs; $('startParty').disabled = !songs; if(mix === 'pick' && [mixA, mixB].includes('main')) mixInfo(); }
const extraits = n => `${n} extrait${n > 1 ? 's' : ''}`;

async function selectSource(s, auto = false){
  if(s.kind === 'files' && !userSongs.length){ $('files').click(); return; }
  const prev = src, token = ++srcToken;
  src = s; renderSources(); $('results').hidden = true;
  if(s !== custom && !auto) store.set('source', s.id);
  if(s.kind === 'tunes'){ ready(TUNES); info(`${TUNES.length} airs connus, joués par le synthé de l’appli. Marche sans internet.`, 'ok'); return; }
  if(s.kind === 'files'){ ready(userSongs); info(`${extraits(userSongs.length)} depuis ton téléphone. Le nom du fichier est la réponse.`, 'ok'); return; }
  ready(null); info('Chargement des morceaux…', 'wait');
  try{
    const songs = await loadList(s);
    if(token !== srcToken) return;
    if(songs.length < 4){ lists.delete(s.id); info('Pas assez d’extraits dans cette playlist. Choisis-en une autre.', 'err'); return; }
    ready(songs); info(`${extraits(songs.length)} Deezer prêts · ${s.name}`, 'ok');
  }catch(e){
    if(token !== srcToken) return;
    if(auto && prev === null){ selectSource(SOURCES.find(x => x.kind === 'tunes'), true); info('Deezer ne répond pas, on jouera avec les airs connus (sans internet).', 'err'); return; }
    info('Deezer ne répond pas. Réessaie, ou choisis « Airs connus » pour jouer sans internet.', 'err');
  }
}
$('themes').addEventListener('click', e => {
  const b = e.target.closest('.theme'); if(!b) return;
  AC();
  const s = allSources().find(x => x.id === b.dataset.src);
  if(s.kind === 'files' && (!userSongs.length || src === s)){ $('files').click(); return; } // touche encore pour changer de fichiers
  selectSource(s);
});

$('files').addEventListener('change', async e => {
  const files = [...e.target.files]; e.target.value = ''; if(!files.length) return;
  const c = AC(), token = ++fileToken; info('Lecture des fichiers…', 'wait');
  const got = [];
  for(const f of files){
    try{ got.push({title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(), buffer: normalize(await c.decodeAudioData(await f.arrayBuffer()))}); }catch(err){}
  }
  if(token !== fileToken) return;
  if(!got.length){ info('Aucun fichier n’a pu être lu. Essaie des MP3 ou des M4A.', 'err'); if(src) renderSources(); return; }
  userSongs = got;
  selectSource(SOURCES.find(x => x.kind === 'files'));
});

$('search').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('q').value.trim(); if(!text) return;
  $('q').blur();
  const box = $('results'), token = ++searchToken;
  box.hidden = true;
  if(looksLikeLink(text)){
    info('Lecture du lien…', 'wait');
    try{
      const id = await playlistFromLink(text);
      if(!id) throw new Error('lien');
      const meta = await playlistInfo(id);
      if(token !== searchToken) return;
      pickPlaylist({id, title: meta.title || 'Ta playlist'});
    }catch(err){ if(token === searchToken) info('Ce lien ne mène pas à une playlist Deezer publique.', 'err'); }
    return;
  }
  info(`Recherche de « ${text} »…`, 'wait');
  try{
    const found = (await searchPlaylists(text)).slice(0, 6);
    if(token !== searchToken) return;
    if(!found.length){ info(`Aucune playlist trouvée pour « ${text} ».`, 'err'); return; }
    box.innerHTML = found.map((p, i) => `<button type="button" class="res" data-i="${i}">${p.cover ? `<img src="${esc(p.cover)}" alt="" width="48" height="48" loading="lazy">` : '<span class="noimg"></span>'}<span><b>${esc(p.title)}</b><small>${p.n} titres${p.by ? ' · ' + esc(p.by) : ''}</small></span></button>`).join('');
    box.onclick = ev => { const b = ev.target.closest('.res'); if(b) pickPlaylist(found[+b.dataset.i]); };
    box.hidden = false;
    info('Choisis une playlist.');
  }catch(err){ if(token === searchToken) info('Deezer ne répond pas. Réessaie dans un instant.', 'err'); }
});
function pickPlaylist(p){
  custom = {id: 'pl' + p.id, playlist: p.id, name: p.title, kind: 'deezer'};
  $('q').value = '';
  selectSource(custom);
}

function initSource(){
  if(src) return;
  const s = SOURCES.find(x => x.id === store.get('source', 'top'));
  selectSource(s && s.kind !== 'files' ? s : SOURCES[0], true);
}

/* ================= Mashups : deux chansons mélangées, de deux styles ================= */
const MIX_CHOICES = [{id: 'main', name: 'Musique de la partie'}, ...THEMES.map(t => ({id: t.id, name: t.name})), {id: 'tunes', name: 'Airs connus'}];
const validMix = id => MIX_CHOICES.some(c => c.id === id);
let mix = store.get('mix', 'random'), mixA = store.get('mixA', 'rapfr'), mixB = store.get('mixB', 'disney'), mixToken = 0;
if(!['off', 'random', 'pick'].includes(mix)) mix = 'random';
if(!validMix(mixA)) mixA = 'rapfr';
if(!validMix(mixB)) mixB = 'disney';
$('mixA').innerHTML = $('mixB').innerHTML = MIX_CHOICES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

/* Un style = un nom + de quoi obtenir ses morceaux */
function styleOf(id){
  if(id === 'main') return {id, name: src ? src.name : 'Musique de la partie', songs: () => (party ? party.pool : pool) || []};
  if(id === 'tunes') return {id, name: 'Airs connus', songs: () => TUNES};
  const s = SOURCES.find(x => x.id === id);
  return {id, name: s.name, songs: () => loadList(s)};
}
async function mixInfo(){
  const el = $('mixinfo'), token = ++mixToken;
  el.className = 'srcinfo';
  if(mix === 'off'){ el.textContent = ''; return; }
  if(mix === 'random'){ el.textContent = 'Chaque mashup mélange deux thèmes Deezer tirés au sort.'; return; }
  const a = styleOf(mixA), b = styleOf(mixB);
  el.textContent = a.id === b.id ? `Deux chansons « ${a.name} » mélangées.` : `${a.name} × ${b.name}`;
  try{ await Promise.all([a.songs(), b.songs()]); if(token === mixToken) el.className = 'srcinfo ok'; }
  catch(e){ if(token === mixToken){ el.className = 'srcinfo err'; el.textContent = 'Deezer ne répond pas pour ces styles : les mashups prendront la musique de la partie.'; } }
}
function renderMix(){
  document.querySelectorAll('[data-mix]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mix === mix)));
  $('mixpick').hidden = mix !== 'pick';
  $('mixA').value = mixA; $('mixB').value = mixB;
  mixInfo();
}
document.querySelectorAll('[data-mix]').forEach(b => b.addEventListener('click', () => { mix = b.dataset.mix; store.set('mix', mix); renderMix(); }));
$('mixA').addEventListener('change', e => { mixA = e.target.value; store.set('mixA', mixA); mixInfo(); });
$('mixB').addEventListener('change', e => { mixB = e.target.value; store.set('mixB', mixB); mixInfo(); });

/* ================= Partie ================= */
const TURN_TIME = 30, CHAOS_EVERY = 3, CIRC = 351.86;
const KINDS = {
  fx: {label: 'Carte pédale', pts: 2, status: 'Une seule pédale pour ce tour'},
  chaos: {label: 'Carte chaos', pts: 3, name: 'Chaos', desc: 'Les pédales changent toutes les 3 secondes.', c: '#F7F0E3', t: '#1B1628'},
  chance: {label: 'Carte chance', pts: 1, name: 'Chance', desc: 'Quatre propositions et une pédale surprise.', c: '#FFC93C', t: '#2A1F05', status: 'Choisis parmi les 4 propositions'},
  mashup: {label: 'Carte mashup', pts: 2, name: 'Mashup', c: '#FF5FA2', t: '#1B1628', status: 'Trouve les 2 chansons'}, // 2 points par chanson
};
let party = null, turn = null, busy = false;

function show(id){ cleanStop(); ['home', 'setup', 'draw', 'game', 'end'].forEach(s => { $(s).hidden = s !== id; }); $('sheet').hidden = true; window.scrollTo(0, 0); }
const bump = el => { if(reduced) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
const chips = list => list.map(f => `<span class="chip"><i style="--c:${f.c}"></i>${esc(f.name)}</span>`).join('');
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

$('play').addEventListener('click', () => { AC(); labStop(); show('setup'); initSource(); renderMix(); });
$('setupBack').addEventListener('click', () => show('home'));
$('startParty').addEventListener('click', () => {
  if(!pool) return;
  AC();
  store.set('names', names); store.set('rounds', rounds);
  startParty(names.map((n, i) => n.trim() || `Joueur ${i + 1}`));
});
$('again').addEventListener('click', () => { AC(); startParty(party.players.map(p => p.name)); });
$('backHome').addEventListener('click', () => show('home'));
$('quit').addEventListener('click', () => { if(party) endParty(); });

/* Un extrait se charge à la demande ; on garde en mémoire seulement celui en cours et le suivant. */
function getBuffer(s){
  if(s.buffer) return Promise.resolve(s.buffer);
  if(s.melody) return renderTune(s);
  if(!s.loading) s.loading = loadPreview(s).then(b => { s.buffer = b; s.loading = null; return b; }, e => { s.loading = null; throw e; });
  return s.loading;
}
const release = s => { if(s && s.preview) s.buffer = null; };
const prefetch = () => { const up = party && party.queue[0]; if(up) getBuffer(up).catch(() => {}); };

function startParty(list){
  if(!pool || !pool.length) return;
  const tunes = pool === TUNES;
  party = {players: list.map((name, i) => ({name, score: 0, found: 0, col: PCOL[i % PCOL.length]})), rounds, total: list.length * rounds, n: 0,
    pool: pool.slice(), queue: tunes ? planned.slice() : shuffle(pool), lastSong: null, lastFx: null, bumped: null,
    mix: mix === 'off' ? null : {mode: mix, a: mixA, b: mixB}, hadMix: false, used: new Set(), next: null, nextMix: null};
  if(tunes) planned = shuffle(TUNES);
  prepareDraw();
}
/* Le morceau suivant de la pile, en sautant ceux déjà entendus dans un mashup. Pile vide : on rebat tout. */
function nextSong(){
  while(true){
    if(!party.queue.length){
      party.used.clear();
      party.queue = shuffle(party.pool);
      if(!party.queue.length) return null;
      if(party.queue.length > 1 && party.queue[0] === party.lastSong) party.queue.push(party.queue.shift());
    }
    const s = party.queue.shift();
    if(!party.used.has(keyOf(s))) return (party.lastSong = s);
  }
}
function dropSong(s){ party.pool = party.pool.filter(x => x !== s); party.queue = party.queue.filter(x => x !== s); }
const current = () => party.players[party.n % party.players.length];
const keyOf = s => s.title.toLowerCase();

/* La carte est tirée au sort dès l'écran du tirage, pour préparer le bon extrait pendant que les joueurs se passent le téléphone. */
function rollKind(){
  const r = Math.random();
  if(!party.mix) return r < .2 ? 'chance' : r < .35 ? 'chaos' : 'fx';
  if(!party.hadMix && party.n === party.total - 1) return 'mashup'; // au moins un mashup par partie
  return r < .17 ? 'chance' : r < .3 ? 'chaos' : r < .5 ? 'mashup' : 'fx';
}
function mixStyles(){
  if(party.mix.mode === 'pick') return [styleOf(party.mix.a), styleOf(party.mix.b)];
  const [a, b] = shuffle(THEMES);
  return [styleOf(a.id), styleOf(b.id)];
}
function pickFrom(list, not){
  const ok = list.filter(s => !not.has(keyOf(s))), fresh = ok.filter(s => !party.used.has(keyOf(s)));
  const from = fresh.length ? fresh : ok;
  return from[Math.random() * from.length | 0];
}
/* Un mashup : une chanson de chaque style, les deux extraits mélangés sur un seul disque */
async function planMashup(){
  let styles = mixStyles(), from;
  try{
    from = await Promise.all(styles.map(st => st.songs()));
    if(from.some(l => !l.length)) throw new Error('style vide');
  }catch(e){ styles = null; from = [party.pool, party.pool]; } // Deezer muet : on mélange deux morceaux de la partie
  const bad = new Set();
  for(let tries = 0; tries < 3; tries++){
    const a = pickFrom(from[0], bad); if(!a) break;
    const b = pickFrom(from[1], new Set([...bad, keyOf(a)])); if(!b) break;
    const got = await Promise.allSettled([getBuffer(a), getBuffer(b)]);
    if(got.every(g => g.status === 'fulfilled')){
      const raw = got.map(g => g.value);
      return {songs: [a, b], raw, styles: styles && styles.map(st => st.name), buf: await mixBuffers(raw[0], raw[1])};
    }
    got.forEach((g, i) => { const s = [a, b][i]; if(g.status === 'rejected') bad.add(keyOf(s)); else release(s); });
  }
  throw new Error('mashup impossible');
}
const mixLabel = t => t.styles && t.styles[0] !== t.styles[1] ? `${t.styles[0]} × ${t.styles[1]}` : '';

function renderScores(){
  const cur = current();
  $('scores').innerHTML = party.players.map((p, i) => `<span class="sc${p === cur ? ' now' : ''}" style="--c:${p.col[0]}"><i></i>${esc(p.name)}<b id="sc${i}">${p.score}</b></span>`).join('');
  if(party.bumped !== null){ bump($('sc' + party.bumped)); party.bumped = null; }
}
function prepareDraw(){
  if(party.n >= party.total){ endParty(); return; }
  turn = null;
  const p = current();
  show('draw');
  $('turnlbl').textContent = `Tour ${Math.floor(party.n / party.players.length) + 1} sur ${party.rounds}`;
  $('who').textContent = `À toi, ${p.name} !`;
  renderScores();
  $('deck').classList.remove('drawn'); $('deck').disabled = false;
  $('drawhint').hidden = false; $('drawhint').textContent = 'Touche le paquet pour tirer ta carte.';
  $('listen').hidden = true;
  party.next = rollKind();
  if(party.next === 'mashup'){ party.nextMix = planMashup(); party.nextMix.catch(() => {}); }
  else prefetch();
}

$('deck').addEventListener('click', async () => {
  if(busy || turn || !party) return;
  busy = true; $('deck').disabled = true; $('drawhint').textContent = 'On mélange…';
  const slow = setTimeout(() => { $('drawhint').textContent = 'Chargement de l’extrait…'; }, 700);
  try{
    AC();
    let kind = party.next || rollKind(), plan = null;
    if(kind === 'mashup'){
      try{ plan = await (party.nextMix || planMashup()); }catch(e){ kind = 'fx'; } // pas de mashup possible : carte pédale
    }
    party.next = null; party.nextMix = null;
    let songs, raw, buf = null;
    if(plan){ ({songs, raw, buf} = plan); party.hadMix = true; }
    else {
      let song = null;
      for(let tries = 0; tries < 4 && !buf && party.pool.length; tries++){
        song = nextSong(); if(!song) break;
        try{ buf = await getBuffer(song); }
        catch(e){ if(!song.melody) dropSong(song); else throw e; }
      }
      if(!buf) throw new Error('aucun extrait');
      songs = [song]; raw = [buf];
    }
    const fxs = FX.filter(f => !f.stereo || (!plan && hasSide(buf)));
    let fx = null;
    if(kind !== 'chaos'){ do { fx = fxs[Math.random() * fxs.length | 0]; } while(fxs.length > 1 && fx === party.lastFx); party.lastFx = fx; }
    songs.forEach(s => party.used.add(keyOf(s)));
    turn = {kind, song: songs[0], songs, raw, styles: plan && plan.styles, buf, fx, pool: fxs, player: current()};
    renderCard(turn);
    $('deck').classList.add('drawn'); $('drawhint').hidden = true;
    const t = turn;
    setTimeout(() => { if(turn === t && !t.started){ $('listen').hidden = false; $('listen').focus({preventScroll: true}); } }, reduced ? 0 : 650);
  } catch(e){
    $('drawhint').textContent = party.pool.length ? 'L’extrait n’a pas pu être chargé. Vérifie ta connexion et touche encore le paquet.' : 'Plus aucun extrait ne répond. Arrête la partie et choisis « Airs connus ».';
    $('deck').disabled = false;
  } finally { clearTimeout(slow); busy = false; }
});
function renderCard(t){
  const k = KINDS[t.kind], face = t.kind === 'fx' ? t.fx : k, front = $('front');
  front.className = 'face front ' + t.kind + (t.kind === 'chaos' ? ' rainbow' : t.kind === 'mashup' ? ' split' : '');
  front.style.setProperty('--c', face.c); front.style.setProperty('--t', face.t);
  const art = t.kind === 'chance' ? '<span class="qmark">?</span>'
    : t.kind === 'chaos' ? '<span class="art"><span class="led on"></span><span class="led on"></span><span class="led on"></span><span class="led on"></span></span>'
    : t.kind === 'mashup' ? '<span class="art discs"><i></i><i></i></span>'
    : '<span class="art"><span class="knobs"><i class="knob" style="--r:-45deg"></i><i class="knob" style="--r:20deg"></i><i class="knob" style="--r:65deg"></i></span><span class="led on"></span></span>';
  const desc = t.kind === 'mashup' ? (mixLabel(t) ? `${mixLabel(t)}. ` : 'Deux chansons mélangées. ') + 'Trouve les deux !' : face.desc;
  const pts = t.kind === 'mashup' ? `${k.pts} pts × 2` : plural(k.pts, 'pt');
  front.innerHTML = `<span class="top"><span>${k.label}</span><span class="ptag">${pts}</span></span>${art}<span class="name">${esc(face.name)}</span><span class="desc">${esc(desc)}</span>`;
}

$('listen').addEventListener('click', startTurn);
function startTurn(){
  const t = turn; if(!t || t.started) return; t.started = true;
  AC();
  $('hudName').textContent = t.player.name; $('score').textContent = t.player.score;
  $('clock').textContent = `${TURN_TIME} s`; $('ring').style.strokeDashoffset = '0';
  $('chain').innerHTML = ''; $('chainrow').hidden = t.kind !== 'chaos';
  $('mixrow').hidden = t.kind !== 'mashup'; $('mixnames').textContent = mixLabel(t) || '2 chansons mélangées';
  $('answers').innerHTML = ''; $('answers').hidden = t.kind !== 'chance'; $('know').hidden = t.kind === 'chance';
  if(t.kind === 'chance') renderChoices(t.song);
  show('game');
  const offset = t.kind !== 'mashup' && !t.song.melody && !t.song.preview && t.buf.duration > 40 ? t.buf.duration * (.25 + Math.random() * .35) : 0;
  const now = performance.now();
  Object.assign(t, {p: new Player(t.buf, offset), heard: [], bag: [], cur: null, start: now, last: now, nextSwap: now + CHAOS_EVERY * 1000, angle: 0, done: false});
  applyFx(t, t.kind === 'chaos' ? drawFx(t) : t.fx);
  requestAnimationFrame(tick);
  prefetch();
}
/* 4 propositions : la bonne + 3 autres titres de la même playlist (complétées par les airs connus si la liste est courte) */
function renderChoices(song){
  const key = s => s.title.toLowerCase();
  const picks = [song], seen = new Set([key(song)]);
  for(const s of shuffle(party.pool).concat(shuffle(TUNES))){ if(picks.length >= 4) break; if(!seen.has(key(s))){ seen.add(key(s)); picks.push(s); } }
  const box = $('answers');
  shuffle(picks).forEach((s, n) => {
    const b = document.createElement('button');
    b.className = 'ans'; if(s === song) b.dataset.good = '1';
    b.innerHTML = `<kbd>${'ABCD'[n]}</kbd><span><b></b>${s.artist ? '<small></small>' : ''}</span>`;
    b.querySelector('b').textContent = s.title;
    if(s.artist) b.querySelector('small').textContent = s.artist;
    b.addEventListener('click', () => answerChance(s, b));
    box.append(b);
  });
}
function setBig(fx){
  const big = $('big'), vl = $('vlabel');
  big.style.setProperty('--c', fx.c); big.style.setProperty('--t', fx.t);
  vl.style.setProperty('--c', fx.c); vl.style.setProperty('--t', fx.t);
  $('bigname').textContent = fx.name; $('bigdesc').textContent = fx.desc; $('bigled').classList.add('on');
  if(!reduced){ big.classList.remove('stomp'); void big.offsetWidth; big.classList.add('stomp'); }
}
function renderChain(r){ $('chain').innerHTML = r.heard.map(f => `<i class="mini" style="--c:${f.c}" title="${esc(f.name)}"></i>`).join(''); }
function drawFx(r){ if(!r.bag.length) r.bag = shuffle(r.pool.filter(f => f !== r.cur)); return r.bag.pop(); }
function applyFx(r, fx){
  r.cur = fx; r.p.setFx(fx);
  if(!r.heard.includes(fx)) r.heard.push(fx);
  setBig(fx); renderChain(r);
}

function tick(now){
  const r = turn; if(!r || r.done || !r.p) return;
  const el = (now - r.start) / 1000;
  if(r.kind === 'chaos'){
    if(now >= r.nextSwap){ applyFx(r, drawFx(r)); r.nextSwap = now + CHAOS_EVERY * 1000; }
    const left = Math.max(0, (r.nextSwap - now) / 1000);
    $('nextIn').textContent = `Prochaine pédale dans ${Math.ceil(left)} s`;
    $('fxbar').style.transform = `scaleX(${(left / CHAOS_EVERY).toFixed(3)})`;
  } else {
    $('nextIn').textContent = KINDS[r.kind].status;
    $('fxbar').style.transform = `scaleX(${Math.max(0, 1 - el / TURN_TIME).toFixed(3)})`;
  }
  $('clock').textContent = `${Math.max(0, Math.ceil(TURN_TIME - el))} s`;
  $('ring').style.strokeDashoffset = (CIRC * Math.min(1, el / TURN_TIME)).toFixed(1);
  $('bigled').style.setProperty('--glow', Math.min(1, r.p.level() * 4).toFixed(2));
  const dt = Math.min(.1, (now - r.last) / 1000); r.last = now;
  if(!reduced){
    const tp = (r.cur && r.cur.tp) || {};
    r.angle += (tp.variant === 'rev' ? -1 : 1) * (tp.rate || 1) * dt * 200;
    const jitter = tp.stutter ? (Math.random() - .5) * 16 : 0;
    $('vinyl').style.transform = `rotate(${(r.angle + jitter).toFixed(1)}deg)`;
  }
  if(el >= TURN_TIME){ if(r.kind === 'chance') answerChance(null, null); else reveal(true); return; }
  requestAnimationFrame(tick);
}

function stopTurn(r){ r.done = true; r.p.stop(); $('bigled').classList.remove('on'); }
function openSheet(focusEl){ $('sheet').hidden = false; focusEl.focus({preventScroll: true}); }
const lastTurn = () => party.n + 1 >= party.total;
function showSongs(r){
  const two = r.songs.length > 1;
  $('reveal').innerHTML = r.songs.map((s, i) => {
    const tag = two ? `Chanson ${i + 1}${mixLabel(r) ? ' · ' + r.styles[i] : ''}` : 'C’était';
    const cover = s.cover ? `<img class="cover" src="${esc(s.cover)}" alt="" width="64" height="64">` : '';
    const link = s.link ? `<a class="dz" href="${esc(s.link)}" target="_blank" rel="noopener">Sur Deezer</a>` : '';
    return `<div class="song">${cover}<span class="what"><span class="label">${esc(tag)}</span><b>${esc(s.title)}</b>${s.artist ? `<span class="by">${esc(s.artist)}</span>` : ''}<span class="acts"><button type="button" class="clean" data-i="${i}" aria-pressed="false">Sans pédale</button>${link}</span></span></div>`;
  }).join('');
}

/* Une fois la réponse donnée : réécouter chaque extrait d'origine, sans pédale */
let clean = null;
function cleanStop(){
  if(clean){
    const {s, g} = clean, c = AC();
    g.gain.setTargetAtTime(0, c.currentTime, .03);
    setTimeout(() => { try{ s.stop(); }catch(e){} }, 200);
    clean = null;
  }
  document.querySelectorAll('.clean').forEach(b => { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Sans pédale'; });
}
function cleanToggle(i){
  const was = clean ? clean.i : -1;
  cleanStop();
  if(was === i || !turn || !turn.raw[i]) return;
  const c = AC(), s = c.createBufferSource(), g = c.createGain();
  s.buffer = turn.raw[i]; s.loop = true; g.gain.value = .85;
  s.connect(g); g.connect(c.destination); s.start();
  clean = {s, g, i};
  const b = document.querySelector(`.clean[data-i="${i}"]`);
  b.setAttribute('aria-pressed', 'true'); b.textContent = 'Arrêter';
}
$('reveal').addEventListener('click', e => { const b = e.target.closest('.clean'); if(b) cleanToggle(+b.dataset.i); });

/* carte pédale ou chaos : le joueur répond à voix haute, les autres valident */
$('know').addEventListener('click', () => reveal(false));
function reveal(timeout){
  const r = turn; if(!r || r.done) return; stopTurn(r);
  const k = KINDS[r.kind], two = r.kind === 'mashup';
  $('verdict').className = 'verdict';
  $('verdict').textContent = timeout ? 'Temps écoulé !' : `Alors, ${r.player.name} ?`;
  showSongs(r);
  const who = party.players.length > 1 ? 'Les autres joueurs valident' : 'Sois honnête';
  $('stats').textContent = two ? `${who} · ${k.pts} points par chanson` : `${who} · ${plural(k.pts, 'point')} en jeu`;
  $('heard').innerHTML = chips(r.heard);
  $('judgeYes').textContent = `Trouvé ! +${k.pts}`;
  $('judge').hidden = two; $('judgeMix').hidden = !two; $('nextBtn').hidden = true;
  openSheet(two ? $('judgeMix').querySelector('button') : $('judgeYes'));
}
$('judgeYes').addEventListener('click', () => judge(1));
$('judgeNo').addEventListener('click', () => judge(0));
$('judgeMix').addEventListener('click', e => { const b = e.target.closest('[data-found]'); if(b) judge(+b.dataset.found); });
function judge(found){
  const r = turn; if(!r || r.judged) return; r.judged = true;
  if(found) award(r, found);
  finishTurn();
}
function award(r, found = 1){ r.player.score += KINDS[r.kind].pts * found; r.player.found += found; party.bumped = party.players.indexOf(r.player); }

/* carte chance : 4 propositions, validation automatique */
function answerChance(picked, btn){
  const r = turn; if(!r || r.done) return; stopTurn(r); r.judged = true;
  const ok = picked === r.song;
  if(ok){ award(r); $('score').textContent = r.player.score; bump($('score')); }
  document.querySelectorAll('.ans').forEach(b => { b.disabled = true; if(b.dataset.good) b.classList.add('ok'); });
  if(btn && !ok) btn.classList.add('ko');
  $('verdict').className = 'verdict ' + (ok ? 'ok' : 'ko');
  $('verdict').textContent = ok ? 'Bien joué !' : picked === null ? 'Temps écoulé !' : 'Raté !';
  showSongs(r);
  $('stats').textContent = ok ? `+1 point pour ${r.player.name}` : 'Pas de point cette fois';
  $('heard').innerHTML = chips(r.heard);
  $('judge').hidden = true; $('judgeMix').hidden = true; $('nextBtn').hidden = false;
  $('nextBtn').textContent = lastTurn() ? 'Voir le classement' : 'Joueur suivant';
  setTimeout(() => { if(turn === r) openSheet($('nextBtn')); }, ok ? 650 : 900);
}
$('nextBtn').addEventListener('click', finishTurn);
function finishTurn(){ if(!party || !turn) return; turn.songs.forEach(release); turn = null; party.n++; prepareDraw(); }

function endParty(){
  if(turn && turn.p && !turn.done) stopTurn(turn);
  if(turn) turn.songs.forEach(release);
  turn = null;
  party.queue.forEach(release);
  if(party.nextMix) party.nextMix.then(m => m.songs.forEach(release), () => {});
  party.next = party.nextMix = null;
  show('end'); prepare([planned[0]]);
  const ranked = party.players.slice().sort((a, b) => b.score - a.score || b.found - a.found);
  const top = ranked[0], tie = ranked.length > 1 && ranked[1].score === top.score && ranked[1].found === top.found;
  $('winner').textContent = ranked.length === 1 ? plural(top.score, 'point') : top.score === 0 ? 'Personne n’a marqué' : tie ? 'Égalité !' : `${top.name} gagne !`;
  let rank = 0, prev = null;
  $('podium').innerHTML = ranked.map((p, i) => {
    const key = p.score + '/' + p.found; if(key !== prev){ rank = i + 1; prev = key; }
    return `<li class="${rank === 1 ? 'first' : ''}"><span class="r" style="--c:${p.col[0]};--t:${p.col[1]}">${rank}</span><span class="n">${esc(p.name)}<small>${p.found} morceau${p.found > 1 ? 'x' : ''} trouvé${p.found > 1 ? 's' : ''}</small></span><span class="p">${p.score}</span></li>`;
  }).join('');
}

/* ================= Installation sur l'écran d'accueil ================= */
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
