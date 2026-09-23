# Cloudflare Pages 카드 이미지 운영

## 현재 운영 상태

카드 이미지 이전은 완료되었고 운영 사이트는 Cloudflare Pages의 정적 이미지 아카이브를 사용한다.

- `card-image-cdn.js`의 `active`는 `true`다.
- 일반 방문자의 지원 대상 카드 이미지 요청은 Cloudflare Pages로 전달된다.
- 사이트 데이터, 보유 기록, 도감 구조는 GitHub/Firebase에 그대로 유지한다.
- 이미지 원본을 새로 확보하거나 누락을 복구할 때만 관리 작업에서 원본 서버에 제한적으로 접근할 수 있다.

## 저장 구조와 현재 수치

이미지는 파일 수 한도를 피하기 위해 두 개의 정적 Pages 프로젝트로 나눈다.

| 프로젝트 | 기본 이름 | 이미지 | 메타 파일 포함 |
|---|---|---:|---:|
| modern | `dcb-card-images-modern-2026` | 8,277 | 8,280 |
| legacy | `dcb-card-images-legacy-2026` | 8,383 | 8,386 |

총 이미지 수는 16,660장이다. 두 프로젝트 모두 프로젝트당 20,000개 파일 한도보다 충분히 작고, 배포 전 각 파일이 25 MiB 이하인지 검사한다.

현재 실제 수치는 `npm run images:manifest`로 다시 계산할 수 있다. 데이터가 추가되어 파일 수 한도를 넘거나 이미지가 누락되면 검증 단계에서 배포를 중단한다.

## GitHub에 남겨야 하는 운영 파일

아래 파일은 이사 흔적이 아니라 앞으로도 필요한 운영 구성요소다.

- `card-image-cdn.js`: 사이트의 카드 이미지 주소를 Cloudflare Pages로 변환한다.
- `.github/workflows/deploy-card-images.yml`: 이미지 아카이브 복구·검증·배포를 담당한다.
- `.github/actions/download-card-image-batch/action.yml`: 대량 재구축 시 이미지를 안전한 배치 단위로 처리한다.
- `scripts/build-card-image-manifest.mjs`: 현재 도감 데이터에서 필요한 이미지 목록을 만든다.
- `scripts/card-image-routing.mjs`: 원본 주소와 Cloudflare 저장 경로의 대응 규칙이다.
- `scripts/card-image-source-repairs.json`: 사라지거나 잘못된 원본 주소의 검증된 대체 원본 규칙이다.
- `scripts/download_card_images.py`: 신규·누락 이미지를 내려받아 WebP 아카이브를 만든다.
- `scripts/validate-card-image-build.mjs`, `scripts/verify_card_image_archive.py`: 누락·손상·파일 한도를 검사한다.
- `tests/card-image-*.test.mjs`, `tests/test_card_image_recovery.py`: 이미지 운영 구조가 깨지지 않도록 자동 검증한다.

## 운영 배포

### 일반적인 누락 복구

GitHub Actions의 **Deploy card images to Cloudflare Pages**에서 `repair_only=true`로 실행하면 기존 누적 아카이브를 복원하고 누락된 이미지만 보완한 뒤 전체 검증 후 다시 배포한다.

`.github/card-image-deploy-request.json`은 채팅에서 GitHub Actions를 직접 시작할 수 없을 때 사용하는 **운영 트리거 파일**이다. 이 파일을 새 요청 ID로 변경해 main에 반영하면 복구 모드가 실행된다. 따라서 과거 요청 번호가 들어 있어도 런타임 데이터가 아니며, 단순 정리 목적으로 수정하지 않는다.

### 전체 재구축

새 시리즈 대량 추가 등으로 전체 재구축이 필요할 때만 GitHub Actions에서 `repair_only=false`로 실행한다.

처리 순서는 다음과 같다.

1. SV
2. M(MEGA)
3. S
4. 나머지 카드

기본 배치 크기는 600장이다. 각 배치는 누적 캐시를 사용하므로 중간 실패 시 처음부터 다시 받을 필요가 없다.

## 검증 원칙

배포 전 다음 조건을 모두 만족해야 한다.

- manifest의 모든 예상 이미지가 존재한다.
- WebP 파일을 실제로 디코딩할 수 있다.
- placeholder나 손상 이미지가 없다.
- modern/legacy 각각 파일 수가 Cloudflare Pages 한도 이하다.
- 대표 이미지를 실제 Pages 주소에서 다시 내려받아 열 수 있다.
- `card-image-cdn.js`의 운영 상태가 `active: true`다.

현재 기준 검증 수치는 다음과 같다.

- modern: 8,277 / missing 0
- legacy: 8,383 / missing 0
- 전체: 16,660 / failed 0

## 캐시와 Actions 아티팩트

GitHub Actions 캐시는 **삭제 대상이 아니다.** 이미지 전체를 다시 원본에서 내려받지 않고 누락분만 복구하기 위해 필요하다.

Actions의 recovery/batch 리포트 아티팩트는 문제 분석용 임시 자료이며 14일 후 자동 만료된다. 저장소의 소스 코드나 운영 데이터에는 포함되지 않는다.

## 되돌리기

Cloudflare 이미지 제공에 문제가 생기면 `card-image-cdn.js`의 `active`를 `false`로 되돌리면 기존 이미지 주소를 다시 사용한다.

전환 직전 기준점은 커밋 `4c93ee1c985250e8cd91cb0bf581d36c3e10da2c`이며, 평상시에는 이 커밋으로 전체 저장소를 되돌릴 필요 없이 CDN 활성 플래그만 변경하는 것을 우선한다.

## 계정 설정

GitHub Actions repository secrets에는 다음 두 값이 필요하다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

워크플로는 Cloudflare Pages 프로젝트 조회·생성·업로드만 수행하며 삭제 명령은 포함하지 않는다.
