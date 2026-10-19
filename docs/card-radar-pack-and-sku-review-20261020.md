# 카드레이더 — 9종 카드팩 탐색 및 상품·매장코드 검토

검증 기준: 2026-10-20, 디지털 카드 바인더 GitHub `main`.

## 이번 단계

- ‘전체 카드팩’ 조회 대상은 기존 **주요 검색어 5개(제품명 4개 + 범용 검색어 1개)**에서 **사이트 선택 목록에 등록된 9개 카드팩 이름**으로 확장한다. 판매처마다 같은 상품명을 쓰지 않을 수 있으므로 **9개 요청이 곧 9종의 실제 재고를 전부 확인했다는 의미는 아니다**.
- 각 판매처는 전송 전에 순환 배치하며, **재고 미지원·429·연속 5xx**가 확인되면 이후 동일 판매처 쿼리를 건너뛴다. 건너뛴 쿼리는 성공/실패 HTTP 호출 수에 산입하지 않는다.
- 범용 키워드만으로 교통카드·굿즈·다른 카드팩을 잘못 선택하는 일을 줄인다. 새 상품코드나 재고 수량을 생성하지 않는다.

## 상품코드·점포코드 검토 파이프라인

`radar-service/lib/public-sku-candidates.mjs`에서 CU, GS25, 세븐일레븐, 이마트24 **공개 제3자 응답**의 상품코드와 매장코드를 분리한다.

- 상품 후보: `retailerId`, `retailerItemCode`, `productName`, `suggestedSetId`, `identityStatus:review_required`.
- 점포 후보: `retailerId`, `providerStoreId`, `name`, `lat/lng`, `identityStatus:review_required`.
- 실제 재고 응답에 상품코드가 없으면 **빈 후보**로 남긴다. 이름만으로 판매처 SKU를 만들어 내지 않는다.
- 후보의 모든 `primaryEvidenceUrl`은 `null`, `automaticallyImportable`은 `false`. 공개 집계 서비스를 사용한다고 판매처의 재배포 승인이 확인되는 것은 아니다.
- 실제 공급원 사용 허가, 판매처별 SKU·점포코드의 개별 1차 근거, 법적 재배포 권한을 확인하기 전에는 독립 Firebase DB의 검증 완료 매핑이나 수량으로 승격할 수 없다.

## 관측 및 후속 진행

`Card Radar Live Smoke (read-only)` GitHub Actions를 실행하면 **낮은 빈도의 공개 응답 점검** 후 보존 기간 7일의 아티팩트 2개를 생성한다.

- `card-radar-live-smoke.json`: 응답 상태/정상 매장 수/CORS 등 진단, 원재고 수량 미기록
- `card-radar-sku-review-candidates.json`: 확인 대기 중인 상품·지점 후보만 기록

실제 공식 재고 수준으로 완료하려면 **원본 판매처의 승인된 재고 데이터 피드**가 필요하다. 판매처 공식 앱과 수량을 비교할 때는 `scripts/card-radar-compare-stock.mjs`으로 동일 `retailerId + providerStoreId + retailerItemCode`의 15분 이내 관측 기록만 비교한다. 유효 표본이 없으면 일치율은 미확인이다.

정확한 수량이 공개되지 않거나 서버가 오류를 반환한 매장은 **재고 0개로 추정하지 않는다**.
