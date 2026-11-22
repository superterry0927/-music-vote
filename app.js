import {firebaseConfig} from './firebase-config.js';
const root=document.getElementById('app');
const search=new URLSearchParams(location.search);
const view=search.get('view')||'home';
const demoMode=search.get('demo')==='1';
const requestedStation=Number(search.get('station')||1);
const isReady=!demoMode&&Boolean(firebaseConfig.apiKey&&firebaseConfig.projectId&&firebaseConfig.authDomain&&firebaseConfig.appId);
const categories={national:'國樂',band:'管樂'};
const stationSlots=Array.from({length:12},(_,i)=>i+1);
const sample=[
 {id:'a',name:'二胡',category:'national',emoji:'🎻',votes:36,color:'#5B79D6'},
 {id:'b',name:'琵琶',category:'national',emoji:'🪕',votes:29,color:'#D87896'},
 {id:'c',name:'笛子',category:'national',emoji:'🪈',votes:18,color:'#39A58A'},
 {id:'d',name:'長笛',category:'band',emoji:'🪈',votes:31,color:'#42A6AD'},
 {id:'e',name:'單簧管',category:'band',emoji:'🎵',votes:24,color:'#6485CA'},
 {id:'f',name:'薩克斯風',category:'band',emoji:'🎷',votes:17,color:'#E0AA39'},
 {id:'g',name:'揚琴',category:'national',emoji:'🎶',votes:14,color:'#C29441'},
 {id:'h',name:'中阮',category:'national',emoji:'🎸',votes:13,color:'#8B73C9'},
 {id:'i',name:'打擊',category:'national',emoji:'🥁',votes:11,color:'#E18D58'},
 {id:'j',name:'小號',category:'band',emoji:'🎺',votes:9,color:'#D96F6C'},
 {id:'k',name:'長號',category:'band',emoji:'🎼',votes:7,color:'#9072BD'},
 {id:'l',name:'打擊樂',category:'band',emoji:'🥁',votes:6,color:'#69A96D'}
];
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(v,station)=>`?view=${encodeURIComponent(v)}${station?`&station=${station}`:''}${demoMode?'&demo=1':''}`;
const label=(cat)=>categories[cat]||'樂器';
let cloud={},me=null,settings={title:'北成國小｜樂器人氣大票選',status:'paused',hideCounts:false},instruments=[],tallies={},watchers=[];
let stationInfo=null,classes=[],selectedClass='',student=null,adminDashboard=null,stationBusy=false;
const demoVotes=new Set();
const value=(s)=>h(s);
const shell=(body,toolbar='')=>`<header class="header"><a href="${link('home')}" class="brand">🎶 <span><b>北成國小</b><small>國樂 × 管樂 · 樂器人氣大票選</small></span></a><nav>${toolbar||`<a href="${link('home')}">首頁</a><a href="${link('display')}">電視展示</a><a href="${link('admin')}">教師後台</a>`}</nav></header>${!isReady?'<div class="demo-alert">⚠ '+(demoMode?'操作預覽模式':'尚未連接 Firebase')+'：僅為畫面體驗，不能儲存、跨裝置同步或進行正式投票。</div>':''}<main>${body}</main>`;
const statusText=status=>({open:'投票進行中',paused:'投票暫停中',closed:'投票已結束'})[status]||'尚未啟用';
function mainHome(){
  root.innerHTML=shell(`<section class="hero"><div class="eyebrow">🎼 BEICHENG MUSIC FESTIVAL</div><h1>找出你的<br><span>最愛樂器！</span></h1><p>十二個 iPad 投票站 · 國樂管樂各一票 · 投票結果即時公布</p><span class="chip ${settings.status==='open'?'ok':''}">● ${statusText(settings.status)}</span></section>
  <section class="block"><div class="sectionHead"><h2>🎻 選擇投票站</h2><p>每個 iPad 只要設定一次站號，現場就不需要重新選樂器</p></div><div class="station-grid">${stationSlots.map(n=>`<a class="station-tile" href="${link('station',n)}"><div class="bigicon">${sample[n-1]?.emoji||'🎵'}</div><strong>第 ${n} 站</strong><span>開啟 iPad 投票頁面</span></a>`).join('')}</div></section>
  <section class="tools"><a href="${link('display')}" class="tool-card"><b>📺 大電視排行榜</b><span>票數比例、國樂與管樂排行</span></a><a href="${link('admin')}" class="tool-card"><b>🔐 教師管理後台</b><span>名冊匯入、樂器增刪、班級投票率</span></a></section>
  <p class="fine">投票採班級＋座號選擇，需有現場工作人員監督以避免代投。${!demoMode?`<br><a href="?view=home&demo=1">不登入也能體驗操作預覽（不計票）</a>`:''}</p>`);
}
function renderDemoDisplay(){return drawDisplay(sample,true)}
function drawDisplay(items,demo=false){
  const total=items.reduce((s,x)=>s+x.votes,0);
  const panel=cat=>{
    const data=items.filter(i=>i.category===cat&&(i.active!==false||i.votes>0)).sort((a,b)=>b.votes-a.votes),sum=data.reduce((s,i)=>s+i.votes,0);
    return `<section class="score-group"><div class="score-title"><h2>${cat==='national'?'🎻':'🎺'} ${label(cat)}人氣榜</h2><span>${settings.hideCounts&&!demo?'票數暫不公開':`已投 ${sum} 票`}</span></div>${data.map((it,i)=>{const ratio=sum?Math.round(1000*it.votes/sum)/10:0;return `<div class="score-line"><div class="score-row"><b><span class="medal">${i+1}</span> ${value(it.emoji)} ${value(it.name)}</b><span>${settings.hideCounts&&!demo?'等待揭曉':`${it.votes} 票 · ${ratio}%`}</span></div><div class="track"><div class="fill" style="width:${settings.hideCounts&&!demo?0:ratio}%;background:${/^#[0-9a-fA-F]{6}$/.test(it.color)?it.color:'#8797c8'}"></div></div></div>`}).join('')||'<p>目前還沒有樂器項目。</p>'}</section>`;
  };
  root.innerHTML=shell(`<div class="display-top"><div><div class="eyebrow">🏆 LIVE MUSIC VOTE</div><h1>${value(settings.title)}</h1><p>全校樂器人氣排行榜${demo?' · 範例數據':''}</p></div><div class="display-total"><span>有效投票總數</span><strong>${demo?total:(settings.hideCounts?'—':total)}</strong></div></div>
    <div class="score-grid">${panel('national')}${panel('band')}</div><div class="display-footer"><span>📊 ${statusText(settings.status)}</span><button class="button ghost" id="fullscreen">⛶ 電視全螢幕</button></div>`);
  document.getElementById('fullscreen')?.addEventListener('click',()=>document.documentElement.requestFullscreen?.());
}
async function initCloud(){
  if(!isReady)return false;
  try{
    const {createSparkBackend}=await import('./spark-backend.js');
    cloud=createSparkBackend();
    return true;
  }catch(e){
    console.error('Firebase Spark 初始化失敗',e);
    root.innerHTML=shell(`<div class="message error">Firebase 無法載入：${h(e.message)}。請檢查網路與資料庫設定。</div>`);
    return false;
  }
}
async function callable(name,data={}) {
  if(!isReady) {
    if(name==='getStationProfile') {const inst=sample[requestedStation-1];return {stationId:String(requestedStation),instrumentId:inst?.id||null,instrument:inst||null};}
    if(name==='getClasses')return {classes:['101','102','201','202'].map(code=>({code,seats:Array.from({length:30},(_,i)=>i+1)}))};
    if(name==='getStudent')return {id:`${data.classCode}_${data.seat}`,classCode:data.classCode,seat:data.seat,name:`測試學生 ${data.classCode}-${String(data.seat).padStart(2,'0')}`};
    if(name==='castVote') {const inst=sample[requestedStation-1],k=`${data.classCode}_${data.seat}_${inst.category}`;if(demoVotes.has(k))throw Error('這位測試學生已在本類別投過票（僅限本頁預覽）');demoVotes.add(k);inst.votes++;return {ok:true,instrument:inst.name};}
    throw Error('Firebase 尚未連接：此功能需要登入管理員帳號。');
  }
  return cloud.call(name,data);
}
function cloudReadError(area,e){
  console.error(`Firebase ${area}讀取失敗`,e);
  if(view==='display'||view==='home')root.innerHTML=shell(`<div class="message error">無法讀取 ${h(area)}：${h(e.message)}。請確認 Firestore 已建立、Rules 已發布，並已允許讀取公開統計資料。本頁不是正式投票結果。</div>`);
}
function watchResults(){
  watchers.forEach(u=>u());watchers=[];
  const {db,doc,collection,onSnapshot}=cloud;
  watchers.push(onSnapshot(doc(db,'settings','public'),s=>{if(s.exists()){settings=s.data();if(view==='display')drawDisplay(makeItems());if(view==='home')mainHome();}},e=>cloudReadError('活動設定',e)));
  watchers.push(onSnapshot(collection(db,'instruments'),s=>{instruments=s.docs.map(d=>({id:d.id,...d.data()}));subscribeTallies();},e=>cloudReadError('樂器資料',e)));
}
function subscribeTallies(){
  watchers.splice(2).forEach(u=>u());
  tallies={};
  for(const it of instruments){
    const u=cloud.onSnapshot(cloud.collection(cloud.db,'tallies',it.id,'shards'),snap=>{
      tallies[it.id]=snap.docs.reduce((n,d)=>n+Number(d.data().count||0),0);
      if(view==='display')drawDisplay(makeItems());
    },e=>cloudReadError('票數資料',e));
    watchers.push(u);
  }
  if(view==='display')drawDisplay(makeItems());
}
const makeItems=()=>instruments.map(it=>({...it,votes:tallies[it.id]||0}));
function loginPage(kind,message=''){
  root.innerHTML=shell(`<section class="auth-card"><div class="auth-badge">${kind==='admin'?'🔐':'🎻'}</div><h1>${kind==='admin'?'教師管理登入':'投票站工作人員登入'}</h1><p>${kind==='admin'?'請使用 Firebase 管理員帳號':'每台 iPad 使用指定的 Firebase 投票站帳號'}</p>${message?`<div class="message error">${h(message)}</div>`:''}
  <form id="loginForm"><label>帳號 Email<input id="email" type="email" autocomplete="username" required placeholder="staff@example.edu.tw"></label><label>密碼<input id="password" type="password" autocomplete="current-password" required></label><button class="button primary" type="submit">登入系統</button></form><p class="fine">帳號密碼不儲存在網頁原始碼；學校管理員於 Firebase Authentication 建立帳號並授權站點。</p></section>`);
  document.getElementById('loginForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;b.textContent='驗證中…';
    try {await cloud.signInWithEmailAndPassword(cloud.auth,document.getElementById('email').value,document.getElementById('password').value);await renderProtected()}
    catch(err){loginPage(kind,err.code==='auth/invalid-credential'?'帳號或密碼不正確':err.message)}
  });
}
function notice(kind,msg){const el=document.getElementById('notice');if(el){el.className='message '+kind;el.textContent=msg;}}
async function renderProtected(){
  if(!isReady){if(view==='station')return await stationStart();root.innerHTML=shell('<div class="message error">教師管理後台需要先連接 Firebase 並登入授權帳號。請參考 README 完成設定。</div>');return;}
  if(!cloud.auth.currentUser){loginPage(view==='admin'?'admin':'station');return;}
  if(view==='station')return await stationStart();
  if(view==='admin')return await adminStart();
}
async function stationStart(){
  try{
    stationInfo=await callable('getStationProfile');
    if(Number(stationInfo.stationId)!==requestedStation){root.innerHTML=shell(`<section class="auth-card"><h2>帳號不屬於第 ${requestedStation} 站</h2><p>此帳號綁定第 ${stationInfo.stationId} 站，請使用正確的投票站登入。</p><button id="logout" class="button ghost">登出</button></section>`);document.getElementById('logout').onclick=logout;return;}
    const c=await callable('getClasses');classes=c.classes;selectedClass='';student=null;stationChooseClass();
  }catch(e){root.innerHTML=shell(`<section class="auth-card"><h2>無法使用此站</h2><div class="message error">${h(e.message)}</div><button id="logout" class="button ghost">登出</button></section>`);document.getElementById('logout').onclick=logout;}
}
function stationLayout(content){
  root.innerHTML=shell(`<section class="station-head"><div><span class="eyebrow">第 ${stationInfo.stationId} 站 ・ ${label(stationInfo.instrument?.category)}</span><h1>${h(stationInfo.instrument?.emoji||'🎵')} 投給 ${h(stationInfo.instrument?.name||'未指定樂器')}</h1><p>每位同學每類樂器只能投一票</p></div><button id="stationLogout" class="button ghost small">工作人員登出</button></section><div id="notice"></div><section class="student-panel">${content}</section>`);
  // Enter distraction-free student voting mode on iPad (Safari or Home Screen web app).
  document.body.classList.add('station-kiosk');
  document.body.dataset.stationStep='class';
  document.getElementById('stationLogout').onclick=logout;
}
function stationChooseClass(){
  window.scrollTo(0,0);
  stationLayout(`<div class="step">STEP 1 ／ 2</div><h2>請選擇班級</h2><div class="choice-grid">${classes.map(c=>`<button class="choice" data-class="${h(c.code)}">${h(c.code)} 班</button>`).join('')}</div><p class="fine">由工作人員協助核對學生班級及座號。</p>`);
  document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{selectedClass=b.dataset.class;stationChooseSeat()});
}
function stationChooseSeat(){
  const cls=classes.find(c=>c.code===selectedClass);
  stationLayout(`<div class="step">STEP 2 ／ 2</div><h2>${h(selectedClass)} 班 · 請選擇座號</h2><button id="goBack" class="button ghost">← 返回班級</button><div class="choice-grid seat-grid">${(cls?.seats||[]).map(n=>`<button class="choice seat" data-seat="${n}">${n}</button>`).join('')}</div>`);
  document.body.dataset.stationStep='seat';
  document.getElementById('goBack').onclick=stationChooseClass;
  document.querySelectorAll('[data-seat]').forEach(b=>b.onclick=async()=>{
    if(stationBusy)return;stationBusy=true;document.querySelectorAll('[data-seat]').forEach(x=>x.disabled=true);
    try{student=await callable('getStudent',{classCode:selectedClass,seat:Number(b.dataset.seat)});stationConfirm();}
    catch(e){notice('error',e.message);document.querySelectorAll('[data-seat]').forEach(x=>x.disabled=false)}
    finally{stationBusy=false;}
  });
}
function stationConfirm(){
  stationLayout(`<div class="step">確認投票</div><h2>請確認你的資料</h2><div class="identity"><div class="identity-class">${h(student.classCode)} 班 ・ ${student.seat} 號</div><div class="identity-name">${h(student.name)}</div></div>
  <div class="confirm-target">確定要投票給 <strong>${h(stationInfo.instrument.emoji)} ${h(stationInfo.instrument.name)}</strong> 嗎？</div>
  <div class="actions"><button class="button ghost" id="cancel">返回修改</button><button class="button primary" id="confirm">✓ 確認投票</button></div>`);
  document.body.dataset.stationStep='confirm';
  document.getElementById('cancel').onclick=stationChooseSeat;
  document.getElementById('confirm').onclick=async()=>{
    if(stationBusy)return;stationBusy=true;document.getElementById('confirm').disabled=true;
    try{const r=await callable('castVote',{classCode:student.classCode,seat:student.seat});stationResult(true,`${student.name}，投給「${r.instrument}」成功！`)}
    catch(e){
      const permissionDenied=e.code==='permission-denied'||e.code==='firestore/permission-denied';
      const msg=permissionDenied
        ?`這張票未寫入：可能已投過${label(stationInfo.instrument.category)}，或站點／資料庫規則尚未授權。請工作人員確認，勿重複連點。`
        :(e.code==='vote/already-exists'?`此同學的${label(stationInfo.instrument.category)}已投過票！`:e.message);
      stationResult(false,msg);
    }
    finally{stationBusy=false;}
  };
}
function stationResult(ok,message){stationLayout(`<div class="vote-result ${ok?'success':'failure'}"><div class="result-icon">${ok?'🎉':'⚠️'}</div><h1>${ok?'投票成功！':'尚未完成投票'}</h1><p>${h(message)}</p><button id="next" class="button ${ok?'primary':'ghost'}">下一位同學</button><small>將自動返回班級選擇畫面</small></div>`);
  document.body.dataset.stationStep='result';
  document.getElementById('next').onclick=stationChooseClass;student=null;selectedClass='';setTimeout(()=>{if(view==='station'&&document.getElementById('next'))stationChooseClass()},ok?1700:3000);
}
async function logout(){
  document.body.classList.remove('station-kiosk');
  delete document.body.dataset.stationStep;
  await cloud.signOut(cloud.auth);
  loginPage(view==='admin'?'admin':'station');
}

