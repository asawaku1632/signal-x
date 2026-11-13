import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyEarnings} from './earnings-financial-classifier.mjs';
const prior={Code:'94680',CurPerType:'2Q',CurPerEn:'2025-09-30',DiscDate:'2025-11-12',OP:'100'};
const current={Code:'94680',CurPerType:'2Q',CurPerEn:'2026-09-30',DiscDate:'2026-11-12',DiscTime:'15:30:00',OP:'75'};
test('declining operating profit',()=>assert.equal(classifyEarnings(current,prior).fundamentalClass,'NEGATIVE'));
test('growing operating profit',()=>assert.equal(classifyEarnings({...current,OP:'125'},prior).fundamentalClass,'POSITIVE'));
test('missing OP is unknown',()=>assert.equal(classifyEarnings({...current,OP:''},prior).fundamentalClass,'UNKNOWN'));
test('prior loss is not treated as ordinary growth',()=>assert.equal(classifyEarnings(current,{...prior,OP:'-10'}).fundamentalClass,'UNKNOWN'));
test('period mismatch is unknown',()=>assert.equal(classifyEarnings(current,{...prior,CurPerType:'1Q'}).fundamentalClass,'UNKNOWN'));
test('year mismatch is unknown',()=>assert.equal(classifyEarnings(current,{...prior,CurPerEn:'2024-09-30'}).fundamentalClass,'UNKNOWN'));

test('minute precision disclosure time accepted',()=>assert.equal(classifyEarnings({...current,DiscTime:'15:30'},prior).fundamentalClass,'NEGATIVE'));
test('invalid disclosure time rejected',()=>assert.equal(classifyEarnings({...current,DiscTime:'25:30'},prior).fundamentalClass,'UNKNOWN'));
