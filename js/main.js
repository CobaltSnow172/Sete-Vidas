/* ==========================================================================
   Ponto de entrada. Os scripts são carregados com "defer", nesta ordem:
   data → illustration → animations → api → catalog → match → modal → main
   ========================================================================== */

// Finais felizes: ilustração do gato + mensagem de quem adotou
function renderStories() {
  document.getElementById("stories").innerHTML = ADOPTED.map((a, i) => `
    <figure class="story reveal">
      <div class="story-art">${catSVG(a, "st-" + i)}<span class="mono">Adotad${a.sex === "fêmea" ? "a" : "o"} em ${a.when}</span></div>
      <blockquote>“${a.quote}”</blockquote>
      <figcaption><b>${a.name}</b><span>${a.home}</span></figcaption>
    </figure>`).join("");
}

renderScanner(featuredCat());
renderGrid();
initFilter();
initMatch();
renderStories();
initModal();
loadAllPhotos();

// Scanner do topo: inclina de leve seguindo o cursor e sobe um pouco mais rápido que a página
// (se descesse, invadiria a seção de baixo)
(function scannerDepth() {
  const el = document.getElementById("scanner");
  if (reduceMotion.matches || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 8 + "deg");
    el.style.setProperty("--rx", ((e.clientY - r.top) / r.height - 0.5) * -8 + "deg");
  });
  el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  addEventListener("scroll", () => {
    if (scrollY < innerHeight) el.style.setProperty("--sy", scrollY * -0.1 + "px");
  }, { passive: true });
})();

// Letreiro da chamada "Sete vidas": anda conforme a rolagem, parado se a pessoa não rola
(function teaserMarquee() {
  const teaser = document.querySelector(".teaser");
  if (!teaser || reduceMotion.matches) return;
  addEventListener("scroll", () => {
    const r = teaser.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    teaser.style.setProperty("--mq", ((innerHeight - r.top) * 0.4).toFixed(1));
  }, { passive: true });
})();
