# 카드 레이더: 대형마트 재고 공급원 조사·연동 계약

기준일: 2026-10-19. **대형마트 실시간 재고가 연결됐다는 문서가 아닙니다.**

## 검증 결과

| 판매처 | 소비자 공식 조회 | 외부 자동 연동 |
| --- | --- | --- |
| 이마트 | 로그인·단골점포 설정 후 앱 상품 검색 | 외부 공개 재고 API 확인 못 함 |
| 트레이더스 | 공식 트레이더스 안내 | 점포별 실시간 재고 API 확인 못 함 |
| 롯데마트/토이저러스 | 공식 모바일 도와센터의 점포·상품 검색 | 기존 daiso-mcp 롯데마트 엔드포인트는 HTTP 410 (SERVICE_RETIRED); 외부 제휴/사용 허가 없음 |
| 홈플러스 | 공식 온라인몰(온라인/오프라인 가용성 다름) | 오프라인 매장별 공개 재고 API 미확인 |
| 코스트코 | 공식 온라인몰 | 오프라인 점포 재고 API 확인 못 함 |
| 하나로마트 | 점포 문의 필요 | 점포별 공개 재고 API 확인 못 함 |

참고 및 증거:
- https://www.shinsegaegroupnewsroom.com/emart-offline-products-app-inventory/
- https://eapp.emart.com/webapp/product/search
- https://company.lottemart.com/mobiledowa/
- https://play.google.com/store/apps/details?id=com.lottemart.lmscp
- https://github.com/hmmhmmhm/daiso-mcp/blob/main/src/api/lottemartHandlers.ts
- https://front.homeplus.co.kr/
- https://www.costco.co.kr/

공개 웹사이트에 재고가 표시되는 것과 우리 서비스에 **재배포 가능한 개발자 API**가 존재하는 것은 다릅니다. 이용 허가·인증·재배포 조건이 확인되지 않은 비공식 API를 임의로 중계하지 않습니다.

## 지금 연결된 것

1. `data/card-radar-mart-providers.json`: 판매처별 공식 소비자 조회 경로와 미연동 상태. UI에서 점포 및 상품을 직접 확인하도록 안내.
2. `data/card-radar-mart-inventory.json`: 허가된 공급자가 작성하는 정규화 재고 피드 계약. 현재 `source.status=unconnected`, `stores=[]`. **실제 재고 데이터는 없습니다.**
3. `card-radar.js`: `parseApprovedMartFeed()`는 제공자 식별, 승인 여부, 계약 참조, 제공일·만료일, 좌표, 유효 상품, 정수 수량과 15분 이내 관측 시각을 검사하여 실패 데이터를 조용히 배제합니다. 유효한 데이터만 기존 지도·재고 필터에 합류합니다.

## 공급원 활성화에 필요한 사항

- 정식 대형마트 사업자 또는 라이선스가 명확한 재고 공급자와 제휴/데이터 이용권 계약.
- 점포 식별코드와 위경도, 상품 식별코드·상품명, 판매 단위(팩/박스/덱), 재고 수량, 실제 관측 시각을 제공받을 것.
- 각 공급자의 데이터 주기, 호출 제한, API 인증 및 제공 범위를 확인할 것.
- 실사용 이전에 서버 측 인증정보 저장, 캐시/레이트리밋, 출처별 장애 감지, 데이터 이력 보관 및 위변조 방지 체계 구축할 것.
- GitHub Pages 정적 파일만으로 자동 실시간 서버 연동이 되지 않으므로, 서버 백엔드 또는 허가된 공급원의 자동 재고 파일 발행 경로가 필요.

### 승인된 공급 피드 예시 (예시이므로 실제 데이터 아님)

```json
{
  "schemaVersion": 1,
  "source": {
    "status": "connected",
    "authorized": true,
    "licenseRef": "PARTNER-CONTRACT-REFERENCE",
    "providerId": "lottemart",
    "generatedAt": "<current ISO-8601 timestamp>",
    "expiresAt": "<future ISO-8601 timestamp>"
  },
  "stores": [
    {
      "id": "partner-store-id",
      "name": "<authorized retailer name>",
      "chain": "롯데마트",
      "kind": "mart",
      "lat": 37.0,
      "lng": 127.0,
      "address": "<location>",
      "items": [{
        "code": "m2",
        "name": "포켓몬카드 인페르노X 부스터팩",
        "quantity": 3,
        "checkedAt": "<actual measurement timestamp>"
      }]
    }
  ]
}
```

위 JSON은 **형식 예시일 뿐**이며 허위 매장·수량을 사이트에 배포하면 안 됩니다. 계약 참조 필드를 임의 문자열로 채우는 것만으로 법적 사용권이 생기지 않습니다. 권한은 사전 확인해야 합니다.

### 향후 실제 API 연결 구현 순서

1. 공급자 권한 확인 및 현장 매장 2~3곳 시험 조회.
2. GitHub Pages와 별도로 인증정보를 숨기는 서버리스 읽기 전용 재고 어댑터 설치.
3. 상품 매칭의 오탐(교통카드, 빵, 굿즈)과 매장 ID 매칭 검증.
4. 정상 수량, 0, 미응답, 조회 실패, 인증 만료, 오래된 관측을 분리해 UI 반영.
5. 레이트리밋, 로그, 캐시 TTL, 재고 재배포 약관, 개인정보 및 출처 표시 점검 후 공개.

현재 상태: **고객용 공식 재고확인 이동 경로와 공급원 수신 계약 구현 완료; 대형마트 자동 재고 수집은 미연결.**
