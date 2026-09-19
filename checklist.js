(() => {
  function renderChecklistFinal() {
    const lista = (DB.checklist || []).slice().sort((a,b) =>
      Number(a.concluido) - Number(b.concluido) ||
      (a.categoria || '').localeCompare(b.categoria || '') ||
      (a.prazo || '9999').localeCompare(b.prazo || '9999')
    );
    const concluidos = lista.filter(x => x.concluido).length;
    const pendentes = lista.length - concluidos;

    const linhas = lista.map(x =>
      '<div class="card" style="margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<input type="checkbox" ' + (x.concluido ? 'checked' : '') +
      ' onchange="alternarChecklist(\'' + x.id + '\',this.checked)" style="accent-color:var(--pink);width:18px;height:18px">' +
      '<div style="flex:1">' +
      '<div style="font-weight:800;text-decoration:' + (x.concluido ? 'line-through' : 'none') + '">' + esc(x.item) + '</div>' +
      (x.categoria ? '<div class="meta">' + esc(x.categoria) + '</div>' : '') +
      (x.responsavel ? '<div class="meta">Responsável: ' + esc(x.responsavel) + '</div>' : '') +
      (x.prazo ? '<div class="meta">Prazo: ' + new Date(x.prazo + 'T00:00:00').toLocaleDateString('pt-BR') + '</div>' : '') +
      '</div>' +
      '<button class="filter" onclick="abrirChecklist(\'' + x.id + '\')">Editar</button>' +
      '<button class="filter" onclick="excluirChecklist(\'' + x.id + '\')">Excluir</button>' +
      '</div></div>'
    ).join('');

    shell(
      'Checklist',
      'Conferência final de prontidão do espetáculo',
      '<div class="notice"><strong>Como usar:</strong> Produção registra e acompanha tarefas durante a montagem. Este Checklist serve para confirmar que cada item essencial está efetivamente pronto antes da apresentação.</div>' +
      '<div class="grid">' +
      '<div class="stat"><b>' + lista.length + '</b><span>Total de conferências</span></div>' +
      '<div class="stat"><b>' + concluidos + '</b><span>Confirmadas</span></div>' +
      '<div class="stat"><b>' + pendentes + '</b><span>Pendentes</span></div>' +
      '</div>' +
      '<div class="section card"><h2>Conferência de prontidão</h2>' +
      '<div class="sub">Use este módulo para a checagem final de espaço, elenco, figurino, adereços, técnica, divulgação, documentos e demais itens necessários para o espetáculo acontecer.</div></div>' +
      '<div style="display:flex;justify-content:flex-end;margin:15px 0"><button class="btn" onclick="abrirChecklist()">+ Nova conferência</button></div>' +
      (linhas || '<div class="empty">Nenhum item de conferência cadastrado.</div>') +
      '<div id="checkModal" class="modal" onclick="if(event.target===this)fecharChecklist()"><div class="modalbox">' +
      '<div class="modalhead"><div><div class="eyebrow">Prontidão do espetáculo</div><h2 id="checkTitulo">Nova conferência</h2></div><button class="close" onclick="fecharChecklist()">×</button></div>' +
      '<div class="formgrid">' +
      '<div class="field full"><label>Item a conferir</label><input id="cItem" placeholder="Ex.: Figurinos completos e separados"></div>' +
      '<div class="field"><label>Categoria</label><select id="cCategoria"><option>Espaço</option><option>Elenco</option><option>Figurino</option><option>Adereços</option><option>Cenário</option><option>Iluminação</option><option>Sonoplastia</option><option>Divulgação</option><option>Documentação</option><option>Financeiro</option><option>Dia da apresentação</option><option>Outros</option></select></div>' +
      '<div class="field"><label>Responsável</label><input id="cResponsavel" placeholder="Nome"></div>' +
      '<div class="field"><label>Prazo da conferência</label><input id="cPrazo" type="date"></div>' +
      '<div class="field"><label>Situação</label><select id="cConcluido"><option value="false">Pendente</option><option value="true">Confirmado</option></select></div>' +
      '</div><div class="modalactions"><button class="filter" onclick="fecharChecklist()">Cancelar</button><button class="btn" onclick="salvarChecklist()">Salvar conferência</button></div>' +
      '</div></div>'
    );
  }

  function navFinal() {
    const labels = {
      inicio:'Início', elenco:'Elenco', esquetes:'Banco de Esquetes', espetaculo:'Grade',
      ensaios:'Ensaios', producao:'Produção', divulgacao:'Divulgação', orcamento:'Orçamento',
      checklist:'Checklist Final', ficha:'Ficha Técnica'
    };
    document.querySelector('#nav').innerHTML = navItems.map(x =>
      '<button class="' + (page === x[0] ? 'active' : '') + '" onclick="go(\'' + x[0] + '\')">' +
      labels[x[0]] + '</button>'
    ).join('');
  }

  setTimeout(() => {
    window.checklist = renderChecklistFinal;
    window.nav = navFinal;
    if (typeof nav === 'function') navFinal();
  }, 0);
})();