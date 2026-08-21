import {readdir} from 'node:fs/promises';
import path from 'node:path';

export const ROOT = process.cwd();
export const SOURCE_ROOT = path.join(ROOT, 'webroot', 'v2');
export const DIST_ROOT = path.join(ROOT, 'dist', 'v2');
export const TEXT_EXTENSIONS = new Set(['.js','.mjs','.html','.css','.json','.svg','.txt','.md','.webmanifest']);

export async function walk(root, options={}) {
  const output=[];
  async function visit(directory) {
    for (const entry of await readdir(directory, {withFileTypes:true})) {
      const absolute=path.join(directory, entry.name);
      const relative=path.relative(root, absolute).replaceAll('\\','/');
      if (entry.isDirectory()) {
        if (options.skipDirectories?.some(name=>relative===name||relative.startsWith(name+'/'))) continue;
        await visit(absolute);
      } else if (!options.filter || options.filter(absolute, relative)) output.push(absolute);
    }
  }
  await visit(root);
  return output;
}

export const isTemporary = relative => /(^|\/)(?:\.env(?:\.|$)|.*\.map$|.*\.bak(?:\.|$)|.*\.tmp(?:\.|$)|.*\.tmp\.mjs(?:\.|$))/i.test(relative);
