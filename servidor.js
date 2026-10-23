'use strict';
/* Servidor local do Sorte & Sangue — sem dependências, só Node.js.
   Uso: node servidor.js [porta] [--dist]   (ou dê dois cliques em "Jogar.bat")
   --dist serve a versão gerada pelo build (a mesma que vai para o Netlify). */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DIST_MODE = process.argv.includes('--dist');
const ROOT = DIST_MODE ? path.join(__dirname, 'dist') : __dirname;
const FIRST_PORT = Number(process.argv.find((a) => /^\d+$/.test(a))) || 8080;
if (DIST_MODE && !fs.existsSync(ROOT)) { console.error('A pasta dist/ não existe. Rode antes: node build.js'); process.exit(1); }
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  // nunca servir nada fora da pasta do jogo
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('Proibido'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Arquivo não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

function listen(port) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < FIRST_PORT + 20) listen(port + 1);   // porta ocupada: tenta a próxima
    else { console.error('Não foi possível iniciar o servidor:', e.message); process.exit(1); }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log('');
    console.log(`  🎲  Sorte & Sangue está no ar!${DIST_MODE ? ' (versão de produção, pasta dist/)' : ''}`);
    console.log(`  👉  ${url}`);
    console.log('');
    console.log('  Deixe esta janela aberta enquanto joga. Feche-a (ou aperte Ctrl+C) para desligar o servidor.');
    if (!process.argv.includes('--sem-navegador')) {
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
      exec(cmd);
    }
  });
}

listen(FIRST_PORT);
