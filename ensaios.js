/* Ensaios: convocação, respostas do elenco, presença e relatório.
   Direção e Produção criam e editam ensaios, marcam presença e escrevem o relatório.
   Cada integrante do elenco ligado a uma conta responde se vai ou não. */

let ensaioAtual = null;
let ensaioEditando = null;
const TIPOS_ENSAIO = ['Leitura', 'Marcação', 'Corrido', 'Técnico', 'Geral', 'Outro'];
const STATUS_ENSAIO = ['Planejado', 'Confirmado', 'Realizado', 'Cancelado'];

/* ---------- Auxiliares ---------- */
function meuElenco() { return user ? DB.elenco.find(e => e.perfil_id === user.id) || null : null; }
function esquetesDoEnsaio(eid) {
  return DB.ensaioEsquetes.filter(x => x.ensaio_id === eid)
    .map(x => DB.esquetes.find(s => s.id === x.esquete_id)).filter(Boolean)
    .sort((a, b) => ((a.ordem || 9999) - (b.ordem || 9999)) || (a.numero - b.numero));
}
function convocadosDe(ens) {
  if (ens.convocar_todos) return DB.elenco.slice();
  const ids = new Set(esquetesDoEnsaio(ens.id).flatMap(s => elencoIdsDe(s.id)));
  return DB.elenco.filter(e => ids.has(e.id));
}
function presencaDe(ensId, elId) { return (DB.presencas || []).find(p => p.ensaio_id === ensId && p.elenco_id === elId) || null; }
function ensaioPassou(ens) {
  if (ens.status === 'Realizado') return true;
  if (!ens.data_hora) return false;
  const fim = new Date(ens.data_hora); fim.setHours(23, 59, 59);
  return fim < new Date();
}
function dataEnsaio(ens, curta) {
  if (!ens.data_hora) return 'Data a definir';
  const d = new Date(ens.data_hora);
  let txt = d.toLocaleDateString('pt-BR', curta ? { weekday: 'short', day: '2-digit', month: '2-digit' } : { weekday: 'long', day: 'numeric', month: 'long' });
  txt = txt.charAt(0).toUpperCase() + txt.slice(1);
  return txt + ' · ' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
}
function contagemRespostas(ens) {
  const conv = convocadosDe(ens), r = { total: conv.length, vou: 0, nao: 0, sem: 0, presentes: 0, marcados: 0 };
  conv.forEach(e => {
    const p = presencaDe(ens.id, e.id);
    if (p && p.resposta === 'vou') r.vou++; else if (p && p.resposta === 'nao_vou') r.nao++; else r.sem++;
    if (p && p.presente !== null && p.presente !== undefined) { r.marcados++; if (p.presente) r.presentes++; }
  });
  return r;
}
function textoRespostas(ens) {
  const c = contagemRespostas(ens);
  if (!c.total) return ens.convocar_todos ? 'Nenhum integrante ativo' : 'Ninguém convocado ainda';
  if (ensaioPassou(ens) && c.marcados) return c.presentes + ' de ' + c.total + ' presentes';
  return c.total + ' convocado' + (c.total > 1 ? 's' : '') + ' · ' + c.vou + (c.vou === 1 ? ' vai' : ' vão') + ' · ' + c.nao + (c.nao === 1 ? ' não vai' : ' não vão') + ' · ' + c.sem + ' sem resposta';
}
function chipResposta(p) {
  if (p && p.resposta === 'vou') return '<span class="chip ok">Vai</span>';
  if (p && p.resposta === 'nao_vou') return '<span class="chip nao">Não vai</span>';
  return '<span class="chip">Sem resposta</span>';
}
function abrirEnsaio(id) { ensaioAtual = id; go('ensaio'); window.scrollTo(0, 0); }

