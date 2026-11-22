/**
 * Spark-plan Firestore implementation: no Cloud Functions, no server-side secrets.
 * All authorization and vote/counter invariants are enforced by firestore.rules.
 * Firebase Authentication is required for admin and each station.
 */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,collection,onSnapshot,getDoc,getDocs,setDoc,addDoc,deleteDoc,writeBatch,runTransaction,serverTimestamp,query,where} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const SEED = [
 ['national','二胡','🎻','#5B79D6'],['national','琵琶','🪕','#D87896'],['national','笛子','🪈','#39A58A'],
 ['national','揚琴','🎶','#C29441'],['national','中阮','🎸','#8B73C9'],['national','打擊','🥁','#E18D58'],
 ['band','長笛','🪈','#42A6AD'],['band','單簧管','🎵','#6485CA'],['band','薩克斯風','🎷','#E0AA39'],
 ['band','小號','🎺','#D96F6C'],['band','長號','🎼','#9072BD'],['band','打擊樂','🥁','#69A96D']
];
const SHARDS = 24;
const categories = new Set(['national','band']);
const studentId = (cls,seat)=>`${cls}_${String(seat).padStart(2,'0')}`;
const clean = (x,n=80)=>String(x??'').trim().slice(0,n);
const classOk = v=>/^\d{3,4}$/.test(v);
const seatOk = v=>Number.isInteger(v)&&v>=1&&v<=60;
const err = (code,message)=>Object.assign(new Error(message),{code});
const ensure = (ok,code,message)=>{if(!ok)throw err(code,message)};
const fromDocs = snap=>snap.docs.map(d=>({id:d.id,...d.data()}));

