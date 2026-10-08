/* ==========================================================================
   Supabase: cliente, gatos do banco, sessão, favoritos e o botão de conta
   no cabeçalho de todas as páginas.
   Sem Supabase configurado (ou fora do ar), o site segue com os gatos de js/data.js.
   ========================================================================== */

const sb = window.supabase && SITE.supabaseUrl && SITE.supabaseKey
  ? window.supabase.createClient(SITE.supabaseUrl, SITE.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

function escapeHTML(text) {
  return String(text ?? "").replace(/[&<>"'`]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[ch]));
}
// Textos vindos do banco viram HTML nas páginas: tira o que poderia abrir uma tag ou atributo
// (o banco também recusa esses caracteres; isto é a segunda barreira)
const clean = (s) => String(s ?? "").replace(/[<>"`]/g, "");

// ---------- Gatos ----------

const PATTERN_FLAG = { tigrado: "tabby", frajola: "tux", tricolor: "tri", siames: "siam" };

// Linha da tabela cats → objeto usado pelo site (mesmo formato de js/data.js)
function catFromRow(r) {
  const look = { fur: r.fur, eye: r.eye };
  if (r.stripe) look.stripe = r.stripe;
  if (PATTERN_FLAG[r.pattern]) look[PATTERN_FLAG[r.pattern]] = true;
  return {
    id: r.id, code: clean(r.code), name: clean(r.name), sex: r.sex, age: clean(r.age), group: r.age_group,
    blurb: clean(r.blurb), vac: clean(r.vac), since: r.since, energy: r.energy, traits: (r.traits || []).map(clean),
    kids: r.with_kids, dogs: r.with_dogs, cats: r.with_cats,
    look, pattern: r.pattern, photo: r.photo, focus: r.focus, position: r.position,
  };
}

let catsSource = "site";
async function loadCats() {
  if (sb) {
    try {
      const { data, error } = await sb.from("cats").select("*").order("position", { ascending: true }).order("created_at");
      if (error) throw error;
      CATS.splice(0, CATS.length, ...data.map(catFromRow));
      catsSource = "banco";
    } catch (e) {
      console.warn("Gatos do banco indisponíveis; usando a lista do site.", e?.message || e);
    }
  }
  computeLongestWait();
  return CATS;
}

// ---------- Sessão ----------

const auth = { user: null, profile: null };
// "master" (Admin Mestre) é administrador e também pode tirar o acesso de outros administradores
const isAdmin = () => ["admin", "master"].includes(auth.profile?.role);
const isMaster = () => auth.profile?.role === "master";

async function loadProfile() {
  if (!auth.user) { auth.profile = null; return; }
  const { data } = await sb.from("profiles").select("id, name, email, role, created_at").eq("id", auth.user.id).maybeSingle();
  auth.profile = data ? { ...data, name: clean(data.name) } : { id: auth.user.id, name: "", email: auth.user.email, role: "user" };
}

// Conta sem senha no site (entrou só pelo GitHub)
const hasPassword = () => (auth.user?.app_metadata?.providers || [auth.user?.app_metadata?.provider]).includes("email");

// Conta nova criada pelo GitHub que ainda não escolheu o nome de usuário.
// Quem se cadastrou por e-mail já digitou o nome no formulário; a marca fica em user_metadata.
const needsProfile = () => !!auth.user && auth.user.app_metadata?.provider !== "email" && !auth.user.user_metadata?.sv_perfil;

// Nome também nos metadados do Auth: é de lá que o painel do Supabase tira o "Display name"
// (o site usa profiles.name; isto só mantém os dois iguais)
const authNameData = (nome) => ({ name: nome, full_name: nome, display_name: nome });

async function completeProfile(nome) {
  const { error } = await sb.from("profiles").update({ name: nome }).eq("id", auth.user.id);
  if (error) return { error };
  const r = await sb.auth.updateUser({ data: { ...authNameData(nome), sv_perfil: true } });
  if (r.error) return { error: r.error };
  auth.user = r.data.user;
  auth.profile = { ...auth.profile, name: nome };
  return { ok: true };
}

// Resolve quando já se sabe se há alguém logado (e o perfil dessa pessoa)
const authReady = (async () => {
  if (!sb) return auth;
  try {
    const { data } = await sb.auth.getSession();
    auth.user = data.session?.user || null;
    await loadProfile();
  } catch (e) {
    console.warn("Sessão indisponível:", e?.message || e);
  }
  return auth;
})();

if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return; // já tratado em authReady
    // Fora do callback: chamadas ao Supabase dentro dele podem travar a sessão
    setTimeout(async () => {
      auth.user = session?.user || null;
      await loadProfile();
      await loadFavorites();
      renderAccount();
      document.dispatchEvent(new CustomEvent("sv:auth", { detail: { event } }));
    }, 0);
  });
}

// Builders do Supabase só executam com then/await: este dispara sem esperar nem quebrar a página
const fireAndForget = (q) => q.then(() => {}, () => {});

// Login por e-mail e senha (usado em entrar.html e no acesso do painel)
async function signInWithEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const code = error.code || "";
    const msg = (error.message || "").toLowerCase();
    if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
      fireAndForget(sb.rpc("log_auth_event", { p_event: "falha", p_email: email }));
      return { error: "E-mail ou senha incorretos. Se você criou a conta há pouco e cadastrou esse e-mail mais de uma vez, vale a senha do primeiro cadastro — ou use “Esqueci minha senha”." };
    }
    if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
      return { error: "Falta confirmar o seu e-mail. Abra a mensagem que enviamos (veja também o spam).", unconfirmed: true };
    }
    if (error.status === 429 || code.includes("rate_limit")) {
      return { error: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo." };
    }
    return { error: "Não foi possível entrar agora. Confira a conexão e tente de novo." };
  }
  fireAndForget(sb.rpc("log_auth_event", { p_event: "login" })); // o banco ignora se o gatilho já registrou
  auth.user = data.user;
  await loadProfile();
  return { ok: true };
}

