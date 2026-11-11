#!/bin/zsh
# Renderiza o PPTX para JPEG (QA visual): qa.sh [dpi]
SK=$(ls -d ~/.claude/skills/synced/*/pptx | head -1)
Q=/private/tmp/claude-501/-Users-hegs-Downloads-helder-novelo/74911992-2346-4c38-8462-c7bbcc5b986d/scratchpad/qa
mkdir -p $Q; rm -f $Q/*.jpg $Q/*.pdf
python3 $SK/scripts/office/soffice.py --headless --convert-to pdf --outdir $Q ../out/novelo-apresentacao-vitrus-completa.pptx >/dev/null 2>&1
pdftoppm -jpeg -r ${1:-60} $Q/novelo-apresentacao-vitrus-completa.pdf $Q/s
ls $Q | head -3; ls $Q/*.jpg | wc -l
