document.addEventListener("DOMContentLoaded", () => {
  const usuarioSalvo = localStorage.getItem("ultimoUsuarioCCO");
  if (usuarioSalvo) {
    document.getElementById("usuario").value = usuarioSalvo;
    document.getElementById("lembrarUsuario").checked = true;
  }
});

function obterPerfil(usuario) {
  if (usuario === "admin") return "Administrador";
  if (usuario === "cco") return "Operador";
  if (usuario === "diretoria") return "Diretoria";
  return "Usuário";
}

async function entrar() {
  const usuario = document.getElementById("usuario").value.trim().toLowerCase();
  const senha = document.getElementById("senha").value.trim();
  const lembrar = document.getElementById("lembrarUsuario").checked;
  const erro = document.getElementById("erro");
  erro.textContent = "";
  if (!usuario || !senha) { erro.textContent = "Informe usuário e senha."; return; }

  const cliente = window.supabaseClient || window.banco;
  if (!cliente?.auth) { erro.textContent = "Cliente Supabase indisponível."; return; }
  const email = `${usuario}@cco.local`;
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error || !data?.user) {
    console.error("Erro Supabase Auth:", { message:error?.message, code:error?.code });
    erro.textContent = error?.message || "Usuário ou senha inválidos.";
    return;
  }

  const nome = data.user.user_metadata?.nome || data.user.user_metadata?.name ||
    data.user.user_metadata?.full_name || usuario || data.user.email;
  const perfil = data.user.user_metadata?.perfil || data.user.user_metadata?.role || obterPerfil(usuario);
  localStorage.setItem("usuario_nome", nome || data.user.email);
  localStorage.setItem("usuario_perfil", perfil || "Usuário");
  localStorage.setItem("usuarioLogado", JSON.stringify({ id:data.user.id, usuario:nome, email:data.user.email, perfil }));
  if (lembrar) localStorage.setItem("ultimoUsuarioCCO", usuario);
  else localStorage.removeItem("ultimoUsuarioCCO");
  window.location.href = "index.html";
}
