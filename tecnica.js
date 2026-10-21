/* Aba "Técnica e Staff": equipe técnica e quem cuida da organização e apoio do evento.
   A produção do espetáculo continua nas contas com a função Produção (Equipe e acessos). */

const GRUPOS_TECNICA = ['Técnica', 'Staff'];
const DESCRICAO_GRUPO = { 'Técnica': 'Luz, som, vídeo e operação do espetáculo', 'Staff': 'Organização e apoio do evento' };
const EXEMPLOS_FUNCAO = { 'Técnica': 'Ex.: Iluminação, sonoplastia, operação de vídeo', 'Staff': 'Ex.: Bilheteria, recepção, contrarregragem, apoio', 'Produção': '' };
function grupoTecnica(p) { return GRUPOS_TECNICA.includes(p.grupo) ? p.grupo : 'Staff'; }
let tecnicaEditando = null;

/* Mesma pessoa no Elenco e em Técnica e Staff (ligadas pela mesma conta):
   a foto de um cadastro aparece no outro quando este não tem foto própria */
function cadastroElencoDaConta(pid) { return pid ? DB.elenco.find(e => e.perfil_id === pid) || null : null; }
function cadastroTecnicaDaConta(pid) { return pid ? (DB.tecnica || []).find(e => e.perfil_id === pid) || null : null; }
function fotoDaPessoa(n) {
  if (!n) return '';
  if (n.foto_url) return n.foto_url;
  const outro = DB.elenco.includes(n) ? cadastroTecnicaDaConta(n.perfil_id) : cadastroElencoDaConta(n.perfil_id);
  return outro && outro.foto_url ? outro.foto_url : '';
}

function iniciais(nome) { return String(nome || '').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }

