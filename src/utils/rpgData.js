// RPG data constants — gerados a partir de utils/crepusculo-ficha-v5.html (canon de 2026-10-05, rodada 5 do artífice).
// Fonte única dos dados de jogo usados na CharacterSheet. Regras: livro/canon.md (decisões D-21…D-48 e PG).
// Para regenerar: extrair as constantes da ficha HTML (mesmos nomes entre parênteses).

export const ATTRS = [
  "FOR",
  "DEX",
  "CON",
  "SAB",
  "INT",
  "CAR",
  "DOM"
];
// "Dominação" × "Domínio": nome do atributo ⏳ P-039 (mantido como na ficha)
export const ATTR_FULL = {
  "FOR": "Força",
  "DEX": "Destreza",
  "CON": "Constituição",
  "SAB": "Sabedoria",
  "INT": "Inteligência",
  "CAR": "Carisma",
  "DOM": "Dominação"
};

// Raças (RACES): movimento por raça (9 m; anão 7 m); afinidade = 1 Área (D-37); efeito PA-11 (+2 treino, −10% MP)
export const RACES_DATA = {
  "Humano": {
    "bonus": {},
    "mv": 9,
    "af": "",
    "ab": "Adaptação: 2×/dia pode rerolar um teste de atributo. +1 em um atributo à escolha.",
    "c": "#c9a96e"
  },
  "Elfo": {
    "bonus": {
      "DEX": 1
    },
    "mv": 9,
    "af": "Mental",
    "ab": "Visão no escuro, +2 furtividade e iniciativa. Fraqueza: -1 CON.",
    "c": "#7ec8a0"
  },
  "Anão": {
    "bonus": {
      "CON": 1
    },
    "mv": 7,
    "af": "Emissora",
    "ab": "Imunidade a venenos, +2 resistência, visão no escuro. Fraqueza: -2m movimento.",
    "c": "#b07840"
  },
  "Demônio": {
    "bonus": {
      "DOM": 1
    },
    "mv": 9,
    "af": "Emissora",
    "ab": "+3 dano com fogo, 50% resistência a fogo. Fraqueza: -2 CAR com não-demônios.",
    "c": "#c43030"
  },
  "Anjo": {
    "bonus": {
      "SAB": 1
    },
    "mv": 9,
    "af": "Deformadora",
    "ab": "Escudo de absorção: 15 pts, 1×/dia. Fraqueza: 150% dano de Trevas.",
    "c": "#f0e68c"
  }
};

// Profissões (PP da ficha): bônus/penalidades, dado de HP e de MP (MP = dado + mod DOM). sk = perfil (listas de perícias ⏳ E4-01)
export const PROFESSIONS_DATA = {
  "Guerreiro": {
    "m": {
      "FOR": 2,
      "CON": 1,
      "INT": -2,
      "DOM": -1
    },
    "hp": "1d12",
    "mp": "1d4",
    "sk": "Armas marciais, armaduras pesadas, atletismo"
  },
  "Explorador": {
    "m": {
      "DEX": 2,
      "SAB": 1,
      "FOR": -1,
      "CON": -1,
      "DOM": -1
    },
    "hp": "1d8",
    "mp": "1d6",
    "sk": "Furtividade, sobrevivência, percepção"
  },
  "Estudioso": {
    "m": {
      "INT": 2,
      "SAB": 1,
      "FOR": -2,
      "CON": -1
    },
    "hp": "1d6",
    "mp": "1d10",
    "sk": "Arcanismo, história, investigação"
  },
  "Diplomata": {
    "m": {
      "CAR": 2,
      "INT": 1,
      "FOR": -1,
      "DEX": -1,
      "DOM": -1
    },
    "hp": "1d6",
    "mp": "1d8",
    "sk": "Persuasão, enganação, intuição"
  },
  "Arkano": {
    "m": {
      "DOM": 3,
      "INT": 2,
      "FOR": -3,
      "CON": -1,
      "DEX": -1
    },
    "hp": "1d6",
    "mp": "1d12",
    "sk": "Canalização de Arka, arcanismo, meditação"
  },
  "Guardião": {
    "m": {
      "CON": 2,
      "SAB": 2,
      "FOR": 1,
      "DEX": -3,
      "INT": -1,
      "CAR": -1
    },
    "hp": "1d12",
    "mp": "1d8",
    "sk": "Defesa, resistência, proteção de aliados"
  },
  "Curandeiro": {
    "m": {
      "SAB": 3,
      "CAR": 2,
      "FOR": -2,
      "DEX": -2,
      "DOM": -1
    },
    "hp": "1d8",
    "mp": "1d10",
    "sk": "Medicina, herbologia, cura por Arka"
  }
};

// Perícias (DP): 31 perícias (D-23, D-46). Criação: 4 da profissão + 2 livres (listas ⏳) → por ora 6 livres; + 2 proficiências livres de arma/ferramenta (D-45)
export const SKILLS = [
  {
    "n": "Atletismo",
    "a": "FOR"
  },
  {
    "n": "Vigor Bruto",
    "a": "FOR"
  },
  {
    "n": "Acrobacia",
    "a": "DEX"
  },
  {
    "n": "Furtividade",
    "a": "DEX"
  },
  {
    "n": "Prestidigitação",
    "a": "DEX"
  },
  {
    "n": "Condução",
    "a": "DEX"
  },
  {
    "n": "Pontaria Mecânica",
    "a": "DEX"
  },
  {
    "n": "Fôlego",
    "a": "CON"
  },
  {
    "n": "Concentração",
    "a": "CON"
  },
  {
    "n": "Teoria da Arka",
    "a": "INT"
  },
  {
    "n": "História",
    "a": "INT"
  },
  {
    "n": "Engenharia a Vapor",
    "a": "INT"
  },
  {
    "n": "Alquimia",
    "a": "INT"
  },
  {
    "n": "Investigação",
    "a": "INT"
  },
  {
    "n": "Lei e Licenças",
    "a": "INT"
  },
  {
    "n": "Navegação",
    "a": "INT"
  },
  {
    "n": "Percepção",
    "a": "SAB"
  },
  {
    "n": "Intuição",
    "a": "SAB"
  },
  {
    "n": "Medicina",
    "a": "SAB"
  },
  {
    "n": "Sobrevivência",
    "a": "SAB"
  },
  {
    "n": "Trato Animal",
    "a": "SAB"
  },
  {
    "n": "Vontade",
    "a": "SAB"
  },
  {
    "n": "Sentir Arka",
    "a": "SAB"
  },
  {
    "n": "Persuasão",
    "a": "CAR"
  },
  {
    "n": "Enganação",
    "a": "CAR"
  },
  {
    "n": "Intimidação",
    "a": "CAR"
  },
  {
    "n": "Atuação",
    "a": "CAR"
  },
  {
    "n": "Etiqueta das Linhagens",
    "a": "CAR"
  },
  {
    "n": "Barganha",
    "a": "CAR"
  },
  {
    "n": "Canalização",
    "a": "DOM"
  },
  {
    "n": "Pressão de Aura",
    "a": "DOM"
  }
];
export const SKILLS_AT_CREATION = 6;
export const FREE_TOOL_PROFS = 2;
export const SKILL_RENAMES = {
  "Adestrar Animais": "Trato Animal",
  "Arcanismo": "Teoria da Arka"
};

