/* Login, perfis de acesso e tela de Equipe.
   Perfis: Direção, Produção e Elenco. Uma pessoa pode ter vários.
   O banco (regras RLS) é quem garante as permissões; aqui a tela só
   esconde o que a pessoa não pode usar. */

let acessoLiberado = false;

function funcoesDe(pid) {
  return DB.perfilFuncoes
    .filter(x => x.perfil_id === pid)
    .map(x => DB.funcoes.find(f => f.id === x.funcao_id))
    .filter(Boolean);
}
function eDirecao() { return acessoLiberado && temFuncao('Direção'); }
function eGestao() { return acessoLiberado && (temFuncao('Direção') || temFuncao('Produção')); }

/* Ações que só aparecem para quem pode usá-las */
const ACOES_GESTAO = ['abrirModalElenco', 'alternarAtivoElenco', 'abrirModalEnsaio', 'excluirEnsaio',
  'abrirTarefa', 'excluirTarefa', 'abrirDivulgacao', 'excluirDivulgacao', 'abrirOrcamento',
  'excluirOrcamento', 'abrirChecklist', 'excluirChecklist', 'abrirFicha', 'editarFicha', 'excluirFicha',
  'abrirSessao'];
const ACOES_DIRECAO = ['toggleSelect', 'editarEsquete', 'excluirEsquete', 'moverEsquete',
  'abrirElencoEsquete', 'retirarEsquete'];

