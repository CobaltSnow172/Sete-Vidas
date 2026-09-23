/* ==========================================================================
   Comportamentos comuns a todas as páginas.
   ========================================================================== */

// Qualquer link com data-wa="mensagem" vira um link de WhatsApp com essa mensagem
function applyWhatsappLinks(root = document) {
  root.querySelectorAll("[data-wa]").forEach((a) => {
    a.href = whatsappLink(a.dataset.wa || `Olá! Vim pelo site ${SITE.name}.`);
    a.target = "_blank";
    a.rel = "noopener";
  });
  root.querySelectorAll("[data-wa-display]").forEach((el) => (el.textContent = SITE.whatsappDisplay));
}

// ---------- Seletor segmentado (filtro de idade, valor do apadrinhamento...) ----------
// options: [{ key, label, note? }]. Chama onChange(key) ao iniciar e a cada troca.
function createSegmented(el, options, initialKey, onChange) {
  const row = (tag) => options.map((o) => {
    const attrs = tag === "button" ? ` type="button" data-key="${o.key}" aria-pressed="false"` : "";
    const note = o.note != null ? `<span class="n">${o.note}</span>` : "";
    return `<${tag}${attrs}>${o.label}${note}</${tag}>`;
  }).join("");

  el.innerHTML = `
    <div class="seg-row">${row("button")}</div>
    <div class="seg-row seg-active" aria-hidden="true">${row("span")}</div>`;
  const active = el.querySelector(".seg-active");
  let current = initialKey;

  function place() {
    const btn = el.querySelector(`button[data-key="${current}"]`);
    const left = btn.offsetLeft - btn.parentElement.offsetLeft;
    const right = btn.parentElement.offsetWidth - left - btn.offsetWidth;
    active.style.clipPath = `inset(0 ${right}px 0 ${left}px round 999px)`;
  }

  function select(key) {
    current = key;
    el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.key === key)));
    place();
    onChange?.(key);
  }

  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && b.dataset.key !== current) select(b.dataset.key);
  });

  select(initialKey);
  // Liga a transição só depois do primeiro posicionamento, para não deslizar no carregamento
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("ready")));
  addEventListener("resize", place);
  document.fonts?.ready.then(place);

  return { select, get value() { return current; } };
}

// ---------- Índice fixo: marca o capítulo que está na tela ----------
function initToc() {
  const toc = document.querySelector("nav.toc");
  if (!toc || !("IntersectionObserver" in window)) return;
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const byId = new Map(links.map((a) => [a.hash.slice(1), a]));

  function mark(id) {
    links.forEach((a) => a.removeAttribute("aria-current"));
    const a = byId.get(id);
    if (!a) return;
    a.setAttribute("aria-current", "true");
    // No celular o índice rola para o lado: mantém o capítulo atual à vista
    toc.scrollTo({ left: a.offsetLeft - toc.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" });
  }

  // Uma faixa no meio da tela decide qual seção está sendo lida
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && mark(e.target.id));
  }, { rootMargin: "-45% 0px -50% 0px" });
  byId.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}

initToc();
applyWhatsappLinks();
