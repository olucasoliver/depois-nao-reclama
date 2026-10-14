/* Pendências do Início, Produção (tarefas), Orçamento e Divulgação.
   Direção e Produção editam; o elenco consulta Produção e Divulgação.
   O orçamento só é visível para Direção e Produção. */

/* ---------- Datas ---------- */
function diaISO(d) { return dataLocalISO(d || new Date()); }
function diasAte(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso + 'T00:00:00') - new Date(diaISO() + 'T00:00:00')) / 86400000);
}
function dataCurta(iso) { return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''; }
function moeda(v) { const n = Number(v) || 0; return (n < 0 ? '- ' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function nomesDaEquipe() {
  const nomes = (DB.perfis || []).filter(p => p.status === 'aprovado').map(p => p.nome)
    .concat(DB.elenco.map(e => e.nome_artistico || e.nome)).filter(Boolean);
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b));
}
function datalist(id, valores) { return '<datalist id="' + id + '">' + valores.map(v => '<option value="' + esc(v) + '">').join('') + '</datalist>'; }

/* ---------- Pendências no Início ---------- */
function blocoPendencias() {
  const linhas = [];
  const add = (texto, pagina, nivel) => linhas.push('<a href="#" class="pend ' + (nivel || '') + '" onclick="go(\'' + pagina + '\');return false">' + texto + '</a>');
  const abertas = DB.tarefas.filter(t => t.status !== 'Concluído');
  const atrasadas = abertas.filter(t => t.prazo && diasAte(t.prazo) < 0);
  const semana = abertas.filter(t => t.prazo && diasAte(t.prazo) >= 0 && diasAte(t.prazo) <= 7);
  if (atrasadas.length) add('<b>' + atrasadas.length + ' tarefa' + (atrasadas.length > 1 ? 's' : '') + ' atrasada' + (atrasadas.length > 1 ? 's' : '') + '</b>: ' +
    atrasadas.slice(0, 3).map(t => esc(t.titulo)).join(', ') + (atrasadas.length > 3 ? '...' : ''), 'producao', 'urgente');
  if (semana.length) add(semana.length + ' tarefa' + (semana.length > 1 ? 's vencem' : ' vence') + ' nos próximos 7 dias', 'producao');

  const grade = typeof esqSelecionadas === 'function' ? esqSelecionadas() : [];
  const semDur = grade.filter(e => !e.duracao_min).length;
  const semPers = grade.filter(e => !personagensDe(e.id).length).length;
  const semAtor = grade.filter(e => personagensDe(e.id).some(p => !p.elenco_id)).length;
  const itensAbertos = grade.flatMap(e => itensDe(e.id)).filter(i => !i.pronto).length;
  if (semPers) add(semPers + ' esquete' + (semPers > 1 ? 's' : '') + ' da grade sem personagens cadastrados', 'espetaculo');
  if (semAtor) add(semAtor + ' esquete' + (semAtor > 1 ? 's' : '') + ' da grade com personagem sem ator', 'espetaculo');
  if (semDur) add(semDur + ' esquete' + (semDur > 1 ? 's' : '') + ' da grade sem duração', 'espetaculo');
  if (itensAbertos) add(itensAbertos + ' ' + (itensAbertos > 1 ? 'itens' : 'item') + ' de cena ainda não pronto' + (itensAbertos > 1 ? 's' : ''), 'espetaculo');

  const proximos = DB.ensaios.filter(x => typeof ensaioPassou === 'function' && !ensaioPassou(x) && x.status !== 'Cancelado');
  const eu = typeof meuElenco === 'function' ? meuElenco() : null;
  if (eu) {
    const meusSem = proximos.filter(x => convocadosDe(x).some(e => e.id === eu.id) && !(presencaDe(x.id, eu.id) || {}).resposta).length;
    if (meusSem) add('Você tem <b>' + meusSem + ' convocaç' + (meusSem > 1 ? 'ões' : 'ão') + '</b> sem resposta', 'ensaios', 'urgente');
  }
  if (eGestao()) {
    const semResp = proximos.reduce((s, x) => s + contagemRespostas(x).sem, 0);
    if (semResp) add(semResp + ' resposta' + (semResp > 1 ? 's' : '') + ' de convocação pendente' + (semResp > 1 ? 's' : ''), 'ensaios');
    const pend = pedidosPendentes().length, ajustes = meusAjustes().length;
    if (eDirecao() && pend) linhas.unshift('<a href="#" class="pend urgente" onclick="go(\'aprovacoes\');return false"><b>' + pend + ' pedido' + (pend > 1 ? 's' : '') + '</b> aguardando sua aprovação</a>');
    if (!eDirecao() && ajustes) linhas.unshift('<a href="#" class="pend urgente" onclick="go(\'aprovacoes\');return false"><b>' + ajustes + ' pedido' + (ajustes > 1 ? 's' : '') + '</b> com ajustes pedidos pela direção</a>');
    if (!eDirecao() && pend) add(pend + ' pedido' + (pend > 1 ? 's' : '') + ' aguardando a direção', 'aprovacoes');
  }
  return '<div class="card"><h2>Pendências</h2>' + (linhas.length ? linhas.join('') : '<div class="empty">Nada pendente por enquanto.</div>') + '</div>';
}

