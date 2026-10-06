/* ==========================================================================
   conta.html — favoritos, nome e senha de quem está logado.
   ========================================================================== */

(async function initConta() {
  const $ = (id) => document.getElementById(id);
  if (!sb) { location.href = "index.html"; return; }
  await authReady;
  if (!auth.user) { location.replace("entrar.html?next=conta.html"); return; }

  const p = auth.profile || {};
  const desde = p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "";
  $("conta-h").textContent = `Olá, ${firstName(p) || "tudo bem"}!`;
  $("conta-sub").textContent = [p.email || auth.user.email, desde && `conta criada em ${desde}`].filter(Boolean).join(" · ");
  $("conta-actions").innerHTML = `
    ${isAdmin() ? `<a class="btn btn-primary" href="admin.html">Painel de administração</a>` : ""}
    <button class="btn btn-ghost" type="button" id="conta-sair">Sair</button>`;
  $("conta-sair").addEventListener("click", signOut);

  // ---------- Favoritos ----------
  await loadCats();
  await loadFavorites();

  function renderFavs() {
    const list = CATS.filter((c) => favorites.has(c.id));
    $("fav-count").textContent = list.length ? `${list.length} ${list.length === 1 ? "gato" : "gatos"}` : "";
    $("fav-list").innerHTML = list.length
      ? list.map((c) => `
          <article class="fav-card">
            <div class="fav-photo">${photoBox(c, "fv-" + c.id)}${favButton(c)}</div>
            <div class="fav-body">
              <span class="mono">${escapeHTML(c.code)} · ${GROUP_LABEL[c.group]}</span>
              <h3>${escapeHTML(c.name)}</h3>
              <p class="hint">${escapeHTML(c.age)} · esperando ${waitLabel(c)}</p>
              <a class="btn btn-primary btn-sm" href="index.html#gato-${c.id}">Ver ficha</a>
            </div>
          </article>`).join("")
      : `<div class="empty-state">
           <p>Nenhum favorito ainda. Toque no coração de um gato para guardar aqui.</p>
           <a class="btn btn-ghost btn-sm" href="index.html#gatos">Ver os gatos</a>
         </div>`;
    syncFavButtons($("fav-list"));
    loadAllPhotos();
  }
  renderFavs();
  // Tirou dos favoritos aqui mesmo: some da lista logo depois do aviso
  $("fav-list").addEventListener("click", (e) => {
    if (e.target.closest("[data-fav]")) setTimeout(renderFavs, 250);
  });

  // ---------- Nome ----------
  const fn = $("form-name");
  fn.nome.value = p.name || "";
  $("conta-email").value = p.email || auth.user.email || "";
  fn.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = fn.nome.value.trim().replace(/\s+/g, " ");
    if (nome.length < 2) return setFormError(fn, "Escreva o seu nome.", fn.nome);
    if (/[<>"`]/.test(nome)) return setFormError(fn, "O nome não pode ter os caracteres < > \" `.", fn.nome);
    setFormError(fn, "");
    const btn = fn.querySelector("[type=submit]");
    setBusy(btn, true, "Salvando…");
    const { error } = await sb.from("profiles").update({ name: nome }).eq("id", auth.user.id);
    setBusy(btn, false);
    if (error) return setFormError(fn, "Não foi possível salvar agora. Tente de novo.");
    auth.profile = { ...auth.profile, name: nome };
    $("conta-h").textContent = `Olá, ${firstName(auth.profile)}!`;
    renderAccount();
    showToast("Nome salvo");
  });

  // ---------- Senha ----------
  const fp = $("form-password");
  fp.addEventListener("submit", async (e) => {
    e.preventDefault();
    const s1 = $("nova-senha").value, s2 = $("nova-senha2").value;
    if (!validPassword(s1)) return setFormError(fp, "A senha precisa de pelo menos 8 caracteres, com letras e números.", $("nova-senha"));
    if (s1 !== s2) return setFormError(fp, "As duas senhas estão diferentes.", $("nova-senha2"));
    setFormError(fp, "");
    const btn = fp.querySelector("[type=submit]");
    setBusy(btn, true, "Trocando…");
    const { error } = await sb.auth.updateUser({ password: s1 });
    setBusy(btn, false);
    if (error) {
      const code = error.code || "";
      if (code === "same_password") return setFormError(fp, "A senha nova precisa ser diferente da atual.", $("nova-senha"));
      if (code === "reauthentication_needed") return setFormError(fp, "Por segurança, saia e entre de novo antes de trocar a senha.");
      return setFormError(fp, "Não foi possível trocar a senha agora. Tente de novo.");
    }
    fp.reset();
    showToast("Senha trocada");
  });
})();
