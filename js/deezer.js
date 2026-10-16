// Les extraits Deezer passent par les relais de /api (voir le dossier api/)
import {AC, normalize} from './audio.js';

export const THEMES = [
  {id: 'top', name: 'Top du moment', path: '/chart/0/tracks'},
  {id: '80', name: 'Années 80', q: 'années 80'},
  {id: '2000', name: 'Années 2000', q: 'années 2000'},
  {id: 'rapfr', name: 'Rap français', q: 'rap français'},
  {id: 'varfr', name: 'Variété française', q: 'variété française'},
  {id: 'disney', name: 'Disney', q: 'disney'},
  {id: 'rock', name: 'Rock', q: 'rock classics'},
];

async function call(path, params = {}){
  const r = await fetch('/api/deezer?' + new URLSearchParams({path, ...params}));
  if(!r.ok) throw new Error('deezer ' + r.status);
  const j = await r.json();
  if(j.error) throw new Error(j.error.message || 'deezer');
  return j;
}

const song = t => ({
  id: t.id,
  title: t.title_short || t.title,
  artist: (t.artist && t.artist.name) || '',
  cover: (t.album && (t.album.cover_medium || t.album.cover)) || '',
  preview: t.preview,
  link: t.link || `https://www.deezer.com/track/${t.id}`,
  rank: t.rank || 0,          // popularité Deezer : sert aux niveaux de difficulté
});

/* Un titre par chanson (pas de doublon « version live » ou « remix »), et seulement ceux qui ont un extrait. */
function clean(list){
  const seen = new Set();
  return list.filter(t => t && t.preview && t.readable !== false).map(song).filter(s => {
    const key = s.title.toLowerCase().replace(/\s*[([].*$/, '').trim();
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export async function tracks(path){ return clean((await call(path, {limit: 150})).data || []); }

export const playlistInfo = id => call(`/playlist/${id}`);

export async function searchPlaylists(q){
  const j = await call('/search/playlist', {q, limit: 12});
  return (j.data || []).filter(p => p.nb_tracks >= 8).map(p => ({
    id: p.id, title: p.title, n: p.nb_tracks, cover: p.picture_medium || p.picture || '',
    by: (p.user && p.user.name) || '',
  }));
}

/* Recherche de morceaux pour le maître du jeu (mode manuel) */
export async function searchTracks(q){
  const j = await call('/search/track', {q, limit: 25}), seen = new Set();
  return (j.data || []).filter(t => t && t.preview && t.readable !== false && !seen.has(t.id) && seen.add(t.id)).map(song);
}

/* Un thème = la première grosse playlist trouvée pour ce mot-clé (souvent une playlist officielle Deezer). */
export async function themeTracks(th){
  if(th.path) return tracks(th.path);
  const pls = await searchPlaylists(th.q);
  const pl = pls.find(p => p.n >= 30) || pls[0];
  if(!pl) throw new Error('aucune playlist');
  return tracks(`/playlist/${pl.id}/tracks`);
}

/* Lien collé par l'utilisateur : lien complet ou lien de partage raccourci. Renvoie {playlist} ou {profile}. */
export async function readLink(text){
  const m = /deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(playlist|profile)\/(\d+)/i.exec(text);
  if(m) return {[m[1].toLowerCase()]: m[2]};
  const short = /https:\/\/(?:link\.deezer\.com|deezer\.page\.link)\/\S+/i.exec(text);
  if(!short) return null;
  const r = await fetch('/api/resolve?' + new URLSearchParams({url: short[0]}));
  const j = await r.json().catch(() => ({}));
  if(!r.ok || !(j.playlist || j.profile)) throw new Error(j.error || 'lien');
  return j;
}
export const looksLikeLink = text => /deezer\.(com|page\.link)/i.test(text);

/* « Mon Deezer » : on lit le profil public d'un joueur, sans mot de passe ni accès à son compte. */
const person = u => ({id: u.id, name: u.name || 'Profil Deezer', picture: u.picture_medium || u.picture || ''});
export async function searchUsers(q){
  return ((await call('/search/user', {q, limit: 8})).data || []).map(person);
}
export const userInfo = async id => person(await call(`/user/${id}`));

/* Ses playlists publiques, « Coups de cœur » en premier. Une playlist de moins de 4 titres ne suffit pas pour jouer. */
export async function userPlaylists(id){
  const j = await call(`/user/${id}/playlists`, {limit: 100});
  return (j.data || []).filter(p => p.nb_tracks >= 4).map(p => ({
    id: p.id, title: p.is_loved_track ? 'Coups de cœur' : p.title, n: p.nb_tracks, loved: !!p.is_loved_track,
    cover: p.picture_medium || p.picture || '',
  })).sort((a, b) => b.loved - a.loved);
}

/* Télécharge et décode un extrait. Les liens d'extraits expirent : s'il est périmé, on en redemande un neuf. */
export async function loadPreview(s){
  const get = async () => {
    const r = await fetch('/api/preview?' + new URLSearchParams({url: s.preview}));
    if(!r.ok){ const e = new Error('preview ' + r.status); e.status = r.status; throw e; }
    return r.arrayBuffer();
  };
  let data;
  try{ data = await get(); }
  catch(e){
    if(e.status !== 410 || !s.id) throw e;
    const t = await call(`/track/${s.id}`);
    if(!t.preview) throw e;
    s.preview = t.preview;
    data = await get();
  }
  const c = AC();
  const buf = await new Promise((ok, ko) => { const p = c.decodeAudioData(data, ok, ko); if(p && p.then) p.then(ok, ko); });
  return normalize(buf);
}