/* ---------- Contatos (telefone, e-mail, rede social) ---------- */
const CAMPOS_CONTATO = ['telefone', 'email', 'rede_social'];
/* Valor do cadastro; se vazio, usa o da mesma pessoa na outra aba (Elenco ↔ Técnica e Staff) */
function contatoDe(n, campo) {
  if (n[campo]) return n[campo];
  const outro = DB.elenco.includes(n) ? cadastroTecnicaDaConta(n.perfil_id) : cadastroElencoDaConta(n.perfil_id);
  return outro && outro[campo] ? outro[campo] : '';
}
function linkTelefone(t) {
  const dig = String(t).replace(/\D/g, '');
  if (dig.length < 8) return esc(t);
  const wa = dig.length <= 11 ? '55' + dig : dig;
  return '<a href="https://wa.me/' + wa + '" target="_blank" rel="noopener" title="Abrir no WhatsApp">' + esc(t) + '</a>';
}
function hrefRede(r) {
  r = String(r || '').trim();
  if (/^@[\w.]+$/.test(r)) return 'https://www.instagram.com/' + r.slice(1);
  if (/^https?:\/\//i.test(r)) return r;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(r) || /^(www\.)?[a-z0-9-]+\.(com|com\.br|net|me|tv)(\/|$)/i.test(r)) return 'https://' + r;
  return null;
}
function rotuloRede(r) {
  const h = hrefRede(r);
  if (!h || /^@/.test(r)) return esc(r);
  const m = h.match(/(instagram|tiktok|facebook|linkedin|youtube|twitter|x)\.com\/(@?[\w.\-]+)/i);
  return m ? esc((m[2].startsWith('@') ? '' : '@') + m[2]) : esc(r.replace(/^https?:\/\/(www\.)?/i, ''));
}
function blocoContatos(n) {
  const t = contatoDe(n, 'telefone'), e = contatoDe(n, 'email'), r = contatoDe(n, 'rede_social');
  const linhas = [];
  if (t) linhas.push('<div><span>Telefone</span>' + linkTelefone(t) + '</div>');
  if (e) linhas.push('<div><span>E-mail</span><a href="mailto:' + esc(e) + '">' + esc(e) + '</a></div>');
  if (r) { const h = hrefRede(r); linhas.push('<div><span>Rede social</span>' + (h ? '<a href="' + esc(h) + '" target="_blank" rel="noopener">' + rotuloRede(r) + '</a>' : esc(r)) + '</div>'); }
  if (!linhas.length && n.contato) linhas.push('<div>' + linkContato(n.contato) + '</div>');
  return linhas.length ? '<div class="contatos">' + linhas.join('') + '</div>' : '';
}
function camposContato(prefixo) {
  return '<div class="field"><label>Telefone / WhatsApp</label><input id="' + prefixo + 'Telefone" type="tel" inputmode="tel" placeholder="(67) 99999-9999"></div>' +
    '<div class="field"><label>E-mail</label><input id="' + prefixo + 'Email" type="email" placeholder="nome@email.com"></div>' +
    '<div class="field full"><label>Rede social</label><input id="' + prefixo + 'Rede" placeholder="@usuario ou link do perfil (Instagram, TikTok...)"></div>';
}
function preencherContatos(prefixo, r) {
  const outro = r ? (DB.elenco.includes(r) ? cadastroTecnicaDaConta(r.perfil_id) : cadastroElencoDaConta(r.perfil_id)) : null;
  [['Telefone', 'telefone'], ['Email', 'email'], ['Rede', 'rede_social']].forEach(([s, c]) => {
    const i = document.getElementById(prefixo + s);
    i.value = (r && r[c]) || '';
    i.dataset.ph = i.dataset.ph || i.placeholder;
    i.placeholder = outro && outro[c] ? 'Igual ao outro cadastro: ' + outro[c] : i.dataset.ph;
  });
}
function lerContatos(prefixo) {
  const g = s => document.getElementById(prefixo + s).value.trim();
  const email = g('Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'Confira o e-mail: ' + email };
  return { telefone: g('Telefone') || null, email: email || null, rede_social: g('Rede') || null };
}
/* Grava; se o 010 ainda não foi rodado, salva sem os contatos e avisa */
async function gravarComContatos(tabela, payload, id) {
  const gravar = p => id ? sbClient.from(tabela).update(p).eq('id', id) : sbClient.from(tabela).insert(p);
  let r = await gravar(payload);
  if (r.error && /telefone|email|rede_social/.test(r.error.message)) {
    const sem = Object.assign({}, payload); CAMPOS_CONTATO.forEach(c => delete sem[c]);
    r = await gravar(sem);
    if (!r.error) avisar('Salvo, mas sem os contatos: falta rodar o arquivo supabase/010_contatos.sql no Supabase (SQL Editor).', 'erro');
  }
  return r;
}

function linkContato(c) {
  c = String(c || '').trim();
  if (!c) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return '<a href="mailto:' + esc(c) + '">' + esc(c) + '</a>';
  const dig = c.replace(/\D/g, '');
  if (dig.length >= 10 && dig.length <= 13 && !/[a-z]/i.test(c)) return '<a href="https://wa.me/' + (dig.length <= 11 ? '55' + dig : dig) + '" target="_blank" rel="noopener">' + esc(c) + '</a>';
  if (/^@\w/.test(c)) return '<a href="https://www.instagram.com/' + esc(c.slice(1)) + '" target="_blank" rel="noopener">' + esc(c) + '</a>';
  return esc(c);
}

function producaoTecnica() {
  const gest = eGestao();
  const lista = DB.tecnica || [];
  const cartao = n => '<div class="card person">' +
    '<div class="avatar">' + (fotoDaPessoa(n) ? '<img src="' + esc(fotoDaPessoa(n)) + '" alt="' + esc(n.nome) + '">' : esc(iniciais(n.nome))) + '</div>' +
    '<b>' + esc(n.nome) + '</b>' +
    (n.funcao ? '<div class="meta">' + esc(n.funcao) + '</div>' : '') +
    (cadastroElencoDaConta(n.perfil_id) ? '<div class="meta">Também no Elenco</div>' : '') +
    blocoContatos(n) +
    (gest ? '<div style="margin-top:12px"><button class="filter" onclick="abrirModalTecnica(\'' + n.id + '\')">Editar</button>' +
      '<button class="filter" style="margin-left:6px" onclick="inativarTecnica(\'' + n.id + '\')">Inativar</button></div>' : '') +
    '</div>';
  const secoes = GRUPOS_TECNICA.map(g => {
    const pessoas = lista.filter(p => grupoTecnica(p) === g);
    return '<div class="section"><h2>' + g + ' <span class="meta">(' + pessoas.length + ')</span></h2><div class="sub" style="margin:-6px 0 12px">' + DESCRICAO_GRUPO[g] + '</div>' +
      (pessoas.length ? '<div class="cast">' + pessoas.map(cartao).join('') + '</div>'
        : '<div class="empty">Ninguém cadastrado em ' + g + ' ainda.' + (gest ? ' <a href="#" onclick="abrirModalTecnica(null,\'' + g + '\');return false">Adicionar</a>' : '') + '</div>') +
      '</div>';
  }).join('');
  shell('Técnica e Staff', lista.length + ' pessoa(s) na equipe técnica e no staff do evento',
    (gest ? '<div style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="abrirModalTecnica()">+ Adicionar pessoa</button></div>' : '') +
    secoes + (gest ? modalTecnica() : ''));
}

function modalTecnica() {
  return '<div id="tecnicaModal" class="modal" onclick="if(event.target===this)fecharModalTecnica()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Técnica e Staff</div><h2 id="tecnicaTitulo">Nova pessoa</h2></div><button class="close" onclick="fecharModalTecnica()">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Nome</label><input id="xNome" placeholder="Nome como deve aparecer na plataforma"></div>' +
    '<div class="field"><label>Grupo</label><select id="xGrupo" onchange="document.getElementById(\'xFuncao\').placeholder=EXEMPLOS_FUNCAO[this.value]">' + GRUPOS_TECNICA.map(g => '<option>' + g + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Função</label><input id="xFuncao"></div>' +
    camposContato('x') +
    '<div class="field full"><label>Conta na plataforma</label><select id="xPerfil" onchange="contaTecnicaEscolhida()"></select></div>' +
    '<div class="field full" id="xDoElenco" hidden></div>' +
    '<div class="field full"><label>Foto</label><input id="xFoto" type="file" accept="image/png,image/jpeg,image/webp"></div>' +
    '<div class="field full"><label>Observações</label><textarea id="xObs" placeholder="Informações úteis sobre a pessoa..."></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharModalTecnica()">Cancelar</button><button class="btn" onclick="salvarTecnica()">Salvar</button></div>' +
    '</div></div>';
}

function opcoesContasTecnica(atual) {
  const usadas = new Set((DB.tecnica || []).map(e => e.perfil_id).filter(id => id && id !== atual));
  const contas = (DB.perfis || []).filter(p => p.status === 'aprovado' && !usadas.has(p.id)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  return '<option value="">Sem conta ligada</option>' + contas.map(p =>
    '<option value="' + p.id + '" ' + (p.id === atual ? 'selected' : '') + '>' + esc(p.nome || p.email) + (p.email ? ' (' + esc(p.email) + ')' : '') +
    (cadastroElencoDaConta(p.id) ? ' · Elenco: ' + esc(cadastroElencoDaConta(p.id).nome) : '') + '</option>').join('');
}
/* Ao ligar a conta de alguém que já está no Elenco, traz nome, foto e observações de lá */
function contaTecnicaEscolhida(abrindo) {
  const pid = document.getElementById('xPerfil').value, el = cadastroElencoDaConta(pid);
  const box = document.getElementById('xDoElenco');
  if (!el) { box.hidden = true; box.innerHTML = ''; return; }
  const nome = document.getElementById('xNome'), obs = document.getElementById('xObs');
  if (!abrindo) {
    if (!nome.value.trim()) nome.value = el.nome;
    if (!obs.value.trim() && el.observacoes) obs.value = el.observacoes;
  }
  const temFotoPropria = tecnicaEditando && tecnicaEditando.foto_url;
  box.hidden = false;
  box.innerHTML = '<div class="doElenco">' +
    '<div class="avatar">' + (el.foto_url ? '<img src="' + esc(el.foto_url) + '" alt="">' : esc(iniciais(el.nome))) + '</div>' +
    '<div><b>' + esc(el.nome) + ' também está no Elenco</b><div class="meta">' +
    (temFotoPropria ? 'Este cadastro tem foto própria. Para usar a do Elenco, remova a foto daqui.' :
      el.foto_url ? 'A foto do Elenco aparece aqui automaticamente. Se trocar a foto no Elenco, ela muda aqui também.' : 'O cadastro no Elenco ainda não tem foto.') +
    '</div>' + (temFotoPropria && el.foto_url ? '<label class="checkLinha" style="margin-top:6px"><input type="checkbox" id="xUsarFotoElenco"> Usar a foto do Elenco</label>' : '') + '</div></div>';
}

function abrirModalTecnica(id, grupo) {
  tecnicaEditando = id ? (DB.tecnica || []).find(x => x.id === id) : null;
  const r = tecnicaEditando;
  document.getElementById('tecnicaModal').classList.add('show');
  document.getElementById('tecnicaTitulo').textContent = r ? 'Editar pessoa' : 'Nova pessoa';
  const v = (i, val) => { document.getElementById(i).value = val || ''; };
  v('xNome', r && r.nome); v('xGrupo', r ? grupoTecnica(r) : (grupo || 'Técnica')); v('xFuncao', r && r.funcao);
  v('xObs', r && r.observacoes);
  preencherContatos('x', r);
  document.getElementById('xFuncao').placeholder = EXEMPLOS_FUNCAO[document.getElementById('xGrupo').value];
  document.getElementById('xPerfil').innerHTML = opcoesContasTecnica(r && r.perfil_id);
  document.getElementById('xFoto').value = '';
  contaTecnicaEscolhida(true);
  setTimeout(() => document.getElementById('xNome').focus(), 30);
}
function fecharModalTecnica() { const m = document.getElementById('tecnicaModal'); if (m) m.classList.remove('show'); tecnicaEditando = null; }

async function salvarTecnica() {
  const g = i => document.getElementById(i).value.trim();
  const nome = g('xNome');
  if (!nome) return alert('Informe o nome da pessoa.');
  const contatos = lerContatos('x');
  if (contatos.erro) return alert(contatos.erro);
  const payload = Object.assign({ nome, grupo: g('xGrupo'), funcao: g('xFuncao'), observacoes: g('xObs'), perfil_id: g('xPerfil') || null, ativo: true }, contatos);
  const foto = document.getElementById('xFoto').files[0];
  const usarElenco = document.getElementById('xUsarFotoElenco');
  if (!foto && usarElenco && usarElenco.checked) payload.foto_url = null;
  if (foto) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(foto.type)) return alert('A foto precisa ser JPG, PNG ou WEBP.');
    if (foto.size > 5 * 1024 * 1024) return alert('A foto deve ter no máximo 5 MB.');
    const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const caminho = 'equipe/' + ((tecnicaEditando && tecnicaEditando.id) || crypto.randomUUID()) + '/' + Date.now() + '.' + ext;
    const up = await sbClient.storage.from('elenco-fotos').upload(caminho, foto, { contentType: foto.type, upsert: true });
    if (up.error) return alert('Não foi possível enviar a foto: ' + up.error.message);
    payload.foto_url = sbClient.storage.from('elenco-fotos').getPublicUrl(caminho).data.publicUrl;
  }
  const r = await gravarComContatos('equipe_tecnica', payload, tecnicaEditando && tecnicaEditando.id);
  if (r.error) return alert(/equipe_tecnica/.test(r.error.message)
    ? 'Falta rodar o arquivo supabase/009_producao_tecnica_staff.sql no Supabase (SQL Editor).'
    : 'Não foi possível salvar: ' + r.error.message);
  fecharModalTecnica(); await load();
}

async function inativarTecnica(id) {
  const p = (DB.tecnica || []).find(x => x.id === id);
  if (!p || !await confirmar('Inativar ' + p.nome + '?\n\nA pessoa sai da lista, mas as demandas em que ela é responsável continuam com o nome.', { ok: 'Inativar' })) return;
  const r = await sbClient.from('equipe_tecnica').update({ ativo: false }).eq('id', id);
  if (r.error) return alert('Não foi possível inativar: ' + r.error.message);
  await load();
}
