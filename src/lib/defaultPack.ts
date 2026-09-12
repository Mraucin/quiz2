import type {
  AuctionQuestion,
  Category,
  FinalQuestion,
  ListQuestion,
  Pack,
  PackRules,
  StandardQuestion,
  WheelQuestion,
} from './types'

export const DEFAULT_RULES: PackRules = {
  rowValues: [100, 200, 300, 400, 500, 600],
  vowelCost: 100,
  listBasePayout: 600,
  listPayoutStep: 200,
  auctionSeconds: 60,
  finalAnswerSeconds: 45,
  hostPin: '1234',
}

let seq = 0
const nid = (prefix: string) => `${prefix}-${(seq += 1).toString(36)}`

function abcd(
  prompt: string,
  options: string[],
  correctIndex: number,
  extra: Partial<StandardQuestion> = {},
): StandardQuestion {
  const choices = options.map((text) => ({ id: nid('c'), text }))
  return {
    id: nid('q'),
    kind: 'standard',
    prompt,
    choices,
    correctChoiceId: choices[correctIndex].id,
    answerText: options[correctIndex],
    ...extra,
  }
}

function open(prompt: string, answerText: string, extra: Partial<StandardQuestion> = {}): StandardQuestion {
  return { id: nid('q'), kind: 'standard', prompt, answerText, ...extra }
}

function wheel(phrase: string, phraseHint: string): WheelQuestion {
  return {
    id: nid('q'),
    kind: 'wheel',
    prompt: 'Odgadnij hasło z Koła Fortuny',
    phrase,
    phraseHint,
    answerText: phrase,
  }
}

function list(prompt: string, items: string[]): ListQuestion {
  return { id: nid('q'), kind: 'list', prompt, items, freeMisses: 1 }
}

function auction(prompt: string, items: string[]): AuctionQuestion {
  return { id: nid('q'), kind: 'auction', prompt, items, timerSeconds: 60 }
}

