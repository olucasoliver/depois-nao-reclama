/* Reta final: Checklist Final, Roteiro do dia e créditos da Ficha Técnica. */

const CATEGORIAS_CHECK = ['Espaço', 'Elenco', 'Figurino', 'Adereços', 'Cenário', 'Iluminação', 'Sonoplastia',
  'Divulgação', 'Documentação', 'Financeiro', 'Dia da apresentação', 'Outros'];
const CATEGORIAS_FICHA = ['Direção', 'Elenco', 'Produção', 'Direção de arte', 'Figurino', 'Adereços', 'Iluminação',
  'Sonoplastia', 'Fotografia', 'Vídeo', 'Divulgação', 'Design', 'Financeiro', 'Outros'];

function barraProgresso(feitos, total) {
  const pct = total ? Math.round(feitos / total * 100) : 0;
  return '<div class="barraFundo"><div class="barraValor" style="width:' + pct + '%"></div></div>';
}
function sessaoDoDia() {
  const lista = typeof sessoesOrdenadas === 'function' ? sessoesOrdenadas() : [];
  return (typeof proximaSessao === 'function' && proximaSessao()) || lista[lista.length - 1] || null;
}

/* ---------- Checklist Final ---------- */
const gruposAbertos = new Set();
function checklist() {
  const gest = podeArea('checklist'), cena = podeArea('cena');
  const grade = esqSelecionadas();
  const itensGrade = grade.flatMap(e => itensDe(e.id));
  const gerais = (DB.checklist || []).slice().sort((a, b) =>
    Number(a.concluido) - Number(b.concluido) || (a.categoria || '').localeCompare(b.categoria || '') || (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  const total = itensGrade.length + gerais.length;
  const feitos = itensGrade.filter(i => i.pronto).length + gerais.filter(g => g.concluido).length;
  const pct = total ? Math.round(feitos / total * 100) : 0;
  const s = sessaoDoDia();

  const topo = '<div class="card prontidao"><div class="fichaTopo"><div><div class="eyebrow">Prontidão do espetáculo</div>' +
    '<div class="pctGrande">' + pct + '%</div></div>' +
    '<div class="meta" style="text-align:right">' + feitos + ' de ' + total + ' itens confirmados' +
    (s ? '<br>' + contagem(s) + ' para a ' + (sessoesOrdenadas()[0] && sessoesOrdenadas()[0].id === s.id ? 'estreia' : 'sessão') : '') + '</div></div>' +
    barraProgresso(feitos, total) + '</div>';

  /* Por esquete: itens agrupados por tipo (Figurino, Adereços...), cada grupo abre e fecha */
  const linhaItem = (x, mostrarResp) => '<div class="linha"><input type="checkbox" ' + (x.pronto ? 'checked' : '') + (cena ? '' : ' disabled') + ' onchange="marcarItem(\'' + x.id + '\',this.checked)">' +
    '<span style="flex:1;' + (x.pronto ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(x.descricao) + '</span>' +
    (mostrarResp && x.responsavel ? '<span class="meta">' + esc(x.responsavel) + '</span>' : '') + '</div>';
  const grupoTipo = (e, tipo, itens) => {
    const prontos = itens.filter(x => x.pronto).length, chave = e.id + '|' + tipo;
    const resp = [...new Set(itens.map(x => x.responsavel).filter(Boolean))];
    const ok = prontos === itens.length;
    return '<details class="grupoTipo' + (ok ? ' completo' : '') + '"' + (gruposAbertos.has(chave) ? ' open' : '') +
      ' ontoggle="this.open?gruposAbertos.add(\'' + chave + '\'):gruposAbertos.delete(\'' + chave + '\')">' +
      '<summary><span class="chip">' + esc(tipo) + '</span>' +
      '<span class="grupoResumo">' + (ok ? '✓ Tudo pronto' : prontos + ' de ' + itens.length + ' prontos') + '</span>' +
      (resp.length ? '<span class="meta grupoResp">' + esc(resp.join(', ')) + '</span>' : '') +
      '<span class="grupoSeta" aria-hidden="true"></span></summary>' +
      '<div class="grupoItens">' + itens.slice().sort((a, b) => Number(a.pronto) - Number(b.pronto)).map(x => linhaItem(x, resp.length > 1)).join('') + '</div></details>';
  };
  const porEsquete = '<div class="section"><h2>Por esquete da grade</h2>' + (grade.length ? grade.map((e, i) => {
    const itens = itensDe(e.id), prontos = itens.filter(x => x.pronto).length;
    const tipos = [...new Set(itens.map(x => x.tipo || 'Outros'))].sort((a, b) => (TIPOS_ITEM.indexOf(a) + 99) % 99 - (TIPOS_ITEM.indexOf(b) + 99) % 99);
    return '<div class="card" style="margin-bottom:10px"><div class="fichaTopo"><h3 style="margin:0">' + String(i + 1).padStart(2, '0') + '. ' +
      '<a href="#" class="tituloLink" onclick="abrirEsquete(\'' + e.id + '\');return false">' + esc(e.titulo) + '</a></h3>' +
      '<span class="meta">' + (itens.length ? prontos + ' de ' + itens.length + ' prontos' : 'Sem itens cadastrados') + '</span></div>' +
      (itens.length ? barraProgresso(prontos, itens.length) + tipos.map(t => grupoTipo(e, t, itens.filter(x => (x.tipo || 'Outros') === t))).join('')
        : '<div class="meta">Cadastre figurino, adereços e técnica na ficha da esquete.</div>') + '</div>';
  }).join('') : '<div class="empty">Nenhuma esquete na grade ainda.</div>') + '</div>';

  const linhasGerais = gerais.map(x => '<div class="linha"><input type="checkbox" ' + (x.concluido ? 'checked' : '') + (gest ? '' : ' disabled') +
    ' onchange="alternarChecklist(\'' + x.id + '\',this.checked)" style="accent-color:var(--pink);width:18px;height:18px">' +
    '<div style="flex:1"><div style="font-weight:700;' + (x.concluido ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(x.item) + '</div>' +
    '<div class="meta">' + [x.categoria ? esc(x.categoria) : null, x.responsavel ? 'Responsável: ' + esc(x.responsavel) : null,
      x.prazo ? 'Até ' + new Date(x.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : null].filter(Boolean).join(' · ') + '</div></div>' +
    (gest ? '<button class="filter" onclick="abrirChecklist(\'' + x.id + '\')">Editar</button><button class="filter" onclick="excluirChecklist(\'' + x.id + '\')">Excluir</button>' : '') +
    '</div>').join('');
  const blocoGerais = '<div class="section card"><div class="fichaTopo"><h2>Conferências gerais</h2>' +
    (gest ? '<button class="btn" onclick="abrirChecklist()">+ Nova conferência</button>' : '') + '</div>' +
    '<div class="meta" style="margin-bottom:6px">Espaço, documentos, financeiro, equipe e tudo o que não pertence a uma esquete.</div>' +
    (linhasGerais || '<div class="empty">Nenhuma conferência cadastrada.</div>') + '</div>';

  const modal = '<div id="checkModal" class="modal" onclick="if(event.target===this)fecharChecklist()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Prontidão do espetáculo</div><h2 id="checkTitulo">Nova conferência</h2></div><button class="close" onclick="fecharChecklist()">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Item a conferir</label><input id="cItem" placeholder="Ex.: Termo de uso do teatro assinado"></div>' +
    '<div class="field"><label>Categoria</label><select id="cCategoria">' + CATEGORIAS_CHECK.map(c => '<option>' + c + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Responsável</label>' + campoResponsavel('cResponsavel') + '</div>' +
    '<div class="field"><label>Conferir até</label><input id="cPrazo" type="date"></div>' +
    '<div class="field"><label>Situação</label><select id="cConcluido"><option value="false">Pendente</option><option value="true">Confirmado</option></select></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharChecklist()">Cancelar</button><button class="btn" onclick="salvarChecklist()">Salvar conferência</button></div>' +
    '</div></div>';

  shell('Checklist Final', 'Tudo o que precisa estar pronto antes de abrir a cortina', topo + porEsquete + blocoGerais + modal);
}

/* ---------- Roteiro do dia ---------- */
function roteiro() {
  const grade = esqSelecionadas(), s = sessaoDoDia(), inicio = minutosDoInicio();
  if (!grade.length) return shell('Roteiro do dia', 'Ordem do espetáculo para a coxia', '<div class="empty">Monte a Grade primeiro.</div>');
  const nomesPers = (eid, elId) => personagensDe(eid).filter(p => p.elenco_id === elId).map(p => p.nome).join(', ');
  const fmt = ids => ids.length ? ids.map(nomeElenco).map(esc).join(', ') : '';
  /* Projeção: esquetes sem duração entram com a média das que já têm */
  const conhecidas = grade.filter(e => Number(e.duracao_min) > 0);
  const media = conhecidas.length ? Math.round(conhecidas.reduce((t, e) => t + Number(e.duracao_min), 0) / conhecidas.length) : 0;
  const durDe = e => Number(e.duracao_min) > 0 ? Number(e.duracao_min) : media;
  const estimada = e => !(Number(e.duracao_min) > 0);
  let acumulado = 0;
  const blocos = grade.map((e, i) => {
    const agora = elencoIdsDe(e.id), antes = i ? elencoIdsDe(grade[i - 1].id) : [];
    const entram = agora.filter(id => !antes.includes(id)), seguem = agora.filter(id => antes.includes(id)), saem = antes.filter(id => !agora.includes(id));
    const hora = inicio !== null ? fmtHora(inicio + acumulado) : null;
    const ini = acumulado;
    acumulado += durDe(e);
    const itens = itensDe(e.id);
    const porTipo = TIPOS_ITEM.map(t => [t, itens.filter(x => (TIPOS_ITEM.includes(x.tipo) ? x.tipo : 'Outros') === t)]).filter(([, l]) => l.length);
    return '<div class="card cena">' +
      '<div class="cenaTopo"><div class="cenaHora">' + (hora ? (estimada(e) || grade.slice(0, i).some(estimada) ? '~' : '') + hora : String(i + 1).padStart(2, '0')) + '</div>' +
      '<div style="flex:1"><h3>' + esc(e.titulo) + '</h3>' +
      '<div class="meta">' + (estimada(e) ? (media ? '~' + fmtDur(media) + ' (estimado, sem duração cadastrada)' : 'duração a definir') : fmtDur(e.duracao_min)) +
        ' · ' + (ini ? fmtDur(ini) + ' de espetáculo' : 'início') + '</div></div></div>' +
      '<div class="cenaGrid">' +
      '<div><span>Em cena</span>' + (agora.length ? agora.map(id => esc(nomeElenco(id)) + ' <i>(' + esc(nomesPers(e.id, id)) + ')</i>').join('<br>') : 'Elenco a definir') + '</div>' +
      '<div><span>Movimento</span>' +
        (i === 0 ? 'Abertura' : [entram.length ? 'Entram: ' + fmt(entram) : null, saem.length ? 'Saem: ' + fmt(saem) : null].filter(Boolean).join('<br>') || 'Mesmo elenco') +
        (seguem.length ? '<div class="alerta" style="margin-top:6px">Troca rápida: ' + fmt(seguem) + '</div>' : '') + '</div>' +
      '<div><span>Precisa estar pronto</span>' + (porTipo.length ? porTipo.map(([t, l]) =>
        '<b>' + t + ':</b> ' + l.map(x => esc(x.descricao) + (x.pronto ? '' : ' <em class="alerta">(pendente)</em>')).join(', ')).join('<br>') : 'Nada cadastrado') + '</div>' +
      '</div>' + (e.notas_direcao ? '<div class="meta" style="margin-top:10px">Direção: ' + esc(e.notas_direcao) + '</div>' : '') + '</div>';
  }).join('');

  const elencoIds = [...new Set(grade.flatMap(e => elencoIdsDe(e.id)))].sort((a, b) => nomeElenco(a).localeCompare(nomeElenco(b)));
  let acc2 = 0; const horaDe = {};
  grade.forEach(e => { horaDe[e.id] = inicio !== null ? fmtHora(inicio + acc2) : null; acc2 += durDe(e); });
  const porAtor = '<div class="section"><h2>Sequência de cada integrante</h2><div class="atores">' + elencoIds.map(id =>
    '<div class="card"><h3 style="margin:0 0 8px">' + esc(nomeElenco(id)) + '</h3>' + grade.map((e, i) => elencoIdsDe(e.id).includes(id)
      ? '<div class="linha"><b style="min-width:52px">' + (horaDe[e.id] || String(i + 1).padStart(2, '0')) + '</b><span style="flex:1">' + esc(e.titulo) +
        ' <i>(' + esc(nomesPers(e.id, id)) + ')</i>' +
        (itensDe(e.id).filter(x => x.tipo === 'Figurino').length ? '<div class="meta">Figurino: ' + itensDe(e.id).filter(x => x.tipo === 'Figurino').map(x => esc(x.descricao)).join(', ') + '</div>' : '') +
        '</span></div>' : '').join('') + '</div>').join('') + '</div></div>';

  const total = grade.reduce((t, e) => t + durDe(e), 0);
  const somaConhecida = conhecidas.reduce((t, e) => t + Number(e.duracao_min), 0);
  const faltam = grade.length - conhecidas.length;
  const maior = grade.reduce((m, e) => durDe(e) > durDe(m) ? e : m, grade[0]);
  const projecao = '<div class="section card projecao">' +
    '<div class="fichaTopo"><div><div class="eyebrow">Projeção de duração</div>' +
    '<div class="pctGrande">' + (total ? (faltam ? '~' : '') + fmtDur(total) : '—') + '</div></div>' +
    '<div class="meta" style="text-align:right">' + grade.length + ' esquete' + (grade.length > 1 ? 's' : '') + ' na grade' +
      (inicio !== null && total ? '<br>Das ' + fmtHora(inicio) + ' às ' + (faltam ? '~' : '') + fmtHora(inicio + total) : '') + '</div></div>' +
    (total ? '<div class="linhaTempo">' + grade.map((e, i) => '<div class="trecho' + (estimada(e) ? ' est' : '') + '" style="flex:' + Math.max(durDe(e), 1) + '" title="' + attr(e.titulo) + '">' +
      '<span>' + String(i + 1).padStart(2, '0') + '</span></div>').join('') + '</div>' : '') +
    '<div class="projInfo">' +
    '<div><span>Tempo já cadastrado</span>' + (somaConhecida ? fmtDur(somaConhecida) : '—') + ' <small>(' + conhecidas.length + ' de ' + grade.length + ' esquetes)</small></div>' +
    '<div><span>Média por esquete</span>' + (media ? fmtDur(media) : '—') + '</div>' +
    '<div><span>Esquete mais longa</span>' + (total ? esc(maior.titulo) + ' <small>(' + fmtDur(durDe(maior)) + ')</small>' : '—') + '</div></div>' +
    (faltam ? '<div class="notice" style="margin:14px 0 0">' + (media
      ? faltam + ' esquete' + (faltam > 1 ? 's estão' : ' está') + ' sem duração. A projeção usa a média (' + fmtDur(media) + ') para ' + (faltam > 1 ? 'elas' : 'ela') + '; os horários marcados com ~ são estimados.'
      : 'Nenhuma esquete da grade tem duração cadastrada ainda. Preencha na ficha de cada esquete para calcular a projeção.') + '</div>' : '') +
    '</div>';
  const cabecalho = '<div class="card rotTopo">' +
    '<div><span>Data</span>' + (s ? esc((d => d.charAt(0).toUpperCase() + d.slice(1))(dataDaSessao(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))) : 'A definir') + '</div>' +
    '<div><span>Local</span>' + esc(s && s.local ? s.local : 'A definir') + '</div>' +
    '<div><span>Abertura da casa</span>' + (s && s.abertura ? hora(s.abertura) : '—') + '</div>' +
    '<div><span>Início</span>' + (inicio !== null ? fmtHora(inicio) : '—') + '</div>' +
    '<div><span>Término previsto</span>' + (inicio !== null && total ? (faltam ? '~' : '') + fmtHora(inicio + total) : '—') + '</div></div>';

  shell('Roteiro do dia', 'Ordem do espetáculo para a coxia · gerado a partir da Grade',
    '<div class="noprint" style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="window.print()">Imprimir roteiro</button></div>' +
    cabecalho + projecao + '<div class="section">' + blocos + '</div>' + porAtor);
}

/* ---------- Créditos da Ficha Técnica ---------- */
function textoCreditos(formato) {
  const ficha = (DB.ficha || []).slice();
  const ordemCat = c => { const i = CATEGORIAS_FICHA.indexOf(c); return i < 0 ? 99 : i; };
  const cats = [...new Set(ficha.map(x => x.categoria || 'Outros').concat(['Elenco']))].sort((a, b) => ordemCat(a) - ordemCat(b));
  const elencoNomes = [...new Set(ficha.filter(x => x.categoria === 'Elenco').map(x => x.nome)
    .concat(DB.elenco.map(e => e.nome_artistico || e.nome)))].filter(Boolean);
  const linhas = [];
  cats.forEach(cat => {
    if (cat === 'Elenco') {
      if (!elencoNomes.length) return;
      if (formato === 'programa') linhas.push('', 'ELENCO', elencoNomes.join('\n'));
      else linhas.push('Elenco: ' + elencoNomes.join(', '));
      return;
    }
    const itens = ficha.filter(x => (x.categoria || 'Outros') === cat)
      .sort((a, b) => ((a.ordem || 999) - (b.ordem || 999)) || (a.funcao || '').localeCompare(b.funcao || ''));
    if (!itens.length) return;
    const porFuncao = [];
    itens.forEach(x => { const f = porFuncao.find(p => p[0] === x.funcao); f ? f[1].push(x.nome) : porFuncao.push([x.funcao, [x.nome]]); });
    if (formato === 'programa') linhas.push('', cat.toUpperCase(), ...porFuncao.map(([f, n]) => f + ': ' + n.join(', ')));
    else porFuncao.forEach(([f, n]) => linhas.push(f + ': ' + n.join(', ')));
  });
  return (formato === 'programa' ? 'DEPOIS NÃO RECLAMA\nFicha técnica\n' : 'Ficha técnica | Depois Não Reclama\n\n') + linhas.join('\n');
}
function abrirCreditos() {
  let m = document.getElementById('credModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'credModal'; m.className = 'modal';
    m.onclick = ev => { if (ev.target === m) m.classList.remove('show'); };
    m.innerHTML = '<div class="modalbox"><div class="modalhead"><div><div class="eyebrow">Ficha técnica</div><h2>Créditos</h2></div>' +
      '<button class="close" onclick="document.getElementById(\'credModal\').classList.remove(\'show\')">×</button></div>' +
      '<div class="filters"><button class="filter active" id="credProg" onclick="mostrarCreditos(\'programa\')">Para o programa</button>' +
      '<button class="filter" id="credPost" onclick="mostrarCreditos(\'post\')">Para legenda de post</button></div>' +
      '<textarea id="credTexto" readonly style="width:100%;min-height:340px;border:1px solid var(--line);border-radius:10px;padding:14px;font:inherit;font-size:14px;line-height:1.5"></textarea>' +
      '<div class="modalactions"><button class="btn" onclick="copiarCreditos()">Copiar texto</button></div></div>';
    document.body.appendChild(m);
  }
  mostrarCreditos('programa'); m.classList.add('show');
}
function mostrarCreditos(f) {
  document.getElementById('credTexto').value = textoCreditos(f);
  document.getElementById('credProg').classList.toggle('active', f === 'programa');
  document.getElementById('credPost').classList.toggle('active', f === 'post');
}
function copiarCreditos() {
  const t = document.getElementById('credTexto').value;
  const ok = () => alert('Créditos copiados.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => { document.getElementById('credTexto').select(); });
  else document.getElementById('credTexto').select();
}

(function () {
  const s = document.createElement('style');
  s.textContent = '.prontidao .pctGrande{font-size:44px;font-weight:900;letter-spacing:-.04em;line-height:1}.prontidao .barraFundo{margin-top:14px;height:10px}' +
    '.card .barraFundo{margin:8px 0 4px}' +
    '.linhaTempo{display:flex;gap:3px;margin-top:16px;height:30px}' +
    '.trecho{background:var(--pink);border-radius:6px;display:flex;align-items:center;justify-content:center;min-width:22px;overflow:hidden}' +
    '.trecho span{font-size:11px;font-weight:800;color:#fff}.trecho.est{background:repeating-linear-gradient(45deg,#e7a1bd,#e7a1bd 6px,#f3c9da 6px,#f3c9da 12px)}.trecho.est span{color:#7f173e}' +
    '.projInfo{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px;font-weight:700}' +
    '.projInfo span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin-bottom:5px}' +
    '.projInfo small{font-weight:400;color:var(--muted)}.projecao .pctGrande{font-size:40px;font-weight:900;letter-spacing:-.04em;line-height:1}' +
    '@media(max-width:900px){.projInfo{grid-template-columns:1fr}}' +
    '@media print{.trecho{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
    '.rotTopo{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;font-weight:700}' +
    '.rotTopo span,.cenaGrid>div>span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin-bottom:5px}' +
    '.cena{margin-bottom:12px;break-inside:avoid}.cenaTopo{display:flex;gap:16px;align-items:center;margin-bottom:12px}.cenaTopo h3{margin:0 0 3px}' +
    '.cenaHora{font-size:22px;font-weight:900;min-width:72px}' +
    '.cenaGrid{display:grid;grid-template-columns:1.2fr 1fr 1.4fr;gap:16px;font-size:13px;line-height:1.5;padding-top:12px;border-top:1px solid var(--line)}' +
    '.atores{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.atores .card{break-inside:avoid}' +
    '@media(max-width:900px){.rotTopo{grid-template-columns:1fr 1fr}.cenaGrid,.atores{grid-template-columns:1fr}}' +
    '@media print{.side,.noprint,.top .sub{display:none!important}.app{display:block}.main{padding:0;max-width:none}' +
    'body{background:#fff}.card{box-shadow:none;border-color:#ccc}.cena,.atores .card{page-break-inside:avoid}}';
  document.head.appendChild(s);
})();
