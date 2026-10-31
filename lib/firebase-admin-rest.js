// Server-only Firebase credentials. Never import this module into browser code.
const crypto = require('node:crypto');
const DB = 'https://pickatime-meet-default-rtdb.asia-southeast1.firebasedatabase.app';
let cached, pending;
function credentials() {
  try {
    const value = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
    if (value.project_id !== 'pickatime-meet' || !value.client_email || !value.private_key) throw Error();
    return value;
  } catch { throw Error('FIREBASE_ADMIN_CONFIG_REQUIRED'); }
}
async function token() {
  const account = credentials();
  const identity = crypto.createHash('sha256').update(account.client_email + account.private_key).digest('hex');
  if (cached?.identity === identity && cached.expires > Date.now() + 60000) return cached.value;
  if (pending?.identity === identity) return pending.promise;
  const promise = (async () => {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const payload = encode({alg:'RS256',typ:'JWT'}) + '.' + encode({
      iss:account.client_email, scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
      aud:'https://oauth2.googleapis.com/token', iat:now, exp:now+3600
    });
    const signature = crypto.sign('RSA-SHA256', Buffer.from(payload), account.private_key).toString('base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature}),
      signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) throw Error('FIREBASE_ADMIN_AUTH_FAILED');
    const result = await response.json();
    if (!result.access_token || !Number.isFinite(result.expires_in)) throw Error('FIREBASE_ADMIN_AUTH_FAILED');
    cached = {identity,value:result.access_token,expires:Date.now()+result.expires_in*1000};
    return cached.value;
  })();
  const flight = {identity,promise}; pending = flight;
  try { return await promise; } finally { if (pending === flight) pending = null; }
}
async function eraseMeeting(id, session, ownerId, secret) {
  if (!/^m_[a-f0-9]{64}$/.test(id)) throw Error('INVALID_ID');
  const key = label => 'u_'+crypto.createHmac('sha256',secret).update(label).digest('hex');
  const patch = {
    ['sessions/'+id]:null,
    ['profiles/'+key('pickatime:admin-meeting-index:v1')+'/meetings/'+id]:null,
    // Retain only a private deletion marker so old links cannot recreate the poll.
    ['profiles/'+key('pickatime:deleted-meeting:v1:'+id)+'/meetings/'+id]:true
  };
  for (const userId of new Set([ownerId,...Object.keys(session.members||{})])) {
    if (/^kakao_[0-9]+$/.test(userId)) patch['profiles/'+key('pickatime:profile:v1:'+userId.slice(6))+'/meetings/'+id] = null;
  }
  const accessToken = await token();
  const response = await fetch(DB+'/.json', {
    method:'PATCH', headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    body:JSON.stringify(patch), signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw Error('FIREBASE_ADMIN_DELETE_FAILED');
}
module.exports = {eraseMeeting};
