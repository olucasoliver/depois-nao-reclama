/* Aba "Produção/Técnica e Staff": pessoas da equipe que não estão no elenco */

const GRUPOS_TECNICA = ['Produção', 'Técnica', 'Staff'];
const EXEMPLOS_FUNCAO = { 'Produção': 'Ex.: Produção executiva, assistente de produção', 'Técnica': 'Ex.: Iluminação, sonoplastia, operação de vídeo', 'Staff': 'Ex.: Bilheteria, recepção, contrarregragem' };
let tecnicaEditando = null;

function iniciais(nome) { return String(nome || '').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }

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
    '<div class="avatar">' + (n.foto_url ? '<img src="' + esc(n.foto_url) + '" alt="' + esc(n.nome) + '">' : esc(iniciais(n.nome))) + '</div>' +
    '<b>' + esc(n.nome) + '</b>' +
    (n.funcao ? '<div class="meta">' + esc(n.funcao) + '</div>' : '') +
    (n.contato ? '<div class="meta contatoPessoa">' + linkContato(n.contato) + '</div>' : '') +
    (gest ? '<div style="margin-top:12px"><button class="filter" onclick="abrirModalTecnica(\'' + n.id + '\')">Editar</button>' +
      '<button class="filter" style="margin-left:6px" onclick="inativarTecnica(\'' + n.id + '\')">Inativar</button></div>' : '') +
    '</div>';
  const secoes = GRUPOS_TECNICA.map(g => {
    const pessoas = lista.filter(p => (p.grupo || 'Produção') === g);
    return '<div class="section"><h2>' + g + ' <span class="meta">(' + pessoas.length + ')</span></h2>' +
      (pessoas.length ? '<div class="cast">' + pessoas.map(cartao).join('') + '</div>'
        : '<div class="empty">Ninguém cadastrado em ' + g + ' ainda.' + (gest ? ' <a href="#" onclick="abrirModalTecnica(null,\'' + g + '\');return false">Adicionar</a>' : '') + '</div>') +
      '</div>';
  }).join('');
  shell('Produção/Técnica e Staff', lista.length + ' pessoa(s) na equipe de produção, técnica e staff',
    (gest ? '<div style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="abrirModalTecnica()">+ Adicionar pessoa</button></div>' : '') +
    secoes + (gest ? modalTecnica() : ''));
}

function modalTecnica() {
  return '<div id="tecnicaModal" class="modal" onclick="if(event.target===this)fecharModalTecnica()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Produção/Técnica e Staff</div><h2 id="tecnicaTitulo">Nova pessoa</h2></div><button class="close" onclick="fecharModalTecnica()">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Nome</label><input id="xNome" placeholder="Nome como deve aparecer na plataforma"></div>' +
    '<div class="field"><label>Grupo</label><select id="xGrupo" onchange="document.getElementById(\'xFuncao\').placeholder=EXEMPLOS_FUNCAO[this.value]">' + GRUPOS_TECNICA.map(g => '<option>' + g + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Função</label><input id="xFuncao"></div>' +
    '<div class="field"><label>Contato</label><input id="xContato" placeholder="Telefone, e-mail ou @"></div>' +
    '<div class="field"><label>Conta na plataforma</label><select id="xPerfil"></select></div>' +
    '<div class="field full"><label>Foto</label><input id="xFoto" type="file" accept="image/png,image/jpeg,image/webp"></div>' +
    '<div class="field full"><label>Observações</label><textarea id="xObs" placeholder="Informações úteis sobre a pessoa..."></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharModalTecnica()">Cancelar</button><button class="btn" onclick="salvarTecnica()">Salvar</button></div>' +
    '</div></div>';
}

function opcoesContasTecnica(atual) {
  const usadas = new Set((DB.tecnica || []).map(e => e.perfil_id).filter(id => id && id !== atual));
  const contas = (DB.perfis || []).filter(p => p.status === 'aprovado' && !usadas.has(p.id)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  return '<option value="">Sem conta ligada</option>' + contas.map(p =>
    '<option value="' + p.id + '" ' + (p.id === atual ? 'selected' : '') + '>' + esc(p.nome || p.email) + (p.email ? ' (' + esc(p.email) + ')' : '') + '</option>').join('');
}

function abrirModalTecnica(id, grupo) {
  tecnicaEditando = id ? (DB.tecnica || []).find(x => x.id === id) : null;
  const r = tecnicaEditando;
  document.getElementById('tecnicaModal').classList.add('show');
  document.getElementById('tecnicaTitulo').textContent = r ? 'Editar pessoa' : 'Nova pessoa';
  const v = (i, val) => { document.getElementById(i).value = val || ''; };
  v('xNome', r && r.nome); v('xGrupo', (r && r.grupo) || grupo || 'Produção'); v('xFuncao', r && r.funcao);
  v('xContato', r && r.contato); v('xObs', r && r.observacoes);
  document.getElementById('xFuncao').placeholder = EXEMPLOS_FUNCAO[document.getElementById('xGrupo').value];
  document.getElementById('xPerfil').innerHTML = opcoesContasTecnica(r && r.perfil_id);
  document.getElementById('xFoto').value = '';
  setTimeout(() => document.getElementById('xNome').focus(), 30);
}
function fecharModalTecnica() { const m = document.getElementById('tecnicaModal'); if (m) m.classList.remove('show'); tecnicaEditando = null; }

async function salvarTecnica() {
  const g = i => document.getElementById(i).value.trim();
  const nome = g('xNome');
  if (!nome) return alert('Informe o nome da pessoa.');
  const payload = { nome, grupo: g('xGrupo'), funcao: g('xFuncao'), contato: g('xContato'), observacoes: g('xObs'), perfil_id: g('xPerfil') || null, ativo: true };
  const foto = document.getElementById('xFoto').files[0];
  if (foto) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(foto.type)) return alert('A foto precisa ser JPG, PNG ou WEBP.');
    if (foto.size > 5 * 1024 * 1024) return alert('A foto deve ter no máximo 5 MB.');
    const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const caminho = 'equipe/' + ((tecnicaEditando && tecnicaEditando.id) || crypto.randomUUID()) + '/' + Date.now() + '.' + ext;
    const up = await sbClient.storage.from('elenco-fotos').upload(caminho, foto, { contentType: foto.type, upsert: true });
    if (up.error) return alert('Não foi possível enviar a foto: ' + up.error.message);
    payload.foto_url = sbClient.storage.from('elenco-fotos').getPublicUrl(caminho).data.publicUrl;
  }
  const r = tecnicaEditando ? await sbClient.from('equipe_tecnica').update(payload).eq('id', tecnicaEditando.id)
                            : await sbClient.from('equipe_tecnica').insert(payload);
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
