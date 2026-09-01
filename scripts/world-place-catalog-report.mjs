import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));
const terms = [
  '히트팩토리','블랙마켓','라이프포레스트','썬더마운틴','원더래버린스',
  '미개척의 제단','폭풍산맥','결정동굴','활력의 숲','밤의 광산','화석 채굴장',
  '하늘기둥','굴레의 사당','N의 성','그래비티 마운틴','미스터리 가든',
  '천관산','신오신전','축복마을','예지호수','큰입 늪',
  '미르시티','프리즘타워','파도타기 비치',
  '월륜의 제단','일륜의 제단','에테르파라다이스 보호구','잔잔한물가언덕','라나키라마운틴','포마을','울트라스페이스','벨라화산공원',
  '터프스타디움','트레이닝 코트','가라르광산','루미너스메이즈숲','로즈타워','스파이크마을','슛스타디움','키르쿠스 온천','악의 탑','펄롱마을',
  '비치코트','테이블시티','레슨 스튜디오','보울마을','재앙의 황야','재앙의 설산','포켓몬리그본부','누룩스시티','제로의 대공동'
];

const norm = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();
for (const query of terms) {
  const q = norm(query);
  const matches = [];
  for (const set of data) {
    for (const card of set.cards || []) {
      if (!norm(card.name).includes(q)) continue;
      matches.push([set.code, set.displayName || set.title || '', card.code, card.name, card.image || '', card.source || '']);
    }
  }
  console.log(`===${query} ${matches.length}===`);
  for (const row of matches) console.log(row.join('\t'));
}
