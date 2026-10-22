/* Aba DRIVE/ANEXOS: pastas com arquivos enviados à plataforma e links do Google Drive.
   Toda a equipe envia e baixa; só a Direção apaga e mexe nas pastas. */

let drivePasta = 'todas', driveBusca = '';
const driveMiniaturas = {};   // caminho -> link temporário da imagem
const DRIVE_LIMITE = 50 * 1024 * 1024;

function tamanhoLegivel(b) {
  if (!b && b !== 0) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',') + ' MB';
}
function extDe(nome) { return (String(nome || '').split('.').pop() || '').toLowerCase(); }
function ehImagem(it) { return it.tipo === 'arquivo' && (/^image\//.test(it.mime || '') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extDe(it.nome))); }
function rotuloTipo(it) {
  if (it.tipo === 'link') return /drive\.google|docs\.google/.test(it.url || '') ? 'Google Drive' : /canva\.com/.test(it.url || '') ? 'Canva' : 'Link';
  const e = extDe(it.nome);
  return e ? e.toUpperCase() : 'Arquivo';
}
function quemEnviou(pid) { return typeof nomeDaConta === 'function' ? nomeDaConta(pid) : ''; }

function drive() {
  const pastas = (DB.drivePastas || []).slice().sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || a.nome.localeCompare(b.nome));
  const itens = DB.driveItens || [];
  if (drivePasta !== 'todas' && !pastas.some(p => p.id === drivePasta)) drivePasta = 'todas';
  const dir = eDirecao();
  const q = driveBusca.trim().toLowerCase();
  const visiveis = itens.filter(i => (drivePasta === 'todas' || i.pasta_id === drivePasta) &&
    (!q || (i.nome + ' ' + (i.descricao || '')).toLowerCase().includes(q)))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const contagem = id => itens.filter(i => i.pasta_id === id).length;
  const pastaAtual = pastas.find(p => p.id === drivePasta);

  const abas = '<div class="filters drivePastas">' +
    '<button class="filter ' + (drivePasta === 'todas' ? 'active' : '') + '" onclick="drivePasta=\'todas\';render()">Todas <span>' + itens.length + '</span></button>' +
    pastas.map(p => '<button class="filter ' + (drivePasta === p.id ? 'active' : '') + '" onclick="drivePasta=\'' + p.id + '\';render()">' + esc(p.nome) + ' <span>' + contagem(p.id) + '</span></button>').join('') +
    (dir ? '<button class="filter discreto" onclick="novaPastaDrive()">+ Nova pasta</button>' : '') + '</div>';

  const nomePasta = id => (pastas.find(p => p.id === id) || {}).nome || '';
  const cartao = it => {
    const img = ehImagem(it);
    const capa = img
      ? '<div class="driveCapa imagem" data-caminho="' + esc(it.caminho) + '">' + (driveMiniaturas[it.caminho] ? '<img src="' + esc(driveMiniaturas[it.caminho]) + '" alt="" loading="lazy">' : '') + '</div>'
      : '<div class="driveCapa"><span>' + esc(rotuloTipo(it)) + '</span></div>';
    const abrir = it.tipo === 'link'
      ? '<a class="filter" href="' + esc(it.url) + '" target="_blank" rel="noopener">Abrir</a>'
      : '<button class="filter" onclick="abrirArquivoDrive(\'' + it.id + '\')">' + (img || extDe(it.nome) === 'pdf' ? 'Abrir' : 'Baixar') + '</button>' +
        (img || extDe(it.nome) === 'pdf' ? '<button class="filter" onclick="abrirArquivoDrive(\'' + it.id + '\',true)">Baixar</button>' : '');
    return '<div class="card driveItem">' + capa +
      '<div class="driveInfo"><b title="' + esc(it.nome) + '">' + esc(it.nome) + '</b>' +
      (it.descricao ? '<div class="meta">' + esc(it.descricao) + '</div>' : '') +
      '<div class="meta">' + [drivePasta === 'todas' ? nomePasta(it.pasta_id) : null, it.tipo === 'arquivo' ? tamanhoLegivel(it.tamanho) : rotuloTipo(it),
        quemEnviou(it.enviado_por) ? 'por ' + quemEnviou(it.enviado_por) : null].filter(Boolean).map(esc).join(' · ') + '</div></div>' +
      '<div class="driveAcoes">' + abrir +
      '<button class="filter" onclick="copiarLinkDrive(\'' + it.id + '\')">Copiar link</button>' +
      (dir ? '<button class="filter discreto" onclick="apagarItemDrive(\'' + it.id + '\')">Excluir</button>' : '') + '</div></div>';
  };

  const cabecalhoPasta = pastaAtual && dir ? '<div class="drivePastaAcoes"><button class="filter discreto" onclick="renomearPastaDrive(\'' + pastaAtual.id + '\')">Renomear pasta</button>' +
    '<button class="filter discreto" onclick="apagarPastaDrive(\'' + pastaAtual.id + '\')">Excluir pasta</button></div>' : '';

  shell('Drive/Anexos', 'Kit de marca, materiais do espetáculo e links do Google Drive',
    '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">' +
    '<button class="filter" onclick="abrirLinkDrive()">+ Adicionar link</button>' +
    '<button class="btn" onclick="escolherArquivosDrive()">+ Enviar arquivos</button></div>' +
    abas +
    '<input class="search" id="buscaDrive" placeholder="Buscar pelo nome..." value="' + esc(driveBusca) + '" oninput="driveBusca=this.value;render();const i=document.getElementById(\'buscaDrive\');i.focus();i.setSelectionRange(i.value.length,i.value.length)">' +
    cabecalhoPasta +
    (pastas.length ? (visiveis.length ? '<div class="driveGrade">' + visiveis.map(cartao).join('') + '</div>'
      : '<div class="empty">' + (q ? 'Nada encontrado com esse nome.' : 'Nada nesta pasta ainda. Use "+ Enviar arquivos" ou "+ Adicionar link".') + '</div>')
      : '<div class="empty">Nenhuma pasta criada ainda.' + (dir ? ' Use "+ Nova pasta".' : '') + '</div>') +
    '<div class="meta section">Arquivos de até 50 MB. Para vídeos e arquivos maiores, guarde no Google Drive e use "+ Adicionar link".</div>' +
    modalLinkDrive(pastas));
  carregarMiniaturas(visiveis.filter(ehImagem));
}

async function carregarMiniaturas(lista) {
  const faltam = lista.map(i => i.caminho).filter(c => c && !driveMiniaturas[c]);
  if (!faltam.length) return;
  const r = await sbClient.storage.from('drive').createSignedUrls(faltam, 3600);
  if (r.error || !r.data) return;
  r.data.forEach(x => { if (x.signedUrl) driveMiniaturas[x.path] = x.signedUrl; });
  document.querySelectorAll('.driveCapa.imagem').forEach(el => {
    const u = driveMiniaturas[el.dataset.caminho];
    if (u && !el.querySelector('img')) el.innerHTML = '<img src="' + u + '" alt="" loading="lazy">';
  });
}

/* ---------- Enviar arquivos ---------- */
function pastaParaEnvio() {
  if (drivePasta !== 'todas') return drivePasta;
  const pastas = DB.drivePastas || [];
  return pastas.length === 1 ? pastas[0].id : null;
}
async function escolherArquivosDrive() {
  let pasta = pastaParaEnvio();
  if (!pasta) {
    if (!(DB.drivePastas || []).length) return alert('Ainda não há pastas. Peça para a Direção criar uma.');
    return avisar('Escolha primeiro a pasta onde os arquivos vão ficar (os botões acima da busca).', 'erro');
  }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true;
  inp.onchange = () => enviarArquivosDrive([...inp.files], pasta);
  inp.click();
}
async function enviarArquivosDrive(arquivos, pasta) {
  if (!arquivos.length) return;
  const grandes = arquivos.filter(f => f.size > DRIVE_LIMITE);
  if (grandes.length) avisar('Ficaram de fora (mais de 50 MB): ' + grandes.map(f => f.name).join(', ') + '. Guarde no Google Drive e adicione o link.', 'erro');
  const ok = arquivos.filter(f => f.size <= DRIVE_LIMITE);
  if (!ok.length) return;
  avisar('Enviando ' + ok.length + ' arquivo' + (ok.length > 1 ? 's' : '') + '...');
  const enviando = document.querySelector('#avisos .aviso:last-child');
  let falhas = [];
  for (const f of ok) {
    const limpo = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);
    const caminho = pasta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '-' + limpo;
    const up = await sbClient.storage.from('drive').upload(caminho, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (up.error) { falhas.push(f.name + ' (' + (/bucket|not found/i.test(up.error.message) ? 'falta rodar o 013' : up.error.message) + ')'); continue; }
    const r = await sbClient.from('drive_itens').insert({ pasta_id: pasta, tipo: 'arquivo', nome: f.name, caminho, mime: f.type || null, tamanho: f.size, enviado_por: user.id });
    if (r.error) { await sbClient.storage.from('drive').remove([caminho]); falhas.push(f.name + ' (' + r.error.message + ')'); }
  }
  if (enviando) enviando.remove();
  await load();
  if (falhas.length) alert('Não foi possível enviar: ' + falhas.join('; '));
  else avisar(ok.length > 1 ? ok.length + ' arquivos enviados.' : 'Arquivo enviado.');
}

/* ---------- Links ---------- */
function modalLinkDrive(pastas) {
  return '<div id="driveLinkModal" class="modal" onclick="if(event.target===this)fecharLinkDrive()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Drive/Anexos</div><h2>Adicionar link</h2></div><button class="close" onclick="fecharLinkDrive()" aria-label="Fechar">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Endereço</label><input id="dlUrl" placeholder="https://drive.google.com/..." inputmode="url"></div>' +
    '<div class="field full"><label>Nome</label><input id="dlNome" placeholder="Ex.: Fotos do ensaio de 15/10"></div>' +
    '<div class="field full"><label>Pasta</label><select id="dlPasta">' + pastas.map(p => '<option value="' + p.id + '">' + esc(p.nome) + '</option>').join('') + '</select></div>' +
    '<div class="field full"><label>Descrição (opcional)</label><input id="dlDesc" placeholder="O que tem nesse link"></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharLinkDrive()">Cancelar</button><button class="btn" onclick="salvarLinkDrive()">Adicionar</button></div></div></div>';
}
function abrirLinkDrive() {
  if (!(DB.drivePastas || []).length) return alert('Ainda não há pastas. Peça para a Direção criar uma.');
  const m = document.getElementById('driveLinkModal'); m.classList.add('show');
  ['dlUrl', 'dlNome', 'dlDesc'].forEach(i => document.getElementById(i).value = '');
  if (drivePasta !== 'todas') document.getElementById('dlPasta').value = drivePasta;
  setTimeout(() => document.getElementById('dlUrl').focus(), 30);
}
function fecharLinkDrive() { const m = document.getElementById('driveLinkModal'); if (m) m.classList.remove('show'); }
async function salvarLinkDrive() {
  let url = document.getElementById('dlUrl').value.trim();
  const nome = document.getElementById('dlNome').value.trim();
  if (!url) return alert('Cole o endereço do link.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const r = await sbClient.from('drive_itens').insert({
    pasta_id: document.getElementById('dlPasta').value, tipo: 'link', url,
    nome: nome || url.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 60),
    descricao: document.getElementById('dlDesc').value.trim() || null, enviado_por: user.id
  });
  if (r.error) return alert(/drive_itens/.test(r.error.message) ? 'Falta rodar o arquivo supabase/013_drive_anexos.sql no Supabase (SQL Editor).' : 'Não foi possível adicionar: ' + r.error.message);
  fecharLinkDrive(); await load(); avisar('Link adicionado.');
}

