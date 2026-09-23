/* ==========================================================================
   Animações feitas em JS (WAAPI). As animações de CSS ficam em styles.css.
   As curvas espelham os tokens --ease-out e --ease-in-out do CSS.
   ========================================================================== */

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Revela a foto de cima para baixo com uma linha âmbar acompanhando a borda.
// Roda uma vez, quando a imagem termina de carregar.
function scanReveal(box, img) {
  img.classList.add("in");

  if (reduceMotion.matches) {
    img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE_OUT });
    return;
  }

  const duration = box.closest(".scanner") ? 900 : 650;
  const opts = { duration, easing: EASE_IN_OUT, fill: "backwards" };

  img.animate(
    [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }],
    opts
  );

  const scan = box.querySelector(".scan");
  scan.animate(
    [{ transform: "translateY(-100%)", opacity: 1 }, { transform: "translateY(0)", opacity: 1 }],
    opts
  );
  scan.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 250, delay: duration, easing: "ease", fill: "backwards" }
  );
}

// URL com extensão = arquivo único (ex.: TheCatAPI). Sem extensão = foto local em dois tamanhos
// (<base>-640.jpg e <base>-1600.jpg): o navegador baixa só o que a largura do bloco pede.
// sizes: largura em que a foto aparece; blocos ampliados por transform (mosaico) avisam via data-sizes
function setPhotoSource(img, url, sizes) {
  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) {
    img.src = url;
    return;
  }
  img.sizes = sizes || "auto, (max-width: 760px) 100vw, 50vw";
  img.srcset = `${url}-640.jpg 640w, ${url}-1600.jpg 1600w`;
  img.src = `${url}-640.jpg`;
}

// Coloca a foto no bloco; se falhar, a ilustração continua visível
function attachPhoto(box, url, animate = true) {
  const img = box.querySelector("img");
  img.onload = () => {
    img.onload = null; // srcset pode trocar de arquivo depois (ex.: janela redimensionada)
    box.querySelector("svg")?.remove();
    animate ? scanReveal(box, img) : img.classList.add("in");
  };
  img.onerror = () => img.remove();
  setPhotoSource(img, url, box.dataset.sizes);
}
