# 카드레이더 — 공식 재고 비교 검증 절차 (2026-10-20)

## 실제 연동 현황

- 공식 앱에서 매장별 재고 조회가 가능하다는 사실과, 카드레이더가 공식 판매처 데이터에 직접 연동됐다는 사실은 다릅니다.
- CU / GS25 / 세븐일레븐 / 이마트24 공식 앱의 Google Play 링크를 매장 목록에 표시한다. 상품 검색 및 지점 선택은 해당 공식 앱에서 사용자가 직접 수행한다. **공식 API 인증이나 지점별 화면 바로가기(딥링크)는 아니다.**
- 현재 `data/card-radar-inventory.json`과 `data/card-radar-mart-inventory.json`은 공급원 미연결 상태다.
- 기존 독립 DB는 `radarStoreAliases` / `radarSkuMappings` / `radarSources` 및 관측치 승인 검증을 갖추었다. 이중 승인 및 공급원 권한 확인 없이 양수 재고를 생성하거나 외부 중계 결과를 공식값으로 저장하면 안 된다.
- 공개 검색 결과는 단일 지역의 특정 상품 응답일 뿐 전국 전체 매장과 SKU를 완전히 포괄하지 않는다.

## 실제 재고 수량의 일치율 검증

`scripts/card-radar-compare-stock.mjs`는 **신뢰할 수 있게 사람이 직접 확인한 공식 앱 기록**과 카드레이더 관측값을 오프라인에서 비교한다. API 비밀번호, 쿠키, 스크린샷, 사용자 GPS를 자동 수집하거나 다른 서비스의 비공개 인터페이스를 호출하지 않는다.

각 기록에는 다음이 반드시 필요하다.

- `retailerId`: 동일 판매처 (cu/gs25/seveneleven/emart24 등)
- `providerStoreId`: 공식 판매처가 사용하는 **실제 지점코드** (점포명으로 임의 추정 금지)
- `retailerItemCode`: 공식 판매처의 **실제 판매 SKU/상품코드** (검색어만으로 추정 금지)
- `quantity`: 공식 앱 또는 합법적인 관측값을 기록할 때 직접 확인한 수량 (미조회, 일시 오류는 0으로 기록 금지)
- `observedAt`: 해당 값을 확인한 시각, ISO8601 시간대 포함

오프라인 입력은 공식 앱 `{schemaVersion:1,source:"official-app-manually-verified",reviewed:true,reviewedAt:"...",items:[...]}`, 카드레이더 `{schemaVersion:1,source:"card-radar-observation",items:[...]}` 형태다.

```bash
node scripts/card-radar-compare-stock.mjs official-reviewed.json radar-observations.json
```

비교는 **판매처 + 지점코드 + 상품코드 완전 일치**일 때만 하고, 시차가 15분을 넘으면 비교 대상에서 제외한다. 미조회는 `unobserved`, 시차 초과는 `stale`로 표기하고 `0개`로 취급하지 않는다. 비교 가능한 표본 수가 없으면 일치율은 `null`이다.

### 현재 데이터 조건에서의 결과

**공식 앱의 매장×상품 수량 관측 기록이 없으므로 실재고 일치율을 산출할 수 없다.** 테스트 파일에 쓰이는 가상 수치는 개발 시나리오일 뿐 실제 판매처 재고가 아니다. 실제로 기록을 확보하기 전에는 공식 앱과 동일한 수준의 정확도를 선언하지 않는다.

## 공식 앱 경로 출처

- CU 포켓CU: https://play.google.com/store/apps/details?id=com.bgfcu.membership
- GS25 우리동네GS: https://play.google.com/store/apps/details?id=com.gsr.gs25
- 세븐일레븐: https://play.google.com/store/apps/details?id=kr.co.kork7app
- 이마트24: https://play.google.com/store/apps/details?id=kr.co.emart24.everse

판매처 데이터 자동 연동을 실제로 완성하려면 API/피드의 사용 권한, 해당 소스 상품코드·점포코드 대응표, 원본 재고 관측 시각 및 배포 허용이 필요하다.
