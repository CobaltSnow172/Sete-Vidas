/* ==========================================================================
   admin.html — acesso restrito + painel (gatos, usuários, registro de acessos).
   Toda escrita passa pelas regras do banco (RLS): mesmo que alguém burle esta
   página, só uma conta com role = 'admin' ou 'master' consegue gravar.
   ========================================================================== */

(async function initAdmin() {
  const $ = (id) => document.getElementById(id);
  const esc = escapeHTML;
  const gate = $("gate"), panel = $("panel");

  if (!sb) {
    gate.hidden = false;
    $("form-admin-login").hidden = true;
    $("gate-lede").textContent = "O painel está indisponível: o Supabase não está configurado em js/config.js.";
    return;
  }

  // ======================================================================
  // Acesso
  // ======================================================================

  function showGate() {
    panel.hidden = true;
    gate.hidden = false;
    $("form-admin-login").hidden = false;
    $("gate-denied").hidden = true;
    $("gate-h").textContent = "Acesso restrito";
    $("gate-lede").textContent = "Entre com uma conta de administrador para cadastrar, editar e remover gatos.";
  }

  function showDenied() {
    panel.hidden = true;
    gate.hidden = false;
    $("form-admin-login").hidden = true;
    $("gate-denied").hidden = false;
    $("gate-h").textContent = "Sem acesso ao painel";
    $("gate-lede").textContent = "";
    $("gate-denied").querySelector(".notice").textContent =
      `A conta ${auth.profile?.email || auth.user?.email || ""} não é de administrador. Peça a um administrador para liberar o acesso.`;
  }

  function route() {
    if (!auth.user) return showGate();
    if (!isAdmin()) return showDenied();
    gate.hidden = true;
    panel.hidden = false;
    initPanel();
  }

  $("form-admin-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = f.email.value.trim().toLowerCase();
    const senha = $("admin-senha").value;
    if (!EMAIL_RE.test(email)) return setFormError(f, "Escreva um e-mail válido.", f.email);
    if (!senha) return setFormError(f, "Escreva a senha.", $("admin-senha"));
    setFormError(f, "");
    const btn = f.querySelector("[type=submit]");
    setBusy(btn, true, "Entrando…");
    const r = await signInWithEmail(email, senha);
    setBusy(btn, false);
    if (r.error) return setFormError(f, r.error, $("admin-senha"));
    renderAccount();
    route();
  });

  document.querySelector("[data-signout-gate]").addEventListener("click", async () => {
    try { await sb.rpc("log_auth_event", { p_event: "saida" }); } catch {}
    await sb.auth.signOut();
    auth.user = null;
    auth.profile = null;
    renderAccount();
    showGate();
    $("admin-email").focus();
  });

  // ======================================================================
  // Painel
  // ======================================================================

  let panelReady = false;
  const loaded = {};

  function initPanel() {
    if (panelReady) return;
    panelReady = true;
    const VIEWS = { gatos: $("view-gatos"), usuarios: $("view-usuarios"), acessos: $("view-acessos") };
    const start = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "gatos";
    createSegmented($("admin-tabs"), [
      { key: "gatos", label: "Gatos" },
      { key: "usuarios", label: "Usuários" },
      { key: "acessos", label: "Acessos" },
    ], start, (key) => {
      Object.entries(VIEWS).forEach(([k, v]) => (v.hidden = k !== key));
      history.replaceState(null, "", "#" + key);
      if (!loaded[key]) { loaded[key] = true; ({ gatos: refreshCats, usuarios: loadUsers, acessos: loadLog })[key](); }
    });
    initCats();
    initLog();
  }

  // ======================================================================
  // Gatos: lista
  // ======================================================================

  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const STORAGE_MARK = "/storage/v1/object/public/cat-photos/";
  const isStoragePhoto = (p) => typeof p === "string" && p.includes(STORAGE_MARK);
  const canWrite = () => catsSource === "banco";

  async function refreshCats() {
    await loadCats();
    await resolvePhotos().catch(() => {});
    $("cat-source").textContent = canWrite()
      ? `${CATS.length} ${CATS.length === 1 ? "gato cadastrado" : "gatos cadastrados"}`
      : "O banco ainda não respondeu: mostrando a lista do site, só para leitura. Aplique a migração do Supabase.";
    $("cat-new").disabled = !canWrite();
    renderRows();
  }

  function renderRows() {
    const q = fold($("cat-search").value.trim());
    const list = CATS.filter((c) => !q || fold(`${c.name} ${c.code}`).includes(q));
    $("cat-rows").innerHTML = list.length ? list.map((c) => `
      <li class="cat-row">
        <div class="thumb">${photoBox(c, "ad-" + c.id)}</div>
        <div class="info">
          <b>${esc(c.name)}</b>
          <span class="mono">${esc(c.code)} · ${GROUP_LABEL[c.group] || ""} · ${esc(c.sex)} · ${esc(c.age)}</span>
          <span class="hint">No lar temporário ${waitLabel(c)} · ${esc(c.traits.join(", "))}</span>
        </div>
        <div class="row-actions">
          <a class="btn btn-ghost btn-sm" href="index.html#gato-${c.id}" target="_blank" rel="noopener">Ver no site</a>
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${c.id}" ${canWrite() ? "" : "disabled"}>Editar</button>
          <button class="btn btn-danger-ghost btn-sm" type="button" data-del="${c.id}" ${canWrite() ? "" : "disabled"}>Remover</button>
        </div>
      </li>`).join("")
      : `<li class="empty-state"><p>${q ? "Nenhum gato com esse nome ou código." : "Nenhum gato cadastrado ainda."}</p></li>`;
    loadAllPhotos();
  }

  function initCats() {
    $("cat-search").addEventListener("input", renderRows);
    $("cat-new").addEventListener("click", () => openEditor(null));
    $("cat-rows").addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (ed) openEditor(CATS.find((c) => c.id === ed.dataset.edit));
      if (del) askDelete(CATS.find((c) => c.id === del.dataset.del));
    });
    initEditor();
    initConfirm();
  }

  // ======================================================================
  // Gatos: cadastro e edição
  // ======================================================================

  const editor = $("editor");
  const form = $("cat-form");
  const saveBtn = $("editor-save");
  let editing = null;            // gato em edição (null = novo)
  let newPhoto = null;           // { small, large, url } gerados no navegador
  let focus = { x: 50, y: 50 };  // ponto do rosto, em %
  let dirty = false;

  const field = (name) => form.elements.namedItem(name);
  const checked = (name) => form.querySelector(`[name="${name}"]:checked`)?.value;
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

  function lookFromForm() {
    const pattern = $("e-pattern").value;
    const look = { fur: $("e-fur").value.toUpperCase(), eye: $("e-eye").value.toUpperCase() };
    if (pattern === "tigrado") look.stripe = $("e-stripe").value.toUpperCase();
    if (PATTERN_FLAG[pattern]) look[PATTERN_FLAG[pattern]] = true;
    return look;
  }

  function updateIllus() {
    $("e-stripe-field").hidden = $("e-pattern").value !== "tigrado";
    $("illus-preview").innerHTML = catSVG({ look: lookFromForm() }, "prev-" + Date.now());
  }

  function updateBlurbCount() {
    $("e-blurb-count").textContent = $("e-blurb").value.length;
  }

  // ---------- Foto e ponto de foco ----------

  function applyFocus() {
    const pos = `${focus.x}% ${focus.y}%`;
    $("focus-dot").style.left = focus.x + "%";
    $("focus-dot").style.top = focus.y + "%";
    document.querySelectorAll(".fp img").forEach((img) => (img.style.objectPosition = pos));
    $("focus-out").textContent = `Foco: ${pos}`;
  }

  // As imagens da prévia só existem quando há foto (nada de <img> sem src na página)
  function setPreview(src) {
    document.querySelectorAll("#focus-stage img, .fp img").forEach((img) => img.remove());
    $("focus-pick").hidden = !src;
    if (!src) return;
    const main = Object.assign(document.createElement("img"), { id: "focus-img", alt: "Foto escolhida", src });
    $("focus-stage").prepend(main);
    document.querySelectorAll(".fp").forEach((box) => box.append(Object.assign(document.createElement("img"), { alt: "", src })));
    applyFocus();
  }

  function toJpeg(bmp, maxW) {
    const w = Math.min(maxW, bmp.width);
    const h = Math.round((bmp.height * w) / bmp.width);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error("jpeg"))), "image/jpeg", 0.85));
  }

  async function onPhotoChosen(file) {
    setEditorError("");
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      $("e-photo").value = "";
      return setEditorError("Use uma foto em JPG, PNG ou WebP.", $("e-photo"));
    }
    if (file.size > 20 * 1024 * 1024) {
      $("e-photo").value = "";
      return setEditorError("A foto passa de 20 MB. Escolha uma menor.", $("e-photo"));
    }
    try {
      const bmp = await createImageBitmap(file);
      if (Math.min(bmp.width, bmp.height) < 400) {
        bmp.close();
        $("e-photo").value = "";
        return setEditorError("Foto pequena demais: precisa de pelo menos 400 px no lado menor.", $("e-photo"));
      }
      const [large, small] = await Promise.all([toJpeg(bmp, 1600), toJpeg(bmp, 640)]);
      bmp.close();
      if (newPhoto?.url) URL.revokeObjectURL(newPhoto.url);
      newPhoto = { large, small, url: URL.createObjectURL(large) };
      focus = { x: 50, y: 40 };
      setPreview(newPhoto.url);
      dirty = true;
    } catch {
      $("e-photo").value = "";
      setEditorError("Não foi possível abrir essa foto. Tente outro arquivo.", $("e-photo"));
    }
  }

  // ---------- Abrir / fechar ----------

  function openEditor(c) {
    editing = c || null;
    if (newPhoto?.url) URL.revokeObjectURL(newPhoto.url);
    newPhoto = null;
    form.reset();
    setEditorError("");
    $("e-since").max = today();
    $("editor-kicker").textContent = c ? `${c.code} · editando` : "Novo gato";
    $("editor-h").textContent = c ? `Editar ${c.name}` : "Cadastrar gato";
    $("e-photo-req").textContent = c ? "(envie só se quiser trocar)" : "(obrigatória)";
    saveBtn.textContent = c ? "Salvar alterações" : "Cadastrar gato";

    if (c) {
      $("e-name").value = c.name;
      form.querySelector(`[name="sex"][value="${c.sex}"]`).checked = true;
      $("e-age").value = c.age;
      $("e-group").value = c.group;
      $("e-since").value = c.since;
      $("e-vac").value = c.vac;
      $("e-blurb").value = c.blurb;
      $("e-trait1").value = c.traits[0] || "";
      $("e-trait2").value = c.traits[1] || "";
      field("with_kids").checked = !!c.kids;
      field("with_dogs").checked = !!c.dogs;
      field("with_cats").checked = !!c.cats;
      form.querySelector(`[name="energy"][value="${c.energy}"]`).checked = true;
      $("e-fur").value = c.look.fur;
      $("e-eye").value = c.look.eye;
      $("e-pattern").value = c.pattern || (c.look.tabby ? "tigrado" : c.look.tux ? "frajola" : c.look.tri ? "tricolor" : c.look.siam ? "siames" : "liso");
      if (c.look.stripe) $("e-stripe").value = c.look.stripe;
      const [fx, fy] = (c.focus || "50% 50%").split(" ").map((v) => parseInt(v, 10));
      focus = { x: fx, y: fy };
      setPreview(`${c.photo}-1600.jpg`);
    } else {
      $("e-since").value = today();
      focus = { x: 50, y: 50 };
      setPreview("");
    }
    updateBlurbCount();
    updateIllus();
    dirty = false;
    editor.showModal();
    $("e-name").focus();
  }

  function closeEditor() {
    if (dirty && !confirm("Descartar o que foi preenchido?")) return;
    editor.close();
  }

  // ---------- Validação (mesmos limites do banco) ----------

  const BAD = /[<>"`]/;
  const HEX = /^#[0-9A-F]{6}$/;

  function readForm() {
    const pattern = $("e-pattern").value;
    return {
      name: $("e-name").value.trim().replace(/\s+/g, " "),
      sex: checked("sex"),
      age: $("e-age").value.trim().replace(/\s+/g, " "),
      age_group: $("e-group").value,
      since: $("e-since").value,
      vac: $("e-vac").value.trim().replace(/\s+/g, " "),
      blurb: $("e-blurb").value.trim().replace(/\s+/g, " "),
      traits: [$("e-trait1").value, $("e-trait2").value].map((t) => t.trim().replace(/\s+/g, " ").toLowerCase()),
      with_kids: field("with_kids").checked,
      with_dogs: field("with_dogs").checked,
      with_cats: field("with_cats").checked,
      energy: Number(checked("energy")),
      fur: $("e-fur").value.toUpperCase(),
      eye: $("e-eye").value.toUpperCase(),
      pattern,
      stripe: pattern === "tigrado" ? $("e-stripe").value.toUpperCase() : null,
      focus: `${focus.x}% ${focus.y}%`,
    };
  }

  function validate(v) {
    const text = (val, min, max, el, label) => {
      if (val.length < min) return [min > 1 ? `${label}: escreva pelo menos ${min} caracteres.` : `Preencha: ${label.toLowerCase()}.`, el];
      if (val.length > max) return [`${label}: no máximo ${max} caracteres.`, el];
      if (BAD.test(val)) return [`${label} não pode ter os caracteres < > " \`.`, el];
      return null;
    };
    return text(v.name, 1, 40, $("e-name"), "Nome")
      || (!v.sex && ["Escolha o sexo.", form.querySelector('[name="sex"]')])
      || text(v.age, 1, 20, $("e-age"), "Idade")
      || (!v.age_group && ["Escolha a faixa etária.", $("e-group")])
      || (!/^\d{4}-\d{2}-\d{2}$/.test(v.since) && ["Escolha a data de chegada.", $("e-since")])
      || (v.since > today() && ["A data de chegada não pode ser no futuro.", $("e-since")])
      || (v.since < "2000-01-01" && ["Confira o ano da data de chegada.", $("e-since")])
      || text(v.vac, 1, 40, $("e-vac"), "Vacinas")
      || text(v.blurb, 10, 160, $("e-blurb"), "Frase")
      || text(v.traits[0], 2, 20, $("e-trait1"), "Personalidade 1")
      || text(v.traits[1], 2, 20, $("e-trait2"), "Personalidade 2")
      || (![1, 2, 3].includes(v.energy) && ["Escolha o nível de energia.", form.querySelector('[name="energy"]')])
      || (!editing && !newPhoto && ["Envie uma foto do gato.", $("e-photo")])
      || (![v.fur, v.eye].every((x) => HEX.test(x)) && ["Escolha as cores da ilustração.", $("e-fur")])
      || null;
  }

  function setEditorError(msg, el) {
    const box = $("editor-error");
    form.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
    box.textContent = msg || "";
    box.hidden = !msg;
    if (msg && el) {
      el.setAttribute("aria-invalid", "true");
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  // ---------- Salvar ----------

  function slugify(name) {
    return fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/g, "") || "gato";
  }
  function uniqueId(name) {
    const base = slugify(name);
    let id = base, n = 2;
    while (CATS.some((c) => c.id === id)) id = `${base}-${n++}`;
    return id;
  }

  async function uploadPhoto(id) {
    const bucket = sb.storage.from("cat-photos");
    const path = `${id}/${Date.now().toString(36)}`;
    for (const [suffix, blob] of [["-640.jpg", newPhoto.small], ["-1600.jpg", newPhoto.large]]) {
      const { error } = await bucket.upload(path + suffix, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (error) {
        await bucket.remove([path + "-640.jpg", path + "-1600.jpg"]).catch(() => {});
        throw Object.assign(new Error(error.message), { where: "foto" });
      }
    }
    return bucket.getPublicUrl(path).data.publicUrl;
  }

  async function removePhoto(photo) {
    if (!isStoragePhoto(photo)) return; // fotos de photos/ ficam no repositório
    const path = decodeURIComponent(photo.split(STORAGE_MARK)[1] || "");
    if (!path) return;
    await sb.storage.from("cat-photos").remove([path + "-640.jpg", path + "-1600.jpg"]).catch(() => {});
  }

  function friendly(err) {
    const code = err?.code || "";
    if (err?.where === "foto") return `Não foi possível enviar a foto (${err.message}). Confira a conexão e tente de novo.`;
    if (code === "42501" || code === "PGRST116") return "O banco recusou: esta conta precisa ser de administrador.";
    if (code === "23505") return "Já existe um gato com esse identificador. Mude um pouco o nome e tente de novo.";
    if (code === "23514") return /futuro/.test(err.message) ? "A data de chegada não pode ser no futuro." : "Algum campo está fora do formato aceito. Confira e tente de novo.";
    return "Não foi possível salvar agora. Confira a conexão e tente de novo.";
  }

  async function save(e) {
    e.preventDefault();
    const v = readForm();
    const bad = validate(v);
    if (bad) return setEditorError(bad[0], bad[1]);
    setEditorError("");
    setBusy(saveBtn, true, editing ? "Salvando…" : "Cadastrando…");
    let uploaded = null;
    try {
      const id = editing ? editing.id : uniqueId(v.name);
      if (newPhoto) {
        uploaded = await uploadPhoto(id);
        v.photo = uploaded;
      }
      const q = editing
        ? sb.from("cats").update(v).eq("id", id).select().single()
        : sb.from("cats").insert({ id, ...v }).select().single();
      const { data, error } = await q;
      if (error) throw error;
      if (uploaded && editing) await removePhoto(editing.photo); // troca: apaga a foto antiga
      dirty = false;
      editor.close();
      showToast(editing ? `${data.name} atualizado` : `${data.name} cadastrado (${data.code})`);
      await refreshCats();
    } catch (err) {
      if (uploaded) await removePhoto(uploaded);
      setEditorError(friendly(err));
    } finally {
      setBusy(saveBtn, false);
    }
  }

  function initEditor() {
    form.addEventListener("submit", save);
    form.addEventListener("input", () => (dirty = true));
    $("e-blurb").addEventListener("input", updateBlurbCount);
    ["e-fur", "e-eye", "e-stripe", "e-pattern"].forEach((id) => $(id).addEventListener("input", updateIllus));
    $("e-pattern").addEventListener("change", updateIllus);
    $("e-photo").addEventListener("change", (e) => onPhotoChosen(e.target.files[0]));
    editor.querySelectorAll("[data-close-editor]").forEach((b) => b.addEventListener("click", closeEditor));
    editor.addEventListener("cancel", (e) => { e.preventDefault(); closeEditor(); });

    // Clique (ou setas do teclado) define o ponto do rosto
    const stage = $("focus-stage");
    stage.tabIndex = 0;
    stage.setAttribute("aria-label", "Ponto do rosto na foto: clique ou use as setas");
    stage.addEventListener("click", (e) => {
      const r = $("focus-img").getBoundingClientRect();
      focus = {
        x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))),
        y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))),
      };
      applyFocus();
      dirty = true;
    });
    stage.addEventListener("keydown", (e) => {
      const d = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
      if (!d) return;
      e.preventDefault();
      focus = { x: Math.min(100, Math.max(0, focus.x + d[0])), y: Math.min(100, Math.max(0, focus.y + d[1])) };
      applyFocus();
      dirty = true;
    });
  }

  // ======================================================================
  // Gatos: remover
  // ======================================================================

  const confirmDlg = $("confirm");
  let deleting = null;

  function askDelete(c) {
    deleting = c;
    $("confirm-h").textContent = `Remover ${c.name}?`;
    $("confirm-text").textContent = `A ficha ${c.code} sai do site e dos favoritos de quem tinha salvado${isStoragePhoto(c.photo) ? ", e as fotos enviadas são apagadas" : ""}. Não dá para desfazer.`;
    $("confirm-error").hidden = true;
    confirmDlg.showModal();
  }

  function initConfirm() {
    confirmDlg.querySelector("[data-close-confirm]").addEventListener("click", () => confirmDlg.close());
    $("confirm-yes").addEventListener("click", async () => {
      const btn = $("confirm-yes");
      setBusy(btn, true, "Removendo…");
      const { data, error } = await sb.from("cats").delete().eq("id", deleting.id).select();
      setBusy(btn, false);
      if (error || !data?.length) {
        $("confirm-error").textContent = error ? friendly(error) : "O banco não removeu: esta conta precisa ser de administrador.";
        $("confirm-error").hidden = false;
        return;
      }
      await removePhoto(deleting.photo);
      confirmDlg.close();
      showToast(`${deleting.name} removido`);
      await refreshCats();
    });
  }

  // ======================================================================
  // Usuários
  // ======================================================================

  const fmtDate = (iso, time = false) => iso ? new Date(iso).toLocaleString("pt-BR", time
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  // Busca e paginação no banco: com milhares de contas, só a página atual vem para o navegador
  const USERS_PAGE = 25;
  const ROLE_LABEL = { master: ["Admin Mestre", "pill-master"], admin: ["Administrador", "pill-admin"], user: ["Usuário", ""] };
  const users = { page: 0, term: "", total: 0, req: 0 };

  // Tira o que quebraria o filtro do PostgREST (vírgula, parênteses, curingas, aspas)
  const searchTerm = (v) => v.replace(/[,()*%\\:"'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  function roleAction(u) {
    if (u.id === auth.user.id || u.role === "master") return "";
    if (u.role === "admin") {
      return isMaster()
        ? `<button class="btn btn-danger-ghost btn-sm" type="button" data-role-user="${esc(u.id)}" data-role="user">Remover admin</button>`
        : `<span class="hint" title="Só o Admin Mestre pode remover administradores">—</span>`;
    }
    return `<button class="btn btn-ghost btn-sm" type="button" data-role-user="${esc(u.id)}" data-role="admin">Tornar admin</button>`;
  }

  async function loadUsers() {
    const table = $("users-table");
    const req = ++users.req; // respostas atrasadas de buscas anteriores são ignoradas
    const from = users.page * USERS_PAGE;
    table.setAttribute("aria-busy", "true");
    if (!table.querySelector("thead")) table.innerHTML = `<tbody><tr><td class="hint">Carregando…</td></tr></tbody>`;

    let q = sb.from("profiles").select("id, name, email, role, created_at", { count: "exact" })
      .order("created_at", { ascending: false }).range(from, from + USERS_PAGE - 1);
    if (users.term) q = q.or(`name.ilike.%${users.term}%,email.ilike.%${users.term}%`);
    const res = await q;
    if (req !== users.req) return;
    table.removeAttribute("aria-busy");
    if (res.error) {
      table.innerHTML = `<tbody><tr><td class="error">Não foi possível carregar as contas.</td></tr></tbody>`;
      $("users-count").textContent = "";
      $("users-pager").hidden = true;
      return;
    }
    users.total = res.count ?? res.data.length;
    // Página que deixou de existir (ex.: estava na 5 e a busca achou 3 contas)
    if (!res.data.length && users.page > 0) { users.page = 0; return loadUsers(); }

    // Último acesso só das contas desta página
    const ids = res.data.map((u) => u.id);
    const last = {};
    if (ids.length) {
      const logins = await sb.from("login_log").select("user_id, at").eq("event", "login").in("user_id", ids)
        .order("at", { ascending: false }).limit(ids.length * 20);
      if (req !== users.req) return;
      (logins.data || []).forEach((r) => { if (!last[r.user_id]) last[r.user_id] = r.at; });
    }

    table.innerHTML = `
      <caption class="sr-only">Contas do site</caption>
      <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Criada em</th><th>Último acesso</th><th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody>${res.data.length ? res.data.map((u) => {
        const [label, cls] = ROLE_LABEL[u.role] || ROLE_LABEL.user;
        return `<tr>
          <td>${esc(u.name) || '<span class="hint">sem nome</span>'}${u.id === auth.user.id ? ' <span class="pill">você</span>' : ""}</td>
          <td>${esc(u.email)}</td>
          <td><span class="pill ${cls}">${label}</span></td>
          <td class="num">${fmtDate(u.created_at)}</td>
          <td class="num">${fmtDate(last[u.id], true)}</td>
          <td>${roleAction(u)}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="6" class="hint">${users.term ? `Nenhuma conta encontrada para “${esc(users.term)}”.` : "Nenhuma conta ainda."}</td></tr>`}</tbody>`;

    const n = (x) => x.toLocaleString("pt-BR");
    const pages = Math.max(1, Math.ceil(users.total / USERS_PAGE));
    $("users-count").textContent = users.total
      ? `${n(from + 1)}–${n(from + res.data.length)} de ${n(users.total)} ${users.total === 1 ? "conta" : "contas"}`
      : "";
    $("users-pager").hidden = pages <= 1;
    $("users-page").textContent = `Página ${n(users.page + 1)} de ${n(pages)}`;
    $("users-prev").disabled = users.page === 0;
    $("users-next").disabled = users.page >= pages - 1;
  }

  let usersTimer;
  $("users-search").addEventListener("input", (e) => {
    clearTimeout(usersTimer);
    usersTimer = setTimeout(() => {
      const term = searchTerm(e.target.value);
      if (term === users.term) return;
      users.term = term;
      users.page = 0;
      loadUsers();
    }, 300);
  });
  $("users-prev").addEventListener("click", () => { if (users.page > 0) { users.page--; loadUsers(); } });
  $("users-next").addEventListener("click", () => { users.page++; loadUsers(); });

  $("users-table").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-role-user]");
    if (!b) return;
    setBusy(b, true, "Salvando…");
    const { error } = await sb.rpc("admin_set_role", { target: b.dataset.roleUser, new_role: b.dataset.role });
    if (error) {
      setBusy(b, false);
      return showToast(error.message || "Não foi possível mudar o papel.");
    }
    showToast(b.dataset.role === "admin" ? "Conta promovida a administrador" : "Acesso de administrador removido");
    loadUsers();
  });

  // ======================================================================
  // Registro de acessos
  // ======================================================================

  const EVENT = {
    login: ["Entrou", "pill-ok"],
    falha: ["Senha errada", "pill-warn"],
    cadastro: ["Criou conta", "pill-info"],
    saida: ["Saiu", ""],
  };
  let logRows = [];
  let logFilter = "todos";

  function uaShort(ua) {
    if (!ua) return "—";
    const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung"
      : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Outro";
    const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows"
      : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
    return os ? `${browser} · ${os}` : browser;
  }

  function renderLog() {
    const rows = logFilter === "todos" ? logRows : logRows.filter((r) => r.event === logFilter);
    $("log-table").innerHTML = `
      <caption class="sr-only">Registro de acessos</caption>
      <thead><tr><th>Quando</th><th>Evento</th><th>E-mail</th><th>IP</th><th>Navegador</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => {
        const [label, cls] = EVENT[r.event] || [r.event, ""];
        return `<tr>
          <td class="num">${fmtDate(r.at, true)}</td>
          <td><span class="pill ${cls}">${esc(label)}</span></td>
          <td>${esc(r.email) || "—"}</td>
          <td class="num">${esc(r.ip) || "—"}</td>
          <td title="${esc(r.user_agent)}">${esc(uaShort(r.user_agent))}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="5" class="hint">Nada registrado${logFilter === "todos" ? " ainda" : " com esse filtro"}.</td></tr>`}</tbody>`;
  }

  async function loadLog() {
    $("log-table").innerHTML = `<tbody><tr><td class="hint">Carregando…</td></tr></tbody>`;
    const { data, error } = await sb.from("login_log").select("*").order("at", { ascending: false }).limit(300);
    if (error) {
      $("log-table").innerHTML = `<tbody><tr><td class="error">Não foi possível carregar o registro.</td></tr></tbody>`;
      return;
    }
    logRows = data;
    renderLog();
  }

  function initLog() {
    createSegmented($("log-filter"), [
      { key: "todos", label: "Todos" },
      { key: "login", label: "Entradas" },
      { key: "falha", label: "Falhas" },
      { key: "cadastro", label: "Cadastros" },
      { key: "saida", label: "Saídas" },
    ], "todos", (key) => { logFilter = key; if (logRows.length) renderLog(); });
    $("log-reload").addEventListener("click", loadLog);
  }

  // ======================================================================
  // Início (no fim: tudo acima já está declarado quando o painel abre)
  // ======================================================================

  await authReady;
  route();
  document.addEventListener("sv:auth", route); // entrou/saiu em outra aba
})();
