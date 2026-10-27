// Store the public OAuth client ID within existing Firebase key validation.
// Every profile/meetings key must be URL-safe, at most 100 characters, and true.
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{10,200}\.apps\.googleusercontent\.com$/.test(id);
function encode(id){
  if(!valid(id))throw Error('INVALID_CLIENT_ID');
  const encoded=Buffer.from(id).toString('base64url'),values={};
  for(let i=0;i<encoded.length;i+=64)values['gclient_'+i/64+'_'+encoded.slice(i,i+64)]=true;
  return values;
}
function decode(values){
  const entries=Object.entries(values||{}).filter(([key,value])=>value===true&&key.startsWith('gclient_'));
  if(entries.length){
    const chunks=entries.map(([key])=>key.match(/^gclient_([0-9])_([A-Za-z0-9_-]{1,64})$/));
    if(chunks.every(Boolean)&&chunks.length<=5){
      chunks.sort((a,b)=>Number(a[1])-Number(b[1]));
      if(chunks.every((chunk,i)=>Number(chunk[1])===i)){
        const encoded=chunks.map(chunk=>chunk[2]).join(''),id=Buffer.from(encoded,'base64url').toString();
        if(valid(id)&&Buffer.from(id).toString('base64url')===encoded)return id;
      }
    }
  }
  // Continue reading previously saved IDs in the original format.
  for(const [key,value] of Object.entries(values||{})){
    if(value!==true||!key.startsWith('client_'))continue;
    const id=Buffer.from(key.slice(7),'base64url').toString();if(valid(id))return id;
  }
  return '';
}
module.exports={valid,encode,decode};
