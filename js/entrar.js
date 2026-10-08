/* ==========================================================================
   entrar.html — entrar, criar conta, esqueci a senha e nova senha.
   ?next=pagina.html   volta para lá depois de entrar
   ?modo=cadastro      abre direto em "Criar conta"
   ?modo=confirmado    volta do e-mail de confirmação
   ?modo=nova-senha    volta do e-mail de recuperação
   ?modo=github        volta do login pelo GitHub
   ?modo=perfil        conta nova pelo GitHub: escolher o nome de usuário
   ?motivo=favoritos   explica por que pedimos login
   ========================================================================== */

(function initEntrar() {
  const params = new URLSearchParams(location.search);
  const next = safeNext(params.get("next"));
  const modo = params.get("modo");
  const $ = (id) => document.getElementById(id);
  const forms = { login: $("form-login"), signup: $("form-signup"), perfil: $("form-perfil"), forgot: $("form-forgot"), reset: $("form-reset") };
  const TITLES = {
    login: ["Sua conta", "Entrar", "Salve os gatos que você gostou e preencha a ficha de adoção mais rápido."],
    signup: ["Sua conta", "Criar conta", "Leva um minuto. Depois é só confirmar o e-mail."],
    perfil: ["Falta pouco", "Boas-vindas!", "Sua conta foi criada com o GitHub. Escolha o nome de usuário que vai aparecer no site."],
    forgot: ["Recuperar acesso", "Esqueci a senha", "Mandamos um link para você criar uma senha nova."],
    reset: ["Recuperar acesso", "Nova senha", "Escolha a senha nova da sua conta."],
  };
  let tabs;

  function notice(msg, kind = "") {
    const n = $("auth-notice");
    n.textContent = msg || "";
    n.className = "notice" + (kind ? " " + kind : "");
    n.hidden = !msg;
  }

  function show(view, { focus = true } = {}) {
    Object.entries(forms).forEach(([k, f]) => (f.hidden = k !== view));
    const [kicker, title, lede] = TITLES[view];
    $("auth-kicker").textContent = kicker;
    $("auth-h").textContent = title;
    $("auth-lede").textContent = lede;
    $("auth-tabs").hidden = $("auth-social").hidden = !(view === "login" || view === "signup");
    if (tabs && (view === "login" || view === "signup") && tabs.value !== view) tabs.select(view);
    if (focus) forms[view].querySelector("input")?.focus();
  }

  const goNext = () => (location.href = next || "conta.html");

  if (!sb) {
    notice("O login está indisponível no momento. Tente de novo mais tarde.", "warn");
    Object.values(forms).forEach((f) => (f.hidden = true));
    $("auth-social").hidden = true;
    return;
  }

  tabs = createSegmented($("auth-tabs"), [{ key: "login", label: "Entrar" }, { key: "signup", label: "Criar conta" }],
    modo === "cadastro" ? "signup" : "login", (key) => { if (forms[key].hidden) show(key); });
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

  if (params.get("motivo") === "favoritos") notice("Entre para salvar gatos nos seus favoritos.");
  show(modo === "cadastro" ? "signup" : "login", { focus: false });

  // ---------- GitHub ----------
  $("btn-github").addEventListener("click", async () => {
    const btn = $("btn-github");
    notice("");
    setBusy(btn, true, "Abrindo o GitHub…");
    const { error } = await sb.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: authRedirect("?modo=github" + (next ? "&next=" + encodeURIComponent(next) : "")) },
    });
    // Sem erro, o navegador já está indo para o GitHub
    if (error) {
      setBusy(btn, false);
      notice("Não deu para abrir o login pelo GitHub agora. Tente de novo em instantes.", "warn");
    }
  });

  // O GitHub (ou o Supabase) devolve erros na query ou no hash: ?error=access_denied&error_description=...
  const hash = new URLSearchParams(location.hash.slice(1));
  const oauthError = params.get("error") || hash.get("error");
  if (oauthError) {
    const desc = (params.get("error_description") || hash.get("error_description") || "").toLowerCase();
    notice(oauthError === "access_denied" && !desc.includes("database")
      ? "O login pelo GitHub foi cancelado. Você pode tentar de novo ou entrar com e-mail."
      : "Não foi possível entrar pelo GitHub. Tente de novo ou use e-mail e senha.", "warn");
    history.replaceState(null, "", location.pathname + (next ? "?next=" + encodeURIComponent(next) : ""));
  }

  // ---------- Volta dos e-mails ----------
  authReady.then(() => {
    if (modo === "nova-senha") {
      if (auth.user) { show("reset"); }
      else { show("forgot"); notice("Esse link expirou ou já foi usado. Peça um novo abaixo.", "warn"); }
      return;
    }
    if (auth.user && needsProfile()) {
      // Primeira vez pelo GitHub: sugere o nome que veio de lá, mas a pessoa decide
      const meta = auth.user.user_metadata || {};
      forms.perfil.nome.value = clean(auth.profile?.name || meta.full_name || meta.user_name || "").replace(/\s+/g, " ").trim().slice(0, 60);
      notice("");
      show("perfil");
      return;
    }
    if (auth.user) {
      if (modo === "confirmado") notice("E-mail confirmado! Você já está dentro.", "ok");
      if (modo === "github") notice(`Que bom te ver de novo${firstName(auth.profile) ? ", " + firstName(auth.profile) : ""}!`, "ok");
      setTimeout(goNext, modo === "confirmado" || modo === "github" ? 900 : 0);
    }
  });

  // ---------- Nome de usuário (conta nova pelo GitHub) ----------
  forms.perfil.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = forms.perfil;
    const nome = f.nome.value.trim().replace(/\s+/g, " ");
    if (nome.length < 2) return setFormError(f, "Escreva um nome de usuário com pelo menos 2 letras.", f.nome);
    if (/[<>"`]/.test(nome)) return setFormError(f, "O nome não pode ter os caracteres < > \" `.", f.nome);
    setFormError(f, "");
    const btn = f.querySelector("[type=submit]");
    setBusy(btn, true, "Salvando…");
    const r = await completeProfile(nome);
    setBusy(btn, false);
    if (r.error) return setFormError(f, "Não foi possível salvar agora. Tente de novo.");
    renderAccount();
    notice(`Tudo certo, ${nome.split(" ")[0]}! Sua conta está pronta.`, "ok");
    setTimeout(goNext, 900);
  });
  $("perfil-sair").addEventListener("click", signOut);
  // O link de recuperação também avisa por evento (quando o Supabase lê o link depois deste script)
  document.addEventListener("sv:auth", (e) => {
    if (e.detail.event === "PASSWORD_RECOVERY") show("reset");
  });

  // ---------- Entrar ----------
  let lastEmail = "";
  forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = forms.login;
    const email = f.email.value.trim().toLowerCase();
    const senha = $("login-senha").value;
    $("resend").hidden = true;
    if (!EMAIL_RE.test(email)) return setFormError(f, "Escreva um e-mail válido.", f.email);
    if (!senha) return setFormError(f, "Escreva a sua senha.", $("login-senha"));
    setFormError(f, "");
    const btn = f.querySelector("[type=submit]");
    setBusy(btn, true, "Entrando…");
    const r = await signInWithEmail(email, senha);
    setBusy(btn, false);
    if (r.error) {
      setFormError(f, r.error, r.unconfirmed ? null : $("login-senha"));
      lastEmail = email;
      $("resend").hidden = !r.unconfirmed;
      return;
    }
    goNext();
  });

  $("resend").addEventListener("click", async () => {
    const btn = $("resend");
    setBusy(btn, true, "Enviando…");
    const { error } = await sb.auth.resend({ type: "signup", email: lastEmail, options: { emailRedirectTo: authRedirect("?modo=confirmado") } });
    setBusy(btn, false);
    notice(error ? "Não deu para reenviar agora. Espere alguns minutos." : `Reenviamos o link para ${lastEmail}.`, error ? "warn" : "ok");
  });

  // ---------- Criar conta ----------
  forms.signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = forms.signup;
    const nome = f.nome.value.trim().replace(/\s+/g, " ");
    const email = f.email.value.trim().toLowerCase();
    const s1 = $("signup-senha").value, s2 = $("signup-senha2").value;
    if (nome.length < 2) return setFormError(f, "Escreva o seu nome.", f.nome);
    if (/[<>"`]/.test(nome)) return setFormError(f, "O nome não pode ter os caracteres < > \" `.", f.nome);
    if (!EMAIL_RE.test(email)) return setFormError(f, "Escreva um e-mail válido.", f.email);
    if (!validPassword(s1)) return setFormError(f, PASSWORD_RULE, $("signup-senha"));
    if (s1 !== s2) return setFormError(f, "As duas senhas estão diferentes.", $("signup-senha2"));
    setFormError(f, "");
    const btn = f.querySelector("[type=submit]");
    setBusy(btn, true, "Criando…");
    const { data, error } = await sb.auth.signUp({
      email, password: s1,
      options: { data: authNameData(nome), emailRedirectTo: authRedirect("?modo=confirmado" + (next ? "&next=" + encodeURIComponent(next) : "")) },
    });
    setBusy(btn, false);
    if (error) {
      const code = error.code || "";
      if (code === "user_already_exists" || /already registered/i.test(error.message)) return setFormError(f, "Esse e-mail já tem conta. Entre ou recupere a senha.", f.email);
      if (code === "weak_password") return setFormError(f, PASSWORD_RULE, $("signup-senha"));
      if (code === "over_email_send_rate_limit") return setFormError(f, "O limite de e-mails de confirmação desta hora acabou. Use “Continuar com GitHub” acima ou tente de novo mais tarde.");
      if (error.status === 429 || code.includes("rate_limit")) return setFormError(f, "Muitos cadastros seguidos. Espere alguns minutos e tente de novo.");
      if (code === "email_address_not_authorized") return setFormError(f, "Não conseguimos enviar o e-mail de confirmação para esse endereço. Use “Continuar com GitHub” acima.");
      return setFormError(f, "Não foi possível criar a conta agora. Tente de novo em instantes.");
    }
    // Com confirmação de e-mail ligada, um e-mail já cadastrado volta sem "identities"
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return setFormError(f, "Esse e-mail já tem conta. Entre ou recupere a senha.", f.email);
    }
    if (data.session) return goNext(); // confirmação desligada no projeto: já entra
    // E-mail que já tinha um cadastro esperando confirmação: o Supabase reenvia o link mas
    // NÃO troca a senha — ela continua a do primeiro cadastro. Sem este aviso, a pessoa tenta
    // entrar com a senha nova e recebe "senha incorreta" para sempre.
    const criadoEm = Date.parse(data.user?.created_at || "");
    if (criadoEm && Date.now() - criadoEm > 2 * 60 * 1000) {
      f.reset();
      show("login", { focus: false });
      forms.login.email.value = email;
      lastEmail = email;
      $("resend").hidden = false;
      return notice(`Esse e-mail já tinha um cadastro esperando confirmação, e a senha dele é a do primeiro cadastro (não a que você acabou de digitar). Confirme pelo link que reenviamos para ${email}, ou use “Esqueci minha senha” para criar uma nova.`, "warn");
    }
    f.reset();
    show("login", { focus: false });
    notice(`Quase lá! Enviamos um link para ${email}. Abra o e-mail e confirme para entrar (veja também o spam).`, "ok");
    forms.login.email.value = email;
  });

  // ---------- Esqueci a senha ----------
  forms.forgot.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = forms.forgot;
    const email = f.email.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return setFormError(f, "Escreva um e-mail válido.", f.email);
    setFormError(f, "");
    const btn = f.querySelector("[type=submit]");
    setBusy(btn, true, "Enviando…");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: authRedirect("?modo=nova-senha") });
    setBusy(btn, false);
    if (error && (error.status === 429 || (error.code || "").includes("rate_limit"))) {
      return setFormError(f, "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.");
    }
    // Mesma resposta exista ou não a conta (não revela quem tem cadastro)
    show("login", { focus: false });
    notice(`Se houver uma conta com ${email}, você vai receber um link para criar uma senha nova.`, "ok");
  });

  // ---------- Nova senha ----------
  forms.reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = forms.reset;
    const s1 = $("reset-senha").value, s2 = $("reset-senha2").value;
    if (!validPassword(s1)) return setFormError(f, PASSWORD_RULE, $("reset-senha"));
    if (s1 !== s2) return setFormError(f, "As duas senhas estão diferentes.", $("reset-senha2"));
    setFormError(f, "");
    const btn = f.querySelector("[type=submit]");
    setBusy(btn, true, "Salvando…");
    const { error } = await sb.auth.updateUser({ password: s1 });
    setBusy(btn, false);
    if (error) {
      if ((error.code || "") === "weak_password") return setFormError(f, PASSWORD_RULE, $("reset-senha"));
      if ((error.code || "") === "same_password") return setFormError(f, "A senha nova precisa ser diferente da antiga.", $("reset-senha"));
      return setFormError(f, "Não foi possível salvar. Peça um novo link e tente de novo.");
    }
    notice("Senha trocada! Levando você para a sua conta…", "ok");
    setTimeout(goNext, 900);
  });
})();
