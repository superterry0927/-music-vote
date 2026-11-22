"use strict";
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("node:crypto");
admin.initializeApp();
const db = admin.firestore();
const stamp = () => admin.firestore.FieldValue.serverTimestamp();
const inc = n => admin.firestore.FieldValue.increment(n);
const SEED = [
  ['national','二胡','🎻','#5B79D6'],['national','琵琶','🪕','#D87896'],['national','笛子','🪈','#39A58A'],
  ['national','揚琴','🎶','#C29441'],['national','中阮','🎸','#8B73C9'],['national','打擊','🥁','#E18D58'],
  ['band','長笛','🪈','#42A6AD'],['band','單簧管','🎵','#6485CA'],['band','薩克斯風','🎷','#E0AA39'],
  ['band','小號','🎺','#D96F6C'],['band','長號','🎼','#9072BD'],['band','打擊樂','🥁','#69A96D']
];
const clean = (x,max=80) => String(x??'').trim().slice(0,max);
const classOk = x => /^\d{3,4}$/.test(x);
const seatOk = n => Number.isInteger(n)&&n>=1&&n<=60;
const uidStudent = (cls,seat) => `${cls}_${String(seat).padStart(2,'0')}`;
const error = (code,message) => {throw new HttpsError(code,message)};
async function roleOf(req,need) {
  if(!req.auth?.uid) error('unauthenticated','請先登入授權帳號');
  const ref = db.doc(`roles/${req.auth.uid}`), snap = await ref.get();
  const r=snap.data();
  if(!r||r.active!==true||!(['admin','station'].includes(r.role))) error('permission-denied','帳號尚未取得投票系統授權');
  if(need==='admin' && r.role!=='admin') error('permission-denied','僅管理員可操作');
  if(need==='station' && r.role!=='station') error('permission-denied','僅投票站可操作');
  return r;
}
const guard = fn=>onCall({region:'asia-east1',maxInstances:30,memory:'256MiB'},fn);
const listDocuments = async name => (await db.collection(name).get()).docs.map(d=>({id:d.id,...d.data()}));
const audit = (action,details={})=>db.collection('audit').add({action,...details,at:stamp()});

exports.getStationProfile=guard(async req=>{
  const r=await roleOf(req,'station');
  const stationId=String(r.stationId||'');
  const st=(await db.doc(`stations/${stationId}`).get()).data();
  if(!st||st.enabled===false)error('failed-precondition','本投票站已停用');
  const item=st.instrumentId?(await db.doc(`instruments/${st.instrumentId}`).get()).data():null;
  return {stationId,instrumentId:st.instrumentId||null,instrument:item?{name:item.name,category:item.category,emoji:item.emoji}:null};
});
exports.getClasses=guard(async req=>{
  await roleOf(req);
  const students=await listDocuments('students');
  const byClass={};
  students.filter(x=>x.active!==false).forEach(s=>{(byClass[s.classCode]??=[]).push(s.seat)});
  return {classes:Object.entries(byClass).sort(([a],[b])=>a.localeCompare(b,'zh-Hant',{numeric:true})).map(([code,seats])=>({code,seats:seats.sort((a,b)=>a-b)}))};
});
exports.getStudent=guard(async req=>{
  await roleOf(req);
  const cls=clean(req.data?.classCode,10),seat=Number(req.data?.seat);
  if(!classOk(cls)||!seatOk(seat))error('invalid-argument','班級或座號格式錯誤');
  const d=await db.doc(`students/${uidStudent(cls,seat)}`).get();
  if(!d.exists||d.data().active===false)error('not-found','查無該學生');
  return {id:d.id,classCode:cls,seat,name:d.data().name};
});
exports.castVote=guard(async req=>{
  const role=await roleOf(req,'station');
  const stationId=String(role.stationId||''),cls=clean(req.data?.classCode,10),seat=Number(req.data?.seat);
  if(!/^[1-6]$/.test(stationId)||!classOk(cls)||!seatOk(seat))error('invalid-argument','站點、班級或座號格式錯誤');
  const studentId=uidStudent(cls,seat);
  const stRef=db.doc(`stations/${stationId}`), settingRef=db.doc('settings/public'), studentRef=db.doc(`students/${studentId}`);
  const st=await stRef.get();
  if(!st.exists||!st.data().instrumentId||st.data().enabled===false)error('failed-precondition','投票站尚未指定有效樂器');
  const instId=String(st.data().instrumentId), instRef=db.doc(`instruments/${instId}`);
  const inst=await instRef.get();
  if(!inst.exists||inst.data().active!==true)error('failed-precondition','樂器已停用');
  const category=inst.data().category, voteRef=db.doc(`votes/${studentId}_${category}`);
  const shardNum=crypto.randomInt(24),shardRef=db.doc(`tallies/${instId}/shards/${shardNum}`);
  const logRef=db.collection('audit').doc();
  await db.runTransaction(async tx=>{
    const [settingSnap,stSnap,instSnap,studentSnap,voteSnap]=await Promise.all([
      tx.get(settingRef),tx.get(stRef),tx.get(instRef),tx.get(studentRef),tx.get(voteRef)
    ]);
    if(!settingSnap.exists||settingSnap.data().status!=='open')error('failed-precondition','投票尚未開放');
    if(!stSnap.exists||stSnap.data().enabled===false||String(stSnap.data().instrumentId)!==instId)error('failed-precondition','投票站設定已變更，請重新整理');
    if(!instSnap.exists||instSnap.data().active!==true||instSnap.data().category!==category)error('failed-precondition','樂器已停用');
    if(!studentSnap.exists||studentSnap.data().active===false)error('not-found','查無該學生');
    if(voteSnap.exists)error('already-exists',`這位學生的${category==='national'?'國樂':'管樂'}已經投過票`);
    tx.create(voteRef,{studentId,classCode:cls,seat,category,instrumentId:instId,stationId,createdAt:stamp(),shard:shardNum});
    tx.set(shardRef,{count:inc(1)},{merge:true});
    tx.create(logRef,{action:'cast_vote',stationId,category,instrumentId:instId,studentId,at:stamp()});
  });
  return {ok:true,category,instrument:inst.data().name};
});

