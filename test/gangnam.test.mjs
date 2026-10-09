import fs from 'node:fs';
import { parseGangnamList } from '../scripts/gangnam.mjs';
const html = fs.readFileSync(new URL('./gangnam-fixture.html', import.meta.url), 'utf8');
const { courses, warnings, lastPage } = parseGangnamList(html);
console.log(JSON.stringify(courses, null, 1));
console.log('warnings:', warnings, 'lastPage:', lastPage);
