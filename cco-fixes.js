/* Correções consolidadas: períodos sob demanda, KPI único e importação idempotente. */
(function ccoCorrecoesConsolidadas() {
  "use strict";

  const PAGINA = String(window.CCO_PAGE || "").toLowerCase();
  const MESES = window.MESES_BR || {"01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril","05":"Maio","06":"Junho","07":"Julho","08":"Agosto","09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"};
  let periodosPromise;
  let cargaPromise;
  let renderFrame = 0;

  function db() { return window.supabaseClient || window.banco; }
  function pad(v) { return String(v || "").padStart(2, "0"); }
  function numeroSeguro(v) {
    if (typeof window.numero === "function") return window.numero(v);
    const n = Number(String(v ?? 0).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function chavePeriodo(ano, mes) { return `${ano}-${pad(mes)}`; }

  async function carregarCatalogoPeriodos(forcar = false) {
    if (!forcar && periodosPromise) return periodosPromise;
    periodosPromise = (async () => {
      const cliente = db();
      if (!cliente) return [];
      const { data, error } = await cliente.from("periodos_disponiveis").select("*")
        .order("ano", { ascending:false }).order("mes", { ascending:false });
      if (error) throw error;
      const unicos = new Map();
      (data || []).forEach(item => {
        const chave = chavePeriodo(item.ano, item.mes);
        if (!unicos.has(chave)) unicos.set(chave, { ...item, periodo:chave, ano:String(item.ano), mes:pad(item.mes) });
      });
      const catalogo = [...unicos.values()].sort((a, b) => b.periodo.localeCompare(a.periodo));
      window.__CCO_IMPORTACOES_POR_PERIODO__ = Object.fromEntries(catalogo.map(item => [item.periodo, item]));
      window.__CCO_CATALOGO_PERIODOS__ = catalogo;
      console.table(catalogo.map(x => ({
        periodo: `${x.ano}-${String(x.mes).padStart(2, "0")}`,
        origem: "periodos_disponiveis"
      })));
      return catalogo;
    })();
    return periodosPromise;
  }

  const obterPeriodos = carregarCatalogoPeriodos;
  window.carregarCatalogoPeriodos = carregarCatalogoPeriodos;

  async function buscarTodasOperacoes(periodo) {
    const cliente = db();
    const resultado = [];
    const inicioPeriodo = `${periodo.periodo}-01`;
    const proximo = new Date(Number(periodo.ano), Number(periodo.mes), 1);
    const fimPeriodo = `${proximo.getFullYear()}-${pad(proximo.getMonth() + 1)}-01`;
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await cliente.from("operacoes")
        .select("*")
        .gte("data_operacao", inicioPeriodo).lt("data_operacao", fimPeriodo)
        .order("data_operacao", { ascending: true })
        .range(inicio, inicio + 999);
      if (error) throw error;
      resultado.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const vistos = new Set();
    return resultado.filter(item => {
      const chave = item.id || [item.servico,item.data_operacao,item.turno,item.ra,item.peso_t,item.viagens,item.km_total,item.equipe,item.executado].join("|");
      if (vistos.has(chave)) return false;
      vistos.add(chave); return true;
    });
  }

  async function buscarPainel(periodo) {
    const { data, error } = await db().from("painel_executivo")
      .select("*").eq("ano", Number(periodo.ano)).eq("mes", Number(periodo.mes))
      .order("servico", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function publicarPeriodo(linhas, painelLinhas, periodo) {
    const convertidas = linhas.map(item => ({
      servico: String(item.servico || "").trim().toUpperCase(), origem: "Banco Supabase",
      importacao_id: item.importacao_id, rd: String(item.rd || ""), data: item.data_operacao || "",
      data_normalizada: String(item.data_operacao || "").slice(0, 10), turno: item.turno || "",
      ra: item.ra || "Por demanda", setor: "", peso: numeroSeguro(item.peso_t),
      viagens: numeroSeguro(item.viagens), km: numeroSeguro(item.km_total),
      equipe: 0, executado: 0, velocidade_media: numeroSeguro(item.velocidade_media),
      tempo_produtivo_h: numeroSeguro(item.tempo_produtivo_minutos) / 60,
      status: "Com dados", dados_originais:item.dados_originais || null
    }));
    window.operacoes = convertidas;
    window.operacoesOriginal = convertidas.slice();
    /* utils.js usa bindings globais léxicos, além das propriedades de window. */
    try { operacoes = convertidas; operacoesOriginal = convertidas.slice(); } catch (_) {}
    window.dadosBaseAtiva = convertidas;
    window.__CCO_PERIODO_ATUAL__ = periodo.periodo;

    const painelConvertido = (painelLinhas || []).map(item => ({
      servico: item.servico || "", nome_servico: item.nome_servico || "",
      acumulado_mes: numeroSeguro(item.acumulado_mes), medicao: item.medicao || "",
      previsto_mes: numeroSeguro(item.previsto), porcentagem_execucao: numeroSeguro(item.percentual_execucao),
      dias_acumulados: numeroSeguro(item.dias_acumulados), total_dias_mes: numeroSeguro(item.total_dias_mes),
      valor: numeroSeguro(item.valor_total), status: numeroSeguro(item.acumulado_mes) > 0 ? "Com dados" : "Sem dados"
    }));
    window.painelExecutivo = painelConvertido;
    window.painelExecutivoOriginal = painelConvertido.slice();
    try { painelExecutivo = painelConvertido; painelExecutivoOriginal = painelConvertido.slice(); } catch (_) {}
    window.painelExecutivoAtivo = painelConvertido;
  }

  async function carregarPeriodo(periodo) {
    if (!periodo) return false;
    if (cargaPromise?.chave === periodo.periodo) return cargaPromise.promise;
    const promise = (async () => {
      const [linhas, painelLinhas] = await Promise.all([
        buscarTodasOperacoes(periodo),
        buscarPainel(periodo)
      ]);
      publicarPeriodo(linhas, painelLinhas, periodo);
      return true;
    })();
    cargaPromise = { chave: periodo.periodo, promise };
    try { return await promise; } finally { if (cargaPromise?.promise === promise) cargaPromise = null; }
  }

  function preencherPeriodos(prefixo, periodos, preferido) {
    const anoEl = document.getElementById(`${prefixo}Ano`);
    const mesEl = document.getElementById(`${prefixo}Mes`);
    if (!anoEl || !mesEl || !periodos.length) return periodos[0];
    const escolhido = periodos.find(p => p.periodo === preferido) || periodos[0];
    const anos = [...new Set(periodos.map(p => p.ano))].sort((a,b) => b.localeCompare(a));
    anoEl.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join("");
    anoEl.value = escolhido.ano;
    const meses = periodos.filter(p => p.ano === escolhido.ano);
    mesEl.innerHTML = meses.map(p => `<option value="${p.mes}">${MESES[p.mes] || p.mes}</option>`).join("");
    mesEl.value = escolhido.mes;
    return escolhido;
  }

  async function selecionarPeriodo(prefixo) {
    const periodos = await obterPeriodos();
    const ano = document.getElementById(`${prefixo}Ano`)?.value;
    const mes = document.getElementById(`${prefixo}Mes`)?.value;
    return periodos.find(p => p.ano === ano && p.mes === mes) || periodos[0];
  }

  function preencherPainelPeriodos(periodos, preferido) {
    return preencherPeriodos("filtro", periodos, preferido);
  }

  async function iniciarPainel() {
    const periodos = await obterPeriodos();
    if (!periodos.length) return false;
    const escolhido = preencherPainelPeriodos(periodos, window.__CCO_PERIODO_ATUAL__);
    await carregarPeriodo(escolhido);
    window.atualizarDashboard?.();
    window.aplicarRestricoesPerfil?.();
    return true;
  }

  async function aplicarPainel() {
    const periodos = await obterPeriodos();
    const ano = document.getElementById("filtroAno")?.value;
    const mesEl = document.getElementById("filtroMes");
    const mesesAno = periodos.filter(p => p.ano === ano);
    if (mesEl && !mesesAno.some(p => p.mes === mesEl.value)) mesEl.value = mesesAno[0]?.mes || "";
    const escolhido = await selecionarPeriodo("filtro");
    preencherPainelPeriodos(periodos, escolhido?.periodo);
    await carregarPeriodo(escolhido);
    window.atualizarDashboard?.();
    return true;
  }

  async function iniciarExecucao() {
    const periodos = await obterPeriodos();
    const escolhido = preencherPeriodos("filtroExecucao", periodos, window.__CCO_PERIODO_ATUAL__);
    await carregarPeriodo(escolhido);
    window.filtroExecucaoAnoAtual = escolhido.ano;
    window.filtroExecucaoMesAtual = escolhido.mes;
    window.renderTabelaContratualMensal?.();
  }

  async function aplicarExecucao() {
    const periodos = await obterPeriodos();
    const ano = document.getElementById("filtroExecucaoAno")?.value;
    const atuaisAno = periodos.filter(p => p.ano === ano);
    const mesEl = document.getElementById("filtroExecucaoMes");
    if (mesEl && !atuaisAno.some(p => p.mes === mesEl.value)) mesEl.value = atuaisAno[0]?.mes || "";
    const escolhido = await selecionarPeriodo("filtroExecucao");
    preencherPeriodos("filtroExecucao", periodos, escolhido?.periodo);
    await carregarPeriodo(escolhido);
    window.filtroExecucaoAnoAtual = escolhido.ano;
    window.filtroExecucaoMesAtual = escolhido.mes;
    window.renderTabelaContratualMensal?.();
    const codigo = window.obterServicoAtivo?.();
    if (codigo && codigo !== "geral") window.renderDetalheServicoMensal?.(codigo);
  }

  async function iniciarKpi() {
    const periodos = await obterPeriodos();
    const escolhido = periodos[0];
    await carregarPeriodo(escolhido);
    window.carregarFiltrosKpiServicoCompleto?.();
    preencherKpiPeriodos(periodos, escolhido);
    return true; /* kpi.js faz a única primeira renderização após o await. */
  }

  function preencherKpiPeriodos(periodos, escolhido) {
    const anoEl = document.getElementById("filtroKpiAno");
    const mesEl = document.getElementById("filtroKpiMes");
    if (!anoEl || !mesEl || !escolhido) return;
    const anos = [...new Set(periodos.map(p => p.ano))].sort((a,b) => b.localeCompare(a));
    anoEl.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join("");
    anoEl.value = escolhido.ano;
    const meses = periodos.filter(p => p.ano === escolhido.ano);
    mesEl.innerHTML = meses.map(p => `<option value="${p.mes}">${MESES[p.mes] || p.mes}</option>`).join("");
    mesEl.value = escolhido.mes;
  }

  async function trocarKpi() {
    const periodos = await obterPeriodos();
    const ano = document.getElementById("filtroKpiAno")?.value;
    const mes = document.getElementById("filtroKpiMes")?.value;
    const periodo = periodos.find(p => p.ano === ano && p.mes === pad(mes)) || periodos.find(p => p.ano === ano) || periodos[0];
    if (periodo && periodo.periodo !== window.__CCO_PERIODO_ATUAL__) await carregarPeriodo(periodo);
    /* Recria os dias a partir das operações do mês recém-carregado. */
    window.carregarFiltrosKpiServicoCompleto?.();
    preencherKpiPeriodos(periodos, periodo);
    agendarRenderKpi();
  }

  function agendarRenderKpi() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      window.renderPaginaKpiPorServicoCompleto?.();
    });
  }

  async function carregarKpiMensalNovoBanco() {
    const cliente=db(); if(!cliente) return false;
    const {data,error}=await cliente.from("kpi_mensal").select("*")
      .order("ano",{ascending:true}).order("mes",{ascending:true}).order("servico",{ascending:true});
    if(error) { console.error("Erro ao carregar kpi_mensal do novo banco:",error); return false; }
    const convertido=(data||[]).map(item=>({
      ...item, ano:Number(item.ano), mes:Number(item.mes), servico:String(item.servico||"").toUpperCase(),
      peso_t:numeroSeguro(item.total_peso_t), viagens:numeroSeguro(item.total_viagens),
      km_total:numeroSeguro(item.total_km), equipes:0, tempo_produtivo:0,
      previsto:0, executado:numeroSeguro(item.total_peso_t || item.total_km || item.total_viagens), valor:0
    }));
    window.kpiMensal=convertido;
    try { kpiMensal=convertido; } catch(_) {}
    return true;
  }
  window.carregarKpiMensalSupabase=carregarKpiMensalNovoBanco;
  try { carregarKpiMensalSupabase=carregarKpiMensalNovoBanco; } catch(_) {}

  /* A planilha já é separada por data; esta camada torna a entrada idempotente antes do salvamento. */
  const salvarOriginal = window.salvarBaseCompletaSupabase;
  if (typeof salvarOriginal === "function") {
    const salvarIdempotente = async function(nomeArquivo) {
      const vistos = new Set();
      const baseImportada = (typeof operacoes !== "undefined" ? operacoes : window.operacoes) || [];
      window.operacoes = baseImportada.filter(item => {
        const chave = [item.servico,item.data_normalizada,item.turno,item.ra,item.setor,
          numeroSeguro(item.peso),numeroSeguro(item.viagens),numeroSeguro(item.km),
          numeroSeguro(item.equipe),numeroSeguro(item.executado)].join("|");
        if (vistos.has(chave)) return false;
        vistos.add(chave); return true;
      });
      window.operacoesOriginal = window.operacoes.slice();
      try { operacoes = window.operacoes; operacoesOriginal = window.operacoesOriginal; } catch (_) {}
      const ok = await salvarOriginal.call(this, nomeArquivo);
      if (ok) {
        periodosPromise = null;
        delete window.__CCO_IMPORTACAO_ATIVA__;
        delete window.__CCO_PERIODOS_REAIS_V12__;
        delete window.__CCO_IMPORTACOES_POR_PERIODO__;
        delete window.__CCO_CATALOGO_PERIODOS__;
      }
      return ok;
    };
    window.salvarBaseCompletaSupabase = salvarIdempotente;
    try { salvarBaseCompletaSupabase = salvarIdempotente; } catch (_) {}
  }

  if (PAGINA === "painel" || PAGINA === "index") {
    window.carregarBaseSupabase = iniciarPainel;
    window.inicializarPainelGeralAposLogin = iniciarPainel;
    window.carregarFiltrosPeriodoDisponiveis = () => obterPeriodos().then(ps => preencherPainelPeriodos(ps, window.__CCO_PERIODO_ATUAL__));
    window.aplicarFiltroPeriodoExecutivo = aplicarPainel;
    window.limparFiltroPeriodo = iniciarPainel;
    try {
      carregarBaseSupabase = iniciarPainel;
      inicializarPainelGeralAposLogin = iniciarPainel;
      aplicarFiltroPeriodoExecutivo = aplicarPainel;
      limparFiltroPeriodo = iniciarPainel;
    } catch (_) {}
  } else if (PAGINA === "execucao") {
    window.carregarBaseSupabase = iniciarExecucao;
    window.carregarFiltrosExecucaoMensal = () => obterPeriodos().then(ps => preencherPeriodos("filtroExecucao", ps, window.__CCO_PERIODO_ATUAL__));
    window.aplicarFiltroExecucaoMensal = aplicarExecucao;
    window.limparFiltroExecucaoMensal = iniciarExecucao;
    try { carregarBaseSupabase = iniciarExecucao; aplicarFiltroExecucaoMensal = aplicarExecucao; limparFiltroExecucaoMensal = iniciarExecucao; } catch (_) {}
  } else if (PAGINA === "kpi") {
    window.carregarBaseSupabase = iniciarKpi;
    window.ccoAgendarRenderKpi = trocarKpi;
    try { carregarBaseSupabase = iniciarKpi; } catch (_) {}

    /* Bloqueia chamadas históricas repetidas sem impedir uma nova combinação de filtros. */
    const renderOriginal = window.renderPaginaKpiPorServicoCompleto;
    if (typeof renderOriginal === "function") {
      let ultimaAssinatura = "";
      const renderUnico = function() {
        const assinatura = ["filtroKpiServico","filtroKpiAno","filtroKpiMes","filtroKpiDia"]
          .map(id => document.getElementById(id)?.value || "").join("|") +
          `|${window.__CCO_PERIODO_ATUAL__ || ""}|${(window.operacoesOriginal || []).length}`;
        if (assinatura === ultimaAssinatura) return;
        ultimaAssinatura = assinatura;
        return renderOriginal.apply(this, arguments);
      };
      window.renderPaginaKpiPorServicoCompleto = renderUnico;
      try { renderPaginaKpiPorServicoCompleto = renderUnico; } catch (_) {}
    }
  } else if (PAGINA === "dados") {
    const iniciarDadosNovoBanco=async function(){
      const periodos=await obterPeriodos();
      if(!periodos.length)return false;
      return carregarPeriodo(periodos[0]);
    };
    window.carregarBaseSupabase=iniciarDadosNovoBanco;
    try { carregarBaseSupabase=iniciarDadosNovoBanco; } catch(_) {}
  }

  /* index.html carrega scripts depois do DOMContentLoaded; conecta o input explicitamente. */
  if (PAGINA === "painel" || PAGINA === "index") {
    const input = document.getElementById("arquivoExcel");
    if (input && typeof window.importarPlanilhas === "function") {
      input.onchange = window.importarPlanilhas;
      input.dataset.ccoImportacaoConectada = "sim";
    }
  }
})();
