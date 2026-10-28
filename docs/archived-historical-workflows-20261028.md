# 완료된 작업 브랜치 전용 GitHub Actions 4개 보관 (2026-10-28)

## 실제 정리 내용

GitHub `main`에 남아 있던 **종료된 작업 브랜치 전용 워크플로 4개**를 실행 설정 디렉터리에서 제외하고, 내용은 `docs/workflow-archive/20261028/`에 원본 그대로 보존했다.

| 보관 대상 | 원래 실행 대상 | 관련 병합 기록 |
|---|---|---|
| `design-v25-v28-20261027.yml` | `design/v25-v28-bright-refresh-20261027` | [PR #306](https://github.com/digital-card-binder/digital-card-binder.github.io/pull/306) |
| `v29-v32-final-qa.yml` | `stabilization/v29-v32-final-quality-20261028` | [PR #307](https://github.com/digital-card-binder/digital-card-binder.github.io/pull/307) |
| `v29-v32-visual-qa.yml` | `stabilization/v29-v32-final-quality-20261028` | [PR #307](https://github.com/digital-card-binder/digital-card-binder.github.io/pull/307) |
| `operations-v32-inventory.yml` | `ops/backup-workflows-audit-20261028` | [PR #311](https://github.com/digital-card-binder/digital-card-binder.github.io/pull/311) |

위 4개의 기존 YAML에는 공식 출시 감시, `main` 일반 커밋 검증, 현재 Pages 배포의 **정기 운영 트리거가 없었다**. 주로 종료된 작업 브랜치 push와 수동 실행을 위해 만들어졌다.

## 규모와 한계

- `main`의 Actions 워크플로 정의: **597 → 593개**.
- 아카이브는 삭제가 아니라 **소스 파일을 완전히 보존**하여 필요 시 별도 PR로 복원 가능하다.
- 예전 작업 브랜치 자체는 삭제·강제 변경하지 않았다. **그 브랜치에 남아 있는 이전 YAML은 해당 브랜치로 push할 경우 여전히 GitHub Actions 실행 조건을 만족할 수 있다.** 이것은 모든 과거 브랜치에서의 비활성화가 아니라 현재 `main`에서의 사용하지 않는 실행 정의 정리다.
- 지난 [전체 감사 보고서](../ops-backup-workflows-audit-20261028.md)의 597개 목록은 작업 당시 스냅샷이고, 이후 이 변경으로 활성 main 정의가 4개 감소한다.
- 나머지 약 590개 워크플로는 정적 권한 정보만으로 안전하게 제거 가능하다고 입증되지 않았으므로 변경하지 않았다.
- 핵심 7개(Verify, 공식 확장팩 감시, 카드 이미지 배포, Firestore 규칙 배포, Card Radar 연동, Android APK, 버전 동기화)는 모두 보존.
- 사용자 보유 기록, 한국판 카드·이미지·테마 검수 데이터, Firebase 규칙은 변경하지 않았다.

## 향후 정리 원칙

과거 워크플로를 더 줄이려면 **해당 브랜치/PR의 완료 여부, 최근 실행 이력, 런타임 의존성, main 쓰기 권한, 실제 산출물을 확인**한 후 소규모로 보관하되, 사용자 카드 데이터 작업이 진행 중인 브랜치 또는 보류된 한국판 카드 검사 워크플로는 무단 정리하지 않는다.
