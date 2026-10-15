// Relais des extraits de 30 secondes : le navigateur a besoin des octets du MP3 pour y brancher les pédales.
export default async function handler(req, res){
  let url;
  try{ url = new URL(String(req.query.url || '')); }catch(e){ url = null; }
  if(!url || url.protocol !== 'https:' || !/(^|\.)dzcdn\.net$/.test(url.hostname)){
    res.status(400).json({error: 'Lien d’extrait non autorisé'});
    return;
  }
  try{
    const r = await fetch(url);
    if(!r.ok){ res.status(r.status === 403 || r.status === 404 || r.status === 410 ? 410 : 502).json({error: 'Extrait indisponible'}); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(buf);
  }catch(e){
    res.status(502).json({error: 'Extrait indisponible'});
  }
}
