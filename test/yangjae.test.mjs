import fs from 'node:fs';
import { parseYangjae } from '../scripts/yangjae.mjs';
import { matchTarget } from '../src/lib/grade.js';
const json = JSON.parse(fs.readFileSync(new URL('./yangjae-fixture.json', import.meta.url), 'utf8'));
const { courses, warnings } = parseYangjae(json);
for (const c of courses) {
  console.log(c.id, '|', c.status, '|', c.targetText, '|', c.classStart, '~', c.classEnd, '|', c.recurrence,
    '|', `${c.applied}/${c.capacity} 대기 ${c.waitApplied}/${c.waitCapacity}`, '| 접수', c.applyStart, '~', c.applyEnd,
    '| 판정', matchTarget(c.targetText, 3, 10, 2017).result);
}
console.log('warnings:', warnings);
