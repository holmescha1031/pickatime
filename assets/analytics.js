/* Anonymous usage events. Never send names, poll ids, dates, or URL query strings. */
(()=>{
 const fields={meeting_create:['period_mode','month_count','expected_count'],meeting_join:[],meeting_list_view:[],vote_change:['input_method','selection'],vote_import:['cell_count'],vote_clear:[],vote_confirm:['confirmation_mode','cell_count'],share_open:['content_type'],share_start:['content_type','channel'],share_handoff:['content_type','channel'],share_cancel:['content_type','channel'],share_error:['content_type','channel','reason']};
 const choices={period_mode:['months','dates'],input_method:['tap','drag','long_press','keyboard'],selection:['normal','uncertain','unavailable','remove'],confirmation_mode:['first','edit'],content_type:['invitation','status','result'],channel:['kakao','native','copy'],reason:['unsupported','failed']};
 const paths={home:'/',join:'/join',vote:'/vote',rank:'/rank'};
 let enabled=false,current='home',lastPage='',pending=[];
 const origin=location.origin;
 let referrer='';try{referrer=new URL(document.referrer).origin}catch{}
 const context=()=>({page_location:origin+paths[current],page_title:'언제봐?',page_referrer:referrer});
 function send(name,params){const record={...context(),...params};if(!enabled){if(pending.length<100)pending.push([name,record]);return}window.gtag('event',name,record)}
 function event(name,params={}){
  if(!fields[name])return;const clean={};
  for(const key of fields[name]){const value=params[key];if(choices[key]?.includes(value))clean[key]=value;else if(['month_count','expected_count','cell_count'].includes(key)&&Number.isSafeInteger(value)&&value>=0&&value<=10000)clean[key]=value}
  send(name,clean);
 }
 function page(kind,key=''){
  if(!paths[kind]||lastPage===kind+':'+key)return;lastPage=kind+':'+key;current=kind;
  if(enabled)window.gtag('set',context());send('page_view',{...context(),screen_name:kind});
 }
 window.appAnalytics={event,page};
 fetch('/api/analytics-config',{credentials:'omit'}).then(r=>r.ok?r.json():null).then(config=>{
  const id=config?.measurementId;if(!/^G-[A-Z0-9]{5,20}$/.test(id||'')){pending=[];return}
  window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
  window.gtag('js',new Date());window.gtag('set',context());
  window.gtag('config',id,{...context(),send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(script);
  enabled=true;for(const [name,params]of pending)window.gtag('event',name,{...context(),...params});pending=[];
 }).catch(()=>{pending=[]});
})();

