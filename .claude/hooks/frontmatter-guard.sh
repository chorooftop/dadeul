#!/bin/sh
# PreToolUse(Write|Edit) — atom/spec 문서 편집 전 frontmatter 경고.
# 차단하지 않는다(항상 exit 0). payload는 stdin JSON이다 (환경변수 아님 — 플레이북 §10-A).
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cat | node "$DIR/frontmatter-guard.mjs" 2>/dev/null || true
exit 0
