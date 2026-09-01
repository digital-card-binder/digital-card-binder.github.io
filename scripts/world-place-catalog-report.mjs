import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));
const selected = new Set(['sm8','sm8a','s12','sm6b','sm7','sv9','sv11B','sv11W','m2a','m3','m4','m5']);

for (const set of data) {
  if (!selected.has(set.code)) continue;
  console.log(`===${set.code} ${set.displayName || set.title || ''}===`);
  const cards = set.cards || [];
  for (const card of cards) {
    const code = String(card.code || '');
    const m = code.match(/_(\d+)\/(\d+)/);
    const n = m ? Number(m[1]) : 0;
    const d = m ? Number(m[2]) : 0;
    if (d && n < Math.max(1, d - 28)) continue;
    console.log([set.code, card.code, card.name, card.image || '', card.source || ''].join('\t'));
  }
}
