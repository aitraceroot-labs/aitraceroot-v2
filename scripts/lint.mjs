import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {SOURCE_ROOT, walk, isTemporary} from './project-files.mjs';

const files=await walk(SOURCE_ROOT,{filter:(absolute,relative)=>['.js','.mjs'].includes(path.extname(absolute))&&!isTemporary(relative)&&!relative.startsWith('libs/')&&!relative.startsWith('src/vendor/')&&!relative.includes('app.a5e2adca88.js')});
const failures=[];
for (const file of files) {
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0) failures.push(`${path.relative(SOURCE_ROOT,file)}\n${result.stderr}`);
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Lint passed: ${files.length} first-party JavaScript modules.`);
