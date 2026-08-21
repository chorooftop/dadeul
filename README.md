# dadeul

다들(dadeul) 서비스 모노레포. **TOM(Topological Object Manifest)** 명세(`specs/`)가
단일 진실 공급원이고, 네이티브 앱(iOS Swift / Android Kotlin)과 Fastify API가 이를 공유한다.

**다들**: 투표로 결정된 "지금"을 폰 홈화면 위젯에 노출하는 지역 기반 실시간 투표 서비스.
첫 킬러 유스케이스는 시군구 단위 날씨 투표("지금 강남은 비 온다 73%")이며, 날씨 투표 참여로
크레딧을 얻어 다른 큐레이션 주제에 투표한다.

설계 기준 문서: TOM 명세 시스템 설계 플레이북 (`references/` 참조)

## 구조

```
dadeul/
├── apps/
│   ├── api/                # Fastify + PostgreSQL 백엔드 (@dadeul/api, npm workspace)
│   ├── ios/                # Swift + WidgetKit (미생성)
│   └── android/            # Kotlin + Glance (미생성)
├── specs/
│   ├── tom.yaml            # store/spec 경로 선언
│   ├── openapi.yaml        # API 계약 단일 진실 (action atom 기반, 코드젠 소스)
│   ├── atoms/              # Layer 1: 프로젝트 어휘 (재사용 최소 단위)
│   │   ├── entity/         # 도메인 객체 (주제, 투표, 지역, 크레딧지갑 …)
│   │   ├── action/         # 시스템 행위 = API 명세 (vote-cast, tally-feed …)
│   │   ├── rule/           # 정책·불변식 (슬라이딩윈도우-집계, 재투표-갱신 …)
│   │   └── term/           # 상태값·enum·에러 코드 (날씨선택지, 지역코드 …)
│   └── specs/              # Layer 2: 기능 명세 (atom 조합)
├── references/             # 리서치·분석 자료 (명세 아님, 읽기 전용)
├── tools/tom/              # TOM CLI (의존성 0, node --test 회귀 테스트)
└── .github/workflows/      # 경로 필터 CI: validate(specs) / api(apps/api)
```

## 개발

```bash
npm install                 # 워크스페이스 전체 설치
npm run dev:api             # apps/api/.env가 있으면 자동 로드 (기본 :3000)
npm run test:api            # API 테스트 (vitest)
npm run build:api           # API 빌드
```

API를 처음 실행할 때는 예시 파일을 복사하고 `apps/api/.env`를 채운다.

```bash
cp apps/api/.env.example apps/api/.env
```

| 환경변수 | 필수 여부 | 기본값 | 용도 |
|---|---|---|---|
| `DATABASE_URL` | 필수 | 없음 | PostgreSQL 접속 URL. 빈 값으로는 API가 시작되지 않으므로 실제 접속 URL을 설정한다 |
| `KAKAO_REST_API_KEY` | 선택 | 없음 | 카카오 로컬 API의 서버용 REST API 키. 없으면 지역 판별만 사용할 수 없다 |
| `NODE_ENV` | 선택 | `development` | 실행 환경 |
| `PORT` | 선택 | `3000` | API 수신 포트 |
| `TALLY_WINDOW_HOURS` | 선택 | `2` | 집계 슬라이딩 윈도우(시간) |
| `MIN_SAMPLE_THRESHOLD` | 선택 | `5` | 비율을 공개할 최소 표본 수 |
| `DAILY_CREDIT_CAP` | 선택 | `3` | 일일 크레딧 적립 상한 |
| `RATE_LIMIT_GLOBAL_PER_MIN` | 선택 | `120` | 계정/IP별 전역 분당 요청 상한 |
| `RATE_LIMIT_BOOTSTRAP_PER_MIN` | 선택 | `5` | IP별 부트스트랩 분당 요청 상한 |
| `RATE_LIMIT_RESOLVE_PER_MIN` | 선택 | `10` | 계정별 지역 판별 분당 요청 상한 |

`POST /v1/regions/resolve`가 `INTERNAL_ERROR`와 함께 503을 반환하면 먼저 서버 시작 로그와
`KAKAO_REST_API_KEY` 설정을 확인한다. 키가 설정되어 있다면 카카오 앱 관리의 **[쿼터]** 에서
소진 여부를 확인한다. 카카오가 키를 거부한 경우(401/403)에는 API가 502를 반환하므로 REST API
키와 카카오맵 API 활성화 상태를 확인한다. 다들 API 자체의 호출 상한 초과는 이와 별개로
`RATE_LIMITED` 429를 반환한다. REST API 키는 iOS/Android 앱에 포함하거나 커밋하지 않는다.

## CLI 사용

```bash
npm run test:tom            # 회귀 테스트
npm run tom stats           # 저장소 건강 지표 (레포 루트에서 실행 가능)

cd specs
../tools/tom/bin/tom create term weather-option
../tools/tom/bin/tom validate --fix        # used_by 자동 동기화
../tools/tom/bin/tom validate --body       # 섹션 완성도 검사
../tools/tom/bin/tom walk spec-<name> --refs
../tools/tom/bin/tom promote <id> --dry-run
```

## 규약 요약

- ID는 영어 kebab-case (`action-vote-cast`), 파일명·본문은 한국어.
- 작성자는 frontmatter의 `refs`만 편집한다. `used_by`는 `tom validate --fix`가 자동 동기화한다.
- atom은 spec을 참조할 수 없다 (의존 방향: Spec → Atom 단방향).
- 모든 atom은 `Rationale`로 시작하고, action/rule은 `DO NOT` 섹션을 필수로 갖는다.
- 새 atom은 stage 1(이름 + description만)로 시작해 승격 게이트를 거쳐 stage 3을 목표로 한다.

## 셋업 진행 상태

- [x] 저장소 생성 + 디렉터리 골격 (sappeun-specs 구조 이식, 2026-08-19)
- [x] `tools/tom` CLI — sappeun-specs에서 이식 (의존성 0)
- [x] 씨앗 어휘 + 첫 spec — `spec-weather-vote-widget` (오픈 퀘스천 6개 해소, stage 3 atom 5개)
- [x] 모노레포 전환 + `specs/openapi.yaml` API 계약 초안 (2026-08-19)
- [x] `apps/api` Fastify 스캐폴드 — config(zod)/health/vitest, 경로 필터 CI
- [ ] apps/api 도메인 구현 (DB 스키마 + 라우트) 후 action atom에 구현 앵커 연결
- [ ] specs/openapi.yaml 기반 코드젠 파이프라인 (ts/swift/kotlin)
- [ ] apps/ios, apps/android 프로젝트 생성
