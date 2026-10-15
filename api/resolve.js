// Transforme un lien de partage Deezer (link.deezer.com/s/…, deezer.page.link/…) en identifiant de playlist.
const HOSTS = /^(link\.deezer\.com|deezer\.page\.link|(www\.)?deezer\.com)$/;
const PLAYLIST = /deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/(\d+)/i;

export default async function handler(req, res){
  let url;
  try{ url = new URL(String(req.query.url || '')); }catch(e){ url = null; }
  if(!url || url.protocol !== 'https:' || !HOSTS.test(url.hostname)){
    res.status(400).json({error: 'Ce n’est pas un lien Deezer'});
    return;
  }
  try{
    let cur = url.href;
    for(let hop = 0; hop < 6; hop++){
      const m = PLAYLIST.exec(cur);
      if(m){ res.setHeader('Cache-Control', 's-maxage=86400'); res.status(200).json({playlist: m[1]}); return; }
      const r = await fetch(cur, {redirect: 'manual', headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'}});
      const next = r.headers.get('location');
      if(next){
        cur = new URL(next, cur).href;
        const u = new URL(cur);
        if(u.protocol !== 'https:' || !HOSTS.test(u.hostname)) break; // on ne suit que les redirections vers Deezer
        continue;
      }
      const found = PLAYLIST.exec(await r.text());
      if(found){ res.status(200).json({playlist: found[1]}); return; }
      break;
    }
    res.status(404).json({error: 'Pas de playlist dans ce lien'});
  }catch(e){
    res.status(502).json({error: 'Lien illisible'});
  }
}
