/* O que é de cada pessoa: resumo do acesso no Início, detalhe em Minha conta
   e o bloco "O que é seu" com demandas, convocações e itens sob responsabilidade dela. */

const O_QUE_LIBERA = {
  'Direção': 'faz tudo na plataforma, inclusive aprovações e acessos',
  'Produção': 'cuida de ensaios, demandas, divulgação, orçamento, checklist e cadastros',
  'Elenco': 'anexa textos das esquetes e responde às convocações de ensaio',
  'Financeiro': 'trabalha no orçamento',
  'Divulgação': 'trabalha na divulgação', 'Social Media': 'trabalha na divulgação',
  'Fotografia': 'trabalha na divulgação', 'Vídeo': 'trabalha na divulgação',
  'Figurino': 'cuida das necessidades de cena e do Checklist Final', 'Adereços': 'cuida das necessidades de cena e do Checklist Final',
  'Direção de arte': 'cuida das necessidades de cena e do Checklist Final', 'Técnico': 'cuida das necessidades de cena e do Checklist Final',
  'Assistente de produção': 'cuida das Demandas e do Checklist Final',
  'Convidado': 'acompanha a plataforma'
};
/* Tipos de necessidade de cena de cada área */
const TIPOS_DA_AREA = { 'Figurino': ['Figurino'], 'Adereços': ['Adereços'], 'Direção de arte': ['Cenário', 'Adereços'], 'Técnico': ['Iluminação', 'Sonoplastia'] };

function minhasFuncoes() { return user ? funcoesDe(user.id).map(f => f.nome) : []; }

function juntarFrases(l) { return l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]; }
function frasesDoAcesso(nomes) {
  if (nomes.includes('Direção')) return [O_QUE_LIBERA['Direção']];
  const l = [...new Set(nomes.map(n => O_QUE_LIBERA[n]).filter(Boolean))];
  return l.length ? l : ['acompanha a plataforma (só consulta)'];
}

/* 1. Linha no topo do Início */
function blocoMeuAcesso() {
  if (!acessoLiberado || !user) return '';
  const nomes = minhasFuncoes();
  return '<div class="meuAcesso"><span><b>Seu acesso:</b> ' + esc(nomes.join(' · ') || 'Consulta') + '. ' +
    'Você ' + esc(juntarFrases(frasesDoAcesso(nomes))) + '.</span>' +
    '<a href="#" onclick="go(\'conta\');return false">Ver o que cada função libera</a></div>';
}

/* 2. Detalhe em Minha conta */
function blocoMinhasFuncoes() {
  const nomes = minhasFuncoes();
  const linhas = (nomes.length ? nomes : ['Consulta']).map(n => '<dt>' + esc(n) + '</dt><dd>' +
    esc(n === 'Consulta' ? 'Você vê a plataforma, mas não altera nada.' : 'Você ' + (O_QUE_LIBERA[n] || 'tem esta função') + '.') + '</dd>').join('');
  return '<div class="card section suasFuncoes"><h2>Suas funções</h2><dl>' + linhas + '</dl>' +
    '<div class="meta">As funções são definidas pela Direção. Se faltar alguma, fale com ela.</div>' +
    '<details class="todasFuncoes"><summary>Ver o que cada função libera</summary>' + guiaFuncoesConteudo() + '</details></div>';
}

/* 3. "O que é seu" */
function nomesMeus() {
  const el = typeof meuElenco === 'function' ? meuElenco() : null;
  const tc = typeof cadastroTecnicaDaConta === 'function' && user ? cadastroTecnicaDaConta(user.id) : null;
  return [DB.perfil && DB.perfil.nome, el && el.nome, el && el.nome_artistico, tc && tc.nome]
    .map(n => String(n || '').trim().toLowerCase()).filter(Boolean);
}
function ehMeu(resp) {
  const r = String(resp || '').trim().toLowerCase();
  if (!r) return false;
  const meus = nomesMeus();
  const palavras = r.split(/\s+/);
  return meus.some(n => n === r) || meus.some(n => palavras.includes(n.split(' ')[0]));
}
function dataItem(d) { return d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''; }
function selo(d) {
  if (!d) return '';
  const dias = diasAte(String(d).slice(0, 10));
  return dias < 0 ? '<span class="chip nao">Atrasado</span>' : dias === 0 ? '<span class="chip aviso">Hoje</span>' : dias <= 7 ? '<span class="chip aviso">Em ' + dias + ' dia' + (dias > 1 ? 's' : '') + '</span>' : '';
}

