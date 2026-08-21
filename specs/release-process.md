# 배포 절차 (release process)

> 이 문서는 다들 모노레포의 계획·커밋·브랜치·PR 규칙의 단일 기준이다.
> 사람과 AI 에이전트 모두 이 문서를 따른다. 규칙 변경은 이 문서 수정으로만 한다.
> (2026-08-19 제정)

## 0. 계획 우선 (PLAN)

**기능 작업은 계획서부터 시작한다.** 루트의 `PLAN/` 폴더에 계획서를 먼저 쓰고, 그 계획서를 기준으로 구현을 진행한다.

- 파일: `PLAN/<YYYY-MM-DD>-<기능-슬러그>.md` (예: `PLAN/2026-08-20-openapi-codegen.md`)
- **계획서 본문은 한글로 쓴다.** 코드 식별자·기술 용어는 원문 유지.
- **`PLAN/`은 gitignore 대상** — 커밋되지 않는 로컬 작업 문서다. 따라서:
  - 계획서에서 확정된 **제품 정책·설계 결정은 작업 중 반드시 specs(atom/spec)로 옮긴다**. PLAN에만 남은 결정은 유실된 결정이다.
  - PR의 "왜(Why)" 섹션이 계획서의 요지를 담아야 한다 — 리뷰어는 PLAN을 볼 수 없다.
- 계획서 형식 (섹션 고정):

```markdown
# <기능명>

## 목표
이 작업이 끝나면 무엇이 가능해지는가 (1~3문장)

## 범위
- 포함: 이번에 하는 것
- 제외: 의도적으로 안 하는 것과 이유

## 관련 명세
읽어야 할 atom/spec id, openapi 섹션. 명세에 없는 결정이 필요하면 여기서 질문으로 정리

## 작업 단계
- [ ] 단계별 체크리스트 (커밋 단위와 대응되게 쪼갠다)

## 완료 기준
검증 가능한 조건 (테스트 N건, CI 그린, 특정 시나리오 동작 등)

## 리스크 / 미결
위험 요소, 사용자 확인이 필요한 결정
```

- 작은 수정(오타, 단순 버그픽스, 설정 변경)은 계획서 생략 가능. **커밋 2개 이상이 예상되는 기능 작업은 계획서 필수.**
- 작업 완료 후 계획서는 삭제하거나 보관해도 된다 (git 밖이므로 자유). 남길 가치가 있는 내용은 specs나 PR 본문으로 옮긴 뒤에.

## 1. 커밋 단위

**하나의 커밋 = 하나의 논리적 변경.** 다음 기준으로 쪼갠다:

- **영역이 다르면 쪼갠다**: 제품 명세(specs) / API 구현(apps/api) / 앱 구현(apps/ios·android) / CI·도구(.github, tools)는 별개 커밋. 특히 atom/spec 변경과 framework(tools/tom)·hooks 변경은 한 커밋에 섞지 않는다 (CLAUDE.md 범위 제한과 동일).
- **의도가 다르면 쪼갠다**: 기능 추가(feat)와 그 과정에서 발견한 버그 수정(fix), 정리(refactor)는 별개 커밋. "하는 김에" 변경 금지.
- **되돌릴 단위로 쪼갠다**: 커밋 하나를 revert했을 때 빌드·테스트가 깨지지 않아야 한다. spec 변경과 그 구현이 분리 불가능하게 얽혀 있으면(계약 변경 등) 한 커밋으로 묶는 게 옳다.
- 메시지는 conventional commits: `<type>: <설명>` — `feat` `fix` `refactor` `docs` `test` `chore` `perf` `ci`. 본문에는 "왜"를 쓴다.
- **커밋 메시지는 한글로 쓴다.** type 접두사(`feat:` 등)만 영문 컨벤션을 따르고, 설명과 본문은 한글. 코드 식별자·기술 용어는 원문 유지.

## 2. 브랜치 전략

```
develop  ← 모든 작업은 여기에 먼저 push (CI 자동 실행)
   │
   └─ PR ─→ main  ← 배포 기준 브랜치. 직접 push 금지, PR 머지로만 갱신
```

