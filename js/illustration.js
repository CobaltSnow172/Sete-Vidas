/* ==========================================================================
   Ilustração SVG de cada gato (aparece enquanto a foto carrega,
   ou no lugar dela se a API estiver fora do ar) e o bloco de foto.
   ========================================================================== */

function catSVG(c, uid) {
  const L = c.look;
  const clip = `h-${uid}`;
  const dark = ["#26222E", "#2B2733", "#2E2926"].includes(L.fur);
  const inner = dark ? "#6B4A55" : "#F2A9A0";
  const earFur = L.siam ? "#5B4636" : L.fur;

  let extra = "";
  if (L.tabby) extra += `<g stroke="${L.stripe}" stroke-width="6" stroke-linecap="round" fill="none"><path d="M100 64v18"/><path d="M84 68l3 14"/><path d="M116 68l-3 14"/><path d="M40 118h16"/><path d="M144 118h16"/></g>`;
  if (L.tux) extra += `<ellipse cx="100" cy="146" rx="34" ry="26" fill="#F4F1EC"/><path d="M100 98l-10 30h20z" fill="#F4F1EC"/>`;
  if (L.tri) extra += `<circle cx="60" cy="96" r="34" fill="#D9853A"/><circle cx="146" cy="140" r="26" fill="#F1E9DD"/><ellipse cx="104" cy="148" rx="26" ry="20" fill="#F1E9DD"/>`;
  if (L.siam) extra += `<ellipse cx="100" cy="136" rx="36" ry="30" fill="#6A523F"/>`;

  return `<svg viewBox="0 0 200 180" aria-hidden="true">
    <defs><clipPath id="${clip}"><ellipse cx="100" cy="118" rx="64" ry="56"/></clipPath></defs>
    <polygon points="46,96 58,30 98,70" fill="${earFur}"/><polygon points="154,96 142,30 102,70" fill="${earFur}"/>
    <polygon points="58,84 64,46 86,70" fill="${inner}"/><polygon points="142,84 136,46 114,70" fill="${inner}"/>
    <ellipse cx="100" cy="118" rx="64" ry="56" fill="${L.fur}"/>
    <g clip-path="url(#${clip})">${extra}</g>
    <ellipse cx="76" cy="110" rx="11" ry="12.5" fill="${L.eye}"/><ellipse cx="124" cy="110" rx="11" ry="12.5" fill="${L.eye}"/>
    <ellipse cx="76" cy="111" rx="3.6" ry="9.5" fill="#15121B"/><ellipse cx="124" cy="111" rx="3.6" ry="9.5" fill="#15121B"/>
    <circle cx="79" cy="105" r="2.4" fill="#fff"/><circle cx="127" cy="105" r="2.4" fill="#fff"/>
    <path d="M94 131h12l-6 7z" fill="#E48D93"/>
    <path d="M100 138q-5 8-12 4M100 138q5 8 12 4" stroke="#15121B" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// Bloco de foto: ilustração + <img> (preenchido pela API) + linha de scan + cantos da mira
function photoBox(c, uid, extraAttr = "") {
  return `
    <div class="photo" data-cat="${c.id}" ${extraAttr}>
      ${catSVG(c, uid)}
      <img alt="Foto de ${c.name}" loading="lazy" decoding="async" style="object-position: ${c.focus || "50% 50%"}">
      <span class="scan"></span>
      <span class="br tl"></span><span class="br tr"></span><span class="br bl"></span><span class="br brr"></span>
    </div>`;
}
