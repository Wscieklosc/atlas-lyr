// distill.js — tworzy core_summary.txt (~60k znaków esencji)
const fs = require("fs"), path = require("path");
const ROOT = process.cwd(), SRC = path.join(ROOT, "docx_txt");
const OUT = path.join(ROOT, "core_summary.txt");
const MAX = 60000; // ~60k znaków

const KEY = /Piecz(e|ę)ć|Ksi(ę|e)ga|Brama|Zakl(ę|e)cie|Forteca|Lyr|Kael|Nexus|Cień|Rytua(ł|l)/i;

let buf = "=== ESENCJA KSIĄG (autodystylacja lokalna) ===\n";
if (!fs.existsSync(SRC)) { console.error("Brak docx_txt/"); process.exit(1); }
const files = fs.readdirSync(SRC).filter(f=>f.toLowerCase().endsWith(".txt")).sort();

for (const f of files) {
  let t = fs.readFileSync(path.join(SRC, f), "utf-8");
  t = t.replace(/\r/g,"").split("\n").map(s=>s.trim()).filter(Boolean);

  const head = t.slice(0,8).join("\n");
  const key  = t.filter(s=>KEY.test(s)).slice(0,12).join("\n");
  const tail = t.slice(-6).join("\n");

  const chunk = `\n\n--- ${f} ---\n${head}\n${key}\n${tail}\n`;
  if ((buf + chunk).length <= MAX) buf += chunk; else break;
}

fs.writeFileSync(OUT, buf, "utf-8");
console.log("OK:", OUT, "znaków:", buf.length);
