import test from 'node:test';
import assert from 'node:assert/strict';
import {matchRoute,routes} from '../webroot/v2/src/app/router.js';
import {asArray,asObject,safeJSON} from '../webroot/v2/src/utils/safe.js';
import {escapeHTML} from '../webroot/v2/src/utils/format.js';

test('all primary routes resolve to unique pages',()=>{
  assert.equal(new Set(routes.map(route=>route.path)).size,routes.length);
  for(const route of routes)assert.equal(matchRoute(route.path).key,route.key);
  assert.equal(matchRoute('/v2/token/bsc/0xabc').key,'token');
});
test('unsafe input is escaped',()=>assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;'));
test('API envelope helpers fail closed',()=>{
  assert.deepEqual(asArray(null),[]);assert.deepEqual(asObject(null),{});assert.deepEqual(safeJSON('{bad',[]),[]);
});
