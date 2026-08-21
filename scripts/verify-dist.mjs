import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {DIST_ROOT,walk,TEXT_EXTENSIONS} from './project-files.mjs';

const files=await walk(DIST_ROOT);
const forbidden=files.filter(file=>/\.(?:map|env)$|\.env\.|\.bak(?:\.|$)|\.tmp(?:\.|$)|\/src\//i.test(file.replaceAll('\\','/')));
const pattern=/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu;
let chinese=0;const chineseFiles=[];
for(const file of files){const relative=path.relative(DIST_ROOT,file).replaceAll('\\','/');if(relative.startsWith('libs/')||relative.startsWith('assets/token-logos/'))continue;if(!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()))continue;const text=await readFile(file,'utf8');const count=(text.match(pattern)||[]).length;if(count){chinese+=count;chineseFiles.push(`${relative}: ${count}`)}}
console.log(`Build files: ${files.length}`);
console.log(`Chinese characters found: ${chinese}`);
console.log(`Forbidden public artifacts: ${forbidden.length}`);
if(chinese||forbidden.length){chineseFiles.forEach(file=>console.error(file));forbidden.forEach(file=>console.error(file));process.exit(1)}