// Hexagrama da imagem auras.png (D-32, D-35, D-40). A ordem do array é o anel; opostos a 3 passos.
export const AURA_GROUPS = [
  {
    "n": "Primordial",
    "ag": 0,
    "c": "#f4d03f",
    "i": "✦"
  },
  {
    "n": "Emissora",
    "ag": 60,
    "c": "#9acd32",
    "i": "◈"
  },
  {
    "n": "Criadora",
    "ag": 120,
    "c": "#40c8d0",
    "i": "❋"
  },
  {
    "n": "Ícor",
    "ag": 180,
    "c": "#4a6ee0",
    "i": "⬡"
  },
  {
    "n": "Deformadora",
    "ag": 240,
    "c": "#b07cd8",
    "i": "◉"
  },
  {
    "n": "Mental",
    "ag": 300,
    "c": "#f0a050",
    "i": "◎"
  }
];

// Catálogo (AD): auras por Área (D-32). Primordial = auras em desenvolvimento (dev:true, sem níveis; D-41)
export const AURA_DETAILS = {
  "Primordial": [
    {
      "n": "Selamento",
      "dev": true,
      "d": "Fechar e estabilizar a Arka, como fazem os Selos; no nível 3, um mini-Selo."
    },
    {
      "n": "Dreno",
      "dev": true,
      "d": "Absorver a Arka do ambiente e de outros seres."
    },
    {
      "n": "Nulidade",
      "dev": true,
      "d": "Silenciar auras; custo alto."
    },
    {
      "n": "Corrente",
      "dev": true,
      "d": "Ler e manipular os veios de Arka do terreno; viagem entre Selos."
    }
  ],
  "Emissora": [
    {
      "n": "Fogo",
      "l": [
        "Manipula fogo existente no ambiente em um raio de até 3 metros com dificuldade média. Pode gerar pequenas chamas (equivalentes a uma vela) a partir do próprio corpo. Possui 25% de resistência a danos de fogo.",
        "Controla facilmente o fogo ambiente em um raio de até 10 metros. Gera chamas médias (equivalentes a uma fogueira) a partir do próprio corpo. Pode direcionar o fogo em trajetórias simples. Possui 50% de resistência a danos de fogo.",
        "Realiza manipulações complexas com fogo em um raio de até 30 metros, incluindo formas precisas e movimentos elaborados. Pode criar um mini plano de fogo (área de 5 metros de diâmetro) a partir do próprio corpo. Possui 100% de imunidade a danos de fogo, mas sofre 30% a mais de dano de água."
      ]
    },
    {
      "n": "Água",
      "l": [
        "Manipula até 10 litros de água no ambiente em um raio de até 3 metros com dificuldade média. Pode alterar o fluxo e a direção da água existente. Possui 25% de resistência a danos de água.",
        "Controla facilmente até 100 litros de água no ambiente em um raio de até 10 metros. Cria jatos e correntes com pressão suficiente para derrubar um humano. Pode extrair umidade do ar em ambientes úmidos. Possui 50% de resistência a danos de água.",
        "Manipula até 1000 litros de água em um raio de até 30 metros. Cria barreiras ou esferas de proteção capazes de deter projéteis. Pode extrair água de plantas e corpos. Possui 100% de imunidade a danos de água, mas sofre 30% a mais de dano de fogo."
      ]
    },
    {
      "n": "Vento",
      "l": [
        "Controla correntes de ar suaves (até 20 km/h) e realiza rajadas de vento moderadas em um raio de até 5 metros. Pode desviar pequenos projéteis e alterar levemente a trajetória de objetos leves. Possui 25% de resistência a danos relacionados ao vento.",
        "Controla com facilidade ventos de até 60 km/h em um raio de até 15 metros. Pode criar ventanias fortes ou formar pequenos tornados (1 metro de diâmetro) que duram até 1 minuto. Capaz de desviar projéteis médios. Possui 50% de resistência a danos relacionados ao vento.",
        "Manipula ventos intensos de até 120 km/h em um raio de até 50 metros. Pode criar furacões localizados (5 metros de diâmetro) ou gerar uma corrente de ar que permite levitar a até 10 metros do solo por até 10 minutos. Possui 100% de imunidade a danos relacionados ao vento, mas sofre 30% a mais de dano de ataques de terra."
      ]
    },
    {
      "n": "Terra",
      "l": [
        "Manipula até 50 kg de terra ou pedras em um raio de até 5 metros. Pode criar pequenas elevações no solo (até 50 cm de altura) ou lançar projéteis de pedra com força moderada. Possui 25% de resistência a danos relacionados à terra.",
        "Controla com facilidade até 500 kg de terra e rochas em um raio de até 15 metros. Pode criar estruturas de até 3 metros de altura ou causar tremores leves que desequilibram oponentes em um raio de 10 metros. Possui 50% de resistência a danos relacionados à terra.",
        "Manipula até 5 toneladas de terra em um raio de até 50 metros. Pode criar formações rochosas de até 10 metros de altura ou abrir fissuras de até 3 metros de largura e 10 metros de profundidade. Possui 100% de imunidade a danos relacionados à terra, mas sofre 30% a mais de dano de ataques de vento."
      ]
    },
    {
      "n": "Venenosa",
      "l": [
        "Cria nuvens tóxicas de até 2 metros de diâmetro que causam dano leve (1d4 por turno) e manipula até 1 litro de venenos líquidos presentes no ambiente em um raio de até 5 metros. Recebe apenas 50% do dano normal de toxinas e venenos.",
        "Manipula facilmente até 10 litros de veneno em um raio de até 15 metros. Cria nuvens tóxicas de até 10 metros de diâmetro que causam dano moderado (2d6 por turno) ou lança rajadas de toxinas (alcance de 10 metros) que provêm do próprio corpo. Pode alterar a composição de venenos existentes, modificando seus efeitos. Possui 100% de imunidade a danos relacionados a toxinas e venenos.",
        "Manipula até 100 litros de veneno em um raio de até 50 metros. Pode criar formas sólidas de veneno cristalizado (com dureza equivalente ao aço) ou transformar-se em uma névoa venenosa por até 10 minutos. Pode criar novos tipos de venenos com efeitos personalizados. É imune a venenos. Quando recebe dano de veneno de outra fonte, recupera como pontos de vida 50% desse dano (máximo de 2 × nível por turno). Os próprios venenos do usuário não o curam. Sofre 50% a mais de dano de fogo."
      ]
    },
    {
      "n": "Sombria",
      "l": [
        "Manipula sombras existentes em um raio de até 5 metros. Pode criar pequenos objetos sombrios (até 30 cm) ou obscurecer uma área de até 3 metros de diâmetro, reduzindo a visibilidade. Só pode manipular sombras já presentes e que provêm de objetos próximos. Possui 25% de resistência a danos de trevas.",
        "Controla com facilidade as sombras em um raio de até 15 metros. Pode se camuflar na escuridão (concedendo +10 em testes de furtividade), manipular sombras de outros corpos, e gerar sombra própria que não se dissipa em contato com luz fraca ou moderada. Possui 50% de resistência a danos de trevas.",
        "Manipula a escuridão em um raio de até 50 metros. Pode criar portais sombrios para se teleportar até 100 metros entre áreas de sombra ou transformar-se em uma sombra intangível por até 5 minutos. Suas sombras só se dissipam após 10 minutos de exposição direta a luz intensa (como luz solar do meio-dia). Possui 100% de imunidade a danos de trevas, mas sofre 50% a mais de dano de luz."
      ]
    },
    {
      "n": "Nebulosa",
      "l": [
        "Cria uma neblina densa que cobre uma área de até 5 metros de diâmetro ou emite pequenas rajadas de névoa com alcance de até 3 metros. Pode ficar parcialmente invisível (50% de chance de não ser detectado) quando envolto em neblina natural ou criada. Possui 25% de resistência a danos relacionados à névoa/neblina.",
        "Manipula com facilidade a névoa em um raio de até 15 metros. Pode criar nevoeiros espessos que cobrem até 20 metros de diâmetro ou controlar a visibilidade em uma área, criando \"janelas\" de visão clara em meio à névoa. Torna-se completamente invisível em meio à neblina. Possui 50% de resistência a danos relacionados à névoa/neblina.",
        "Controla névoa em um raio de até 50 metros. Pode criar tempestades de névoa que cobrem até 100 metros de diâmetro e reduzem a visibilidade a zero, ou se transformar em uma forma intangível de neblina por até 10 minutos, podendo passar por frestas e pequenas aberturas. Possui 100% de imunidade a danos relacionados à névoa/neblina, mas sofre 30% a mais de dano de ataques de fogo."
      ]
    }
  ],
  "Criadora": [
    {
      "n": "Materialização",
      "l": [
        "Materializa sua aura em objetos físicos com resistência variável (da leveza da seda até a dureza do ferro). Pode criar objetos pequenos (até 30 cm em qualquer dimensão) sem conhecer sua estrutura interna. As criações duram até 1 hora ou até receberem dano significativo. Volume máximo: 10 litros.",
        "Cria objetos de tamanho médio (até 1,5 metros em qualquer dimensão) que duram até serem desfeitos voluntariamente ou sofrerem dano crítico. Pode materializar objetos complexos (como mecanismos simples) se conhecer seu funcionamento básico. Volume máximo: 100 litros.",
        "Cria materiais com resistência equivalente ao grafeno (10 vezes mais resistente que o aço). Pode materializar objetos complexos (como dispositivos mecânicos elaborados) sem conhecer seu funcionamento detalhado, e objetos grandes (até 3 metros em qualquer dimensão) com conhecimento parcial. As criações podem durar indefinidamente se receberem manutenção periódica. Volume máximo: 1000 litros."
      ]
    },
    {
      "n": "Rejuvenescimento",
      "l": [
        "Restaura objetos pequenos (até 30 cm) a seu estado original sem conhecer sua estrutura, e objetos médios (até 1 metro) se conhecer seu funcionamento. Cura até 2d6 pontos de vida em ferimentos recentes (menos de 1 hora) em outras pessoas ou em si mesmo. Pode ser usado 3 vezes por dia.",
        "Restaura objetos de tamanho médio (até 1,5 metros) sem conhecer sua estrutura interna. Cura até 4d8 pontos de vida em ferimentos de até 24 horas e pode estabilizar personagens caídos em combate, impedindo a morte por 1 hora. Pode ser usado 5 vezes por dia.",
        "Restaura objetos grandes (até 3 metros) conhecendo apenas parcialmente seu funcionamento. Cura até 8d8 pontos de vida em ferimentos de até 3 dias, e pode reviver pessoas mortas há menos de 10 minutos, desde que o corpo esteja relativamente intacto. Pode ser usado 7 vezes por dia."
      ]
    },
    {
      "n": "Animalesca",
      "l": [
        "Aprimora os sentidos (visão, audição, olfato) em 100%, concedendo +5 em testes de Percepção. Aumenta uma característica física (velocidade, força ou agilidade) em 50%, concedendo +3 no atributo correspondente. Pode se comunicar telepaticamente com animais em um raio de 10 metros e manifestar partes animais (garras, presas, etc.) em membros pequenos por até 1 hora, 3 vezes ao dia.",
        "Transforma-se completamente em um animal não-mítico de tamanho pequeno ou médio por até 3 horas, adquirindo todas as suas capacidades físicas. Pode manifestar partes de animais míticos menores (como garras de grifo ou escamas de basilisco) em até 30% do corpo por 1 hora, 2 vezes ao dia.",
        "Transforma-se em qualquer animal não mítico que tenha observado por pelo menos 10 minutos, independentemente do tamanho, por até 12 horas. As transformações mantêm a consciência e inteligência originais.<br><br><b>Forma de Besta Lendária:</b> uma vez por dia, o usuário se transforma por até 1 hora numa besta lendária e, a cada transformação, escolhe uma das duas formas abaixo. Em qualquer delas, mantém a capacidade de fala e inteligência originais.<br><b>Dragão</b> (a antiga aura Dracônica): dragão de 5 metros de comprimento; escolhe um elemento (fogo, gelo, ácido ou eletricidade). Ganha Força 20, CA natural de 18, imunidade ao elemento escolhido e sopro dracônico desse elemento de 10 metros, causando 8d6 de dano (recarrega a cada 1d4 turnos).<br><b>Animal mítico menor</b> (grifo jovem, pequeno basilisco, hidra jovem): adquire as capacidades físicas dele (voo, olhar, cabeças, veneno). Os números da forma são definidos com o Mestre e nunca superam os do dragão: Força até 20, CA natural até 18 e um ataque especial de até 8d6 (recarga de 1d4 turnos)."
      ]
    },
    {
      "n": "Naturae",
      "l": [
        "Acelera o crescimento de plantas e vegetação ao toque, fazendo-as crescer até 10 vezes mais rápido que o normal. As plantas afetadas podem sobreviver em superfícies inóspitas (pedras, areia, etc.) por até 1 semana. Pode afetar uma área de até 5 metros de raio e identificar propriedades medicinais ou tóxicas de qualquer planta.",
        "Além das capacidades do nível 1, pode gerar plantas e frutos com efeitos mágicos específicos (cura 2d8 PV, veneno que causa 2d6 de dano, efeito de sono por 1d4 horas, etc.). Afeta uma área de até 20 metros de raio. Sua presença apazigua vegetações contaminadas ou danosas em um raio de 10 metros, neutralizando seus efeitos nocivos por 1 hora.",
        "Faz crescer pequenas florestas (até 100 metros de raio) em questão de horas, mesmo em terrenos completamente estéreis. As plantas criadas podem ter propriedades especiais (luminescência, resistência ao fogo, capacidade de movimento limitado). Pode infundir vida em objetos inanimados de origem natural (madeira, pedra, etc.), criando criaturas (como um golem) com até 100 PV que obedecem a comandos simples por até 24 horas."
      ]
    }
  ],
  "Ícor": [
    {
      "n": "Aura Própria",
      "l": [
        "Uma aura extremamente rara que permite ao usuário criar sua própria manifestação de poder, não limitada pelas categorias convencionais. Deve respeitar a regra dos três níveis de progressão e ser submetida ao mestre para balanceamento. O poder da aura Ícor deve ser equivalente às outras auras em cada nível, mas com efeitos únicos.",
        "A criação de uma aura Ícor deve incluir: descrição detalhada dos efeitos em cada nível, limitações específicas (tempo, alcance, recursos), possíveis fraquezas ou vulnerabilidades, e progressão lógica entre os níveis.",
        "Recomenda-se que o mestre estabeleça limitações claras (número de usos por dia, duração dos efeitos, área de alcance) para manter o equilíbrio do jogo."
      ]
    }
  ],
  "Deformadora": [
    {
      "n": "Morfologista",
      "l": [
        "Realiza alterações leves na forma física de objetos ou seres vivos, afetando até 10% do volume total. Pode modificar texturas, cores e propriedades superficiais. Altera propriedades químicas simples (como pH ou solubilidade) por até 1 hora. As alterações em seres vivos são temporárias (duração de 10 minutos) e requerem consentimento ou um teste de resistência.",
        "Permite alterações que afetam até 50% do volume de um objeto ou ser vivo. Pode modificar estruturas internas simples e alterar propriedades químicas e físicas (densidade, estado da matéria, reatividade) por até 24 horas. Pode transformar objetos externos em híbridos com corpos orgânicos, criando enxertos temporários (duração de 1 hora) ou permanentes (com sucesso em teste de Constituição).",
        "Controle total sobre a morfologia, podendo transformar completamente sua própria forma física ou a de outros seres vivos (com consentimento ou falha em teste de resistência com -5 de penalidade). Pode criar formas híbridas complexas que combinam características de múltiplas espécies por tempo indefinido. Altera permanentemente propriedades químicas e físicas de objetos e substâncias, podendo criar materiais com propriedades únicas."
      ]
    },
    {
      "n": "Luz",
      "l": [
        "Cria pequenas chamas douradas com propriedades purificadoras em um raio de até 5 metros. Estas chamas causam 2d6 de dano a criaturas das trevas ou podem purificar alvos afetados por maldições menores, restaurando 1d8 pontos de vida. A luz gerada ilumina uma área de 10 metros de raio e dura até 10 minutos. Possui 25% de resistência a danos de trevas.",
        "Controla com facilidade a luz sagrada em um raio de até 15 metros, criando chamas douradas mais brilhantes que causam 4d6 de dano a criaturas das trevas e dissipam maldições de nível médio. A luz gerada pode cegar temporariamente oponentes (teste de Constituição ou ficam cegos por 1d4 turnos) e ilumina uma área de 30 metros de raio por até 1 hora. Possui 50% de resistência a danos de trevas.",
        "Domínio total sobre a luz divina em um raio de até 50 metros. Cria chamas douradas intensas que causam 8d6 de dano a criaturas das trevas, bane a escuridão mágica instantaneamente e quebra maldições poderosas. Pode criar explosões de luz que causam 6d8 de dano em uma área de 10 metros de raio. Possui 100% de imunidade a danos de trevas, mas sofre 30% a mais de dano de ataques caóticos."
      ]
    },
    {
      "n": "Trevas",
      "l": [
        "Cria áreas de escuridão intensa de até 5 metros de raio, obscurecendo completamente a visão normal. Criaturas dentro da área sofrem -5 em testes de Percepção e Ataque. A escuridão dura até 10 minutos e pode ser dissipada por luz mágica de nível equivalente. Possui 25% de resistência a danos de luz.",
        "Amplia a escuridão para áreas de até 15 metros de raio, criando uma atmosfera opressora que causa desconforto psicológico (-2 em testes de Vontade) a criaturas não acostumadas às trevas. Pode solidificar sombras para criar barreiras temporárias (30 PV, duração de 10 minutos) ou tentáculos que restringem movimento. Possui 50% de resistência a danos de luz.",
        "Controle absoluto sobre as trevas em um raio de até 50 metros. Cria escuridão total que anula mesmo fontes mágicas de luz de nível inferior. Criaturas na área devem fazer um teste de Vontade ou sofrem efeito de medo. Pode criar construtos de sombra sólida (100 PV) que obedecem a comandos simples por até 1 hora. Possui 100% de imunidade a danos de trevas, mas sofre 50% a mais de dano de ataques de luz."
      ]
    },
    {
      "n": "Realidade",
      "l": [
        "Cria pequenas distorções na realidade em um raio de até 5 metros. Pode gerar ilusões simples que afetam um sentido (visão, audição, etc.) e alterar sutilmente propriedades físicas (como fazer um objeto parecer mais pesado ou leve). As distorções duram até 10 minutos e podem ser percebidas com um teste de Percepção com dificuldade média.",
        "Cria ilusões complexas em um raio de até 15 metros que afetam todos os sentidos simultaneamente. Pode distorcer a percepção em uma área maior, alterando como as pessoas interpretam o ambiente (fazendo uma porta parecer uma parede, por exemplo). As ilusões duram até 1 hora e requerem um teste de Percepção com dificuldade alta para serem identificadas.",
        "Controle significativo sobre a realidade em um raio de até 30 metros. Pode criar ilusões praticamente indistinguíveis da realidade, modificar leis físicas localmente (alterar a gravidade, permitir que objetos atravessem paredes, etc.) e criar pequenos bolsões de realidade alternativa (até 10 metros de diâmetro) onde as regras são diferentes. Estes efeitos duram até 24 horas e só podem ser detectados por criaturas com habilidades especiais de percepção da realidade."
      ]
    },
    {
      "n": "Gravitacional",
      "l": [
        "Manipula ligeiramente a gravidade em objetos pequenos (até 50 kg) em um raio de até 10 metros. Pode aumentar ou diminuir o peso aparente em até 50%, alterando sua trajetória ou intensidade. Os efeitos duram até 5 minutos e requerem concentração para serem mantidos.",
        "Cria campos gravitacionais intensos ou negativos em um raio de até 20 metros, afetando objetos de até 500 kg. Pode aumentar a gravidade em uma área de 5 metros de diâmetro (reduzindo o movimento pela metade e causando -4 em testes de Destreza) ou criar zonas de gravidade zero onde objetos e criaturas flutuam. Os efeitos duram até 10 minutos.",
        "Domínio significativo sobre a gravidade em um raio de até 50 metros. Pode criar campos gravitacionais poderosos que afetam objetos de até 5 toneladas, gerar pontos de atração gravitacional que funcionam como mini buracos negros (sugando tudo num raio de 10 metros), ou anular completamente a gravidade em uma área de 30 metros de diâmetro. Os efeitos duram até 1 hora."
      ]
    },
    {
      "n": "Vetorial",
      "l": [
        "Manipula a direção e a velocidade de objetos pequenos (até 5 kg) em um raio de até 10 metros. Pode alterar a trajetória de projéteis, aumentar ou diminuir a velocidade de objetos em até 50%, e redirecionar o movimento de líquidos. Os efeitos duram até que o objeto pare naturalmente ou por 1 minuto.",
        "Manipula vetores com precisão em um raio de até 20 metros, afetando objetos de até 100 kg. Pode alterar completamente a direção de movimento, multiplicar a velocidade por até 3x, ou anular completamente o momentum de um objeto em movimento. Afeta até 5 objetos simultaneamente. Os efeitos duram até 5 minutos.",
        "Controle total sobre vetores em um raio de até 50 metros, manipulando a direção, velocidade e impulso de objetos de até 1 tonelada ou corpos inteiros. Pode criar \"zonas vetoriais\" onde todas as forças físicas seguem direções predeterminadas, independentemente das leis normais da física. Pode afetar até 20 objetos simultaneamente. Os efeitos duram até 30 minutos."
      ]
    },
    {
      "n": "Temporal",
      "l": [
        "Realiza manipulações temporais sutis em um raio de até 3 metros. Pode acelerar ou retardar o tempo em até 50% em uma área pequena ou em um corpo, afetando processos naturais (como decomposição, crescimento) ou a velocidade percebida de ações. Os efeitos duram até 1 minuto e afetam apenas um alvo por vez.",
        "Manipula o tempo em um raio de até 10 metros. Pode acelerar o tempo (2x mais rápido), retardá-lo (até 75% mais lento) ou pausá-lo completamente por até 10 segundos em uma área de até 5 metros de diâmetro. Pode criar distorções temporais que fazem com que eventos ocorram fora de sequência e realizar pequenos saltos no tempo (até 5 minutos, afetando apenas o próprio usuário). Pode afetar até 3 alvos simultaneamente.",
        "Controle avançado sobre o tempo em um raio de até 30 metros. Pode prender objetos ou seres de até 500 kg em estase temporal por até 1 hora, prever eventos até 30 segundos no futuro com 80% de precisão, e manipular o fluxo temporal em uma área de até 20 metros de diâmetro. Pode criar bolsões onde o tempo flui diferentemente (10x mais rápido ou lento) por até 10 minutos."
      ]
    }
  ],
  "Mental": [
    {
      "n": "Raksasha",
      "l": [
        "Desenvolve intuição aguçada e percepção ampliada, concedendo +5 em testes de Intuição e Percepção. Detecta sutilezas nas emoções e intenções das pessoas em um raio de até 10 metros, identificando mentiras simples com 70% de precisão. Possui 25% de resistência à manipulação mental e ilusões.",
        "Lê pensamentos superficiais (informações imediatas, não memórias) de até 3 pessoas simultaneamente em um raio de 20 metros. Discerne mentiras complexas com 90% de precisão e identifica quando alguém está sob efeito de manipulação mental. Possui 50% de resistência à influência mental e recebe +5 em testes de Carisma relacionados à persuasão e enganação.",
        "Realiza leitura profunda da mente de até 5 pessoas simultaneamente em um raio de 50 metros, acessando memórias específicas (com teste de resistência do alvo) e pensamentos complexos. Pode implantar memórias falsas simples (duração de 1d4 dias) e projetar seus próprios pensamentos para influenciar sutilmente as decisões de outros. Possui 90% de resistência mental a efeitos de controle e ilusão."
      ]
    },
    {
      "n": "Ilusão",
      "l": [
        "Cria ilusões simples que afetam um ou dois sentidos (geralmente visão e audição) em um raio de até 10 metros. As ilusões podem ter até 2 metros em qualquer dimensão e afetar até 3 pessoas simultaneamente. Alvos podem realizar testes de Sabedoria (dificuldade média) para perceber a ilusão. Os efeitos duram até 10 minutos.",
        "Gera ilusões complexas que afetam múltiplos sentidos (visão, audição, olfato, e sensação térmica) em um raio de até 30 metros. As ilusões podem ter até 10 metros em qualquer dimensão e afetar até 10 pessoas. Alvos fazem testes de Sabedoria com dificuldade alta para perceber a falsidade. Os efeitos duram até 1 hora.",
        "Cria projeções praticamente indistinguíveis da realidade que afetam todos os sentidos em um raio de até 100 metros. As ilusões podem ter até 50 metros em qualquer dimensão, afetar um número ilimitado de observadores, e incluir interações físicas limitadas (sensação de solidez, calor/frio, etc.). Apenas indivíduos com resistência mental excepcional (acima de 18 em Sabedoria) ou habilidades especiais de detecção podem perceber a ilusão. Os efeitos duram até 24 horas."
      ]
    },
    {
      "n": "Copiadora",
      "l": [
        "Copia habilidades e conhecimentos simples (equivalentes a perícias de nível básico) de outros por até 1 hora, requerendo observação cuidadosa por pelo menos 10 minutos e proximidade física (toque). Pode copiar até 3 habilidades por dia, uma de cada vez.",
        "Copia habilidades mais complexas (equivalentes a perícias de nível avançado ou habilidades de classe básicas) sem necessidade de contato físico, apenas observação por 5 minutos a uma distância de até 10 metros. As cópias duram até 6 horas e podem manter até 2 habilidades simultaneamente. Pode realizar até 5 cópias por dia.",
        "Copia perfeitamente qualquer habilidade ou conhecimento (incluindo magias de até nível 5 e habilidades de classe avançadas) após apenas 1 minuto de observação a uma distância de até 50 metros. As cópias duram até 24 horas e pode manter até 3 habilidades simultaneamente. Pode realizar até 7 cópias por dia."
      ]
    },
    {
      "n": "Caótica",
      "l": [
        "Cria pequenos distúrbios e desordens no ambiente em um raio de até 10 metros. Pode causar falhas em mecanismos simples, alterar levemente as propriedades de materiais (tornar líquidos mais viscosos, superfícies mais escorregadias), ou gerar pequenas anomalias sensoriais (cores invertidas, sons distorcidos). Os efeitos duram até 10 minutos.",
        "Gera ondas de caos que afetam áreas de até 30 metros de raio. Pode distorcer parcialmente a realidade física (fazer objetos flutuar brevemente, inverter a direção da gravidade por segundos) e causar rupturas temporais menores (déjà vu, breves vislumbres do passado/futuro próximo). Os efeitos duram até 30 minutos e podem afetar até 10 alvos simultaneamente.",
        "Domínio significativo sobre o caos em um raio de até 100 metros. Cria distorções massivas na realidade (transformações aleatórias de matéria, portais temporários para locais aleatórios) e eventos caóticos planejados (sequências de coincidências impossíveis que levam a um resultado específico). A aura pode se rebelar contra o usuário se não for controlada com cuidado (teste de Vontade com dificuldade alta a cada uso prolongado). Os efeitos podem durar até 1 hora."
      ]
    },
    {
      "n": "Espiritual",
      "l": [
        "Manifesta uma entidade espiritual visível que age como extensão da vontade do usuário. A entidade tem forma humanoide básica, pode se mover até 10 metros do usuário e realizar ataques físicos básicos (1d8 de dano) ou defender (CA 14). Possui 30 PV e permanece manifestada por até 10 minutos, 3 vezes por dia.",
        "A conexão com a entidade é fortalecida, permitindo que ela se mova até 30 metros do usuário. Seus atributos melhoram significativamente (ataques causam 2d8 de dano, CA 16, 60 PV) e ela desenvolve uma habilidade especial baseada na personalidade do usuário (ataque elemental, cura, detecção de mentiras, etc.). Permanece manifestada por até 30 minutos, 5 vezes por dia.",
        "A entidade alcança seu potencial máximo, com forma única e distintiva. Possui atributos excepcionais (ataques causam 3d8 de dano, CA 18, 120 PV) e múltiplas habilidades especiais. O usuário e a entidade têm turnos separados em combate, permitindo duas ações por rodada, e podem realizar ataques especiais combinados (4d10 de dano) uma vez por combate. Permanece manifestada por até 1 hora, 7 vezes por dia."
      ]
    }
  ]
};

