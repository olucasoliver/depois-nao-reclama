/* Diálogos da plataforma, no lugar das janelas do navegador.
   avisar()    mensagem curta no canto da tela (substitui alert)
   confirmar() pergunta sim/não, devolve Promise<boolean>
   perguntar() pede um texto, devolve Promise<string|null>
   mostrarTexto() mostra um texto para copiar */

(function () {
  function raiz() {
    let r = document.getElementById('dialogos');
    if (!r) { r = document.createElement('div'); r.id = 'dialogos'; document.body.appendChild(r); }
    return r;
  }
  function escH(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }

  /* ---------- Avisos ---------- */
  window.avisar = function (msg, tipo) {
    let pilha = document.getElementById('avisos');
    if (!pilha) { pilha = document.createElement('div'); pilha.id = 'avisos'; pilha.setAttribute('role', 'status'); pilha.setAttribute('aria-live', 'polite'); document.body.appendChild(pilha); }
    const texto = String(msg == null ? '' : msg);
    const erro = tipo === 'erro' || /^Não foi possível|^Não consegui|^Informe|^Diga|^Escreva|precisa|inválid|incorret/i.test(texto);
    const fixo = texto.length > 110 || texto.includes('\n');
    const el = document.createElement('div');
    el.className = 'aviso' + (erro ? ' erro' : '');
    el.innerHTML = '<div class="avisoTexto">' + escH(texto).replace(/\n/g, '<br>') + '</div><button class="avisoFechar" aria-label="Fechar">×</button>';
    el.querySelector('button').onclick = () => el.remove();
    pilha.appendChild(el);
    if (!fixo) setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, erro ? 6000 : 3500);
  };
  window.alert = msg => window.avisar(msg);

  /* ---------- Caixa de diálogo ---------- */
  function abrir({ titulo, texto, campo, valor, ok, cancelar, perigo, somenteLeitura }) {
    return new Promise(resolve => {
      const anterior = document.activeElement;
      const r = raiz();
      r.innerHTML = '<div class="dlgFundo"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgTitulo">' +
        '<h2 id="dlgTitulo">' + escH(titulo) + '</h2>' +
        (texto ? '<p>' + escH(texto).replace(/\n/g, '<br>') + '</p>' : '') +
        (campo ? (campo === 'area'
          ? '<textarea id="dlgCampo" rows="' + (somenteLeitura ? 10 : 4) + '"' + (somenteLeitura ? ' readonly' : '') + '></textarea>'
          : '<input id="dlgCampo" type="text" autocomplete="off">') : '') +
        '<div class="dlgAcoes">' + (cancelar === false ? '' : '<button class="filter" data-r="0">' + escH(cancelar || 'Cancelar') + '</button>') +
        '<button class="btn' + (perigo ? ' perigo' : '') + '" data-r="1">' + escH(ok || 'Confirmar') + '</button></div></div></div>';
      const campoEl = r.querySelector('#dlgCampo');
      if (campoEl) campoEl.value = valor || '';
      const fechar = v => { r.innerHTML = ''; document.removeEventListener('keydown', tecla, true); if (anterior && anterior.focus) anterior.focus(); resolve(v); };
      const valorFinal = sim => !sim ? (campo ? null : false) : (campo ? campoEl.value : true);
      r.querySelectorAll('[data-r]').forEach(b => b.onclick = () => fechar(valorFinal(b.dataset.r === '1')));
      r.querySelector('.dlgFundo').onclick = e => { if (e.target.classList.contains('dlgFundo')) fechar(valorFinal(false)); };
      function tecla(e) {
        if (e.key === 'Escape') { e.preventDefault(); fechar(valorFinal(false)); }
        else if (e.key === 'Enter' && !(campoEl && campoEl.tagName === 'TEXTAREA')) { e.preventDefault(); fechar(valorFinal(true)); }
        else if (e.key === 'Tab') {
          const foc = [...r.querySelectorAll('input,textarea,button')];
          const i = foc.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); foc[foc.length - 1].focus(); }
          else if (!e.shiftKey && i === foc.length - 1) { e.preventDefault(); foc[0].focus(); }
        }
      }
      document.addEventListener('keydown', tecla, true);
      setTimeout(() => { if (campoEl) { campoEl.focus(); if (somenteLeitura) campoEl.select(); } else r.querySelector('[data-r="1"]').focus(); }, 30);
    });
  }

  const PERIGO = /^(Excluir|Remover|Cancelar este|Bloquear)/i;
  function separar(msg) {
    const partes = String(msg).split('\n\n');
    return { titulo: partes[0], texto: partes.slice(1).join('\n\n') };
  }

  window.confirmar = function (msg, opcoes) {
    const { titulo, texto } = separar(msg);
    const perigo = PERIGO.test(titulo);
    const verbo = (titulo.match(/^(Excluir|Remover|Cancelar|Bloquear)/i) || [])[0];
    return abrir(Object.assign({ titulo, texto, perigo, ok: verbo ? (verbo === 'Cancelar' ? 'Cancelar pedido' : verbo) : 'Confirmar', cancelar: verbo === 'Cancelar' ? 'Voltar' : 'Cancelar' }, opcoes || {}));
  };

  window.perguntar = function (msg, valor, opcoes) {
    const linhas = String(msg).split('\n');
    return abrir(Object.assign({ titulo: linhas[0], texto: linhas.slice(1).join('\n').trim(), campo: 'area', valor: valor || '', ok: 'Salvar' }, opcoes || {}));
  };

  window.mostrarTexto = function (titulo, texto) {
    return abrir({ titulo, campo: 'area', valor: texto, ok: 'Fechar', cancelar: false, somenteLeitura: true });
  };
})();