1. 작업 커밋은 **develop에 먼저 push**한다. push 시 CI(validate·api)가 자동 실행된다.
2. develop의 CI가 그린인 상태에서만 main으로의 PR을 생성한다.
3. **main 머지는 반드시 PR로만** 한다. PR의 CI 통과 확인 후 머지한다.
4. 머지 후 develop을 main과 동기화한다 (`git merge main` 또는 fast-forward).

## 3. PR 작성 규칙

**핵심 원칙: PR은 사람이 읽는 문서다.** 리뷰어가 코드를 열기 전에 PR 본문만으로 "무엇을, 왜, 어떻게 검증했는지"를 파악할 수 있어야 한다. 모든 PR은 아래 형식을 따른다 — `.github/PULL_REQUEST_TEMPLATE.md`가 이 형식을 자동 제공하므로 섹션을 임의로 빼지 않는다.

### PR 제목

커밋과 같은 conventional 형식: `<type>: <핵심 변경 한 줄>` (예: `feat: 레이트 리미팅 추가`)

### PR 본문 형식

```markdown
## 무엇을 (What)

이 PR이 하는 일을 1~3문장으로. 기능이라면 사용자 관점에서,
수정이라면 "무엇이 어떻게 잘못되어 있었고 이제 어떻게 되는지"로 쓴다.

## 왜 (Why)

이 변경이 필요한 배경·근거. 관련 명세(atom/spec id), 리뷰 발견 사항,
사용자 결정 등 출처를 링크나 경로로 명시한다.

## 변경 내용 (Changes)

커밋 단위 또는 영역 단위의 목록. 각 항목은 "어디를 + 어떻게"가 드러나게 쓴다.

- **[specs]** rule-credit-grant 지급 조건 교정 — 신선한 신호 기준으로
- **[api]** castVote 트랜잭션에 계정 행 잠금 추가 (`apps/api/src/services/votes.ts`)
- **[ci]** develop push 트리거 추가

## 명세 영향 (Spec Impact)

해당 없으면 "없음"이라고 명시한다 (빈칸 금지).

- 변경된 atom/spec: `rule-credit-grant` (교정 기록 포함)
- openapi.yaml 변경: 있음/없음 — 있으면 하위호환 여부 명시 (필드 추가만인지)
- 새로 생긴 오픈 퀘스천: 있으면 나열

## 검증 (Verification)

실제로 실행해 확인한 것만 쓴다. 숫자를 명시한다.

- [ ] `npm run test:api` — N건 통과
- [ ] `npm run typecheck --workspace @dadeul/api`
- [ ] `tom validate` / `tom validate --body` — error 0
- [ ] CI (validate·api) 그린
- 추가/변경된 테스트: 무엇을 검증하는 테스트인지 한 줄씩

## 리뷰 포인트 (Review Focus)

리뷰어가 시간을 써야 할 곳 1~3개. "전부 봐주세요"는 리뷰 포인트가 아니다.
판단이 갈릴 수 있었던 결정, 자신 없는 부분, 트레이드오프를 솔직하게 쓴다.

## 남은 일 (Follow-ups)

이 PR에서 의도적으로 하지 않은 것과 그 이유. 후속 이슈나 오픈 퀘스천 링크.
없으면 "없음".
```

### 작성 시 지켜야 할 것

- **모든 섹션을 채운다.** 해당 없는 섹션은 지우지 말고 "없음"이라고 쓴다 — "없음"과 "빠뜨림"을 구분하기 위해서다.
- **경로·id·숫자는 구체적으로.** "테스트 추가함" ✗ → "레이트 리밋 429 회귀 테스트 2건 추가 (총 24건)" ✓
- **커밋 메시지 복붙으로 끝내지 않는다.** PR 본문은 커밋들을 관통하는 이야기를 쓰는 곳이다.
- **AI 에이전트가 PR을 만들 때도 동일한 형식을 따른다.** 형식이 다른 PR은 리뷰 전에 본문부터 고친다.

## 4. 머지 후

- 배포가 수반되는 머지면 CI 결과와 배포 상태를 확인한 뒤 종료한다.
- 명세에 영향이 있었다면 관련 atom의 구현 앵커·stage를 점검한다.

## 5. API 배포 (Google Cloud Run)

