// One explicitly configured production origin; never trust the request Host header.
const LEGACY='https://pickatime-phi.vercel.app';
function siteOrigin(){
  const raw=process.env.SITE_ORIGIN||LEGACY;
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('INVALID_SITE_ORIGIN');
  return url.origin;
}
function origins(){return new Set([siteOrigin(),LEGACY,'https://holmescha1031.github.io']);}
module.exports={siteOrigin,origins};
