import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));

console.log('===SETS===');
for (const set of data) {
  console.log([set.code, set.era || '', set.displayName || set.title || '', (set.cards || []).length].join('\t'));
}

const legacyPrefixes = /^(?:dp|dpt|l|legend|hg|ss|bw|xy|cp|20th)/i;
const keywords = ['스타디움','시티','마을','숲','산','탑','타워','동굴','유적','호수','섬','도로','광산','공원','정원','연구소','발전소','기지','아지트','성','궁전','제단','계곡','협곡','언덕','사당','신전','공장','센터','고원','사막','바다','항구','등대','사파리','브리지','프런티어','스페이스','기둥'];

console.log('===LEGACY_PLACES===');
for (const set of data) {
  if (!legacyPrefixes.test(String(set.code || '')) && !['DP','DPT','HGSS','BW','XY'].includes(String(set.era || '').toUpperCase())) continue;
  for (const card of set.cards || []) {
    const name = String(card.name || '').trim();
    if (!name || !keywords.some((q) => name.includes(q))) continue;
    console.log([set.code, set.era || '', set.displayName || set.title || '', card.code, name, card.image || '', card.source || ''].join('\t'));
  }
}