// Despertar Divino (DIV): nível 4 da aura base (D-05). Sem custo de PP; exige aura no nv 3 + acontecimento de lore (D-47)
export const DIVINE = {
  "Temporal": {
    "n": "Chronos (Chrono-mente)",
    "l": [
      "A mente do usuário é aprimorada com compreensão profunda dos mecanismos do tempo, resultando em inteligência excepcional (+4 em testes de Inteligência). Pode perceber padrões temporais sutis, prever eventos simples com minutos de antecedência (70% de precisão) e compreender idiomas após apenas 1 hora de exposição. Inclui as habilidades de Temporal 1.",
      "Percepção ampliada da complexidade dos padrões temporais, permitindo processamento mental acelerado (resolve problemas complexos em metade do tempo normal). Pode visualizar linhas temporais alternativas para decisões imediatas (vantagem em testes de estratégia) e compreender textos antigos ou códigos complexos instantaneamente. Inclui as habilidades de Temporal 2.",
      "Inteligência temporal que transcende o conhecimento convencional (+8 em testes de Inteligência). Pode alterar sua própria percepção do tempo, experimentando até 1 hora de pensamento em apenas 1 minuto real. Visualiza múltiplas linhas temporais simultaneamente, identificando a mais favorável com 90% de precisão. Inclui as habilidades de Temporal 3."
    ]
  },
  "Terra": {
    "n": "Ódin (Mjölnirsonância)",
    "l": [
      "O corpo do usuário é aprimorado pela força primordial, permitindo golpes com energia universal. Ataques corpo-a-corpo causam +1d8 de dano de força e podem afetar criaturas incorpóreas. Recebe +2 em testes de Força e Constituição. Inclui as habilidades de Terra 1.",
      "Golpes recebem o modificador de Sabedoria (pela metade) como dano adicional, e o usuário fica invulnerável a ataques não-mágicos por 1 rodada após realizar um ataque bem-sucedido (limite de 5 vezes por dia). Pode canalizar energia através de armas, criando ondas de choque num raio de 3 metros (2d6 de dano). Inclui as habilidades de Terra 2.",
      "O corpo se torna manifestação da força primordial, com pele que brilha sutilmente em situações de combate. Golpes causam +3d8 de dano de força, ignoram resistências físicas e podem afetar inimigos imunes a golpes físicos. Uma vez por dia, pode invocar um ataque devastador que causa 10d10 de dano em uma linha de 30 metros. Inclui as habilidades de Terra 3."
    ]
  },
  "Naturae": {
    "n": "Hera (Voz de Argos)",
    "l": [
      "Conhecimento inato sobre plantas e substâncias naturais com propriedades curativas e mágicas (+5 em testes relacionados). Pode identificar qualquer planta ou veneno natural instantaneamente e manipular pequenas quantidades (até 1 kg) de materiais inorgânicos e orgânicos, alterando suas propriedades básicas. Inclui as habilidades de Naturae 1.",
      "Cria poções e encantamentos poderosos com plantas comuns (cura 4d8 PV, antídotos universais, poções de força/agilidade que concedem +4 no atributo). Pode convocar proteção de animais e criaturas míticas menores (1d4+1 animais normais ou 1 criatura mítica menor) que servem por até 1 hora, uma vez por dia. Inclui as habilidades de Naturae 2.",
      "Domina os segredos da natureza, criando itens mágicos temporários a partir de plantas (duração de 1d4 dias). Pode invocar a fúria da natureza para defender aliados (plantas animadas, enxames de insetos) ou punir aqueles que desrespeitam o equilíbrio natural (praga localizada, crescimento acelerado que destrói estruturas). Uma vez por semana, pode realizar um ritual para curar qualquer doença ou maldição relacionada à natureza. Inclui as habilidades de Naturae 3."
    ]
  },
  "Vetorial": {
    "n": "Hachiman (Dança das Lâminas)",
    "l": [
      "Coordenação e reflexos aprimorados (+3 em testes de Destreza), com bônus de dano (+1d6) ao usar espadas e arcos longos. Pode realizar ataques precisos que ignoram 2 pontos de CA do oponente. Movimentos fluidos concedem +2 em testes de Esquiva. Inclui as habilidades de Vetorial 1.",
      "Movimentos quase imperceptíveis em combate (+5 em testes de Iniciativa), com golpes rápidos que permitem um ataque adicional por rodada com -2 de penalidade. Pode desviar de projéteis com teste de Destreza bem-sucedido e realizar ataques precisos que causam dano crítico em 19-20. Inclui as habilidades de Vetorial 2.",
      "Desafia as leis da gravidade, movendo-se quase instantaneamente (velocidade de movimento +10m) e antecipando movimentos dos oponentes (ataques de oportunidade contra qualquer inimigo que entre ou saia do seu alcance). Pode realizar uma sequência de até 5 ataques em um único turno contra múltiplos oponentes, uma vez por combate. Inclui as habilidades de Vetorial 3."
    ]
  },
  "Materialização": {
    "n": "Baco (Encanto Ébrio)",
    "l": [
      "Manifesta carisma cativante (+4 em testes de Carisma) que permite influenciar sutilmente as emoções de até 3 pessoas simultaneamente, criando um efeito similar à embriaguez leve (penalidade de -2 em testes de Vontade). Pode identificar e aprimorar qualquer bebida alcoólica com um toque. Inclui as habilidades de Materialização 1.",
      "Cria uma atmosfera mágica em um raio de 10 metros que afeta até 10 pessoas, induzindo estados emocionais específicos (euforia, melancolia, coragem). Manipula bebidas alcoólicas para criar poções temporárias (duração de 1 hora) com efeitos variados (cura 2d8 PV, +4 em um atributo, imunidade a medo). Inclui as habilidades de Materialização 2.",
      "Manifesta carisma transcendente (+8 em testes de Carisma) que permite hipnotizar e controlar sutilmente as ações de até 20 pessoas por até 1 hora (teste de Vontade para resistir). Cria vinhos místicos com efeitos sobrenaturais duradouros (clarividência, juventude temporária, cura de doenças). Uma vez por semana, pode realizar um banquete mágico que concede benefícios específicos a todos os participantes por 1d4 dias. Inclui as habilidades de Materialização 3."
    ]
  },
  "Morfologista": {
    "n": "Xing Tian (Resiliência Inabalável)",
    "l": [
      "Constituição fortalecida (+4 em testes de Constituição) que permite resistir a efeitos ambientais extremos (calor, frio, altitude) e manter o foco mesmo sob pressão (+2 em testes de Concentração). Recupera +2 PV por nível a cada descanso curto. Inclui as habilidades de Morfologista 1.",
      "Regeneração acelerada (1 PV por minuto) e imunidade temporária a efeitos debilitantes (venenos, doenças, fadiga) por até 1 hora, 3 vezes por dia. Pode continuar lutando mesmo com 0 PV por até 5 rodadas antes de cair inconsciente. Inclui as habilidades de Morfologista 2.",
      "Imunidade permanente a venenos e doenças naturais, podendo purificar substâncias tóxicas com um toque. Regenera 5 PV por rodada e pode ativar um fervor guerreiro que aumenta drasticamente as habilidades físicas (+6 em Força, Destreza e Constituição) por até 10 minutos, uma vez por dia. Pode sobreviver a ferimentos normalmente fatais, regenerando-se completamente após 1d4 dias. Inclui as habilidades de Morfologista 3."
    ]
  }
};

