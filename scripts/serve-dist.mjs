import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {DIST_ROOT} from './project-files.mjs';

const port=Number(process.env.PORT||4173);
const mime={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webmanifest':'application/manifest+json'};
const headers={
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:; manifest-src 'self'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()','X-Frame-Options':'DENY'
};

http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    let pathname=decodeURIComponent(url.pathname);
    if(!pathname.startsWith('/v2')){res.writeHead(302,{Location:'/v2/'});res.end();return}
    let relative=pathname.slice(3).replace(/^\/+/, '');
    if(!relative||pathname.endsWith('/'))relative='index.html';
    let file=path.resolve(DIST_ROOT,relative);
    if(!file.startsWith(path.resolve(DIST_ROOT)+path.sep))throw new Error('Invalid path');
    try{if(!(await stat(file)).isFile())throw new Error('Not a file')}catch{file=path.join(DIST_ROOT,'index.html')}
    const body=await readFile(file);const ext=path.extname(file).toLowerCase();
    res.writeHead(200,{...headers,'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=31536000, immutable'});res.end(body);
  }catch{res.writeHead(404,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end('Not Found')}
}).listen(port,'127.0.0.1',()=>console.log(`Production preview: http://127.0.0.1:${port}/v2/`));
