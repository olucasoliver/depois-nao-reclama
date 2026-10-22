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
/* Pessoas que podem ser responsáveis: o elenco com o nome cadastrado no Elenco
   e as contas da equipe que não estão ligadas a ninguém do elenco (sem repetir a mesma pessoa) */
function pessoasDaEquipe() {
  const ordenar = l => [...new Set(l.map(n => String(n || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const tec = DB.tecnica || [];
  const ligados = new Set(DB.elenco.map(e => e.perfil_id).concat(tec.map(e => e.perfil_id)).filter(Boolean));
  const usados = new Set();
  const semRepetir = l => l.filter(n => { const k = n.toLowerCase(); if (usados.has(k)) return false; usados.add(k); return true; });
  const elenco = semRepetir(ordenar(DB.elenco.map(e => e.nome)));
  const grupos = {};
  ['Técnica', 'Staff'].forEach(g => { grupos[g] = semRepetir(ordenar(tec.filter(p => (p.grupo === 'Técnica' ? 'Técnica' : 'Staff') === g).map(p => p.nome))); });
  const comFuncao = (p, nomes) => DB.perfilFuncoes.some(x => x.perfil_id === p.id && nomes.includes((DB.funcoes.find(f => f.id === x.funcao_id) || {}).nome));
  const contas = (DB.perfis || []).filter(p => p.status === 'aprovado' && !ligados.has(p.id));
  const producao = semRepetir(ordenar(contas.filter(p => comFuncao(p, ['Produção', 'Direção'])).map(p => p.nome)));
  const equipe = semRepetir(ordenar(contas.map(p => p.nome)));
  return { elenco, producao, grupos, equipe };
}
function nomesDaEquipe() { const p = pessoasDaEquipe(); return p.elenco.concat(p.producao, ...Object.values(p.grupos), p.equipe); }

function campoResponsavel(id) {
  const p = pessoasDaEquipe();
  const grupo = (rot, l) => l.length ? '<optgroup label="' + rot + '">' + l.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('') + '</optgroup>' : '';
  return '<select id="' + id + '" onchange="responsavelMudou(\'' + id + '\')"><option value="">Sem responsável</option>' +
    grupo('Elenco', p.elenco) + grupo('Direção e Produção', p.producao) + Object.entries(p.grupos).map(([g, l]) => grupo(g, l)).join('') + grupo('Outras contas da equipe', p.equipe) +
    '<option value="__outro">Outra pessoa (fora da equipe)...</option></select>' +
    '<input id="' + id + 'Outro" class="responsavelOutro" placeholder="Nome da pessoa" hidden>';
}
function responsavelMudou(id) {
  const outro = document.getElementById(id + 'Outro'), sel = document.getElementById(id);
  outro.hidden = sel.value !== '__outro';
  if (!outro.hidden) outro.focus();
}
function definirResponsavel(id, valor) {
  const sel = document.getElementById(id), outro = document.getElementById(id + 'Outro');
  if (!sel) return;
  sel.querySelectorAll('option[data-antigo]').forEach(o => o.remove());
  valor = String(valor || '').trim();
  outro.value = ''; outro.hidden = true;
  if (!valor) { sel.value = ''; return; }
  if ([...sel.options].some(o => o.value === valor)) { sel.value = valor; return; }
  // Nome digitado antes ou de alguém de fora: continua aparecendo até alguém escolher outro
  const o = document.createElement('option');
  o.value = valor; o.textContent = valor + ' (fora da lista)'; o.dataset.antigo = '1';
  sel.options[0].after(o);
  sel.value = valor;
}
function lerResponsavel(id) {
  const sel = document.getElementById(id);
  if (!sel) return '';
  return sel.value === '__outro' ? document.getElementById(id + 'Outro').value.trim() : sel.value;
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

/* Entregas: uma demanda pode ter várias datas (ex.: dois teasers em dias diferentes) */
function entregasDe(t) {
  const l = Array.isArray(t.prazos) ? t.prazos.filter(e => e && e.data) : [];
  return l.length ? l.slice().sort((a, b) => a.data.localeCompare(b.data)) : (t.prazo ? [{ data: t.prazo, nome: '', feito: t.status === 'Concluído' }] : []);
}
function proximoPrazo(lista) {
  const pend = lista.filter(e => !e.feito);
  return pend.length ? pend[0].data : (lista.length ? lista[lista.length - 1].data : null);
}
let entregasEditando = [];

function minhaTarefa(t) {
  const resp = (t.responsavel || '').trim().toLowerCase();
  if (!resp) return false;
  const meuEl = user ? DB.elenco.find(e => e.perfil_id === user.id) : null;
  const meus = [DB.perfil && DB.perfil.nome, meuEl && meuEl.nome, meuEl && meuEl.nome_artistico].map(n => String(n || '').trim().toLowerCase()).filter(Boolean);
  return meus.some(n => n === resp) || meus.some(n => resp.includes(n.split(' ')[0]));
}
function producao() {
  const gest = podeArea('tarefas');
  const filtrar = t => filtroTarefas === 'Todas' || (filtroTarefas === 'Minhas' && minhaTarefa(t)) ||
    (filtroTarefas === 'Atrasadas' && t.status !== 'Concluído' && t.prazo && diasAte(t.prazo) < 0);
  const ordenar = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999');
  const prazoTag = t => {
    const ents = entregasDe(t);
    if (!ents.length) return '';
    const feitas = ents.filter(e => e.feito).length;
    const varias = ents.length > 1 ? '<div class="meta">' + ents.length + ' entregas · ' + feitas + ' feita' + (feitas === 1 ? '' : 's') + '</div>' : '';
    const prox = ents.find(e => !e.feito);
    if (t.status === 'Concluído' || !prox) return varias || '<div class="meta">Prazo: ' + dataCurta(ents[ents.length - 1].data) + '</div>';
    const rot = (ents.length > 1 ? 'Próxima' : 'Prazo') + (prox.nome ? ' (' + esc(prox.nome) + ')' : '');
    const d = diasAte(prox.data);
    const tag = d < 0 ? '<span class="chip nao">' + (ents.length > 1 ? 'Entrega atrasada' : 'Atrasada') + ' · ' + dataCurta(prox.data) + '</span>'
      : d <= 7 ? '<span class="chip aviso">' + rot + ': ' + (d === 0 ? 'hoje' : 'em ' + d + ' dia' + (d > 1 ? 's' : '')) + '</span>'
      : rot + ': ' + dataCurta(prox.data);
    return varias + '<div class="meta">' + tag + '</div>';
  };
  const colunas = STATUS_TAREFA.map((st, i) => {
    const lista = DB.tarefas.filter(t => (t.status || 'A fazer') === st && filtrar(t)).sort(ordenar);
    return '<div class="col' + (lista.length ? '' : ' vazia') + '"><h3>' + st + ' <span class="meta">(' + lista.length + ')</span></h3>' +
      (lista.map(t => {
        const resumo = textoPuro(t.observacoes).replace(/\s+/g, ' ').trim();
        return '<div class="item tarefaCard" role="button" tabindex="0" onclick="abrirDetalheTarefa(\'' + t.id + '\')" onkeydown="if(event.key===\'Enter\'&&event.target===this)abrirDetalheTarefa(\'' + t.id + '\')">' +
        '<div style="font-weight:800">' + esc(t.titulo) + '</div>' +
        (t.categoria ? '<div class="meta">' + esc(t.categoria) + '</div>' : '') +
        (t.responsavel ? '<div class="meta">Responsável: ' + esc(t.responsavel) + '</div>' : '') +
        prazoTag(t) +
        (t.precisa_aprovacao ? '<div class="meta">' + (chipAprovacao(t.aprovacao) || '<span class="chip">Precisa de aprovação</span>') + '</div>' : '') +
        (resumo ? '<div class="meta tarefaResumo">' + esc(resumo) + '</div>' : '') +
        '<div class="itemAcoes" onclick="event.stopPropagation()">' +
          (gest ? (i < 2 ? '<button class="filter forte" onclick="moverTarefa(\'' + t.id + '\',\'' + STATUS_TAREFA[i + 1] + '\')">' + (i === 0 ? 'Começar' : 'Concluir') + '</button>' : '') +
            (i === 2 ? '<button class="filter" onclick="moverTarefa(\'' + t.id + '\',\'' + STATUS_TAREFA[1] + '\')">Reabrir</button>' : '') +
            (t.precisa_aprovacao && t.status !== 'Concluído' ? botaoEnviarAprovacao('Tarefa', t) : '') : '') +
          '<button class="filter" onclick="abrirDetalheTarefa(\'' + t.id + '\')">Ver detalhes</button>' +
        '</div></div>';
      }).join('') || '<div class="empty">Nenhuma</div>') + '</div>';
  }).join('');
  const atrasadas = DB.tarefas.filter(t => t.status !== 'Concluído' && t.prazo && diasAte(t.prazo) < 0).length;
  shell('Demandas', 'Tarefas da montagem, do que falta fazer ao que já está pronto',
    '<div class="topoAcoes"><div class="filters">' + ['Todas', 'Minhas', 'Atrasadas'].map(f =>
      '<button class="filter ' + (filtroTarefas === f ? 'active' : '') + '" onclick="filtroTarefas=\'' + f + '\';render()">' + f +
      (f === 'Atrasadas' && atrasadas ? ' (' + atrasadas + ')' : '') + '</button>').join('') + '</div>' +
    (gest ? '<button class="btn" onclick="abrirTarefa()">+ Nova tarefa</button>' : '') + '</div>' +
    '<div class="kanban">' + colunas + '</div>' +
    '<div class="section notice">Use as Demandas para o que precisa ser <b>feito</b> durante a montagem. O <b>Checklist Final</b> é para conferir, perto da estreia, que cada coisa está pronta.</div>' +
    modalTarefa() + '<div id="tarefaDetalhe" class="modal" onclick="if(event.target===this)fecharDetalheTarefa()"></div>');
}
function modalTarefa() {
  return '<div id="tarefaModal" class="modal" onclick="if(event.target===this)fecharTarefa()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Produção</div><h2 id="tarefaTitulo">Nova tarefa</h2></div><button class="close" onclick="fecharTarefa()">×</button></div>' +
    '<div class="formgrid"><div class="field full"><label>Tarefa</label><input id="tTitulo" placeholder="Ex.: Comprar tecido do figurino"></div>' +
    '<div class="field"><label>Categoria</label><input id="tCategoria" list="listaCatTarefa" placeholder="Ex.: Figurino, cenário, divulgação"></div>' +
    '<div class="field"><label>Responsável</label>' + campoResponsavel('tResponsavel') + '</div>' +
    '<div class="field"><label>Status</label><select id="tStatus">' + STATUS_TAREFA.map(s => '<option>' + s + '</option>').join('') + '</select></div>' +
    '<div class="field full"><label>Entregas</label><div id="tEntregas" class="entregasLista"></div>' +
    '<button type="button" class="filter" onclick="adicionarEntrega()">+ Adicionar data de entrega</button></div>' +
    '<div class="field full"><label>Observações</label>' + editorRico('tObs', 'Detalhes da tarefa. Use a barra para negrito, itálico, listas e links.') + '</div>' +
    '<label class="checkLinha full"><input type="checkbox" id="tPrecisa"> Precisa da aprovação da direção antes de ser concluída</label></div>' +
    '<div class="modalactions"><button class="filter" onclick="fecharTarefa()">Cancelar</button><button class="btn" onclick="salvarTarefa()">Salvar tarefa</button></div>' +
    datalist('listaCatTarefa', [...new Set(DB.tarefas.map(t => t.categoria).filter(Boolean))]) +
    '</div></div>';
}
function abrirTarefa(id) {
  tarefaEditando = id ? DB.tarefas.find(x => x.id === id) : null;
  const r = tarefaEditando;
  document.getElementById('tarefaModal').classList.add('show');
  document.getElementById('tarefaTitulo').textContent = r ? 'Editar tarefa' : 'Nova tarefa';
  document.getElementById('tTitulo').value = r ? r.titulo || '' : '';
  document.getElementById('tCategoria').value = r ? r.categoria || '' : '';
  definirResponsavel('tResponsavel', r ? r.responsavel : '');
  document.getElementById('tStatus').value = r && r.status ? r.status : 'A fazer';
  entregasEditando = r ? entregasDe(r).map(e => Object.assign({}, e)) : [];
  if (!entregasEditando.length) entregasEditando.push({ data: '', nome: '', feito: false });
  desenharEntregas();
  definirEditor('tObs', r ? r.observacoes || '' : '');
  const ck = document.getElementById('tPrecisa');
  ck.checked = !!(r && r.precisa_aprovacao); ck.disabled = !!(r && r.precisa_aprovacao && !eDirecao());
}
function abrirDetalheTarefa(id) {
  const t = DB.tarefas.find(x => x.id === id);
  const m = document.getElementById('tarefaDetalhe');
  if (!t || !m) return;
  const gest = podeArea('tarefas'), i = Math.max(0, STATUS_TAREFA.indexOf(t.status || 'A fazer'));
  const linha = (rot, val) => val ? '<div class="detLinha"><span>' + rot + '</span><b>' + val + '</b></div>' : '';
  m.innerHTML = '<div class="modalbox detalheTarefa" role="dialog" aria-modal="true" aria-labelledby="detTitulo">' +
    '<div class="modalhead"><div><div class="eyebrow">' + esc(t.status || 'A fazer') + '</div><h2 id="detTitulo">' + esc(t.titulo) + '</h2></div>' +
    '<button class="close" onclick="fecharDetalheTarefa()" aria-label="Fechar">×</button></div>' +
    '<div class="detInfo">' + linha('Categoria', esc(t.categoria || '')) + linha('Responsável', esc(t.responsavel || '')) +
    (entregasDe(t).length === 1 ? linha('Prazo', dataCurta(entregasDe(t)[0].data) + (entregasDe(t)[0].nome ? ' · ' + esc(entregasDe(t)[0].nome) : '')) : '') +
    (t.precisa_aprovacao ? linha('Aprovação', chipAprovacao(t.aprovacao) || '<span class="chip">Precisa de aprovação</span>') : '') + '</div>' +
    (entregasDe(t).length > 1 ? '<div class="detEntregas"><div class="detLinha"><span>Entregas</span></div>' + entregasDe(t).map((e, k) => {
      const d = diasAte(e.data);
      const sit = e.feito ? '<span class="chip">Feita</span>' : d < 0 ? '<span class="chip nao">Atrasada</span>' : d <= 7 ? '<span class="chip aviso">' + (d === 0 ? 'Hoje' : 'Em ' + d + ' dia' + (d > 1 ? 's' : '')) + '</span>' : '';
      return '<label class="entregaItem' + (e.feito ? ' feita' : '') + '">' +
        (gest ? '<input type="checkbox"' + (e.feito ? ' checked' : '') + ' onchange="marcarEntrega(\'' + t.id + '\',' + k + ',this.checked)">' : '') +
        '<b>' + dataCurta(e.data) + '</b><span>' + esc(e.nome || 'Entrega ' + (k + 1)) + '</span>' + sit + '</label>';
    }).join('') + '</div>' : '') +
    (t.observacoes ? '<div class="rico detTexto">' + textoRico(t.observacoes) + '</div>' : '<div class="empty">Sem observações.</div>') +
    (gest ? '<div class="modalactions detAcoes">' +
      '<button class="filter" onclick="fecharDetalheTarefa();excluirTarefa(\'' + t.id + '\')">Excluir</button><span style="flex:1"></span>' +
      (i > 0 ? '<button class="filter" onclick="fecharDetalheTarefa();moverTarefa(\'' + t.id + '\',\'' + STATUS_TAREFA[i - 1] + '\')">' + (i === 2 ? 'Reabrir' : 'Voltar para A fazer') + '</button>' : '') +
      (t.precisa_aprovacao && t.status !== 'Concluído' ? botaoEnviarAprovacao('Tarefa', t) : '') +
      '<button class="filter" onclick="fecharDetalheTarefa();abrirTarefa(\'' + t.id + '\')">Editar</button>' +
      (i < 2 ? '<button class="btn" onclick="fecharDetalheTarefa();moverTarefa(\'' + t.id + '\',\'' + STATUS_TAREFA[i + 1] + '\')">' + (i === 0 ? 'Começar' : 'Concluir') + '</button>' : '') +
      '</div>' : '') + '</div>';
  m.classList.add('show');
  setTimeout(() => { const c = m.querySelector('.close'); if (c) c.focus(); }, 30);
}
function desenharEntregas() {
  const box = document.getElementById('tEntregas');
  if (!box) return;
  box.innerHTML = entregasEditando.map((e, k) => '<div class="entregaLinha">' +
    '<input type="date" aria-label="Data da entrega ' + (k + 1) + '" value="' + esc(e.data || '') + '" data-k="' + k + '" data-c="data">' +
    '<input type="text" aria-label="Nome da entrega ' + (k + 1) + '" placeholder="' + (entregasEditando.length > 1 ? 'Ex.: Teaser ' + (k + 1) : 'O que entregar (opcional)') + '" value="' + esc(e.nome || '') + '" data-k="' + k + '" data-c="nome">' +
    (entregasEditando.length > 1 ? '<button type="button" class="filter discreto" onclick="removerEntrega(' + k + ')" aria-label="Remover entrega ' + (k + 1) + '">Remover</button>' : '') +
    '</div>').join('');
}
function lerEntregas() {
  document.querySelectorAll('#tEntregas input').forEach(i => { entregasEditando[+i.dataset.k][i.dataset.c] = i.value; });
}
function adicionarEntrega() { lerEntregas(); entregasEditando.push({ data: '', nome: '', feito: false }); desenharEntregas(); const l = document.querySelectorAll('#tEntregas input[type=date]'); if (l.length) l[l.length - 1].focus(); }
function removerEntrega(k) { lerEntregas(); entregasEditando.splice(k, 1); desenharEntregas(); }
async function marcarEntrega(id, k, feito) {
  const t = DB.tarefas.find(x => x.id === id);
  if (!t) return;
  const prazos = entregasDe(t).map(e => Object.assign({}, e));
  prazos[k].feito = feito;
  const r = await sbClient.from('tarefas_producao').update({ prazos, prazo: proximoPrazo(prazos) }).eq('id', id);
  if (r.error) return alert(/prazos/.test(r.error.message) ? 'Falta rodar o arquivo supabase/007_varias_entregas.sql no Supabase (SQL Editor).' : 'Não foi possível marcar a entrega: ' + r.error.message);
  await load();
  abrirDetalheTarefa(id);
  if (feito && prazos.every(e => e.feito) && t.status !== 'Concluído') avisar('Todas as entregas desta demanda foram feitas. Se estiver tudo certo, é só concluir.');
}
function fecharDetalheTarefa() { const m = document.getElementById('tarefaDetalhe'); if (m) { m.classList.remove('show'); m.innerHTML = ''; } }
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDetalheTarefa(); });
function fecharTarefa() { const m = document.getElementById('tarefaModal'); if (m) m.classList.remove('show'); tarefaEditando = null; }
async function salvarTarefa() {
  const titulo = document.getElementById('tTitulo').value.trim();
  if (!titulo) return alert('Informe a tarefa.');
  const payload = {
    titulo, categoria: document.getElementById('tCategoria').value.trim(), responsavel: lerResponsavel('tResponsavel'),
    status: document.getElementById('tStatus').value,
    observacoes: lerEditor('tObs'),
    precisa_aprovacao: document.getElementById('tPrecisa').checked
  };
  lerEntregas();
  const prazos = entregasEditando.filter(e => e.data).map(e => ({ data: e.data, nome: (e.nome || '').trim(), feito: !!e.feito }))
    .sort((a, b) => a.data.localeCompare(b.data));
  payload.prazos = prazos;
  payload.prazo = proximoPrazo(prazos);
  const gravar = p => tarefaEditando ? sbClient.from('tarefas_producao').update(p).eq('id', tarefaEditando.id)
                                     : sbClient.from('tarefas_producao').insert(p);
  let r = await gravar(payload);
  // Enquanto o 007 não foi rodado, uma entrega só ainda pode ser salva no campo antigo
  if (r.error && /prazos/.test(r.error.message) && prazos.length <= 1) { delete payload.prazos; r = await gravar(payload); }
  if (r.error) return alert(/prazos/.test(r.error.message)
    ? 'Para salvar várias datas de entrega, falta rodar o arquivo supabase/007_varias_entregas.sql no Supabase (SQL Editor).'
    : 'Não foi possível salvar a tarefa: ' + r.error.message);
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
  const gest = podeArea('divulgacao'), dir = eDirecao();
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
    '<div class="field"><label>Responsável</label>' + campoResponsavel('dResponsavel') + '</div>' +
    '<div class="field"><label>Link da arte</label><input id="dLink" placeholder="Drive, Canva, Instagram..."></div>' +
    '<div class="field full"><label>Briefing e observações</label><textarea id="dObs" placeholder="Formato, texto da legenda, referências..."></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharDivulgacao()">Cancelar</button><button class="btn" onclick="salvarDivulgacao()">Salvar</button></div>' +
    '</div></div>';
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
  definirResponsavel('dResponsavel', r ? r.responsavel : '');
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
    responsavel: lerResponsavel('dResponsavel'), link: link || null,
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
