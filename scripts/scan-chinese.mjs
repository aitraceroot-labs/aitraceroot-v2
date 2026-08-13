import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {TEXT_EXTENSIONS,walk,isTemporary} from './project-files.mjs';

const pattern=/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu;
const roots=process.argv.slice(2);
const files=[];
for(const item of roots){
  const info=await stat(item);
  if(info.isDirectory()) files.push(...await walk(item,{filter:(absolute,relative)=>TEXT_EXTENSIONS.has(path.extname(absolute).toLowerCase())&&!isTemporary(relative)&&!relative.startsWith('vendor/')}));
  else files.push(item);
}
let count=0;
for(const file of files){const text=await readFile(file,'utf8');const matches=text.match(pattern);if(matches){count+=matches.length;console.error(`${file}: ${matches.length}`)}}
console.log(`Chinese characters found: ${count}`);
if(count)process.exit(1);
