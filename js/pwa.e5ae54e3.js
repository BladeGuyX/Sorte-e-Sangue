'use strict';
/* ============================================================
   SORTE & SANGUE — app instalável (PWA)
   Registra o service worker (só em https, ou seja, no site publicado)
   e mostra o botão "📲 Instalar app" no menu quando faz sentido.
   ============================================================ */

const PWA = {
  prompt: null,   // evento de instalação guardado (Chrome/Edge/Android)

  standalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  isIOS: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  touch: () => matchMedia('(pointer: coarse)').matches,

  refresh() {
    const b = $('#btnInstall');
    if (b) b.hidden = this.standalone() || !(this.prompt || this.touch());
  },

  async install() {
    if (this.prompt) {
      this.prompt.prompt();
      await this.prompt.userChoice.catch(() => null);
      this.prompt = null;
      this.refresh();
      return;
    }
    const local = location.protocol !== 'https:';
    const how = this.isIOS()
      ? '<ol><li>Abra o jogo no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li><li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li></ol>'
      : '<ol><li>Abra o jogo no <b>Chrome</b>.</li><li>Toque no menu <b>⋮</b> (canto superior direito).</li><li>Escolha <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li></ol>';
    modal({ title: '📲 Instalar o Sorte & Sangue',
      html: `${local ? '<p class="set-note">⚠ A instalação como app só funciona no site publicado (endereço com <b>https://</b>, como o do Netlify). Pelo endereço local o navegador só cria um atalho.</p>' : ''}
        ${how}<p>Depois disso o jogo aparece com ícone próprio, abre em tela cheia e funciona até sem internet (menos o modo online).</p>`,
      buttons: [{ label: 'Entendi', value: null, cls: 'primary' }] });
  },
};

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sem app offline, o site funciona normal */ }));
}
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); PWA.prompt = e; PWA.refresh(); });
addEventListener('appinstalled', () => { PWA.prompt = null; PWA.refresh(); });
document.addEventListener('click', (e) => { if (e.target.closest('#btnInstall')) { SFX.play('click'); PWA.install(); } });
PWA.refresh();
