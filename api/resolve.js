// Transforme un lien de partage Deezer (link.deezer.com/s/…, deezer.page.link/…) en identifiant de playlist ou de profil.
const HOSTS = /^(link\.deezer\.com|deezer\.page\.link|(www\.)?deezer\.com)$/;
const PLAYLIST = /deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/(\d+)/i;
const PROFILE = /deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?profile\/(\d+)/i;

// Le premier lien Deezer trouvé gagne (une page de profil peut aussi citer des playlists plus bas).
function found(text){
  const pl = PLAYLIST.exec(text), pr = PROFILE.exec(text);
  if(pl && (!pr || pl.index < pr.index)) return {playlist: pl[1]};
  return pr ? {profile: pr[1]} : null;
}

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
      const hit = found(cur);
      if(hit){ res.setHeader('Cache-Control', 's-maxage=86400'); res.status(200).json(hit); return; }
      const r = await fetch(cur, {redirect: 'manual', headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'}});
      const next = r.headers.get('location');
      if(next){
        cur = new URL(next, cur).href;
        const u = new URL(cur);
        if(u.protocol !== 'https:' || !HOSTS.test(u.hostname)) break; // on ne suit que les redirections vers Deezer
        continue;
      }
      const inPage = found(await r.text());
      if(inPage){ res.status(200).json(inPage); return; }
      break;
    }
    res.status(404).json({error: 'Ni playlist ni profil dans ce lien'});
  }catch(e){
    res.status(502).json({error: 'Lien illisible'});
  }
}
