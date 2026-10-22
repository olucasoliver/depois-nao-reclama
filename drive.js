/* Aba DRIVE/ANEXOS: pastas com arquivos enviados à plataforma e links do Google Drive.
   Toda a equipe envia e baixa; só a Direção apaga e mexe nas pastas. */

let drivePasta = null, driveBusca = '';   // null = início do Drive
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

/* ---------- Estrutura de pastas ---------- */
function pastasDe(pai) {
  return (DB.drivePastas || []).filter(p => (p.pai_id || null) === (pai || null))
    .sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
}
function caminhoDaPasta(id) {
  const l = []; let p = (DB.drivePastas || []).find(x => x.id === id), guarda = 0;
  while (p && guarda++ < 20) { l.unshift(p); p = (DB.drivePastas || []).find(x => x.id === p.pai_id); }
  return l;
}
function descendentes(id) {
  const filhos = pastasDe(id).map(p => p.id);
  return filhos.concat(...filhos.map(descendentes));
}
function contarItens(id) {
  const ids = new Set([id, ...descendentes(id)]);
  return (DB.driveItens || []).filter(i => ids.has(i.pasta_id)).length;
}
function nomeCaminho(id) { return caminhoDaPasta(id).map(p => p.nome).join(' / '); }

function drive() {
  const dir = eDirecao();
  if (drivePasta && !(DB.drivePastas || []).some(p => p.id === drivePasta)) drivePasta = null;
  const q = driveBusca.trim().toLowerCase();
  const itens = DB.driveItens || [];
  const caminho = drivePasta ? caminhoDaPasta(drivePasta) : [];
  const subpastas = pastasDe(drivePasta);
  const visiveis = q
    ? itens.filter(i => (i.nome + ' ' + (i.descricao || '')).toLowerCase().includes(q))
    : itens.filter(i => drivePasta && i.pasta_id === drivePasta);
  visiveis.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  const pastasBusca = q ? (DB.drivePastas || []).filter(p => p.nome.toLowerCase().includes(q)) : subpastas;

  const trilha = '<nav class="driveTrilha" aria-label="Pasta atual"><a href="#" onclick="drivePasta=null;render();return false">Drive</a>' +
    caminho.map((p, k) => ' <span>/</span> ' + (k === caminho.length - 1 ? '<b>' + esc(p.nome) + '</b>' : '<a href="#" onclick="drivePasta=\'' + p.id + '\';render();return false">' + esc(p.nome) + '</a>')).join('') + '</nav>';

  const cartaoPasta = p => '<a href="#" class="card drivePasta" data-pasta="' + p.id + '" onclick="driveBusca=\'\';drivePasta=\'' + p.id + '\';render();return false">' +
    '<span class="driveIconePasta" aria-hidden="true"></span><span class="drivePastaTexto"><b>' + esc(p.nome) + '</b>' +
    '<span class="meta">' + (q && p.pai_id ? esc(nomeCaminho(p.pai_id)) + ' · ' : '') + (() => {
      const n = contarItens(p.id), s = pastasDe(p.id).length;
      return [s ? s + ' pasta' + (s > 1 ? 's' : '') : null, n + ' ' + (n === 1 ? 'item' : 'itens')].filter(Boolean).join(' · ');
    })() + '</span></span></a>';

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
      '<div class="meta">' + [q ? nomeCaminho(it.pasta_id) : null, it.tipo === 'arquivo' ? tamanhoLegivel(it.tamanho) : rotuloTipo(it),
        quemEnviou(it.enviado_por) ? 'por ' + quemEnviou(it.enviado_por) : null].filter(Boolean).map(esc).join(' · ') + '</div></div>' +
      '<div class="driveAcoes">' + abrir +
      '<button class="filter" onclick="copiarLinkDrive(\'' + it.id + '\')">Copiar link</button>' +
      (dir ? '<button class="filter discreto" onclick="apagarItemDrive(\'' + it.id + '\')">Excluir</button>' : '') + '</div></div>';
  };

  const pastaAtual = caminho[caminho.length - 1];
  const acoesPasta = pastaAtual && dir && !q ? '<div class="drivePastaAcoes"><button class="filter discreto" onclick="renomearPastaDrive(\'' + pastaAtual.id + '\')">Renomear pasta</button>' +
    '<button class="filter discreto" onclick="apagarPastaDrive(\'' + pastaAtual.id + '\')">Excluir pasta</button></div>' : '';

  const vazio = !pastasBusca.length && !visiveis.length;
  shell('Drive/Anexos', 'Kit de marca, materiais do espetáculo e links do Google Drive',
    '<div class="driveBotoes">' +
    '<button class="filter" onclick="novaPastaDrive()">+ Nova pasta</button>' +
    '<button class="filter enviarPasta" onclick="escolherPastaDoComputador()">+ Enviar pasta</button>' +
    (drivePasta ? '<button class="filter" onclick="abrirLinkDrive()">+ Adicionar link</button>' +
      '<button class="btn" onclick="escolherArquivosDrive()">+ Enviar arquivos</button>' : '') + '</div>' +
    '<input class="search" id="buscaDrive" placeholder="Buscar arquivos e pastas pelo nome..." value="' + esc(driveBusca) + '" oninput="driveBusca=this.value;render();const i=document.getElementById(\'buscaDrive\');i.focus();i.setSelectionRange(i.value.length,i.value.length)">' +
    '<div class="driveArea" data-alvo="' + esc(drivePasta ? 'Solte para enviar para "' + nomeCaminho(drivePasta) + '"' : 'Solte pastas para enviar ao Drive') + '">' +
    (q ? '<div class="meta" style="margin:-4px 0 12px">Resultados da busca em todo o Drive</div>' : '<div class="driveTopo">' + trilha + acoesPasta + '</div>') +
    (pastasBusca.length ? '<div class="driveGradePastas">' + pastasBusca.map(cartaoPasta).join('') + '</div>' : '') +
    (visiveis.length ? '<div class="driveGrade">' + visiveis.map(cartao).join('') + '</div>' : '') +
    (vazio ? '<div class="empty">' + (q ? 'Nada encontrado com esse nome.' : drivePasta ? 'Pasta vazia. Use "+ Enviar arquivos", "+ Enviar pasta" ou "+ Adicionar link".' : 'Nenhuma pasta ainda. Use "+ Nova pasta" ou "+ Enviar pasta".') + '</div>' : '') +
    '</div>' +
    (!drivePasta && !q && pastasBusca.length ? '<div class="meta section">Abra uma pasta para enviar arquivos ou adicionar links dentro dela.</div>' : '') +
    '<div class="meta">Você também pode arrastar arquivos e pastas do computador para cá' + (drivePasta ? '' : ', ou em cima de uma pasta') + '.</div>' +
    '<div class="meta section">Arquivos de até 50 MB. Para vídeos e arquivos maiores, guarde no Google Drive e use "+ Adicionar link". "+ Enviar pasta" aparece só no computador.</div>' +
    modalLinkDrive());
  carregarMiniaturas(visiveis.filter(ehImagem));
  ativarSoltarDrive();
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
function escolherArquivosDrive() {
  if (!drivePasta) return avisar('Abra primeiro a pasta onde os arquivos vão ficar.', 'erro');
  const pasta = drivePasta;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true;
  inp.onchange = () => enviarArquivosDrive([...inp.files], pasta);
  inp.click();
}
/* Envia uma pasta do computador mantendo as subpastas */
function escolherPastaDoComputador() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true;
  inp.setAttribute('webkitdirectory', ''); inp.setAttribute('directory', '');
  if (!('webkitdirectory' in inp)) return alert('Este navegador não envia pastas inteiras. Use o computador (Chrome, Edge, Firefox ou Safari no Mac).');
  const destino = drivePasta;
  inp.onchange = () => enviarPastaDrive([...inp.files], destino);
  inp.click();
}
async function garantirPasta(nome, pai) {
  const existe = (DB.drivePastas || []).find(p => p.nome === nome && (p.pai_id || null) === (pai || null));
  if (existe) return existe.id;
  const ordem = pastasDe(pai).reduce((m, p) => Math.max(m, p.ordem || 0), 0) + 1;
  const r = await sbClient.from('drive_pastas').insert({ nome, pai_id: pai || null, ordem }).select().single();
  if (r.error) throw new Error(/pai_id|policy|row-level/i.test(r.error.message) ? 'Falta rodar o arquivo supabase/014_drive_subpastas.sql no Supabase (SQL Editor).' : r.error.message);
  (DB.drivePastas = DB.drivePastas || []).push(r.data);
  return r.data.id;
}
const rel = f => f._rel || f.webkitRelativePath || f.name;
const arquivoDeSistema = f => /(^|\/)\.[^/]*$/.test(rel(f)) || /(^|\/)(Thumbs\.db|desktop\.ini)$/i.test(rel(f));
async function enviarPastaDrive(arquivos, destino, semConfirmar) {
  arquivos = arquivos.filter(f => !arquivoDeSistema(f));
  if (!arquivos.length) return avisar('A pasta escolhida está vazia.', 'erro');
  const raiz = rel(arquivos[0]).split('/')[0] || 'Pasta enviada';
  if (!semConfirmar && !await confirmar('Enviar a pasta "' + raiz + '"?\n\n' + arquivos.length + ' arquivo' + (arquivos.length > 1 ? 's' : '') + ', para ' + (destino ? 'dentro de "' + nomeCaminho(destino) + '"' : 'o início do Drive') + '. As subpastas são mantidas.', { ok: 'Enviar pasta' })) return;
  // agrupa os arquivos pela pasta de origem e cria a mesma estrutura
  const porPasta = new Map();
  try {
    for (const f of arquivos) {
      const partes = rel(f).split('/'); partes.pop();
      const chave = partes.join('/');
      if (!porPasta.has(chave)) {
        let pai = destino;
        for (const nome of partes) pai = await garantirPasta(nome, pai);
        porPasta.set(chave, { id: pai, arquivos: [] });
      }
      porPasta.get(chave).arquivos.push(f);
    }
  } catch (e) { await load(); return alert('Não foi possível criar as pastas. ' + e.message); }
  for (const { id, arquivos: l } of porPasta.values()) await enviarArquivosDrive(l, id, true);
  drivePasta = porPasta.size ? [...porPasta.values()][0].id : destino;
  const raizCriada = (DB.drivePastas || []).find(p => p.nome === raiz && (p.pai_id || null) === (destino || null));
  if (raizCriada) drivePasta = raizCriada.id;
  if (semConfirmar) return;
  await load();
  avisar('Pasta "' + raiz + '" enviada.');
}