const categories: Category[] = [
  {
    id: nid('cat'),
    name: 'Sanah czy Adolf Hitler',
    multiplier: 0.5,
    questions: [
      abcd('„Ale jazz!”', ['Sanah', 'Adolf Hitler'], 0, {
        notes: 'Tytuł piosenki Sanah z 2020 roku.',
      }),
      abcd('„Kto chce żyć, ten niech walczy.”', ['Sanah', 'Adolf Hitler'], 1),
      abcd('„Kolońska i szlugi”', ['Sanah', 'Adolf Hitler'], 0),
      abcd('„Wielkie kłamstwo zawsze zawiera w sobie pewną siłę wiarygodności.”', [
        'Sanah',
        'Adolf Hitler',
      ], 1),
      abcd('„Królowa dram”', ['Sanah', 'Adolf Hitler'], 0),
      abcd('„Słowo mówione porywa tłumy — pisane tylko je informuje.”', [
        'Sanah',
        'Adolf Hitler',
      ], 1),
    ],
  },
  {
    id: nid('cat'),
    name: 'Rīgu Obu rejendo',
    multiplier: 1,
    questions: [
      open('Sūpā Mario Burazāzu', 'Super Mario Bros.', {
        speak: 'スーパーマリオブラザーズ',
        notes: 'Kategoria audio: odtwórz nagranie albo przeczytaj hasło na głos.',
      }),
      open('Mainkurafuto', 'Minecraft', { speak: 'マインクラフト' }),
      open('Za Rejendo obu Zeruda', 'The Legend of Zelda', { speak: 'ゼルダの伝説' }),
      open('Kauntā Sutoraiku', 'Counter-Strike', { speak: 'カウンターストライク' }),
      open('Hārī Pottā to Kenja no Ishi', 'Harry Potter i Kamień Filozoficzny', {
        speak: 'ハリー・ポッターと賢者の石',
      }),
      open('Sekirō: Shadōzu Dai Tsuwaisu', 'Sekiro: Shadows Die Twice', {
        speak: 'セキロウ シャドウズ ダイ トゥワイス',
      }),
    ],
  },
  {
    id: nid('cat'),
    name: 'Koło fortuny',
    multiplier: 2,
    questions: [
      wheel('KOŃ JAKI JEST KAŻDY WIDZI', 'Powiedzenie'),
      wheel('MIĘDZYNARODOWA STACJA KOSMICZNA', 'Miejsce'),
      wheel('PIES OGRODNIKA', 'Powiedzenie'),
      wheel('ZIEMNIAKI Z KOPERKIEM', 'Potrawa'),
      wheel('NIEDŹWIEDZIA PRZYSŁUGA', 'Powiedzenie'),
      wheel('CZTERY PORY ROKU', 'Utwór muzyczny'),
    ],
  },
  {
    id: nid('cat'),
    name: 'Fobie',
    multiplier: 1,
    questions: [
      abcd('Arachnofobia to lęk przed…', ['pająkami', 'wężami', 'wysokością', 'ciemnością'], 0),
      abcd('Klaustrofobia to lęk przed…', [
        'otwartą przestrzenią',
        'zamkniętą przestrzenią',
        'tłumem',
        'lataniem',
      ], 1),
      abcd('Koulrofobia to lęk przed…', ['klaunami', 'lalkami', 'lustrami', 'zegarami'], 0),
      abcd('Trypofobia to lęk przed…', [
        'skupiskami dziur',
        'podróżami',
        'liczbą trzy',
        'trylogiami',
      ], 0),
      abcd('Nomofobia to lęk przed…', [
        'nowościami',
        'brakiem telefonu pod ręką',
        'imionami',
        'nomadami',
      ], 1),
      abcd('Hippopotomonstrosesquipedaliofobia to lęk przed…', [
        'hipopotamami',
        'potworami morskimi',
        'długimi słowami',
        'stadami zwierząt',
      ], 2),
    ],
  },
  {
    id: nid('cat'),
    name: 'Piłkarze nieznani',
    multiplier: 1,
    questions: [
      open('Kto jest najlepszym strzelcem w historii reprezentacji Polski?', 'Robert Lewandowski'),
      abcd('Z jakiego kraju pochodzi Hakan Şükür?', ['Turcja', 'Bułgaria', 'Grecja', 'Albania'], 0),
      open('W jakim klubie grał Jerzy Dudek przed transferem do Liverpoolu?', 'Feyenoord Rotterdam'),
      abcd('Kto zdobył Złotą Piłkę w 1996 roku?', [
        'Ronaldo',
        'Matthias Sammer',
        'Alan Shearer',
        'Zinedine Zidane',
      ], 1),
      abcd('Kto strzelił słynnego gola dla Wysp Owczych w meczu z Austrią w 1990 roku?', [
        'Torkil Nielsen',
        'Jens Martin Knudsen',
        'Todi Jónsson',
        'Óli Johannesen',
      ], 0),
      open('Kto zdobył pierwszego gola w historii mistrzostw świata (1930)?', 'Lucien Laurent'),
    ],
  },
  {
    id: nid('cat'),
    name: 'Pociągi',
    multiplier: 1,
    questions: [
      open('Jaki przewoźnik obsługuje w Polsce pociągi kategorii EIP (Pendolino)?', 'PKP Intercity'),
      abcd('Jaki jest normalny rozstaw szyn w Polsce (w mm)?', ['1000', '1435', '1520', '1668'], 1),
      open('Jak nazywa się japoński system szybkich kolei?', 'Shinkansen'),
      abcd('Który legendarny pociąg łączył Paryż z Konstantynopolem?', [
        'Orient Express',
        'Flying Scotsman',
        'Golden Arrow',
        'Blue Train',
      ], 0),
      open('Jakie oznaczenie serii ma polska lokomotywa zwana „Bykiem”?', 'ET22'),
      abcd('Najdłuższy tunel kolejowy świata to…', [
        'Tunel pod kanałem La Manche',
        'Tunel bazowy Św. Gotarda',
        'Tunel Seikan',
        'Tunel Lötschberg',
      ], 1),
    ],
  },
  {
    id: nid('cat'),
    name: 'Wyliż chunka',
    multiplier: 2,
    fixedValue: 600,
    questions: [
      list('Wymieniajcie państwa graniczące z Polską', [
        'Niemcy',
        'Czechy',
        'Słowacja',
        'Ukraina',
        'Białoruś',
        'Litwa',
        'Rosja',
      ]),
      list('Wymieniajcie kolory tęczy', [
        'czerwony',
        'pomarańczowy',
        'żółty',
        'zielony',
        'niebieski',
        'indygo',
        'fioletowy',
      ]),
      list('Wymieniajcie planety Układu Słonecznego', [
        'Merkury',
        'Wenus',
        'Ziemia',
        'Mars',
        'Jowisz',
        'Saturn',
        'Uran',
        'Neptun',
      ]),
      list('Wymieniajcie krasnoludki z bajki o Królewnie Śnieżce', [
        'Gburek',
        'Mędrek',
        'Śpioch',
        'Wesołek',
        'Nieśmiałek',
        'Kichuś',
        'Gapcio',
      ]),
      list('Wymieniajcie państwa z niemieckim jako językiem urzędowym', [
        'Niemcy',
        'Austria',
        'Szwajcaria',
        'Liechtenstein',
        'Luksemburg',
        'Belgia',
      ]),
      list('Wymieniajcie pierwiastki, których symbol ma tylko jedną literę', [
        'Wodór (H)',
        'Bor (B)',
        'Węgiel (C)',
        'Azot (N)',
        'Tlen (O)',
        'Fluor (F)',
        'Fosfor (P)',
        'Siarka (S)',
        'Potas (K)',
        'Wanad (V)',
        'Itr (Y)',
        'Jod (I)',
        'Wolfram (W)',
        'Uran (U)',
      ]),
    ],
  },
  {
    id: nid('cat'),
    name: 'Licytacje',
    multiplier: 2,
    fixedValue: 300,
    questions: [
      auction('Ile województw w Polsce potrafisz wymienić?', [
        'dolnośląskie',
        'kujawsko-pomorskie',
        'lubelskie',
        'lubuskie',
        'łódzkie',
        'małopolskie',
        'mazowieckie',
        'opolskie',
        'podkarpackie',
        'podlaskie',
        'pomorskie',
        'śląskie',
        'świętokrzyskie',
        'warmińsko-mazurskie',
        'wielkopolskie',
        'zachodniopomorskie',
      ]),
      auction('Ile państw Ameryki Południowej potrafisz wymienić?', [
        'Argentyna',
        'Boliwia',
        'Brazylia',
        'Chile',
        'Ekwador',
        'Gujana',
        'Kolumbia',
        'Paragwaj',
        'Peru',
        'Surinam',
        'Urugwaj',
        'Wenezuela',
      ]),
      auction('Ile filmów o Harrym Potterze potrafisz wymienić?', [
        'Kamień Filozoficzny',
        'Komnata Tajemnic',
        'Więzień Azkabanu',
        'Czara Ognia',
        'Zakon Feniksa',
        'Książę Półkrwi',
        'Insygnia Śmierci część 1',
        'Insygnia Śmierci część 2',
      ]),
      auction('Ile angielskich klubów z triumfem w Lidze Mistrzów / PEMK potrafisz wymienić?', [
        'Liverpool',
        'Manchester United',
        'Chelsea',
        'Manchester City',
        'Aston Villa',
        'Nottingham Forest',
      ]),
      auction('Ile niemieckich marek samochodowych potrafisz wymienić?', [
        'Volkswagen',
        'Audi',
        'BMW',
        'Mercedes-Benz',
        'Porsche',
        'Opel',
        'Smart',
        'Maybach',
        'MAN',
        'Borgward',
      ]),
      auction('Ile zwierząt chińskiego zodiaku potrafisz wymienić?', [
        'szczur',
        'wół',
        'tygrys',
        'królik',
        'smok',
        'wąż',
        'koń',
        'koza',
        'małpa',
        'kogut',
        'pies',
        'świnia',
      ]),
    ],
  },
]

