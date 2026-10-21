/* Banco de Esquetes, ficha de cada esquete e Grade do espetáculo.
   Direção: seleciona, ordena, edita a esquete e distribui personagens.
   Direção e Produção: necessidades de cena (figurino, adereços, técnica). */

let esqueteAtual = null;
const TIPOS_ITEM = ['Figurino', 'Adereços', 'Cenário', 'Iluminação', 'Sonoplastia', 'Outros'];

/* ---------- Auxiliares ---------- */
const attr = s => esc(s).replace(/`/g, '&#96;');
function esqSelecionadas() {
  return DB.esquetes.filter(x => x.selecao === 'Selecionada')
    .sort((a, b) => ((a.ordem || 9999) - (b.ordem || 9999)) || (a.numero - b.numero));
}
function personagensDe(eid) {
  return (DB.personagens || []).filter(p => p.esquete_id === eid)
    .sort((a, b) => ((a.ordem || 9999) - (b.ordem || 9999)) || String(a.created_at).localeCompare(String(b.created_at)));
}
function itensDe(eid) { return (DB.itens || []).filter(i => i.esquete_id === eid); }
function elencoIdsDe(eid) { return [...new Set(personagensDe(eid).map(p => p.elenco_id).filter(Boolean))]; }
function nomeElenco(id) { const p = DB.elenco.find(e => e.id === id); return p ? (p.nome_artistico || p.nome) : 'Integrante inativo'; }
function fmtDur(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? h + 'h' + String(m).padStart(2, '0') : m + ' min';
}
function fmtHora(totalMin) {
  const t = ((totalMin % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + 'h' + String(t % 60).padStart(2, '0');
}
function minutosDoInicio() {
  const s = typeof proximaSessao === 'function' ? proximaSessao() : null;
  if (!s || !s.inicio) return null;
  const [h, m] = String(s.inicio).split(':').map(Number);
  return h * 60 + m;
}
function abrirEsquete(id) { esqueteAtual = id; go('esquete'); window.scrollTo(0, 0); }

/* ---------- Banco de Esquetes ---------- */
/* Título para ordenar: sem espaços, aspas ou numeração digitada no começo ("1. ", "“", "- ") */
function chaveAlfabetica(t) {
  return String(t || '').trim().replace(/^[\s"'“”‘’«»()\[\]\-–—.,:;!?*#]+/, '').replace(/^\d+\s*[.)\-–—:]\s*/, '').trim();
}
function esquetes() {
  const q = query.toLowerCase();
  const arr = DB.esquetes.filter(x =>
    (filter === 'Todas' ||
     (filter === 'Inéditas' && x.situacao === 'Inédita') ||
     (filter === 'Já apresentadas' && (x.situacao || '').includes('Já')) ||
     (filter === 'Em avaliação' && x.selecao === 'Em avaliação do diretor') ||
     (filter === 'Na grade' && x.selecao === 'Selecionada')) &&
    (x.titulo || '').toLowerCase().includes(q))
    // Ordem alfabética pelo título (sem diferenciar acentos e maiúsculas; números em ordem natural)
    .sort((a, b) => chaveAlfabetica(a.titulo).localeCompare(chaveAlfabetica(b.titulo), 'pt-BR', { sensitivity: 'base', numeric: true }));
  const cartao = x => {
    const pers = personagensDe(x.id), itens = itensDe(x.id), prontos = itens.filter(i => i.pronto).length;
    const resumo = [x.duracao_min ? fmtDur(x.duracao_min) : 'Duração a definir',
      pers.length ? pers.length + ' personagem' + (pers.length > 1 ? 's' : '') : 'Sem personagens',
      itens.length ? prontos + '/' + itens.length + ' itens de cena prontos' : null].filter(Boolean).join(' · ');
    return '<div class="card sketch esqCard" onclick="abrirEsquete(\'' + x.id + '\')">' +
      '<h3>' + esc(x.titulo) + '</h3>' +
      '<div class="meta">Origem: ' + esc(x.responsavel_origem || 'Não informada') + '</div>' +
      '<div class="meta">' + resumo + '</div>' +
      '<span class="badge">' + esc(x.situacao || 'Sem situação') + '</span>' +
      (x.selecao === 'Selecionada' ? ' <span class="badge naGrade">Na grade</span>' : '') +
      (x.texto_arquivo || x.texto_url ? ' <span class="badge">Com texto</span>' : '') +
      (x.selecao === 'Em avaliação do diretor' ? '<div class="badge review">Em avaliação da direção</div>' : '') +
      (eDirecao() ? '<div style="margin-top:12px" onclick="event.stopPropagation()"><button class="filter" onclick="alternarSelecao(\'' + x.id + '\')">' +
        (x.selecao === 'Selecionada' ? 'Retirar da grade' : 'Colocar na grade') + '</button></div>' : '') +
      '</div>';
  };
  shell('Banco de Esquetes', DB.esquetes.length + ' opções de repertório · ' + esqSelecionadas().length + ' na grade',
    (eDirecao() ? '<div style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="abrirModalEsquete()">+ Nova esquete</button></div>' : '') +
    '<input class="search" id="buscaEsquete" placeholder="Buscar esquete..." value="' + esc(query) + '" oninput="buscarEsquete(this.value)">' +
    '<div class="filters">' + ['Todas', 'Na grade', 'Inéditas', 'Já apresentadas', 'Em avaliação'].map(f =>
      '<button class="filter ' + (filter === f ? 'active' : '') + '" onclick="filter=\'' + f + '\';render()">' + f + '</button>').join('') + '</div>' +
    (arr.length ? '<div class="cards">' + arr.map(cartao).join('') + '</div>' : '<div class="empty">Nenhuma esquete encontrada.</div>') +
    modalEsquete());
}

async function alternarSelecao(id) {
  const row = DB.esquetes.find(x => x.id === id); if (!row) return;
  const entrando = row.selecao !== 'Selecionada';
  const payload = entrando
    ? { selecao: 'Selecionada', ordem: esqSelecionadas().length + 1 }
    : { selecao: 'Não selecionada', ordem: null };
  const r = await sbClient.from('esquetes').update(payload).eq('id', id);
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  if (!entrando) await renumerarGrade(id);
  await load();
}

/* ---------- Modal: nova esquete / editar informações ---------- */
function opcoesSituacao() {
  const base = ['Inédita', 'Já apresentada'];
  const existentes = DB.esquetes.map(x => x.situacao).filter(Boolean);
  return [...new Set(base.concat(existentes))].map(v => '<option>' + esc(v) + '</option>').join('');
}
function modalEsquete() {
  return '<div id="esqModal" class="modal" onclick="if(event.target===this)fecharModalEsquete()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Repertório</div><h2 id="esqModalTitulo">Nova esquete</h2></div><button class="close" onclick="fecharModalEsquete()">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Título</label><input id="qTitulo" placeholder="Nome da esquete"></div>' +
    '<div class="field"><label>Duração (minutos)</label><input id="qDuracao" type="number" min="1" placeholder="Ex.: 8"></div>' +
    '<div class="field"><label>Situação</label><select id="qSituacao">' + opcoesSituacao() + '</select></div>' +
    '<div class="field"><label>Origem / autoria</label><input id="qOrigem" placeholder="Quem trouxe ou escreveu"></div>' +
    '<div class="field"><label>Avaliação</label><select id="qSelecao"><option>Não selecionada</option><option>Em avaliação do diretor</option><option>Selecionada</option></select></div>' +
    '<div class="field full"><label>Texto da esquete</label><div id="qArquivoAtual"></div>' +
    '<label class="arquivoEscolher"><input id="qArquivo" type="file" accept=".pdf,.doc,.docx,.odt" onchange="arquivoEscolhido(this)"><span id="qArquivoRotulo">Anexar PDF ou Word</span></label>' +
    '<div class="meta">PDF ou Word, até 20 MB. Toda a equipe consegue abrir.</div></div>' +
    '<div class="field full"><label>Ou link do texto</label><input id="qTexto" placeholder="Link do Google Drive, Docs..."></div>' +
    '<div class="field full"><label>Sinopse</label><textarea id="qSinopse" placeholder="Do que se trata a esquete, em poucas linhas"></textarea></div>' +
    '<div class="field full"><label>Notas da direção</label><textarea id="qNotas" placeholder="Intenções, ritmo, marcações, observações"></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharModalEsquete()">Cancelar</button><button class="btn" onclick="salvarEsquete()">Salvar</button></div>' +
    '</div></div>';
}
let esqueteEditando = null;
function abrirModalEsquete(id) {
  esqueteEditando = id ? DB.esquetes.find(x => x.id === id) : null;
  const r = esqueteEditando;
  document.getElementById('esqModal').classList.add('show');
  document.getElementById('esqModalTitulo').textContent = r ? 'Editar esquete' : 'Nova esquete';
  const v = (idc, val) => { document.getElementById(idc).value = val == null ? '' : val; };
  v('qDuracao', r ? r.duracao_min : ''); v('qTitulo', r ? r.titulo : '');
  v('qSituacao', r && r.situacao ? r.situacao : 'Inédita'); v('qOrigem', r ? r.responsavel_origem : '');
  v('qSelecao', r && r.selecao ? r.selecao : 'Não selecionada'); v('qTexto', r ? r.texto_url : '');
  v('qSinopse', r ? r.sinopse : ''); v('qNotas', r ? r.notas_direcao : '');
  removerTextoAnexado = false;
  document.getElementById('qArquivo').value = '';
  document.getElementById('qArquivoRotulo').textContent = r && r.texto_arquivo ? 'Trocar o arquivo' : 'Anexar PDF ou Word';
  desenharArquivoAtual();
}
let removerTextoAnexado = false;
const TIPOS_TEXTO = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt: 'application/vnd.oasis.opendocument.text' };
function extensao(nome) { return (String(nome || '').split('.').pop() || '').toLowerCase(); }
function desenharArquivoAtual() {
  const box = document.getElementById('qArquivoAtual'), r = esqueteEditando;
  if (!box) return;
  box.innerHTML = r && r.texto_arquivo && !removerTextoAnexado
    ? '<div class="arquivoAtual"><b>' + esc(r.texto_nome || 'Texto anexado') + '</b><button type="button" class="filter discreto" onclick="removerTextoAnexado=true;desenharArquivoAtual();document.getElementById(\'qArquivoRotulo\').textContent=\'Anexar PDF ou Word\'">Remover</button></div>'
    : (r && r.texto_arquivo ? '<div class="meta">O arquivo atual será removido ao salvar.</div>' : '');
}
function arquivoEscolhido(inp) {
  const f = inp.files && inp.files[0], rot = document.getElementById('qArquivoRotulo');
  if (!f) { rot.textContent = 'Anexar PDF ou Word'; return; }
  if (!TIPOS_TEXTO[extensao(f.name)]) { inp.value = ''; rot.textContent = 'Anexar PDF ou Word'; return avisar('Escolha um arquivo PDF ou Word (.pdf, .doc, .docx ou .odt).', 'erro'); }
  if (f.size > 20 * 1024 * 1024) { inp.value = ''; rot.textContent = 'Anexar PDF ou Word'; return avisar('O arquivo tem mais de 20 MB. Diminua o tamanho ou use um link do Drive.', 'erro'); }
  rot.textContent = f.name;
}
async function enviarTextoEsquete(esq, arquivo) {
  const ext = extensao(arquivo.name);
  const limpo = arquivo.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);
  // Cada pessoa envia dentro de <esquete>/<seu id>/, o que permite apagar só o que enviou
  const caminho = esq.id + '/' + user.id + '/' + Date.now() + '-' + limpo;
  const up = await sbClient.storage.from('esquetes-textos').upload(caminho, arquivo, { contentType: TIPOS_TEXTO[ext], upsert: false });
  if (up.error) return { erro: /bucket|not found/i.test(up.error.message) ? 'Falta rodar o arquivo supabase/008_textos_das_esquetes.sql no Supabase (SQL Editor).'
    : /row-level|policy|permission|unauthorized/i.test(up.error.message) ? 'Sem permissão para enviar. Falta rodar o arquivo supabase/011_elenco_envia_textos.sql no Supabase (SQL Editor).' : up.error.message };
  const r = await sbClient.rpc('anexar_texto_esquete', { p_esquete: String(esq.id), p_caminho: caminho, p_nome: arquivo.name });
  if (r.error) {
    await sbClient.storage.from('esquetes-textos').remove([caminho]);
    return { erro: /anexar_texto_esquete|function/i.test(r.error.message) ? 'Falta rodar o arquivo supabase/011_elenco_envia_textos.sql no Supabase (SQL Editor).' : r.error.message };
  }
  if (r.data && r.data !== caminho) await sbClient.storage.from('esquetes-textos').remove([r.data]);
  return {};
}
async function removerTextoEsquete(id) {
  const r = await sbClient.rpc('remover_texto_esquete', { p_esquete: String(id) });
  if (r.error) return { erro: /remover_texto_esquete|function/i.test(r.error.message) ? 'Falta rodar o arquivo supabase/011_elenco_envia_textos.sql no Supabase (SQL Editor).' : r.error.message };
  if (r.data) await sbClient.storage.from('esquetes-textos').remove([r.data]);
  return {};
}
/* Elenco: anexar, trocar ou remover o texto direto na ficha da esquete */
function podeEnviarTexto() { return eDirecao() || temFuncao('Elenco'); }
function podeMexerNoTexto(x) { return eDirecao() || (podeEnviarTexto() && (!x.texto_arquivo || x.texto_enviado_por === user.id)); }
function nomeDaConta(pid) {
  if (!pid) return '';
  if (user && pid === user.id) return 'você';
  const el = DB.elenco.find(e => e.perfil_id === pid); if (el) return el.nome;
  const tc = (DB.tecnica || []).find(e => e.perfil_id === pid); if (tc) return tc.nome;
  const pf = (DB.perfis || []).find(p => p.id === pid); return pf ? pf.nome || '' : '';
}
function escolherTextoFicha(id) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.pdf,.doc,.docx,.odt';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (!TIPOS_TEXTO[extensao(f.name)]) return avisar('Escolha um arquivo PDF ou Word (.pdf, .doc, .docx ou .odt).', 'erro');
    if (f.size > 20 * 1024 * 1024) return avisar('O arquivo tem mais de 20 MB. Diminua o tamanho ou use um link do Drive.', 'erro');
    const x = DB.esquetes.find(e => e.id === id); if (!x) return;
    avisar('Enviando o texto...');
    const enviando = document.querySelector('#avisos .aviso:last-child');
    const env = await enviarTextoEsquete(x, f);
    if (enviando) enviando.remove();
    if (env.erro) return alert('O texto não foi anexado. ' + env.erro);
    await load(); avisar('Texto anexado.');
  };
  inp.click();
}
async function removerTextoFicha(id) {
  const x = DB.esquetes.find(e => e.id === id);
  if (!x || !await confirmar('Remover o texto "' + (x.texto_nome || 'anexado') + '"?\n\nO arquivo deixa de aparecer para toda a equipe.')) return;
  const r = await removerTextoEsquete(id);
  if (r.erro) return alert('Não foi possível remover: ' + r.erro);
  await load(); avisar('Texto removido.');
}
async function abrirTextoEsquete(id, baixar) {
  const x = DB.esquetes.find(e => e.id === id);
  if (!x || !x.texto_arquivo) return;
  const pdf = extensao(x.texto_nome || x.texto_arquivo) === 'pdf';
  // Abre a aba antes de esperar o link, para o navegador não bloquear
  const aba = !baixar && pdf ? window.open('', '_blank') : null;
  const r = await sbClient.storage.from('esquetes-textos').createSignedUrl(x.texto_arquivo, 3600, baixar || !pdf ? { download: x.texto_nome || true } : undefined);
  if (r.error || !r.data) { if (aba) aba.close(); return alert('Não foi possível abrir o texto: ' + (r.error ? r.error.message : 'arquivo não encontrado')); }
  if (aba) aba.location = r.data.signedUrl; else window.location.href = r.data.signedUrl;
}
function fecharModalEsquete() { const m = document.getElementById('esqModal'); if (m) m.classList.remove('show'); esqueteEditando = null; }
async function salvarEsquete() {
  const g = idc => document.getElementById(idc).value;
  const titulo = g('qTitulo').trim();
  if (!titulo) return alert('Informe o título da esquete.');
  let texto = g('qTexto').trim();
  if (texto && !/^https?:\/\//i.test(texto)) texto = 'https://' + texto;
  const selecao = g('qSelecao');
  const payload = {
    titulo, duracao_min: parseInt(g('qDuracao'), 10) || null,
    situacao: g('qSituacao'), responsavel_origem: g('qOrigem').trim(), selecao,
    texto_url: texto || null, sinopse: g('qSinopse').trim(), notas_direcao: g('qNotas').trim()
  };
  const antes = esqueteEditando;
  // O número não aparece mais, mas continua guardando a ordem de cadastro no banco
  if (!antes) payload.numero = DB.esquetes.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1;
  if (selecao === 'Selecionada' && (!antes || antes.selecao !== 'Selecionada')) payload.ordem = esqSelecionadas().length + 1;
  if (selecao !== 'Selecionada') payload.ordem = null;
  const r = antes
    ? await sbClient.from('esquetes').update(payload).eq('id', antes.id).select().single()
    : await sbClient.from('esquetes').insert(payload).select().single();
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  if (antes && antes.selecao === 'Selecionada' && selecao !== 'Selecionada') await renumerarGrade(antes.id);
  const arquivo = document.getElementById('qArquivo').files[0];
  const salvo = Object.assign({}, antes || {}, r.data || {}, { texto_arquivo: antes ? antes.texto_arquivo : null });
  if (arquivo) {
    const btn = document.querySelector('#esqModal .modalactions .btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando o texto...'; }
    const env = await enviarTextoEsquete(salvo, arquivo);
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    if (env.erro) { await load(); return alert('A esquete foi salva, mas o texto não foi anexado. ' + env.erro); }
  } else if (removerTextoAnexado && antes && antes.texto_arquivo) {
    const rem = await removerTextoEsquete(antes.id);
    if (rem.erro) { await load(); return alert('A esquete foi salva, mas o texto não foi removido. ' + rem.erro); }
  }
  fecharModalEsquete(); await load();
  if (r.data && r.data.id) abrirEsquete(r.data.id);
}

async function excluirEsquete(id) {
  const row = DB.esquetes.find(x => x.id === id); if (!row) return;
  if (!await confirmar('Excluir definitivamente a esquete "' + row.titulo + '"?\n\nPersonagens e necessidades de cena dela também serão apagados.')) return;
  const r = await sbClient.from('esquetes').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  if (row.texto_arquivo) await sbClient.storage.from('esquetes-textos').remove([row.texto_arquivo]);
  if (row.selecao === 'Selecionada') await renumerarGrade(id);
  esqueteAtual = null; await load(); go('esquetes');
}

/* ---------- Ficha da esquete ---------- */
function esqueteDetalhe() {
  const x = DB.esquetes.find(e => e.id === esqueteAtual);
  if (!x) { page = 'esquetes'; return esquetes(); }
  const dir = eDirecao(), gest = eGestao();
  const pers = personagensDe(x.id), itens = itensDe(x.id);
  const grade = esqSelecionadas(), pos = grade.findIndex(e => e.id === x.id);

  const info = '<div class="card"><div class="fichaTopo"><h2>Informações</h2>' +
    (dir ? '<button class="filter" onclick="abrirModalEsquete(\'' + x.id + '\')">Editar</button>' : '') + '</div>' +
    '<div class="fichaInfo">' +
    '<div><span>Duração</span>' + (x.duracao_min ? fmtDur(x.duracao_min) : 'A definir') + '</div>' +
    '<div><span>Situação</span>' + esc(x.situacao || 'Sem situação') + '</div>' +
    '<div><span>Origem</span>' + esc(x.responsavel_origem || 'Não informada') + '</div>' +
    '<div><span>Na grade</span>' + (pos >= 0 ? 'Posição ' + (pos + 1) + ' de ' + grade.length : 'Não') + '</div></div>' +
    (x.texto_arquivo || x.texto_url || (!dir && podeEnviarTexto()) ? '<div class="textoEsquete">' +
      (x.texto_arquivo ? (extensao(x.texto_nome || x.texto_arquivo) === 'pdf'
        ? '<button class="btn" onclick="abrirTextoEsquete(\'' + x.id + '\')">Abrir o texto</button><button class="filter" onclick="abrirTextoEsquete(\'' + x.id + '\',true)">Baixar</button>'
        : '<button class="btn" onclick="abrirTextoEsquete(\'' + x.id + '\',true)">Baixar o texto (Word)</button>') +
        '<span class="meta">' + esc(x.texto_nome || '') + (x.texto_enviado_por ? ' · enviado por ' + esc(nomeDaConta(x.texto_enviado_por) || 'alguém da equipe') : '') + '</span>' : '') +
      (x.texto_url ? '<a class="' + (x.texto_arquivo ? 'filter' : 'btn') + '" style="display:inline-block;text-decoration:none" href="' + attr(x.texto_url) + '" target="_blank" rel="noopener">' + (x.texto_arquivo ? 'Abrir o link' : 'Abrir o texto') + '</a>' : '') +
      (!dir && podeMexerNoTexto(x) ? '<div class="textoAcoes">' +
        '<button class="filter" onclick="escolherTextoFicha(\'' + x.id + '\')">' + (x.texto_arquivo ? 'Trocar meu texto' : 'Anexar texto (PDF ou Word)') + '</button>' +
        (x.texto_arquivo ? '<button class="filter" onclick="removerTextoFicha(\'' + x.id + '\')">Remover</button>' : '') + '</div>' : '') +
      '</div>' : '') +
    (x.sinopse ? '<div class="fichaBloco"><span>Sinopse</span>' + esc(x.sinopse).replace(/\n/g, '<br>') + '</div>' : '') +
    (x.notas_direcao ? '<div class="fichaBloco"><span>Notas da direção</span>' + esc(x.notas_direcao).replace(/\n/g, '<br>') + '</div>' : '') +
    '</div>';

  const opcoesElenco = sel => '<option value="">A definir</option>' + DB.elenco.map(e =>
    '<option value="' + e.id + '" ' + (sel === e.id ? 'selected' : '') + '>' + esc(e.nome_artistico || e.nome) + '</option>').join('') +
    (sel && !DB.elenco.some(e => e.id === sel) ? '<option value="' + sel + '" selected>Integrante inativo</option>' : '');
  const personagens = '<div class="card section"><h2>Personagens</h2>' +
    (pers.length ? pers.map(p => '<div class="linha">' +
      (dir ? '<input class="inline" value="' + attr(p.nome) + '" onchange="renomearPersonagem(\'' + p.id + '\',this.value)">' : '<b>' + esc(p.nome) + '</b>') +
      (dir ? '<select class="inline" onchange="atribuirPersonagem(\'' + p.id + '\',this.value)">' + opcoesElenco(p.elenco_id) + '</select>'
           : '<span class="meta">' + (p.elenco_id ? esc(nomeElenco(p.elenco_id)) : 'Elenco a definir') + '</span>') +
      (dir ? '<button class="filter" onclick="removerPersonagem(\'' + p.id + '\')">Remover</button>' : '') + '</div>').join('')
      : '<div class="empty">Nenhum personagem cadastrado.</div>') +
    (dir ? '<div class="linha nova"><input class="inline" id="novoPersNome" placeholder="Nome do personagem" onkeydown="if(event.key===\'Enter\')adicionarPersonagem(\'' + x.id + '\')">' +
      '<select class="inline" id="novoPersElenco">' + opcoesElenco(null) + '</select>' +
      '<button class="btn" onclick="adicionarPersonagem(\'' + x.id + '\')">Adicionar</button></div>' : '') + '</div>';

  const porTipo = TIPOS_ITEM.map(t => [t, itens.filter(i => (TIPOS_ITEM.includes(i.tipo) ? i.tipo : 'Outros') === t)]).filter(([, l]) => l.length);
  const prontos = itens.filter(i => i.pronto).length;
  const necessidades = '<div class="card section"><div class="fichaTopo"><h2>Necessidades de cena</h2>' +
    (itens.length ? '<span class="meta">' + prontos + ' de ' + itens.length + ' prontos</span>' : '') + '</div>' +
    (porTipo.length ? porTipo.map(([t, l]) => '<div class="grupoItem"><span>' + t + '</span>' + l.map(i =>
      '<div class="linha"><input type="checkbox" ' + (i.pronto ? 'checked' : '') + (gest ? '' : ' disabled') +
      ' onchange="marcarItem(\'' + i.id + '\',this.checked)">' +
      '<div style="flex:1;' + (i.pronto ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(i.descricao) +
      (i.responsavel ? '<div class="meta">Responsável: ' + esc(i.responsavel) + '</div>' : '') + '</div>' +
      (gest ? '<button class="filter" onclick="removerItem(\'' + i.id + '\')">Remover</button>' : '') + '</div>').join('') + '</div>').join('')
      : '<div class="empty">Nada cadastrado ainda: figurino, adereços, cenário, luz, som.</div>') +
    (gest ? '<div class="linha nova"><select class="inline" id="novoItemTipo">' + TIPOS_ITEM.map(t => '<option>' + t + '</option>').join('') + '</select>' +
      '<input class="inline" id="novoItemDesc" placeholder="O que precisa (ex.: peruca loira)" style="flex:2" onkeydown="if(event.key===\'Enter\')adicionarItem(\'' + x.id + '\')">' +
      '<input class="inline" id="novoItemResp" placeholder="Responsável">' +
      '<button class="btn" onclick="adicionarItem(\'' + x.id + '\')">Adicionar</button></div>' : '') + '</div>';

  const acoes = dir ? '<div class="section" style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="filter" onclick="alternarSelecao(\'' + x.id + '\')">' + (x.selecao === 'Selecionada' ? 'Retirar da grade' : 'Colocar na grade') + '</button>' +
    '<button class="filter" onclick="excluirEsquete(\'' + x.id + '\')">Excluir esquete</button></div>' : '';

  shell(esc(x.titulo), '<a href="#" class="voltar" onclick="go(\'esquetes\');return false">← Banco de Esquetes</a>',
    info + personagens + necessidades + acoes + modalEsquete());
}

async function adicionarPersonagem(eid) {
  const nome = document.getElementById('novoPersNome').value.trim();
  if (!nome) return alert('Informe o nome do personagem.');
  const elenco_id = document.getElementById('novoPersElenco').value || null;
  const r = await sbClient.from('personagens').insert({ esquete_id: eid, nome, elenco_id, ordem: personagensDe(eid).length + 1 });
  if (r.error) return alert('Não foi possível adicionar: ' + r.error.message);
  await load();
}
async function renomearPersonagem(id, nome) {
  if (!nome.trim()) return alert('O nome não pode ficar vazio.');
  const r = await sbClient.from('personagens').update({ nome: nome.trim() }).eq('id', id);
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  await load();
}
async function atribuirPersonagem(id, elenco_id) {
  const r = await sbClient.from('personagens').update({ elenco_id: elenco_id || null }).eq('id', id);
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  await load();
}
async function removerPersonagem(id) {
  const p = (DB.personagens || []).find(x => x.id === id);
  if (!await confirmar('Remover o personagem "' + (p ? p.nome : '') + '"?')) return;
  const r = await sbClient.from('personagens').delete().eq('id', id);
  if (r.error) return alert('Não foi possível remover: ' + r.error.message);
  await load();
}
async function adicionarItem(eid) {
  const descricao = document.getElementById('novoItemDesc').value.trim();
  if (!descricao) return alert('Descreva o que a cena precisa.');
  const r = await sbClient.from('esquete_itens').insert({
    esquete_id: eid, tipo: document.getElementById('novoItemTipo').value, descricao,
    responsavel: document.getElementById('novoItemResp').value.trim() || null
  });
  if (r.error) return alert('Não foi possível adicionar: ' + r.error.message);
  await load();
}
async function marcarItem(id, pronto) {
  const r = await sbClient.from('esquete_itens').update({ pronto }).eq('id', id);
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  await load();
}
async function removerItem(id) {
  if (!await confirmar('Remover este item?')) return;
  const r = await sbClient.from('esquete_itens').delete().eq('id', id);
  if (r.error) return alert('Não foi possível remover: ' + r.error.message);
  await load();
}

/* ---------- Grade ---------- */
async function renumerarGrade(semId) {
  const lista = esqSelecionadas().filter(x => x.id !== semId);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].ordem !== i + 1) await sbClient.from('esquetes').update({ ordem: i + 1 }).eq('id', lista[i].id);
  }
}
async function moverEsquete(id, direcao) {
  const lista = esqSelecionadas(), i = lista.findIndex(x => x.id === id), j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  await salvarOrdemGrade(lista.map(x => x.id));
}
/* Grava a nova sequência (usada pelas setas e pelo arrastar) */
async function salvarOrdemGrade(ids) {
  const atual = esqSelecionadas();
  const mudancas = ids.map((id, k) => ({ id, ordem: k + 1 })).filter(m => {
    const e = atual.find(x => String(x.id) === String(m.id)); return e && e.ordem !== m.ordem;
  });
  mudancas.forEach(m => { const e = DB.esquetes.find(x => String(x.id) === String(m.id)); if (e) e.ordem = m.ordem; });
  if (page === 'espetaculo') render();
  const resultados = await Promise.all(mudancas.map(m => sbClient.from('esquetes').update({ ordem: m.ordem }).eq('id', m.id)));
  const erro = resultados.find(r => r.error);
  if (erro) alert('Não foi possível salvar a nova ordem: ' + erro.error.message);
  await load();
}
function ativarArrastarGrade() {
  const box = document.getElementById('gradeLista');
  if (!box || !eDirecao() || typeof Sortable === 'undefined') return;
  Sortable.create(box, {
    handle: '.alca', animation: 160, ghostClass: 'arrastando', chosenClass: 'escolhida',
    onEnd: ev => {
      if (ev.oldIndex === ev.newIndex) return;
      salvarOrdemGrade([...box.querySelectorAll('.gradeLinha')].map(el => el.dataset.id));
    }
  });
}

function conflitosDaGrade(lista) {
  const out = [];
  for (let i = 1; i < lista.length; i++) {
    const antes = new Set(elencoIdsDe(lista[i - 1].id));
    const juntos = elencoIdsDe(lista[i].id).filter(id => antes.has(id));
    if (juntos.length) out.push({ de: lista[i - 1], para: lista[i], posicao: i, pessoas: juntos });
  }
  return out;
}

/* Atalho para o texto da esquete direto na Grade (para todo o elenco) */
function botaoTextoGrade(x) {
  if (x.texto_arquivo) {
    const pdf = extensao(x.texto_nome || x.texto_arquivo) === 'pdf';
    return '<div class="gradeTexto naoImprimir">' + (pdf
      ? '<button class="filter" onclick="abrirTextoEsquete(\'' + x.id + '\')">Abrir texto</button><button class="filter" onclick="abrirTextoEsquete(\'' + x.id + '\',true)">Baixar</button>'
      : '<button class="filter" onclick="abrirTextoEsquete(\'' + x.id + '\',true)">Baixar texto (Word)</button>') + '</div>';
  }
  if (x.texto_url) return '<div class="gradeTexto naoImprimir"><a class="filter" href="' + attr(x.texto_url) + '" target="_blank" rel="noopener">Abrir texto</a></div>';
  return '';
}
function espetaculo() {
  const lista = esqSelecionadas(), dir = eDirecao();
  if (!lista.length) return shell('Grade', 'Repertório e ordem do espetáculo',
    '<div class="empty">Nenhuma esquete na grade ainda. No Banco de Esquetes, use "Colocar na grade".</div>');
  const total = lista.reduce((s, x) => s + (Number(x.duracao_min) || 0), 0);
  const semDur = lista.filter(x => !x.duracao_min).length;
  const inicio = minutosDoInicio();
  const conflitos = conflitosDaGrade(lista);
  const conflitoEm = new Map(conflitos.map(c => [c.posicao, c]));
  const elencoEmCena = new Set(lista.flatMap(x => elencoIdsDe(x.id)));

  const stats = '<div class="grid gradeStats naoImprimir">' +
    '<div class="stat"><b>' + lista.length + '</b><span>Esquetes na grade</span></div>' +
    '<div class="stat"><b>' + (total ? fmtDur(total) : '—') + '</b><span>Tempo de cena' + (semDur ? ' · ' + semDur + ' sem duração' : '') + '</span></div>' +
    '<div class="stat"><b>' + (inicio !== null && total ? fmtHora(inicio + total) : '—') + '</b><span>' + (inicio !== null ? 'Término previsto · início ' + fmtHora(inicio) : 'Término previsto') + '</span></div>' +
    '<div class="stat"><b>' + conflitos.length + '</b><span>Entradas seguidas</span></div></div>';

  const avisos = conflitos.length ? '<div class="notice section naoImprimir"><b>Atenção às trocas:</b> ' + conflitos.map(c =>
    c.pessoas.map(nomeElenco).join(', ') + ' sai' + (c.pessoas.length > 1 ? 'em' : '') + ' de "' + esc(c.de.titulo) + '" e entra' + (c.pessoas.length > 1 ? 'm' : '') +
    ' direto em "' + esc(c.para.titulo) + '"').join('; ') + '. Confira tempo de troca de figurino e posicionamento.</div>' : '';

  let acumulado = 0;
  const linhas = lista.map((x, i) => {
    const pers = personagensDe(x.id), c = conflitoEm.get(i);
    const hora = inicio !== null ? fmtHora(inicio + acumulado) : null;
    acumulado += Number(x.duracao_min) || 0;
    const elencoTxt = pers.length ? pers.map(p => '<span class="' + (c && c.pessoas.includes(p.elenco_id) ? 'alerta' : '') + '">' +
      esc(p.elenco_id ? nomeElenco(p.elenco_id) : 'a definir') + ' <i>(' + esc(p.nome) + ')</i></span>').join(', ') : 'Personagens a definir';
    return '<div class="card gradeLinha" data-id="' + x.id + '">' +
      (dir ? '<div class="alca" title="Arraste para mudar a ordem">⠿</div>' : '') +
      '<div class="gradeNum">' + String(i + 1).padStart(2, '0') + '</div>' +
      '<div style="flex:1;min-width:0"><h3><a href="#" onclick="abrirEsquete(\'' + x.id + '\');return false">' + esc(x.titulo) + '</a></h3>' +
      '<div class="meta">' + [hora ? 'Entra às ' + hora : null, x.duracao_min ? fmtDur(x.duracao_min) : 'duração a definir'].filter(Boolean).join(' · ') + '</div>' +
      '<div class="meta">' + elencoTxt + '</div>' + botaoTextoGrade(x) + '</div>' +
      (dir ? '<div class="gradeAcoes"><button class="filter" onclick="moverEsquete(\'' + x.id + '\',-1)" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button class="filter" onclick="moverEsquete(\'' + x.id + '\',1)" ' + (i === lista.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button class="filter" onclick="alternarSelecao(\'' + x.id + '\')">Retirar</button></div>' : '') + '</div>';
  }).join('');

  const participacao = [...elencoEmCena].map(id => ({
    id, nome: nomeElenco(id),
    posicoes: lista.map((x, i) => elencoIdsDe(x.id).includes(id) ? i + 1 : null).filter(Boolean)
  })).sort((a, b) => b.posicoes.length - a.posicoes.length || a.nome.localeCompare(b.nome));
  const semCena = DB.elenco.filter(e => !elencoEmCena.has(e.id));
  const blocoPart = '<div class="section card naoImprimir"><h2>Participação do elenco</h2>' +
    participacao.map(p => '<div class="linha"><b style="min-width:150px">' + esc(p.nome) + '</b><span class="meta">' + p.posicoes.length +
      ' esquete' + (p.posicoes.length > 1 ? 's' : '') + ' · posições ' + p.posicoes.join(', ') + '</span></div>').join('') +
    (semCena.length ? '<div class="meta" style="margin-top:10px">Ainda sem cena na grade: ' + semCena.map(e => esc(e.nome_artistico || e.nome)).join(', ') + '</div>' : '') + '</div>';

  const ses = typeof proximaSessao === 'function' ? proximaSessao() : null;
  const cabImpressao = '<div class="soImpressao">Depois Não Reclama · Arcana Produções' +
    (ses ? ' · ' + esc(dataDaSessao(ses).toLocaleDateString('pt-BR')) + (ses.local ? ' · ' + esc(ses.local) : '') : '') +
    ' · impresso em ' + new Date().toLocaleDateString('pt-BR') + '</div>';
  shell('Grade', 'Ordem do espetáculo, tempo e elenco em cena',
    '<div class="noprint" style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="window.print()">Imprimir grade</button></div>' +
    cabImpressao + stats + avisos +
    (dir ? '<div class="meta section noprint">Arraste pela alça ⠿ ou use as setas para mudar a ordem.</div>' : '') +
    '<div class="section" id="gradeLista">' + linhas + '</div>' + blocoPart);
  const eb = document.querySelector('#main .top .eyebrow'); if (eb) eb.classList.add('naoImprimir');
  ativarArrastarGrade();
}

(function () {
  const s = document.createElement('style');
  s.textContent = '.esqCard{cursor:pointer;transition:.15s ease}.esqCard:hover{border-color:var(--pink2);transform:translateY(-1px)}' +
    '.naGrade{background:var(--ink);color:#fff}' +
    '.voltar{color:var(--pink);font-weight:700;text-decoration:none}' +
    '.fichaTopo{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}.fichaTopo h2{margin:0}' +
    '.fichaInfo{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:14px;font-weight:700}' +
    '.fichaInfo span,.fichaBloco span,.grupoItem>span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin-bottom:5px}' +
    '.fichaBloco{margin-top:18px;font-size:14px;line-height:1.55}' +
    '.linha{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px;flex-wrap:wrap}' +
    '.linha.nova{border-bottom:0;padding-top:14px}' +
    '.inline{border:1px solid var(--line);border-radius:9px;padding:9px 11px;font:inherit;font-size:14px;flex:1;min-width:140px;background:#fff}' +
    '.grupoItem{margin-top:14px}' +
    '.gradeLinha{display:flex;align-items:center;gap:16px;margin-bottom:10px}.gradeLinha h3{margin:0 0 4px;font-size:16px}.gradeLinha h3 a{color:inherit;text-decoration:none}' +
    '.gradeNum{font-size:24px;font-weight:900;min-width:38px;text-align:center}' +
    '.alca{cursor:grab;font-size:22px;line-height:1;color:var(--muted);padding:6px 4px;touch-action:none;user-select:none}.alca:active{cursor:grabbing}' +
    '.soImpressao{display:none}' +
    '@media print{.naoImprimir{display:none!important}.soImpressao{display:block;font-size:12px;color:#555;margin:-6px 0 14px}.alca,.gradeAcoes,.btn,.filter{display:none!important}' +
    '.gradeLinha{break-inside:avoid;page-break-inside:avoid;padding:10px 14px;margin-bottom:6px}.grid{gap:8px;grid-template-columns:repeat(4,1fr)!important}.stat{padding:10px 14px}.stat b{font-size:22px}' +
    '.notice{-webkit-print-color-adjust:exact;print-color-adjust:exact}.gradeLinha .alerta{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
    '.gradeLinha.arrastando{opacity:.35}.gradeLinha.escolhida{box-shadow:0 10px 30px #0002}' +
    '.gradeAcoes{display:flex;gap:6px}.alerta{color:#b3261e;font-weight:700}' +
    '@media(max-width:900px){.fichaInfo{grid-template-columns:1fr 1fr}}' +
    '@media(max-width:650px){.gradeLinha{flex-wrap:wrap}.gradeAcoes{width:100%}}';
  document.head.appendChild(s);
})();

/* ---------- Personagens no card do Elenco ---------- */
function personagensDoIntegrante(id) {
  const ps = (DB.personagens || []).filter(p => p.elenco_id === id);
  if (!ps.length) return '<div class="meta">Personagens: a definir</div>';
  const grade = esqSelecionadas().map(e => e.id);
  return '<div class="meta">' + ps.map(p => {
    const e = DB.esquetes.find(q => q.id === p.esquete_id);
    return esc(p.nome) + (e ? ' em <i>' + esc(e.titulo) + '</i>' + (grade.includes(e.id) ? '' : ' (fora da grade)') : '');
  }).join('<br>') + '</div>';
}
