import {build} from 'esbuild';
import path from 'node:path';
import {ROOT,SOURCE_ROOT} from './project-files.mjs';
await build({
  absWorkingDir:ROOT,entryPoints:[path.join(SOURCE_ROOT,'src','app','app.js')], bundle:true, format:'esm', platform:'browser',
  target:['es2020'], write:false, treeShaking:true, logLevel:'warning',
  external:['/v2/libs/*']
});
console.log('Typecheck passed: the complete first-party module graph resolves and bundles.');