const final: FinalQuestion[] = [
  {
    id: nid('f'),
    category: 'Historia Polski',
    prompt: 'Jak nazywał się pierwszy prezydent II Rzeczpospolitej?',
    answerText: 'Gabriel Narutowicz',
  },
  {
    id: nid('f'),
    category: 'Muzyka',
    prompt: 'Który polski zespół nagrał przebój „Mniej niż zero”?',
    answerText: 'Lady Pank',
  },
  {
    id: nid('f'),
    category: 'Kino',
    prompt: 'Który film zdobył Oscara dla najlepszego filmu podczas gali w 2020 roku?',
    answerText: 'Parasite (Parasite — Gisaengchung)',
  },
]

export const DEFAULT_PACK: Pack = {
  id: 'pack-default',
  name: 'Jeopardy z twistem — pakiet startowy',
  description:
    'Przykładowe pytania do wszystkich ośmiu kategorii oraz trzy pytania finałowe. Edytuj je w edytorze pytań przed grą.',
  updatedAt: Date.now(),
  rules: DEFAULT_RULES,
  categories,
  final,
}

export const WHEEL_SEGMENTS = [
  { label: '20', value: 20 },
  { label: '90', value: 90 },
  { label: 'BANKRUT', value: 0, bankrupt: true },
  { label: '50', value: 50 },
  { label: '130', value: 130 },
  { label: '10', value: 10 },
  { label: '70', value: 70 },
  { label: '150', value: 150 },
  { label: '30', value: 30 },
  { label: '110', value: 110 },
  { label: '60', value: 60 },
  { label: '40', value: 40 },
]

export const AVATARS = [
  '🦊',
  '🐼',
  '🐙',
  '🦉',
  '🐝',
  '🦄',
  '🐸',
  '🦁',
  '🐧',
  '🦖',
  '🐨',
  '🦩',
  '🐺',
  '🦝',
  '🐳',
  '🦔',
]

export const PLAYER_COLORS = [
  'oklch(0.78 0.17 30)',
  'oklch(0.8 0.16 145)',
  'oklch(0.78 0.15 230)',
  'oklch(0.82 0.16 85)',
  'oklch(0.75 0.19 320)',
  'oklch(0.8 0.14 190)',
  'oklch(0.76 0.18 10)',
  'oklch(0.83 0.15 110)',
]
