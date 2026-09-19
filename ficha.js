function fichaTecnica(){
  const grupos={};
  (DB.ficha||[]).forEach(x=>{(grupos[x.categoria]??=[]).push(x)});
  const categorias=Object.entries(grupos);
  const corpo=categorias.length
    ? categorias.map(([cat,itens])=>'<div class="section card"><h2>'+esc(cat)+'</h2><table><thead><tr><th>Função</th><th>Nome</th><th>Contato</th><th>Observações</th><th>Ações</th></tr></thead><tbody>'+itens.map(x=>'<tr><td>'+esc(x.funcao)+'</td><td><b>'+esc(x.nome)+'</b></td><td>'+esc(x.contato||'')+'</td><td>'+esc(x.observacoes||'')+'</td><td><button class="filter" onclick="editarFicha(\\''+x.id+'\\')">Editar</button> <button class="filter" onclick="excluirFicha(\\''+x.id+'\\')">Excluir</button></td></tr>').join('')+'</tbody></table></div>').join('')
    : '<div class="empty">Nenhum profissional cadastrado na ficha técnica.</div>';
  shell('Ficha Técnica','Créditos e equipe profissional do espetáculo','<div style="display:flex;justify-content:flex-end;margin-bottom:15px"><button class="btn" onclick="abrirFicha()">+ Adicionar profissional</button></div>'+corpo+'<div id="fichaModal" class="modal" onclick="if(event.target===this)fecharFicha()"><div class="modalbox"><div class="modalhead"><div><div class="eyebrow">Ficha técnica</div><h2 id="fichaTitulo">Novo profissional</h2></div><button class="close" onclick="fecharFicha()">×</button></div><div class="formgrid"><div class="field"><label>Categoria</label><select id="ftCategoria"><option>Direção</option><option>Elenco</option><option>Produção</option><option>Direção de arte</option><option>Figurino</option><option>Adereços</option><option>Iluminação</option><option>Sonoplastia</option><option>Fotografia</option><option>Vídeo</option><option>Divulgação</option><option>Design</option><option>Financeiro</option><option>Outros</option></select></div><div class="field"><label>Função</label><input id="ftFuncao" placeholder="Ex.: Direção geral"></div><div class="field full"><label>Nome</label><input id="ftNome" placeholder="Nome do profissional"></div><div class="field"><label>Contato</label><input id="ftContato" placeholder="Telefone, e-mail ou @"></div><div class="field"><label>Ordem</label><input id="ftOrdem" type="number" min="1" placeholder="Opcional"></div><div class="field full"><label>Observações</label><textarea id="ftObs" placeholder="Informações adicionais..."></textarea></div></div><div class="modalactions"><button class="filter" onclick="fecharFicha()">Cancelar</button><button class="btn" onclick="salvarFicha()">Salvar</button></div></div></div>');
}
let fichaEditando=null;
function abrirFicha(id){
  fichaEditando=id?(DB.ficha||[]).find(x=>x.id===id):null;
  const r=fichaEditando;
  document.getElementById('fichaModal').classList.add('show');
  document.getElementById('fichaTitulo').textContent=r?'Editar profissional':'Novo profissional';
  document.getElementById('ftCategoria').value=r?.categoria||'Direção';
  document.getElementById('ftFuncao').value=r?.funcao||'';
  document.getElementById('ftNome').value=r?.nome||'';
  document.getElementById('ftContato').value=r?.contato||'';
  document.getElementById('ftOrdem').value=r?.ordem||'';
  document.getElementById('ftObs').value=r?.observacoes||'';
}
function editarFicha(id){abrirFicha(id)}
function fecharFicha(){const m=document.getElementById('fichaModal');if(m)m.classList.remove('show');fichaEditando=null}
async function salvarFicha(){
  const categoria=document.getElementById('ftCategoria').value;
  const funcao=document.getElementById('ftFuncao').value.trim();
  const nome=document.getElementById('ftNome').value.trim();
  if(!funcao||!nome)return alert('Informe a função e o nome.');
  const payload={categoria,funcao,nome,contato:document.getElementById('ftContato').value.trim(),observacoes:document.getElementById('ftObs').value.trim(),ordem:parseInt(document.getElementById('ftOrdem').value,10)||null};
  const r=fichaEditando
    ? await sbClient.from('ficha_tecnica').update(payload).eq('id',fichaEditando.id)
    : await sbClient.from('ficha_tecnica').insert(payload);
  if(r.error)return alert('Não foi possível salvar: '+r.error.message);
  fecharFicha();await load();go('ficha');
}
async function excluirFicha(id){
  if(!confirm('Excluir este item da ficha técnica?'))return;
  const r=await sbClient.from('ficha_tecnica').delete().eq('id',id);
  if(r.error)return alert('Não foi possível excluir: '+r.error.message);
  await load();go('ficha');
}

/* Carrega o módulo de Checklist Final depois do código principal.
   O módulo substitui apenas a apresentação do Checklist, sem alterar o banco. */
(function(){
  const s=document.createElement('script');
  s.src='./checklist.js?v=2';
  s.onload=()=>{ if(typeof nav==='function') nav(); };
  document.head.appendChild(s);
})();