(function () {
  const sel = (classe, nomes) => nomes.map(n => 'body:not(.' + classe + ') [onclick^="' + n + '("]').join(',');
  const css = sel('pode-gestao', ACOES_GESTAO) + ',' + sel('pode-direcao', ACOES_DIRECAO) + '{display:none!important}' +
    'body:not(.pode-gestao) [onchange^="alternarChecklist("]{pointer-events:none;opacity:.45}' +
    'body:not(.com-acesso) #nav{display:none}' +
    '.acesso{max-width:440px}.acesso .field{margin:18px 0 14px}.acesso .btn{width:100%}' +
    '.usuario{margin-top:28px;padding-top:18px;border-top:1px solid #ffffff1a;font-size:13px;color:#d9d2d6}' +
    '.usuario b{display:block;color:#fff;font-size:14px;margin-bottom:3px}' +
    '.usuario button{width:auto;margin:10px 0 0;background:none;border:1px solid #ffffff33;color:#d9d2d6;border-radius:8px;padding:7px 11px;cursor:pointer;font:inherit;font-size:12px}' +
    '.usuario button:hover{color:#fff;border-color:#ffffff66}' +
    '.pessoa{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}' +
    '.funcoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
    '.funcoes label{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:6px 11px;font-size:12px;cursor:pointer}' +
    '.funcoes input{accent-color:var(--pink)}' +
    '@media(max-width:650px){.nav{align-items:center}.usuario{margin:0 0 0 10px;padding:0 0 0 14px;border-top:0;border-left:1px solid #ffffff1a;white-space:nowrap;display:flex;align-items:center;gap:10px}.usuario b{display:inline;margin:0}.usuario button{margin:0}}';
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

function aplicarPermissoes() {
  document.body.classList.toggle('com-acesso', acessoLiberado);
  document.body.classList.toggle('pode-gestao', eGestao());
  document.body.classList.toggle('pode-direcao', eDirecao());
}

function blocoUsuario() {
  if (!acessoLiberado || !DB.perfil) return '';
  const f = funcoesDe(user.id).map(x => x.nome).join(' · ') || 'Consulta';
  return '<div class="usuario"><b>' + esc(DB.perfil.nome || user.email) + '</b>' + esc(f) +
    '<br><button onclick="go(\'conta\')">Minha conta</button> <button onclick="sair()">Sair</button></div>';
}

/* ---------- Telas antes do acesso ---------- */
let modoLogin = 'entrar';

function telaLogin(modo) {
  if (modo) modoLogin = modo;
  acessoLiberado = false; aplicarPermissoes();
  const criar = modoLogin === 'criar';
  const enter = "onkeydown=\"if(event.key==='Enter')" + (criar ? 'criarConta()' : 'entrar()') + '"';
  shell(criar ? 'Criar conta' : 'Entrar', 'Acesso restrito à equipe do espetáculo',
    '<div class="card acesso"><div class="filters">' +
    '<button class="filter ' + (criar ? '' : 'active') + '" onclick="telaLogin(\'entrar\')">Já tenho conta</button>' +
    '<button class="filter ' + (criar ? 'active' : '') + '" onclick="telaLogin(\'criar\')">Primeiro acesso</button></div>' +
    (criar ? '<div class="field"><label>Nome</label><input id="loginNome" placeholder="Como você quer aparecer para a equipe" ' + enter + '></div>' : '') +
    '<div class="field"><label>E-mail</label><input id="loginEmail" type="email" autocomplete="email" placeholder="seu@email.com" ' + enter + '></div>' +
    '<div class="field"><label>Senha</label><input id="loginSenha" type="password" autocomplete="' + (criar ? 'new-password' : 'current-password') + '" placeholder="' + (criar ? 'Mínimo de 6 caracteres' : 'Sua senha') + '" ' + enter + '></div>' +
    (criar ? '<div class="field"><label>Confirmar senha</label><input id="loginSenha2" type="password" autocomplete="new-password" ' + enter + '></div>' : '') +
    '<button class="btn" id="loginBtn" onclick="' + (criar ? 'criarConta()' : 'entrar()') + '">' + (criar ? 'Criar conta e pedir acesso' : 'Entrar') + '</button>' +
    '<div class="meta" style="margin-top:12px">' + (criar
      ? 'Depois de criar a conta, a direção precisa aprovar o seu acesso.'
      : 'Esqueceu a senha? Peça para a direção definir uma senha provisória para você.') + '</div></div>');
}

function camposLogin() {
  return {
    email: (document.getElementById('loginEmail').value || '').trim().toLowerCase(),
    senha: document.getElementById('loginSenha').value || ''
  };
}
function travarBotao(texto) { const b = document.getElementById('loginBtn'); if (b) { b.disabled = !!texto; if (texto) b.textContent = texto; } }

async function entrar() {
  const { email, senha } = camposLogin();
  if (!email || !senha) return alert('Informe e-mail e senha.');
  travarBotao('Entrando...');
  const r = await sbClient.auth.signInWithPassword({ email, password: senha });
  if (r.error) {
    travarBotao(''); telaLogin('entrar');
    document.getElementById('loginEmail').value = email;
    return alert(/invalid/i.test(r.error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar: ' + r.error.message);
  }
  load();
}

async function criarConta() {
  const nome = document.getElementById('loginNome').value.trim();
  const { email, senha } = camposLogin();
  const senha2 = document.getElementById('loginSenha2').value;
  if (!nome) return alert('Informe seu nome.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return alert('Informe um e-mail válido.');
  if (senha.length < 6) return alert('A senha precisa ter pelo menos 6 caracteres.');
  if (senha !== senha2) return alert('As senhas não conferem.');
  travarBotao('Criando conta...');
  const r = await sbClient.auth.signUp({ email, password: senha });
  if (r.error) {
    travarBotao(''); const b = document.getElementById('loginBtn'); if (b) b.textContent = 'Criar conta e pedir acesso';
    return alert(/registered|already/i.test(r.error.message)
      ? 'Este e-mail já tem conta. Use "Já tenho conta" para entrar.'
      : 'Não foi possível criar a conta: ' + r.error.message);
  }
  if (!r.data.session) {
    /* Sem sessão: o e-mail já tinha conta (o Supabase não avisa isso) ou a conta
       ainda precisa de confirmação. Tenta entrar com os mesmos dados. */
    const e = await sbClient.auth.signInWithPassword({ email, password: senha });
    if (e.error) {
      travarBotao(''); const b = document.getElementById('loginBtn'); if (b) b.textContent = 'Criar conta e pedir acesso';
      if (/confirm/i.test(e.error.message)) return alert('Sua conta foi criada, mas ainda precisa ser liberada pela direção no Supabase. Avise a direção e depois entre em "Já tenho conta".');
      return alert('Este e-mail já tem conta. Entre em "Já tenho conta". Se não lembrar a senha, peça para a direção redefinir.');
    }
  }
  const a = await sbClient.rpc('solicitar_acesso', { p_nome: nome });
  if (a.error) alert('Conta criada, mas o pedido de acesso falhou: ' + a.error.message);
  load();
}

function telaCadastro() {
  acessoLiberado = false; aplicarPermissoes();
  shell('Primeiro acesso', 'Falta só o seu nome',
    '<div class="card acesso"><div class="sub">Entrou como <b>' + esc(user.email) + '</b>. Como você quer aparecer para a equipe?</div>' +
    '<div class="field"><label>Nome</label><input id="cadNome" placeholder="Seu nome" onkeydown="if(event.key===\'Enter\')solicitarAcesso()"></div>' +
    '<button class="btn" onclick="solicitarAcesso()">Solicitar acesso</button>' +
    '<div style="margin-top:12px"><button class="filter" onclick="sair()">Sair</button></div></div>');
}

async function solicitarAcesso() {
  const nome = document.getElementById('cadNome').value.trim();
  if (!nome) return alert('Informe seu nome.');
  const r = await sbClient.rpc('solicitar_acesso', { p_nome: nome });
  if (r.error) return alert('Não foi possível solicitar o acesso: ' + r.error.message);
  load();
}

function telaAguardando() {
  acessoLiberado = false; aplicarPermissoes();
  const bloqueado = DB.perfil && DB.perfil.status === 'bloqueado';
  shell(bloqueado ? 'Acesso bloqueado' : 'Aguardando aprovação', esc(DB.perfil.nome || user.email),
    '<div class="card acesso"><div class="sub">' +
    (bloqueado ? 'Seu acesso foi desativado pela direção. Fale com a direção do espetáculo se isso for um engano.'
               : 'Seu pedido de acesso foi registrado. Assim que a direção aprovar, a plataforma libera para você.') +
    '</div><div style="margin-top:16px;display:flex;gap:8px"><button class="btn" style="width:auto" onclick="load()">Atualizar</button>' +
    '<button class="filter" onclick="sair()">Sair</button></div></div>');
}

async function sair() {
  await sbClient.auth.signOut();
  acessoLiberado = false; user = null; DB.perfil = null; page = 'inicio';
  load();
}

/* ---------- Equipe e acessos (Direção) ---------- */
function equipe() {
  const pessoas = DB.perfis.slice();
  const grupo = st => pessoas.filter(p => (p.status || 'pendente') === st);
  const funcoes = DB.funcoes.slice().sort((a, b) => {
    const ordem = ['Direção', 'Produção', 'Elenco'];
    const ia = ordem.indexOf(a.nome), ib = ordem.indexOf(b.nome);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.nome.localeCompare(b.nome);
  });
  const cartao = p => {
    const minhas = new Set(DB.perfilFuncoes.filter(x => x.perfil_id === p.id).map(x => x.funcao_id));
    const st = p.status || 'pendente';
    const acoes = st === 'pendente'
      ? '<button class="btn" onclick="mudarStatus(\'' + p.id + '\',\'aprovado\')">Aprovar</button> <button class="filter" onclick="mudarStatus(\'' + p.id + '\',\'bloqueado\')">Recusar</button>'
      : st === 'aprovado'
        ? (p.id === user.id ? '<span class="meta">Você</span>' : '<button class="filter" onclick="redefinirSenha(\'' + p.id + '\')">Redefinir senha</button> <button class="filter" onclick="mudarStatus(\'' + p.id + '\',\'bloqueado\')">Bloquear acesso</button>')
        : '<button class="filter" onclick="mudarStatus(\'' + p.id + '\',\'aprovado\')">Reativar</button>';
    return '<div class="card" style="margin-bottom:10px"><div class="pessoa"><div><b>' + esc(p.nome || 'Sem nome') + '</b>' +
      '<div class="meta">' + esc(p.email || '') + '</div>' +
      (st === 'bloqueado' ? '' : '<div class="funcoes">' + funcoes.map(f =>
        '<label><input type="checkbox" ' + (minhas.has(f.id) ? 'checked' : '') +
        ' onchange="alternarFuncao(\'' + p.id + '\',\'' + f.id + '\',this.checked,this)"> ' + esc(f.nome) + '</label>').join('') + '</div>') +
      '</div><div>' + acoes + '</div></div></div>';
  };
  const secao = (titulo, lista, vazio) => '<div class="section"><h2>' + titulo + ' (' + lista.length + ')</h2>' +
    (lista.length ? lista.map(cartao).join('') : '<div class="empty">' + vazio + '</div>') + '</div>';
  shell('Equipe e acessos', 'Quem usa a plataforma e o que cada pessoa pode fazer',
    '<div class="notice"><b>Direção</b> faz tudo, inclusive repertório e aprovações. <b>Produção</b> cuida de ensaios, tarefas, divulgação, orçamento, checklist, ficha técnica, elenco e sessões. <b>Elenco</b> consulta. Marque quantas funções a pessoa tiver.</div>' +
    secao('Aguardando aprovação', grupo('pendente'), 'Nenhum pedido novo.') +
    secao('Equipe', grupo('aprovado'), 'Ninguém aprovado ainda.') +
    (grupo('bloqueado').length ? secao('Sem acesso', grupo('bloqueado'), '') : ''));
}

async function mudarStatus(pid, status) {
  const p = DB.perfis.find(x => x.id === pid);
  if (status === 'bloqueado' && !await confirmar('Remover o acesso de ' + (p && p.nome ? p.nome : 'esta pessoa') + '?')) return;
  const r = await sbClient.from('perfis').update({ status }).eq('id', pid);
  if (r.error) return alert('Não foi possível atualizar: ' + r.error.message);
  if (status === 'aprovado' && !DB.perfilFuncoes.some(x => x.perfil_id === pid)) {
    const elencoF = DB.funcoes.find(f => f.nome === 'Elenco');
    if (elencoF) await sbClient.from('perfil_funcoes').insert({ perfil_id: pid, funcao_id: elencoF.id });
  }
  await load(); go('equipe');
}

async function alternarFuncao(pid, fid, marcado, el) {
  const f = DB.funcoes.find(x => x.id === fid);
  if (!marcado && pid === user.id && f && f.nome === 'Direção') {
    el.checked = true;
    return alert('Você não pode tirar a sua própria função de Direção. Peça para outra pessoa da direção fazer isso.');
  }
  const r = marcado
    ? await sbClient.from('perfil_funcoes').insert({ perfil_id: pid, funcao_id: fid })
    : await sbClient.from('perfil_funcoes').delete().eq('perfil_id', pid).eq('funcao_id', fid);
  if (r.error) { el.checked = !marcado; return alert('Não foi possível salvar: ' + r.error.message); }
  await load(); go('equipe');
}

/* ---------- Senhas ---------- */
function senhaProvisoria() {
  const palavras = ['palco', 'coxia', 'cena', 'plateia', 'ensaio', 'cortina', 'riso', 'estreia'];
  const n = new Uint32Array(2); crypto.getRandomValues(n);
  return palavras[n[0] % palavras.length] + '-' + String(1000 + n[1] % 9000);
}

async function redefinirSenha(pid) {
  const p = DB.perfis.find(x => x.id === pid);
  const nome = p && p.nome ? p.nome : 'esta pessoa';
  const senha = await perguntar('Senha provisória para ' + nome + ' (mínimo de 6 caracteres).\nVocê pode usar a sugerida ou digitar outra:', senhaProvisoria(), { campo: 'linha', ok: 'Redefinir senha' });
  if (senha === null) return;
  if (senha.trim().length < 6) return alert('A senha precisa ter pelo menos 6 caracteres.');
  const r = await sbClient.rpc('redefinir_senha', { p_perfil: pid, p_senha: senha.trim() });
  if (r.error) return alert('Não foi possível redefinir: ' + r.error.message);
  alert('Senha de ' + nome + ' redefinida.\n\nE-mail: ' + (p && p.email ? p.email : '') + '\nSenha provisória: ' + senha.trim() +
    '\n\nPasse esses dados para a pessoa e peça para ela trocar a senha em Minha conta.');
}

/* ---------- Minha conta ---------- */
function minhaConta() {
  const f = funcoesDe(user.id).map(x => x.nome).join(', ') || 'Consulta';
  shell('Minha conta', esc(user.email) + ' · ' + esc(f),
    '<div class="card acesso"><h2>Nome</h2><div class="field"><label>Como você aparece para a equipe</label>' +
    '<input id="contaNome" value="' + esc(DB.perfil.nome || '') + '"></div>' +
    '<button class="btn" onclick="salvarMeuNome()">Salvar nome</button></div>' +
    '<div class="card acesso section"><h2>Trocar senha</h2>' +
    '<div class="field"><label>Nova senha</label><input id="contaSenha" type="password" autocomplete="new-password" placeholder="Mínimo de 6 caracteres"></div>' +
    '<div class="field"><label>Confirmar nova senha</label><input id="contaSenha2" type="password" autocomplete="new-password"></div>' +
    '<button class="btn" onclick="trocarMinhaSenha()">Trocar senha</button></div>');
}

async function salvarMeuNome() {
  const nome = document.getElementById('contaNome').value.trim();
  if (!nome) return alert('Informe um nome.');
  const r = await sbClient.rpc('atualizar_meu_nome', { p_nome: nome });
  if (r.error) return alert('Não foi possível salvar: ' + r.error.message);
  await load(); go('conta'); alert('Nome atualizado.');
}

async function trocarMinhaSenha() {
  const a = document.getElementById('contaSenha').value, b = document.getElementById('contaSenha2').value;
  if (a.length < 6) return alert('A senha precisa ter pelo menos 6 caracteres.');
  if (a !== b) return alert('As senhas não conferem.');
  const r = await sbClient.auth.updateUser({ password: a });
  if (r.error) return alert('Não foi possível trocar a senha: ' + r.error.message);
  document.getElementById('contaSenha').value = ''; document.getElementById('contaSenha2').value = '';
  alert('Senha trocada.');
}
