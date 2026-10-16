// Brouillé : le blind test qui déraille. Écrans, cartes, tours de jeu.
import {AC, normalize, mixBuffers} from './audio.js';
import {TUNES, renderTune} from './music.js';
import {FX, hasSide} from './fx.js';
import {Player} from './player.js';
import {THEMES, themeTracks, tracks, playlistInfo, searchPlaylists, searchTracks, readLink, looksLikeLink, loadPreview, searchUsers, userInfo, userPlaylists} from './deezer.js';

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
let custom = null;            // playlist choisie par recherche, par lien ou dans « Mon Deezer » (mine: true)
let me = store.get('deezerUser', null);   // profil Deezer relié : {id, name, picture}
if(!me || !me.id) me = null;
const mine = {lists: null, at: 0, failed: false, all: false, token: 0};   // ses playlists publiques
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

// une playlist de « Mon Deezer » s'affiche dans sa propre rangée, sauf si le profil a été changé entre-temps
const inMyRow = s => !!(s && s.mine && me && mine.lists && mine.lists.some(p => String(p.id) === s.playlist));
const allSources = () => custom && !inMyRow(custom) ? [custom, ...SOURCES] : SOURCES;
function renderSources(){
  $('themes').innerHTML = allSources().map(s => `<button type="button" class="theme" role="radio" data-src="${esc(s.id)}" aria-checked="${src === s}">${esc(s.name)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</button>`).join('');
  renderMyLists();
}
function info(text, cls = ''){ $('srcinfo').className = 'srcinfo ' + cls; $('srcinfo').textContent = text; }
function ready(songs){ pool = songs; updateStart(); levelInfo(); if(mix === 'pick' && [mixA, mixB].includes('main')) mixInfo(); }
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
      const link = await readLink(text);
      if(link && link.profile){   // le lien d'un profil : on le relie comme « Mon Deezer »
        const u = await userInfo(link.profile);
        if(token !== searchToken) return;
        $('q').value = ''; info(''); connect(u); return;
      }
      if(!link || !link.playlist) throw new Error('lien');
      const meta = await playlistInfo(link.playlist);
      if(token !== searchToken) return;
      pickPlaylist({id: link.playlist, title: meta.title || 'Ta playlist'});
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
function pickPlaylist(p, isMine = false){
  custom = {id: 'pl' + p.id, playlist: String(p.id), name: p.title, kind: 'deezer', mine: isMine};
  $('q').value = '';
  if(isMine){ store.set('source', custom.id); store.set('myList', {id: p.id, title: p.title}); }   // on la retrouve à la prochaine partie
  selectSource(custom);
}

function initSource(){
  if(src) return;
  const id = store.get('source', 'top'), saved = store.get('myList', null);
  if(me && saved && id === 'pl' + saved.id){
    custom = {id, playlist: String(saved.id), name: saved.title, kind: 'deezer', mine: true};
    selectSource(custom, true); return;
  }
  const s = SOURCES.find(x => x.id === id);
  selectSource(s && s.kind !== 'files' ? s : SOURCES[0], true);
}

