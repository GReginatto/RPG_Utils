# Crepúsculo dos Reinos — VTT

> **Projeto pessoal, sem fins comerciais.**  
> Criado exclusivamente para uso nas sessões de RPG do grupo, por diversão e lazer.  
> Não é um produto comercial e não possui qualquer vínculo com empresas ou publicações de RPG.

---

## O que é isso?

Um **Virtual Tabletop (VTT)** feito do zero no navegador para as sessões do RPG *Crepúsculo dos Reinos*. Funciona 100% offline, sem servidor, sem banco de dados — tudo fica salvo no `localStorage` do navegador.

---

## Funcionalidades

| Área | Destaques |
|------|-----------|
| **Mapa** | Grid quadrado ou hexagonal, zoom/pan, névoa de guerra, pintura de células, marcadores |
| **Tokens** | Drag-and-drop, atributos, HP/MP, condições, auras, iluminação individual, ocultação |
| **Paredes & Portas** | Colisão real, raycasting para luz/visão, portas com estado (aberta/fechada/trancada), divisão de paredes ao inserir porta |
| **Iluminação dinâmica** | Raycasting por token, darkvision, luz brilhante/penumbra |
| **Combate** | Iniciativa (3d8+DEX), rastreador de turno, timer, efeitos ativos |
| **Fichas** | CharacterSheet nativo (8 abas): Perfil, Atributos, Perícias, Inventário, Auras, Técnicas, XP, Salvar |
| **Multi-cena** | Várias cenas por sessão, troca com transição suave, estado independente por cena |
| **AoE** | Círculo, cone, linha, quadrado — com highlight de tokens afetados |
| **Camada de desenho** | Traço livre, linha, retângulo, círculo, texto, borracha, undo/redo |
| **Waypoints** | Caminho planejado com validação de colisão e custo de movimento em metros |
| **Chat & Dados** | Rolagem de dados, chat com histórico, tabelas roláveis, log de sessão |
| **Áudio** | Gerenciador de música/sons ambiente |
| **Compêndio** | Base de criaturas, itens, técnicas e auras — spawn direto no mapa |
| **Diário** | Notas e handouts com controle de visibilidade por jogador |
| **Macro Bar** | Macros customizáveis por sessão |
| **Sessão** | Auto-save, export/import JSON, preview de visão de jogador |

---

## Como rodar localmente

**Pré-requisitos:** Node.js 18+ e npm.

```bash
# Clonar o repositório
git clone https://github.com/GReginatto/RPG_Utils.git
cd RPG_Utils

# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento
npm start
```

O app abre em `http://localhost:3000`.

### Build de produção

```bash
npm run build
```

A pasta `build/` pode ser servida por qualquer servidor HTTP estático (nginx, GitHub Pages, etc.).

---

## Tecnologias

- [React 19](https://react.dev/) + [Create React App](https://create-react-app.dev/)
- CSS-in-JS inline (sem frameworks de UI)
- Canvas 2D para iluminação e névoa
- SVG para paredes, AoE e camada de desenho
- `localStorage` para persistência

---

## Estrutura do projeto

```
src/
├── TabletopMap.jsx        # Componente raiz — estado global e orquestração
├── components/            # Componentes de UI
│   ├── MapCanvas.jsx      # Área do mapa (tokens, fog, drag, paredes)
│   ├── Sidebar.jsx        # Painel lateral com abas
│   ├── CharacterSheet.jsx # Ficha de personagem nativa (8 abas)
│   ├── WallTool.jsx       # Overlay SVG de paredes/portas
│   ├── LightingEngine.jsx # Iluminação dinâmica com raycasting
│   └── ...
├── hooks/                 # Custom hooks
│   ├── useTokens.js       # CRUD de tokens, movimento, drag
│   ├── useCamera.js       # Zoom e pan
│   ├── useRole.js         # Permissões Mestre/Jogador
│   ├── useScenes.js       # Gerenciamento de cenas
│   └── ...
└── utils/                 # Utilitários
    ├── collision.js       # Colisão, divisão de paredes, deduplicação
    ├── raycasting.js      # Polígono de visibilidade
    ├── dice.js            # Rolagem de dados
    └── ...
```

---

## Créditos

| | |
|---|---|
| **Criador / Desenvolvedor** | Gustavo Reginatto ([@GReginatto](https://github.com/GReginatto)) |
| **Sistema de RPG** | *Crepúsculo dos Reinos* — sistema próprio do grupo |


---

## Licença

Este projeto **não possui licença de uso comercial**.  
É um projeto pessoal criado para o lazer do grupo de RPG.  
Sinta-se à vontade para estudar o código, mas não redistribua ou use comercialmente sem permissão do autor.

---

