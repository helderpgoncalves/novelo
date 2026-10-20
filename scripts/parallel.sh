#!/usr/bin/env bash
# Corre vários comandos em paralelo e junta a saída de cada um, por ordem, no fim.
# Uso: scripts/parallel.sh "nome=comando" "nome2=comando2" ...
# Sai com 0 só se todos saírem com 0; os que falham mostram a saída completa, os que passam as últimas linhas.
set -u
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
names=()
for spec in "$@"; do
  name="${spec%%=*}"
  cmd="${spec#*=}"
  names+=("$name")
  (
    start=$SECONDS
    bash -c "$cmd" >"$tmp/$name.log" 2>&1
    echo "$? $((SECONDS - start))" >"$tmp/$name.rc"
  ) &
done

# Mostra cada resultado assim que o job acaba (a saída completa vem no fim, em ordem estável).
reported=" "
while :; do
  pending=0
  for name in "${names[@]}"; do
    if [ -f "$tmp/$name.rc" ]; then
      if [[ "$reported" != *" $name "* ]]; then
        read -r rc secs <"$tmp/$name.rc"
        if [ "$rc" = 0 ]; then echo "  ok     $name (${secs}s)"; else echo "  FALHOU $name (${secs}s)"; fi
        reported+="$name "
      fi
    else
      pending=1
    fi
  done
  [ "$pending" = 0 ] && break
  sleep 0.3
done
wait

status=0
for name in "${names[@]}"; do
  read -r rc secs <"$tmp/$name.rc"
  if [ "$rc" != 0 ]; then
    status=1
    echo
    echo "=== $name: FALHOU (código $rc, ${secs}s) ==="
    cat "$tmp/$name.log"
  fi
done
if [ "$status" = 0 ]; then
  for name in "${names[@]}"; do
    echo
    echo "--- $name ---"
    tail -n 4 "$tmp/$name.log"
  done
fi
exit "$status"
