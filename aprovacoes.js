/* Aprovações: a Produção envia, a Direção aprova, recusa ou pede ajustes.
   As travas (gasto aprovado/pago, peça publicada, tarefa concluída) ficam no banco. */

const TIPO_PAGINA = { 'Orçamento': 'orcamento', 'Divulgação': 'divulgacao', 'Tarefa': 'producao' };
let aprovacaoEnvio = null;

function pedidoAberto(tipo, ref) {
  return (DB.aprovacoes || []).find(a => a.tipo === tipo && String(a.ref_id) === String(ref) && (a.status === 'pendente' || a.status === 'ajustes')) || null;
}
function pedidosPendentes() { return (DB.aprovacoes || []).filter(a => a.status === 'pendente'); }
function meusAjustes() { return (DB.aprovacoes || []).filter(a => a.status === 'ajustes' && a.solicitado_por === (user && user.id)); }
function quandoCurto(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; }

/* Selo da situação, usado em Orçamento, Divulgação e Tarefas */
function chipAprovacao(sit) {
  if (sit === 'pendente') return '<span class="chip aviso">Aguardando a direção</span>';
  if (sit === 'aprovado') return '<span class="chip ok">Aprovado pela direção</span>';
  if (sit === 'ajustes') return '<span class="chip aviso">Ajustes pedidos</span>';
  if (sit === 'recusado') return '<span class="chip nao">Recusado pela direção</span>';
  return '';
}
/* Botão para a Produção enviar um item */
function botaoEnviarAprovacao(tipo, item) {
  if (!eGestao() || eDirecao()) return '';
  if (item.aprovacao === 'pendente' || item.aprovacao === 'aprovado') return '';
  return '<button class="filter destaque" onclick="event.stopPropagation();enviarParaAprovacao(\'' + tipo + '\',\'' + item.id + '\')">' +
    (item.aprovacao === 'ajustes' || item.aprovacao === 'recusado' ? 'Reenviar para aprovação' : 'Enviar para aprovação') + '</button>';
}