/* Card "Próximo ensaio" no Início */
function blocoProximoEnsaio(ens) {
  const eu = meuElenco(), conv = eu && convocadosDe(ens).some(e => e.id === eu.id);
  const p = conv ? presencaDe(ens.id, eu.id) : null;
  return '<div class="muted" style="margin-top:6px">' + esc(ens.local || 'Local a definir') + '</div>' +
    '<div class="muted" style="margin-top:12px">' + textoRespostas(ens) + '</div>' +
    (conv ? '<div style="margin-top:12px">Você está convocado: ' + chipResposta(p) + '</div>' : '') +
    '<div style="margin-top:14px"><button class="filter claro" onclick="abrirEnsaio(\'' + ens.id + '\')">Abrir ensaio</button></div>';
}

/* ---------- Resposta do próprio ator ---------- */
async function responder(ensId, resposta) {
  let motivo = null;
  if (resposta === 'nao_vou') {
    motivo = prompt('Quer dizer o motivo? (opcional)', '');
    if (motivo === null) return;
  }
  const r = await sbClient.rpc('responder_convocacao', { p_ensaio: String(ensId), p_resposta: resposta, p_motivo: motivo });
  if (r.error) return alert('Não foi possível responder: ' + r.error.message);
  await load();
}
function botoesResposta(ens, eu) {
  const p = presencaDe(ens.id, eu.id);
  return '<div class="resposta">' + chipResposta(p) +
    '<button class="filter ' + (p && p.resposta === 'vou' ? 'active' : '') + '" onclick="event.stopPropagation();responder(\'' + ens.id + '\',\'vou\')">Vou</button>' +
    '<button class="filter ' + (p && p.resposta === 'nao_vou' ? 'active' : '') + '" onclick="event.stopPropagation();responder(\'' + ens.id + '\',\'nao_vou\')">Não vou</button></div>';
}

/* ---------- Lista ---------- */
function ensaios() {
  const gest = eGestao(), eu = meuElenco();
  const todos = DB.ensaios.slice().sort((a, b) => (a.data_hora || '9999').localeCompare(b.data_hora || '9999'));
  const futuros = todos.filter(x => !ensaioPassou(x) && x.status !== 'Cancelado');
  const passados = todos.filter(x => ensaioPassou(x) || x.status === 'Cancelado').reverse();

  const meus = eu ? futuros.filter(x => convocadosDe(x).some(e => e.id === eu.id)) : [];
  const blocoMeus = eu
    ? '<div class="section card"><h2>Minhas convocações</h2>' + (meus.length ? meus.map(x =>
        '<div class="linha"><div style="flex:1;min-width:200px"><a href="#" class="tituloLink" onclick="abrirEnsaio(\'' + x.id + '\');return false">' + esc(x.titulo) + '</a>' +
        '<div class="meta">' + dataEnsaio(x, true) + ' · ' + esc(x.local || 'Local a definir') + '</div></div>' + botoesResposta(x, eu) + '</div>').join('')
        : '<div class="empty">Você não tem ensaios marcados por enquanto.</div>') + '</div>'
    : (temFuncao('Elenco') ? '<div class="notice">Sua conta ainda não está ligada ao seu cadastro no elenco, por isso você não consegue responder às convocações. Peça para a produção ligar em Elenco › Editar › Conta na plataforma.</div>' : '');

  const cartao = x => {
    const esqs = esquetesDoEnsaio(x.id);
    return '<div class="card ensaioCard" onclick="abrirEnsaio(\'' + x.id + '\')">' +
      '<div class="ensaioTopo"><div><h3>' + esc(x.titulo) + '</h3>' +
      '<div class="meta">' + dataEnsaio(x) + ' · ' + esc(x.local || 'Local a definir') + '</div></div>' +
      '<div>' + (x.tipo ? '<span class="badge">' + esc(x.tipo) + '</span> ' : '') + '<span class="badge ' + (x.status === 'Cancelado' ? 'nao' : '') + '">' + esc(x.status || 'Planejado') + '</span></div></div>' +
      '<div class="meta">' + (x.convocar_todos ? 'Elenco todo convocado' : (esqs.length ? 'Esquetes: ' + esqs.map(s => esc(s.titulo)).join(', ') : 'Nenhuma esquete marcada')) + '</div>' +
      '<div class="meta"><b>' + textoRespostas(x) + '</b></div></div>';
  };

  shell('Ensaios', 'Calendário, convocação e presença',
    (gest ? '<div style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="abrirModalEnsaio()">+ Novo ensaio</button></div>' : '') +
    blocoMeus +
    '<div class="section"><h2>Próximos</h2>' + (futuros.length ? futuros.map(cartao).join('') : '<div class="empty">Nenhum ensaio marcado.</div>') + '</div>' +
    (passados.length ? '<div class="section"><h2>Já realizados e cancelados</h2>' + passados.map(cartao).join('') + '</div>' : '') +
    modalEnsaio());
}