> 2026-08-22 제정. **이 섹션만 보고 다음 배포를 재현할 수 있어야 한다.**
> CI 자동 배포는 아직 없다 — 아래는 전부 수동 절차다.

### 5.1 배포 대상과 좌표

| 항목 | 값 | 이유 |
|---|---|---|
| 플랫폼 | Google Cloud Run | 고정비 없음. 월 200만 요청·180,000 vCPU-초가 영구 무료 |
| 리전 | `asia-northeast1` (도쿄) | Tier 1이라 무료 티어가 적용된다. 서울(`asia-northeast3`)은 **Tier 2라 무료 티어 밖** |
| DB | Supabase Postgres, `ap-northeast-1`(도쿄) | Cloud Run과 같은 리전. 리전이 갈리면 feed의 DB 왕복 6회에 150~200ms가 그냥 얹힌다 |
| DB 연결 | **Supavisor Transaction mode (포트 6543)** | 오토스케일·스케일투제로라 커넥션이 transient하다. IPv4 |
| 도메인 | `*.run.app` 기본 도메인 | `api.dadeul.app`은 미확보. 계약(`openapi.yaml`)의 진실은 실제 배포 도메인이다 |

### 5.2 사전 준비 (최초 1회)

1. GCP 프로젝트 생성 + 결제 계정 연결 (무료 티어에도 카드 등록이 필요하다)
2. Artifact Registry 저장소를 **`asia-northeast1`에** 생성.
   저장은 0.5GB까지 무료이므로 **cleanup 정책(최근 N개 유지)을 만들 때 같이 건다**
3. Secret Manager에 `DATABASE_URL`, `KAKAO_REST_API_KEY` 등록.
   Cloud Run 서비스 계정에 Secret Accessor 권한 부여
4. Supabase 프로젝트 생성 후 **Connection string(6543 포트)** 확보 → Secret Manager로만 전달.
   채팅·이슈·커밋에 붙여넣지 않는다

### 5.3 배포 절차

```bash
REGION=asia-northeast1
IMAGE="$REGION-docker.pkg.dev/$PROJECT/dadeul/api:$(git rev-parse --short HEAD)"

# 1) 이미지 빌드 — 빌드 컨텍스트는 저장소 루트다 (npm workspace lockfile이 루트에 있다)
docker build -f apps/api/Dockerfile -t "$IMAGE" .
docker push "$IMAGE"

# 2) 마이그레이션 — 서비스와 같은 이미지로 Cloud Run Job에서 1회 실행한다.
#    앱 부팅 시 자동 실행하지 않는다: 인스턴스가 여러 개면 같은 마이그레이션을 동시에 적용하려 경합한다.
#    실행 이미지에는 tsx도 src도 없으므로 npm run migrate(tsx)가 아니라 컴파일된 진입점을 쓴다.
gcloud run jobs deploy dadeul-migrate \
  --image "$IMAGE" --region "$REGION" \
  --command node --args dist/db/migrate.js \
  --set-secrets DATABASE_URL=DATABASE_URL:latest
gcloud run jobs execute dadeul-migrate --region "$REGION" --wait

# 3) 서비스 배포
gcloud run deploy dadeul-api \
  --image "$IMAGE" --region "$REGION" \
  --memory 512Mi --cpu 1 \
  --concurrency 20 --min-instances 0 --max-instances 5 \
  --cpu-boost --allow-unauthenticated \
  --set-env-vars TRUST_PROXY=1 \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,KAKAO_REST_API_KEY=KAKAO_REST_API_KEY:latest
```

배포 파라미터의 근거:

- `--concurrency 20` + `--max-instances 5` + `DB_POOL_MAX=5`(기본값) → **최대 커넥션 25**로 상한이 계산 가능해진다. feed는 요청당 DB 왕복이 6회다
- `--min-instances 0` — 무료 유지의 핵심. 콜드스타트를 감수한다.
  위젯은 네트워크를 안 타므로(App Group 스냅샷 단독 렌더) 노출 지점은 앱 포그라운드 첫 피드 로드뿐이다
- `--max-instances 5` — 레이트리밋이 인스턴스 로컬 메모리라 실효 상한이 인스턴스 수만큼 곱해진다.
  인스턴스 수를 묶어 상한을 예측 가능하게 만든다 (공유 스토어는 필요해지면 붙인다)