// Endereço de volta dos e-mails (confirmação e nova senha): mesma pasta da página atual
const authRedirect = (query) => new URL("entrar.html" + query, location.href).href;

// Só aceita voltar para uma página do próprio site (evita redirecionar para fora)
function safeNext(n) {
  return n && /^[a-z0-9-]+\.html([?#][^\s<>"]*)?$/i.test(n) ? n : null;
}

const firstName = (p) => (p?.name || p?.email || "").split(/[\s@]/)[0];
// Página atual como "next" do login (só caminho relativo do próprio site)
const hereForLogin = () => encodeURIComponent((location.pathname.split("/").pop() || "index.html") + location.search + location.hash);

async function signOut() {
  try { await sb.rpc("log_auth_event", { p_event: "saida" }); } catch {}
  await sb.auth.signOut();
  location.href = "index.html";
}

// ---------- Favoritos ----------

let favorites = new Set();
async function loadFavorites() {
  favorites = new Set();
  if (sb && auth.user) {
    const { data } = await sb.from("favorites").select("cat_id");
    (data || []).forEach((r) => favorites.add(r.cat_id));
  }
  syncFavButtons();
}

// Coração de favorito (o clique é tratado abaixo; sem login, leva para entrar)
function favButton(c) {
  return `<button class="fav" type="button" data-fav="${c.id}" aria-pressed="false" aria-label="Salvar nos favoritos" title="${escapeHTML(c.name)} nos favoritos">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
  </button>`;
}

function syncFavButtons(root = document) {
  root.querySelectorAll("[data-fav]").forEach((b) => {
    const on = favorites.has(b.dataset.fav);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", `${on ? "Tirar dos" : "Salvar nos"} favoritos`);
  });
}

async function toggleFavorite(id) {
  if (!auth.user) {
    location.href = `entrar.html?motivo=favoritos&next=${hereForLogin()}`;
    return;
  }
  const on = !favorites.has(id);
  on ? favorites.add(id) : favorites.delete(id); // otimista; desfaz se o banco recusar
  syncFavButtons();
  const { error } = on
    ? await sb.from("favorites").insert({ cat_id: id })
    : await sb.from("favorites").delete().eq("cat_id", id).eq("user_id", auth.user.id);
  if (error) {
    on ? favorites.delete(id) : favorites.add(id);
    syncFavButtons();
    showToast("Não deu para salvar agora. Tente de novo.");
    return;
  }
  showToast(on ? "Salvo nos seus favoritos" : "Tirado dos favoritos");
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fav]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  toggleFavorite(b.dataset.fav);
});