// XP para subir do nível (índice+1) ao seguinte (cap. 12 + PB-6). Nível 3–15.
export const XP_TABLE = [
  0,
  0,
  300,
  500,
  800,
  1200,
  1800,
  2500,
  3500,
  4000,
  4500,
  5000,
  5500,
  6000,
  0
];
export const LV_MIN = 3, LV_MAX = 15;
export const MILESTONES = {
  "3": "Início da campanha (aura hereditária no nv 1)",
  "4": "—",
  "5": "Second Wind (25% do MP, 1×/combate)",
  "6": "—",
  "7": "Técnica Assinatura (−25% de custo)",
  "8": "—",
  "9": "Second Wind 2×/combate",
  "10": "Técnica Máxima disponível",
  "11": "2ª Técnica Assinatura",
  "12": "—",
  "13": "+1 dado no Projetar máximo (6d8 por 36 MP)",
  "14": "—",
  "15": "Legado da Arka (escolha 1)"
};
export const LEGACY_OPTIONS = [
  "Expansão de Domínio sem Exaustão, 1×/dia",
  "Fortalecimento permanente de +50% (não ocupa slot)"
];

export const GENERIC_TECHS = [
  {
    "n": "Projetar",
    "tag": "Todas as Auras",
    "tagC": "#9b59b6",
    "desc": "Concentra a aura na palma da mão e lança como projétil contra um oponente.",
    "cost": "6 MP (mín) — 30 MP (máx por ataque) · A partir do nível 13: até 36 MP",
    "dmg": "1d8 por cada 6 MP utilizado, até 5d8 (30 MP) · Nível 13+: 6d8 (36 MP)",
    "range": "Curto (≤10m): sem penalidade · Médio (10–30m): −2 acerto · Longo (30–50m): −5 acerto",
    "extra": "Tipo de dano: o da aura escolhida pelo jogador (com várias auras, escolhe de qual); usuários da mesma aura podem ser imunes um ao outro. Efeito pós-disparo (1d4 turnos): Fogo: 1d4 queimadura/turno · Água: −2 movimento · Terra: −2 esquiva · Vento: −2 próx. ataque · Outros: padrão similar"
  },
  {
    "n": "Manifestar",
    "tag": "Todas as Auras",
    "tagC": "#2ecc71",
    "desc": "Manifesta algo no plano físico ou mental. Permanece enquanto MP estiver reservada.",
    "cost": "Pequeno (≤0,5m³): 15 MP · Médio (≤2m³): 25 MP · Grande (≤5m³): 45 MP",
    "dmg": "Ofensivo: 1d8 por 15 MP investidos",
    "range": "Manifestação: até 20m · Distância máx: 50m do criador",
    "extra": "Objetos complexos exigem teste de DOM. Manifestações ofensivas têm dano limitado. Duração enquanto MP reservada (ação livre para liberar)."
  },
  {
    "n": "Proteger",
    "tag": "Todas as Auras",
    "tagC": "#3498db",
    "desc": "Usa energia da aura como reação para se defender de outro efeito de aura.",
    "cost": "% do MP gasto pelo atacante · Total: 100% · Parcial: 50% (mín 5 MP) (⏳ P-018) · Reflexivo: 150% · Contra técnica gratuita ou com desconto (ex.: a técnica bônus da Expansão): custo de tabela da técnica (6 MP por d8)",
    "dmg": "Total: bloqueia 100% · Reflexivo: retorna 25% do efeito ao atacante",
    "range": "Reação, 1×/rodada · Teste: d20 + mod SAB + proficiência contra CD 10 + mod DOM do atacante",
    "extra": "Apenas contra efeitos de aura (não físicos). Requer mão livre. Não funciona inconsciente/incapacitado."
  },
  {
    "n": "Expansão de Domínio",
    "tag": "Todas (DOM 16+ e Técnica Máxima)",
    "tagC": "#f4d03f",
    "desc": "Manifesta a verdadeira natureza da aura, criando um domínio que sobrepõe a realidade. Dentro dele, as leis físicas se curvam à vontade do usuário. É \"arma de guerra\": só militares e ordens (D-02).",
    "cost": "50% do MP máximo (não recuperável no combate) · Ativar gasta a ação do turno",
    "dmg": "Escolha 2 de 4: vantagem nos ataques · +50% de dano (conta como Fortalecimento no limite de +300% e de 3 simultâneos) · 1 técnica extra grátis por turno, como ação bônus, de no máximo 3d8 · resistências do alvo pela metade",
    "range": "Raio: 10 m · Duração: concentração, máx. 3 turnos",
    "extra": "1×/dia; +1 nível de Exaustão de Arka após o uso. 1 Expansão por personagem. Domínios opostos se anulam. Legado da Arka (nv 15) pode remover a Exaustão (1×/dia)."
  }
];

