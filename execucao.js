/* Execução P1 a P12 - carregamento completo, sem corte e sem delay. */
(function iniciarPaginaExecucao(){
  window.CCO_PAGE = "execucao";

  async function iniciar(){
    try {
      if ((!window.operacoesOriginal || !window.operacoesOriginal.length) && typeof carregarBaseSupabase === "function") {
        await carregarBaseSupabase();
      }
      if (typeof carregarFiltrosExecucaoMensal === "function") carregarFiltrosExecucaoMensal();
      if (typeof carregarFiltroMesesComparativoExecucao === "function") carregarFiltroMesesComparativoExecucao();
      if (typeof renderComparativoMesesExecucao === "function") renderComparativoMesesExecucao();
      if (typeof renderTabelaContratualMensal === "function") renderTabelaContratualMensal();
    } catch (erro) {
      console.error("Erro ao iniciar Execução P1 a P12:", erro);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