function csvDownload(name,rows){if(!rows.length){alert('沒有可匯出的資料');return;}
 const esc=v=>{let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
 const csv='\ufeff'+[Object.keys(rows[0]).map(esc).join(','),...rows.map(r=>Object.values(r).map(esc).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function adminStart(){
  try{adminDashboard=await callable('adminAction',{op:'dashboard'});if(!adminDashboard.settings){initAdminScreen();return;}adminScreen();}
  catch(e){root.innerHTML=shell(`<section class="auth-card"><h2>沒有管理權限</h2><div class="message error">${h(e.message)}</div><button id="logout" class="button ghost">登出</button></section>`);document.getElementById('logout').onclick=logout;}
}
const opt=(items,current)=>items.map(x=>`<option value="${h(x.id)}" ${String(x.id)===String(current)?'selected':''}>${h(x.label)}</option>`).join('');

function initAdminScreen(){
  root.innerHTML=shell(`<section class="auth-card"><h1>🎼 初始化北成樂器投票</h1><p>目前還沒有活動資料。請先建立十二個樂器、十二站及 120 位假學生資料。正式學生名冊須等測試完成再匯入。</p><button id="bootstrap" class="button primary">建立測試活動</button><div id="bootstrapNote"></div><button id="logout" class="button ghost">登出</button></section>`);
  document.getElementById('logout').onclick=logout;
  document.getElementById('bootstrap').onclick=async()=>{try{document.getElementById('bootstrap').disabled=true;await callable('adminAction',{op:'bootstrap'});await adminStart()}catch(e){document.getElementById('bootstrapNote').innerHTML=`<div class="message error">${h(e.message)}</div>`;document.getElementById('bootstrap').disabled=false}};
}

function adminScreen(){
 const d=adminDashboard,items=d.instruments.sort((a,b)=>(a.order||0)-(b.order||0)),active=items.filter(i=>i.active);
 const missingStations=stationSlots.filter(n=>!d.stations.some(s=>s.id===String(n)));
 const settings=d.settings||settings;
 const controls=`<div class="admin-actions"><button class="button ghost" id="refreshAdmin">⟳ 重新整理</button><button class="button ghost" id="logout">登出</button></div>`;
 root.innerHTML=shell(`<div class="admin-top"><div><div class="eyebrow">🔐 教師管理</div><h1>樂器投票管理中心</h1><p>Firebase Spark 免費版 · 班級投票率 · 國樂管樂分別計票</p></div>${controls}</div><div id="adminMessage"></div>
 <div class="mini-metrics"><div><span>學生總數</span><strong>${d.studentCount}</strong></div><div><span>有效選票</span><strong>${d.voteCount}</strong></div><div><span>國樂項目</span><strong>${active.filter(x=>x.category==='national').length}</strong></div><div><span>管樂項目</span><strong>${active.filter(x=>x.category==='band').length}</strong></div></div>
 <section class="admin-panel"><h2>⚙ 活動設定</h2><div class="inline-fields"><label>活動名稱<input id="eventTitle" maxlength="80" value="${h(settings.title||'')}"></label><label>活動狀態<select id="eventStatus">${opt([{id:'open',label:'開放投票'},{id:'paused',label:'暫停投票'},{id:'closed',label:'結束投票'}],settings.status)}</select></label><label class="checkline"><input id="hideCounts" type="checkbox" ${settings.hideCounts?'checked':''}>電視暫時隱藏票數</label></div><button id="saveSettings" class="button primary">儲存活動設定</button></section>
 <section class="admin-panel"><h2>📱 十二台 iPad 站點設定</h2>${missingStations.length?`<div class="message">還缺少 ${missingStations.length} 個站點。按下補齊按鈕只會建立缺少的站點，不影響既有站點、學生及票數。<p><button class="button primary" id="createMissingStations">補齊 12 個站點</button></p></div>`:''}<div class="settings-grid">${stationSlots.map(n=>{const st=d.stations.find(s=>s.id===String(n));return `<div class="setting-item"><b>第 ${n} 站</b><select data-station="${n}">${opt([{id:'',label:'尚未指定'},...active.map(i=>({id:i.id,label:`${label(i.category)}・${i.name}`}))],st?.instrumentId||'')}</select></div>`}).join('')}</div><p class="fine">站點使用獨立的 Firebase Authentication 帳號；Firestore 安全規則會驗證帳號綁定站號。Spark 免費方案需使用帳號 UID 綁定。</p><details><summary>綁定站點帳號</summary><div class="inline-fields"><label>投票站<select id="accountStation">${opt(stationSlots.map(n=>({id:n,label:`第 ${n} 站`})),1)}</select></label><label>站點帳號 UID（不是 Email）<input type="text" id="accountUID" placeholder="請從 Firebase Authentication → 使用者 複製 UID"></label></div><button class="button ghost" id="bindAccount">綁定此帳號</button></details></section>
 <section class="admin-panel"><h2>🎼 國樂／管樂項目</h2><div class="instruments-grid">${items.map(i=>`<div class="instrument-row"><span>${h(i.emoji)} ${h(i.name)} <small>(${label(i.category)})${!i.active?' [已封存]':''}</small></span>${i.active?`<button class="button tiny ghost" data-edit="${h(i.id)}">修改</button><button class="button tiny danger" data-archive="${h(i.id)}">刪除／封存</button>`:''}</div>`).join('')}</div><h3>新增／修改樂器</h3><form id="instrumentForm"><input type="hidden" id="editId"><div class="inline-fields"><label>樂器名稱<input id="instName" placeholder="例如：薩克斯風" required></label><label>類別<select id="instCategory">${opt([{id:'national',label:'國樂'},{id:'band',label:'管樂'}],'national')}</select></label><label>圖示<input id="instEmoji" placeholder="🎵" maxlength="8"></label><label>色彩<input id="instColor" type="color" value="#6686ca"></label></div><button class="button primary" type="submit">儲存樂器</button></form></section>
 <section class="admin-panel"><h2>📚 學生名冊</h2><p>可匯入 CSV 或 Excel XLSX，第一列請使用「班級、座號、姓名」。每人國樂及管樂各限一票。</p><div class="inline-fields"><label>上傳名冊<input id="rosterFile" type="file" accept=".csv,.xlsx,.xls"></label><label class="checkline"><input id="replaceRoster" type="checkbox">整份替換（已有投票不可使用）</label></div><button id="importRoster" class="button primary">匯入學生</button><button id="template" class="button ghost">下載名冊範本</button></section>
 <section class="admin-panel"><h2>🏫 各班投票率</h2><div class="tablewrap"><table><thead><tr><th>班級</th><th>學生數</th><th>國樂已投</th><th>國樂完成率</th><th>管樂已投</th><th>管樂完成率</th><th>查看</th></tr></thead><tbody>${d.classes.map(c=>`<tr><td>${h(c.classCode)}</td><td>${c.total}</td><td>${c.national}</td><td>${c.total?Math.round(c.national/c.total*100):0}%</td><td>${c.band}</td><td>${c.total?Math.round(c.band/c.total*100):0}%</td><td><button class="button tiny ghost" data-classinfo="${h(c.classCode)}">明細</button></td></tr>`).join('')}</tbody></table></div><div id="classInfo"></div><div class="actions"><button id="exportClasses" class="button ghost">匯出班級統計 CSV</button><button id="exportVotes" class="button ghost">匯出投票明細 CSV</button></div></section>
 <section class="admin-panel dangerzone"><h2>⚠ 測試資料管理</h2><p>清除選票前請暫停投票。此操作不可復原。正式活動請先匯出備份，並在暫停投票後才執行。</p><button id="clearVotes" class="button danger">清除全部選票與票數</button></section>`);
 document.getElementById('logout').onclick=logout;
 document.getElementById('refreshAdmin').onclick=adminStart;
 document.getElementById('createMissingStations')?.addEventListener('click',()=>runAdmin(()=>callable('adminAction',{op:'ensureTwelveStations'}),'已補齊十二站，原有設定保留'));
 document.getElementById('saveSettings').onclick=async()=>{await runAdmin(async()=>{
   await callable('adminAction',{op:'setTitle',title:document.getElementById('eventTitle').value});
   await callable('adminAction',{op:'setHideCounts',hideCounts:document.getElementById('hideCounts').checked});
   await callable('adminAction',{op:'setStatus',status:document.getElementById('eventStatus').value});
 },'設定已儲存')};
 document.querySelectorAll('[data-station]').forEach(el=>el.onchange=()=>runAdmin(()=>callable('adminAction',{op:'assignStation',stationId:el.dataset.station,instrumentId:el.value}),'站點已更新'));
 document.getElementById('bindAccount').onclick=()=>runAdmin(()=>callable('adminAction',{op:'bindStationUser',uid:document.getElementById('accountUID').value,stationId:document.getElementById('accountStation').value}),'站點帳號已綁定');
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const i=items.find(i=>i.id===b.dataset.edit);document.getElementById('editId').value=i.id;document.getElementById('instName').value=i.name;document.getElementById('instCategory').value=i.category;document.getElementById('instCategory').disabled=true;document.getElementById('instEmoji').value=i.emoji;document.getElementById('instColor').value=i.color;document.getElementById('instName').focus()});
 document.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>{if(confirm('確定要封存此樂器？已有票數保留歷史資料，且需先解除投票站綁定。'))runAdmin(()=>callable('adminAction',{op:'archiveInstrument',id:b.dataset.archive}),'樂器已封存')});
 document.getElementById('instrumentForm').onsubmit=e=>{e.preventDefault();return runAdmin(()=>callable('adminAction',{op:'upsertInstrument',id:document.getElementById('editId').value,name:document.getElementById('instName').value,category:document.getElementById('instCategory').value,emoji:document.getElementById('instEmoji').value,color:document.getElementById('instColor').value}),'樂器已儲存')};
 document.getElementById('template').onclick=()=>csvDownload('北成國樂管樂_名冊範本.csv',[{'班級':'101','座號':1,'姓名':'測試小明'},{'班級':'101','座號':2,'姓名':'測試小華'}]);
 document.getElementById('importRoster').onclick=importRoster;
 document.querySelectorAll('[data-classinfo]').forEach(b=>b.onclick=()=>showClassDetail(b.dataset.classinfo));
 document.getElementById('exportClasses').onclick=()=>csvDownload('各班投票統計.csv',d.classes.map(c=>({'班級':c.classCode,'學生數':c.total,'國樂已投':c.national,'國樂完成率':`${c.total?Math.round(c.national/c.total*100):0}%`,'管樂已投':c.band,'管樂完成率':`${c.total?Math.round(c.band/c.total*100):0}%`})));
 document.getElementById('exportVotes').onclick=async()=>{try{const r=await callable('adminAction',{op:'exportVotes'});csvDownload('投票明細_僅限管理員.csv',r.rows.map(x=>({'班級':x.classCode,'座號':x.seat,'姓名':x.name,'類別':label(x.category),'樂器':x.instrument,'站點':x.station})))}catch(e){alert(e.message)}};
 document.getElementById('clearVotes').onclick=()=>{if(prompt('此操作會清除全部選票及統計，無法復原。請輸入「清除全部選票」確認：')==='清除全部選票')runAdmin(()=>callable('adminAction',{op:'clearTestVotes'}),'選票已清空')};
}
async function runAdmin(fn,msg){const m=document.getElementById('adminMessage');try{m.innerHTML='<div class="message">處理中…</div>';await fn();await adminStart();const el=document.getElementById('adminMessage');if(el)el.innerHTML=`<div class="message success">✓ ${h(msg)}</div>`}catch(e){if(m)m.innerHTML=`<div class="message error">${h(e.message)}</div>`}}
async function showClassDetail(cls){try{const res=await callable('adminAction',{op:'classStudents',classCode:cls});const html=`<h3>${h(cls)} 班學生投票進度</h3><div class="tablewrap"><table><thead><tr><th>座號</th><th>姓名</th><th>國樂</th><th>管樂</th></tr></thead><tbody>${res.rows.map(s=>`<tr><td>${s.seat}</td><td>${h(s.name)}</td><td>${s.national?'✅ 已投':'— 未投'}</td><td>${s.band?'✅ 已投':'— 未投'}</td></tr>`).join('')}</tbody></table></div>`;document.getElementById('classInfo').innerHTML=html;}catch(e){alert(e.message)}}
async function importRoster(){
 const file=document.getElementById('rosterFile').files[0];if(!file){alert('請先選擇 CSV 或 XLSX 檔案');return;}
 let rows=[];
 try{
  if(/\.xlsx?$/i.test(file.name)){
    if(!window.XLSX){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';script.onload=resolve;script.onerror=()=>reject(Error('無法載入 Excel 讀取工具，請改存 UTF-8 CSV'));document.head.appendChild(script)})}
    const x=window.XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=x.Sheets[x.SheetNames[0]];
    rows=window.XLSX.utils.sheet_to_json(sheet,{defval:''});
  } else {
    const text=await file.text();
    const lines=parseCsv(text.replace(/^\ufeff/,''));const headers=lines.shift().map(x=>x.trim());rows=lines.filter(x=>x.length&&x.some(Boolean)).map(cols=>Object.fromEntries(headers.map((name,i)=>[name,cols[i]??''])));
  }
  const normalize=rows.map(r=>({classCode:String(r['班級']??r.classCode??'').trim(),seat:Number(r['座號']??r.seat),name:String(r['姓名']??r.name??'').trim()}));
  if(!normalize.length)throw Error('名冊沒有學生資料');
  if(!confirm(`匯入 ${normalize.length} 筆學生資料？請確認目前仍使用測試名冊或已取得校方個資授權。`))return;
  await runAdmin(()=>callable('adminAction',{op:'importStudents',rows:normalize,replace:document.getElementById('replaceRoster').checked}),`成功匯入 ${normalize.length} 筆學生`);
 }catch(e){alert('匯入失敗：'+e.message)}
}
function parseCsv(text){const out=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));out.push(row);row=[];field=''}else field+=c}if(field||row.length){row.push(field);out.push(row)}return out;}
async function start(){
 if(view==='home')mainHome();else if(view==='display'){if(demoMode)renderDemoDisplay();else drawDisplay([],false);}else if(!isReady)await renderProtected();else root.innerHTML=shell('<div class="loader">正在檢查雲端授權…</div>');
 if(!isReady)return;
 if(!await initCloud())return;
 if(view==='home'||view==='display')watchResults();
 if(view==='station'||view==='admin')cloud.onAuthStateChanged(cloud.auth,()=>renderProtected());
}
start();
