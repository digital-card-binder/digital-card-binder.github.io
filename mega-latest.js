"use strict";

(function () {
  const M5_NAME_OVERRIDES = Object.freeze({
    4: "라란티스 ex",
    15: "고래왕 ex",
    26: "메가제라오라 ex",
    36: "메가샹델라 ex",
    43: "램펄드 ex",
    46: "메가다크라이 ex",
    53: "모르페코 ex",
    63: "메가몰드류 ex",
    94: "라란티스 ex",
    95: "고래왕 ex",
    96: "메가제라오라 ex",
    97: "메가샹델라 ex",
    98: "램펄드 ex",
    99: "메가다크라이 ex",
    100: "모르페코 ex",
    101: "메가몰드류 ex",
    112: "메가제라오라 ex",
    113: "메가샹델라 ex",
    114: "메가다크라이 ex",
    115: "모르페코 ex",
    118: "메가다크라이 ex",
  });

  const M6_NAMES = Object.freeze([
    "헤라크로스", "비구술", "비나방", "선인왕", "밤선인", "세꿀버리", "비퀸", "꼬시레", "메가갑주무사 ex", "가디",
    "윈디", "마그마", "마그마번", "코터스", "히트로토무 ex", "앤티골", "만타인", "가이오가", "탱그릴", "탱탱겔",
    "약어리 ex", "에레브", "에레키블", "라이코 ex", "볼트로스", "찌르성게", "찌리비", "찌리비크", "슬리프", "슬리퍼",
    "기라티나", "골비람", "메가골루그 ex", "러브로스", "모래두지", "고지", "롱스톤", "강철톤", "그란돈", "랜드로스",
    "니드런♀", "니드리나", "니드퀸", "페이검", "아리아도스", "깜까미", "오케이징", "메가칼라마네로 ex", "크리만", "짜랑꼬",
    "짜랑고우", "짜랑고우거", "모토마", "루리리", "파비코", "파비코리", "켈리몬", "메가레쿠쟈 ex", "토네로스", "화살꼬빈",
    "불화살빈", "파이어로 ex", "맛있는 주먹밥", "모험의 랜턴", "특충 조끼", "메가레쿠쟈 캡", "MC의 호응유도", "길리", "피아나의 신뢰", "풍&란의 수행",
    "전설의 해구", "전설의 해구", "전설의 산정", "전설의 산정", "전설의 용암동", "전설의 용암동",
    "비나방", "가디", "마그마번", "가이오가", "에레키블", "찌르성게", "러브로스", "그란돈", "오케이징", "루리리", "파비코리", "켈리몬",
    "메가갑주무사 ex", "히트로토무 ex", "약어리 ex", "라이코 ex", "메가골루그 ex", "메가칼라마네로 ex", "메가레쿠쟈 ex", "파이어로 ex",
    "모험의 랜턴", "포켓몬 캐처", "특충 조끼", "MC의 호응유도", "길리", "피아나의 신뢰", "풍&란의 수행", "그로우 풀에너지", "니트로 불꽃에너지", "버블 물에너지",
    "메가갑주무사 ex", "라이코 ex", "메가골루그 ex", "메가레쿠쟈 ex", "길리", "피아나의 신뢰", "메가레쿠쟈 ex",
  ]);

  const RARE = new Set([5, 11, 18, 31, 39, 43, 52, 56]);
  const DOUBLE_RARE = new Set([9, 15, 21, 24, 33, 48, 58, 62]);
  const UNCOMMON = new Set([
    13, 20, 23, 25, 28, 34, 38, 40, 49, 59, 64, 65, 66, 68, 69, 70, 71, 72, 73, 74, 75, 76,
  ]);

  function rarityFor(number) {
    if (number >= 77 && number <= 88) return "AR";
    if (number >= 89 && number <= 106) return "SR";
    if (number >= 107 && number <= 112) return "SAR";
    if (number === 113) return "MUR";
    if (DOUBLE_RARE.has(number)) return "RR";
    if (RARE.has(number)) return "R";
    if (UNCOMMON.has(number)) return "U";
    return "C";
  }

  function imageFor(number) {
    const token = String(number).padStart(3, "0");
    return `https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6/M6_${token}.png`;
  }

  const m6Cards = M6_NAMES.map((name, index) => {
    const number = index + 1;
    const token = String(number).padStart(3, "0");
    return {
      code: `m6_${token}/076`,
      image: imageFor(number),
      owned: false,
      status: "구함",
      name,
      rarity: rarityFor(number),
      order: number,
    };
  });

  window.PokemonDexMegaLatest = Object.freeze({
    m5NameOverrides: M5_NAME_OVERRIDES,
    groups: Object.freeze([
      {
        code: "m6",
        title: "스톰에메랄다 (113/076)",
        displayName: "스톰에메랄다",
        era: "M",
        release: "2026-08-21",
        cards: m6Cards,
      },
    ]),
  });
})();
