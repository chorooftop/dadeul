# dadeul — 다들 모노레포

다들(지역 기반 실시간 투표 위젯) 서비스의 모노레포. TOM 명세(`specs/`)가 단일 진실 공급원이고, 네이티브 앱과 Node API가 이를 공유한다.

## 모노레포 구조

- `specs/` — TOM 명세 (atoms + specs) **+ `specs/openapi.yaml`** (API 계약의 단일 진실)
- `apps/api/` — Fastify + PostgreSQL 백엔드 (`@dadeul/api`, npm workspace)
- `apps/ios/` — Swift + WidgetKit _(not created yet)_
- `apps/android/` — Kotlin + Glance _(not created yet)_
- `tools/tom/` — TOM CLI
- CI는 경로 필터로 분리: `validate.yml`(specs/tools), `api.yml`(apps/api + openapi)

```bash
npm run dev:api      # API 개발 서버
npm run test:api     # API 테스트 (vitest)
npm run test:tom     # TOM CLI 회귀 테스트
```

- API 변경 흐름: `specs/openapi.yaml` 먼저 수정 → 해당 action atom 갱신 → 구현. 하위호환 원칙: 필드 삭제·의미 변경 금지, 추가만 (구버전 앱이 계속 살아있다).
- 서버 정책 상수(`TALLY_WINDOW_HOURS` 등, `apps/api/src/config.ts`)의 기본값은 rule atom의 확정 정책과 일치해야 한다.

## 핵심 원칙

1. **spec-first change control** — 제품 정책·API 동작·테스트 기준은 코드보다 먼저 여기에 기록한다.
2. **코드 실측 우선** — atom/spec에 "신설/변경"을 쓰기 전에 코드베이스에서 현재 동작을 확인한다. 코드가 아직 없는 영역은 이 저장소가 유일한 진실이며, 결정 근거를 본문에 남긴다. 코드가 생긴 뒤 문서와 다르면 코드가 진실이고, 차이는 명세에 교정 기록을 남긴다.
3. **참조 그래프 무결성** — 문서를 예쁘게 만드는 곳이 아니라 참조 그래프를 무결하게 유지하는 곳이다.

## 확정된 제품 정책 (2026-08-19)

| 정책 | 결정 | 상세 atom |
|---|---|---|
| 지역 단위 | 시군구, GPS 자동 매핑 | `term-region-code` |
| 집계 방식 | 슬라이딩 윈도우 2시간 | `rule-sliding-window-tally` |
| 재투표 | 윈도우 내 재투표 = 기존 표 갱신 (크레딧 미지급) | `rule-revote-replace` |
| 크레딧 | 날씨 투표 1회 = 1크레딧, 무기한, 일일 적립 상한 3 | `rule-credit-grant`, `entity-credit-wallet` |
| 주제 생성 | 운영자 큐레이션 (유저 생성 없음) | `entity-topic` |
| 인증 | 익명 기기 계정 (가입 없음), 재설치 시 플랫폼 복원 | `entity-device-account` |
| 날씨 선택지 | 6종 풀 + 월 기반 자동 가변 (서버 큐레이션 없음) | `term-weather-option` |
| 최소 표본 | 5표 미만 시 비율 숨김 + 참여 유도 | `rule-min-sample-display` |
| 위젯 갱신 | 30분 주기 + 내 지역 1위 변경 시에만 silent push | `spec-weather-vote-widget` |
| 오픈 지역 | 전국 오픈 + 밀도 UX (지역 차단 없음) | `spec-weather-vote-widget` |

정책 변경은 위 표가 아니라 해당 atom을 고치고, 이 표는 요약 동기화만 한다.

## TOM 모델 요약

- **Atom** (Layer 1, `specs/atoms/`): 재사용 가능한 최소 어휘. 4타입 — `term`(상태값·enum), `entity`(도메인 객체), `rule`(정책·불변식), `action`(API·행위).
- **Spec** (Layer 2, `specs/specs/`): atom을 조합한 기능 명세.
- 의존 방향은 항상 **Spec → Atom 단방향**. atom은 spec을 참조할 수 없다.
- 상세 규격·타입별 필수 섹션·stage 모델·Agent Protocol은 **`specs/atoms/MANIFEST.md`를 먼저 읽는다** (atom/spec 작성·수정 전 필독).

## 작업 흐름

```bash
# 현황 파악 (문서를 뒤지지 말고 CLI로)
npm run tom stats
cd specs && ../tools/tom/bin/tom list --type rule
../tools/tom/bin/tom walk <id> --refs        # 영향 범위 추적
../tools/tom/bin/tom show <id>

# 생성·수정
../tools/tom/bin/tom create <type> <name> --filename <한국어파일명>
# frontmatter의 refs만 편집한다. used_by는 절대 손대지 않는다.
../tools/tom/bin/tom validate --fix          # 수정 후 필수 — used_by 자동 동기화
../tools/tom/bin/tom validate --body         # 섹션 완성도 검사
../tools/tom/bin/tom promote <id> [--dry-run]

# CLI 회귀 테스트 (tools/tom 수정 시)
npm run test:tom
```

- 새 atom은 stage 1(이름+description)로 시작한다. description은 "이게 없으면 무엇이 깨지는가"에 답해야 한다.
- 정책 변경 시: 해당 atom 수정 → `tom walk <id> --used-by`로 영향받는 spec 확인 → spec 갱신.
- 기능 착수 시: spec부터 작성하고, 부족한 atom은 그때 만든다 (atom 선완비 금지).

## 범위 제한

- 제품 atom/spec 변경과 framework(tools/tom)/docs/hooks 변경을 한 커밋에 섞지 않는다.
- 사용자가 요청하지 않은 레거시 이관, CLI 수정, CI 수정, dependency 추가를 하지 않는다.
- **불확실한 제품 정책은 임의로 결정하지 않는다** — 오픈 퀘스천으로 남기거나 사용자에게 확인한다.
- `used_by`를 수동 편집하지 않는다 (다음 `--fix`가 덮어쓴다).
- `specs/atoms/MANIFEST.md`를 수동 편집하지 않는다 — `tools/tom/lib/manifest.mjs` 수정 후 `tom init --force`로 재생성한다.
- `references/`는 명세가 아니다 — 근거 자료로만 읽는다.

## 코드 레포 연결

- 코드가 존재하는 action atom에는 **구현 앵커** 표(route/service/client/test 경로)를 기록한다. 경로를 추측하지 않는다 — 확인 못 했으면 `not linked yet`.
- 코드 레포에서 계약·정책이 바뀌면 이 저장소의 해당 atom을 같은 작업 단위로 갱신한다.
- 위젯(WidgetKit/Glance)에 노출되는 데이터의 갱신 트리거·주기 제약은 spec에 명시한다 — iOS 위젯은 실시간 갱신이 불가능하다는 플랫폼 제약을 전제로 설계한다.