export const FORT_ELEMENTS = [
  {
    "n": "Sinais de Mão",
    "ef": "+25% eficiência (dano, duração ou área)",
    "req": "Ação bônus"
  },
  {
    "n": "Encantamento",
    "ef": "+20% eficiência",
    "req": "Personalizado pelo jogador, ação bônus"
  },
  {
    "n": "Tempo de Carga",
    "ef": "1 turno: +50% · 2 turnos: +100% · 3 turnos: +200%",
    "req": "Metade da velocidade durante carga"
  },
  {
    "n": "Consumíveis Mágicos",
    "ef": "+30% eficiência",
    "req": "Utensílio que se consome após uso"
  },
  {
    "n": "Técnica em Conjunto",
    "ef": "Compatíveis: +75% · Neutras: +50% · Opostas: +25%",
    "req": "Dois jogadores combinam auras"
  },
  {
    "n": "Votos",
    "ef": "+100% eficiência",
    "req": "Pacto com entidade, restrição permanente (Mestre define)"
  },
  {
    "n": "Dança Ritualística",
    "ef": "+75% eficiência",
    "req": "Perda de locomoção + ação bônus"
  },
  {
    "n": "Limites de Uso",
    "ef": "1×/dia: +100% · 1×/semana: +200% · 1×/mês: +300%",
    "req": "Restrição de frequência"
  }
];
export const FORT_BONUSES = [
  25,
  20,
  0,
  30,
  0,
  100,
  75,
  0
];
// Variantes [rótulo, %] por índice de FORT_ELEMENTS (Carga, Conjunto, Limites)
export const FORT_VARIANTS = {
  "2": [
    [
      "1 turno",
      50
    ],
    [
      "2 turnos",
      100
    ],
    [
      "3 turnos",
      200
    ]
  ],
  "4": [
    [
      "Compatíveis",
      75
    ],
    [
      "Neutras",
      50
    ],
    [
      "Opostas",
      25
    ]
  ],
  "7": [
    [
      "1×/dia",
      100
    ],
    [
      "1×/semana",
      200
    ],
    [
      "1×/mês",
      300
    ]
  ]
};
export const FORT_CAP = 300, FORT_MAX_N = 3;