/* ================= Mon Deezer : le profil public du joueur, sans mot de passe ================= */
let acctToken = 0;
function ainfo(text, cls = ''){ $('acctinfo').className = 'srcinfo ' + cls; $('acctinfo').textContent = text; }
function renderAccount(){
  const l = mine.lists;
  $('acctOpen').hidden = !!me;
  $('acctOpen').setAttribute('aria-expanded', String(!$('acctForm').hidden));
  $('me').hidden = !me;
  if(me){
    const line = mine.failed ? '<button type="button" class="linkish" data-act="retry">Réessayer</button>'
      : !l ? 'Chargement des playlists…'
      : l.length ? `${plural(l.length, 'playlist')} ${l.length > 1 ? 'publiques' : 'publique'}`
      : 'Aucune playlist publique · <button type="button" class="linkish" data-act="retry">Actualiser</button>';
    $('me').innerHTML = `${me.picture ? `<img src="${esc(me.picture)}" alt="" width="44" height="44">` : '<span class="noimg"></span>'}<span class="meid"><span class="label">Mon Deezer</span><b>${esc(me.name)}</b><small>${line}</small></span><button type="button" class="swap" data-act="change">Changer</button>`;
  }
  renderSources();   // redessine aussi la rangée de ses playlists
}
function renderMyLists(){
  const box = $('mylists'), l = mine.lists;
  box.hidden = !(me && l && l.length && gameMode === 'auto');
  if(box.hidden){ box.innerHTML = ''; return; }
  const shown = mine.all || l.length <= 8 ? l : l.slice(0, 7);
  box.innerHTML = shown.map(p => `<button type="button" class="theme" role="radio" data-pl="${p.id}" aria-checked="${src === custom && inMyRow(src) && src.playlist === String(p.id)}">${p.loved ? '<span class="heart" aria-hidden="true">♥</span>' : ''}${esc(p.title)}<small>${p.n}</small></button>`).join('')
    + (shown.length < l.length ? `<button type="button" class="theme more" data-more>+ ${l.length - shown.length} autres</button>` : '');
}
async function loadMine(force = false){
  if(!me) return;
  if(!force && mine.lists && !mine.failed && Date.now() - mine.at < 10 * 60e3){ renderAccount(); return; }
  const token = ++mine.token, who = me;
  mine.failed = false;
  if(force) mine.lists = null;
  renderAccount();
  try{
    const l = await userPlaylists(who.id);
    if(token !== mine.token || me !== who) return;
    mine.lists = l; mine.at = Date.now();
    renderAccount();
    ainfo(l.length ? '' : 'Dans Deezer, rends au moins une playlist publique (4 titres minimum), puis touche Actualiser.');
  }catch(e){
    if(token !== mine.token || me !== who) return;
    mine.failed = true; renderAccount();
    ainfo('Deezer ne répond pas, tes playlists ne sont pas chargées.', 'err');
  }
}
async function connect(u){
  me = {id: u.id, name: u.name, picture: u.picture};
  store.set('deezerUser', me);
  mine.lists = null; mine.all = false;
  $('acctForm').hidden = true; $('ausers').hidden = true; $('aq').value = ''; ainfo('');
  await loadMine(true);
  // en mode automatique, ses coups de cœur (ou sa première playlist) deviennent tout de suite la musique de la partie,
  // sauf si une de ses playlists est déjà choisie
  const l = me && me.id === u.id && mine.lists;
  if(gameMode === 'auto' && l && l.length && !(src && src.mine && l.some(p => String(p.id) === src.playlist))) pickPlaylist(l[0], true);
}
$('acctOpen').addEventListener('click', () => {
  const open = $('acctForm').hidden;
  $('acctForm').hidden = !open; renderAccount();
  if(open) $('aq').focus();
});
$('me').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b) return;
  if(b.dataset.act === 'retry'){ loadMine(true); return; }
  me = null; mine.lists = null; mine.failed = false; mine.token++; store.set('deezerUser', null);   // « Changer » : on oublie ce profil
  $('acctForm').hidden = false; ainfo(''); renderAccount(); $('aq').focus();
});
$('mylists').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.more !== undefined){ mine.all = true; renderMyLists(); return; }
  AC();
  const p = mine.lists.find(x => String(x.id) === b.dataset.pl);
  if(p) pickPlaylist(p, true);
});
$('asearch').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('aq').value.trim(); if(!text) return;
  $('aq').blur();
  const box = $('ausers'), token = ++acctToken;
  box.hidden = true;
  try{
    if(looksLikeLink(text) || /^\d{2,}$/.test(text)){   // lien du profil, ou son numéro
      ainfo('Lecture du profil…', 'wait');
      const link = /^\d+$/.test(text) ? {profile: text} : await readLink(text);
      if(token !== acctToken) return;
      if(link && link.playlist && !link.profile){ ainfo('Ce lien est celui d’une playlist. Ici, il faut le lien de ton profil (ou ton pseudo).', 'err'); return; }
      if(!link || !link.profile) throw new Error('lien');
      const u = await userInfo(link.profile);
      if(token === acctToken) connect(u);
      return;
    }
    ainfo(`Recherche de « ${text} »…`, 'wait');
    const found = await searchUsers(text);
    if(token !== acctToken) return;
    if(!found.length){ ainfo(`Aucun profil Deezer trouvé pour « ${text} ». Essaie avec le lien de ton profil.`, 'err'); return; }
    box.innerHTML = found.map((u, i) => `<button type="button" class="res user" data-i="${i}">${u.picture ? `<img src="${esc(u.picture)}" alt="" width="48" height="48" loading="lazy">` : '<span class="noimg"></span>'}<span><b>${esc(u.name)}</b><small>Profil Deezer</small></span></button>`).join('');
    box.onclick = ev => { const b = ev.target.closest('.res'); if(b) connect(found[+b.dataset.i]); };
    box.hidden = false;
    ainfo('Touche ton profil.');
  }catch(err){ if(token === acctToken) ainfo(looksLikeLink(text) || /^\d+$/.test(text) ? 'Ce lien ne mène pas à un profil Deezer.' : 'Deezer ne répond pas. Réessaie dans un instant.', 'err'); }
});

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
  return {id, name: s.name, songs: () => loadList(s).then(l => byLevel(l, party ? party.level : level))};
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

