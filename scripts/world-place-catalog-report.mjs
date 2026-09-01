import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));
const keywords = [
  '스타디움','체육관','도장','시티','마을','숲','산','탑','타워','동굴','유적','호수','섬','도로','광산',
  '공원','정원','광장','연구소','발전소','학교','아카데미','기지','아지트','성','궁전','제단','계곡','협곡',
  '해변','온천','묘지','코트','사당','신전','사원','공장','팩토리','감시탑','스튜디오','대공동','게이트','본부',
  '경기장','필드','천문대','전망대','보호구역','보존구역','거리','시장','백화점','센터','포켓스톱','고개','고원',
  '황야','설원','습지','사막','바다','수로','항구','선착장','캠프','마천루','요새','저택','회관','랜드','플라자'
];

const rows = [];
for (const set of data) {
  for (const card of set.cards || []) {
    const name = String(card.name || '').trim();
    if (!name || !keywords.some((keyword) => name.includes(keyword))) continue;
    rows.push({
      setCode: set.code,
      setName: set.displayName || set.title || '',
      cardCode: card.code,
      name,
      image: card.image || '',
      source: card.source || ''
    });
  }
}

console.log(`WORLD_PLACE_CANDIDATES=${rows.length}`);
for (const row of rows) {
  console.log([row.setCode, row.setName, row.cardCode, row.name, row.image, row.source].join('\t'));
}
