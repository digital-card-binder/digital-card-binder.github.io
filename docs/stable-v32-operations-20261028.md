# 디지털 카드 바인더 — 32차 안정판 운영 기준 (2026-10-28)

## 1. 운영 전환 결정

- 사이트: https://digital-card-binder.github.io/
- 정식 서비스 코드: `main`.
- **검증된 복원 참조:** `stable/v32-20261028` (커밋 `d7010660c1bb1b25f95870784555f1f49a293129`).
- 이 브랜치는 v29~32차 기능/화면/성능 QA가 성공한 코드의 **고정 비교 기준**으로 생성했다. GitHub 브랜치 자체의 쓰기 보호가 별도로 설정됐다고 가정하지 말 것. 운영 중 임의로 이동하거나 직접 수정하지 말 것.
- 여기서 말하는 '32차'는 사용자 요청에 따른 개발 차수이며 Android APK나 웹사이트의 `versionName=32`을 의미하지 않는다.
- 새 기능 개발은 보류하고, 실제 오류 수정 / 공식 신규 한국판 카드 갱신 / 안전성 유지보수만 진행한다. 별도의 신규 대규모 전수검수는 자동 재개하지 않는다.

## 2. 검증된 안정판 근거

| 항목 | 최종 확인 및 증빙 |
| --- | --- |
| PR | [29~32차 수정·검증 및 main 병합](https://github.com/digital-card-binder/digital-card-binder.github.io/pull/307) |
| 32차 커밋 | `d7010660c1bb1b25f95870784555f1f49a293129` |
| 전체 UI·데이터·Firebase 규칙 테스트 | [GitHub Verify 성공](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40610290051) |
| PC·모바일 32개 조합 브라우저 레이아웃 검사 | [가로 넘침 실패 0건, 화면 캡처 아티팩트](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40609587209) |
| 정적 자산 버전 동기화 | [GitHub Actions 성공](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40610289965) |
| GitHub Pages 배포 | [Pages 배포 성공](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40610287826) |

자동 검증은 갤럭시 실물 사진 인식과 실제 Google 계정 영구 저장을 직접 수행하지 않는다. 해당 항목은 소유자의 2026-10-28 실사용 확인을 보조 증거로 삼고, 코드를 변경할 때는 필요한 계정별 QA를 다시 한다.

## 3. 운영 중 정기 점검

**매일** — 기존 `.github/workflows/watch-official-card-updates.yml` 자동 감시를 그대로 사용한다. 크론이 실행되더라도 공식 사이트 응답·파싱 실패 시 성공으로 간주하지 않는다. 이 워크플로는 카드 이름만 감지하며 실제 개별 카드 DB와 이미지는 자동 편집하지 않는다.

**매주 또는 사용자 문제가 보고될 때** — 사용자 계정에서 홈·카드 검색·시리즈/테마/나만의도감·보유 후 재접속을 확인한다. 운영자 전용 `health.html`의 카탈로그 불일치·누락 이미지·공개/비공개 설정 경고를 확인한다. 이상이 없으면 아무것도 변경하지 않는다.

**중요 변경 전** — 기존 `operations.html`의 사용자 백업 기능과 Firestore 변경 범위를 확인한다. **저장소 브랜치만으로 사용자 Firestore 데이터를 복원할 수는 없다.** 복원은 유효성 검사된 사용자의 별도 백업과 승인된 절차를 따른다.

## 4. 신규 한국판 상품 반영 절차

1. `data/update-watch.json`과 기존 공식 자동 감시 성공 기록에서 후보 제품을 확인한다. 감시 결과가 `attention`이라고 해서 미발매·신규 수록을 단정하지 않는다.
2. 한국 포켓몬 공식 상품 페이지·카드 검색에서 실제 한국 발매, 공식 세트 코드, 확장팩/박스 구성, 개별 카드 번호와 이미지를 확인한다. 가능하면 국내 이미지로 보존하고 오인식/다른 언어판/잘못된 번호를 제외한다.
3. `data/series.json`, `data/series-legacy.json`, 프로모·팩/마스터 도감의 기존 제품명·별칭·카드 키를 대조한다. 단순 이름 차이로 같은 카드를 중복 생성하지 않는다.
4. 근거가 충분한 추가/수정만 별도 기능 브랜치·PR에서 수행한다. 대량 작업은 중간 검수 기록을 저장하고, 미확정 개별 카드는 '보류'로 둔다. 완료된 XY/SM/기타 테마도감 결과를 의도 없이 재검수하지 않는다.
5. `npm run site:prepare`로 필요한 생성물(시리즈 재고, 마스터 무결성, 검색 인덱스, 지표, 공유 셸, 캐시 버전)을 동기화하고, `npm test` 전체 통과 및 소유권·이미지 검사를 실시한다.
6. PR diff에서 `firestore.rules`, `data/audits/`, 사용자 데이터 경로, Android APK가 불필요하게 바뀌지 않았는지 확인한다. `main` 병합 후 Verify와 Pages 배포 성공을 확인하고 운영 기록을 갱신한다.

**현재 별도 처리해야 할 감시 기록:** `data/update-watch.json`에 남은 `닌자스피너`, `어비스아이`. 해당 파일의 `lastChangedAt`은 **2026-09-24**이므로 이 날짜를 신규 출시일로 해석하지 않는다. 2026-10-28 기존 워처가 [공식 상품 6종 확인·변경 없음](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40610280651)으로 성공한 사실만 검증됐다. 제품별 카드 확인·기존 DB 별칭 여부는 [운영 검토 이슈 #308](https://github.com/digital-card-binder/digital-card-binder.github.io/issues/308)에서 처리한다.

## 5. 오류 수정·롤백

- 실제 사용자 문제 재현 → 원인 경로와 영향을 받는 카드/사용자 범위 확인 → 테스트 추가 → 수정 PR → `npm test` → main 병합 → Pages 확인.
- 신규 변경으로 문제가 생기면 `stable/v32-20261028`과 현재 main의 diff를 분석하여 해당 변경만 revert하는 PR을 생성한다. 안정판 브랜치로 `main`을 무조건 강제 이동하거나 Firestore 문서·보유/미보유 기록을 덮어쓰지 않는다.
- 장애 시 `issues`에 화면, 재현 방법, 기대값/실제값, 브라우저·기기, 콘솔 오류를 기록한다. 개인정보·로그인 토큰·회원 UID를 공개 이슈에 넣지 않는다.
- 정적 HTML/CSS 변경 시 캐시 버전은 자동 생성하므로 `?v=...`를 손으로 갱신하지 않는다.
- 과거 '1~32차' 기능을 재개발하거나 새 서명키로 Android APK를 재빌드하지 않는다.

## 6. 보호 원칙

- 기존 회원의 개인도감·보유 기록·사진·공개 설정과 Firebase 계정을 **절대 임의 초기화·삭제하지 않는다**.
- 테마도감의 검수 상태와 `data/audits/` 기록을 안전한 기준으로 보존한다.
- 새 공식 제품 검토와 상관없는 UI/UX 기능 확장, 새로운 자동화 또는 불필요한 API 유료화는 운영 단계에서 추가하지 않는다.
- GitHub `stable/v32-20261028`은 안정판 소스 코드 스냅샷이지 데이터 백업의 대체재가 아니다.
