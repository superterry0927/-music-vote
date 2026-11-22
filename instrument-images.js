/** Spark 免費版樂器圖示：管理端自動縮圖壓縮，直接存 Firestore */
export function iconMarkup(item,cssClass='',lazy=false){
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const img=item?.iconData;
 if(typeof img==='string'&&img.length<=82000&&/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(img)){
   return '<img class="music-icon '+escape(cssClass)+'" src="'+escape(img)+'" alt="'+escape(item?.name||'樂器')+'圖示" decoding="async" '+(lazy?'loading="lazy"':'')+'>';
 }
 return '<span class="emoji-icon '+escape(cssClass)+'" aria-hidden="true">'+escape(item?.emoji||'🎵')+'</span>';
}
export async function compressInstrumentImage(file){
 if(!file)throw Error('請選擇一張圖片');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('只接受 PNG、JPG／JPEG、WebP 圖片');
 if(file.size>2*1024*1024)throw Error('原始圖片不得超過 2MB');
 if(!file.size)throw Error('圖片內容是空的');
 let bitmap=null,objectUrl=null,picture=null;
 try{
   if(typeof createImageBitmap==='function'){
     try{bitmap=await createImageBitmap(file)}catch(e){bitmap=null}
   }
   if(!bitmap){
     objectUrl=URL.createObjectURL(file);
     picture=await new Promise((resolve,reject)=>{
       const im=new Image();
       im.onload=()=>resolve(im);
       im.onerror=()=>reject(Error('無法讀取此圖片'));
       im.src=objectUrl;
     });
   }
   const w=bitmap?bitmap.width:picture.naturalWidth;
   const ht=bitmap?bitmap.height:picture.naturalHeight;
   if(!w||!ht||w*ht>25000000)throw Error('圖片像素尺寸過大或無效');
   const canvas=document.createElement('canvas');
   canvas.width=128;canvas.height=128;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('瀏覽器無法處理圖片');
   const scale=Math.min(128/w,128/ht);
   const dw=Math.max(1,Math.round(w*scale)),dh=Math.max(1,Math.round(ht*scale));
   ctx.clearRect(0,0,128,128);
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.drawImage(bitmap||picture,Math.round((128-dw)/2),Math.round((128-dh)/2),dw,dh);
   for(const quality of [0.84,0.72,0.55]){
     const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('圖片壓縮失敗')),'image/webp',quality));
     if(blob.type!=='image/webp')throw Error('此瀏覽器不支援 WebP 輸出，請更新 Safari');
     if(blob.size<=50*1024){
       const dataUrl=await new Promise((resolve,reject)=>{
         const reader=new FileReader();
         reader.onload=()=>resolve(String(reader.result));
         reader.onerror=()=>reject(Error('圖片轉換失敗'));
         reader.readAsDataURL(blob);
       });
       if(dataUrl.length>82000)throw Error('壓縮後圖示仍太大');
       return {dataUrl,kb:(blob.size/1024).toFixed(1)};
     }
   }
   throw Error('壓縮後仍超過 50KB，請選擇較簡單的圖片');
 }finally{
   if(bitmap?.close)bitmap.close();
   if(objectUrl)URL.revokeObjectURL(objectUrl);
 }
}
