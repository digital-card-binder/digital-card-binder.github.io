import fs from 'node:fs';

const raw = fs.readFileSync('data/series.json', 'utf8');
const data = JSON.parse(raw);

console.log('WORLD_PLACE_REPORT_SCHEMA');
console.log('rootType=', Array.isArray(data) ? 'array' : typeof data);
console.log('rootKeys=', Array.isArray(data) ? [] : Object.keys(data));

function sample(value, depth = 0) {
  if (depth > 3) return typeof value;
  if (Array.isArray(value)) return value.slice(0, 2).map((v) => sample(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 12).map(([k, v]) => [k, sample(v, depth + 1)]));
  }
  return value;
}

console.log('sample=', JSON.stringify(sample(data), null, 2));
