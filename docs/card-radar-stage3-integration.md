# 카드 레이더 3단계 — 실제 독립 DB 매장 지도 연결·판매처 코드 검토

기준: 2026-10-19 / GitHub 저장소 `digital-card-binder/digital-card-binder.github.io`

## 이번 배포의 실제 기능

1. **검증된 자체 Firebase 매장을 카드 레이더 지도·리스트에 통합.** 기존 Leaflet/OpenStreetMap 매장 후보와 같은 위치·유형인 경우 중복 노출 방지. DB의 매장 수가 1개뿐이므로 현재 이마트 속초점 1곳을 자체 DB를 통해 조회할 수 있음.
2. 브라우저는 서버의 GET `https://digital-card-radar-api.vercel.app/api/v1/stores?lat=...&lng=...&radiusKm=...`를 조회. 서버의 독립 Spark Firebase `digital-card-radar-db`에만 접근. 기존 도감의 Firestore `pokemon-dex-40e92` 데이터 변경하지 않음.
3. 자체 DB가 일시 중단되더라도 기존 공개 OSM·편의점 검색 결과는 유지하고, 사용자에게 **DB 일시 조회 불가**를 안내. 1건의 API 요청을 검색 진행률에 별도 포함하되, 성공/실패 판매처 재고 건수와 혼동하지 않음.
4. 제품의 **실제 승인된 최신 재고 관측**만 별도 검증 후 지도에 표시. DB에서 매장 위치가 확인되더라도 수량이 없으면 `미확인`이며, 0으로 간주하거나 재고 있는 매장으로 표시하지 않음.
5. 카드 레이더 결과에 자체 DB 등록매장 조회 수를 별도 표시. 전국 매장 재고가 모두 수집됐다는 인상을 주지 않음.
6. `/api/v1/coverage`는 마스터 데이터, 점포 코드, 제품 SKU 코드, 관측 이력, 공급원 **각각의 등록 개수**를 보여줌. `historicalObservationCount`는 '지금 재고 있음'과 다른 지표.
7. `radar-service/lib/retailer-review.mjs`와 `radar-service/scripts/review-retailer-candidates.mjs`는 외부 공개 원시 응답을 **오프라인에서 후보로 정규화**하여 수동 검토 큐로 생성. CU `itemCode`, GS25 `itemCode`, 세븐일레븐 `itemCd`, 이마트24 `pluCd` 타입 구분. 교통카드, 이즐, T머니, 빵, 증정품, 팬시 등은 제외. 절대로 이 단계에서 승인된 실제 재고로 등록하지 않음.

## 공개 코드 조사 및 연동 제한

- https://github.com/hmmhmmhm/daiso-mcp : 편의점 재고 조회 REST API와 소스 코드가 공개되어 있음. CU, GS25, 세븐일레븐, 이마트24를 다루고 있음. 공개 서버는 요청 제한·응답 지연·인증 방식 변경 위험이 있음.
- https://github.com/hmmhmmhm/daiso-mcp/blob/main/docs/ai-instruction.md : GS25는 우선 상품을 조회하여 `itemCode`를 얻어야 하고, 이마트24는 상품 검색 후 `pluCd`로 재고를 확인해야 한다고 설명함.
- https://github.com/hmmhmmhm/daiso-mcp/blob/main/docs/gs25-final-replay-methodology.md : 과거 무인증 예시가 현재 유효하지 않다고 경고하며, 2026년 10월에는 세션 갱신이 필요함.
- 롯데마트는 이전 공개 분석 코드에 있었으나 사용 가능하고 재배포 허가된 실시간 재고 API는 확인되지 않음. 이마트, 홈플러스, 트레이더스, 코스트코, 하나로마트도 동일하게 사용 권한이 검증된 점포별 재고 공급원이 아직 없음.

**중요: 코드 공개와 점포별 수량 데이터를 제3자 사이트가 재배포할 수 있는 권한은 다름.** 타사 세션, 쿠키, 리플레이 인증을 개발서버에 무단 등록하지 않음. 기존 프런트엔드에서 쓰는 공개 커뮤니티 API 응답도 마스터 DB에 자동으로 복제·영구 저장하지 않음.

## 판매처 코드 검토 로컬 예시

업체가 허용한 자료 또는 합법적으로 확보한 원시 JSON을 다운로드한 다음, 로컬에서만 실행:

```bash
cd radar-service
node scripts/review-retailer-candidates.mjs cu products /secure/approved-cu-catalog.json > /secure/cu-candidates.json
node scripts/review-retailer-candidates.mjs gs25 products /secure/approved-gs25-catalog.json > /secure/gs25-candidates.json
node scripts/review-retailer-candidates.mjs seveneleven products /secure/approved-seven-catalog.json > /secure/seven-candidates.json
node scripts/review-retailer-candidates.mjs emart24 products /secure/approved-emart24-catalog.json > /secure/emart24-candidates.json
node scripts/review-retailer-candidates.mjs cu stores /secure/approved-cu-stores.json > /secure/cu-store-candidates.json
```

**이 결과 파일은 검토용 후보**이고, `verified=false`, `automaticallyImportable=false`로 표시됨. 재고 숫자는 포함하지 않음. 이름이 같다는 이유로 기존 카드팩 ID에 연결하거나, 매장 좌표만 같다고 매핑을 확정하지 않음.

검토 후에만 `scripts/import-mappings.mjs`의 증거 URL·검토일·외부 상품/점포코드 요건을 만족하는 자료를 별도 승인하고, 라이선스·매장 코드·상품 코드·정확한 관측 수량까지 검증된 후 `scripts/import-observations.mjs`로 입력.

## 자동 테스트

```bash
npm run radar:stage3:test
npm run test:architecture
```

**제약:** 3단계 연동 1차판은 '독립 DB 매장 검색+코드 검토 절차' 완료이지, '전국 대형마트 실시간 재고 API 연동 완료'가 아님. 자체 DB 기존 1개 매장의 수량은 여전히 미확인임.
