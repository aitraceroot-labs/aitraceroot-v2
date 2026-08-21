import {build} from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import {cp,mkdir,readFile,rm,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {ROOT,DIST_ROOT,SOURCE_ROOT} from './project-files.mjs';

await rm(DIST_ROOT,{recursive:true,force:true});
await mkdir(path.join(DIST_ROOT,'assets'),{recursive:true});
await mkdir(path.join(DIST_ROOT,'libs'),{recursive:true});

const jsResult=await build({
  absWorkingDir:ROOT,entryPoints:{app:path.join(SOURCE_ROOT,'src','app','app.js')},
  outdir:path.join(DIST_ROOT,'assets'),bundle:true,splitting:true,format:'esm',platform:'browser',
  target:['es2020'],minify:true,treeShaking:true,sourcemap:false,metafile:true,
  entryNames:'[name]-[hash]',chunkNames:'chunk-[hash]',assetNames:'asset-[hash]',
  external:['/v2/libs/*'],legalComments:'none',charset:'utf8'
});
const entryOutput=Object.entries(jsResult.metafile.outputs).find(([,meta])=>meta.entryPoint)?.[0];
if(!entryOutput)throw new Error('Production JavaScript entry was not generated.');
let entryPath=path.resolve(entryOutput);
const source=await readFile(entryPath,'utf8');
const protectedCode=JavaScriptObfuscator.obfuscate(source,{
  compact:true,controlFlowFlattening:false,deadCodeInjection:false,debugProtection:false,
  disableConsoleOutput:false,identifierNamesGenerator:'hexadecimal',renameGlobals:false,
  selfDefending:false,simplify:true,splitStrings:false,stringArray:true,stringArrayThreshold:0.25,
  stringArrayEncoding:[],transformObjectKeys:false,unicodeEscapeSequence:true
}).getObfuscatedCode();
const jsHash=crypto.createHash('sha256').update(protectedCode).digest('hex').slice(0,12);
const protectedPath=path.join(path.dirname(entryPath),`app-${jsHash}.js`);
await writeFile(protectedPath,protectedCode,'utf8');
if(protectedPath!==entryPath)await rm(entryPath,{force:true});
entryPath=protectedPath;

const cssResult=await build({
  absWorkingDir:ROOT,entryPoints:{app:path.join(SOURCE_ROOT,'src','styles','app.48057a6bd3.css'),tokens:path.join(SOURCE_ROOT,'src','styles','tokens.9f72564dcd.css')},
  outdir:path.join(DIST_ROOT,'assets'),bundle:true,minify:true,sourcemap:false,metafile:true,
  entryNames:'[name]-[hash]',assetNames:'asset-[hash]',legalComments:'none'
});
const cssEntries={};
for(const [output,meta] of Object.entries(cssResult.metafile.outputs))if(meta.entryPoint)cssEntries[path.basename(meta.entryPoint).split('.')[0]]=path.resolve(output);

await cp(path.join(SOURCE_ROOT,'assets'),path.join(DIST_ROOT,'assets','token-logos'),{recursive:true});
await cp(path.join(SOURCE_ROOT,'libs','appkit.bundle.js'),path.join(DIST_ROOT,'libs','appkit.bundle.js'));
for(const name of ['favicon.svg','manifest.webmanifest','offline.html'])await cp(path.join(SOURCE_ROOT,name),path.join(DIST_ROOT,name));

const publicPath=file=>'/v2/'+path.relative(DIST_ROOT,file).replaceAll('\\','/');
const index=`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#06080c"><meta name="description" content="AITRACEROOT is an AI-powered crypto market and on-chain intelligence terminal."><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><title>AITRACEROOT · AI Crypto Intelligence Terminal</title><link rel="icon" href="/v2/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/v2/manifest.webmanifest"><link rel="stylesheet" href="${publicPath(cssEntries.tokens)}"><link rel="stylesheet" href="${publicPath(cssEntries.app)}"></head><body><div id="app"></div><script type="module" src="${publicPath(entryPath)}"></script></body></html>`;
await writeFile(path.join(DIST_ROOT,'index.html'),index,'utf8');

const cacheName=`aitraceroot-v2-${jsHash}`;
const shell=['/v2/','/v2/manifest.webmanifest','/v2/favicon.svg',publicPath(cssEntries.tokens),publicPath(cssEntries.app),publicPath(entryPath)];
const sw=`const CACHE=${JSON.stringify(cacheName)};const SHELL=${JSON.stringify(shell)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url)))).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/api/'))return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/v2/offline.html').then(hit=>hit||Response.error())));return}const immutable=/\\.[A-Z0-9_-]{8,}\\.(?:js|css)$/i.test(url.pathname);event.respondWith((immutable?caches.match(request).then(hit=>hit||fetch(request)):fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match(request))));});`;
await writeFile(path.join(DIST_ROOT,'sw.js'),sw,'utf8');
console.log(`Production build created at ${DIST_ROOT}`);
console.log(`Protected first-party entry: ${path.basename(entryPath)}`);
