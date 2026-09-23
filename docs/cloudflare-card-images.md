# Cloudflare Pages 카드 이미지 이전

## 보장 조건

- `card-image-cdn.js`의 `active` 기본값은 `false`다. 두 이미지 프로젝트의 전체 배포와 검증이 끝나기 전에는 운영 사이트의 이미지 주소가 바뀌지 않는다.
- 원본 다운로드는 단일 프로세스로만 실행한다. 요청 시작 간격은 최소 2초이고, 같은 대상 파일은 다시 받지 않는다.
- 400, 401, 403, 404, 410, 415 응답은 같은 주소에 재시도하지 않고 누락 보고서에 남긴다. 연속 8개 자산에서 일시 오류가 발생하면 작업을 중단한다. 최종 누락 검증은 계속 엄격하게 적용한다.
- 보이는 워터마크를 포함한 원본 픽셀을 유지한다. 워터마크 제거 처리는 하지 않는다.
- 전환 뒤 지원되는 카드 이미지 주소는 Cloudflare Pages 정적 파일 주소로 바뀐다. 포켓몬코리아 카드 상세페이지 링크도 사용자 화면에 노출하지 않는다.

## 무료 한도 설계

이미지는 파일 수 한도를 넘지 않도록 두 개의 순수 정적 Pages 프로젝트로 나눈다.

| 프로젝트 | 기본 이름 | 이미지 | 메타 파일 포함 |
|---|---|---:|---:|
| modern | `dcb-card-images-modern-2026` | 8,278 | 8,281 |
| legacy | `dcb-card-images-legacy-2026` | 8,384 | 8,387 |

두 프로젝트 모두 Free 플랜의 프로젝트당 20,000개 파일 제한보다 작다. 각 파일은 25 MiB 이하인지 배포 전에 검사한다. Functions, Workers, R2, Cloudflare Images는 사용하지 않는다.

실제 수치는 `npm run images:manifest`로 다시 계산되며, 데이터가 바뀌어 한도를 넘으면 검증 단계에서 배포가 실패한다.

## 배포 순서

1. GitHub Actions의 `Deploy card images to Cloudflare Pages`에서 `batch_size=600`으로 실행한다.
2. SV → M(MEGA) → S → 나머지 순으로 저장하고, 배치마다 누적 캐시와 실패 보고서를 보관한다.
3. 모든 단계가 끝나면 누락 파일을 한 번 더 복구한다. modern과 legacy 전체 파일을 각각 검증하고, WebP 파일을 실제로 디코딩한다. 누락·손상·대체 문구 이미지는 최종 배포를 막는다.
4. 두 전체 아카이브를 배포한 후 대표 이미지 URL 두 개를 내려받아 확인한다.
5. 운영 전환은 별도 작업이다. 이 워크플로는 `card-image-cdn.js`를 활성화하지 않는다.

## 중단된 실행 복구

- GitHub Actions에서 **Run workflow → repair_only=true**로 실행하면 29개 원본 배치를 건너뛰고 두 누적 캐시를 복원해 누락 파일만 받는다.
- `.github/card-image-deploy-request.json`을 새 요청 ID로 변경해 main에 반영해도 같은 복구 모드로 실행된다.
- 다운로드 코드나 복구 주소가 바뀌어도 기존 `card-images-v2` 캐시를 복구한다. 새 캐시 키에는 실행 attempt가 포함된다.
- 어느 프로젝트든 600개를 초과해 누락되면 캐시 복구 이상으로 간주하고 대량 재다운로드를 중단한다. 원인을 확인한 후 전체 배치 모드를 선택한다.
- `scripts/card-image-source-repairs.json`은 원래 공개 경로를 유지하면서 검증한 원본 주소를 우선한다. 동일 카드가 이미 저장되어 있으면 파일을 복사한다. 기존 수집 데이터나 보유 기록은 수정하지 않는다.
- 한국어 이름만으로 이미지 언어를 판단하지 않는다. 대체 원본의 한글 표기와 실제 카드 번호를 확인하고, 원본 워터마크를 유지한다.
- `card-image-recovery-<run>-<attempt>` 아티팩트에 프로젝트별 전체 누락 목록, 다운로드 실패 사유, 디코딩 검사 결과가 저장된다. 복구 일부가 실패해도 성공한 파일은 캐시에 남는다.

로컬에서 같은 복구 단계를 실행하려면 기존 아카이브를 `tmp/card-images/build/{modern,legacy}`에 먼저 복원한다.

```sh
node scripts/build-card-image-manifest.mjs
python scripts/download_card_images.py --project modern --missing-only --max-missing 600 --min-delay 2 --allow-failures
python scripts/download_card_images.py --project legacy --missing-only --max-missing 600 --min-delay 2 --allow-failures
node scripts/validate-card-image-build.mjs --project=modern
node scripts/validate-card-image-build.mjs --project=legacy
python scripts/verify_card_image_archive.py
```

전체 이전 중에는 각 고유 원본 파일을 한 번 받아야 하므로 제한된 일회성 요청이 발생한다. 전환 완료 뒤 일반 방문자의 지원 대상 카드 이미지 요청은 Cloudflare Pages로만 간다.

## 한 번 필요한 계정 설정

Cloudflare에서 해당 계정에만 적용되는 `Cloudflare Pages: Edit` API 토큰을 만든다. 토큰과 Account ID는 공개 저장소나 대화창에 붙여 넣지 않고 GitHub 저장소의 Actions repository secrets에 다음 이름으로 직접 저장한다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

워크플로는 Pages 프로젝트 조회·생성·업로드만 수행하며 삭제 명령은 포함하지 않는다.

## 되돌리기

문제가 생기면 `card-image-cdn.js`의 `active`를 `false`로 되돌리면 기존 이미지 주소를 다시 사용한다. 전환 커밋 전에는 운영 사이트 동작에 변화가 없다.

## 2026-09-23 복구 보류 항목

실행 `35700074440`의 29개 배치 보고서 전체를 합치면 현대 이미지 48개, 구형 이미지 113개, 총 161개 경로가 실패했다. 159개(현대 47개·구형 112개)의 검증된 복구 주소를 추가했다. 현대 검증이 먼저 중단되어 구형 누락은 첫 오류에 표시되지 않았다.

- `MEGA/M1L/M1L_093`: 메가브레이브 한글판 수록 목록은 092/063까지이고 092는 이미 있다. 093 항목은 카탈로그 정정이 필요하다. 수집 키에 배열 인덱스가 포함되므로 이 복구에서는 항목을 삭제하거나 순서를 바꾸지 않는다.
- `BW/FS/bw1_fs_g_en_1`: BW 퍼스트 세트 기본 풀 에너지의 공식 원본이 사라졌다. Dogam도 해당 이미지가 없으며, 다른 판본이나 영어판 이미지로 대신하지 않는다. 해당 한글판 카드의 정확한 원본이나 스캔이 필요하다.

두 경로는 전체 이미지 검증에 그대로 포함한다. 이 문제가 해결되지 않으면 복구한 파일을 캐시에 저장한 뒤 배포를 중단한다. 누락을 허용하거나 임시 이미지를 넣어 성공으로 처리하지 않는다.

전국도감 #250의 존재하지 않는 `SM3plus_112` 주소에는 시리즈 도감에 이미 있는 한글판 칠색조 GX `112/SM-P`를 대표 이미지로 연결한다. 전국도감 #430의 `SLL_003`은 동일 번호 돈크로우가 실제 수록된 `SLD` 원본을 사용한다. 수집 데이터와 보유 기록은 바꾸지 않는다.