/* ---------- Produção ---------- */
let tarefaEditando = null, filtroTarefas = 'Todas';
const STATUS_TAREFA = ['A fazer', 'Em andamento', 'Concluído'];

function minhaTarefa(t) {
  const meu = (DB.perfil && DB.perfil.nome || '').trim().toLowerCase();
  return !!meu && (t.responsavel || '').toLowerCase().includes(meu.split(' ')[0]);
}
function producao() {
  const gest = eGestao();
  const filtrar = t => filtroTarefas === 'Todas' || (filtroTarefas === 'Minhas' && minhaTarefa(t)) ||
    (filtroTarefas === 'Atrasadas' && t.status !== 'Concluído' && t.prazo && diasAte(t.prazo) < 0);
  const ordenar = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999');
  const prazoTag = t => {
    if (!t.prazo) return '';
    const d = diasAte(t.prazo);
    if (t.status === 'Concluído') return '<div class="meta">Prazo: ' + dataCurta(t.prazo) + '</div>';
    if (d < 0) return '<div class="meta"><span class="chip nao">Atrasada · ' + dataCurta(t.prazo) + '</span></div>';
    if (d <= 7) return '<div class="meta"><span class="chip aviso">' + (d === 0 ? 'Vence hoje' : 'Vence em ' + d + ' dia' + (d > 1 ? 's' : '')) + '</span></div>';
    return '<div class="meta">Prazo: ' + dataCurta(t.prazo) + '</div>';
  };
  const colunas = STATUS_TAREFA.map((st, i) => {
    const lista = DB.tarefas.filter(t => (t.status || 'A fazer') === st && filtrar(t)).sort(ordenar);
    return '<div class="col"><h3>' + st + ' <span class="meta">(' + lista.length + ')</span></h3>' +
      (lista.map(t => '<div class="item">' +
        '<div style="font-weight:800">' + esc(t.titulo) + '</div>' +
        (t.categoria ? '<div class="meta">' + esc(t.categoria) + '</div>' : '') +
        (t.responsavel ? '<div class="meta">Responsável: ' + esc(t.responsavel) + '</div>' : '') +
        prazoTag(t) +
        (t.precisa_aprovacao ? '<div class="meta">' + (chipAprovacao(t.aprovacao) || '<span class="chip">Precisa de aprovação</span>') + '</div>' : '') +
        (t.observacoes ? '<div class="meta">' + esc(t.observacoes) + '</div>' : '') +
        (gest ? '<div class="itemAcoes">' +
          (i > 0 ? '<button class="filter" title="Voltar" onclick="moverTarefa(\'' + t.id + '\',\'' + STATUS_TAREFA[i - 1] + '\')">←</button>' : '') +
          (i < 2 ? '<button class="filter" title="Avançar" onclick="moverTarefa(\'' + t.id + '\',\'' + STATUS_TAREFA[i + 1] + '\')">→</button>' : '') +
          (t.precisa_aprovacao && t.status !== 'Concluído' ? botaoEnviarAprovacao('Tarefa', t) : '') +
          '<button class="filter" onclick="abrirTarefa(\'' + t.id + '\')">Editar</button>' +
          '<button class="filter" onclick="excluirTarefa(\'' + t.id + '\')">Excluir</button></div>' : '') +
        '</div>').join('') || '<div class="empty">Nenhuma</div>') + '</div>';
  }).join('');
  const atrasadas = DB.tarefas.filter(t => t.status !== 'Concluído' && t.prazo && diasAte(t.prazo) < 0).length;
  shell('Produção', 'Tarefas da montagem, do que falta fazer ao que já está pronto',
    '<div class="topoAcoes"><div class="filters">' + ['Todas', 'Minhas', 'Atrasadas'].map(f =>
      '<button class="filter ' + (filtroTarefas === f ? 'active' : '') + '" onclick="filtroTarefas=\'' + f + '\';render()">' + f +
      (f === 'Atrasadas' && atrasadas ? ' (' + atrasadas + ')' : '') + '</button>').join('') + '</div>' +
    (gest ? '<button class="btn" onclick="abrirTarefa()">+ Nova tarefa</button>' : '') + '</div>' +
    '<div class="kanban">' + colunas + '</div>' +
    '<div class="section notice">Use a Produção para o que precisa ser <b>feito</b> durante a montagem. O <b>Checklist Final</b> é para conferir, perto da estreia, que cada coisa está pronta.</div>' +
    modalTarefa());
}
function modalTarefa() {
  return '<div id="tarefaModal" class="modal" onclick="if(event.target===this)fecharTarefa()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Produção</div><h2 id="tarefaTitulo">Nova tarefa</h2></div><button class="close" onclick="fecharTarefa()">×</button></div>' +
    '<div class="formgrid"><div class="field full"><label>Tarefa</label><input id="tTitulo" placeholder="Ex.: Comprar tecido do figurino"></div>' +
    '<div class="field"><label>Categoria</label><input id="tCategoria" list="listaCatTarefa" placeholder="Ex.: Figurino, cenário, divulgação"></div>' +
    '<div class="field"><label>Responsável</label><input id="tResponsavel" list="listaEquipe" placeholder="Nome"></div>' +
    '<div class="field"><label>Status</label><select id="tStatus">' + STATUS_TAREFA.map(s => '<option>' + s + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Prazo</label><input id="tPrazo" type="date"></div>' +
    '<div class="field full"><label>Observações</label><textarea id="tObs" placeholder="Detalhes da tarefa..."></textarea></div>' +
    '<label class="checkLinha full"><input type="checkbox" id="tPrecisa"> Precisa da aprovação da direção antes de ser concluída</label></div>' +
    '<div class="modalactions"><button class="filter" onclick="fecharTarefa()">Cancelar</button><button class="btn" onclick="salvarTarefa()">Salvar tarefa</button></div>' +
    datalist('listaEquipe', nomesDaEquipe()) + datalist('listaCatTarefa', [...new Set(DB.tarefas.map(t => t.categoria).filter(Boolean))]) +
    '</div></div>';
}
function abrirTarefa(id) {
  tarefaEditando = id ? DB.tarefas.find(x => x.id === id) : null;
  const r = tarefaEditando;
  document.getElementById('tarefaModal').classList.add('show');
  document.getElementById('tarefaTitulo').textContent = r ? 'Editar tarefa' : 'Nova tarefa';
  document.getElementById('tTitulo').value = r ? r.titulo || '' : '';
  document.getElementById('tCategoria').value = r ? r.categoria || '' : '';
  document.getElementById('tResponsavel').value = r ? r.responsavel || '' : '';
  document.getElementById('tStatus').value = r && r.status ? r.status : 'A fazer';
  document.getElementById('tPrazo').value = r ? r.prazo || '' : '';
  document.getElementById('tObs').value = r ? r.observacoes || '' : '';
  const ck = document.getElementById('tPrecisa');
  ck.checked = !!(r && r.precisa_aprovacao); ck.disabled = !!(r && r.precisa_aprovacao && !eDirecao());
}
function fecharTarefa() { const m = document.getElementById('tarefaModal'); if (m) m.classList.remove('show'); tarefaEditando = null; }
async function salvarTarefa() {
  const titulo = document.getElementById('tTitulo').value.trim();
  if (!titulo) return alert('Informe a tarefa.');
  const payload = {
    titulo, categoria: document.getElementById('tCategoria').value.trim(), responsavel: document.getElementById('tResponsavel').value.trim(),
    status: document.getElementById('tStatus').value, prazo: document.getElementById('tPrazo').value || null,
    observacoes: document.getElementById('tObs').value.trim(),
    precisa_aprovacao: document.getElementById('tPrecisa').checked
  };
  const r = tarefaEditando ? await sbClient.from('tarefas_producao').update(payload).eq('id', tarefaEditando.id)
                           : await sbClient.from('tarefas_producao').insert(payload);
  if (r.error) return alert('Não foi possível salvar a tarefa: ' + r.error.message);
  fecharTarefa(); await load();
}
async function moverTarefa(id, status) {
  const r = await sbClient.from('tarefas_producao').update({ status }).eq('id', id);
  if (r.error) return alert('Não foi possível mover: ' + r.error.message);
  await load();
}
async function excluirTarefa(id) {
  const row = DB.tarefas.find(x => x.id === id);
  if (!row || !await confirmar('Excluir a tarefa "' + row.titulo + '"?')) return;
  const r = await sbClient.from('tarefas_producao').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  await load();
}

/* ---------- Orçamento ---------- */
let orcamentoEditando = null, filtroOrc = 'Todos';
const STATUS_ORC = ['Previsto', 'Aprovado', 'Pago', 'Recebido', 'Cancelado'];
const realizado = x => x.status === 'Pago' || x.status === 'Recebido';
const ehReceita = x => x.tipo === 'Receita';

function orcamento() {
  const todos = (DB.orcamento || []).slice();
  const validos = todos.filter(x => x.status !== 'Cancelado');
  const soma = l => l.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const desp = validos.filter(x => !ehReceita(x)), rec = validos.filter(ehReceita);
  const despTotal = soma(desp), despPago = soma(desp.filter(realizado));
  const recTotal = soma(rec), recRecebido = soma(rec.filter(realizado));
  const saldoPrev = recTotal - despTotal, saldoReal = recRecebido - despPago;

  const porCat = {};
  desp.forEach(x => { const c = x.categoria || 'Sem categoria'; porCat[c] = (porCat[c] || 0) + (Number(x.valor) || 0); });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maior = cats.length ? cats[0][1] : 0;
  const blocoCat = cats.length ? '<div class="section card"><h2>Despesas por categoria</h2>' + cats.map(([c, v]) =>
    '<div class="barra"><div class="barraTopo"><span>' + esc(c) + '</span><b>' + moeda(v) + '</b></div>' +
    '<div class="barraFundo"><div class="barraValor" style="width:' + (maior ? Math.max(3, v / maior * 100) : 0) + '%"></div></div></div>').join('') + '</div>' : '';

  const filtrar = x => filtroOrc === 'Todos' || (filtroOrc === 'Despesas' && !ehReceita(x)) || (filtroOrc === 'Receitas' && ehReceita(x)) ||
    (filtroOrc === 'A pagar' && !ehReceita(x) && !realizado(x) && x.status !== 'Cancelado') ||
    (filtroOrc === 'Cancelados' && x.status === 'Cancelado');
  const lista = todos.filter(filtrar).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || (a.descricao || '').localeCompare(b.descricao || ''));
  const linhas = lista.map(x => '<div class="card orcLinha ' + (x.status === 'Cancelado' ? 'cancelado' : '') + '">' +
    '<div style="flex:1;min-width:200px"><b>' + esc(x.descricao) + '</b>' +
    '<div class="meta">' + [esc(x.categoria || 'Sem categoria'), x.data ? dataCurta(x.data) : null, x.observacoes ? esc(x.observacoes) : null].filter(Boolean).join(' · ') + '</div></div>' +
    '<span class="chip ' + (ehReceita(x) ? 'ok' : '') + '">' + (ehReceita(x) ? 'Receita' : 'Despesa') + '</span>' +
    '<span class="chip ' + (realizado(x) ? 'ok' : x.status === 'Cancelado' ? 'nao' : '') + '">' + esc(x.status || 'Previsto') + '</span>' +
    (!ehReceita(x) && x.status !== 'Cancelado' && x.aprovacao !== 'aprovado' ? chipAprovacao(x.aprovacao) : '') +
    '<b class="orcValor ' + (ehReceita(x) ? 'pos' : '') + '">' + (ehReceita(x) ? '+ ' : '- ') + moeda(x.valor) + '</b>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (!ehReceita(x) && x.status !== 'Cancelado' ? botaoEnviarAprovacao('Orçamento', x) : '') +
    '<button class="filter" onclick="abrirOrcamento(\'' + x.id + '\')">Editar</button>' +
    '<button class="filter" onclick="excluirOrcamento(\'' + x.id + '\')">Excluir</button></div></div>').join('');

  shell('Orçamento', 'Despesas e receitas da montagem · cancelados não entram na conta',
    '<div class="grid">' +
    '<div class="stat"><b>' + moeda(despTotal) + '</b><span>Despesas · ' + moeda(despPago) + ' pago</span></div>' +
    '<div class="stat"><b>' + moeda(recTotal) + '</b><span>Receitas · ' + moeda(recRecebido) + ' recebido</span></div>' +
    '<div class="stat"><b class="' + (saldoPrev < 0 ? 'neg' : '') + '">' + moeda(saldoPrev) + '</b><span>Saldo previsto</span></div>' +
    '<div class="stat"><b class="' + (saldoReal < 0 ? 'neg' : '') + '">' + moeda(saldoReal) + '</b><span>Saldo em caixa</span></div></div>' +
    blocoCat +
    '<div class="section topoAcoes"><div class="filters">' + ['Todos', 'Despesas', 'Receitas', 'A pagar', 'Cancelados'].map(f =>
      '<button class="filter ' + (filtroOrc === f ? 'active' : '') + '" onclick="filtroOrc=\'' + f + '\';render()">' + f + '</button>').join('') + '</div>' +
    '<button class="btn" onclick="abrirOrcamento()">+ Novo lançamento</button></div>' +
    (linhas || '<div class="empty">Nenhum lançamento neste filtro.</div>') + modalOrcamento());
}
function modalOrcamento() {
  return '<div id="orcModal" class="modal" onclick="if(event.target===this)fecharOrcamento()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Financeiro</div><h2 id="orcTitulo">Novo lançamento</h2></div><button class="close" onclick="fecharOrcamento()">×</button></div>' +
    (eDirecao() ? '' : '<div class="notice">Gastos só podem ficar como <b>Aprovado</b> ou <b>Pago</b> depois da aprovação da direção. Salve como Previsto e use <b>Enviar para aprovação</b>.</div>') +
    '<div class="formgrid">' +
    '<div class="field"><label>Tipo</label><select id="oTipo"><option>Despesa</option><option>Receita</option></select></div>' +
    '<div class="field"><label>Status</label><select id="oStatus">' + STATUS_ORC.map(s => '<option>' + s + '</option>').join('') + '</select></div>' +
    '<div class="field full"><label>Descrição</label><input id="oDescricao" placeholder="Ex.: Aluguel do teatro, venda de ingressos"></div>' +
    '<div class="field"><label>Categoria</label><input id="oCategoria" list="listaCatOrc" placeholder="Ex.: Espaço, figurino, bilheteria"></div>' +
    '<div class="field"><label>Valor (R$)</label><input id="oValor" type="number" min="0" step="0.01" placeholder="0,00"></div>' +
    '<div class="field"><label>Data (vencimento ou pagamento)</label><input id="oData" type="date"></div>' +
    '<div class="field full"><label>Observações</label><textarea id="oObs" placeholder="Fornecedor, forma de pagamento, combinados..."></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharOrcamento()">Cancelar</button><button class="btn" onclick="salvarOrcamento()">Salvar lançamento</button></div>' +
    datalist('listaCatOrc', [...new Set((DB.orcamento || []).map(x => x.categoria).filter(Boolean))]) + '</div></div>';
}
function abrirOrcamento(id) {
  orcamentoEditando = id ? (DB.orcamento || []).find(x => x.id === id) : null;
  const r = orcamentoEditando;
  document.getElementById('orcModal').classList.add('show');
  document.getElementById('orcTitulo').textContent = r ? 'Editar lançamento' : 'Novo lançamento';
  document.getElementById('oTipo').value = r && r.tipo === 'Receita' ? 'Receita' : 'Despesa';
  document.getElementById('oStatus').value = r && r.status ? r.status : 'Previsto';
  document.getElementById('oDescricao').value = r ? r.descricao || '' : '';
  document.getElementById('oCategoria').value = r ? r.categoria || '' : '';
  document.getElementById('oValor').value = r ? r.valor ?? '' : '';
  document.getElementById('oData').value = r ? r.data || '' : '';
  document.getElementById('oObs').value = r ? r.observacoes || '' : '';
}
function fecharOrcamento() { const m = document.getElementById('orcModal'); if (m) m.classList.remove('show'); orcamentoEditando = null; }
async function salvarOrcamento() {
  const descricao = document.getElementById('oDescricao').value.trim();
  if (!descricao) return alert('Informe a descrição.');
  const tipo = document.getElementById('oTipo').value;
  let status = document.getElementById('oStatus').value;
  if (tipo === 'Receita' && status === 'Pago') status = 'Recebido';
  if (tipo === 'Despesa' && status === 'Recebido') status = 'Pago';
  const payload = {
    tipo, status, descricao, categoria: document.getElementById('oCategoria').value.trim(),
    valor: Number(document.getElementById('oValor').value) || 0, data: document.getElementById('oData').value || null,
    observacoes: document.getElementById('oObs').value.trim()
  };
  const r = orcamentoEditando ? await sbClient.from('orcamento').update(payload).eq('id', orcamentoEditando.id)
                              : await sbClient.from('orcamento').insert(payload);
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  fecharOrcamento(); await load();
}
async function excluirOrcamento(id) {
  if (!await confirmar('Excluir este lançamento do orçamento?')) return;
  const r = await sbClient.from('orcamento').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  await load();
}