export function createSparkBackend(){
 const app=initializeApp(firebaseConfig);
 const auth=getAuth(app),db=getFirestore(app);
 const api={auth,db,doc,collection,onSnapshot,onAuthStateChanged,signInWithEmailAndPassword,signOut};
 const d=(col,id)=>doc(db,col,id);
 const roleRef=()=>d('roles',auth.currentUser?.uid||'__not_signed_in__');
 async function authRole(kind){
   ensure(auth.currentUser,'auth/unauthenticated','請先使用 Firebase 帳號登入');
   const snap=await getDoc(roleRef());
   ensure(snap.exists()&&snap.data().active===true,'permission-denied',`此帳號尚未綁定權限。請管理員使用 UID 綁定：${auth.currentUser.uid}`);
   const role=snap.data();
   ensure(kind==='any'||role.role===kind,'permission-denied',`此帳號沒有${kind==='admin'?'管理員':'投票站'}權限。UID：${auth.currentUser.uid}`);
   return role;
 }
 function validClassSeat(cls,seat){ensure(classOk(cls)&&seatOk(seat),'invalid-argument','班級或座號格式不正確')}
 async function stationProfile(){
   const role=await authRole('station');
   const sid=String(role.stationId||'');
   ensure(/^[1-6]$/.test(sid),'permission-denied','帳號尚未綁定正確站號');
   const st=await getDoc(d('stations',sid));
   ensure(st.exists()&&st.data().enabled!==false,'failed-precondition','此投票站已停用');
   const instId=st.data().instrumentId;
   const inst=instId?await getDoc(d('instruments',instId)):null;
   ensure(inst?.exists()&&inst.data().active===true,'failed-precondition','尚未指定有效樂器');
   return {stationId:sid,instrumentId:instId,instrument:{name:inst.data().name,category:inst.data().category,emoji:inst.data().emoji}};
 }
 async function classList(){
   await authRole('any');
   const snaps=await getDocs(collection(db,'classes'));
   const arr=fromDocs(snaps).map(x=>({code:x.id,seats:(x.seats||[]).map(Number).sort((a,b)=>a-b)}));
   return {classes:arr.sort((a,b)=>a.code.localeCompare(b.code,'zh-Hant',{numeric:true}))};
 }
 async function studentDetail(data){
   await authRole('any');
   const cls=clean(data.classCode,10),seat=Number(data.seat);validClassSeat(cls,seat);
   const id=studentId(cls,seat),snap=await getDoc(d('students',id));
   ensure(snap.exists()&&snap.data().active!==false,'not-found','找不到該學生');
   return {id,classCode:cls,seat,name:snap.data().name};
 }
 async function cast(data){
   const role=await authRole('station');
   const cls=clean(data.classCode,10),seat=Number(data.seat);validClassSeat(cls,seat);
   const sid=String(role.stationId||'');
   ensure(/^[1-6]$/.test(sid),'permission-denied','帳號沒有綁定投票站');
   const sidStudent=studentId(cls,seat);
   const stationDoc=d('stations',sid),studentDoc=d('students',sidStudent),settingsDoc=d('settings','public');
   // Read the current station before choosing the target instrument and shard.
   // A transaction re-reads the station to prevent changes mid-vote.
   const currentStation=await getDoc(stationDoc);
   ensure(currentStation.exists()&&currentStation.data().enabled!==false&&currentStation.data().instrumentId,'failed-precondition','投票站尚未指定有效樂器');
   const instId=currentStation.data().instrumentId;
   const instDoc=d('instruments',instId);
   const inst=await getDoc(instDoc);
   ensure(inst.exists()&&inst.data().active===true&&categories.has(inst.data().category),'failed-precondition','樂器已停用');
   const category=inst.data().category;
   const voteId=`${sidStudent}_${category}`;
   const voteDoc=d('votes',voteId);
   const shard=String(Math.floor(Math.random()*SHARDS));
   const shardDoc=doc(db,'tallies',instId,'shards',shard);
   return runTransaction(db,async tx=>{
     // All document reads happen before writes (Firestore transaction requirement).
     const [settingSnap,stationSnap,instrSnap,studentSnap,voteSnap,shardSnap,roleSnap]=await Promise.all([
       tx.get(settingsDoc),tx.get(stationDoc),tx.get(instDoc),tx.get(studentDoc),tx.get(voteDoc),tx.get(shardDoc),tx.get(roleRef())
     ]);
     ensure(roleSnap.exists()&&roleSnap.data().active===true&&roleSnap.data().role==='station'&&String(roleSnap.data().stationId)===sid,'permission-denied','此帳號沒有該站投票權限');
     ensure(settingSnap.exists()&&settingSnap.data().status==='open','failed-precondition','投票尚未開放，請洽工作人員');
     ensure(stationSnap.exists()&&stationSnap.data().enabled!==false&&stationSnap.data().instrumentId===instId,'failed-precondition','投票站樂器剛剛變更，請重新整理');
     ensure(instrSnap.exists()&&instrSnap.data().active===true&&instrSnap.data().category===category,'failed-precondition','此樂器已停用');
     ensure(studentSnap.exists()&&studentSnap.data().active!==false&&studentSnap.data().classCode===cls&&studentSnap.data().seat===seat,'not-found','查無學生');
     ensure(!voteSnap.exists(),'vote/already-exists',`這位學生的${category==='national'?'國樂':'管樂'}已經投過票`);
     const count=shardSnap.exists()?Number(shardSnap.data().count||0):0;
     tx.set(voteDoc,{studentId:sidStudent,classCode:cls,seat,category,instrumentId:instId,stationId:sid,shard,createdAt:serverTimestamp()});
     tx.set(shardDoc,{count:count+1,lastVoteId:voteId});
     return {ok:true,category,instrument:instrSnap.data().name};
   },{maxAttempts:6});
 }
 async function adminAction(data){
   await authRole('admin');
   const op=clean(data.op,60);
   if(op==='dashboard'){
     const [stSet,ins,sta,students,votes,roles]=await Promise.all([
       getDoc(d('settings','public')),getDocs(collection(db,'instruments')),getDocs(collection(db,'stations')),
       getDocs(collection(db,'students')),getDocs(collection(db,'votes')),getDocs(collection(db,'roles'))
     ]);
     const st=fromDocs(students),v=fromDocs(votes),voteKeys=new Set(v.map(x=>`${x.studentId}_${x.category}`));
     const classes={};
     for(const s of st){
       if(s.active===false)continue;
       const entry=classes[s.classCode]??={classCode:s.classCode,total:0,national:0,band:0};
       entry.total++;
       if(voteKeys.has(`${s.id}_national`))entry.national++;
       if(voteKeys.has(`${s.id}_band`))entry.band++;
     }
     return {settings:stSet.exists()?stSet.data():null,instruments:fromDocs(ins),stations:fromDocs(sta),roles:fromDocs(roles).map(x=>({uid:x.id,role:x.role,stationId:x.stationId||null,active:x.active})),
       classes:Object.values(classes).sort((a,b)=>a.classCode.localeCompare(b.classCode,'zh-Hant',{numeric:true})),studentCount:st.filter(x=>x.active!==false).length,voteCount:v.length};
   }
   if(op==='bootstrap'){
     ensure(!(await getDoc(d('settings','public'))).exists(),'already-exists','活動已初始化，不能再次初始化');
     const batch=writeBatch(db);
     batch.set(d('settings','public'),{title:'北成國小｜國樂・管樂人氣票選',status:'paused',hideCounts:false,updatedAt:serverTimestamp()});
     for(const [i,s] of SEED.entries())batch.set(d('instruments',`instrument_${i+1}`),{category:s[0],name:s[1],emoji:s[2],color:s[3],active:true,order:i});
     for(let i=1;i<=6;i++)batch.set(d('stations',String(i)),{instrumentId:`instrument_${i<=3?i:i+3}`,enabled:true});
     for(const cls of ['101','102','201','202']){
       batch.set(d('classes',cls),{seats:Array.from({length:30},(_,i)=>i+1),total:30});
       for(let seat=1;seat<=30;seat++)batch.set(d('students',studentId(cls,seat)),{classCode:cls,seat,name:`測試學生${cls}-${seat}`,active:true,isTest:true});
     }
     await batch.commit();return {ok:true};
   }
   if(op==='setStatus'){
     const status=clean(data.status,16);ensure(['open','paused','closed'].includes(status),'invalid-argument','無效的活動狀態');
     await setDoc(d('settings','public'),{status,updatedAt:serverTimestamp()},{merge:true});return {ok:true};
   }
   if(op==='setTitle'||op==='setHideCounts'){
     await setDoc(d('settings','public'),{...(op==='setTitle'?{title:clean(data.title,80)}:{hideCounts:Boolean(data.hideCounts)}),updatedAt:serverTimestamp()},{merge:true});return {ok:true};
   }
   if(op==='upsertInstrument'){
     const name=clean(data.name,40),cat=clean(data.category,12),id=clean(data.id,100);
     ensure(name&&categories.has(cat),'invalid-argument','請填樂器名稱與國樂／管樂類別');
     const obj={name,category:cat,emoji:clean(data.emoji,8)||'🎵',color:/^#[a-f0-9]{6}$/i.test(data.color||'')?data.color:'#6789C5',active:true,updatedAt:serverTimestamp()};
     if(id){
       const prev=await getDoc(d('instruments',id));ensure(prev.exists(),'not-found','樂器不存在');
       ensure(prev.data().category===cat,'invalid-argument','已建立的樂器不可改變類別');
       await setDoc(d('instruments',id),obj,{merge:true});return {ok:true};
     }
     obj.order=Date.now();await addDoc(collection(db,'instruments'),obj);return {ok:true};
   }
   if(op==='archiveInstrument'){
     const id=clean(data.id,100);ensure(id,'invalid-argument','未指定樂器');
     const activeStations=fromDocs(await getDocs(collection(db,'stations'))).filter(s=>s.instrumentId===id);
     ensure(activeStations.length===0,'failed-precondition','此樂器仍被投票站使用，請先改派站點');
     await setDoc(d('instruments',id),{active:false,updatedAt:serverTimestamp()},{merge:true});return {ok:true};
   }
   if(op==='assignStation'){
     const sid=clean(data.stationId,2),instId=clean(data.instrumentId,100);
     ensure(/^[1-6]$/.test(sid),'invalid-argument','站號須為 1～6');
     if(instId){const it=await getDoc(d('instruments',instId));ensure(it.exists()&&it.data().active===true,'invalid-argument','此樂器無法選用');}
     await setDoc(d('stations',sid),{instrumentId:instId||null,enabled:true},{merge:true});return {ok:true};
   }
   if(op==='bindStationUser'){
     const uid=clean(data.uid,128),sid=clean(data.stationId,2);
     ensure(/^[a-zA-Z0-9:_\-]{12,128}$/.test(uid)&&/^[1-6]$/.test(sid),'invalid-argument','請填有效的站點 UID 與站號（不是 Email）');
     ensure(uid!==auth.currentUser.uid,'invalid-argument','不可將管理員帳號綁定為投票站');
     await setDoc(d('roles',uid),{role:'station',stationId:sid,active:true});return {ok:true};
   }
   if(op==='importStudents'){
     const source=data.rows;
     ensure(Array.isArray(source)&&source.length>0&&source.length<=2000,'invalid-argument','每次可匯入 1～2000 名學生');
     const out=new Map();
     for(const s of source){
       const cls=clean(s.classCode,10),seat=Number(s.seat),name=clean(s.name,40);validClassSeat(cls,seat);
       ensure(name,'invalid-argument',`名冊缺少姓名：${cls}-${seat}`);
       ensure(!out.has(studentId(cls,seat)),'invalid-argument',`名冊重複：${cls}-${seat}`);
       out.set(studentId(cls,seat),{classCode:cls,seat,name,active:true,isTest:false});
     }
     const statusSnap=await getDoc(d('settings','public'));
     ensure(statusSnap.data()?.status!=='open','failed-precondition','請先暫停投票才匯入名冊');
     if(data.replace){
       ensure((await getDocs(collection(db,'votes'))).empty,'failed-precondition','已有有效選票，不能整份替換名冊');
       await batchDelete('students');await batchDelete('classes');
     }
     for(const part of chunks([...out.entries()],350)){
       const batch=writeBatch(db);
       for(const [id,s] of part)batch.set(d('students',id),s);
       await batch.commit();
     }
     // Rebuild cheap per-class index, while keeping previous students in append mode.
     const all=fromDocs(await getDocs(collection(db,'students'))),byClass={};
     for(const s of all){if(s.active===false)continue;(byClass[s.classCode]??=[]).push(s.seat)}
     for(const part of chunks(Object.entries(byClass),350)){
       const batch=writeBatch(db);
       for(const [cls,seats] of part)batch.set(d('classes',cls),{total:seats.length,seats:seats.sort((a,b)=>a-b)});
       await batch.commit();
     }
     return {ok:true,count:out.size};
   }
   if(op==='classStudents'){
     const cls=clean(data.classCode,10);ensure(classOk(cls),'invalid-argument','請選擇有效班級');
     const [st,v]=await Promise.all([
       getDocs(query(collection(db,'students'),where('classCode','==',cls))),
       getDocs(query(collection(db,'votes'),where('classCode','==',cls)))
     ]);
     const votes=new Map(fromDocs(v).map(x=>[`${x.studentId}_${x.category}`,x]));
     return {rows:fromDocs(st).map(s=>({...s,national:votes.get(`${s.id}_national`)?.instrumentId||null,band:votes.get(`${s.id}_band`)?.instrumentId||null})).sort((a,b)=>a.seat-b.seat)};
   }
   if(op==='exportVotes'){
     const [st,v,it]=await Promise.all([
       getDocs(collection(db,'students')),getDocs(collection(db,'votes')),getDocs(collection(db,'instruments'))
     ]);
     const studentMap=new Map(fromDocs(st).map(x=>[x.id,x])),instMap=new Map(fromDocs(it).map(x=>[x.id,x]));
     return {rows:fromDocs(v).map(x=>({classCode:x.classCode,seat:x.seat,name:studentMap.get(x.studentId)?.name||'',category:x.category,instrument:instMap.get(x.instrumentId)?.name||'已封存',station:x.stationId}))};
   }
   if(op==='clearTestVotes'){
     const statusSnap=await getDoc(d('settings','public'));
     ensure(statusSnap.data()?.status!=='open','failed-precondition','請先暫停投票');
     await batchDelete('votes');
     const ins=fromDocs(await getDocs(collection(db,'instruments')));
     for(const it of ins)await batchDelete('tallies',it.id,'shards');
     return {ok:true};
   }
   throw err('invalid-argument','未知的管理操作');
 }
 const chunks=(items,n)=>Array.from({length:Math.ceil(items.length/n)},(_,i)=>items.slice(i*n,(i+1)*n));
 async function batchDelete(...path){
   const col=collection(db,...path);
   const snaps=await getDocs(col);
   for(const part of chunks(snaps.docs,350)){
     const batch=writeBatch(db);for(const s of part)batch.delete(s.ref);await batch.commit();
   }
 }
 api.call=async(name,data={})=>{
   switch(name){
     case 'getStationProfile':return stationProfile();
     case 'getClasses':return classList();
     case 'getStudent':return studentDetail(data);
     case 'castVote':return cast(data);
     case 'adminAction':return adminAction(data);
     default:throw err('invalid-argument',`未知的功能：${name}`);
   }
 };
 return api;
}