function itensQueSaoMeus() {
  const l = [];
  // Demandas da Produção
  DB.tarefas.filter(t => t.status !== 'Concluído' && ehMeu(t.responsavel)).forEach(t => {
    const ents = typeof entregasDe === 'function' ? entregasDe(t) : [];
    const prox = ents.find(e => !e.feito);
    l.push({ tipo: 'Demanda', titulo: t.titulo, data: prox ? prox.data : t.prazo,
      detalhe: (prox && prox.nome ? prox.nome + ' · ' : '') + (prox || t.prazo ? 'entrega ' + dataItem(prox ? prox.data : t.prazo) : (t.status || 'A fazer')),
      acao: "go('producao');setTimeout(()=>abrirDetalheTarefa('" + t.id + "'),50)" });
  });
  // Convocações de ensaio sem resposta
  const eu = typeof meuElenco === 'function' ? meuElenco() : null;
  if (eu) DB.ensaios.filter(x => !ensaioPassou(x) && x.status !== 'Cancelado' && convocadosDe(x).some(e => e.id === eu.id)).forEach(x => {
    const p = presencaDe(x.id, eu.id);
    if (p && p.resposta) return;
    l.push({ tipo: 'Ensaio', titulo: x.titulo || 'Ensaio', data: x.data_hora, detalhe: dataEnsaio(x, true) + ' · responda se vai', acao: "abrirEnsaio('" + x.id + "')", urgente: true });
  });
  // Divulgação
  (DB.divulgacao || []).filter(x => !['Publicado', 'Cancelado'].includes(x.status) && ehMeu(x.responsavel)).forEach(x =>
    l.push({ tipo: 'Divulgação', titulo: x.titulo || 'Ação de divulgação', data: x.data_publicacao, detalhe: (x.status || 'Planejado') + (x.data_publicacao ? ' · ' + dataItem(x.data_publicacao) : ''), acao: "go('divulgacao')" }));
  // Checklist Final
  (DB.checklist || []).filter(x => !x.concluido && ehMeu(x.responsavel)).forEach(x =>
    l.push({ tipo: 'Checklist', titulo: x.item, data: x.prazo, detalhe: x.prazo ? 'até ' + dataItem(x.prazo) : 'Checklist Final', acao: "go('checklist')" }));
  // Necessidades de cena com o meu nome
  const grade = new Set(esqSelecionadas().map(e => e.id));
  (DB.itens || []).filter(i => !i.pronto && ehMeu(i.responsavel)).forEach(i => {
    const e = DB.esquetes.find(s => s.id === i.esquete_id);
    l.push({ tipo: i.tipo || 'Cena', titulo: i.descricao, detalhe: e ? e.titulo + (grade.has(e.id) ? '' : ' (fora da grade)') : '', acao: e ? "abrirEsquete('" + e.id + "')" : "go('checklist')" });
  });
  return l.sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) || String(a.data || '9999').localeCompare(String(b.data || '9999')));
}

/* Itens de cena pendentes da minha área, sem responsável definido */
function pendentesDaArea() {
  const tipos = [...new Set(minhasFuncoes().flatMap(n => TIPOS_DA_AREA[n] || []))];
  if (!tipos.length) return [];
  const grade = new Set(esqSelecionadas().map(e => e.id));
  return tipos.map(t => ({ tipo: t, n: (DB.itens || []).filter(i => grade.has(i.esquete_id) && !i.pronto && i.tipo === t && !i.responsavel).length })).filter(x => x.n);
}

function blocoOQueESeu() {
  if (!acessoLiberado || !user) return '';
  const itens = itensQueSaoMeus(), area = pendentesDaArea();
  const MAX = 6;
  const linha = x => '<a href="#" class="meuItem" onclick="' + x.acao + ';return false">' +
    '<span class="meuTipo">' + esc(x.tipo) + '</span><span class="meuTexto"><b>' + esc(x.titulo) + '</b><span>' + esc(x.detalhe || '') + '</span></span>' +
    (x.urgente ? '<span class="chip aviso">Responder</span>' : selo(x.data)) + '</a>';
  const corpo = itens.length || area.length
    ? itens.slice(0, MAX).map(linha).join('') +
      (itens.length > MAX ? '<div class="meta" style="margin-top:8px">E mais ' + (itens.length - MAX) + '. Veja tudo em Produção, Ensaios e Checklist Final.</div>' : '') +
      area.map(a => '<a href="#" class="meuItem" onclick="go(\'checklist\');return false"><span class="meuTipo">' + esc(a.tipo) + '</span><span class="meuTexto"><b>' +
        a.n + ' ' + (a.n > 1 ? 'itens pendentes' : 'item pendente') + ' na grade</b><span>Sem responsável definido</span></span></a>').join('')
    : '<div class="empty">Nada pendente com você por enquanto.</div>';
  return '<div class="section card oQueESeu"><h2>O que é seu</h2>' + corpo + '</div>';
}