/* ---------- Abrir, baixar, copiar ---------- */
async function abrirArquivoDrive(id, baixar) {
  const it = (DB.driveItens || []).find(x => x.id === id); if (!it) return;
  const naAba = !baixar && (ehImagem(it) || extDe(it.nome) === 'pdf');
  const aba = naAba ? window.open('', '_blank') : null;
  const r = await sbClient.storage.from('drive').createSignedUrl(it.caminho, 3600, naAba ? undefined : { download: it.nome });
  if (r.error || !r.data) { if (aba) aba.close(); return alert('Não foi possível abrir: ' + (r.error ? r.error.message : 'arquivo não encontrado')); }
  if (aba) aba.location = r.data.signedUrl; else window.location.href = r.data.signedUrl;
}
async function copiarLinkDrive(id) {
  const it = (DB.driveItens || []).find(x => x.id === id); if (!it) return;
  let link = it.url, aviso = 'Link copiado.';
  if (it.tipo === 'arquivo') {
    const r = await sbClient.storage.from('drive').createSignedUrl(it.caminho, 7 * 24 * 3600, { download: it.nome });
    if (r.error || !r.data) return alert('Não foi possível gerar o link: ' + (r.error ? r.error.message : ''));
    link = r.data.signedUrl; aviso = 'Link copiado. Ele funciona por 7 dias, mesmo para quem não tem conta.';
  }
  try { await navigator.clipboard.writeText(link); avisar(aviso); }
  catch (e) { mostrarTexto('Copie o link abaixo', link); }
}

