# Sete Vidas

Site do **Sete Vidas**, lar temporário de gatos em Teresina (PI). Todos os gatos são castrados, vacinados, microchipados e testados para FIV e FeLV, e cada adoção tem acompanhamento de 30 dias.

**Acesse:** https://cobaltsnow172.github.io/Sete-Vidas/

## Páginas

| Página | O que tem |
| --- | --- |
| [`index.html`](index.html) | Início: os gatos disponíveis para adoção e um quiz para descobrir qual combina com você |
| [`sete-vidas.html`](sete-vidas.html) | "Da rua ao sofá": a história de cada gato |
| [`antes-de-adotar.html`](antes-de-adotar.html) | Requisitos, enxoval, custos e dúvidas frequentes |
| [`como-ajudar.html`](como-ajudar.html) | Apadrinhamento, lar temporário, voluntariado e doações |

## Estrutura

```
css/      estilos (base, início, páginas internas, histórias)
js/       scripts do site
photos/   fotos dos gatos (versões de 640 px e 1600 px)
```

## Como editar

- **Contato e PIX:** em [`js/config.js`](js/config.js) ficam o número do WhatsApp que recebe as mensagens e a chave PIX para doações. Se a chave ficar vazia, a página "Como ajudar" pede para a pessoa perguntar pelo WhatsApp.
- **Gatos:** em [`js/data.js`](js/data.js) fica o perfil de cada gato (nome, idade, vacinas, personalidade, com quem convive, foto). Para adicionar um gato, basta incluir um novo item na lista `CATS`: filtros, quiz e fichas se ajustam sozinhos.
- **Fotos:** as fotos são ilustrativas (vêm da [TheCatAPI](https://thecatapi.com)) e não mostram os gatos reais do abrigo. Ficam em `photos/` em dois tamanhos (`<id>-640.jpg` e `<id>-1600.jpg`). Gatos sem foto definida em `js/data.js` recebem uma imagem aleatória da TheCatAPI.

## Rodar localmente

O site é HTML, CSS e JavaScript puros, sem etapa de build. Basta servir a pasta:

```bash
python -m http.server 8000
```

Depois abra http://localhost:8000.

## Publicação

O site é publicado pelo GitHub Pages a partir da branch `main`. Cada `git push` atualiza o site em cerca de um minuto.
