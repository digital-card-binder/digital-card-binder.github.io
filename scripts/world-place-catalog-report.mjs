import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));
const names = [
  '히트팩토리','블랙마켓','라이프포레스트','썬더마운틴','원더래버린스','미개척의 제단','큰입 늪',
  '굴레의 사당','하늘기둥','마그마단의 비밀기지','아쿠아단의 비밀기지',
  '천관산','신오신전','축복마을','예지호수',
  'N의 성','그래비티 마운틴','미스터리 가든','밤의 광산',
  '미르시티','프리즘타워','활력의 숲','파도타기 비치','화석 채굴장',
  '월륜의 제단','일륜의 제단','에테르파라다이스 보호구','잔잔한물가언덕','라나키라마운틴','포마을','울트라스페이스','벨라화산공원','텅빈 바다','더스트 아일랜드',
  '터프스타디움','트레이닝 코트','가라르광산','루미너스메이즈숲','로즈타워','스파이크마을','슛스타디움','키르쿠스 온천','악의 탑','물의 탑','결정동굴','폭풍산맥',
  '비치코트','테이블시티','레슨 스튜디오','보울마을','재앙의 황야','재앙의 설산','마을백화점','포켓몬리그본부','마을 회관','밤의 아카데미','누룩스시티','제로의 대공동'
];

for (const query of names) {
  const matches = [];
  for (const set of data) {
    for (const card of set.cards || []) {
      if (String(card.name || '').trim() !== query) continue;
      matches.push([set.code, set.displayName || set.title || '', card.code, card.name, card.image || '', card.source || '']);
    }
  }
  console.log(`===${query} ${matches.length}===`);
  for (const row of matches) console.log(row.join('\t'));
}
