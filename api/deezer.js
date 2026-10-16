// Relais vers l'API publique de Deezer : elle n'autorise pas les appels directs depuis un navigateur (pas d'en-têtes CORS).
// user/… : le profil public d'un joueur et ses playlists publiques (« Mon Deezer », sans mot de passe).
const ALLOWED = /^\/(chart\/0\/tracks|playlist\/\d+(\/tracks)?|search\/(playlist|track|user)|track\/\d+|user\/\d+(\/playlists)?)$/;

export default async function handler(req, res){
  const {path = '', q, limit, index} = req.query;
  if(typeof path !== 'string' || !ALLOWED.test(path)){
    res.status(400).json({error: {message: 'Chemin non autorisé'}});
    return;
  }
  const url = new URL('https://api.deezer.com' + path);
  if(q) url.searchParams.set('q', String(q).slice(0, 120));
  if(limit) url.searchParams.set('limit', String(Math.min(200, Math.max(1, parseInt(limit, 10) || 25))));
  if(index) url.searchParams.set('index', String(Math.max(0, parseInt(index, 10) || 0)));
  try{
    const r = await fetch(url, {headers: {'Accept': 'application/json'}});
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Les liens d'extraits expirent : seul le cache de Vercel garde la réponse, quelques minutes.
    res.setHeader('Cache-Control', r.ok ? 's-maxage=300' : 'no-store');
    res.status(r.ok ? 200 : 502).send(body);
  }catch(e){
    res.status(502).json({error: {message: 'Deezer ne répond pas'}});
  }
}