/* ================= Mode : automatique (morceaux tirés au sort) ou manuel (un maître du jeu choisit) ================= */
let gameMode = store.get('mode', 'auto');
if(!['auto', 'manual'].includes(gameMode)) gameMode = 'auto';
function updateStart(){ $('startParty').disabled = gameMode === 'auto' && !pool; }
function renderMode(){
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === gameMode)));
  document.querySelectorAll('#setup .auto').forEach(el => { el.hidden = gameMode !== 'auto'; });
  $('manualnote').hidden = gameMode !== 'manual';
  renderMyLists();
  updateStart();
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { gameMode = b.dataset.mode; store.set('mode', gameMode); renderMode(); }));

/* Niveau : les morceaux sont classés par popularité Deezer, chaque niveau garde sa tranche (du plus écouté au moins écouté) */
const LEVELS = ['', 'les plus gros tubes', 'des chansons connues', 'des chansons moins connues', 'les chansons les plus pointues'];
let level = store.get('level', 1);
if(![1, 2, 3, 4].includes(level)) level = 1;
function byLevel(songs, lv){
  if(!songs || !songs.some(s => s.rank)) return songs || [];
  const sorted = songs.slice().sort((a, b) => b.rank - a.rank), n = sorted.length;
  const size = Math.min(n, Math.max(8, Math.ceil(n / 4))), start = Math.round((n - size) * (lv - 1) / 3);
  return sorted.slice(start, start + size);
}
function levelInfo(){
  const el = $('lvlinfo');
  if(!pool){ el.className = 'srcinfo'; el.textContent = ''; return; }
  if(!pool.some(s => s.rank)){ el.className = 'srcinfo'; el.textContent = 'Le niveau ne change rien pour les airs connus et tes MP3.'; return; }
  el.className = 'srcinfo ok';
  el.textContent = `${extraits(byLevel(pool, level).length)} : ${LEVELS[level]} de « ${src.name} ».`;
}
function renderLevel(){ document.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.level === level))); levelInfo(); }
document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { level = +b.dataset.level; store.set('level', level); renderLevel(); }));

/* ================= Partie ================= */
const TURN_TIME = 30, CHAOS_EVERY = 3, CIRC = 351.86;
const KINDS = {
  fx: {label: 'Carte pédale', pts: 2, status: 'Une seule pédale pour ce tour'},
  chaos: {label: 'Carte chaos', pts: 3, name: 'Chaos', desc: 'Les pédales changent toutes les 3 secondes.', c: '#F7F0E3', t: '#1B1628'},
  chance: {label: 'Carte chance', pts: 1, name: 'Chance', desc: 'Quatre propositions et une pédale surprise.', c: '#FFC93C', t: '#2A1F05', status: 'Choisis parmi les 4 propositions'},
  mashup: {label: 'Carte mashup', pts: 2, name: 'Mashup', c: '#FF5FA2', t: '#1B1628', status: 'Trouve les 2 chansons'}, // 2 points par chanson
};
let party = null, turn = null, busy = false;