export const EXH_DESC = [
  "",
  "Nv.1: Desvantagem em testes de DOM para treino.",
  "Nv.2: Desvantagem em todos os testes de DOM e CON.",
  "Nv.3: Velocidade −50%. Desvantagem em DEX, INT e SAB. Não mantém concentração de mais de 1 turno.",
  "Nv.4: Tudo o anterior + teste de CON CD 15 por turno, ou perde a ação.",
  "Nv.5: Inconsciente. Só acorda com ajuda externa ou descanso longo."
];
export const TRAINING_TIERS = [
  {
    "t": "Básica",
    "s": 2,
    "cd": 10
  },
  {
    "t": "Intermediária",
    "s": 4,
    "cd": 14
  },
  {
    "t": "Avançada",
    "s": 6,
    "cd": 18
  },
  {
    "t": "Máxima",
    "s": 8,
    "cd": 22
  },
  {
    "t": "Expansão",
    "s": 10,
    "cd": 25
  }
];
export const ARMORS = [
  {
    "n": "Sem armadura",
    "ca": 10,
    "t": "N"
  },
  {
    "n": "Acolchoado",
    "ca": 11,
    "t": "L"
  },
  {
    "n": "Couro",
    "ca": 11,
    "t": "L"
  },
  {
    "n": "Couro batido",
    "ca": 12,
    "t": "L"
  },
  {
    "n": "Cota de malha",
    "ca": 13,
    "t": "M"
  },
  {
    "n": "Peitoral de aço",
    "ca": 14,
    "t": "M"
  },
  {
    "n": "Meia-placa",
    "ca": 15,
    "t": "M"
  },
  {
    "n": "Brigantina de prata (Anjos)",
    "ca": 14,
    "t": "M"
  },
  {
    "n": "Cota de anéis",
    "ca": 14,
    "t": "P"
  },
  {
    "n": "Cota de talas",
    "ca": 15,
    "t": "P"
  },
  {
    "n": "Placas completas",
    "ca": 18,
    "t": "P"
  },
  {
    "n": "Armadura a vapor",
    "ca": 19,
    "t": "P",
    "mv": -2
  }
];

