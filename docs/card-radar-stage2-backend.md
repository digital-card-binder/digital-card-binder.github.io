# 카드 레이더 2단계: 독립 재고 서버·판매처 매핑

작성일 2026-10-19

## 정확한 현재 상태

- 독립 서버 소스 코드: radar-service/ 구현 완료. GitHub Pages와 별도.
- DB: Cloud Firestore named database `card-radar` 전용 설계. **아직 프로비저닝 확인되지 않았음**. 기존 기본 `(default)` 데이터베이스에는 접근하지 않도록 강제.
- 서버 배포: 별도의 Vercel 프로젝트 생성/배포 미완료. 연동된 Vercel 프로젝트 접근 시 팀 권한 403 발생. 저장소의 코드는 배포 가능한 형태로 준비.
- 상품코드/점포코드: 진위 확인된 매핑 0건. 원본 자료 없이 기존 팩 세트 코드 `m2` 등을 외부 SKU로 사용하지 않음.
- 현재 승인된 재고 공급원: 0건. 실제 대형마트 실시간 재고가 연결되었다고 주장할 수 없음.
- 기존 Github Pages 카드 레이더, 편의점 API 호출 및 기존 사용자 Firebase 수집 기록은 수정하지 않음.

## 구현 내용

### 서버

- `api/v1/health`: 전용 Firestore `card-radar` 연결·시드 상태 반환. 연결 실패 시 503.
- `api/v1/stores?lat=37.57&lng=126.98&radiusKm=3&limit=100&kind=all&retailer=all&onlyInStock=0`: 검증된 점포를 반경 10km 이내에서 거리순 반환.
- 0.1도 격자별 질의, 제한된 4개 동시 요청, 30초 서버 메모리 캐시. 초밀집 구역에서 최대 반환량을 넘으면 `coverageLimited=true` 표시.
- 최신 15분 이내에 확인되고 계약 사용권이 승인된 상품만 재고 결과로 반환.
- `onlyInStock=1`은 실제 확인된 양수 재고가 있는 점포만 반환. 재고가 없는 게 아니라 조회하지 못한 매장은 `unknown`.
- CORS는 `https://digital-card-binder.github.io`만 허용. 인증 및 공급자 비밀값은 브라우저로 전송하지 않음.

### 초기 적재

`radar-service/scripts/seed-master.mjs`: 1단계 파일의 판매처 10개·세트 151개·상품 개념 2개·검증 위치 1개만 DB에 등록. 기존 재고 관측은 삭제하거나 0으로 덮어쓰지 않음.

`import-mappings.mjs`: 공식·실측 증빙 URL, 검토일, 실제 판매처 점포코드 및 SKU를 확인 후에만 수동 반영.

`import-observations.mjs`: 승인된 공급원 + 올바른 점포 및 상품코드 매핑 + 15분 신선도 + 0 이상의 실제 정수 수량이 함께 확인되면 서버 전용 트랜잭션으로 불변 기록을 적재. 미확인·응답 실패는 0으로 기록하지 않음.

### 비용 및 권한 의사결정

기존 Firebase 프로젝트 `pokemon-dex-40e92`에 named database `card-radar`를 만들려면 프로젝트 IAM `datastore.databases.create` 권한과 데이터베이스 비용 확인이 필요합니다. Firestore 무료 사용량은 프로젝트 내 특정 1개 DB에만 적용되므로 **별도 DB에 과금이 발생할 수 있습니다.** 고객 동의 없이 자동으로 추가 DB를 개설하는 워크플로를 추가하지 않았습니다.

공식 절차: https://firebase.google.com/docs/firestore/manage-databases

권한 있는 사용자가 비용 확인 후 Firebase Console에서 Firestore Database > Add database > Standard > Database ID `card-radar` > 프로젝트와 적합한 리전 > production mode를 선택하거나 공식 CLI에서 해당 이름으로 생성합니다.

**중요:** 데이터베이스 리전은 생성 후 변경이 어렵습니다. 기존 Firestore 리전과 비용/지연을 확인하여 결정합니다.

### 연결 및 배포(권한 복구 후)

1. Firebase IAM에서 재고 백엔드 전용 서비스 계정의 database 접근 권한만 설정(최소 권한). 기존 도감 읽기·쓰기 권한은 주지 않음.
2. Vercel 팀/저장소 연결 권한 확인: 현재 연결된 팀 접근 403 오류. 재로그인/권한 부여 후 프로젝트 rootDirectory를 `radar-service`로 지정해 독립 프로젝트 생성.
3. Vercel에 `GOOGLE_CLOUD_PROJECT=pokemon-dex-40e92`, `RADAR_FIRESTORE_DATABASE=card-radar`, 암호화된 `RADAR_SERVICE_ACCOUNT_JSON` 또는 지원되는 워크로드 ID를 설정. 서비스 계정 JSON은 GitHub에 커밋하지 않음.
4. `cd radar-service && npm install && RADAR_ENABLE_INITIAL_SEED=yes npm run db:seed`를 관리자 환경에서 한 번 실행. 먼저 인증/DB 이름과 프로젝트 확인.
5. `npm run db:check`로 생성 건수 확인, `GET /api/v1/health` 200 검증. 실제 재고가 없는 현재는 stores의 items가 빈 배열이어야 정상.
6. 재고 원본 데이터의 법적 사용권 확보 후 스토어 코드·상품코드에 대해 증빙 검토, 매핑 등록 및 별도 공급원 승인. 입력은 개인정보/인증비밀 없는 서버 측 승인 파일로만.
7. 실제 API 및 수량 응답 실측을 확인한 다음에만 기존 `card-radar.js`의 프로덕션 재고 공급원으로 단계적 연결. 미준비 서버 때문에 기존 레이더에 오류가 발생하지 않도록 UI 전환은 별도 검증 후 실행.

## 참조 구현의 사용 범위

- https://github.com/hmmhmmhm/daiso-mcp — CU, GS25, 세븐일레븐, 이마트24 예시, 롯데마트 과거 코드 참고
- 롯데마트 비공식 운영 API는 과거 구현이 있다고 해도 현재 지원 종료이며 재고 복제/재배포 허가는 확인되지 않음.
- 공급자의 API 호출 횟수, 상품코드 매핑 증빙, 확인 시각, 데이터 라이선스를 먼저 확보해야 운영 재고가 생김.

## 명령어

- 프로젝트 루트: `npm run radar:stage2:test`
- 독립 서비스 폴더: `npm install`, `npm run db:seed`, `npm run db:check`
- 허가된 매핑 검토 후: `RADAR_ALLOW_MAPPING_IMPORT=yes node scripts/import-mappings.mjs /secure/location/verified.json`
- 공급원 승인·인가 확인 후: `RADAR_ALLOW_STOCK_IMPORT=yes RADAR_APPROVED_SOURCE_IDS=... node scripts/import-observations.mjs /secure/location/feed.json`

다시 강조하지만 **이 단계에서 DB 개설·실제 서버 배포·재고 숫자 적재가 자동 완료됐다는 의미는 아닙니다.**
