<!-- 형식 기준: specs/release-process.md §3 — 섹션을 지우지 말 것. 해당 없으면 "없음"으로 채운다 -->

## 무엇을 (What)

<!-- 이 PR이 하는 일 1~3문장. 기능은 사용자 관점, 수정은 before → after -->

## 왜 (Why)

<!-- 배경·근거. 관련 atom/spec id, 리뷰 발견, 사용자 결정 등 출처 명시 -->

## 변경 내용 (Changes)

<!-- 영역 태그 + 어디를 + 어떻게 -->
- **[specs]**
- **[api]**

## 명세 영향 (Spec Impact)

- 변경된 atom/spec:
- openapi.yaml 변경: 없음 <!-- 있으면 하위호환 여부(필드 추가만인지) 명시 -->
- 새로 생긴 오픈 퀘스천: 없음

## 검증 (Verification)

- [ ] `npm run test:api` — N건 통과
- [ ] `npm run typecheck --workspace @dadeul/api`
- [ ] `tom validate` / `tom validate --body` — error 0
- [ ] CI (validate·api) 그린
- 추가/변경된 테스트:

## 리뷰 포인트 (Review Focus)

<!-- 리뷰어가 시간을 써야 할 곳 1~3개. 판단이 갈린 결정, 트레이드오프 -->

## 남은 일 (Follow-ups)

없음
