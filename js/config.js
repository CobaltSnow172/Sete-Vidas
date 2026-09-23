/* ==========================================================================
   Configuração do site — edite aqui.
   ========================================================================== */

const SITE = {
  name: "Sete Vidas",
  city: "Teresina, PI",

  // WhatsApp que recebe as mensagens: código do país + DDD + número, só dígitos
  whatsapp: "5586999971151",
  whatsappDisplay: "(86) 99997-1151",

  // Chave PIX para doações (CPF, CNPJ, e-mail, telefone ou chave aleatória).
  // Vazio = a página "Como ajudar" pede a chave pelo WhatsApp.
  pixKey: "",
};

// Link que abre o WhatsApp com a mensagem já escrita
function whatsappLink(message) {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}
