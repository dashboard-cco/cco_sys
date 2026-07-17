/* Histórico semanal do novo banco CCO. */
(function(){
  window.CCO_PAGE="historico";
  const esc=v=>String(v??"-").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function carregar(){
    const tabela=document.getElementById("tabelaHistorico"); if(!tabela)return;
    try{
      const cliente=window.supabaseClient||window.banco;
      const {data,error}=await cliente.from("importacoes").select("id,arquivo,usuario,usuario_email,usuario_perfil,status,data_inicio,data_fim,total_lidos,total_inseridos,total_atualizados,total_erros,criado_em,concluido_em,lote").order("criado_em",{ascending:false});
      if(error)throw error;
      tabela.innerHTML=(data||[]).map(i=>`<tr>
        <td>${i.criado_em?new Date(i.criado_em).toLocaleString("pt-BR"):"-"}</td>
        <td>${esc(i.usuario||i.usuario_email||"Não identificado")}<br><small>${esc(i.usuario_perfil||"Usuário")}${i.usuario_email?` • ${esc(i.usuario_email)}`:""}</small></td><td>${esc(i.lote)}</td><td>${esc(i.arquivo)}</td>
        <td>${Number(i.total_lidos||0).toLocaleString("pt-BR")} lidos / ${Number(i.total_inseridos||0).toLocaleString("pt-BR")} novos / ${Number(i.total_atualizados||0).toLocaleString("pt-BR")} atualizados</td>
        <td><span class="badge ${i.status==="concluido"?"ok":i.status==="erro"?"danger":"info"}">${esc(i.status)}</span></td>
        <td>${esc(i.data_inicio)} a ${esc(i.data_fim)}</td></tr>`).join("")||`<tr><td colspan="7">Nenhuma importação semanal.</td></tr>`;
    }catch(error){console.error("Erro ao carregar histórico semanal:",error);tabela.innerHTML=`<tr><td colspan="7">Erro ao carregar histórico. Consulte o Console.</td></tr>`;}
  }
  window.carregarHistorico=carregar;
  try { carregarHistorico=carregar; } catch(_) {}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",carregar,{once:true});else carregar();
})();
