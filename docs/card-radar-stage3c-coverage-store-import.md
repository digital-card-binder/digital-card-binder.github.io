# 카드 레이더 3단계 C — 판매처별 연결 현황 및 검증 매장 등록

## 추가된 기능 (2026-10-19)

- 카드 레이더 결과 상단에 **판매처별 재고 연동 현황** 접이식 패널. 사용자 요청이 있을 때만 독립 서버 `GET /api/v1/coverage` 조회.
- 서버는 별도 Firebase 프로젝트 `digital-card-radar-db`의 **실제 마스터 및 연결된 데이터소스 등록 개수**를 반환. 승인된 소스 개수는 `radarSources.permissionStatus=="approved"`인 문서만 센다. 판매처의 `adapterState:public_rest`는 수량 제공·재배포 승인과 별개다.
- `CU, GS25, 세븐일레븐, 이마트24, 이마트, 트레이더스, 롯데마트, 홈플러스, 코스트코, 하나로마트` 10종의 자체 DB 등록/재고 사용 권한 상태를 표시.
- DB 오류 시 숫자 0을 임의로 보여주지 않고 “현재 연결 현황 조회 불가”로 표시한다.
- 모든 신규 매장 위치는 **서버 전용 등록 스크립트**로 검증·선택적 등록할 수 있다. 초기 상태는 DRY RUN이며 쓰기 방지.

## 검증 매장 등록 절차

`radar-service/scripts/import-verified-stores.mjs`는 각 판매처의 허가된 정보 또는 수작업 교차검증으로 확정된 매장에 대해서만 사용한다.

스키마:

```json
{
  "schemaVersion": 1,
  "reviewed": true,
  "reviewer": "<internal-reviewer-alias>",
  "reviewedAt": "2026-10-19T08:30:00Z",
  "stores": [
    {
      "storeId": "emart-example-1234",
      "retailerId": "emart",
      "name": "실제 확인된 매장명을 입력",
      "kind": "mart",
      "lat": 37.0,
      "lng": 127.0,
      "address": "확인된 실제 주소",
      "locationReviewed": true,
      "locationEvidenceUrl": "https://<exact-store-specific-official-url>",
      "coordinateEvidenceUrl": "https://<exact-geocoding-evidence-url>"
    }
  ]
}
```

**위 JSON은 예시 양식이며, 사실로 확인한 매장 자료가 아니므로 그대로 실행 금지.** 판매처·주소·좌표에 대한 실증이 필요. 동일 자체 DB 매장 ID가 이미 존재하면 덮어쓰지 않고 전체 요청을 거절한다.

사용 방법: 서비스 계정은 개인 개발 환경에서 안전하게 비공개 변수로 설정하고, **독립된 레이더 Firebase 프로젝트만** 연결한다. GitHub Actions 비밀에 등록하거나 이 문서에 넣지 않는다.

```bash
cd radar-service
# Dry-run. Firebase Read access required; no write is done.
node scripts/import-verified-stores.mjs /secure/reviewed-stores.json

# Only after manual evidence review and dry run succeed:
RADAR_ALLOW_STORE_IMPORT=yes RADAR_STORE_IMPORT_MODE=commit node scripts/import-verified-stores.mjs /secure/reviewed-stores.json
```

매장등록은 `radarStores`의 **위치 데이터만** 생성하며, `latestStock:[]`, `inventoryStatus:not_connected`가 된다. 수량·SKU·외부 제공 매장코드를 자동 등록하지 않는다. 실제 관측 수량은 별도로 허가된 API 소스·검증된 소매점코드·검증된 상품코드와 읽기 허가가 있어야 기록된다.

## 남은 운영상의 선행 조건

- 현재 독립 Firebase의 검증 매장은 이마트 속초점 1곳이며, 151개 세트/판매처 10종이 등록되어 있음.
- 신규 매장 추가는 **허가 또는 공식 개별 지점 URL 및 위치 검증**이 있을 때만 실제 실행. 공개 지도 또는 이름 유사만으로 검증 처리하지 않는다.
- CU·GS25·세븐일레븐·이마트24 공개 REST 구현은 기술 참고로만 사용. 데이터의 안정적인 재배포나 자체 서버 자동 적재 권한이 확인될 때까지 실제 실시간 재고 DB로 표기하지 않는다.
- 지역을 움직여 검색하는 기능은 카드 레이더에 이미 구현되어 있으며 변경 없이 유지한다.

## 검증 및 배포

```bash
npm run radar:stage3c:test
npm test
```

실제 재고 연결을 완료했다는 주장은 하지 않는다. 이 단계는 **투명한 공급원 현황 표시와 매장 등록의 검증된 확장 경로 확보**이다.
