/* Motor único de importação semanal incremental para o novo Supabase CCO. */
(function instalarMotorSemanalCCO(){
"use strict";
const SERVICOS=["P1","P2.1","P2.2","P3","P4","P5","P6","P7","P8","P9","P10","P11","P12"];
const MAPA={
 rd:["rd","r_d"],servico:["servico_p","servico"],veiculo:["veiculo","placa","prefixo"],tipo_servico:["tipo_servico"],
 data_operacao:["data_operacao","data_analise","data","dia"],hora_inicio:["hora_inicio","horario_inicio","hora"],turno:["turno","periodo"],
 ra:["ra","regiao_administrativa","regiao"],setor:["setor","local"],viagens:["viagens","qtd_viagens","quantidade_viagens"],
 peso_t:["peso_t","peso","peso_total","toneladas"],km_total:["km_total","km","km_executado"],km_produtivo:["km_produtivo"],
 km_improdutivo:["km_improdutivo"],velocidade_media:["velocidade_media","vm"],velocidade_media_produtiva:["velocidade_media_produtiva"],
 velocidade_media_improdutiva:["velocidade_media_improdutiva"],inicio_operacao:["inicio_operacao"],fim_operacao:["fim_operacao"],
 tempo_total_minutos:["tempo_total_minutos","tempo_total"],tempo_produtivo_minutos:["tempo_produtivo_minutos","tempo_produtivo"],
 tempo_improdutivo_minutos:["tempo_improdutivo_minutos","tempo_improdutivo"],tempo_parada_minutos:["tempo_parada_minutos","tempo_parada"],
 motorista:["motorista"],valor_abastecido:["valor_abastecido"],ticket_abastecimento:["ticket_abastecimento","ticket"],
 odometro_inicial:["odometro_inicial"],odometro_final:["odometro_final"],horimetro_inicial:["horimetro_inicial"],horimetro_final:["horimetro_final"]
};
const NUMERICOS=["viagens","peso_t","km_total","km_produtivo","km_improdutivo","velocidade_media","velocidade_media_produtiva","velocidade_media_improdutiva","tempo_total_minutos","tempo_produtivo_minutos","tempo_improdutivo_minutos","tempo_parada_minutos","valor_abastecido","odometro_inicial","odometro_final","horimetro_inicial","horimetro_final"];
const COLUNAS_OPERACOES=new Set([
 "rd","servico","tipo_servico","data_operacao","hora_inicio","turno","ra","setor","veiculo",
 "viagens","peso_t","km_total","km_produtivo","km_improdutivo","velocidade_media",
 "velocidade_media_produtiva","velocidade_media_improdutiva","inicio_operacao","fim_operacao",
 "tempo_total_minutos","tempo_produtivo_minutos","tempo_improdutivo_minutos","tempo_parada_minutos",
 "motorista","valor_abastecido","ticket_abastecimento","odometro_inicial","odometro_final",
 "horimetro_inicial","horimetro_final","dados_originais","importacao_id"
]);
function clienteSupabase(){return window.supabaseClient||window.banco||null;}
async function obterUsuarioImportacao(){
 const cliente=clienteSupabase();
 if(!cliente?.auth)throw new Error("Cliente Supabase Auth indisponível.");
 const {data:{user}={},error}=await cliente.auth.getUser();
 if(error||!user){
  console.warn("Sessão inválida antes da importação:",{message:error?.message,code:error?.code});
  alert("Sessão expirada. Faça login novamente.");
  const falha=new Error("Sessão expirada.");falha.sessaoExpirada=true;
  setTimeout(()=>window.location.replace("login.html"),100);
  throw falha;
 }
 const nome=user.user_metadata?.nome||user.user_metadata?.name||user.user_metadata?.full_name||
  localStorage.getItem("usuario_nome")||sessionStorage.getItem("usuario_nome")||user.email;
 const perfil=user.user_metadata?.perfil||user.user_metadata?.role||localStorage.getItem("usuario_perfil")||
  sessionStorage.getItem("usuario_perfil")||"Usuário";
 const usuario={id:user.id,email:user.email||"",nome,perfil};
 console.log("Usuário da importação:",{id:usuario.id,nome:usuario.nome,email:usuario.email,perfil:usuario.perfil});
 return usuario;
}
window.obterUsuarioImportacao=obterUsuarioImportacao;
function norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\r\n]+/g," ").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}
function texto(v,obrigatorio=false){const s=String(v??"").trim();return s? s:(obrigatorio?"":null);}
function num(v){if(v===null||v===undefined||v===""||String(v).trim()==="-")return null;if(typeof v==="number")return Number.isFinite(v)?v:null;const s=String(v).trim().replace(/\s/g,"").replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:null;}
function dataISO(v){if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;if(typeof v==="number"&&window.XLSX?.SSF){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;}const s=String(v??"").trim();let m;if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)))return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;return null;}
function hora(v){if(v===null||v===undefined||v==="")return null;if(typeof v==="number"){const seg=Math.round((v%1)*86400);return `${String(Math.floor(seg/3600)%24).padStart(2,"0")}:${String(Math.floor(seg/60)%60).padStart(2,"0")}:${String(seg%60).padStart(2,"0")}`;}const s=String(v).trim();return /^\d{1,2}:\d{2}/.test(s)?s:null;}
function minutos(v){if(v===null||v===undefined||v===""||String(v).trim()==="-")return null;if(typeof v==="number")return Number.isFinite(v)?(v>0&&v<1?v*1440:v):null;const s=String(v).trim();const m=s.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);if(m)return Number(m[1])*60+Number(m[2])+Number(m[3]||0)/60;return num(v);}
function anoMes(v,anoExplicito){const direto=Number(v);if(anoExplicito&&direto>=1&&direto<=12)return{ano:Number(anoExplicito),mes:direto};if(typeof converterValorMesParaAnoMes==="function"){try{const x=converterValorMesParaAnoMes(v);if(x)return{ano:Number(x.ano),mes:Number(x.mes)};}catch(_){}}const d=dataISO(v);return d?{ano:Number(d.slice(0,4)),mes:Number(d.slice(5,7))}:null;}
function linhaNorm(linha){const o={};Object.entries(linha||{}).forEach(([k,v])=>o[norm(k)]=v);return o;}
function campo(linha,nomes){for(const n of nomes||[])if(Object.prototype.hasOwnProperty.call(linha,n))return linha[n];return null;}
function vazia(linha){return !Object.values(linha||{}).some(v=>v!==null&&v!==undefined&&String(v).trim()!=="");}
function servicoAba(nome){const s=String(nome||"").toUpperCase().replace(/\s/g,"");return SERVICOS.find(p=>s===p||s.startsWith(`${p}_`)||s.startsWith(`${p}-`))||null;}
function lotes(a,n){const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;}
function bytes(v){const s=JSON.stringify(v);return typeof Blob!=="undefined"?new Blob([s]).size:s.length;}
function sanitizar(v){return JSON.parse(JSON.stringify(v,(k,x)=>{if(typeof x==="number"&&!Number.isFinite(x))return null;if(x===undefined)return null;if(x instanceof Date)return x.toISOString();return x;}));}
function converterOperacao(raw,nomeAba){
 const l=linhaNorm(raw);
 const servico=String(campo(l,MAPA.servico)||servicoAba(nomeAba)||"").trim().toUpperCase();
 if(!SERVICOS.includes(servico))return null;
 const o={};
 Object.keys(MAPA).forEach(k=>o[k]=campo(l,MAPA[k]));
 o.servico=servico;
 o.data_operacao=dataISO(o.data_operacao);
 o.hora_inicio=hora(o.hora_inicio);
 o.inicio_operacao=hora(o.inicio_operacao);
 o.fim_operacao=hora(o.fim_operacao);
 NUMERICOS.forEach(k=>o[k]=k.includes("tempo_")?minutos(o[k]):num(o[k]));
 ["veiculo","tipo_servico","turno","ra","setor","motorista","ticket_abastecimento"].forEach(k=>o[k]=texto(o[k]));
 const valorRD=o.rd;
 o.rd=valorRD!==null&&valorRD!==undefined&&String(valorRD).trim()!==""
  ?String(valorRD).trim()
  :`AUTO|${o.servico}|${o.data_operacao||""}|${o.veiculo||""}|${o.hora_inicio||""}|${o.ra||""}|${o.setor||""}`;
 o.dados_originais=sanitizar(raw);
 return o.data_operacao?o:null;
}
function payloadOperacao(operacao,importacaoId){
 const origem={...operacao,rd:String(operacao?.rd??"").trim(),servico:String(operacao?.servico??"").trim(),importacao_id:importacaoId};
 const payload={};
 for(const [campoBanco,valor] of Object.entries(origem)){
  if(COLUNAS_OPERACOES.has(campoBanco))payload[campoBanco]=valor===undefined?null:valor;
 }
 if(!payload.rd)throw new Error("Operação sem RD após a normalização.");
 if(!payload.servico)throw new Error("Operação sem serviço após a normalização.");
 if(!payload.data_operacao)throw new Error("Operação sem data_operacao após a normalização.");
 if(!payload.importacao_id)throw new Error("Operação sem importacao_id.");
 return payload;
}
function periodo(data){return String(data).slice(0,7);} function limite(p){const[a,m]=p.split("-").map(Number),d=new Date(a,m,1);return{ano:a,mes:m,inicio:`${p}-01`,fim:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`};}
async function tudo(q){const r=[];for(let i=0;;i+=1000){const{data,error}=await q().range(i,i+999);if(error)throw error;r.push(...(data||[]));if(!data||data.length<1000)break;}return r;}
async function lerArquivos(arquivos){const abas=[];for(const arq of arquivos){const wb=XLSX.read(await arq.arrayBuffer(),{type:"array",cellDates:true,cellNF:false,cellText:false});wb.SheetNames.forEach(nome=>{const dados=XLSX.utils.sheet_to_json(wb.Sheets[nome],{defval:null,raw:true});abas.push({arquivo:arq.name,nome,dados});});}return abas;}
function extrair(abas){const operacoes=[],dias=[],planejamento=[];let totalErros=0;abas.forEach(aba=>{const na=norm(aba.nome);aba.dados.filter(x=>!vazia(x)).forEach(raw=>{if(na.includes("dias_operacao")){const l=linhaNorm(raw),am=anoMes(campo(l,["mes_numero","mes","data","periodo"]),campo(l,["ano"]));const total=num(campo(l,["total_dias","dias_operacao","dias"]));if(am?.ano&&am?.mes&&total!==null)dias.push({ano:am.ano,mes:am.mes,total_dias:total});else totalErros++;return;}if(na.includes("planejamento")){const l=linhaNorm(raw);const p={circuito:texto(campo(l,["circuito"]),true),ra:texto(campo(l,["ra","regiao_administrativa"])),frequencia:texto(campo(l,["frequencia"])),tipo_servico:texto(campo(l,["tipo_servico"]),true),turno:texto(campo(l,["turno"]),true),km_planejado:num(campo(l,["km_planejado","km"] ))};if(p.circuito&&p.tipo_servico&&p.turno)planejamento.push(p);else totalErros++;return;}const op=converterOperacao(raw,aba.nome);if(op)operacoes.push(op);else if(servicoAba(aba.nome))totalErros++;});});const mapa=new Map();operacoes.forEach(o=>mapa.set(`${o.rd}|${o.servico}`,o));return{operacoes:[...mapa.values()],totalLidos:operacoes.length,totalErros,dias,planejamento,abas};}
async function upsertLotes(tabela,linhas,tamanho,conflito,contexto){for(let i=0;i<linhas.length;i+=tamanho){const lote=linhas.slice(i,i+tamanho),payload=sanitizar(lote),indiceLote=Math.floor(i/tamanho);const{data,error}=await banco.from(tabela).upsert(payload,{onConflict:conflito,ignoreDuplicates:false}).select();if(error){const diagnostico={...contexto,lote:indiceLote,quantidade:lote.length,tamanhoPayload:bytes(payload),amostra:payload[0]||null,code:error.code,message:error.message,details:error.details,hint:error.hint,error};console.error(tabela==="operacoes"?"Erro no upsert de operações":`ERRO ${tabela.toUpperCase()}`,diagnostico);error.ccoLote=indiceLote;error.ccoAmostra=payload[0]||null;throw error;}if(contexto?.retorno)data&&contexto.retorno.push(...data);}}
async function existentes(ops){const ch=new Set(ops.map(o=>`${o.rd}|${o.servico}`)),r=[];for(const ids of lotes([...new Set(ops.map(o=>o.rd))],150)){const{data,error}=await banco.from("operacoes").select("*").in("rd",ids);if(error)throw error;r.push(...(data||[]).filter(x=>ch.has(`${x.rd}|${x.servico}`)));}return r;}
async function arquivar(abas,importacaoId){for(const aba of abas){const partes=lotes(aba.dados,50);for(let i=0;i<partes.length;i++){const payload={importacao_id:importacaoId,nome_arquivo:aba.arquivo,aba:aba.nome,codigo_servico:servicoAba(aba.nome)||"GERAL",numero_lote:i+1,quantidade_registros:partes[i].length,dados:sanitizar(partes[i])};const{error}=await banco.from("planilhas_importadas").insert(payload);if(error){console.error("ERRO PLANILHAS_IMPORTADAS",{aba:aba.nome,lote:i+1,quantidade:partes[i].length,tamanhoPayload:bytes(payload),code:error.code,message:error.message,details:error.details,hint:error.hint,error});throw error;}}}}
async function recalcular(p,importacaoId){const l=limite(p),ops=await tudo(()=>banco.from("operacoes").select("*").gte("data_operacao",l.inicio).lt("data_operacao",l.fim).order("data_operacao"));const mapa={};SERVICOS.forEach(s=>mapa[s]={ops:0,viagens:0,peso:0,km:0,vel:0,velN:0,dias:new Set()});ops.forEach(o=>{const m=mapa[o.servico];if(!m)return;m.ops++;m.viagens+=num(o.viagens)||0;m.peso+=num(o.peso_t)||0;m.km+=num(o.km_total)||0;if(num(o.velocidade_media)!==null){m.vel+=num(o.velocidade_media);m.velN++;}m.dias.add(String(o.data_operacao).slice(0,10));});const{data:dias}=await banco.from("dias_operacao").select("total_dias").eq("ano",l.ano).eq("mes",l.mes).maybeSingle();const td=Number(dias?.total_dias)||0;const painel=[],kpis=[];SERVICOS.forEach(s=>{const m=mapa[s],ac=["P5","P6"].includes(s)?m.km:(["P2.1","P2.2"].includes(s)?m.viagens:m.peso),prev=Number(window.ccoPrevistoOficialPorDias?.[td]?.[s]||0),vu=Number(typeof VALORES_FIXOS!=="undefined"?VALORES_FIXOS[s]:0)||0;painel.push({ano:l.ano,mes:l.mes,servico:s,nome_servico:s,acumulado_mes:ac,medicao:["P5","P6"].includes(s)?"KM":(["P2.1","P2.2"].includes(s)?"Viagens":"Tonelada"),previsto:prev,percentual_execucao:prev?ac/prev*100:0,dias_acumulados:m.dias.size,total_dias_mes:td,valor_unitario:vu,valor_total:vu*ac});kpis.push({ano:l.ano,mes:l.mes,servico:s,total_operacoes:m.ops,total_viagens:m.viagens,total_peso_t:m.peso,total_km:m.km,velocidade_media:m.velN?m.vel/m.velN:0,quantidade_dias:m.dias.size});});await upsertLotes("painel_executivo",painel,300,"ano,mes,servico",{});await upsertLotes("kpi_mensal",kpis,300,"ano,mes,servico",{});}
async function salvar(dados,nomeArquivo,usuario){
 let imp=null,anteriores=[],retorno=[],meses=[],snapDias=[],snapPlan=[],snapPainel=[],snapKpi=[];
 const ctx={arquivo:nomeArquivo};
 try{
  const datas=dados.operacoes.map(o=>o.data_operacao).sort(),ini=datas[0],fim=datas.at(-1);
  meses=[...new Set(datas.map(periodo))];
  if(!ini)throw new Error("Nenhuma operação válida encontrada nas abas P1 a P12.");
  const meta={lote:`SEM-${new Date().toISOString()}`,arquivo:nomeArquivo,usuario_id:usuario.id,usuario:usuario.nome,usuario_email:usuario.email,usuario_perfil:usuario.perfil,tipo_importacao:"semanal",status:"processando",data_inicio:ini,data_fim:fim,total_lidos:dados.totalLidos,total_inseridos:0,total_atualizados:0,total_erros:dados.totalErros||0,ativo:false,mensagem_erro:null,criado_em:new Date().toISOString(),concluido_em:null};
  const cr=await banco.from("importacoes").insert(meta).select().single();if(cr.error)throw cr.error;imp=cr.data;
  await arquivar(dados.abas,imp.id);
  anteriores=await existentes(dados.operacoes);
  for(const d of dados.dias){const q=await banco.from("dias_operacao").select("*").eq("ano",d.ano).eq("mes",d.mes);if(q.error)throw q.error;snapDias.push({chave:d,linhas:q.data||[]});}
  for(const p of dados.planejamento){const q=await banco.from("planejamento").select("*").eq("circuito",p.circuito).eq("tipo_servico",p.tipo_servico).eq("turno",p.turno);if(q.error)throw q.error;snapPlan.push({chave:p,linhas:q.data||[]});}
  for(const p of meses){const l=limite(p),pa=await banco.from("painel_executivo").select("*").eq("ano",l.ano).eq("mes",l.mes),kp=await banco.from("kpi_mensal").select("*").eq("ano",l.ano).eq("mes",l.mes);if(pa.error)throw pa.error;if(kp.error)throw kp.error;snapPainel.push({p,linhas:pa.data||[]});snapKpi.push({p,linhas:kp.data||[]});}
  const ch=new Set(anteriores.map(x=>`${x.rd}|${x.servico}`)),payload=dados.operacoes.map(o=>payloadOperacao(o,imp.id));
  await upsertLotes("operacoes",payload,300,"rd,servico",{...ctx,retorno});
  const dias=dados.dias.map(x=>({...x,importacao_id:imp.id}));if(dias.length)await upsertLotes("dias_operacao",dias,300,"ano,mes",ctx);
  const plan=dados.planejamento.map(x=>({...x,importacao_id:imp.id}));if(plan.length)await upsertLotes("planejamento",plan,300,"circuito,tipo_servico,turno",ctx);
  for(const p of meses)await recalcular(p,imp.id);
  const inseridos=dados.operacoes.filter(o=>!ch.has(`${o.rd}|${o.servico}`)).length,atualizados=dados.operacoes.length-inseridos;
  const up=await banco.from("importacoes").update({status:"concluido",ativo:true,concluido_em:new Date().toISOString(),total_inseridos:inseridos,total_atualizados:atualizados,total_erros:dados.totalErros||0}).eq("id",imp.id);if(up.error)throw up.error;
  console.info("IMPORTAÇÃO SEMANAL CCO",{arquivo:nomeArquivo,data_inicial:ini,data_final:fim,quantidade_lida:dados.totalLidos,quantidade_inserida:inseridos,quantidade_atualizada:atualizados,meses_afetados:meses,importacao_id:imp.id});return true;
 }catch(error){
  console.error("ERRO IMPORTAÇÃO SEMANAL CCO",{arquivo:nomeArquivo,importacao_id:imp?.id,code:error.code,message:error.message,details:error.details,hint:error.hint,error});
  try{
   const antigas=new Set(anteriores.map(x=>`${x.rd}|${x.servico}`)),novos=retorno.filter(x=>!antigas.has(`${x.rd}|${x.servico}`)).map(x=>x.id).filter(Boolean);
   for(const ids of lotes(novos,200))await banco.from("operacoes").delete().in("id",ids);
   if(anteriores.length)await upsertLotes("operacoes",anteriores,300,"rd,servico",{});
   for(const s of snapDias){await banco.from("dias_operacao").delete().eq("ano",s.chave.ano).eq("mes",s.chave.mes);if(s.linhas.length)await banco.from("dias_operacao").insert(s.linhas);}
   for(const s of snapPlan){await banco.from("planejamento").delete().eq("circuito",s.chave.circuito).eq("tipo_servico",s.chave.tipo_servico).eq("turno",s.chave.turno);if(s.linhas.length)await banco.from("planejamento").insert(s.linhas);}
   for(const s of snapPainel){const l=limite(s.p);await banco.from("painel_executivo").delete().eq("ano",l.ano).eq("mes",l.mes);if(s.linhas.length)await banco.from("painel_executivo").insert(s.linhas);}
   for(const s of snapKpi){const l=limite(s.p);await banco.from("kpi_mensal").delete().eq("ano",l.ano).eq("mes",l.mes);if(s.linhas.length)await banco.from("kpi_mensal").insert(s.linhas);}
  }catch(rollback){console.error("ERRO NO ROLLBACK SEMANAL",rollback);}
  if(imp?.id)await banco.from("importacoes").update({status:"erro",ativo:false,total_erros:1,mensagem_erro:String(error.message||error),concluido_em:new Date().toISOString()}).eq("id",imp.id);
  window.__CCO_ERRO_IMPORTACAO_MENSAGEM__=[`Falha na importação semanal: ${error.message||error}`,error.code?`Código: ${error.code}`:"",error.details?`Detalhes: ${error.details}`:"",error.hint?`Dica: ${error.hint}`:"",error.ccoLote!==undefined?`Lote: ${error.ccoLote}`:"",error.ccoAmostra?`Amostra: ${JSON.stringify(error.ccoAmostra).slice(0,1000)}`:""].filter(Boolean).join("\n");return false;
 }
}
async function importar(evento){const input=evento?.target||document.getElementById("arquivoExcel"),arquivos=[...(input?.files||[])];if(!arquivos.length)return;if(!window.XLSX){alert("Biblioteca XLSX não carregou.");return;}const loading=document.getElementById("loadingOverlay");if(loading)loading.style.display="flex";try{const usuario=await obterUsuarioImportacao();const abas=await lerArquivos(arquivos),dados=extrair(abas);window.sheetsOriginais=Object.fromEntries(abas.map(a=>[norm(a.nome),{nomeOriginal:a.nome,codigoServico:servicoAba(a.nome),dadosOriginais:a.dados,dadosNormalizados:a.dados.map(linhaNorm)}]));try{sheetsOriginais=window.sheetsOriginais;}catch(_){}window.operacoes=dados.operacoes.map(o=>({servico:o.servico,rd:String(o.rd),data:o.data_operacao,data_normalizada:o.data_operacao,turno:o.turno,ra:o.ra,setor:o.setor,peso:o.peso_t,viagens:o.viagens,km:o.km_total,velocidade_media:o.velocidade_media,status:"Com dados",dados_originais:o.dados_originais}));try{operacoes=window.operacoes;operacoesOriginal=window.operacoes.slice();}catch(_){}const ok=await salvar(dados,arquivos.map(a=>a.name).join(", "),usuario);alert(ok?"Importação semanal concluída.":window.__CCO_ERRO_IMPORTACAO_MENSAGEM__||"Falha na importação semanal. Consulte o Console.");if(ok){delete window.__CCO_CATALOGO_PERIODOS__;delete window.__CCO_IMPORTACOES_POR_PERIODO__;window.location.reload();}}catch(error){if(error?.sessaoExpirada)return;console.error("ERRO AO LER PLANILHA",error);alert(`Erro ao ler planilha: ${error.message||error}`);}finally{if(loading)loading.style.display="none";if(input)input.value="";}}
window.importarPlanilhas=importar;window.salvarBaseCompletaSupabase=function(){console.warn("Use importarPlanilhas: o motor semanal salva diretamente no novo schema.");return Promise.resolve(false);};try{importarPlanilhas=importar;salvarBaseCompletaSupabase=window.salvarBaseCompletaSupabase;}catch(_){}const inputAntigo=document.getElementById("arquivoExcel");if(inputAntigo){const input=inputAntigo.cloneNode(true);inputAntigo.replaceWith(input);input.onchange=importar;input.dataset.ccoMotorSemanal="novo-banco";}
})();
