# 명세 시스템 설계 플레이북 (TOM)

> saas-specs가 채택한 **TOM(Topological Object Manifest)** 명세 체계를 다른 서비스에 이식하기 위한 설계 문서.
> 이 문서만으로 새 저장소에 같은 구조를 세울 수 있도록 개념·규격·구현·운영·함정을 모두 담는다.
>
> 기준 저장소: `medistream-team/saas-specs` (atom 686개, spec 105개 운영 중)
> 작성일: 2026-08-15

---

## 목차

1. [무엇을 푸는 시스템인가](#1-무엇을-푸는-시스템인가)
2. [핵심 개념 모델](#2-핵심-개념-모델)
3. [데이터 규격](#3-데이터-규격)
4. [토폴로지와 검증 엔진](#4-토폴로지와-검증-엔진)
5. [저장소 레이아웃](#5-저장소-레이아웃)
6. [에이전트 인터페이스](#6-에이전트-인터페이스)
7. [코드 레포와의 연결](#7-코드-레포와의-연결)
8. [새 서비스 이식 절차](#8-새-서비스-이식-절차)
9. [서비스별 조정 지점](#9-서비스별-조정-지점)
10. [알려진 함정과 실패 모드](#10-알려진-함정과-실패-모드)
11. [도입 체크리스트](#11-도입-체크리스트)

---

## 1. 무엇을 푸는 시스템인가

### 해결 대상 문제

| 문제 | 일반적 증상 | TOM의 대응 |
|---|---|---|
| **명세 파편화** | 같은 개념이 PRD·Slack·Figma·코드 주석에 조금씩 다르게 존재 | 개념을 **atom** 하나로 단일화하고 모든 문서가 참조 |
| **용어 드리프트** | "회원"과 "사용자"와 "계정"이 같은 것인지 아무도 확신 못 함 | `term`/`entity` atom이 유일한 정의. ID로 참조 강제 |
| **영향 범위 불명** | "이 정책 바꾸면 어디가 깨지지?" 에 답할 수 없음 | `refs`/`used_by` 양방향 링크 + `tom walk`로 즉시 추적 |
| **구현 가능성 미달** | 기획서를 받았는데 에러 처리·권한·경계값이 없어 개발이 멈춤 | **Stage 게이트**가 타입별 필수 섹션을 강제 |
| **에이전트 컨텍스트 폭발** | LLM에게 명세를 주려면 수백 개 문서를 통째로 넣어야 함 | frontmatter만 스캔해 색인 → 관련 atom 본문만 선택 로드 |
| **문서-코드 괴리** | 문서는 옛날 것, 진실은 코드에만 있음 | **구현 앵커** + 코드 레포 submodule + 동기화 검증 스킬 |

### 설계 철학 한 줄

> **분해(decompose) → 타입화(typify) → 검증(validate)**

큰 기획서를 재사용 가능한 최소 어휘 단위로 쪼개고(분해), 각 단위에 책임이 명확한 타입을 부여하고(타입화), 링크 무결성과 섹션 완성도를 기계가 검사한다(검증).

### 무엇이 아닌가

- **문서 생성 도구가 아니다.** 문서를 예쁘게 만드는 게 아니라 **참조 그래프를 무결하게 유지**하는 게 목적이다.
- **이슈 트래커가 아니다.** 진행 상태(누가 언제 무엇을)는 Jira/Linear의 몫이다. TOM은 "무엇이 참인가"만 다룬다.
- **코드 생성기가 아니다.** Stage 3은 "사람이 추측 없이 구현할 수 있는 상태"이지 자동 생성 입력이 아니다.

---

## 2. 핵심 개념 모델

### 3계층 구조

```
Layer 3  Interactive Companion   HTML/CSS/JS 보조 명세 (사람의 이해·검토용, 선택)
              ↑ 보조
Layer 2  Spec                    기능 명세. atom을 조합해 완결된 기능을 정의
              ↑ 참조(refs)
Layer 1  Atom                    프로젝트 어휘. 재사용 가능한 최소 단위
```

**핵심 규칙: atom은 spec을 참조할 수 없다.** 의존 방향이 항상 Spec → Atom 단방향이라 순환이 구조적으로 차단된다. (검증 엔진이 강제)

### Atom 4타입과 책임 경계

| 타입 | 책임 | 품사 감각 | 예시 |
|---|---|---|---|
| `term` | 상태값, enum, 에러 코드, 권한 이름, 표시 vocabulary | 정의 | 주문상태, 결제수단, 권한레벨 |
| `entity` | 도메인 객체의 필드·관계·제약, request/response/mock shape | 명사 | 사용자, 주문, 상품 |
| `rule` | 여러 action에 걸치는 불변식·정책·validation | 형용사(제약) | 중복주문방지, 환불가능판정 |
| `action` | 시스템 행위. **API 명세의 네이티브 공간** | 동사 | 주문생성, 결제취소 |

**타입 분리가 주는 것**: 같은 질문을 항상 같은 곳에서 찾는다. "이 필드 타입이 뭐지?" → entity. "이 상태값 종류가 뭐지?" → term. "이거 언제 막히지?" → rule. "이 API 어떻게 동작하지?" → action.

**작성 의존 순서**: `term → entity → rule → action`
아래 타입이 위 타입을 참조하는 경향이 있으므로 이 순서로 쓰면 참조 대상이 이미 존재한다. (TOM 내부에도 `atomTypeOrder` 상수로 인코딩되어 있다)

### Action atom이 API 명세를 흡수하는 이유

API 문서를 별도 산출물(OpenAPI, 위키, Notion)로 분리하면 반드시 어휘가 갈라진다. TOM은 **action atom 안에 API 동작을 직접 기술**한다:

```
## Auth & Permissions   ← 누가 호출 가능한가
## Execution Order      ← 무엇을 어떤 순서로 하는가 (비즈니스 단계, 코드 라인 아님)
## Input / Output       ← 무엇을 받고 무엇을 주는가 (도메인 의미, 타입 시그니처 아님)
## DO NOT               ← 절대 하면 안 되는 것 (사고 방지 목록)
## Error Handling       ← 조건 → 처리 표
```

`DO NOT` 섹션이 이 설계의 숨은 핵심이다. 정상 흐름은 코드를 보면 알 수 있지만, **"왜 이렇게 하면 안 되는지"는 문서에만 남는다.** 사고 후 재발 방지 지식이 축적되는 자리다.

### Atom인가 Spec인가 — 판단 기준

아래 신호 중 **하나라도** 해당하면 spec으로 쓴다.

| 신호 | 예시 |
|---|---|
| 화면 구성(레이아웃, 컬럼 배치, 헤더)을 기술한다 | 목록 테이블 컬럼 순서 |
| 3개 이상의 atom을 조합한다 | entity + action + rule + term |
| 사용자 시나리오(정상/예외 흐름)가 필요하다 | "A 클릭 → B 화면 이동" |
| 사용자에게 보이는 문구를 정의한다 | "불러오지 못했습니다" 토스트 |
| Out of Scope 명시가 필요하다 | "모바일은 이번 범위 밖" |

**atom으로 유지**: 단일 동작·단일 제약·단일 정의로, 다른 곳에서 조합해 쓸 수 있는 단위.

이 기준이 없으면 모든 것이 spec이 되어 재사용이 사라지거나, 모든 것이 atom이 되어 기능 전체상이 사라진다.

---

## 3. 데이터 규격

### Atom frontmatter

```yaml
---
type: entity | action | rule | term      # 필수. 디렉터리명과 반드시 일치
id: <type>-<name>                        # 필수. 전역 유일
description: "한 줄 요약"                 # 필수
stage: 1 | 2 | 3 | 4 | deprecated        # 필수
refs: [<이 문서가 참조하는 atom id>]       # 필수 (빈 배열 허용)
used_by: [<이 문서를 참조하는 id>]         # 필수 (자동 동기화됨)
---
```

### Spec frontmatter

```yaml
---
id: spec-<name>                          # 필수. 'spec-' 접두사 강제
description: "한 줄 요약"                 # 필수
status: draft | in-progress | complete   # 필수
refs: [<참조 atom/spec id>]               # 필수
interactive: [...]                       # 선택 (Layer 3 아티팩트 선언)
---
```

> `used_by`가 spec에는 없다. Spec은 최상위 소비자이므로 역참조가 필요 없다.

### ID 규약 (검증 엔진이 강제)

| 대상 | 형식 | 정규식 |
|---|---|---|
| atom | `{type}-{name}` | name: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` |
| spec | `spec-{name}` | 동일 |

- 타입 접두사는 4종(`entity`/`action`/`rule`/`term`)만 허용
- `type` 필드 값과 **디렉터리명이 일치**해야 함 (`action/` 안의 파일은 `type: action`)
- ID는 atom/spec 각각 전역 유일

**파일명은 ID와 독립이다.** ID는 frontmatter에만 있고, 파일명은 사람이 훑어보기 위한 것이다. **본문이 한국어면 한국어 파일명을 권장**한다. (`atoms/action/주문생성.md` → `id: action-create-order`)

이 분리 덕분에 ID 체계를 영어 기계 친화적으로 유지하면서 파일 탐색은 모국어로 할 수 있다. Git에서 한글 파일명이 escape되어 보이는 불편은 감수 가능한 수준이다.

### 타입별 필수 섹션

섹션 헤더는 **의무 구조**다. 내용은 미룰 수 있고, 그때 `_(TBD)_`를 placeholder로 쓴다.

| 타입 | 필수 섹션 |
|---|---|
| `entity` | Rationale, Fields, Relationships, Cross Map |
| `action` | Rationale, Auth & Permissions, Execution Order, Input / Output, DO NOT, Error Handling |
| `rule` | Rationale, Applicability, Specification, DO NOT |
| `term` | Rationale, Definition, Usage Context |
| `spec` | Problem & Motivation, Scope, User Flow, Core Requirements, Scenarios, Out of Scope |

**모든 타입이 `Rationale`로 시작한다.** "이게 없으면 무엇이 깨지는가"를 먼저 쓰게 강제하는 장치다. 이걸 못 쓰면 그 atom은 존재 이유가 없다.

### Stage 모델

| Stage | 이름 | 의미 | 다음 단계 승격 조건 |
|---|---|---|---|
| 1 | Skeleton | 의도와 이름만. "이런 게 필요하다" | 모든 섹션에 본문 채우기 |
| 2 | Draft | 핵심 필드/단계가 자연어로 기술. 방향 파악 가능 | 필수 섹션이 코드 수준으로 구체화 |
| 3 | **Spec** | 실행 순서·DO NOT·I/O·에러 처리가 코드 수준 | 구현 대상 refs가 모두 스키마 충족 |
| 4 | Verified | 생성된 코드가 검증 통과. 명세-코드 동기화 | — |
| `deprecated` | Deprecated | 미사용. **토폴로지 링크는 보존** | refs/used_by 추적성 유지 |

**Stage 3이 실질적 목표선이다.** 기준 저장소는 686개 중 622개가 stage 3이다. Stage 4는 코드 검증까지 연결해야 해서 현재 0개 — **야심 있는 단계를 정의만 해두고 미달성으로 남겨두는 것도 정상**이다.

`deprecated`가 삭제가 아니라 상태인 점이 중요하다. 링크를 지우면 "왜 이게 사라졌지"를 추적할 수 없다.

### Spec status

`draft` → `in-progress` → `complete`. Stage와 별개 축이다. Atom은 **성숙도**(얼마나 구체적인가), Spec은 **진행 상태**(얼마나 진행됐나)를 표현한다.

---

## 4. 토폴로지와 검증 엔진

### 양방향 링크

```
A.refs 에 B 가 있으면  ⟺  B.used_by 에 A 가 있어야 한다
```

이 불변식이 시스템의 척추다. 단방향이면 "이걸 누가 쓰지?"에 답하려면 전체 스캔이 필요하지만, 양방향이면 O(1)이다.

**손으로 유지하면 반드시 깨지므로 `--fix`가 자동 동기화한다.** 작성자는 `refs`만 신경 쓰면 되고 `used_by`는 기계가 채운다.

### 검증 규칙 전체 목록

| 카테고리 | 규칙 |
|---|---|
| `schema` | 필수 frontmatter 필드 존재. atom은 `type/id/description/stage/refs/used_by`, spec은 `id/description/status/refs` |
| `schema` | `stage`가 `1\|2\|3\|4\|deprecated` 중 하나 |
| `schema` | `status`가 `draft\|in-progress\|complete` 중 하나 |
| `id_uniqueness` | atom/spec ID 전역 중복 없음 (중복 시 두 파일 경로 모두 출력) |
| `id_convention` | ID 형식 준수 + `type` 필드와 디렉터리명 일치 |
| `ref_consistency` | **atom은 spec을 참조할 수 없다** |
| `ref_consistency` | ref 대상이 실재 |
| `ref_consistency` | ref ↔ used_by 양방향 일치 (양쪽 모두 검사) |
| `spec_refs` | spec의 ref 대상이 실재 (atom/spec 모두 허용) |
| `body_section` | 타입별 필수 섹션 존재 |
| `body_placeholder` | 섹션이 아직 `_(TBD)_` 상태인지 |
| `body_donot` | `DO NOT` 섹션 존재 (action/rule) |

### Severity 매트릭스 — 성숙도에 비례하는 엄격도

이 설계의 영리한 부분이다. **같은 위반도 stage에 따라 심각도가 다르다.**

| 대상 | 상태 | 섹션 누락 | Placeholder 잔존 |
|---|---|---|---|
| atom | stage 1 | *검사 안 함* | *검사 안 함* |
| atom | stage 2 | warning | info |
| atom | stage 3·4 | **error** | warning |
| spec | draft | warning | info |
| spec | in-progress·complete | **error** | warning |

**효과**: 초안 단계에서 잔소리하지 않는다. Stage 1은 아예 본문 검사를 건너뛰므로 "일단 이름만 잡아두기"가 마찰 없이 가능하다. 대신 stage 3으로 올리는 순간 전부 error가 되어 승격 자체가 품질 게이트로 작동한다.

**이식할 때 이 원리를 반드시 가져가라.** 처음부터 엄격하면 아무도 안 쓴다.

### Stage 승격 게이트

`promote` 명령이 blocker를 계산해 미달이면 거부한다.

| 전이 | Blocker 조건 |
|---|---|
| 1 → 2 | `description`이 비어 있음 / 모든 섹션이 TBD |
| 2 → 3 | stage 3 기준 필수 섹션 누락 또는 `DO NOT` 누락 |
| 3 → 4 | stage 4 기준 전체 위반 |

`--dry-run`으로 blocker만 확인할 수 있다.

### 스캔 성능 규약

> **1단계: frontmatter만 파싱한다** (두 번째 `---`에서 중단)
> **2단계: 현재 작업에 관련된 atom의 본문만 읽는다**

686개 문서를 전부 읽지 않고 색인을 만드는 방식이다. LLM 에이전트에게는 컨텍스트 예산이 곧 성능이므로, **frontmatter의 `description` 한 줄이 "본문을 읽을지" 판단하는 유일한 근거**가 된다. description을 성의 없이 쓰면 시스템 전체가 느려진다.

---

## 5. 저장소 레이아웃

```
<repo>/
├── CLAUDE.md                    # Claude Code 진입점 (자동 로드)
├── AGENTS.md                    # 타 에이전트 진입점 (Codex 등)
├── package.json                 # bin: tom, scripts: tom / test:tom
│
├── specs/                       # ← 주 작업 영역 (이름은 자유)
│   ├── tom.yaml                 # store/spec 경로 선언
│   ├── INTERACTIVE.md           # Layer 3 작성 규약
│   ├── atoms/
│   │   ├── MANIFEST.md          # ★ 에이전트 프로토콜 (tom init 생성)
│   │   ├── entity/*.md
│   │   ├── action/*.md
│   │   ├── rule/*.md
│   │   └── term/*.md
│   ├── specs/
│   │   └── <domain>/*.md        # 도메인별 하위 폴더 허용
│   └── ui/                      # 디자인 토큰·컴포넌트·패턴 (선택)
│       ├── tokens/  components/  patterns/  composables/
│
├── .claude/
│   ├── settings.json            # hooks 정의
│   ├── hooks/                   # 검증·동기화 스크립트
│   ├── skills/                  # Claude Code 스킬
│   └── commands/                # 슬래시 커맨드
├── .agents/skills/              # 타 에이전트용 스킬 (.claude/skills 미러)
│
├── tools/tom/                   # CLI 구현
│   ├── bin/tom                  # POSIX sh 런처
│   ├── lib/tom.mjs              # 본체 (단일 파일, ~1,200줄)
│   └── test/*.test.mjs          # node --test 회귀 테스트
│
├── _templates/                  # 문서 템플릿
├── references/                  # 리서치·회의록·시장 자료 (명세 아님)
└── <legacy>_deprecated/         # 레거시 문서 (읽기 전용)
```

### `tom.yaml`

```yaml
stores:
  - path: ./atoms
specs:
  - path: ./specs
```

이게 전부다. **복수 store를 지원**하므로 대규모 조직에서 도메인별로 atom store를 분리할 수 있다.

### 레거시 격리

기존 PRD/정책 문서가 있다면 지우지 말고 `_deprecated` 접미사 폴더로 옮긴 뒤 **"사용자가 명시하지 않으면 읽기 전용"**으로 규정한다. 점진적 이관이 가능해지고, 에이전트가 옛 문서를 근거로 잘못된 답을 하는 것도 막는다.

---

## 6. 에이전트 인터페이스

이 시스템의 진짜 차별점은 CLI가 아니라 **에이전트가 규칙을 발견하는 경로를 다층으로 설계했다**는 점이다.

### 4계층 진입 구조

```
① CLAUDE.md / AGENTS.md   자동 로드. 전체 규칙·작업 흐름·범위 제한
        ↓ "atom 만들기 전 반드시 읽어라"
② MANIFEST.md             타입 책임·섹션 규격·stage·에이전트 프로토콜
        ↓ "현황은 CLI로 확인해라"
③ tom CLI                 stats / list / show / walk / validate
        ↓ "작업 유형별로는 스킬을 써라"
④ Skills                  tom-init / tom-modify / tom-review / tom-status / ...
```

각 층이 다음 층을 가리켜서, 에이전트가 어디로 진입하든 필요한 규칙에 도달한다.

### 진입점 이중화 (CLAUDE.md + AGENTS.md)

같은 내용을 두 파일로 유지한다. Claude Code는 `CLAUDE.md`를, 다른 도구는 `AGENTS.md`를 읽는다. **특정 벤더에 종속되지 않기 위한 장치**다.

> ⚠️ 두 파일이 드리프트하기 쉽다. 기준 저장소도 48바이트 차이가 나 있다. CI에서 `diff`로 검사하는 것을 권한다.

### MANIFEST.md — 에이전트 프로토콜

`tom init`이 생성하며 **수동 편집 금지**(`--force`로 재생성). 담기는 것:

- Atom 타입별 목적과 사용 시점
- frontmatter 구조
- 타입별 섹션 표 (Purpose / Required)
- Stage 정의와 승격 기준
- Stage 3 completeness 기준 + Feature-Definition Mapping
- Action-Code Linkage 규칙
- 디렉터리 규약
- **Atom vs Spec 판단 기준**
- **Agent Protocol 7개조**

Agent Protocol의 품질 게이트 조항이 특히 이식 가치가 높다:

> - `description`이 "이게 없으면 무엇이 깨지는가"에 답하는가 — ID를 자연어로 풀어쓴 것이 아니라
> - `Rationale`이 구현 기술이 아니라 **비즈니스 필요**를 설명하는가
> - `Execution Order`가 코드 라인이 아니라 **비즈니스 단계**를 기술하는가
> - `Input/Output`이 타입 시그니처가 아니라 **도메인 의미**를 설명하는가

LLM이 명세를 쓰면 기본값으로 "코드를 자연어로 옮긴 문서"가 나온다. 이 4개 조항이 그걸 막는다.

### 스킬 — 작업 유형별 진입점

| 상황 | 스킬 |
|---|---|
| 현황 파악 | `tom-status` |
| 새 기능 명세 | `tom-init` |
| 기존 명세 수정 + 영향 분석 | `tom-modify` |
| 구현 가능성 리뷰 | `tom-review` |
| 테스트 기준/QA 시나리오 | `tom-tc` |
| Layer 3 아티팩트 | `tom-interactive` |
| 외부 논의(Slack 등) 반영 | `policy-sync` |

**`.claude/skills/`와 `.agents/skills/`에 동일 내용을 미러링**하고 `diff -u`로 검증한다. 기준 저장소는 TOM 스킬 7종이 전부 일치한다.

스킬의 `description`에 **자연어 트리거를 넣는 것이 핵심**이다. 사용자가 `/tom-modify`를 타이핑하지 않고 "요구사항 바뀌었어", "영향 범위 봐줘"라고 말해도 발동하도록:

```yaml
---
name: tom-modify
description: 기존 TOM atom/spec 요구사항 변경 반영. 명시적으로 /tom-modify를 입력하지
  않아도 '요구사항 바뀌었어', '이 정책 수정해야 해', '영향 범위 봐줘'처럼 ... 요청할 때 사용한다.
---
```

### Hooks — 자동 검증

| Hook | 시점 | 역할 |
|---|---|---|
| frontmatter guard | PreToolUse | 필수 필드 누락 경고. **차단하지 않음**(항상 exit 0) |
| auto-sync | PostToolUse | `tom validate --fix`로 refs/used_by 자동 동기화 |

**설계 원칙: hook은 차단하지 않고 경고한다.** 에이전트가 경고를 읽고 스스로 고치게 하는 편이, 도구 호출을 실패시켜 재시도를 유발하는 것보다 효율적이다.

auto-sync는 병렬 실행 방지를 위해 `mkdir` 기반 원자적 lock을 쓰고 **모든 에러를 흡수**한다(`|| true`). 명세 편집이 hook 실패로 막히면 안 되기 때문이다.

> ⚠️ **hook 입력 규약을 확인하라.** Claude Code는 hook 페이로드를 **stdin JSON**으로 넘긴다(`tool_input.file_path`). 환경변수(`$TOOL_INPUT_file_path`)를 읽는 구현은 조용히 no-op이 된다. 기준 저장소에서 실제로 발생한 버그다 — §10 참조.

---

## 7. 코드 레포와의 연결

명세 저장소가 고립되면 반드시 죽는다. 세 가지 연결 장치가 있다.

### ① 구현 앵커 (Action-Code Linkage)

코드가 이미 존재하는 action atom에 검증된 경로를 기록한다.

```markdown
**구현 앵커:**

| 레이어 | 경로 |
|------|------|
| route | `repo/src/x/routes/y.ts` — `GET /x/y` |
| service | `repo/src/x/services/y.ts` — `YService.get` |
| schema | `repo-utilities/packages/schemas/x/y.ts` |
| client | `repo-frontend/src/views/.../View.vue` |
| test | `repo/src/x/__tests__/y.test.ts` |
```

앵커 필드: `route`, `controller`, `handler`, `service`, `client`, `type`, `test`

**규칙 (Gardening Rule)**:
- 연결할 코드가 현재 체크아웃되어 있지 않으면 `planned` 또는 `not linked yet`으로 둔다
- **경로를 추측하지 않는다.** 레거시 문서에서 강제 backfill하지 않는다
- 소급 적용이 아니라 앞으로의 작업에 적용하는 관리 규칙이다

이 절제가 중요하다. 틀린 앵커는 없는 앵커보다 나쁘다.

### ② Git submodule

```ini
[submodule "src/submodules/saas-specs"]
	path = src/submodules/saas-specs
	url = git@bitbucket.org:medistream-team/saas-specs.git
```

코드 레포가 명세 저장소를 submodule로 물면, **코드 작업 중인 에이전트가 명세를 직접 읽는다.** 별도 fetch·API·MCP 없이 파일시스템 접근만으로 해결된다.

### ③ 동기화 검증 스킬 (spec-sync)

코드 레포 쪽에 두는 스킬이다. 매핑 파일로 **소스 경로 ↔ spec 경로**를 연결하고, 브랜치 diff와 명세를 대조해 불일치를 보고한다.

```
.claude/skills/spec-sync/
├── SKILL.md
└── spec-sync-mapping.json    # 도메인별 소스↔spec 매핑
```

수집 모드: `branch`(기본) / `develop` / `staged` / `domain` / `full`
공통 필터: `src/` 하위 `.ts`만, 테스트 파일 제외

### 변경 통제 원칙

> **spec-first change control** — 제품 정책·API 동작·테스트 기준·Mock 재료는 **코드보다 먼저** 명세에 기록한다.

그리고 결정적으로:

> **테스트 코드와 Mock 파일을 명세 저장소에 만들지 않는다.** 대신 코드베이스에서 테스트·Mock을 생성할 수 있는 **기준·조건·데이터 재료**를 명세에 남긴다.

명세 저장소가 코드 저장소를 흉내 내기 시작하면 둘 다 썩는다.

---

## 8. 새 서비스 이식 절차

### Phase 0 — 도입 판단

| 도입할 만한 신호 | 도입하지 말아야 할 신호 |
|---|---|
| 도메인 개념이 30개 이상 | 개념이 10개 미만 — README로 충분 |
| 정책 변경의 영향 범위를 자주 묻는다 | 제품이 1인 개발 초기 단계 |
| 문서-코드 괴리로 사고가 났다 | 명세를 유지할 담당자가 없다 |
| LLM 에이전트에게 명세를 먹이고 싶다 | 스펙이 외부 계약서로 고정되어 변화가 없다 |

**최소 유지 인력: 1명.** 링크 무결성은 기계가 지키지만 "이게 atom인가 spec인가"는 사람이 판단해야 한다.

### Phase 1 — 골격 (0.5일)

```bash
mkdir -p <service>-specs && cd <service>-specs
git init && npm init -y

# TOM CLI 이식 — tools/tom 전체 복사 (단일 mjs 파일 + sh 런처)
cp -r <saas-specs>/tools/tom tools/

# package.json
#   "bin":     { "tom": "tools/tom/bin/tom" }
#   "scripts": { "tom": "tools/tom/bin/tom", "test:tom": "node --test tools/tom/test/*.test.mjs" }

mkdir specs && cd specs
../tools/tom/bin/tom init     # tom.yaml + atoms/MANIFEST.md 생성
```

`tom init`이 MANIFEST를 만들지만 **Stage 3 completeness와 Atom vs Spec 판단 기준은 서비스 도메인에 맞게 손봐야 한다**(§9).

### Phase 2 — 어휘 씨앗 (2~5일)

기존 문서를 통째로 이관하지 말고, **가장 자주 쓰이는 개념 20~30개**부터 시작한다.

작성 순서는 의존 방향을 따른다:

```
1. term    상태값·enum·에러 코드부터. 가장 안정적이고 의존이 없다
2. entity  핵심 도메인 객체. term을 참조하기 시작한다
3. rule    정책·불변식. term/entity를 참조한다
4. action  API·행위. 위 셋을 모두 참조한다
```

전부 **stage 1로 시작**한다. Stage 1은 본문 검사를 건너뛰므로 이름과 description만 잡고 빠르게 넓힐 수 있다.

```bash
../tools/tom/bin/tom create term order-status
../tools/tom/bin/tom create entity order
../tools/tom/bin/tom validate --fix
```

### Phase 3 — 첫 Spec (1~2일)

실제로 진행 중인 기능 하나를 골라 spec을 쓴다. 이때 부족한 atom이 드러나면 그때 만든다. **atom을 먼저 완비하려 하지 말 것** — 무엇이 필요한지는 spec을 써봐야 안다.

```bash
../tools/tom/bin/tom create spec order-cancellation
../tools/tom/bin/tom walk spec-order-cancellation --refs
```

Spec 본문에 refs의 역할을 섹션별로 서술한다:

| 섹션 | 담는 것 |
|---|---|
| `Ref Implementation Map` | refs를 `implement`/`change`/`advance`/`context`/`reuse`로 분류 |
| `API / Data Flow` | action atom refs를 연결한 기능 수준 흐름 |
| `Screen Data / Display` | entity/term refs로 화면 데이터·표시 요구사항 |
| `Policy / Validation / Exception` | rule/action/term refs로 정책·검증·예외 |
| `Scenarios / Completion Criteria` | 정상/엣지/오류 시나리오와 완료 기준 |

**`Ref Implementation Map`이 가장 중요하다.** 모든 ref가 구현 대상은 아니다. `implement`(신규)/`change`(수정)와 `context`(참고만)/`reuse`(그대로 씀)를 구분하지 않으면 구현자가 12개 문서를 전부 고쳐야 하는 줄 안다.

### Phase 4 — 에이전트 인터페이스 (1일)

1. `CLAUDE.md` 작성 — 핵심 원칙, TOM 모델, 타입 책임표, 작업 흐름, **범위 제한**
2. `AGENTS.md`에 복사 (도구별 차이만 조정)
3. `.claude/settings.json` + hooks 2종 이식 (**stdin JSON 규약 확인**)
4. 스킬 이식 — 최소 `tom-status`, `tom-init`, `tom-modify`, `tom-review`
5. `.agents/skills/`에 미러 + `diff -u` 검증

`CLAUDE.md`의 범위 제한 절은 반드시 넣는다:

```markdown
## 범위 제한
- 제품 atom/spec 변경과 framework/docs/skills 변경을 섞지 않습니다.
- 사용자가 요청하지 않은 레거시 이관, CLI 수정, CI 수정, dependency 추가를 하지 않습니다.
- 불확실한 제품 정책은 임의로 결정하지 말고 오픈 퀘스천으로 남기거나 사용자에게 확인합니다.
```

마지막 줄이 특히 중요하다. **LLM은 모르는 정책을 그럴듯하게 지어내는 경향이 있다.** "오픈 퀘스천으로 남겨라"는 명시적 탈출구를 주면 억측이 크게 준다.

### Phase 5 — 코드 레포 연결 (1일)

1. 코드 레포에 submodule 등록
2. `spec-sync` 스킬 + 매핑 JSON 작성
3. 이미 코드가 있는 action atom에 구현 앵커 기록 (**추측 금지**)

### Phase 6 — 운영 정착 (지속)

- 기능 착수 시 `tom-init`으로 spec 먼저
- 정책 변경 시 `tom-modify`로 영향 범위 확인 후 수정
- 구현 전 `tom-review`로 Stage 3 completeness 확인
- 주기적으로 `tom stats` — orphan/unlinked atom 추적

---

## 9. 서비스별 조정 지점

이식할 때 **그대로 쓰면 안 되고 반드시 다시 정해야 하는** 것들.

### ① Atom 타입 체계

4타입(term/entity/rule/action)은 트랜잭션 업무 시스템(EMR/CRM/커머스)에 최적화돼 있다. 도메인이 다르면 조정한다.

| 도메인 | 조정 방향 |
|---|---|
| 데이터/ML 플랫폼 | `entity` → `dataset`/`feature`, `action` → `pipeline` 분리 검토 |
| 인프라/플랫폼 | `resource`, `policy` 타입 추가 검토 |
| 콘텐츠/미디어 | `entity` 비중 축소, `term`(분류 체계) 비중 확대 |
| 순수 라이브러리/SDK | `action`(API) 중심, `rule` 거의 불필요 |

**타입은 늘리기보다 줄이는 쪽이 안전하다.** 타입이 많아지면 "이게 무슨 타입이지" 판단 비용이 재사용 이득을 넘는다.

### ② 필수 섹션

`action`의 6개 섹션은 서버 API 기준이다. 프론트엔드 중심이면 `Auth & Permissions` 대신 `State Transitions`, `Error Handling` 대신 `Loading / Empty / Error States`가 맞을 수 있다.

**`Rationale`과 `DO NOT`은 어떤 도메인에서도 유지하라.** 이 둘이 문서를 코드 복사본이 아닌 지식 자산으로 만든다.

### ③ Stage 개수

4단계 + deprecated가 과하면 3단계(`draft`/`spec`/`verified`)로 줄여도 된다. 다만 **"검사하지 않는 최하위 단계"는 반드시 남겨라.** 마찰 없는 시작점이 없으면 아무도 문서를 시작하지 않는다.

### ④ 언어 정책

기준 저장소는 **ID는 영어, 파일명·본문은 한국어**다. 팀 언어에 맞추되 **ID만은 영어 kebab-case로 고정**하는 것을 권한다. 검증 정규식·URL·코드 참조가 전부 ASCII를 전제한다.

### ⑤ 도메인 폴더 깊이

기준 저장소는 atom을 타입별 평면(`atoms/action/*.md` 261개)으로, spec을 도메인별(`specs/<domain>/*.md`)로 둔다.

- **atom 200개 이하**: 평면 유지. 검색이 폴더 탐색보다 빠르다
- **atom 500개 이상**: `tom.yaml`의 복수 store로 도메인 분리 검토

### ⑥ 검증 엄격도

CI에서 `tom validate`를 강제할지 결정한다.

- **link 무결성(`ref_consistency`, `id_*`)은 CI 강제 권장** — 자동 수정 가능하고 이견이 없다
- **`--body`(섹션 완성도)는 경고로 시작** — 강제하면 stage를 낮게 유지하는 회피가 생긴다

---

## 10. 알려진 함정과 실패 모드

기준 저장소 운영에서 실제로 확인된 것들이다.

### 🔴 A. Hook 입력 규약 불일치 (실측 확인됨)

```bash
FILE_PATH="${TOOL_INPUT_file_path:-}"   # ✗ 항상 빈 문자열
```

Claude Code는 hook 페이로드를 **stdin JSON**으로 전달한다. 환경변수를 읽으면 조용히 no-op이 되고, hook은 "성공"으로 보고되어 **아무도 눈치채지 못한다.**

```bash
# ✓ 올바른 구현
FILE_PATH="$(cat | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')"
```

**교훈: hook을 작성했으면 실제로 동작하는지 payload를 넣어 검증하라.**

```bash
echo '{"tool_input":{"file_path":"/abs/path/atoms/term/x.md"}}' | bash .claude/hooks/auto-sync.sh
```

### 🔴 B. Hook matcher가 Edit을 놓침

PreToolUse 가드가 `Write`만 매칭하면, **기존 문서를 `Edit`으로 고칠 때 검증이 전혀 걸리지 않는다.** 신규 생성보다 기존 수정이 훨씬 잦으므로 실질 커버리지가 거의 0이 된다.

→ 문서 검증 hook은 **`Write`와 `Edit`을 모두** 매칭할 것.

### 🟡 C. 진입점 문서 드리프트

`CLAUDE.md`와 `AGENTS.md`가 조용히 갈라진다. 스킬 미러(`.claude/skills` ↔ `.agents/skills`)도 마찬가지다.

→ CI에 `diff` 게이트를 두거나, 한쪽을 심볼릭 링크로 만들고 도구별 차이만 별도 파일로 분리한다.

### 🟡 D. 규칙 문서가 실재하지 않는 경로를 가리킴

기준 저장소의 `CLAUDE.md`는 "`spec/`은 레거시 영역"이라고 쓰지만 실제 폴더는 `spec_deprecated/`다. 폴더를 리네임하면서 문서를 안 고친 결과다.

**에이전트는 이런 불일치를 침묵으로 처리한다** — 없는 폴더를 읽지 못해도 그냥 넘어간다. → 디렉터리 리네임 시 진입점 문서 grep은 필수.

### 🟡 E. `used_by` 수동 편집

자동 동기화 대상을 손으로 고치면 다음 `--fix`에 덮어써진다. **`refs`만 편집하고 `used_by`는 기계에 맡긴다**를 CLAUDE.md에 명시할 것.

### 🟡 F. Placeholder 영구화

`_(TBD)_`가 편해서 stage 2에 몇 달씩 머무는 atom이 쌓인다. `tom list --stage 2`를 주기 점검 항목에 넣는다.

### 🟡 G. Orphan atom 누적

기준 저장소는 orphan 5개, unlinked 35개다. 만들었지만 아무도 안 쓰는 atom이다. 소량은 정상(선행 정의)이지만 비율이 10%를 넘으면 **어휘를 과잉 분해하고 있다는 신호**다.

### 🔵 H. 명세가 코드 복사본이 되는 것

가장 흔하고 가장 치명적이다. `Execution Order`에 함수 호출 순서를, `Input/Output`에 TypeScript 타입을 적기 시작하면 명세의 존재 이유가 사라진다(코드가 더 정확하니까).

→ MANIFEST의 **품질 게이트 4개조**를 리뷰 체크리스트로 운용한다.

### 🔵 I. 명세가 코드보다 오래된 것

문서에 "신설 필요"라고 적힌 기능이 이미 6개월 전 구현돼 있는 경우. 코드를 확인하지 않고 명세만 보고 쓰면 발생한다.

→ 명세에 "신설/변경"을 쓰기 전에 **반드시 코드베이스에서 현재 동작을 확인**한다. 구현 앵커와 spec-sync 스킬이 이걸 위한 장치다.

---

## 11. 도입 체크리스트

### 골격
- [ ] `tools/tom` 이식, `npm run test:tom` 통과
- [ ] `tom.yaml` 작성, `tom init`으로 MANIFEST 생성
- [ ] MANIFEST의 Stage 3 기준·Atom vs Spec 기준을 도메인에 맞게 수정
- [ ] `tom stats` 정상 동작 확인

### 어휘
- [ ] term 10개 이상 (상태값·enum·에러 코드)
- [ ] entity 5개 이상 (핵심 도메인 객체)
- [ ] rule/action 각 3개 이상
- [ ] `tom validate` 위반 0건

### 첫 Spec
- [ ] 진행 중인 실제 기능으로 spec 1개 작성
- [ ] `Ref Implementation Map`에 implement/change/context/reuse 분류
- [ ] `tom walk <spec-id> --refs`로 토폴로지 확인
- [ ] `tom validate --body` 확인

### 에이전트 인터페이스
- [ ] `CLAUDE.md` 작성 (원칙 / 타입 책임 / 작업 흐름 / **범위 제한**)
- [ ] `AGENTS.md` 미러 + diff 검증
- [ ] hooks 2종 이식 후 **payload 주입 실제 동작 검증** (§10-A)
- [ ] hook matcher가 **Write와 Edit 모두** 커버하는지 확인
- [ ] 스킬 최소 4종 + `.agents/skills` 미러 + `diff -u`

### 코드 연결
- [ ] 코드 레포에 submodule 등록
- [ ] `spec-sync` 스킬 + 매핑 JSON
- [ ] 기존 코드가 있는 action atom에 구현 앵커 (추측 금지, 없으면 `not linked yet`)

### 운영
- [ ] CI에 `tom validate` (link 무결성) 게이트
- [ ] `--body`는 경고로 시작
- [ ] 주기 점검 항목: `tom list --stage 2`, `tom list --orphan`, `tom stats`
- [ ] 유지 담당자 1명 지정

---

## 부록 A — TOM CLI 명령 레퍼런스

```
tom init [--force]                    TOM 프로젝트 초기화 (tom.yaml + MANIFEST.md)
tom create <type> <name>              atom/spec 템플릿 생성
                                      (--filename, --store-index, --spec-index)
tom validate [--fix] [--body] [--yaml]
                                      토폴로지 일관성 검사
                                      --fix   used_by 자동 동기화
                                      --body  섹션 완성도 검사
tom list [--type T] [--stage S] [--orphan] [--yaml]
                                      atom/spec 목록
tom show <id...> [--frontmatter]      전체 내용 출력
tom stats [--yaml]                    저장소 건강 지표
tom walk <id> [--refs|--used-by] [--depth N] [--body] [--yaml]
                                      토폴로지 순회 (트리 출력, 순환 감지)
tom promote <id> [--dry-run]          다음 stage 승격 (blocker 검사)
```

**실행 위치**: `tom.yaml`이 발견되는 디렉터리 또는 그 하위.

## 부록 B — `tom stats` 출력 해석

```
Store: /path/to/atoms
  entity: 144  action: 261  rule: 178  term: 103  total: 686
  stage: 1:1  2:60  3:622  4:0  deprecated:3

Specs: 105 (draft:24  in-progress:10  complete:71)
  avg refs/spec: 11.8

Topology:
  orphan atoms (no refs, no used_by): 5
  unlinked atoms (no spec refs): 35
```

| 지표 | 건강한 범위 | 이상 신호 |
|---|---|---|
| stage 3 비율 | 70% 이상 | 낮으면 명세가 초안에 머물러 구현에 못 쓰임 |
| stage 2 정체 | — | 수개월 정체 시 §10-F |
| avg refs/spec | 8~15 | 너무 낮으면 spec이 atom을 안 쓰는 중(재사용 실패), 너무 높으면 spec이 과대 |
| orphan 비율 | 1% 이하 | 높으면 과잉 분해 (§10-G) |
| unlinked 비율 | 5% 이하 | 높으면 어휘만 있고 기능 명세가 부족 |
| action 비중 | 30~40% | 지나치게 높으면 rule로 뽑아야 할 정책이 action에 묻혀 있음 |

## 부록 C — 파일 템플릿

**atom (`tom create`가 생성하는 형태)**

```markdown
---
type: action
id: action-create-order
description: ""
stage: 1
refs: []
used_by: []
---

# 주문 생성

## Rationale

_(TBD)_

## Auth & Permissions

_(TBD)_

## Execution Order

_(TBD)_

## Input / Output

_(TBD)_

## DO NOT

_(TBD)_

## Error Handling

_(TBD)_

<!-- TOM refs -->
```

**링크 표기**: 본문에서 `[표시명][atom-id]` 형태로 참조하고, 파일 하단 `<!-- TOM refs -->` 아래에 상대 경로를 정의한다.

```markdown
주문은 [결제수단][term-payment-method]에 따라 [주문][entity-order]을 생성한다.

<!-- TOM refs -->
[entity-order]: ../entity/주문.md
[term-payment-method]: ../term/결제수단.md
```

Markdown 링크로도 동작하고(사람이 클릭 가능) frontmatter `refs`와 별개로 본문 가독성을 준다.

---

## 부록 D — 이 설계에서 반드시 가져갈 5가지

다른 건 다 조정해도 이 다섯은 유지하기를 권한다.

1. **양방향 링크 + 자동 동기화** — 작성자는 `refs`만, 기계가 `used_by`를. 영향 범위 추적이 O(1)이 된다.
2. **성숙도 비례 엄격도** — 초안엔 잔소리하지 않고, 승격할 때 게이트를 건다. 마찰 없는 시작점이 채택률을 결정한다.
3. **`Rationale` + `DO NOT` 필수** — 코드가 답할 수 없는 두 질문("왜 존재하나", "왜 이러면 안 되나")만이 문서의 고유 가치다.
4. **다층 진입 구조** — 진입점 → MANIFEST → CLI → 스킬. 각 층이 다음을 가리켜 어디로 들어와도 규칙에 도달한다.
5. **"오픈 퀘스천으로 남겨라"는 명시적 탈출구** — LLM이 모르는 정책을 지어내는 것을 막는 가장 값싼 장치다.
