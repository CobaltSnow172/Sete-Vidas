/* ==========================================================================
   Fotos dos gatos
   Cada gato usa só a própria foto (campo "photo", enviada pelo painel ou
   definida em js/data.js). Gato sem foto continua com a ilustração desenhada
   a partir da pelagem — nunca recebe a foto de outro gato.
   ========================================================================== */

// id do gato -> URL da foto
const photoUrl = {};

// Fotos aleatórias que versões antigas do site guardavam neste navegador
try { localStorage.removeItem("sete-vidas-fotos-v1"); } catch {}

// Preenche photoUrl para todos os gatos que têm foto
async function resolvePhotos() {
  CATS.forEach((c) => { if (c.photo) photoUrl[c.id] = c.photo; });
}

// Busca as fotos e aplica nos blocos .photo da página que ainda não têm foto
function loadAllPhotos() {
  resolvePhotos()
    .then(() => {
      document.querySelectorAll(".photo[data-cat]").forEach((box) => {
        const url = photoUrl[box.dataset.cat];
        // Só blocos novos: chamar de novo (ex.: resultado do quiz) não reanima os que já têm foto
        const img = box.querySelector("img");
        if (url && img && !img.getAttribute("src")) attachPhoto(box, url);
      });
    })
    .catch(() => {
      /* sem foto: as ilustrações continuam */
    });
}
