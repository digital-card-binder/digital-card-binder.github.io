# 디지털 카드 바인더 14~16차 안정화 (2026-10-27)

기준: GitHub main에서 파생한 `stabilization/v14-v16-mobile-performance-qa-20261027` 브랜치. 기존 테마 전수조사를 **다시 수행하지 않음**.

## 14차 모바일 사용성

- 개인 도감에서 목록 → 상세로 이동할 때만 히스토리 항목을 추가하고, 기존 history.state 필드를 보존함.
- Android 뒤로 가기/브라우저 뒤로 가기로 목록과 이전 스크롤 위치 복구.
- 앞으로 가기로 상세 화면을 다시 표시하며 중복 history push 방지.
- 테스트: `tests/stabilization-14-mobile-history.test.mjs`.

## 15차 성능

- 포켓몬 통합 검색은 60장 단위 UI를 유지하면서 마지막 렌더링에 사용한 정렬·필터링 결과를 재사용.
- 더보기 반복 시 20,000장 전체 필터·정렬 재실행을 제거하고 카드 60장만 추가.
- 검색어, 시리즈, 보유 필터 등이 바뀐 경우 기존 결과를 추가하지 않고 다시 계산.
- 계정·Firestore 데이터 스키마 또는 보유 상태 기록을 변경하지 않음.
- 테스트: `tests/stabilization-15-search-cache.test.mjs`.

## 16차 운영 안정성

- PWA 푸시 알림의 URL을 동일 오리진으로 제한. 외부 링크, 위험한 스킴, 잘못된 URL은 사이트 새소식으로 이동.
- 내부 새소식 주소와 앵커는 보존.
- 전체 `npm run site:prepare`, `npm test`, Firebase 에뮬레이터 규칙 검증 이후에만 동적 자산 버전 참조를 브랜치에 동기화.
- 생성 과정에서 카드 데이터(`data/`, `db/`), 보유정보 권한(`firestore.rules`), 카드레이더 백엔드, Android 프로젝트, APK 변경 발견 시 자동 실패.
- 테스트: `tests/stabilization-16-push-qa.test.mjs`.

## 미수행·수동 확인 항목

CI는 갤럭시 실제 앱의 위치 권한, 카메라 업로드, Google 로그인, PDF 출력, 실제 푸시 알림 수신 여부를 증명하지 못함. 배포 후 실기기에서 확인해야 함. 새 APK는 만들지 않으며 기존 설치 앱을 제거·초기화하지 않음.

## 안전성

마스터 카드 DB/이미지, 보유·미보유 기록, 테마 감사 체크포인트, 백업·복원 형식, 회원 계정, Firebase 규칙을 수정하지 않음. PR 전체 검증이 통과할 때만 main 병합.

## 자동 검증 실행 기록

- 14차 모바일 이동 개선: [GitHub Verify 성공](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40473910305).
- 15차 검색 성능 개선: [GitHub Verify 성공](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40474204316).
- 16차 알림 안전성 및 통합 QA: [GitHub Verify 성공](https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/40474670232).
- 16차 브랜치의 검증 후 자동 생성 커밋은 정적 자산 경로/해시를 맞추는 변경만 포함하며 카드 마스터·FireStore 규칙·APK에는 변경 없음.
- 외부 Vercel의 빌드 횟수 제한은 별도 배포 프로젝트 문제이며, 이 GitHub Pages 정적 사이트의 QA 성공으로 대체 증명하지 않음.