function show(id){ cleanStop(); ['home', 'setup', 'master', 'draw', 'game', 'end'].forEach(s => { $(s).hidden = s !== id; }); $('sheet').hidden = true; window.scrollTo(0, 0); }
const bump = el => { if(reduced) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
const chips = list => list.map(f => `<span class="chip"><i style="--c:${f.c}"></i>${esc(f.name)}</span>`).join('');
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

$('play').addEventListener('click', () => { AC(); labStop(); show('setup'); initSource(); renderMode(); renderLevel(); renderMix(); renderAccount(); loadMine(); });
$('setupBack').addEventListener('click', () => show('home'));
$('startParty').addEventListener('click', () => {
  if(gameMode === 'auto' && !pool) return;
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
  const manual = gameMode === 'manual';
  if(!manual && (!pool || !pool.length)) return;
  const tunes = !manual && pool === TUNES, songs = manual ? [] : byLevel(pool, level);
  party = {players: list.map((name, i) => ({name, score: 0, found: 0, col: PCOL[i % PCOL.length]})), rounds, total: list.length * rounds, n: 0,
    manual, level, plan: null, pool: songs, queue: tunes ? planned.slice() : shuffle(songs), lastSong: null, lastFx: null, bumped: null,
    mix: manual || mix === 'off' ? null : {mode: mix, a: mixA, b: mixB}, hadMix: false, used: new Set(), next: null, nextMix: null};
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
  if(party.manual && !party.plan){ showMaster(); return; }
  const p = current();
  show('draw');
  $('turnlbl').textContent = `Tour ${Math.floor(party.n / party.players.length) + 1} sur ${party.rounds}`;
  $('who').textContent = `À toi, ${p.name} !`;
  renderScores();
  $('deck').classList.remove('drawn'); $('deck').disabled = false;
  $('drawhint').hidden = false; $('drawhint').textContent = 'Touche le paquet pour tirer ta carte.';
  $('listen').hidden = true;
  if(party.manual) return;
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
    const d = party.manual ? await drawManual() : await drawAuto(), {kind, songs, buf} = d;
    const fxs = FX.filter(f => !f.stereo || (songs.length === 1 && hasSide(buf)));
    let fx = null;
    if(kind !== 'chaos'){
      if(d.chosen && fxs.includes(d.chosen)) fx = d.chosen;
      else do { fx = fxs[Math.random() * fxs.length | 0]; } while(fxs.length > 1 && fx === party.lastFx);
      party.lastFx = fx;
    }
    songs.forEach(s => party.used.add(keyOf(s)));
    turn = {kind, song: songs[0], songs, raw: d.raw, styles: d.styles, buf, fx, pool: fxs, player: current()};
    renderCard(turn);
    $('deck').classList.add('drawn'); $('drawhint').hidden = true;
    const t = turn;
    setTimeout(() => { if(turn === t && !t.started){ $('listen').hidden = false; $('listen').focus({preventScroll: true}); } }, reduced ? 0 : 650);
  } catch(e){
    if(party.manual){ party.plan = null; prepareDraw(); minfo('Un extrait ne se charge pas. Choisis un autre morceau.', 'err'); return; }
    $('drawhint').textContent = party.pool.length ? 'L’extrait n’a pas pu être chargé. Vérifie ta connexion et touche encore le paquet.' : 'Plus aucun extrait ne répond. Arrête la partie et choisis « Airs connus ».';
    $('deck').disabled = false;
  } finally { clearTimeout(slow); busy = false; }
});
/* Mode automatique : la carte tirée au sort, et un morceau de la pile (deux pour un mashup) */
async function drawAuto(){
  let kind = party.next || rollKind(), plan = null;
  if(kind === 'mashup'){
    try{ plan = await (party.nextMix || planMashup()); }catch(e){ kind = 'fx'; } // pas de mashup possible : carte pédale
  }
  party.next = null; party.nextMix = null;
  if(plan){ party.hadMix = true; return {kind, ...plan}; }
  let song = null, buf = null;
  for(let tries = 0; tries < 4 && !buf && party.pool.length; tries++){
    song = nextSong(); if(!song) break;
    try{ buf = await getBuffer(song); }
    catch(e){ if(!song.melody) dropSong(song); else throw e; }
  }
  if(!buf) throw new Error('aucun extrait');
  return {kind, songs: [song], raw: [buf], buf};
}
/* Mode manuel : le morceau (ou les deux) et la pédale choisis par le maître du jeu */
async function drawManual(){
  const pl = party.plan, two = pl.songs.length > 1;
  const raw = await Promise.all(pl.songs.map(getBuffer));
  const buf = two ? await mixBuffers(raw[0], raw[1]) : raw[0];
  party.plan = null;
  return {kind: two ? 'mashup' : pl.fx === 'chaos' ? 'chaos' : 'fx', songs: pl.songs, raw, buf, chosen: FX.find(f => f.id === pl.fx)};
}

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
  const who = party.manual ? 'Le maître du jeu valide' : party.players.length > 1 ? 'Les autres joueurs valident' : 'Sois honnête';
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
  party.next = party.nextMix = party.plan = null;
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