// ---------- Formulários de conta (entrar, minha conta, painel) ----------

const EMAIL_RE = /^[^@\s<>"'`]+@[^@\s<>"'`]+\.[^@\s<>"'`]+$/;
// Regra de senha (cadastro, nova senha e troca): 8+ caracteres, 1 maiúscula, 1 número, 1 especial.
// Espaço não conta como especial; letras acentuadas contam como letras.
const PASSWORD_RULE = "A senha precisa de pelo menos 8 caracteres, com 1 letra maiúscula, 1 número e 1 caractere especial (como ! @ # $ %).";
const validPassword = (p) => p.length >= 8 && p.length <= 72 && /\p{Lu}/u.test(p) && /\p{N}/u.test(p) && /[^\p{L}\p{N}\s]/u.test(p);

function setFormError(form, msg, field) {
  const box = form.querySelector(".error");
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  if (box) { box.textContent = msg || ""; box.hidden = !msg; }
  if (msg && field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
}

function setBusy(btn, busy, busyLabel = "Aguarde…") {
  // Guarda o HTML (não só o texto) para não perder ícones do botão
  if (busy) { btn.dataset.label = btn.innerHTML; btn.textContent = busyLabel; }
  else if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  btn.disabled = busy;
  btn.setAttribute("aria-busy", String(busy));
}

// Olho de mostrar/esconder senha
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-toggle-pwd]");
  if (!b) return;
  const input = document.getElementById(b.dataset.togglePwd);
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  b.setAttribute("aria-pressed", String(show));
  b.setAttribute("aria-label", show ? "Esconder senha" : "Mostrar senha");
});

// ---------- Aviso rápido ----------

let toastTimer;
function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------- Botão de conta no cabeçalho ----------

const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`;

function renderAccount() {
  const slot = document.querySelector("[data-account]");
  if (!slot) return;
  if (!sb) { slot.hidden = true; return; }

  if (!auth.user) {
    slot.innerHTML = `<a class="account-btn" href="entrar.html?next=${hereForLogin()}">${ICON_USER}<span>Entrar</span></a>`;
    return;
  }
  const p = auth.profile || {};
  slot.innerHTML = `
    <button class="account-btn" type="button" aria-expanded="false" aria-controls="account-menu">
      <span class="avatar" aria-hidden="true">${escapeHTML(firstName(p).charAt(0).toUpperCase() || "?")}</span>
      <span>${escapeHTML(firstName(p)) || "Conta"}</span>
    </button>
    <div class="account-menu" id="account-menu" hidden>
      <div class="who"><b>${escapeHTML(p.name || "Sua conta")}</b><span>${escapeHTML(p.email || auth.user.email || "")}</span></div>
      <a href="conta.html">Minha conta e favoritos</a>
      ${isAdmin() ? `<a href="admin.html">Painel de administração</a>` : ""}
      <button type="button" data-signout>Sair</button>
    </div>`;
  const btn = slot.querySelector(".account-btn");
  const menu = slot.querySelector(".account-menu");
  const setOpen = (open) => { menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", () => setOpen(menu.hidden));
  slot.querySelector("[data-signout]").addEventListener("click", signOut);
  document.addEventListener("click", (e) => { if (!slot.contains(e.target)) setOpen(false); });
  slot.addEventListener("keydown", (e) => { if (e.key === "Escape") { setOpen(false); btn.focus(); } });
}

authReady.then(async () => {
  renderAccount();
  await loadFavorites();
});

// Conta nova pelo GitHub sem nome de usuário: termina o cadastro antes de usar o site
authReady.then(() => {
  if (needsProfile() && !/(^|\/)entrar\.html$/.test(location.pathname)) {
    location.replace(`entrar.html?modo=perfil&next=${hereForLogin()}`);
    return; // a página continua escondida até trocar
  }
  document.documentElement.classList.remove("auth-wait");
});
