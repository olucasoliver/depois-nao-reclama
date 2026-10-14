/* Navegação no celular: barra inferior com atalhos e a folha "Mais".
   No computador continua a barra lateral. */

const ARCO_SVG = '<svg class="arco" viewBox="143 143 714 1142" aria-hidden="true">' +
  '<path d="M170 1285V500a330 330 0 0 1 660 0v785" fill="none" stroke="currentColor" stroke-width="54"/>' +
  '<path d="M291 1285V500a209 209 0 0 1 418 0v785" fill="none" stroke="currentColor" stroke-width="54"/>' +
  '<path d="M386 1285V500a114 114 0 0 1 228 0v785z" class="arcoMiolo"/></svg>';

const ICONES = {
  inicio: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  esquetes: '<path d="M5 4h11l3 3v13H5z M8 10h8 M8 14h8 M8 18h5"/>',
  espetaculo: '<path d="M4 6h16 M4 12h16 M4 18h16 M2 6h0 M2 12h0 M2 18h0"/>',
  ensaios: '<path d="M4 6h16v14H4z M4 10h16 M9 3v5 M15 3v5"/>',
  mais: '<path d="M5 12h.01 M12 12h.01 M19 12h.01"/>'
};
const ATALHOS = [['inicio', 'Início'], ['esquetes', 'Esquetes'], ['espetaculo', 'Grade'], ['ensaios', 'Ensaios']];

function icone(nome) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' + (nome === 'mais' ? 3.2 : 1.8) +
    '" stroke-linecap="round" stroke-linejoin="round">' + ICONES[nome] + '</svg>';
}

function renderBarraInferior() {
  let barra = document.getElementById('barraInferior');
  if (!acessoLiberado) { if (barra) barra.remove(); fecharMais(); return; }
  if (!barra) { barra = document.createElement('nav'); barra.id = 'barraInferior'; barra.setAttribute('aria-label', 'Atalhos'); document.body.appendChild(barra); }
  const permitidos = navPermitido().map(x => x[0]);
  const noMais = !ATALHOS.some(a => a[0] === page || (a[0] === 'esquetes' && page === 'esquete') || (a[0] === 'ensaios' && page === 'ensaio'));
  const pend = typeof pedidosPendentes === 'function' && eDirecao() ? pedidosPendentes().length : 0;
  barra.innerHTML = ATALHOS.filter(a => permitidos.includes(a[0])).map(([id, rot]) => {
    const ativo = page === id || (id === 'esquetes' && page === 'esquete') || (id === 'ensaios' && page === 'ensaio');
    return '<button class="' + (ativo ? 'ativo' : '') + '" onclick="fecharMais();go(\'' + id + '\')"' + (ativo ? ' aria-current="page"' : '') + '>' + icone(id) + '<span>' + rot + '</span></button>';
  }).join('') +
    '<button class="' + (noMais ? 'ativo' : '') + '" onclick="abrirMais()" aria-haspopup="dialog">' + icone('mais') + '<span>Mais</span>' +
    (pend ? '<i class="ponto" aria-label="' + pend + ' aprovações pendentes"></i>' : '') + '</button>';
}

function abrirMais() {
  let f = document.getElementById('folhaMais');
  if (!f) { f = document.createElement('div'); f.id = 'folhaMais'; document.body.appendChild(f); }
  const nomes = { checklist: 'Checklist Final', equipe: 'Equipe e acessos' };
  f.innerHTML = '<div class="folhaFundo" onclick="fecharMais()"></div><div class="folha" role="dialog" aria-modal="true" aria-label="Todas as páginas">' +
    '<div class="folhaTopo"><b>Todas as páginas</b><button class="avisoFechar" onclick="fecharMais()" aria-label="Fechar">×</button></div>' +
    '<div class="folhaLista">' + navPermitido().map(x => '<button class="' + (page === x[0] ? 'ativo' : '') + '" onclick="fecharMais();go(\'' + x[0] + '\')">' +
      (nomes[x[0]] || x[1]) + '</button>').join('') + '</div>' +
    (DB.perfil ? '<div class="folhaUsuario"><div><b>' + esc(DB.perfil.nome || user.email) + '</b><span>' + esc(funcoesDe(user.id).map(x => x.nome).join(', ') || 'Consulta') + '</span></div>' +
      '<div><button class="filter" onclick="fecharMais();go(\'conta\')">Minha conta</button> <button class="filter" onclick="fecharMais();sair()">Sair</button></div></div>' : '') +
    '<a class="folhaInsta" href="https://www.instagram.com/arcana.producoes" target="_blank" rel="noopener">@arcana.producoes no Instagram</a></div>';
  f.classList.add('aberta');
  document.body.classList.add('semRolagem');
}
function fecharMais() {
  const f = document.getElementById('folhaMais');
  if (f) f.classList.remove('aberta');
  document.body.classList.remove('semRolagem');
}

/* Barra do topo no celular: símbolo da Arcana + nome do espetáculo */
function montarTopoCelular() {
  if (document.getElementById('topoCelular')) return;
  const t = document.createElement('header');
  t.id = 'topoCelular';
  t.innerHTML = '<span class="topoArco">' + ARCO_SVG + '</span><b>Depois Não Reclama</b>';
  t.onclick = () => go('inicio');
  document.body.insertBefore(t, document.body.firstChild);
}

(function () {
  const navOriginal = window.nav;
  window.nav = function () { navOriginal(); renderBarraInferior(); };
  montarTopoCelular();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMais(); });
})();