exports.adminAction=guard(async req=>{
  await roleOf(req,'admin');
  const d=req.data||{},op=clean(d.op,50);
  if(op==='dashboard') {
    const [settings,instruments,stations,students,votes,roles]=await Promise.all([
      db.doc('settings/public').get(),listDocuments('instruments'),listDocuments('stations'),listDocuments('students'),listDocuments('votes'),listDocuments('roles')
    ]);
    const voteSet=new Map(votes.map(v=>[`${v.studentId}_${v.category}`,v]));
    const classes={};
    for(const s of students){
      const t=classes[s.classCode]??={classCode:s.classCode,total:0,national:0,band:0};
      t.total++;
      if(voteSet.has(`${s.id}_national`))t.national++;
      if(voteSet.has(`${s.id}_band`))t.band++;
    }
    return {settings:settings.data()||null,instruments,stations,roles:roles.map(r=>({uid:r.id,role:r.role,stationId:r.stationId||null,active:r.active})),
      classes:Object.values(classes).sort((a,b)=>a.classCode.localeCompare(b.classCode,undefined,{numeric:true})),studentCount:students.length,voteCount:votes.length};
  }
  if(op==='bootstrap') {
    const settings=db.doc('settings/public');
    if((await settings.get()).exists)error('already-exists','初始設定已完成');
    const batch=db.batch();
    batch.set(settings,{title:'北成國小｜國樂・管樂人氣票選',status:'paused',hideCounts:false,updatedAt:stamp()});
    SEED.forEach((v,i)=>{batch.set(db.doc(`instruments/instrument_${i+1}`),{category:v[0],name:v[1],emoji:v[2],color:v[3],active:true,order:i});batch.set(db.doc(`tallies/instrument_${i+1}`),{instrumentId:`instrument_${i+1}`});});
    for(let i=1;i<=6;i++)batch.set(db.doc(`stations/${i}`),{instrumentId:`instrument_${i<=3?i:i+3}`,enabled:true});
    for(const cls of ['101','102','201','202'])for(let seat=1;seat<=30;seat++){
      const id=uidStudent(cls,seat);batch.set(db.doc(`students/${id}`),{classCode:cls,seat,name:`測試學生${cls}-${seat}`,active:true,isTest:true});
    }
    await batch.commit();await audit('bootstrap',{by:req.auth.uid});return {ok:true};
  }
  if(op==='setStatus') {
    const status=clean(d.status,16);
    if(!['open','paused','closed'].includes(status))error('invalid-argument','無效投票狀態');
    await db.doc('settings/public').set({status,updatedAt:stamp()},{merge:true});await audit('set_status',{status,by:req.auth.uid});return {ok:true};
  }
  if(op==='setTitle'||op==='setHideCounts') {
    const field=op==='setTitle'?{title:clean(d.title,80)}:{hideCounts:Boolean(d.hideCounts)};
    await db.doc('settings/public').set({...field,updatedAt:stamp()},{merge:true});return {ok:true};
  }
  if(op==='upsertInstrument') {
    const name=clean(d.name,40),category=clean(d.category,12),emoji=clean(d.emoji,8)||'🎵';
    if(!name||!['national','band'].includes(category))error('invalid-argument','請確認名稱與樂器類別');
    const id=clean(d.id,100),data={name,category,emoji,color:/^#[a-fA-F0-9]{6}$/.test(d.color||'')?d.color:'#6789C5',active:true,updatedAt:stamp()};
    if(id){
      const ref=db.doc(`instruments/${id}`),s=await ref.get();if(!s.exists)error('not-found','樂器不存在');
      if(s.data().category!==category)error('invalid-argument','建立後不可變更樂器類別');
      await ref.set(data,{merge:true});
    } else {data.order=Date.now();const newDoc=await db.collection('instruments').add(data);await db.doc(`tallies/${newDoc.id}`).set({instrumentId:newDoc.id});}
    await audit('upsert_instrument',{name,id,category});return {ok:true};
  }
  if(op==='archiveInstrument') {
    const id=clean(d.id,100);if(!id)error('invalid-argument','缺少樂器');
    const stations=await listDocuments('stations');
    if(stations.some(s=>s.instrumentId===id))error('failed-precondition','請先解除此樂器的站點綁定');
    await db.doc(`instruments/${id}`).update({active:false});await audit('archive_instrument',{id});return {ok:true};
  }
  if(op==='assignStation') {
    const stationId=clean(d.stationId,2),instId=clean(d.instrumentId,100);
    if(!/^[1-6]$/.test(stationId))error('invalid-argument','只能設定 1～6 站');
    if(instId){const snap=await db.doc(`instruments/${instId}`).get();if(!snap.exists||snap.data().active!==true)error('invalid-argument','無效樂器');}
    await db.doc(`stations/${stationId}`).set({instrumentId:instId||null,enabled:true},{merge:true});
    await audit('assign_station',{stationId,instrumentId:instId});return {ok:true};
  }
  if(op==='importStudents') {
    const source=d.rows;
    if(!Array.isArray(source)||source.length<1||source.length>2000)error('invalid-argument','每次限匯入 1～2000 筆');
    const out=new Map();
    for(const s of source){const cls=clean(s.classCode,10),seat=Number(s.seat),name=clean(s.name,40);
      if(!classOk(cls)||!seatOk(seat)||!name)error('invalid-argument',`名冊格式有誤：${cls}／${seat}`);
      out.set(uidStudent(cls,seat),{classCode:cls,seat,name,active:true,isTest:false});}
    const replace=Boolean(d.replace);
    if(replace) {
      const existingVotes=await db.collection('votes').limit(1).get();
      if(!existingVotes.empty)error('failed-precondition','已有選票，不能整份替換名冊');
      const docs=await db.collection('students').get();
      for(let i=0;i<docs.size;i+=350){const batch=db.batch();docs.docs.slice(i,i+350).forEach(s=>batch.delete(s.ref));await batch.commit();}
    }
    const all=[...out.entries()];
    for(let i=0;i<all.length;i+=350){const batch=db.batch();all.slice(i,i+350).forEach(([id,s])=>batch.set(db.doc(`students/${id}`),s));await batch.commit();}
    await audit('import_students',{rows:all.length,replace,by:req.auth.uid});return {ok:true,count:all.length};
  }
  if(op==='classStudents') {
    const cls=clean(d.classCode,10);if(!classOk(cls))error('invalid-argument','班級格式有誤');
    const [students,votes]=await Promise.all([db.collection('students').where('classCode','==',cls).get(),db.collection('votes').where('classCode','==',cls).get()]);
    const voteMap=new Map(votes.docs.map(v=>[v.data().studentId+'_'+v.data().category,v.data()]));
    return {rows:students.docs.map(s=>({id:s.id,...s.data(),national:voteMap.get(s.id+'_national')?.instrumentId||null,band:voteMap.get(s.id+'_band')?.instrumentId||null})).sort((a,b)=>a.seat-b.seat)};
  }
  if(op==='exportVotes') {
    const [students,votes,instruments]=await Promise.all([listDocuments('students'),listDocuments('votes'),listDocuments('instruments')]);
    const studentMap=new Map(students.map(s=>[s.id,s])),instMap=new Map(instruments.map(i=>[i.id,i]));
    return {rows:votes.map(v=>({classCode:v.classCode,seat:v.seat,name:studentMap.get(v.studentId)?.name||'',category:v.category,instrument:instMap.get(v.instrumentId)?.name||'已封存',station:v.stationId}))};
  }
  if(op==='bindStationUser') {
    const stationId=clean(d.stationId,2),email=clean(d.email,120).toLowerCase();
    if(!/^[1-6]$/.test(stationId)||!email.includes('@'))error('invalid-argument','站點與帳號有誤');
    const user=await admin.auth().getUserByEmail(email);
    await db.doc(`roles/${user.uid}`).set({role:'station',stationId,active:true});
    await audit('bind_station_user',{stationId,uid:user.uid});return {ok:true,uid:user.uid};
  }
  if(op==='clearTestVotes') {
    const settings=(await db.doc('settings/public').get()).data();
    if(settings?.status==='open')error('failed-precondition','先暫停投票再清除測試票');
    const allVotes=await db.collection('votes').get();
    if(allVotes.docs.some(v=>!v.data().studentId?.includes('_')))error('failed-precondition','選票資料異常');
    for(let i=0;i<allVotes.size;i+=350){const b=db.batch();allVotes.docs.slice(i,i+350).forEach(doc=>b.delete(doc.ref));await b.commit();}
    const tallyDocs=await db.collection('tallies').get();
    for(const item of tallyDocs.docs){const shards=await item.ref.collection('shards').get();for(let i=0;i<shards.size;i+=350){const b=db.batch();shards.docs.slice(i,i+350).forEach(s=>b.delete(s.ref));await b.commit();}}
    await audit('clear_votes',{by:req.auth.uid});return {ok:true};
  }
  error('invalid-argument','未知的管理操作');
});
