#!/usr/bin/env bash
# Roda todos os testes, um de cada vez, e diz no fim quais falharam (sai com erro se algum
# falhou). Usado pelo GitHub a cada mudança; dá para rodar no computador também, com:
#   BASE=http://127.0.0.1:8765/  AXE=.../axe-core/axe.min.js  PGLITE=.../pglite/dist/index.js
#   CHROMIUM=.../chromium  NODE_PATH=.../node_modules  bash testes/rodar-todos.sh
cd "$(dirname "$0")/.."
falhas=()
ok=0
for f in testes/*.test.js testes/*.test.mjs; do
  [ -e "$f" ] || continue
  [ -n "$GITHUB_ACTIONS" ] && echo "::group::$f"
  inicio=$(date +%s)
  if node "$f"; then ok=$((ok + 1)); r="ok"; else falhas+=("$f"); r="FALHOU"; fi
  [ -n "$GITHUB_ACTIONS" ] && echo "::endgroup::"
  echo "$r  $f  ($(( $(date +%s) - inicio ))s)"
  [ "$r" = "FALHOU" ] && [ -n "$GITHUB_ACTIONS" ] && echo "::error file=$f::$f falhou"
done
resumo="**$ok arquivo(s) de teste passaram.**"
if [ ${#falhas[@]} -gt 0 ]; then
  resumo="$resumo **${#falhas[@]} falharam:** ${falhas[*]}"
fi
echo; echo "$resumo"
[ -n "$GITHUB_STEP_SUMMARY" ] && echo "$resumo" >> "$GITHUB_STEP_SUMMARY"
[ ${#falhas[@]} -eq 0 ]
