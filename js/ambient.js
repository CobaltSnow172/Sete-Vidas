/* ==========================================================================
   Ambiente comum a todas as páginas:
   - partículas de luz ao fundo (vaga-lumes em âmbar e íris) com parallax
     de profundidade na rolagem e um leve desvio do cursor;
   - barra de progresso da leitura no topo;
   - revelação de blocos (.reveal) quando entram na tela.
   Com movimento reduzido: sem partículas, blocos já visíveis.
   ========================================================================== */

(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Barra de progresso ----------
  const bar = document.createElement("div");
  bar.className = "read-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);

  function setProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  }
  addEventListener("scroll", setProgress, { passive: true });
  addEventListener("resize", setProgress);
  setProgress();

  // ---------- Voltar ao topo (aparece depois de uma tela e meia) ----------
  const top = document.createElement("button");
  top.type = "button";
  top.className = "to-top";
  top.setAttribute("aria-label", "Voltar ao topo");
  top.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  document.body.append(top);
  top.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    document.querySelector("main")?.focus({ preventScroll: true });
  });
  const toggleTop = () => top.classList.toggle("show", scrollY > innerHeight * 1.5);
  addEventListener("scroll", toggleTop, { passive: true });
  toggleTop();

  // ---------- Revelação ao rolar ----------
  // Espera o DOMContentLoaded: aí os outros scripts (defer) já criaram o conteúdo dinâmico
  addEventListener("DOMContentLoaded", () => {
    const targets = document.querySelectorAll(".reveal");
    // Irmãos revelados juntos entram em escada (limitado para o último não atrasar)
    targets.forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      el.style.setProperty("--r", Math.min(sibs.indexOf(el), 5));
    });
    if (still || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    targets.forEach((el) => io.observe(el));
  });

  if (still) return;

  // ---------- Partículas ----------
  const canvas = document.createElement("canvas");
  canvas.className = "motes";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const COLORS = ["255,178,62", "143,123,255", "255,79,139"];
  // Um brilho pré-desenhado por cor; cada quadro só carimba (drawImage) em vez de criar gradientes
  const SPRITE = 64;
  const sprites = COLORS.map((c) => {
    const sc = document.createElement("canvas");
    sc.width = sc.height = SPRITE;
    const sx = sc.getContext("2d");
    const g = sx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    g.addColorStop(0, `rgba(${c},0.55)`);
    g.addColorStop(1, `rgba(${c},0)`);
    sx.fillStyle = g;
    sx.fillRect(0, 0, SPRITE, SPRITE);
    return sc;
  });
  let w, h, dpr, motes = [];
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    // Brilhos desfocados não ganham nada com HiDPI: 1× poupa até 4× de trabalho da GPU por quadro
    dpr = 1;
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(70, Math.round((w * h) / 22000));
    motes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.2 + Math.random() * 0.8,              // profundidade: perto = maior, mais rápido
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.15,
      phase: Math.random() * Math.PI * 2,
      c: Math.random() < 0.6 ? 0 : Math.random() < 0.6 ? 1 : 2,
    }));
  }

  let lastY = scrollY;
  let running = true;

  function frame(t) {
    if (!running) return;
    // Saltos grandes (tecla Home, voltar ao topo) não arrastam as partículas por milhares de px
    const dy = Math.max(-80, Math.min(80, scrollY - lastY));
    lastY = scrollY;
    ctx.clearRect(0, 0, w, h);

    for (const m of motes) {
      m.x += m.vx * m.z;
      m.y += m.vy * m.z - dy * m.z * 0.35; // parallax: partículas próximas correm mais

      // Desvia do cursor
      const dx = m.x - mouse.x, dyM = m.y - mouse.y;
      const d2 = dx * dx + dyM * dyM;
      if (d2 < 14400) {
        const f = (1 - d2 / 14400) * 0.9;
        m.x += (dx / Math.sqrt(d2 + 1)) * f;
        m.y += (dyM / Math.sqrt(d2 + 1)) * f;
      }

      // Dá a volta na tela (módulo), para nunca empilharem numa borda
      const H = h + 20, W = w + 20;
      m.y = ((((m.y + 10) % H) + H) % H) - 10;
      m.x = ((((m.x + 10) % W) + W) % W) - 10;

      const flicker = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.0012 + m.phase));
      const size = m.r * (0.6 + m.z) * 10;
      ctx.globalAlpha = flicker * m.z;
      ctx.drawImage(sprites[m.c], m.x - size / 2, m.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
  // Aba em segundo plano: para de desenhar
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) { lastY = scrollY; requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
})();