// ── Regras (funções puras) ────────────────────────────────────────────────────
// Compra de pontos (C-08): base 8, 35 pontos, máx. 18 na criação, cada ponto acima de 14 custa 2.
// A profissão é aplicada antes da compra: custo e teto contam sobre o valor já com a profissão.
export const PB_BASE = 8, PB_TOTAL = 35, PB_MAX = 18, PB_DOUBLE = 14;
export function pointBuyCost(from, to) {
  if (to < from) return to - from;
  let c = 0;
  for (let v = from + 1; v <= to; v++) c += v > PB_DOUBLE ? 2 : 1;
  return c;
}
// Proficiência escalonada (PB-1)
export function profBonus(level) {
  const lv = level || LV_MIN;
  return lv >= 15 ? 5 : lv >= 11 ? 4 : lv >= 7 ? 3 : 2;
}
export function attrMod(v) { return Math.floor(((v ?? 10) - 10) / 2); }

// Pontos de Progressão (PG economia; D-28, D-42, D-43, D-47)
export const PP_PER_LEVEL = 3;              // nv 4–15 = 36 PP; acumulam
export const PP_AURA_UP = { 2: 8, 3: 10 };  // 1→2 e 2→3
export const PP_NEW_AURA = [3, 4, 5, 6];    // distância 0/1/2/3 a partir da Área da hereditária
export const ATTR_CAP = 20;
export const BIRTH_ONLY_AURAS = ['Titânica', 'Aura Própria'];
export function ppAttrCost(resulting) { return resulting <= 16 ? 2 : resulting <= 18 ? 3 : 4; }
export function ppEarned(level) {
  const lv = Math.max(LV_MIN, Math.min(LV_MAX, level || LV_MIN));
  return PP_PER_LEVEL * (lv - LV_MIN);
}
export function areaDistance(a, b) {
  const ia = AURA_GROUPS.findIndex(g => g.n === a), ib = AURA_GROUPS.findIndex(g => g.n === b);
  if (ia < 0 || ib < 0) return 0;
  const d = Math.abs(ia - ib);
  return Math.min(d, 6 - d);
}
export function auraArea(name) {
  for (const k of Object.keys(AURA_DETAILS)) if (AURA_DETAILS[k].some(x => x.n === name)) return k;
  return '';
}
export function hereditaryAura(auras) { return (auras || []).find(x => x.her); }
// Custo de aura nova; null = não comprável (Titânica/Ícor, Primordial em desenvolvimento) ou não definido (nascido Titânico)
export function newAuraCost(auras, name) {
  const h = hereditaryAura(auras);
  if (!h || BIRTH_ONLY_AURAS.includes(name) || h.n === 'Titânica') return null;
  const det = Object.values(AURA_DETAILS).flat().find(x => x.n === name);
  if (!det || det.dev) return null;
  const ha = auraArea(h.n), na = auraArea(name);
  if (!ha || !na) return null;
  return PP_NEW_AURA[areaDistance(ha, na)];
}
export function auraSpent(a) {
  let c = a.her ? 0 : (a.pago || 0);
  for (let l = 2; l <= Math.min(3, a.lv || 1); l++) c += PP_AURA_UP[l];
  return c; // Despertar Divino (nv 4) não custa PP
}
export function attrUpsSpent(baseFinal, ups) {
  let c = 0;
  for (let k = 1; k <= (ups || 0); k++) c += ppAttrCost(baseFinal + k);
  return c;
}

