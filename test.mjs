import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './engine.mjs';
import {sample} from './sample.mjs';
test('domain behavior and boundary cases',()=>{assert.equal(run(sample).rows.find(r=>r.key==='port').value,'9000');assert.ok(!JSON.stringify(run(sample)).includes('SYNTHETIC'));assert.equal(run({...sample,layers:[]}).metrics.keys,0);});
test('deterministic result and input preservation',()=>{const copy=JSON.stringify(sample);assert.deepEqual(run(sample),run(sample));assert.equal(JSON.stringify(sample),copy);});
test('reject malformed root and oversized input',()=>{assert.throws(()=>run(null));assert.throws(()=>run([]));assert.throws(()=>run({...sample,oversized:'x'.repeat(200001)}));});

test('reject nested secret payloads without echoing their contents', () => {
  for (const value of [{token:'PRIVATE_MARKER'}, ['PRIVATE_MARKER']]) {
    assert.throws(() => run({secretKeys:['token'], layers:[{name:'demo',values:{service:value}}]}), e =>
      /flat JSON scalars/.test(e.message) && !e.message.includes('PRIVATE_MARKER'));
  }
});
test('redact every assignment and distinguish duplicate layer names', () => {
  const report = run({secretKeys:['token'],layers:[
    {name:'env',values:{token:'OLD_PRIVATE'}}, {name:'env',values:{token:'NEW_PRIVATE'}}]});
  assert.equal(report.rows[0].sourceIndex, 1);
  assert.deepEqual(report.provenance[0].assignments, [{layerIndex:0,layerName:'env'}, {layerIndex:1,layerName:'env'}]);
  assert.equal(report.rows[0].value, '[REDACTED]');
  assert.ok(!JSON.stringify(report).includes('PRIVATE'));
});
test('unmatched declarations are unique and sorted', () => {
  const report = run({secretKeys:['z','a','z'],layers:[]});
  assert.deepEqual(report.unmatchedSecretKeys, ['a','z']);
  assert.equal(report.metrics.unmatchedSecretKeys, 2);
});
test('preserve falsy scalars and prototype-named keys', () => {
  const values = JSON.parse('{"__proto__":0,"constructor":false,"toString":null,"empty":""}');
  const report = run({secretKeys:[],layers:[{name:'x',values}]});
  assert.deepEqual(report.rows.map(r => r.value), ['0','false','null','""']);
  assert.equal(report.rows[0].key, '__proto__');
});
test('reject non-JSON values and accessor inputs without executing getters', () => {
  for (const value of [undefined, NaN, Infinity, 1n, Symbol(), () => 1])
    assert.throws(() => run({secretKeys:[],layers:[{name:'x',values:{key:value}}]}));
  let invoked = false;
  const values = {get key(){invoked = true; return 'PRIVATE';}};
  assert.throws(() => run({secretKeys:[],layers:[{name:'x',values}]}));
  assert.equal(invoked, false);
});
test('bound serialized input and arrays', () => {
  assert.throws(() => run({secretKeys:[],layers:[{name:'x',values:{key:'x'.repeat(200001)}}]}));
  assert.throws(() => run({secretKeys:Array(501).fill('x'),layers:[]}));
  assert.throws(() => run({secretKeys:[],layers:new Array(1)}));
});