/* ---------- Direção: apagar e pastas ---------- */
async function apagarItemDrive(id) {
  const it = (DB.driveItens || []).find(x => x.id === id); if (!it) return;
  if (!await confirmar('Excluir "' + it.nome + '"?\n\n' + (it.tipo === 'arquivo' ? 'O arquivo é apagado para toda a equipe.' : 'O link sai da lista. O conteúdo no Drive não é apagado.'))) return;
  const r = await sbClient.from('drive_itens').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  if (it.caminho) await sbClient.storage.from('drive').remove([it.caminho]);
  await load();
}
async function novaPastaDrive() {
  const nome = await perguntar('Nome da nova pasta', '', { campo: 'linha', ok: 'Criar pasta' });
  if (!nome || !nome.trim()) return;
  const ordem = (DB.drivePastas || []).reduce((m, p) => Math.max(m, p.ordem || 0), 0) + 1;
  const r = await sbClient.from('drive_pastas').insert({ nome: nome.trim(), ordem }).select().single();
  if (r.error) return alert(/drive_pastas/.test(r.error.message) ? 'Falta rodar o arquivo supabase/013_drive_anexos.sql no Supabase (SQL Editor).' : 'Não foi possível criar: ' + r.error.message);
  if (r.data) drivePasta = r.data.id;
  await load();
}
async function renomearPastaDrive(id) {
  const p = (DB.drivePastas || []).find(x => x.id === id); if (!p) return;
  const nome = await perguntar('Novo nome da pasta', p.nome, { campo: 'linha', ok: 'Renomear' });
  if (!nome || !nome.trim() || nome.trim() === p.nome) return;
  const r = await sbClient.from('drive_pastas').update({ nome: nome.trim() }).eq('id', id);
  if (r.error) return alert('Não foi possível renomear: ' + r.error.message);
  await load();
}
async function apagarPastaDrive(id) {
  const p = (DB.drivePastas || []).find(x => x.id === id); if (!p) return;
  const itens = (DB.driveItens || []).filter(i => i.pasta_id === id);
  if (!await confirmar('Excluir a pasta "' + p.nome + '"?\n\n' + (itens.length ? 'Os ' + itens.length + ' itens dentro dela também serão apagados.' : 'A pasta está vazia.'))) return;
  const caminhos = itens.map(i => i.caminho).filter(Boolean);
  const r = await sbClient.from('drive_pastas').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  if (caminhos.length) await sbClient.storage.from('drive').remove(caminhos);
  drivePasta = 'todas';
  await load();
}
