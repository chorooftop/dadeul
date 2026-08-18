#!/bin/sh
# PostToolUse(Write|Edit) — atom/spec 편집 후 used_by 자동 동기화.
# 모든 에러를 흡수한다(명세 편집이 hook 실패로 막히면 안 됨). payload는 stdin JSON.
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$DIR/../.." && pwd)

FILE_PATH=$(cat | node -e 'const d=require("fs").readFileSync(0,"utf8");try{process.stdout.write(JSON.parse(d).tool_input.file_path||"")}catch(e){}' 2>/dev/null) || true

case "$FILE_PATH" in
  *MANIFEST.md) exit 0 ;;
  */specs/atoms/*.md|*/specs/specs/*.md) ;;
  *) exit 0 ;;
esac

# mkdir 기반 원자적 lock — 병렬 편집 시 중복 실행 방지
LOCK="$ROOT/.claude/hooks/.auto-sync.lock"
if mkdir "$LOCK" 2>/dev/null; then
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
  OUT=$(cd "$ROOT/specs" && "$ROOT/tools/tom/bin/tom" validate --fix 2>/dev/null) || true
  SYNCED=$(printf '%s\n' "$OUT" | grep -c '^sync used_by' 2>/dev/null) || true
  if [ "${SYNCED:-0}" -gt 0 ]; then
    echo "auto-sync: used_by ${SYNCED}건 동기화됨 (tom validate --fix)"
  fi
fi
exit 0
