const {db,privateKey}=require('./admin-index');
const {gaId:fallbackId}=require('./admin-auth');
const valid=id=>typeof id==='string'&&/^G-[A-Z0-9]{5,20}$/.test(id);
const path=()=>`profiles/${privateKey('pickatime:analytics-config:v1')}/meetings`;
async function getId(){
 const values=await db(path()),key=Object.keys(values||{}).find(k=>k.startsWith('ga_')&&valid(k.slice(3))&&values[k]===true);
 return key?key.slice(3):fallbackId();
}
async function setId(id){
 if(!valid(id))throw Error('INVALID_MEASUREMENT_ID');
 await db(path(),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({['ga_'+id]:true})});return id;
}
module.exports={getId,setId,valid};
