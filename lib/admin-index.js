const crypto=require('node:crypto');
const DB='https://pickatime-meet-default-rtdb.asia-southeast1.firebasedatabase.app';
const validId=id=>typeof id==='string'&&/^m_[a-f0-9]{64}$/.test(id);
const privateKey=label=>{if(!process.env.KAKAO_CLIENT_SECRET)throw Error('CONFIG_REQUIRED');return 'u_'+crypto.createHmac('sha256',process.env.KAKAO_CLIENT_SECRET).update(label).digest('hex')};
const indexPath=()=>`profiles/${privateKey('pickatime:admin-meeting-index:v1')}/meetings`;
async function db(path,options={}){
 const response=await fetch(`${DB}/${path}.json`,{...options,signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Object.assign(Error('DATABASE_ERROR'),{status:response.status});return response.json();
}
async function registerMeeting(id){if(!validId(id))throw Error('INVALID_ID');await db(`${indexPath()}/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:'true'})}
async function meetingIds(){const index=await db(indexPath());return Object.keys(index||{}).filter(id=>validId(id)&&index[id]===true)}
async function deleted(id){return await db(`profiles/${privateKey('pickatime:deleted-meeting:v1:'+id)}/meetings/${id}`)===true}
async function mapLimit(values,limit,fn){const result=new Array(values.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{while(next<values.length){const i=next++;try{result[i]={status:'fulfilled',value:await fn(values[i],i)}}catch(reason){result[i]={status:'rejected',reason}}}}));return result}
async function personalMeetingIds(user){
 const key=privateKey('pickatime:profile:v1:'+user.id.slice(6)),list=await db(`profiles/${key}/meetings`);
 return Object.keys(list||{}).filter(id=>validId(id)&&list[id]===true);
}
async function imported(){return await db(indexPath()+'/history_imported')===true}
async function markImported(){await db(indexPath()+'/history_imported',{method:'PUT',headers:{'Content-Type':'application/json'},body:'true'})}
module.exports={privateKey,personalMeetingIds,imported,markImported,validId,db,registerMeeting,meetingIds,deleted,mapLimit};
