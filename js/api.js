/* ==========================================================================
   Fotos dos gatos — TheCatAPI (https://thecatapi.com)
   As fotos são ilustrativas: não são os gatos reais do abrigo.
   ========================================================================== */

// true  = usa fotos locais em photos/<id>.jpg (ex.: photos/tangerina.jpg)
// false = busca fotos aleatórias na TheCatAPI
const BUNDLED_PHOTOS = false;

const CAT_API_URL = "https://api.thecatapi.com/v1/images/search";
const PHOTO_CACHE_KEY = "sete-vidas-fotos-v1";

// id do gato -> URL da foto
const photoUrl = {};

function readPhotoCache() {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function writePhotoCache(map) {
  try {
    localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

async function fetchCatImages(limit) {
  const res = await fetch(`${CAT_API_URL}?limit=${limit}&mime_types=jpg,png&size=full`);
  if (!res.ok) throw new Error("TheCatAPI respondeu " + res.status);
  const list = await res.json();
  return list.filter((p) => p.url && !p.url.endsWith(".gif"));
}

// Preenche photoUrl para todos os gatos
async function resolvePhotos() {
  if (BUNDLED_PHOTOS) {
    CATS.forEach((c) => (photoUrl[c.id] = `photos/${c.id}.jpg`));
    return;
  }

  // Fotos escolhidas em js/data.js têm prioridade; a busca aleatória só cobre quem ficou sem
  CATS.forEach((c) => { if (c.photo) photoUrl[c.id] = c.photo; });
  if (CATS.every((c) => photoUrl[c.id])) return;

  // Mantém a mesma foto para cada gato entre visitas deste navegador
  const cached = readPhotoCache();
  if (cached && CATS.every((c) => photoUrl[c.id] || cached[c.id])) {
    CATS.forEach((c) => (photoUrl[c.id] ||= cached[c.id]));
    return;
  }

  const missing = CATS.filter((c) => !c.photo).length;
  let list = await fetchCatImages(10);
  // Sem chave de API o endpoint pode devolver menos fotos; completa uma a uma
  while (list.length < missing) {
    const more = await fetchCatImages(1);
    if (!more.length) break;
    list = list.concat(more);
  }

  CATS.filter((c) => !c.photo).forEach((c, i) => {
    if (list[i]) photoUrl[c.id] = list[i].url;
  });
  writePhotoCache(photoUrl);
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
      /* API fora do ar ou bloqueada: as ilustrações continuam */
    });
}
