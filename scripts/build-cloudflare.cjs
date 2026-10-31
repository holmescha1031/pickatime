// Only explicitly public files go into dist. Never publish api/, lib/, rules or secrets.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of ['index.html','admin.html','privacy-policy.html','privacy-policy-en.html','terms-of-service.html'])fs.copyFileSync(path.join(root,file),path.join(out,file));
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
fs.writeFileSync(path.join(out,'config.js'),'window.APP_CONFIG = {authServer:location.origin,publicSite:location.origin+"/",requireFirebaseAuth:true};\n');
fs.writeFileSync(path.join(out,'_headers'),`/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'
  Strict-Transport-Security: max-age=15552000
`);
console.log('Cloudflare public assets prepared.');
