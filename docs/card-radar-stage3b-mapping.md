# 카드 레이더 3단계 B — 편의점 구분, 증거 기반 상품·매장 코드 연결

2026-10-19. 소스: `digital-card-binder/digital-card-binder.github.io`

## 사용자 기능

- 카드 레이더에서 **편의점** 선택 시 CU / GS25 / 세븐일레븐 / 이마트24 / 기타 편의점 필터 표시.
- 마트 브랜드 필터와 동일하게 **목록과 지도**에 동시 적용하며, 선택하지 않은 편의점은 표시하지 않음.
- CU 등 특정 편의점 브랜드를 선택하고 새로 탐색하면 해당 브랜드의 공개 재고 API만 조회하여 불필요한 호출을 줄임. (예: GS25 선택 시 5개 키워드 요청, 전체 기본 20개 요청.)
- CU 상품 API에서 지점명에 `CU` 접두사가 없어도, CU 매장 출처 ID를 유지하여 필터에 표시.
- 자체 DB + 공개지도 검색은 기존처럼 유지. 브랜드별 필터는 **재고 연결 범위가 확장됐다는 뜻이 아님**. 브랜드 선택만 바꾸면 기존 결과가 필터링되며, 새 브랜드에 대한 최신 수량을 확인하려면 ‘이 지역 매장 탐색’을 다시 실행해야 함.
- 결과 집계에서 자체 DB 매장만 발견됐을 때도 주변 매장 수를 `—`가 아닌 실제 수치로 표시하도록 수정.

## 독립 DB 연결을 위해 준비된 검토 절차

1. 편의점별 상품 검색 응답에서 상품 식별 후보를 추출. **CU, GS25, 세븐일레븐, 이마트24의 필드 형태를 구분**한다.
2. 추출한 후보는 `review_required`이며, 임시 검색어·오픈소스 저장소 URL만으로 검증 완료되지 않음. `discoveryUrl`(발견 위치)과 `primaryEvidenceUrl`(1차 근거)을 구분.
3. 매핑 수입시 `retailerProductName`이 실제 포켓몬 TCG 팩·덱·박스에 해당하는지 확인. 교통카드·빵·문구용품 등은 거절하고, 알려진 시리즈명이 실제 `setId`와 불일치하면 거절.
4. 판매처 지점코드 연결은 `providerStoreName`, `providerLatitude`, `providerLongitude`, 개별 매장 근거 URL을 요구. 이미 등록된 자체 DB 좌표와 약 160m 넘게 차이가 나면 잘못된 코드로 간주.
5. 근거 링크는 `https` 전용이며, 오픈소스 **프로젝트 첫 화면**, 공개 대리 API, 단순 홈페이지는 개별 상품/매장 코드의 증거가 아님.
6. `RADAR_ALLOW_MAPPING_IMPORT=yes`로 관리자가 별도 명시 승인한 경우에만 기존 import CLI를 사용. 재고 수량은 기록하지 않음.
7. 실제 수량의 신규 기록은 별도 `RADAR_ALLOW_STOCK_IMPORT=yes`와 출처·상품코드·매장코드·관측시각·법적 재배포 허가를 모두 확인한 공급원에만 허용.

### 증거 기반 매핑 자료 예시 (형식만, 가상 데이터)

```json
{
  "schemaVersion": 1,
  "reviewed": true,
  "storeAliases": [
    {
      "retailerId": "emart",
      "providerStoreId": "EXAMPLE-STORE",
      "storeId": "emart-sokcho-1049",
      "providerStoreName": "이마트 속초점",
      "providerLatitude": 38.1910179,
      "providerLongitude": 128.5957863,
      "evidenceUrl": "https://eapp.emart.com/branch/view.do?id=1049",
      "reviewedAt": "2026-10-19T08:00:00Z"
    }
  ],
  "retailerSkus": []
}
```

예시 `EXAMPLE-STORE`는 **실제 지점코드가 아님**. 검증되지 않은 값을 그대로 배포하거나 수입하지 말 것. 해당 구체 근거가 제시되더라도 `permissionStatus: approved`인 실제 수량 공급원이 없으면 재고 조회는 `미확인`이다.

### 사용 가능한 참고 구현

- https://github.com/hmmhmmhm/daiso-mcp
- https://github.com/hmmhmmhm/daiso-mcp/blob/main/docs/ai-instruction.md

공개 소스코드를 사용할 수 있다는 사실은 원래 편의점 데이터를 **재배포할 법적 권한**을 자동으로 부여하지 않음. GS25 상품코드(`itemCode`)와 이마트24 PLU(`pluCd`)를 확보하더라도 제품 동일성·실시간 재고 출처 승인이 추가 필요.

### 검수

```bash
npm run radar:stage3b:test
npm test
```

**주의:** 이 변경으로 지도 필터와 자체 DB 매핑 준비는 강화되지만 대형마트나 편의점의 공식 실시간 재고 연동이 새로 확보된 것은 아니다.