/* ---------- Ficha do ensaio ---------- */
function ensaioDetalhe() {
  const x = DB.ensaios.find(e => e.id === ensaioAtual);
  if (!x) { page = 'ensaios'; return ensaios(); }
  const gest = eGestao(), eu = meuElenco(), passou = ensaioPassou(x);
  const esqs = esquetesDoEnsaio(x.id), conv = convocadosDe(x);
  const souConvocado = eu && conv.some(e => e.id === eu.id);

  const info = '<div class="card"><div class="fichaTopo"><h2>' + dataEnsaio(x) + '</h2>' +
    (gest ? '<div style="display:flex;gap:6px"><button class="filter" onclick="copiarConvocacao(\'' + x.id + '\')">Copiar convocação</button>' +
      '<button class="filter" onclick="abrirModalEnsaio(\'' + x.id + '\')">Editar</button></div>' : '') + '</div>' +
    '<div class="fichaInfo">' +
    '<div><span>Local</span>' + esc(x.local || 'A definir') + '</div>' +
    '<div><span>Tipo</span>' + esc(x.tipo || 'Não definido') + '</div>' +
    '<div><span>Status</span>' + esc(x.status || 'Planejado') + '</div>' +
    '<div><span>Convocação</span>' + (x.convocar_todos ? 'Elenco todo' : 'Pelas esquetes') + '</div></div>' +
    '<div class="fichaBloco"><span>Esquetes</span>' + (esqs.length ? esqs.map(s =>
      '<a href="#" class="tituloLink" onclick="abrirEsquete(\'' + s.id + '\');return false">' + esc(s.titulo) + '</a>').join(' · ') : 'Nenhuma esquete marcada') + '</div>' +
    (x.observacoes ? '<div class="fichaBloco"><span>Objetivos e observações</span>' + esc(x.observacoes).replace(/\n/g, '<br>') + '</div>' : '') +
    (souConvocado && !passou ? '<div class="fichaBloco"><span>Sua resposta</span>' + botoesResposta(x, eu) + '</div>' : '') +
    '</div>';

  const linhasConv = conv.map(e => {
    const p = presencaDe(x.id, e.id);
    const pers = esqs.flatMap(s => personagensDe(s.id).filter(pp => pp.elenco_id === e.id).map(pp => pp.nome));
    return '<div class="linha"><div style="flex:1;min-width:180px"><b>' + esc(e.nome_artistico || e.nome) + '</b>' +
      (pers.length ? '<div class="meta">' + esc(pers.join(', ')) + '</div>' : '') +
      (p && p.motivo ? '<div class="meta">Motivo: ' + esc(p.motivo) + '</div>' : '') + '</div>' +
      chipResposta(p) +
      (gest && passou ? '<label class="presenca"><input type="checkbox" ' + (p && p.presente ? 'checked' : '') +
        ' onchange="marcarPresenca(\'' + x.id + '\',\'' + e.id + '\',this.checked)"> Presente</label>'
        : (p && p.presente === true ? '<span class="chip ok">Presente</span>' : p && p.presente === false ? '<span class="chip nao">Faltou</span>' : '')) +
      '</div>';
  }).join('');
  const c = contagemRespostas(x);
  const convocacao = '<div class="card section"><div class="fichaTopo"><h2>' + (passou ? 'Presença' : 'Convocados') + '</h2>' +
    '<span class="meta">' + textoRespostas(x) + '</span></div>' +
    (conv.length ? linhasConv : '<div class="empty">' + (x.convocar_todos ? 'Nenhum integrante ativo no elenco.' :
      'Ninguém convocado: marque esquetes que já tenham personagens com ator, ou convoque o elenco todo.') + '</div>') +
    (gest && passou && conv.length && c.marcados < conv.length ? '<div class="meta" style="margin-top:10px">Marque quem compareceu. Quem ficar sem marcação não entra na contagem.</div>' : '') +
    '</div>';

  const relatorio = '<div class="card section"><h2>Relatório do ensaio</h2>' +
    (gest
      ? '<div class="field"><label>O que avançou</label><textarea id="rRelatorio" placeholder="Cenas trabalhadas, marcações definidas, descobertas...">' + esc(x.relatorio || '') + '</textarea></div>' +
        '<div class="field" style="margin-top:12px"><label>Pendências para o próximo</label><textarea id="rPendencias" placeholder="O que ficou para trás, quem precisa decorar o quê...">' + esc(x.pendencias || '') + '</textarea></div>' +
        '<div style="margin-top:12px"><button class="btn" onclick="salvarRelatorio(\'' + x.id + '\')">Salvar relatório</button></div>'
      : (x.relatorio || x.pendencias
        ? (x.relatorio ? '<div class="fichaBloco"><span>O que avançou</span>' + esc(x.relatorio).replace(/\n/g, '<br>') + '</div>' : '') +
          (x.pendencias ? '<div class="fichaBloco"><span>Pendências para o próximo</span>' + esc(x.pendencias).replace(/\n/g, '<br>') + '</div>' : '')
        : '<div class="empty">Ainda sem relatório.</div>')) + '</div>';

  const acoes = gest ? '<div class="section"><button class="filter" onclick="excluirEnsaio(\'' + x.id + '\')">Excluir ensaio</button></div>' : '';

  shell(esc(x.titulo), '<a href="#" class="voltar" onclick="go(\'ensaios\');return false">← Ensaios</a>',
    info + convocacao + relatorio + acoes + modalEnsaio());
}

