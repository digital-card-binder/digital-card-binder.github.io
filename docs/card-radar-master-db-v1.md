# 카드 레이더 독립 마스터 DB — 1단계

기준일: 2026-10-19.

## 구현 상태

기존 팩도감 packs.js에 있는 151개 세트 ID를 data/radar-master/sets.json에 정규화했습니다. 이는 매장 판매 SKU 151개를 확보했다는 뜻이 아닙니다.

- retailers.json: 편의점 4종과 대형마트 6종, 연결 및 사용 권한 상태
- stores.json: 출처가 확인된 이마트 속초점 1곳을 첫 기준 데이터로 이관
- products.json: 인페르노X 부스터 팩과 30th CELEBRATION 부스터 박스의 내부 제품 ID 두 개
- retailer-skus.json: 판매처 실제 품목코드 미확인, 초기 0건
- store-aliases.json: 판매처 매장코드 ↔ 우리 내부 매장 ID의 증거 기반 매핑, 초기 0건
- inventory-observations.json: 검증된 수량이 없어 초기 0건
- lib/radar-master.mjs: 식별·관계 검증, 양수/0/미확인/실패 분리, 15분 신선도 검사
- db/migrations/001_card_radar_master.sql: PostgreSQL DDL(테이블, 외래키, 최신 재고 뷰)
- scripts/check-card-radar-master.mjs: 정합성 점검. npm run radar:master:check

**중요:** GitHub에 독립 마스터 데이터와 SQL 스키마를 준비했습니다. 실행 중인 PostgreSQL DB 인스턴스를 개설하거나 마이그레이션한 것은 아닙니다. 기존 GitHub Pages 및 카드 레이더 API는 그대로 유지합니다.

## 공개 구현 조사

| 판매처 | 확인한 공개 코드/문서 | 참고할 기술 | 상태 |
| --- | --- | --- | --- |
| CU | https://github.com/hmmhmmhm/daiso-mcp | 매장/상품 재고 조회, 매장코드 | 기존 공개 커뮤니티 API 사용, 공식 재배포 권한 미확인 |
| GS25 | https://github.com/hmmhmmhm/daiso-mcp/blob/main/docs/gs25-final-replay-methodology.md | 상품코드, 로그인 세션·갱신 | 과거 무인증 코드는 구식, 인증 변경으로 유지보수 필요 |
| 세븐일레븐 | https://github.com/hmmhmmhm/daiso-mcp | 상품ID 및 점포 코드 조회 | 공개 구현 존재, 이용 조건 검증 필요 |
| 이마트24 | https://github.com/hmmhmmhm/daiso-mcp | PLU 상품코드 + 점포 ID | 대형마트 이마트와 별개의 공급원 |
| 롯데마트 | https://github.com/hmmhmmhm/daiso-mcp/blob/main/src/services/lottemart/client.ts | 매장코드/상품검색 파싱 | 운영 재고 API는 HTTP 410 지원 종료, 외부 자동 재배포 권한 미확인 |
| 이마트/트레이더스 | https://eapp.emart.com/webapp/product/search | 공식 앱 점포별 조회 | 독립적으로 재배포 가능한 외부 API 미확인 |
| 홈플러스·코스트코·하나로마트 | 해당 업체 공식 서비스 | 점포코드 기반 공급자 연동 조사 | 사용 가능한 외부 매장별 API 미확인 |

외부 서비스의 소스코드 재사용 라이선스와 재고 데이터의 재배포 권한은 별개입니다. 공식 앱에 재고가 표시된다는 사실만으로 타사의 API를 자동 이용할 권리가 생기지는 않습니다.

## DB 설계 원칙

1. 카드 세트 ID와 매장에서 쓰는 상품코드/바코드를 별도로 관리합니다.
2. 매장 표시 이름만으로 업체 간 ID를 추정해 합치지 않습니다.
3. 수량 0은 실제 0 응답에서만 저장하고, 조회 실패·미확인은 NULL 수량으로 따로 표현합니다.
4. 확인된 양수 재고는 공급원 권한과 유효기간이 확인되고 15분 이내 관측일 때만 현재 재고로 조회합니다.
5. 재고 이력은 덮어쓰지 않고 관측 사건으로 기록합니다. 사업자별 식별과 출처를 유지합니다.
6. 인증키는 브라우저나 GitHub Pages의 정적 파일에 기록하지 않습니다.

## 2단계 전제조건

별도 DB 서버(PostgreSQL 또는 기존 Firebase 인프라)와 안전한 수집 서버를 배포해야 합니다. 판매처의 실제 상품코드와 매장코드 및 데이터 접근 권한이 확인되면 인가된 소스의 응답만 매핑·저장하고, 기존 10km 카드 레이더에서 최신 결과를 읽는 방식으로 확장합니다.

**현재는 스키마·기준 데이터·검증 코드 단계이며, 대형마트 실시간 자동 재고 조회 완료 상태가 아닙니다.**
