# M4 닌자스피너 공식 한국어 카드명 복원 (2026-10-28)

- **기존 상태:** `data/series-inventory-audit.json` M4 카드 120장 중 `name` 빈 값 96장, `pokemonName` 96장 존재.
- **데이터 기준:** `data/series.json` M4 카드 코드·이미지·보유 기록 변경 금지.
- **공식 출처:** [포켓몬코리아 MEGA 닌자스피너](https://pokemoncard.co.kr/card/887), 개별 카드 상세 `https://pokemoncard.co.kr/cards/detail/BS2026003NNN` (001–120).
- **검증:** 공식 상세의 세트명/인쇄 카드번호가 기존 M4 카드번호와 일치하고 제목에 기존 `pokemonName`이 포함되는 경우에만 기존 빈 `name`을 공식 제목으로 채움. `ex`와 메가진화 이름은 임의 추측하지 않고 정확히 공식 표기 사용.
- 응답 오류·타 시리즈·번호 불일치·기존 이름과 불일치는 **보류**. `data/audits/m4-korean-card-names-20261028.json`에 개별 카드별 확인 URL, 적용/보류 사유를 남김.
- 변경 전후 시리즈/카드 개수 및 카드 키·기존 소유 상태·이미지 무결성, `npm run site:prepare` + `npm test` + Firebase 권한 테스트 통과 후 PR 병합.
- 대량 크롤링 금지 사이트는 사용하지 않음. 공식 한국판 카드 페이지에서 해당 96개의 카드명만 최소 범위로 순차 조회.
- 본 과정은 *한국어 공식 제목* 보완이며 M4 모든 카드 이미지의 실물 검수 완료를 주장하지 않음.
