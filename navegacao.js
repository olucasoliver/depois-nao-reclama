/* Navegação no celular (barra inferior + folha "Mais" + topo compacto)
   e pequenos ajustes aplicados a toda página depois de desenhada. */

const ICONES = {
  inicio: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  esquetes: '<path d="M5 4h11l3 3v13H5z M8 10h8 M8 14h8 M8 18h5"/>',
  espetaculo: '<path d="M4 6h16 M4 12h16 M4 18h16"/>',
  ensaios: '<path d="M4 6h16v14H4z M4 10h16 M9 3v5 M15 3v5"/>',
  mais: '<path d="M5 12h.01 M12 12h.01 M19 12h.01"/>'
};
const ATALHOS = [['inicio', 'Início'], ['esquetes', 'Esquetes'], ['espetaculo', 'Grade'], ['ensaios', 'Ensaios']];

function icone(nome) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' + (nome === 'mais' ? 3.4 : 1.8) +
    '" stroke-linecap="round" stroke-linejoin="round">' + ICONES[nome] + '</svg>';
}
function atalhoAtivo(id) {
  return page === id || (id === 'esquetes' && page === 'esquete') || (id === 'ensaios' && page === 'ensaio');
}

function renderBarraInferior() {
  let barra = document.getElementById('barraInferior');
  if (!acessoLiberado) { if (barra) barra.remove(); fecharMais(); document.body.classList.remove('comBarra'); return; }
  if (!barra) { barra = document.createElement('nav'); barra.id = 'barraInferior'; barra.setAttribute('aria-label', 'Atalhos'); document.body.appendChild(barra); }
  document.body.classList.add('comBarra');
  const permitidos = navPermitido().map(x => x[0]);
  const noMais = !ATALHOS.some(a => atalhoAtivo(a[0]));
  const pend = typeof pedidosPendentes === 'function' && eGestao() ? pedidosPendentes().length : 0;
  barra.innerHTML = ATALHOS.filter(a => permitidos.includes(a[0])).map(([id, rot]) => {
    const ativo = atalhoAtivo(id);
    return '<button class="' + (ativo ? 'ativo' : '') + '" onclick="fecharMais();go(\'' + id + '\')"' + (ativo ? ' aria-current="page"' : '') + '>' + icone(id) + '<span>' + rot + '</span></button>';
  }).join('') +
    '<button class="' + (noMais ? 'ativo' : '') + '" onclick="abrirMais()" aria-haspopup="dialog">' + icone('mais') + '<span>Mais</span>' +
    (pend ? '<i class="ponto" aria-label="' + pend + ' aprovações pendentes"></i>' : '') + '</button>';
}

function abrirMais() {
  let f = document.getElementById('folhaMais');
  if (!f) { f = document.createElement('div'); f.id = 'folhaMais'; document.body.appendChild(f); }
  f.innerHTML = '<div class="folhaFundo" onclick="fecharMais()"></div><div class="folha" role="dialog" aria-modal="true" aria-label="Todas as páginas">' +
    '<div class="folhaTopo"><b>Todas as páginas</b><button class="close" onclick="fecharMais()" aria-label="Fechar">×</button></div>' +
    '<div class="folhaLista">' + navPermitido().map(x => '<button class="' + (page === x[0] ? 'ativo' : '') + '" onclick="fecharMais();go(\'' + x[0] + '\')">' + x[1] + '</button>').join('') + '</div>' +
    (DB.perfil ? '<div class="folhaUsuario"><div><b>' + esc(DB.perfil.nome || user.email) + '</b><span>' + esc(funcoesDe(user.id).map(x => x.nome).join(' · ') || 'Consulta') + '</span></div>' +
      '<div class="folhaBotoes"><button class="filter" onclick="fecharMais();go(\'conta\')">Minha conta</button><button class="filter" onclick="fecharMais();sair()">Sair</button></div></div>' : '') +
    '<a class="folhaInsta" href="https://www.instagram.com/arcana.producoes" target="_blank" rel="noopener">Instagram · @arcana.producoes</a></div>';
  f.classList.add('aberta');
  document.body.classList.add('semRolagem');
}
function fecharMais() {
  const f = document.getElementById('folhaMais');
  if (f) f.classList.remove('aberta');
  document.body.classList.remove('semRolagem');
}

/* Faixa fina no topo do celular, no lugar do bloco escuro grande */
function montarTopoCelular() {
  if (document.getElementById('topoCelular')) return;
  const t = document.createElement('header');
  t.id = 'topoCelular';
  t.innerHTML = '<button onclick="fecharMais();go(\'inicio\')">Depois Não Reclama</button>' +
    '<img src="./assets/logos/arcana-horizontal-branco-web.png" alt="Arcana Produções">';
  document.body.insertBefore(t, document.body.firstChild);
}

/* Ajustes feitos em toda página depois de desenhada */
window.ajustarPagina = function () {
  const main = document.getElementById('main');
  if (!main) return;
  const topo = main.querySelector(':scope > .top');
  // Botão principal ("+ Nova esquete" etc.) sozinho numa linha: sobe para o lado do título
  const prox = topo && topo.nextElementSibling;
  if (prox && prox.tagName === 'DIV' && /justify-content:\s*flex-end/.test(prox.getAttribute('style') || '') &&
    prox.children.length && [...prox.children].every(c => c.tagName === 'BUTTON')) {
    prox.removeAttribute('style');
    prox.className = 'topoBotoes';
    topo.appendChild(prox);
  }
};

(function () {
  const navOriginal = window.nav;
  window.nav = function () { navOriginal(); renderBarraInferior(); };
  const goOriginal = window.go;
  window.go = function (p) { const mudou = p !== page; goOriginal(p); if (mudou) window.scrollTo(0, 0); };
  montarTopoCelular();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMais(); });
  // Excluir e Remover ficam mais discretos que Editar, em qualquer página
  new MutationObserver(() => {
    document.querySelectorAll('#main button.filter:not(.discreto)').forEach(b => {
      if (/^\s*(Excluir|Remover)\b/.test(b.textContent)) b.classList.add('discreto');
    });
  }).observe(document.getElementById('main'), { childList: true, subtree: true });
})();
