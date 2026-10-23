'use strict';
/* Gera a pasta dist/ pronta para publicar (Netlify ou qualquer hospedagem estática).
   Uso: node build.js   (ou: npm run build)

   - copia só o que o jogo precisa (deixa de fora servidor, .bat, configs);
   - põe um hash do conteúdo no nome dos .js/.css (ex.: js/ui.3fa2c1d0.js),
     para o navegador nunca usar uma versão antiga depois de um deploy. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SKIP = new Set(['dist', 'node_modules', '.git', '.netlify', 'servidor.js', 'build.js', 'Jogar.bat',
  'package.json', 'package-lock.json', 'netlify.toml', 'README.md']);
const HASHED = new Set(['.js', '.css']);

const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const toUrl = (p) => p.split(path.sep).join('/');

fs.rmSync(DIST, { recursive: true, force: true });

const renamed = {};   // caminho original -> caminho com hash
let count = 0, bytes = 0;

function copyDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const src = path.join(dir, entry.name);
    const rel = path.relative(ROOT, src);
    if (SKIP.has(rel) || entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) { copyDir(src); continue; }
    if (rel === 'index.html') continue;   // escrita no fim, com as referências atualizadas
    const data = fs.readFileSync(src);
    const ext = path.extname(rel);
    const out = HASHED.has(ext) ? rel.slice(0, -ext.length) + '.' + hash(data) + ext : rel;
    renamed[toUrl(rel)] = toUrl(out);
    fs.mkdirSync(path.dirname(path.join(DIST, out)), { recursive: true });
    fs.writeFileSync(path.join(DIST, out), data);
    count++; bytes += data.length;
  }
}

copyDir(ROOT);

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const [from, to] of Object.entries(renamed)) {
  if (from === to) continue;
  const re = new RegExp(`((?:src|href)=["'])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`, 'g');
  if (!re.test(html)) continue;
  html = html.replace(re, `$1${to}$2`);
}
// confere que nenhuma referência local ficou apontando para um arquivo que não existe
const missing = [...html.matchAll(/(?:src|href)=["']([^"':#?]+)["']/g)].map((m) => m[1])
  .filter((u) => !/^(https?:)?\/\//.test(u) && !fs.existsSync(path.join(DIST, u)));
if (missing.length) { console.error('❌ Referências quebradas no index.html:', missing); process.exit(1); }

fs.writeFileSync(path.join(DIST, 'index.html'), html);
count++; bytes += Buffer.byteLength(html);

console.log(`✅ dist/ gerada: ${count} arquivos, ${(bytes / 1024).toFixed(0)} KB`);
for (const [from, to] of Object.entries(renamed)) if (from !== to) console.log(`   ${from} → ${to}`);
