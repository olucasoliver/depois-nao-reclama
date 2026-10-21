/* Texto com formatação (negrito, itálico, listas e links) para as observações.
   O texto é guardado como HTML limpo: só as marcações abaixo sobrevivem.
   Textos antigos, sem formatação, continuam aparecendo normalmente. */

(function () {
  const PERMITIDAS = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', UL: 'ul', OL: 'ol', LI: 'li', A: 'a', BR: 'br', P: 'p', DIV: 'p' };
  const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

  function hrefSeguro(h) {
    h = String(h || '').trim();
    if (/^www\./i.test(h)) h = 'https://' + h;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h)) h = 'mailto:' + h;
    if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(h)) return 'https://' + h;
    return null;
  }
  function linkifyTexto(texto) {
    return escH(texto).replace(URL_RE, u => '<a href="' + escH(hrefSeguro(u.replace(/&amp;/g, '&')) || '#') + '" target="_blank" rel="noopener">' + u + '</a>');
  }

  function limparNo(no, dentroDeLink) {
    let out = '';
    no.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += dentroDeLink ? escH(n.textContent) : linkifyTexto(n.textContent); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return;
      // Negrito e itálico vindos de cópia do Google Docs/Word chegam como <span style>
      const st = (n.getAttribute('style') || '').toLowerCase();
      let interno = limparNo(n, dentroDeLink || tag === 'A');
      if (tag === 'SPAN' || !PERMITIDAS[tag]) {
        if (/font-weight:\s*(bold|[6-9]00)/.test(st)) interno = '<b>' + interno + '</b>';
        if (/font-style:\s*italic/.test(st)) interno = '<i>' + interno + '</i>';
        out += interno;
        return;
      }
      const t = PERMITIDAS[tag];
      if (t === 'br') { out += '<br>'; return; }
      if (t === 'a') {
        const h = hrefSeguro(n.getAttribute('href'));
        out += h && !dentroDeLink ? '<a href="' + escH(h) + '" target="_blank" rel="noopener">' + interno + '</a>' : interno;
        return;
      }
      if (t === 'p') { out += /<(p|ul|ol)\b/.test(interno) ? interno : interno.trim() ? '<p>' + interno + '</p>' : '<br>'; return; }
      out += '<' + t + '>' + interno + '</' + t + '>';
    });
    return out;
  }

  const temMarcacao = v => /<\/?(b|strong|i|em|u|ul|ol|li|a|br|p|div|span)\b/i.test(String(v || ''));

  /* HTML seguro a partir do que o editor ou o banco entregar */
  window.limparHtml = function (html) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    return limparNo(doc.body, false).replace(/(<br>\s*)+$/, '').trim();
  };

  /* Para mostrar: texto antigo vira parágrafos com links; texto formatado é limpo */
  window.textoRico = function (v) {
    if (!v) return '';
    if (!temMarcacao(v)) return String(v).split(/\n/).map(linkifyTexto).join('<br>');
    return limparHtml(v);
  };

  /* Versão sem formatação, para prévias e campos de texto simples */
  window.textoPuro = function (v) {
    if (!v) return '';
    if (!temMarcacao(v)) return String(v);
    const doc = new DOMParser().parseFromString('<body>' + limparHtml(v) + '</body>', 'text/html');
    doc.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    doc.querySelectorAll('p,li').forEach(b => b.append('\n'));
    doc.querySelectorAll('li').forEach(b => b.prepend('• '));
    return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
  };

  /* ---------- Editor ---------- */
  const BOTOES = [
    ['bold', '<b>N</b>', 'Negrito (Ctrl+B)'],
    ['italic', '<i>I</i>', 'Itálico (Ctrl+I)'],
    ['insertUnorderedList', '• Lista', 'Lista com marcadores'],
    ['insertOrderedList', '1. Lista', 'Lista numerada'],
    ['link', 'Link', 'Transformar o texto selecionado em link'],
    ['removeFormat', 'Limpar', 'Tirar a formatação do texto selecionado']
  ];
  window.editorRico = function (id, placeholder) {
    return '<div class="editorRico">' +
      '<div class="editorBarra" role="toolbar" aria-label="Formatação">' +
      BOTOES.map(([cmd, rot, tit]) => '<button type="button" title="' + tit + '" aria-label="' + tit + '" onmousedown="event.preventDefault()" onclick="formatarRico(\'' + id + '\',\'' + cmd + '\')">' + rot + '</button>').join('') +
      '</div><div id="' + id + '" class="editorArea rico" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="' + escH(placeholder || '') + '"' +
      ' onpaste="colarRico(event)" onkeydown="teclaRico(event,\'' + id + '\')"></div></div>';
  };
  window.definirEditor = function (id, valor) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = textoRico(valor);
  };
  window.lerEditor = function (id) {
    const el = document.getElementById(id);
    if (!el) return '';
    const html = limparHtml(el.innerHTML);
    return el.textContent.trim() || /<li>/.test(html) ? html : '';
  };

  let selecaoGuardada = null;
  document.addEventListener('selectionchange', () => {
    const s = document.getSelection();
    if (s.rangeCount && s.anchorNode && s.anchorNode.parentElement && s.anchorNode.parentElement.closest('.editorArea')) selecaoGuardada = s.getRangeAt(0).cloneRange();
  });

  window.formatarRico = async function (id, cmd) {
    const el = document.getElementById(id);
    el.focus();
    if (cmd !== 'link') { document.execCommand(cmd, false, null); return; }
    const range = selecaoGuardada && el.contains(selecaoGuardada.commonAncestorContainer) ? selecaoGuardada.cloneRange() : null;
    const texto = range ? range.toString() : '';
    const url = await perguntar('Endereço do link', /^(https?:\/\/|www\.)/i.test(texto) ? texto : 'https://', { campo: 'linha', ok: 'Inserir link' });
    if (url == null) return;
    const h = hrefSeguro(url);
    if (!h) return avisar('Informe um endereço válido, como https://exemplo.com.br', 'erro');
    el.focus();
    const s = document.getSelection();
    s.removeAllRanges();
    if (range) s.addRange(range); else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.addRange(r); }
    if (texto) document.execCommand('createLink', false, h);
    else document.execCommand('insertHTML', false, '<a href="' + escH(h) + '">' + escH(url.trim()) + '</a>&nbsp;');
  };

  window.colarRico = function (e) {
    const dt = e.clipboardData;
    if (!dt) return;
    e.preventDefault();
    const html = dt.getData('text/html');
    const conteudo = html ? limparHtml(html) : String(dt.getData('text/plain') || '').split(/\n/).map(linkifyTexto).join('<br>');
    document.execCommand('insertHTML', false, conteudo);
  };

  window.teclaRico = function (e, id) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'k') { e.preventDefault(); formatarRico(id, 'link'); }
  };
})();