/* ---------- Arrastar e soltar do computador ---------- */
function lerEntrada(entrada, caminho) {
  return new Promise(resolve => {
    if (entrada.isFile) return entrada.file(f => { f._rel = caminho + f.name; resolve([f]); }, () => resolve([]));
    if (!entrada.isDirectory) return resolve([]);
    const leitor = entrada.createReader(), todos = [];
    const lote = () => leitor.readEntries(async lista => {
      if (!lista.length) { const filhos = await Promise.all(todos.map(e => lerEntrada(e, caminho + entrada.name + '/'))); return resolve(filhos.flat()); }
      todos.push(...lista); lote();
    }, () => resolve([]));
    lote();
  });
}
async function soltarNoDrive(ev, destino) {
  ev.preventDefault();
  marcarAlvoDrive(null);
  const itens = [...(ev.dataTransfer.items || [])].map(i => i.webkitGetAsEntry ? i.webkitGetAsEntry() : null).filter(Boolean);
  let arquivos = itens.length ? (await Promise.all(itens.map(e => lerEntrada(e, '')))).flat() : [...(ev.dataTransfer.files || [])];
  arquivos = arquivos.filter(f => !arquivoDeSistema(f));
  if (!arquivos.length) return avisar('Nada para enviar: solte arquivos ou pastas do computador.', 'erro');
  const soltos = arquivos.filter(f => !rel(f).includes('/'));
  const emPastas = arquivos.filter(f => rel(f).includes('/'));
  if (soltos.length && !destino) return avisar('Arquivos soltos precisam de uma pasta: abra uma pasta (ou solte em cima de uma) e tente de novo. Pastas inteiras podem ser soltas aqui.', 'erro');
  const raizes = [...new Set(emPastas.map(f => rel(f).split('/')[0]))];
  const descricao = [raizes.length ? raizes.length + ' pasta' + (raizes.length > 1 ? 's' : '') + ' (' + raizes.join(', ') + ')' : null,
    soltos.length ? soltos.length + ' arquivo' + (soltos.length > 1 ? 's' : '') + ' solto' + (soltos.length > 1 ? 's' : '') : null].filter(Boolean).join(' e ');
  if (!await confirmar('Enviar ' + descricao + '?\n\nVai para ' + (destino ? 'dentro de "' + nomeCaminho(destino) + '"' : 'o início do Drive') + '.' + (raizes.length ? ' As subpastas são mantidas.' : ''), { ok: 'Enviar' })) return;
  for (const r of raizes) await enviarPastaDrive(emPastas.filter(f => rel(f).split('/')[0] === r), destino, true);
  if (soltos.length) await enviarArquivosDrive(soltos, destino, true);
  if (destino) drivePasta = destino;
  await load();
  avisar('Envio concluído.');
}
function marcarAlvoDrive(el) {
  document.querySelectorAll('.alvoSoltar').forEach(x => x.classList.remove('alvoSoltar'));
  if (el) el.classList.add('alvoSoltar');
}
function ativarSoltarDrive() {
  const main = document.getElementById('main');
  if (!main || main.dataset.soltar) return;
  main.dataset.soltar = '1';
  const temArquivos = e => [...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files');
  main.addEventListener('dragover', e => {
    if (page !== 'drive' || !temArquivos(e)) return;
    e.preventDefault();
    const cartao = e.target.closest && e.target.closest('.drivePasta');
    marcarAlvoDrive(cartao || main.querySelector('.driveArea'));
  });
  main.addEventListener('dragleave', e => { if (page === 'drive' && !main.contains(e.relatedTarget)) marcarAlvoDrive(null); });
  main.addEventListener('drop', e => {
    if (page !== 'drive' || !temArquivos(e)) return;
    const cartao = e.target.closest && e.target.closest('.drivePasta');
    soltarNoDrive(e, cartao ? cartao.dataset.pasta : drivePasta);
  });
}
async function enviarArquivosDrive(arquivos, pasta, parteDeUmaPasta) {
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
  if (falhas.length) alert('Não foi possível enviar: ' + falhas.join('; '));
  if (parteDeUmaPasta) return;
  await load();
  if (!falhas.length) avisar(ok.length > 1 ? ok.length + ' arquivos enviados.' : 'Arquivo enviado.');
}

/* ---------- Links ---------- */
function modalLinkDrive() {
  return '<div id="driveLinkModal" class="modal" onclick="if(event.target===this)fecharLinkDrive()"><div class="modalbox">' +
    '<div class="modalhead"><div><div class="eyebrow">Drive/Anexos</div><h2>Adicionar link</h2></div><button class="close" onclick="fecharLinkDrive()" aria-label="Fechar">×</button></div>' +
    '<div class="formgrid">' +
    '<div class="field full"><label>Endereço</label><input id="dlUrl" placeholder="https://drive.google.com/..." inputmode="url"></div>' +
    '<div class="field full"><label>Nome</label><input id="dlNome" placeholder="Ex.: Fotos do ensaio de 15/10"></div>' +
    '<div class="field full"><label>Descrição (opcional)</label><input id="dlDesc" placeholder="O que tem nesse link"></div>' +
    '</div><div class="modalactions"><button class="filter" onclick="fecharLinkDrive()">Cancelar</button><button class="btn" onclick="salvarLinkDrive()">Adicionar</button></div></div></div>';
}
function abrirLinkDrive() {
  if (!drivePasta) return avisar('Abra primeiro a pasta onde o link vai ficar.', 'erro');
  const m = document.getElementById('driveLinkModal'); m.classList.add('show');
  ['dlUrl', 'dlNome', 'dlDesc'].forEach(i => document.getElementById(i).value = '');
  setTimeout(() => document.getElementById('dlUrl').focus(), 30);
}
function fecharLinkDrive() { const m = document.getElementById('driveLinkModal'); if (m) m.classList.remove('show'); }
async function salvarLinkDrive() {
  let url = document.getElementById('dlUrl').value.trim();
  const nome = document.getElementById('dlNome').value.trim();
  if (!url) return alert('Cole o endereço do link.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const r = await sbClient.from('drive_itens').insert({
    pasta_id: drivePasta, tipo: 'link', url,
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
  const nome = await perguntar('Nome da nova pasta' + (drivePasta ? '\nVai ficar dentro de "' + nomeCaminho(drivePasta) + '".' : ''), '', { campo: 'linha', ok: 'Criar pasta' });
  if (!nome || !nome.trim()) return;
  try { drivePasta = await garantirPasta(nome.trim(), drivePasta); }
  catch (e) { return alert('Não foi possível criar a pasta. ' + e.message); }
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
  const ids = new Set([id, ...descendentes(id)]);
  const itens = (DB.driveItens || []).filter(i => ids.has(i.pasta_id));
  const subs = ids.size - 1;
  if (!await confirmar('Excluir a pasta "' + p.nome + '"?\n\n' + (itens.length || subs ? 'Tudo o que está dentro dela também será apagado: ' + [subs ? subs + ' subpasta' + (subs > 1 ? 's' : '') : null, itens.length ? itens.length + ' ' + (itens.length > 1 ? 'itens' : 'item') : null].filter(Boolean).join(' e ') + '.' : 'A pasta está vazia.'))) return;
  const caminhos = itens.map(i => i.caminho).filter(Boolean);
  const r = await sbClient.from('drive_pastas').delete().eq('id', id);
  if (r.error) return alert('Não foi possível excluir: ' + r.error.message);
  if (caminhos.length) await sbClient.storage.from('drive').remove(caminhos);
  drivePasta = p.pai_id || null;
  await load();
}