async function marcarPresenca(ensId, elId, presente) {
  const r = await sbClient.from('ensaio_presencas').upsert({ ensaio_id: ensId, elenco_id: elId, presente }, { onConflict: 'ensaio_id,elenco_id' });
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  await load();
}
async function salvarRelatorio(id) {
  const r = await sbClient.from('ensaios').update({
    relatorio: document.getElementById('rRelatorio').value.trim(),
    pendencias: document.getElementById('rPendencias').value.trim()
  }).eq('id', id);
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  await load(); alert('Relatório salvo.');
}

function copiarConvocacao(id) {
  const x = DB.ensaios.find(e => e.id === id); if (!x) return;
  const esqs = esquetesDoEnsaio(x.id), conv = convocadosDe(x);
  const linhas = ['*' + x.titulo + '* | Depois Não Reclama', '', dataEnsaio(x), 'Local: ' + (x.local || 'a definir')];
  if (x.tipo) linhas.push('Tipo: ' + x.tipo);
  if (esqs.length) linhas.push('', 'Esquetes: ' + esqs.map(s => s.titulo).join(', '));
  if (conv.length) linhas.push('', 'Convocados: ' + conv.map(e => e.nome_artistico || e.nome).join(', '));
  if (x.observacoes) linhas.push('', x.observacoes);
  linhas.push('', 'Confirme sua presença na Central de Produção: ' + location.href.split('#')[0]);
  const texto = linhas.join('\n');
  const ok = () => alert('Convocação copiada. É só colar no WhatsApp.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, () => prompt('Copie o texto abaixo:', texto));
  else prompt('Copie o texto abaixo:', texto);
}

/* ---------- Modal: novo / editar ensaio ---------- */
function modalEnsaio() {
  return '<div id="ensaioModal" class="modal" onclick="if(event.target===this)fecharModalEnsaio()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Ensaios</div><h2 id="ensaioModalTitle">Novo ensaio</h2></div><button class="close" onclick="fecharModalEnsaio()">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Título</label><input id="fTitulo" placeholder="Ex.: Ensaio de marcação"></div>' +
    '<div class="field"><label>Data</label><input id="fData" type="date"></div>' +
    '<div class="field"><label>Horário</label><input id="fHora" type="time"></div>' +
    '<div class="field"><label>Local</label><input id="fLocal" placeholder="Ex.: Sala de ensaio"></div>' +
    '<div class="field"><label>Tipo</label><select id="fTipo"><option value="">Não definido</option>' + TIPOS_ENSAIO.map(t => '<option>' + t + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Status</label><select id="fStatus">' + STATUS_ENSAIO.map(t => '<option>' + t + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Convocação</label><select id="fTodos"><option value="false">Pelas esquetes marcadas</option><option value="true">Elenco todo</option></select></div>' +
    '<div class="field full"><label>Esquetes do ensaio</label><div class="checklist" id="fEsquetes"></div></div>' +
    '<div class="field full"><label>Objetivos e observações</label><textarea id="fObs" placeholder="O que trabalhar, o que levar, recados..."></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharModalEnsaio()">Cancelar</button><button class="btn" onclick="salvarModalEnsaio()">Salvar ensaio</button></div>' +
    '</div></div>';
}
function abrirModalEnsaio(id) {
  ensaioEditando = id ? DB.ensaios.find(x => x.id === id) : null;
  const r = ensaioEditando;
  document.getElementById('ensaioModal').classList.add('show');
  document.getElementById('ensaioModalTitle').textContent = r ? 'Editar ensaio' : 'Novo ensaio';
  document.getElementById('fTitulo').value = r ? r.titulo || '' : '';
  document.getElementById('fLocal').value = r ? r.local || '' : '';
  document.getElementById('fTipo').value = r && r.tipo ? r.tipo : '';
  document.getElementById('fStatus').value = r && r.status ? r.status : 'Planejado';
  document.getElementById('fTodos').value = String(!!(r && r.convocar_todos));
  document.getElementById('fObs').value = r ? r.observacoes || '' : '';
  let d = '', h = '';
  if (r && r.data_hora) { const dt = new Date(r.data_hora); d = dataLocalISO(dt); h = dt.toTimeString().slice(0, 5); }
  document.getElementById('fData').value = d; document.getElementById('fHora').value = h;
  const atuais = new Set(DB.ensaioEsquetes.filter(x => r && x.ensaio_id === r.id).map(x => x.esquete_id));
  const grade = esqSelecionadas(), outras = DB.esquetes.filter(x => x.selecao !== 'Selecionada' && atuais.has(x.id));
  const lista = grade.concat(outras);
  document.getElementById('fEsquetes').innerHTML = lista.length ? lista.map(x =>
    '<label class="checkrow"><input type="checkbox" value="' + x.id + '" ' + (atuais.has(x.id) ? 'checked' : '') + '> <span>' +
    (x.ordem ? String(x.ordem).padStart(2, '0') + ' · ' : '') + esc(x.titulo) +
    ' <span class="meta">' + (elencoIdsDe(x.id).map(nomeElenco).join(', ') || 'sem elenco definido') + '</span></span></label>').join('')
    : '<div class="empty">Nenhuma esquete na grade ainda.</div>';
}
function fecharModalEnsaio() { const m = document.getElementById('ensaioModal'); if (m) m.classList.remove('show'); ensaioEditando = null; }
async function salvarModalEnsaio() {
  const titulo = document.getElementById('fTitulo').value.trim();
  if (!titulo) return alert('Informe o título do ensaio.');
  const data = document.getElementById('fData').value, hora = document.getElementById('fHora').value;
  const payload = {
    titulo, data_hora: data ? new Date(data + 'T' + (hora || '00:00')).toISOString() : null,
    local: document.getElementById('fLocal').value.trim(), tipo: document.getElementById('fTipo').value || null,
    status: document.getElementById('fStatus').value, convocar_todos: document.getElementById('fTodos').value === 'true',
    observacoes: document.getElementById('fObs').value.trim()
  };
  let id = ensaioEditando && ensaioEditando.id;
  if (id) {
    const r = await sbClient.from('ensaios').update(payload).eq('id', id);
    if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  } else {
    const r = await sbClient.from('ensaios').insert(payload).select().single();
    if (r.error) return alert('Não foi possível criar: ' + r.error.message);
    id = r.data.id;
  }
  const ids = [...document.querySelectorAll('#fEsquetes input[type=checkbox]:checked')].map(x => x.value);
  const d = await sbClient.from('ensaio_esquetes').delete().eq('ensaio_id', id);
  if (d.error) return alert('Não foi possível atualizar as esquetes: ' + d.error.message);
  if (ids.length) {
    const ins = await sbClient.from('ensaio_esquetes').insert(ids.map(esquete_id => ({ ensaio_id: id, esquete_id })));
    if (ins.error) return alert('Não foi possível vincular as esquetes: ' + ins.error.message);
  }
  fecharModalEnsaio(); await load(); abrirEnsaio(id);
}
async function excluirEnsaio(id) {
  const row = DB.ensaios.find(x => x.id === id); if (!row) return;
  if (!confirm('Excluir o ensaio "' + row.titulo + '"? As respostas e presenças dele também serão apagadas.')) return;
  const r = await sbClient.from('ensaios').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  ensaioAtual = null; await load(); go('ensaios');
}

/* ---------- Conta na plataforma (cadastro do elenco) ---------- */
function opcoesContas(atual) {
  const usadas = new Set(DB.elenco.map(e => e.perfil_id).filter(id => id && id !== atual));
  const contas = (DB.perfis || []).filter(p => p.status === 'aprovado' && !usadas.has(p.id))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  return '<option value="">Sem conta ligada</option>' + contas.map(p =>
    '<option value="' + p.id + '" ' + (p.id === atual ? 'selected' : '') + '>' + esc(p.nome || p.email) + (p.email ? ' (' + esc(p.email) + ')' : '') + '</option>').join('');
}

(function () {
  const s = document.createElement('style');
  s.textContent = '.ensaioCard{cursor:pointer;margin-bottom:12px;transition:.15s ease}.ensaioCard:hover{border-color:var(--pink2)}' +
    '.ensaioTopo{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.ensaioCard h3{margin:0 0 4px;font-size:16px}' +
    '.chip{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:5px 9px;background:#eee8eb;color:var(--muted);white-space:nowrap}' +
    '.chip.ok{background:#e3f1ea;color:var(--green)}.chip.nao,.badge.nao{background:#fbe4e2;color:#b3261e}' +
    '.resposta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
    '.presenca{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;cursor:pointer}.presenca input{accent-color:var(--pink);width:17px;height:17px}' +
    '.tituloLink{color:inherit;font-weight:700;text-decoration:none}.tituloLink:hover{color:var(--pink)}' +
    '.filter.claro{background:#ffffff14;border-color:#ffffff33;color:#fff}' +
    '.field textarea{width:100%}';
  document.head.appendChild(s);
})();
