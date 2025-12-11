#!/bin/bash
# convert_docs.sh — DOCX/ODT/RTF/PDF → TXT z paskiem postępu i OCR
set -u

## Używaj ścieżek względnych względem katalogu repo (bez twardego $HOME)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
RAW_DOCX="$ROOT_DIR/docx_raw"
RAW_PDF="$ROOT_DIR/docx_pdf"
TXT_DIR="$ROOT_DIR/docx_txt"
TMP_DIR="$TXT_DIR/.tmp_ocr"

mkdir -p "$RAW_DOCX" "$RAW_PDF" "$TXT_DIR" "$TMP_DIR"

missing_tools=()
command -v soffice >/dev/null 2>&1 || missing_tools+=(soffice)
command -v pdftotext >/dev/null 2>&1 || missing_tools+=(pdftotext)
command -v pdfinfo   >/dev/null 2>&1 || missing_tools+=(pdfinfo)
command -v tesseract >/dev/null 2>&1 || missing_tools+=(tesseract)
if [ ${#missing_tools[@]} -ne 0 ]; then
  echo "⚠️ Uwaga: nie znaleziono narzędzi: ${missing_tools[*]}"
  echo "   Skrypt będzie próbował konwertować to, co jest możliwe, ale nie przerwie pracy serwera."
fi

# ── policz pracę do zrobienia ──────────────────────────────────────────────────
docx_list=()
pdf_list=()

while IFS= read -r -d '' f;  do docx_list+=("$f"); done < <(find "$RAW_DOCX" -type f \( -iname '*.docx' -o -iname '*.odt' -o -iname '*.rtf' \) -print0)
while IFS= read -r -d '' f;  do pdf_list+=("$f");  done < <(find "$RAW_PDF"  -type f -iname '*.pdf' -print0)

units_total=0
for f in "${docx_list[@]}"; do ((units_total++)); done
for f in "${pdf_list[@]}"; do
  pages=$(pdfinfo "$f" 2>/dev/null | awk -F': *' '/^Pages/{print $2+0}')
  (( pages>0 )) || pages=1
  ((units_total+=pages))
done

((units_total>0)) || { echo "Brak plików do konwersji."; exit 0; }

# ── pomocnicze: timer + pasek ─────────────────────────────────────────────────
start_ts=$(date +%s)
units_done=0

render_bar() {
  local done=$1 total=$2
  local width=40
  local percent=$(( 100*done/total ))
  local filled=$(( width*done/total ))
  local empty=$(( width-filled ))
  printf "\r[%.*s%.*s] %3d%%  (%d/%d)" \
    "$filled" "########################################" \
    "$empty"  "........................................" \
    "$percent" "$done" "$total"
}

finish_line() {
  local end_ts
  end_ts=$(date +%s)
  local dur=$((end_ts - start_ts))
  printf "\n✨ Zakończono. Czas: %dm %02ds\n" $((dur/60)) $((dur%60))
  echo "📄 Jednostki (pliki+strony PDF): $units_done / $units_total"
}

convert_doc_like() {
  local src="$1"
  local base=$(basename "$src")
  local name="${base%.*}"
  local dest="$TXT_DIR/$name.txt"
  if [ -s "$dest" ]; then
    ((units_done++)); render_bar "$units_done" "$units_total"
    return
  fi
  soffice --headless --convert-to txt:Text "$src" --outdir "$TXT_DIR" >/dev/null 2>&1
  ((units_done++)); render_bar "$units_done" "$units_total"
}

convert_pdf() {
  local src="$1"
  local base=$(basename "$src")
  local name="${base%.*}"
  local dest="$TXT_DIR/$name.txt"

  # Spróbuj zwykłe pdftotext
  pdftotext -layout "$src" "$dest" 2>/dev/null

  pages=$(pdfinfo "$src" 2>/dev/null | awk -F': *' '/^Pages/{print $2+0}')
  (( pages>0 )) || pages=1

  if [ -s "$dest" ]; then
    # zalicz wszystkie strony jako wykonane
    for ((i=1;i<=pages;i++)); do ((units_done++)); render_bar "$units_done" "$units_total"; done
    return
  fi

  # OCR — strona po stronie
  rm -f "$dest"
  # generuj PPM w tempie, aby liczyć postęp
  pdftoppm -r 300 "$src" "$TMP_DIR/${name}_p" >/dev/null 2>&1
  shopt -s nullglob
  imgs=( "$TMP_DIR/${name}_p"-*.ppm )
  shopt -u nullglob
  local count=${#imgs[@]}
  if (( count == 0 )); then
    # awaryjnie zrób OCR bez pośrednich plików (czasem pdfinfo ma 0)
    count=$pages
    for ((i=1;i<=count;i++)); do
      pdftoppm -r 300 -f $i -l $i "$src" "$TMP_DIR/${name}_pp" >/dev/null 2>&1
      for img in "$TMP_DIR/${name}_pp"-*.ppm; do
        [ -e "$img" ] || continue
        tesseract "$img" "$TMP_DIR/${name}_part" -l pol+eng >/dev/null 2>&1
        cat "$TMP_DIR/${name}_part.txt" >> "$dest"
        rm -f "$img" "$TMP_DIR/${name}_part.txt"
      done
      ((units_done++)); render_bar "$units_done" "$units_total"
    done
  else
    # mamy wygenerowane obrazy; iteruj po nich
    for img in "${imgs[@]}"; do
      tesseract "$img" "$TMP_DIR/${name}_part" -l pol+eng >/dev/null 2>&1
      cat "$TMP_DIR/${name}_part.txt" >> "$dest"
      rm -f "$img" "$TMP_DIR/${name}_part.txt"
      ((units_done++)); render_bar "$units_done" "$units_total"
    done
  fi
}

echo "🔄 Start: $(date '+%Y-%m-%d %H:%M:%S')"
echo "📦 DOCX/ODT/RTF: ${#docx_list[@]}  |  PDF: ${#pdf_list[@]}  |  Jednostki: $units_total"
echo

# DOCX/ODT/RTF
for f in "${docx_list[@]}"; do
  convert_doc_like "$f"
done

# PDF
for f in "${pdf_list[@]}"; do
  convert_pdf "$f"
done

rm -rf "$TMP_DIR"
finish_line
echo "📁 TXT: $TXT_DIR"