- `TRUST_PROXY=1` — **아래 5.4 참조. 값을 바꾸기 전에 반드시 실측한다**

### 5.4 배포 후 확인 (스모크)

```bash
URL=$(gcloud run services describe dadeul-api --region "$REGION" --format='value(status.url)')
curl -sf "$URL/health"          # 200, 정책 상수
curl -sf "$URL/health?deep=1"   # 200 + db:"ok" — DB 도달 확인
curl -sf "$URL/v1/regions" | jq '.regions | length'   # 256 (전국 시군구 시드)
# bootstrap → resolve(삼성동 좌표) → feed 순으로 실측
```

- **`TRUST_PROXY` 홉 수 실측** — `LOG_CLIENT_IP=true`로 한 번 배포해 로그의
  `xForwardedFor`/`resolvedIp`를 보고 홉 수를 확정한 뒤, 그 값으로 고쳐 배포하고
  `LOG_CLIENT_IP`는 다시 끈다.
  `TRUST_PROXY=true`로 열어두면 클라이언트가 헤더를 위조해 레이트리밋을 우회한다
- **회귀 검사(필수)**: 서로 다른 두 회선에서 bootstrap을 6회씩 호출해 **각각 독립적으로 카운트**되는지 확인한다.
  프록시 뒤에서 `request.ip`가 GFE 주소로 굳으면 전 사용자가 레이트리밋 키 하나를 공유해
  신규 온보딩이 전역으로 막힌다. 로컬·CI에서는 절대 재현되지 않는다
- **콜드스타트 실측**: 15분 이상 방치해 인스턴스를 내린 뒤 첫 요청 TTFB를 5회 측정해 기록한다.
  이 수치가 `--min-instances=1`(월 $10 안팎) 또는 다른 플랫폼 재검토 여부를 가르는 유일한 근거다

### 5.5 롤백

```bash
gcloud run services update-traffic dadeul-api --region "$REGION" --to-revisions=<이전_리비전>=100
```

Cloud Run은 리비전이 남으므로 재빌드 없이 즉시 되돌릴 수 있다.
**단 마이그레이션은 롤백되지 않는다** → 그래서 아래 제약이 따라온다.

### 5.6 배포 제약 (어기면 배포가 깨진다)

- **파괴적 마이그레이션 금지.** 컬럼·테이블 삭제, 타입 축소, NOT NULL 추가는
  구 리비전으로 롤백하는 순간 서비스가 죽는다. 삭제는 "새 코드 배포 → 안정화 확인 → 다음 릴리즈에서 삭제" 2단계로 나눈다
- **이미 적용된 마이그레이션 파일을 수정하지 않는다.** drizzle이 해시로 검증한다. 항상 새 파일을 추가한다
- **드리즐 `.prepare()`를 쓰지 않는다.** Supavisor transaction mode(6543)가 prepared statement를 지원하지 않는다.
  (2026-08-22 기준 코드베이스에 사용처 없음 — 이 상태를 유지한다)
- **시크릿은 Secret Manager에만 둔다.** 무료 한도가 활성 버전 6개라, 회전할 때마다 **구 버전을 파기**한다
- **부팅 경로에서 DB를 건드리지 않는다.** 스케일투제로 환경에서는 콜드스타트마다 반복 비용이 된다.
  시드는 마이그레이션으로 넣는다

### 5.7 Supabase 일시정지 방지

Supabase Free는 **7일 무활동 시 프로젝트를 일시정지**한다. Cloud Run은 유휴 15분이면 인스턴스를
내리므로 서비스가 떠 있다고 DB가 깨어 있는 게 아니다. TestFlight 심사 대기처럼 트래픽 공백이
생기는 구간에서 실제로 걸린다.

- Cloud Scheduler(무료 티어 job 3개)로 **하루 1회 `GET /health?deep=1`** 을 호출한다
- Cloud Scheduler가 멈추거나 GCP 프로젝트가 정지되면 같이 무력화된다 — 런칭 전까지는 프로젝트 상태를 주기적으로 눈으로 확인한다
- **Free 플랜에는 백업이 없다.** 첫 실사용자가 붙는 날이 Pro($25/월) 전환을 판단하는 날이다