/* ---------- Divulgação ---------- */
let divulgacaoEditando = null;
const FASES = ['Teaser', 'Revelação', 'Vendas', 'Reta final', 'Pós-estreia'];
const STATUS_DIV = ['Planejado', 'Em produção', 'Aguardando aprovação', 'Aprovado', 'Agendado', 'Publicado', 'Cancelado'];
const CANAIS = ['Instagram', 'TikTok', 'Facebook', 'Site', 'WhatsApp', 'Imprensa', 'Outro'];

function divulgacao() {
  const gest = eGestao(), dir = eDirecao();
  const todos = (DB.divulgacao || []).slice().sort((a, b) => (a.data_publicacao || '9999').localeCompare(b.data_publicacao || '9999'));
  const faseDe = x => FASES.includes(x.fase) ? x.fase : 'Sem fase';
  const grupos = FASES.concat(['Sem fase']).map(f => [f, todos.filter(x => faseDe(x) === f)]).filter(([, l]) => l.length);
  const publicadas = todos.filter(x => x.status === 'Publicado').length;
  const aguardando = todos.filter(x => x.status === 'Aguardando aprovação').length;
  const semana = todos.filter(x => x.status !== 'Publicado' && x.status !== 'Cancelado' && x.data_publicacao && diasAte(x.data_publicacao) >= 0 && diasAte(x.data_publicacao) <= 7).length;
  const chipStatus = s => '<span class="chip ' + (s === 'Publicado' || s === 'Aprovado' ? 'ok' : s === 'Cancelado' ? 'nao' : s === 'Aguardando aprovação' ? 'aviso' : '') + '">' + esc(s || 'Planejado') + '</span>';
  const cartao = x => '<div class="card divLinha ' + (x.status === 'Cancelado' ? 'cancelado' : '') + '">' +
    '<div class="divData">' + (x.data_publicacao ? dataCurta(x.data_publicacao) : 's/ data') + '</div>' +
    '<div style="flex:1;min-width:200px"><b>' + esc(x.titulo) + '</b>' +
    '<div class="meta">' + [esc(x.canal || 'Canal a definir'), x.responsavel ? 'Responsável: ' + esc(x.responsavel) : null].filter(Boolean).join(' · ') + '</div>' +
    (x.observacoes ? '<div class="meta">' + esc(x.observacoes) + '</div>' : '') +
    (x.link ? '<div class="meta"><a href="' + attr(x.link) + '" target="_blank" rel="noopener" class="tituloLink">Ver arte ↗</a></div>' : '') + '</div>' +
    chipStatus(x.status) + (['ajustes', 'recusado'].includes(x.aprovacao) ? chipAprovacao(x.aprovacao) : '') +
    (dir && (x.status === 'Aguardando aprovação' || x.aprovacao === 'pendente') ? '<button class="btn" onclick="aprovarDivulgacao(\'' + x.id + '\')">Aprovar</button>' : '') +
    (x.status !== 'Cancelado' ? botaoEnviarAprovacao('Divulgação', x) : '') +
    (gest ? '<div style="display:flex;gap:6px"><button class="filter" onclick="abrirDivulgacao(\'' + x.id + '\')">Editar</button>' +
      '<button class="filter" onclick="excluirDivulgacao(\'' + x.id + '\')">Excluir</button></div>' : '') + '</div>';
  shell('Divulgação', 'Campanha do espetáculo, organizada por fase',
    '<div class="grid">' +
    '<div class="stat"><b>' + todos.length + '</b><span>Ações planejadas</span></div>' +
    '<div class="stat"><b>' + semana + '</b><span>Saem nos próximos 7 dias</span></div>' +
    '<div class="stat"><b>' + aguardando + '</b><span>Aguardando aprovação</span></div>' +
    '<div class="stat"><b>' + publicadas + '</b><span>Publicadas</span></div></div>' +
    (gest ? '<div class="section" style="display:flex;justify-content:flex-end"><button class="btn" onclick="abrirDivulgacao()">+ Nova ação</button></div>' : '') +
    (grupos.length ? grupos.map(([f, l]) => '<div class="section"><h2>' + f + ' <span class="meta">(' + l.length + ')</span></h2>' + l.map(cartao).join('') + '</div>').join('')
      : '<div class="empty section">Nenhuma ação de divulgação cadastrada.</div>') +
    modalDivulgacao());
}
function modalDivulgacao() {
  return '<div id="divModal" class="modal" onclick="if(event.target===this)fecharDivulgacao()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Divulgação</div><h2 id="divTitulo">Nova ação</h2></div><button class="close" onclick="fecharDivulgacao()">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Título / ação</label><input id="dTitulo" placeholder="Ex.: Post de revelação do título"></div>' +
    '<div class="field"><label>Fase da campanha</label><select id="dFase"><option value="">Sem fase</option>' + FASES.map(f => '<option>' + f + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Canal</label><select id="dCanal">' + CANAIS.map(c => '<option>' + c + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Data de publicação</label><input id="dData" type="date"></div>' +
    '<div class="field"><label>Status</label><select id="dStatus">' + STATUS_DIV.map(s => '<option>' + s + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Responsável</label><input id="dResponsavel" list="listaEquipeDiv" placeholder="Nome"></div>' +
    '<div class="field"><label>Link da arte</label><input id="dLink" placeholder="Drive, Canva, Instagram..."></div>' +
    '<div class="field full"><label>Briefing e observações</label><textarea id="dObs" placeholder="Formato, texto da legenda, referências..."></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharDivulgacao()">Cancelar</button><button class="btn" onclick="salvarDivulgacao()">Salvar</button></div>' +
    datalist('listaEquipeDiv', nomesDaEquipe()) + '</div></div>';
}
function abrirDivulgacao(id) {
  divulgacaoEditando = id ? (DB.divulgacao || []).find(x => x.id === id) : null;
  const r = divulgacaoEditando;
  document.getElementById('divModal').classList.add('show');
  document.getElementById('divTitulo').textContent = r ? 'Editar ação' : 'Nova ação';
  document.getElementById('dTitulo').value = r ? r.titulo || '' : '';
  document.getElementById('dFase').value = r && FASES.includes(r.fase) ? r.fase : '';
  document.getElementById('dCanal').value = r && CANAIS.includes(r.canal) ? r.canal : 'Instagram';
  document.getElementById('dData').value = r ? r.data_publicacao || '' : '';
  document.getElementById('dStatus').value = r && STATUS_DIV.includes(r.status) ? r.status : 'Planejado';
  document.getElementById('dResponsavel').value = r ? r.responsavel || '' : '';
  document.getElementById('dLink').value = r ? r.link || '' : '';
  document.getElementById('dObs').value = r ? r.observacoes || '' : '';
}
function fecharDivulgacao() { const m = document.getElementById('divModal'); if (m) m.classList.remove('show'); divulgacaoEditando = null; }
async function salvarDivulgacao() {
  const titulo = document.getElementById('dTitulo').value.trim();
  if (!titulo) return alert('Informe o título da ação.');
  let link = document.getElementById('dLink').value.trim();
  if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
  const payload = {
    titulo, fase: document.getElementById('dFase').value || null, canal: document.getElementById('dCanal').value,
    data_publicacao: document.getElementById('dData').value || null, status: document.getElementById('dStatus').value,
    responsavel: document.getElementById('dResponsavel').value.trim(), link: link || null,
    observacoes: document.getElementById('dObs').value.trim()
  };
  const r = divulgacaoEditando ? await sbClient.from('divulgacao').update(payload).eq('id', divulgacaoEditando.id).select().single()
                               : await sbClient.from('divulgacao').insert(payload).select().single();
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  if (!eDirecao() && r.data && payload.status === 'Aguardando aprovação' && r.data.aprovacao !== 'pendente') {
    const e = await sbClient.rpc('solicitar_aprovacao', { p_tipo: 'Divulgação', p_ref: String(r.data.id), p_titulo: titulo,
      p_descricao: payload.observacoes || null, p_valor: null, p_link: payload.link });
    if (e.error) alert('A ação foi salva, mas não foi possível enviar para aprovação: ' + e.error.message);
  }
  fecharDivulgacao(); await load();
}
async function aprovarDivulgacao(id) {
  const pedido = pedidoAberto('Divulgação', id);
  const r = pedido ? await sbClient.rpc('responder_aprovacao', { p_id: pedido.id, p_decisao: 'aprovado', p_comentario: null })
                   : await sbClient.from('divulgacao').update({ status: 'Aprovado' }).eq('id', id);
  if (r.error) return alert('Não foi possível aprovar: ' + r.error.message);
  await load();
}
async function excluirDivulgacao(id) {
  if (!await confirmar('Excluir esta ação de divulgação?')) return;
  const r = await sbClient.from('divulgacao').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  await load();
}

(function () {
  const s = document.createElement('style');
  s.textContent = '.pend{display:block;padding:11px 0;border-bottom:1px solid var(--line);font-size:14px;color:inherit;text-decoration:none}' +
    '.pend:hover{color:var(--pink)}.pend.urgente{color:#b3261e}.pend:last-child{border-bottom:0}' +
    '.topoAcoes{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px}.topoAcoes .filters{margin:0}' +
    '.itemAcoes{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}.itemAcoes .filter{padding:6px 10px}' +
    '.chip.aviso{background:#fff0bd;color:#7a5a00}' +
    '.orcLinha,.divLinha{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}' +
    '.orcValor{min-width:120px;text-align:right;color:#b3261e}.orcValor.pos{color:var(--green)}' +
    '.cancelado{opacity:.55}.stat b.neg{color:#b3261e}' +
    '.barra{margin:12px 0}.barraTopo{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}' +
    '.barraFundo{height:8px;background:#eee8eb;border-radius:99px;overflow:hidden}.barraValor{height:100%;background:var(--pink);border-radius:99px}' +
    '.divData{font-weight:900;font-size:15px;min-width:64px}' +
    '.checkLinha{display:flex;align-items:center;gap:8px;font-size:14px;grid-column:1/-1;cursor:pointer}.checkLinha input{accent-color:var(--pink);width:17px;height:17px}';
  document.head.appendChild(s);
})();
