/* Sessões do espetáculo: data, local, horários e contagem regressiva no Início. */

let sessaoEditando = null;

function hojeLocal() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function dataDaSessao(s) { return new Date(s.data + 'T00:00:00'); }
function hora(h) { return h ? String(h).slice(0, 5).replace(':', 'h') : ''; }

function sessoesOrdenadas() {
  return (DB.sessoes || []).slice().sort((a, b) => (a.data + (a.inicio || '')).localeCompare(b.data + (b.inicio || '')));
}
function proximaSessao() {
  const lista = sessoesOrdenadas(), hoje = hojeLocal();
  return lista.find(s => dataDaSessao(s) >= hoje) || null;
}

function contagem(s) {
  const dias = Math.round((dataDaSessao(s) - hojeLocal()) / 86400000);
  if (dias === 0) return 'É hoje';
  if (dias === 1) return 'Falta 1 dia';
  if (dias < 60) return 'Faltam ' + dias + ' dias';
  const semanas = Math.floor(dias / 7);
  return 'Faltam ' + dias + ' dias · ' + semanas + ' semanas';
}

function blocoSessao() {
  const lista = sessoesOrdenadas(), s = proximaSessao();
  const estreia = lista[0] && s && lista[0].id === s.id;
  if (!s) {
    return '<div class="section next sessao"><div class="eyebrow" style="color:#f5a7c2">' + (lista.length ? 'Temporada encerrada' : 'Estreia') + '</div>' +
      '<h2 class="sessaoData">Data, local e horários a definir</h2>' +
      '<div style="margin-top:16px"><button class="btn" onclick="abrirSessao()">+ Cadastrar sessão</button></div></div>' + modalSessao();
  }
  let dataExtensa = dataDaSessao(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  dataExtensa = dataExtensa.charAt(0).toUpperCase() + dataExtensa.slice(1);
  const outras = lista.filter(x => x.id !== s.id && dataDaSessao(x) >= hojeLocal());
  return '<div class="section next sessao"><div class="sessaoTopo"><div>' +
    '<div class="eyebrow" style="color:#f5a7c2">' + (estreia ? 'Estreia' : 'Próxima sessão') + '</div>' +
    '<h2 class="sessaoData">' + esc(dataExtensa) + '</h2>' +
    '<div class="sessaoConta">' + contagem(s) + '</div></div>' +
    '<button class="filter" onclick="abrirSessao(\'' + s.id + '\')">Editar</button></div>' +
    '<div class="sessaoInfo">' +
    '<div><span>Local</span>' + esc(s.local || 'A definir') + (s.endereco ? '<small>' + esc(s.endereco) + '</small>' : '') + '</div>' +
    '<div><span>Abertura da casa</span>' + (hora(s.abertura) || 'A definir') + '</div>' +
    '<div><span>Início</span>' + (hora(s.inicio) || 'A definir') + '</div></div>' +
    (s.observacoes ? '<div class="muted" style="margin-top:14px">' + esc(s.observacoes) + '</div>' : '') +
    (outras.length ? '<div class="muted" style="margin-top:14px">Outras sessões: ' + outras.map(x =>
      esc(dataDaSessao(x).toLocaleDateString('pt-BR')) + (x.inicio ? ' às ' + hora(x.inicio) : '')).join(' · ') + '</div>' : '') +
    '<div style="margin-top:14px"><button class="filter" onclick="abrirSessao()">+ Nova sessão</button></div>' +
    '</div>' + modalSessao();
}

function modalSessao() {
  return '<div id="sessaoModal" class="modal" onclick="if(event.target===this)fecharSessao()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Espetáculo</div><h2 id="sessaoTitulo">Nova sessão</h2></div><button class="close" onclick="fecharSessao()">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field"><label>Data</label><input id="sData" type="date"></div>' +
    '<div class="field"><label>Local</label><input id="sLocal" placeholder="Nome do teatro ou espaço"></div>' +
    '<div class="field full"><label>Endereço</label><input id="sEndereco" placeholder="Rua, número, bairro"></div>' +
    '<div class="field"><label>Abertura da casa</label><input id="sAbertura" type="time"></div>' +
    '<div class="field"><label>Início do espetáculo</label><input id="sInicio" type="time"></div>' +
    '<div class="field full"><label>Observações</label><textarea id="sObs" placeholder="Classificação, ingressos, acessibilidade..."></textarea></div>' +
    '</div><div class="modalactions"><button class="filter" id="sExcluir" onclick="excluirSessao()">Excluir sessão</button>' +
    '<span style="flex:1"></span><button class="filter" onclick="fecharSessao()">Cancelar</button><button class="btn" onclick="salvarSessao()">Salvar</button></div>' +
    '</div></div>';
}

function abrirSessao(id) {
  sessaoEditando = id ? DB.sessoes.find(x => x.id === id) : null;
  const r = sessaoEditando;
  document.getElementById('sessaoModal').classList.add('show');
  document.getElementById('sessaoTitulo').textContent = r ? 'Editar sessão' : 'Nova sessão';
  document.getElementById('sData').value = r ? r.data : '';
  document.getElementById('sLocal').value = r ? r.local || '' : '';
  document.getElementById('sEndereco').value = r ? r.endereco || '' : '';
  document.getElementById('sAbertura').value = r && r.abertura ? String(r.abertura).slice(0, 5) : '';
  document.getElementById('sInicio').value = r && r.inicio ? String(r.inicio).slice(0, 5) : '';
  document.getElementById('sObs').value = r ? r.observacoes || '' : '';
  document.getElementById('sExcluir').style.display = r ? '' : 'none';
}
function fecharSessao() { const m = document.getElementById('sessaoModal'); if (m) m.classList.remove('show'); sessaoEditando = null; }

async function salvarSessao() {
  const data = document.getElementById('sData').value;
  if (!data) return alert('Informe a data da sessão.');
  const payload = {
    data,
    local: document.getElementById('sLocal').value.trim(),
    endereco: document.getElementById('sEndereco').value.trim(),
    abertura: document.getElementById('sAbertura').value || null,
    inicio: document.getElementById('sInicio').value || null,
    observacoes: document.getElementById('sObs').value.trim()
  };
  const r = sessaoEditando
    ? await sbClient.from('sessoes').update(payload).eq('id', sessaoEditando.id)
    : await sbClient.from('sessoes').insert(payload);
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  fecharSessao(); await load(); go('inicio');
}

async function excluirSessao() {
  if (!sessaoEditando || !await confirmar('Excluir esta sessão?')) return;
  const r = await sbClient.from('sessoes').delete().eq('id', sessaoEditando.id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  fecharSessao(); await load(); go('inicio');
}

(function () {
  const s = document.createElement('style');
  s.textContent = '.sessao{padding:26px}.sessaoTopo{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}' +
    '.sessao .filter{background:#ffffff14;border-color:#ffffff33;color:#fff}' +
    '.sessaoData{font-size:28px;letter-spacing:-.03em;margin:6px 0 4px}' +
    '.sessaoConta{font-size:15px;font-weight:800;color:#f5a7c2}' +
    '.sessaoInfo{display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:16px;margin-top:22px;padding-top:18px;border-top:1px solid #ffffff20;font-weight:700}' +
    '.sessaoInfo span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#d7cbd0;font-weight:600;margin-bottom:5px}' +
    '.sessaoInfo small{display:block;font-weight:400;color:#d7cbd0;margin-top:3px}' +
    '@media(max-width:650px){.sessaoInfo{grid-template-columns:1fr}.sessaoData{font-size:22px}}';
  document.head.appendChild(s);
})();
