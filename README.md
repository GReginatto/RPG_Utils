# Crepúsculo dos Reinos — VTT

> **Projeto pessoal, sem fins comerciais.**  
> Criado exclusivamente para uso nas sessões de RPG do grupo, por diversão e lazer.  
> Não é um produto comercial e não possui qualquer vínculo com empresas ou publicações de RPG.

---

## O que é isso?

Um **Virtual Tabletop (VTT)** feito do zero no navegador para as sessões do RPG *Crepúsculo dos Reinos*. Um servidor pequeno (Node.js) roda no computador do Mestre: ele guarda contas, mapas e o estado da mesa, e sincroniza tudo em tempo real entre os jogadores da rede (LAN ou VPN como o Radmin).

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

## Jogar com os amigos (Radmin ou rede local)

**Pré-requisitos:** Node.js 18+ e npm. Na primeira vez, rode `npm install`.

1. No computador do Mestre, dê dois cliques em `INICIAR-MESA.bat` (ou rode `npm run mesa`). Ele compila o VTT e sobe o servidor na porta **3001**, mostrando os endereços.
2. **Primeira vez:** abra `http://localhost:3001` **no próprio computador do servidor** e crie a conta do Mestre. Pela rede ninguém consegue criar essa conta.
3. Os jogadores abrem `http://<IP do Radmin do Mestre>:3001`, clicam em **Criar conta de jogador** e esperam a aprovação.
4. O Mestre aprova em **Fichas → Gerenciar Jogadores** (✅). Ali também bloqueia, troca a senha ou remove contas; quem é bloqueado cai da mesa na hora.
5. Para encerrar, `Ctrl+C` na janela do servidor (o estado é salvo antes de sair).

O que fica sincronizado: mapa, cenas, tokens, paredes, névoa, desenhos, áreas de efeito, chat e rolagens, combate, fichas, diário, macros. Os jogadores não recebem tokens ocultos, paredes secretas, notas de cena, cenas inativas, o compêndio nem sussurros para outras pessoas, e o servidor recusa alterações que não sejam deles (só mexem no próprio token, na própria ficha e nas próprias mensagens).

**Dados e segurança:** tudo fica em `server-data/` (contas com senha em scrypt, sessões, `state.json`, imagens em `uploads/` e backups automáticos a cada 20 minutos em `backups/`). Essa pasta está no `.gitignore` e **nunca deve ir para o GitHub**. Para fazer backup da campanha, copie a pasta. O servidor não usa HTTPS: use-o só em rede privada (Radmin/LAN) com pessoas de confiança, nunca exposto na internet.

### Desenvolvimento

```bash
npm install
npm run server   # servidor da mesa na porta 3001
npm start        # interface com recarga automática em http://localhost:3000
npm test         # testes
```

---

## Tecnologias

- [React 19](https://react.dev/) + [Create React App](https://create-react-app.dev/)
- CSS-in-JS inline (sem frameworks de UI)
- Canvas 2D para iluminação e névoa
- SVG para paredes, AoE e camada de desenho
- Servidor Node.js com [ws](https://github.com/websockets/ws) (sincronização por diferenças em JSON) e arquivos JSON em `server-data/`

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

