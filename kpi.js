/* KPI • inicialização única e renderização rápida. */
(function iniciarPaginaKpiRapida(){
  window.CCO_PAGE = "kpi";

  function executarQuandoLivre(fn){
    if ("requestIdleCallback" in window) {
      requestIdleCallback(fn, { timeout: 1800 });
    } else {
      setTimeout(fn, 250);
    }
  }

  async function iniciar(){
    if (window.__CCO_KPI_INIT_PROMISE__) return window.__CCO_KPI_INIT_PROMISE__;

    window.__CCO_KPI_INIT_PROMISE__ = (async () => {
      try {
        if (typeof atualizarData === "function") atualizarData();
        if (typeof aplicarRestricoesPerfil === "function") aplicarRestricoesPerfil();
        if (typeof preencherTexto === "function") {
          preencherTexto("nomeArquivo", "🔄 Carregando período do KPI...");
        }

        const temBase = Array.isArray(window.operacoesOriginal) && window.operacoesOriginal.length > 0;
        if (!temBase && typeof carregarBaseSupabase === "function") {
          const ok = await carregarBaseSupabase();
          if (!ok && typeof carregarResumoLocal === "function") carregarResumoLocal();
        }

        if (typeof carregarFiltrosKpiServicoCompleto === "function") {
          carregarFiltrosKpiServicoCompleto();
        }

        await new Promise(resolve => requestAnimationFrame(resolve));
        if (typeof renderPaginaKpiPorServicoCompleto === "function") {
          renderPaginaKpiPorServicoCompleto();
        }

        /* A tabela mensal é complementar. Ela não bloqueia a primeira tela. */
        executarQuandoLivre(async () => {
          try {
            if (typeof carregarKpiMensalSupabase === "function") {
              await carregarKpiMensalSupabase();
            }
          } catch (erro) {
            console.warn("KPI mensal em segundo plano não carregou:", erro);
          }
        });
      } catch (error) {
        console.error("Erro ao iniciar KPI:", error);
        if (typeof preencherTexto === "function") {
          preencherTexto("nomeArquivo", "❌ Não foi possível carregar o KPI.");
        }
      }
    })();

    return window.__CCO_KPI_INIT_PROMISE__;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once:true });
  } else {
    iniciar();
  }
})();