/* ================= Mode manuel : l'écran du maître du jeu ================= */
const master = {picks: [], slot: 0, fx: 'random', found: [], token: 0};
function minfo(text, cls = ''){ $('minfo').className = 'srcinfo ' + cls; $('minfo').textContent = text; }
function showMaster(){
  const p = current();
  show('master');
  $('mturn').textContent = `Tour ${Math.floor(party.n / party.players.length) + 1} sur ${party.rounds} · Maître du jeu`;
  $('mwho').textContent = `Un morceau pour ${p.name}`;
  $('mhide').textContent = `${p.name}, ne regarde pas l’écran !`;
  master.picks = []; master.slot = 0; master.fx = 'random'; master.token++;
  $('mq').value = ''; $('mresults').hidden = true; minfo('');
  renderPicks(); renderFxChips(); renderMasterLists();
}
/* Si un compte Deezer est relié, le maître du jeu peut piocher dans ses playlists */
function renderMasterLists(){
  const l = me && mine.lists;
  $('mlistsbox').hidden = !(l && l.length);
  if(l && l.length) $('mlists').innerHTML = l.map(p => `<button type="button" class="theme" data-pl="${p.id}">${p.loved ? '<span class="heart" aria-hidden="true">♥</span>' : ''}${esc(p.title)}</button>`).join('');
}
function showFound(found){
  master.found = found;
  $('mresults').innerHTML = found.map((s, i) => `<button type="button" class="res" data-i="${i}">${s.cover ? `<img src="${esc(s.cover)}" alt="" width="48" height="48" loading="lazy">` : '<span class="noimg"></span>'}<span><b>${esc(s.title)}</b><small>${esc(s.artist)}</small></span></button>`).join('');
  $('mresults').hidden = false;
}
$('mlists').addEventListener('click', async e => {
  const b = e.target.closest('[data-pl]'); if(!b) return;
  const p = mine.lists.find(x => String(x.id) === b.dataset.pl); if(!p) return;
  const token = ++master.token;
  minfo(`Ouverture de « ${p.title} »…`, 'wait');
  try{
    const songs = await loadList({id: 'pl' + p.id, playlist: String(p.id)});
    if(token !== master.token) return;
    const left = songs.filter(s => !master.picks.some(x => x.id === s.id));
    if(!left.length){ $('mresults').hidden = true; minfo('Aucun extrait dans cette playlist.', 'err'); return; }
    showFound(shuffle(left).slice(0, 10));
    minfo(`${master.found.length > 1 ? master.found.length + ' morceaux' : 'Un morceau'} au hasard de « ${p.title} ». Touche encore la playlist pour en voir d’autres.`);
  }catch(err){ if(token === master.token) minfo('Deezer ne répond pas. Réessaie dans un instant.', 'err'); }
});
function renderPicks(){
  const two = master.picks.length > 1;
  $('picked').innerHTML = master.picks.map((s, i) => `<div class="pick">${s.cover ? `<img class="cover" src="${esc(s.cover)}" alt="" width="52" height="52">` : '<span class="noimg"></span>'}<span><span class="label">${two ? `Chanson ${i + 1}` : 'À deviner'}</span><b>${esc(s.title)}</b><span class="by">${esc(s.artist)}</span></span><button type="button" class="premove" data-i="${i}" aria-label="Retirer ${esc(s.title)}">✕</button></div>`).join('');
  $('addSecond').hidden = master.picks.length !== 1 || master.slot === 1;
  $('mq').placeholder = master.slot === 1 ? 'La 2e chanson : titre ou artiste' : master.picks.length ? 'Changer : titre ou artiste' : 'Titre ou artiste';
  $('mready').disabled = !master.picks.length;
  $('mready').textContent = master.picks.length ? `C’est prêt, à ${current().name} !` : 'C’est prêt';
}
function renderFxChips(){
  const two = master.picks.length > 1, one = master.picks.length === 1 ? master.picks[0] : null;
  const stereo = !!(one && one.buffer && hasSide(one.buffer));   // le karaoké a besoin d'un vrai son stéréo
  const opts = [{id: 'random', name: 'Au hasard', c: 'var(--ink)', desc: 'Une pédale tirée au sort.'},
    ...FX.map(f => ({id: f.id, name: f.name, c: f.c, desc: f.desc, off: f.stereo && !stereo})),
    {id: 'chaos', name: 'Chaos', rainbow: true, desc: 'Les pédales changent toutes les 3 secondes. 3 points.', off: two}];
  if(opts.find(o => o.id === master.fx)?.off) master.fx = 'random';
  $('mfx').innerHTML = opts.map(o => `<button type="button" class="fxchip" role="radio" data-fx="${o.id}" aria-checked="${master.fx === o.id}"${o.off ? ' disabled' : ''}><i${o.rainbow ? ' class="rainbow"' : ''} style="--c:${o.c || 'transparent'}"></i>${esc(o.name)}</button>`).join('');
  $('mfxdesc').textContent = opts.find(o => o.id === master.fx).desc + (two ? ' Avec deux chansons, c’est une carte mashup : 2 points par chanson.' : '');
}
$('msearch').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('mq').value.trim(); if(!q) return;
  $('mq').blur();
  const token = ++master.token;
  minfo('Recherche…', 'wait');
  try{
    const found = (await searchTracks(q)).slice(0, 8);
    if(token !== master.token) return;
    if(!found.length){ $('mresults').hidden = true; minfo(`Aucun extrait trouvé pour « ${q} ».`, 'err'); return; }
    showFound(found);
    minfo('Touche le morceau à faire deviner.');
  }catch(err){ if(token === master.token) minfo('Deezer ne répond pas. Réessaie dans un instant.', 'err'); }
});
$('mresults').addEventListener('click', e => {
  const b = e.target.closest('.res'); if(!b) return;
  const s = master.found[+b.dataset.i];
  if(master.picks.some(x => x.id === s.id)) return;
  const at = Math.min(master.slot, master.picks.length);
  release(master.picks[at]); master.picks[at] = s; master.slot = 0;
  $('mresults').hidden = true; $('mq').value = ''; minfo('');
  renderPicks(); renderFxChips();
  AC();
  getBuffer(s).then(() => renderFxChips(), () => {   // on charge tout de suite : le tour démarrera sans attendre
    if(!master.picks.includes(s)) return;
    master.picks = master.picks.filter(x => x !== s); renderPicks(); renderFxChips();
    minfo(`L’extrait de « ${s.title} » ne se charge pas. Choisis-en un autre.`, 'err');
  });
});
$('picked').addEventListener('click', e => {
  const b = e.target.closest('.premove'); if(!b) return;
  release(master.picks.splice(+b.dataset.i, 1)[0]); master.slot = 0;
  renderPicks(); renderFxChips();
});
$('addSecond').addEventListener('click', () => { master.slot = 1; renderPicks(); $('mq').focus(); });
$('mfx').addEventListener('click', e => { const b = e.target.closest('.fxchip'); if(!b || b.disabled) return; master.fx = b.dataset.fx; renderFxChips(); });
$('mready').addEventListener('click', () => {
  if(!master.picks.length) return;
  AC();
  party.plan = {songs: master.picks.slice(), fx: master.fx};
  prepareDraw();
});
$('mquit').addEventListener('click', () => { if(party){ master.picks.forEach(release); endParty(); } });

/* ================= Installation sur l'écran d'accueil ================= */
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
