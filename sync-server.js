/* Sri Crackers Billing - sync server. No installs needed except Node.js (nodejs.org, LTS).
   Run:  node sync-server.js     Optional: set SYNC_KEY=secret   PORT=8787 */
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const PORT=+process.env.PORT||8787,KEY=process.env.SYNC_KEY||'',FILE=path.join(__dirname,'sync-data.json');
let S={rev:0,data:{},sc:{},log:[]};
try{S=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
const save=()=>{fs.writeFileSync(FILE+'.tmp',JSON.stringify(S));fs.renameSync(FILE+'.tmp',FILE)};
const idf=k=>k==='items'?'sno':'id',r2=n=>Math.round(n*100)/100,tracked=it=>it&&it.stock!=null&&it.stock!=='';
function merge(b){
  const D=S.data,had=new Set((D.items||[]).map(x=>x.sno));
  for(const k of Object.keys(b.up||{})){
    const f=idf(k),a=D[k]=D[k]||[];
    for(const r of b.up[k]){
      const i=a.findIndex(x=>String(x[f])===String(r[f]));
      if(k==='items'&&i>-1)r.stock=a[i].stock;            /* stock moves only through stock-log entries */
      if(k==='stockLog'&&i<0&&had.has(r.sno)){const it=D.items.find(x=>x.sno===r.sno);if(tracked(it))it.stock=r2(+it.stock+r.qty)}
      if((k==='bills'||k==='estimates')&&i<0){const n=r.no;let c=0;while(a.some(x=>x.no===r.no&&String(x.id)!==String(r.id)))r.no=n+'-'+(++c)}
      if(i>-1)a[i]=r;else a.unshift(r);
    }
  }
  for(const k of Object.keys(b.del||{})){
    const f=idf(k),a=D[k]||[];
    for(const id of b.del[k]){
      const i=a.findIndex(x=>String(x[f])===String(id));if(i<0)continue;
      if(k==='stockLog'){const it=(D.items||[]).find(x=>x.sno===a[i].sno);if(tracked(it))it.stock=r2(+it.stock-a[i].qty)}
      a.splice(i,1);
    }
  }
  const c=b.sc;
  if(c){for(const k of['counter','estCounter','poc','prc','rtc'])S.sc[k]=Math.max(+S.sc[k]||1,+c[k]||1);if(c.shop)S.sc.shop=c.shop;if(c.matrix)S.sc.matrix=c.matrix}
}
const TYPES={'index.html':'text/html; charset=utf-8','sw.js':'text/javascript','manifest.webmanifest':'application/manifest+json'};
http.createServer((q,s)=>{
  s.setHeader('Access-Control-Allow-Origin','*');s.setHeader('Access-Control-Allow-Headers','Content-Type,X-Key');
  s.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');s.setHeader('Access-Control-Allow-Private-Network','true');
  const u=q.url.split('?')[0];
  if(q.method==='OPTIONS'){s.writeHead(204);return s.end()}
  if(u==='/api/sync'&&q.method==='POST'){
    if(KEY&&q.headers['x-key']!==KEY){s.writeHead(401);return s.end()}
    let t='';q.on('data',c=>{t+=c;if(t.length>6e7)q.destroy()});
    q.on('end',()=>{try{
      const b=JSON.parse(t),ch=Object.keys(b.up||{}).length||Object.keys(b.del||{}).length||b.sc;
      if(ch){merge(b);S.rev++;S.log.push({rev:S.rev,dev:b.dev});S.log=S.log.slice(-300);save()}
      const others=S.log.some(e=>e.rev>b.since&&e.dev!==b.dev);
      s.writeHead(200,{'Content-Type':'application/json'});
      s.end(JSON.stringify(b.since===S.rev?{rev:S.rev,same:true}:{rev:S.rev,data:S.data,sc:S.sc,others}));
    }catch(e){s.writeHead(400);s.end()}});return;
  }
  const f=u==='/sw.js'?'sw.js':u==='/manifest.webmanifest'?'manifest.webmanifest':'index.html';
  fs.readFile(path.join(__dirname,f),(e,d)=>{if(e){s.writeHead(404);return s.end('Not found')}s.writeHead(200,{'Content-Type':TYPES[f]});s.end(d)});
}).listen(PORT,'0.0.0.0',()=>{
  console.log('Sri Crackers sync server is running.\nOpen the app or set the Server address on each device to:');
  for(const l of Object.values(os.networkInterfaces()))for(const a of l)if(a.family==='IPv4'&&!a.internal)console.log('   http://'+a.address+':'+PORT);
  console.log(KEY?'Access key is set.':'WARNING: no access key set (set SYNC_KEY). Fine on a private shop network only.');
});