// Fortalecimentos (cap. 11, PB-5): soma simples (⏳ P-015), teto +300% e 3 simultâneos; Votos (5) e Limites (7) não acumulam
export function fortTotal(checks, variants, expansion) {
  let count = 0, total = 0; const vals = {}; const warn = [];
  FORT_ELEMENTS.forEach((_, i) => {
    if (!checks[i]) return;
    count++;
    const v = FORT_VARIANTS[i] ? FORT_VARIANTS[i][variants?.[i] || 0][1] : FORT_BONUSES[i];
    vals[i] = v; total += v;
  });
  if (vals[5] !== undefined && vals[7] !== undefined) { total -= Math.min(vals[5], vals[7]); warn.push('Votos e Limites de Uso não acumulam: só o maior conta.'); }
  if (expansion) { count++; total += 50; }
  if (count > FORT_MAX_N) warn.push(`Máximo de ${FORT_MAX_N} fortalecimentos simultâneos (${count} marcados).`);
  if (total > FORT_CAP) { warn.push(`Limite de +${FORT_CAP}% atingido (soma: +${total}%).`); total = FORT_CAP; }
  return { total, count, actions: Math.max(0, count - 1), turns: Math.max(0, count - 2), warn };
}

// Blank sheet with all companion + VTT fields
export function blankSheet(overrides = {}) {
  return {
    // VTT header
    id: '', category: 'pc', owner: null, linkedTokenId: null,
    // Identity
    name: '', player: '', age: '', gender: '', origin: '', alignment: '',
    appearance: '', personality: '', background: '', motivation: '', notes: '',
    // Race / Profession
    race: 'Humano', prof: 'custom',
    customProf: { name: 'Personalizado', m: {}, hp: '1d8', mp: '1d8', sk: '' },
    // Attributes: compra (base 8) + aumentos com PP
    attrs: { FOR: 8, DEX: 8, CON: 8, SAB: 8, INT: 8, CAR: 8, DOM: 8 },
    attrUps: { FOR: 0, DEX: 0, CON: 0, SAB: 0, INT: 0, CAR: 0, DOM: 0 },
    proficiencies: [],  // string array (["Acrobacia", …])
    customProfs: [],    // [{ n, a }]
    toolProfs: ['', ''],
    // HP / MP: dado bruto por nível (criação = 3 rolagens)
    curHP: 0, maxHP: 0, curMP: 0, maxMP: 0, falls: 0, shortRests: 0,
    hpDice: [], mpDice: [], hpRolls: [], mpRolls: [],
    armor: 'Sem armadura', shield: false,
    // Auras: [{ n, lv, her, pago, deus }]
    auraInit: '', auraDesc: '', extraAuras: '', auras: [],
    // Inventory / Gold
    gold: 0, inventory: [],
    // XP / Level
    xp: 0, level: LV_MIN, legado: '',
    // Fluxo
    fluxoDeseq: 0, fluxoActive: false, fluxoLog: [],
    // Training
    exTreino: 0, sessoesTreino: [], arkaLocal: 3, arkaCap: 3,
    tecMax: '', devTechs: [],
    // VTT-only
    ac: 10, movement: 9, profBonus: 2,
    attacks: [],            // VTT attack entries
    techniques: [],         // VTT technique entries (legacy / import compat)
    conditions: [],
    image: null, color: '#4a9a5a',
    copper: 0, silver: 0,
    backpackType: 'common', backpackBonus: 0,
    ...overrides,
  };
}