/* ---------- Página ---------- */
function aprovacoes() {
  const dir = eDirecao(), todos = (DB.aprovacoes || []).slice();
  const pend = todos.filter(a => a.status === 'pendente');
  const ajustes = todos.filter(a => a.status === 'ajustes');
  const hist = todos.filter(a => !['pendente', 'ajustes'].includes(a.status)).slice(0, 40);

  const cartao = a => {
    const minha = a.solicitado_por === (user && user.id);
    const ev = Array.isArray(a.historico) ? a.historico : [];
    const ultimo = ev.length ? ev[ev.length - 1] : null;
    const pagina = TIPO_PAGINA[a.tipo];
    const acoes = [];
    if (dir && (a.status === 'pendente' || a.status === 'ajustes')) {
      acoes.push('<button class="btn" onclick="decidir(\'' + a.id + '\',\'aprovado\')">Aprovar</button>');
      if (a.status === 'pendente') acoes.push('<button class="filter" onclick="decidir(\'' + a.id + '\',\'ajustes\')">Pedir ajustes</button>');
      acoes.push('<button class="filter" onclick="decidir(\'' + a.id + '\',\'recusado\')">Recusar</button>');
    }
    if (!dir && minha && a.status === 'ajustes') acoes.push('<button class="btn" onclick="reenviarPedido(\'' + a.id + '\')">Ajustar e reenviar</button>');
    if ((minha || dir) && (a.status === 'pendente' || a.status === 'ajustes')) acoes.push('<button class="filter" onclick="cancelarPedido(\'' + a.id + '\')">Cancelar pedido</button>');
    const rotulo = { pendente: 'Aguardando a direção', ajustes: 'Ajustes pedidos', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado' }[a.status];
    const classe = { pendente: 'aviso', ajustes: 'aviso', aprovado: 'ok', recusado: 'nao', cancelado: '' }[a.status];
    return '<div class="card aprCard">' +
      '<div class="ensaioTopo"><div><span class="chip">' + esc(a.tipo) + '</span> <span class="chip ' + classe + '">' + rotulo + '</span>' +
      '<h3>' + esc(a.titulo) + '</h3>' +
      '<div class="meta">Enviado por ' + esc((ev[0] && ev[0].por) || 'equipe') + ' · ' + quandoCurto(a.solicitado_em) + '</div></div>' +
      (a.valor != null ? '<div class="aprValor">' + moeda(a.valor) + '</div>' : '') + '</div>' +
      (a.descricao ? '<div class="fichaBloco">' + esc(a.descricao).replace(/\n/g, '<br>') + '</div>' : '') +
      (a.link ? '<div class="meta" style="margin-top:8px"><a class="tituloLink" href="' + attr(a.link) + '" target="_blank" rel="noopener">Abrir link ↗</a></div>' : '') +
      (a.resposta && a.status !== 'pendente' ? '<div class="resposta-dir"><b>Direção:</b> ' + esc(a.resposta) + '</div>' : '') +
      (ev.length > 1 ? '<details class="hist"><summary>Histórico (' + ev.length + ')</summary>' + ev.map(e =>
        '<div class="meta">' + quandoCurto(e.em) + ' · <b>' + esc(e.por || '') + '</b> ' + esc({ enviado: 'enviou', reenviado: 'reenviou', aprovado: 'aprovou', recusado: 'recusou', ajustes: 'pediu ajustes', cancelado: 'cancelou' }[e.acao] || e.acao) +
        (e.comentario ? ': ' + esc(e.comentario) : '') + '</div>').join('') + '</details>' : '') +
      '<div class="aprAcoes">' + acoes.join('') + (pagina ? '<button class="filter" onclick="go(\'' + pagina + '\')">Ver em ' + esc(a.tipo === 'Tarefa' ? 'Produção' : a.tipo) + '</button>' : '') + '</div></div>';
  };

  shell('Aprovações', dir ? 'Decisões da Produção que dependem de você' : 'Pedidos enviados para a direção',
    '<div style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="novaDecisao()">+ Nova decisão para aprovar</button></div>' +
    '<div class="section"><h2>' + (dir ? 'Aguardando sua decisão' : 'Aguardando a direção') + ' <span class="meta">(' + pend.length + ')</span></h2>' +
    (pend.length ? pend.map(cartao).join('') : '<div class="empty">Nada aguardando.</div>') + '</div>' +
    (ajustes.length ? '<div class="section"><h2>Ajustes pedidos <span class="meta">(' + ajustes.length + ')</span></h2>' + ajustes.map(cartao).join('') + '</div>' : '') +
    (hist.length ? '<div class="section"><h2>Histórico</h2>' + hist.map(cartao).join('') + '</div>' : '') +
    modalAprovacao());
}

/* ---------- Ações ---------- */
async function decidir(id, decisao) {
  let comentario = '';
  if (decisao === 'ajustes') {
    comentario = prompt('O que precisa ser ajustado?', '');
    if (comentario === null) return;
    if (!comentario.trim()) return alert('Escreva o que precisa ser ajustado.');
  } else {
    comentario = prompt(decisao === 'aprovado' ? 'Comentário (opcional):' : 'Motivo da recusa (opcional):', '');
    if (comentario === null) return;
  }
  const r = await sbClient.rpc('responder_aprovacao', { p_id: id, p_decisao: decisao, p_comentario: comentario });
  if (r.error) return alert('Não foi possível responder: ' + r.error.message);
  await load();
}
async function cancelarPedido(id) {
  if (!confirm('Cancelar este pedido de aprovação?')) return;
  const r = await sbClient.rpc('cancelar_aprovacao', { p_id: id });
  if (r.error) return alert('Não foi possível cancelar: ' + r.error.message);
  await load();
}

/* Modal usado para nova decisão, para enviar um item e para reenviar após ajustes */
function modalAprovacao() {
  return '<div id="aprModal" class="modal" onclick="if(event.target===this)fecharAprovacao()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow" id="aprTipo">Decisão</div><h2 id="aprTitulo">Enviar para aprovação</h2></div><button class="close" onclick="fecharAprovacao()">×</button></div>' +
    '<div id="aprAviso"></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>O que precisa ser aprovado</label><input id="aTitulo" placeholder="Ex.: Contratar fotógrafo para a estreia"></div>' +
    '<div class="field full"><label>Detalhes e justificativa</label><textarea id="aDesc" placeholder="Por que, opções consideradas, prazos..."></textarea></div>' +
    '<div class="field"><label>Valor (opcional)</label><input id="aValor" type="number" min="0" step="0.01" placeholder="0,00"></div>' +
    '<div class="field"><label>Link (opcional)</label><input id="aLink" placeholder="Orçamento, arte, referência..."></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharAprovacao()">Cancelar</button><button class="btn" onclick="confirmarEnvio()">Enviar para a direção</button></div></div></div>';
}
function garantirModalAprovacao() {
  if (!document.getElementById('aprModal')) { const d = document.createElement('div'); d.innerHTML = modalAprovacao(); document.body.appendChild(d.firstChild); }
}
function abrirModalAprovacao(cfg) {
  garantirModalAprovacao();
  aprovacaoEnvio = cfg;
  document.getElementById('aprTipo').textContent = cfg.tipo;
  document.getElementById('aprTitulo').textContent = cfg.reenvio ? 'Ajustar e reenviar' : 'Enviar para aprovação';
  document.getElementById('aprAviso').innerHTML = cfg.aviso ? '<div class="notice">' + cfg.aviso + '</div>' : '';
  document.getElementById('aTitulo').value = cfg.titulo || '';
  document.getElementById('aDesc').value = cfg.descricao || '';
  document.getElementById('aValor').value = cfg.valor ?? '';
  document.getElementById('aLink').value = cfg.link || '';
  document.getElementById('aprModal').classList.add('show');
}
function fecharAprovacao() { const m = document.getElementById('aprModal'); if (m) m.classList.remove('show'); aprovacaoEnvio = null; }

function novaDecisao() { abrirModalAprovacao({ tipo: 'Decisão', ref: null }); }
function enviarParaAprovacao(tipo, id) {
  const fonte = tipo === 'Orçamento' ? DB.orcamento : tipo === 'Divulgação' ? DB.divulgacao : DB.tarefas;
  const x = (fonte || []).find(i => String(i.id) === String(id)); if (!x) return;
  const aberto = pedidoAberto(tipo, id);
  abrirModalAprovacao({
    tipo, ref: id, reenvio: !!aberto,
    titulo: x.descricao && tipo === 'Orçamento' ? x.descricao : x.titulo,
    descricao: aberto ? aberto.descricao : (x.observacoes || ''),
    valor: tipo === 'Orçamento' ? x.valor : (aberto ? aberto.valor : ''),
    link: x.link || (aberto ? aberto.link : ''),
    aviso: aberto && aberto.resposta ? '<b>Direção:</b> ' + esc(aberto.resposta) : ''
  });
}
function reenviarPedido(id) {
  const a = (DB.aprovacoes || []).find(x => x.id === id); if (!a) return;
  if (a.ref_id && TIPO_PAGINA[a.tipo]) return enviarParaAprovacao(a.tipo, a.ref_id);
  abrirModalAprovacao({ tipo: a.tipo, ref: a.ref_id || null, reenvio: true, pedidoId: a.ref_id ? null : a.id, titulo: a.titulo, descricao: a.descricao, valor: a.valor, link: a.link,
    aviso: a.resposta ? '<b>Direção:</b> ' + esc(a.resposta) : '' });
}
async function confirmarEnvio() {
  const c = aprovacaoEnvio; if (!c) return;
  const titulo = document.getElementById('aTitulo').value.trim();
  if (!titulo) return alert('Diga o que precisa ser aprovado.');
  let link = document.getElementById('aLink').value.trim();
  if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
  const valor = document.getElementById('aValor').value;
  if (c.pedidoId) { // decisão avulsa reenviada: cancela a antiga e envia de novo
    await sbClient.rpc('cancelar_aprovacao', { p_id: c.pedidoId });
  }
  const r = await sbClient.rpc('solicitar_aprovacao', {
    p_tipo: c.tipo, p_ref: c.ref == null ? null : String(c.ref), p_titulo: titulo,
    p_descricao: document.getElementById('aDesc').value.trim() || null,
    p_valor: valor === '' ? null : Number(valor), p_link: link || null
  });
  if (r.error) return alert('Não foi possível enviar: ' + r.error.message);
  fecharAprovacao(); await load(); alert('Enviado para a direção.');
}

(function () {
  const s = document.createElement('style');
  s.textContent = '.aprCard{margin-bottom:12px}.aprCard h3{margin:8px 0 4px;font-size:16px}' +
    '.aprValor{font-size:20px;font-weight:900;white-space:nowrap}' +
    '.aprAcoes{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}' +
    '.resposta-dir{margin-top:12px;padding:10px 12px;border-radius:10px;background:#fff7e0;font-size:13px}' +
    '.hist{margin-top:10px}.hist summary{cursor:pointer;font-size:12px;color:var(--muted);font-weight:700}.hist .meta{margin:6px 0}' +
    '.filter.destaque{border-color:var(--pink);color:var(--pink);font-weight:700}';
  document.head.appendChild(s);
})();
