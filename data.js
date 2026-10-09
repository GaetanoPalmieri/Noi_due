/* ===================== DATI PROGRAMMA ===================== */
const COMMON_FINISH = [
  {name:"Tapis roulant — camminata in pendenza", sets:1, reps:"20-25 min", rest:0, move:"cardio",
    note:"Cardio a ritmo moderato (zona 2: un po' affannoso ma riesci a parlare). Aiuta il deficit calorico; gli addominali rinforzano il core ma non esiste il dimagrimento localizzato."},
  {name:"Esercizi di Kegel (pavimento pelvico)", sets:3, reps:"10 contrazioni (5\" tieni + 5\" rilascia)", rest:30, move:"kegel",
    note:"Contrai i muscoli del pavimento pelvico, tieni 5 secondi e rilascia 5 secondi. Evita di trattenere il respiro."},
];

const ABS_ROUTINE = {
  d1:[
    {name:"Crunch ai cavi in ginocchio", sets:3, reps:"12-15", rest:45, move:"core",
      note:"Fletti il busto portando le costole verso il bacino. Non tirare con le braccia e mantieni il bacino stabile."},
    {name:"Pallof press ai cavi", sets:3, reps:"12 per lato", rest:45, move:"core",
      note:"Anti-rotazione: spingi le mani davanti al petto senza lasciare ruotare il busto. Core e glutei attivi."},
  ],
  d2:[
    {name:"Knee raise alla captain chair", sets:3, reps:"10-15", rest:60, move:"core",
      note:"Porta le ginocchia verso il petto con controllo e chiudi leggermente il bacino in alto. Evita slanci."},
    {name:"Dead bug controllato", sets:3, reps:"10 per lato", rest:45, move:"core",
      note:"Zona lombare aderente al pavimento. Allunga lentamente braccio e gamba opposti senza perdere la posizione."},
  ],
  d3:[],
  d4:[
    {name:"Ab wheel rollout", sets:3, reps:"8-12", rest:60, move:"core",
      note:"Parti in ginocchio, glutei e addome contratti. Allunga solo fin dove riesci a mantenere la zona lombare neutra."},
    {name:"Side plank", sets:3, reps:"30-45 sec per lato", rest:45, move:"core",
      note:"Corpo in linea, bacino alto e addome attivo. Mantieni senza ruotare il tronco."},
  ],
};

/* 1.12.0 — Scheda FULL BODY: 3 giorni completi + 1 giorno di richiamo/aerobico opzionale.
   Ordine fisso in ogni giorno: cardio (riscaldamento) → Kegel → addominali → esercizi con i pesi.
   Blocco di 8 settimane (2 mesi): a fine blocco serve il check fisico per generare i 2 mesi successivi. */
const CARDIO_START = (reps) => ({name:"Tapis roulant — camminata in pendenza", sets:1, reps, rest:0, move:"cardio",
  note:"Cardio a ritmo moderato (zona 2: un po' affannoso ma riesci a parlare). Aiuta il deficit calorico; gli addominali rinforzano il core ma non esiste il dimagrimento localizzato."});
const KEGEL_START = {name:"Esercizi di Kegel (pavimento pelvico)", sets:3, reps:"10 contrazioni (5\" tieni + 5\" rilascia)", rest:20, move:"kegel",
  note:"Contrai i muscoli del pavimento pelvico, tieni 5 secondi e rilascia 5 secondi. Evita di trattenere il respiro."};

const DAYS = [
  { key:"d1", name:"Full body A", short:"G1 · Full A",
    exercises:[
      CARDIO_START("15 min"),
      KEGEL_START,
      {name:"Crunch ai cavi in ginocchio", sets:3, reps:"12-15", rest:60, move:"core",
        note:"Fletti il busto portando le costole verso il bacino. Non tirare con le braccia e mantieni il bacino stabile."},
      {name:"Dead bug controllato", sets:3, reps:"8 per lato", rest:45, move:"core",
        note:"Zona lombare aderente al pavimento. Allunga lentamente braccio e gamba opposti senza perdere la posizione."},
      {name:"Leg press 45°", sets:4, reps:"8-10", rest:150, compound:true, move:"leg_press",
        note:"ATTENZIONE GINOCCHIO: piedi larghezza spalle, scendi solo fino a dove NON senti fastidio (circa 90° di flessione), non bloccare le ginocchia in estensione completa in alto."},
      {name:"Panca piana con bilanciere", sets:4, reps:"6-8", rest:150, compound:true, move:"vertical_press",
        note:"Scapole retratte e addotte, piedi ben piantati. Discesa controllata in 2-3 secondi, barra a metà petto, spinta esplosiva in alto senza staccare i glutei dalla panca."},
      {name:"Rematore con manubrio monolaterale", sets:3, reps:"8-10", rest:60, move:"horizontal_pull",
        note:"Un braccio per volta, busto quasi parallelo al pavimento, il gomito va verso l'anca, non verso l'alto."},
      {name:"Lento avanti con manubri, seduto", sets:3, reps:"8-10", rest:120, move:"vertical_press",
        note:"Core stabile, non iperestendere la zona lombare. I manubri partono all'altezza delle spalle e salgono fino quasi a toccarsi in alto."},
      {name:"Leg curl sdraiato/seduto", sets:3, reps:"10-12", rest:75, move:"leg_press",
        note:"Contrazione piena dei femorali in ogni ripetizione, evita strappi con inerzia."},
      {name:"Alzate laterali con manubri", sets:4, reps:"12-15", rest:60, move:"lateral_raise",
        note:"Punto debole - deltoidi: gomito leggermente flesso, salita fino all'altezza della spalla, nessuno slancio con il busto. Se serve, riduci il peso per fare tutte le ripetizioni in modo pulito."},
      {name:"Push down tricipiti ai cavi", sets:3, reps:"10-12", rest:60, move:"vertical_press",
        note:"Gomiti fissi lungo il fianco: si muove solo l'avambraccio. Estensione completa in basso."},
    ]},
  { key:"d2", name:"Full body B", short:"G2 · Full B",
    exercises:[
      CARDIO_START("15 min"),
      KEGEL_START,
      {name:"Knee raise alla captain chair", sets:3, reps:"10-15", rest:60, move:"core",
        note:"Porta le ginocchia verso il petto con controllo e chiudi leggermente il bacino in alto. Evita slanci."},
      {name:"Pallof press ai cavi", sets:3, reps:"10 per lato", rest:45, move:"core",
        note:"Anti-rotazione: spingi le mani davanti al petto senza lasciare ruotare il busto. Core e glutei attivi."},
      {name:"Stacco rumeno con bilanciere", sets:4, reps:"8-10", rest:150, compound:true, move:"hinge",
        note:"Schiena neutra per tutto il movimento, bilanciere vicino alle gambe, spinta finale con i glutei. Fermati quando senti un buon allungamento dei femorali."},
      {name:"Lat machine presa larga", sets:4, reps:"8-10", rest:120, move:"vertical_pull",
        note:"Tira verso i capezzoli, petto in fuori, nessuno slancio con il busto. Controlla anche la fase di risalita."},
      {name:"Panca inclinata con manubri (30°)", sets:3, reps:"8-10", rest:120, move:"vertical_press",
        note:"Range di movimento completo. Evita di far \"sbattere\" i manubri in alto: mantieni un minimo di tensione e controllo in ogni ripetizione."},
      {name:"Affondi bulgari con manubri", sets:3, reps:"8-10 per gamba", rest:90, move:"leg_press",
        note:"Passo corto e controllato, il ginocchio della gamba anteriore non deve superare troppo la punta del piede. Fermati se senti fastidio articolare."},
      {name:"Face pull ai cavi", sets:3, reps:"12-15", rest:60, move:"lateral_raise",
        note:"Punto debole - deltoide posteriore: tira verso il viso con i gomiti alti. Ottimo anche per la postura delle spalle."},
      {name:"Curl bicipiti con bilanciere", sets:3, reps:"8-10", rest:75, move:"curl",
        note:"Gomiti fermi lungo il fianco, nessuno slancio con la schiena. Contrai bene in alto."},
      {name:"French press con manubrio", sets:3, reps:"10-12", rest:75, move:"vertical_press",
        note:"Gomiti stretti e fermi, scendi dietro la testa senza aprire i gomiti verso l'esterno."},
    ]},
  { key:"d3", name:"Full body C", short:"G3 · Full C",
    exercises:[
      CARDIO_START("15 min"),
      KEGEL_START,
      {name:"Ab wheel rollout", sets:3, reps:"8-12", rest:75, move:"core",
        note:"Parti in ginocchio, glutei e addome contratti. Allunga solo fin dove riesci a mantenere la zona lombare neutra."},
      {name:"Side plank", sets:3, reps:"30-45 sec per lato", rest:45, move:"core",
        note:"Corpo in linea, bacino alto e addome attivo. Mantieni senza ruotare il tronco."},
      {name:"Hip thrust con bilanciere", sets:4, reps:"8-10", rest:150, compound:true, move:"hinge",
        note:"Mento verso il petto, spinta con i glutei, blocco di 1 secondo in massima contrazione in alto."},
      {name:"Pulley basso (seated row)", sets:3, reps:"10-12", rest:90, move:"horizontal_pull",
        note:"Petto alto, tira verso l'ombelico, controlla sempre il ritorno senza far \"cadere\" il peso."},
      {name:"Arnold press con manubri", sets:3, reps:"8-10", rest:90, move:"vertical_press",
        note:"Punto debole - deltoidi: rotazione fluida del polso durante la salita, ottimo per deltoide anteriore e laterale insieme."},
      {name:"Croci ai cavi (cable fly)", sets:3, reps:"12-15", rest:60, move:"fly",
        note:"Tensione continua su tutto il movimento, breve pausa in massima contrazione al centro."},
      {name:"Leg extension", sets:3, reps:"12-15", rest:75, move:"leg_press",
        note:"Carico moderato e movimento lento: rinforza il ginocchio senza lo stress da carico assiale dello squat pesante."},
      {name:"Alzate laterali ai cavi (unilaterale)", sets:3, reps:"12-15 per lato", rest:45, move:"lateral_raise",
        note:"Punto debole - deltoidi: il cavo mantiene tensione costante anche in basso, più efficace del manubrio su questo esercizio."},
      {name:"Curl a martello con manubri", sets:3, reps:"10-12", rest:60, move:"curl",
        note:"Presa neutra (palmi rivolti verso il corpo): lavora anche il brachiale, utile per braccia più \"piene\"."},
      {name:"Calf raise in piedi", sets:4, reps:"10-15", rest:60, move:"leg_press",
        note:"Range di movimento completo, pausa di 1 secondo in massima estensione."},
    ]},
  { key:"d4", name:"Richiamo · Aerobico (opzionale)", short:"G4 · Richiamo", optional:true,
    exercises:[
      CARDIO_START("25-30 min"),
      KEGEL_START,
      {name:"Plank frontale", sets:3, reps:"30-45 sec", rest:45, move:"core",
        note:"Gomiti sotto le spalle, corpo in linea da testa a talloni. Glutei e addome contratti, respira senza far cedere la zona lombare."},
      {name:"Crunch inverso su panca", sets:3, reps:"12-15", rest:45, move:"core",
        note:"Arrotola il bacino verso il petto senza slancio e scendi lentamente. Il lavoro è dell'addome, non delle gambe."},
      {name:"Alzate posteriori (rear delt fly) su panca inclinata", sets:3, reps:"15-20", rest:45, move:"lateral_raise",
        note:"Punto debole - deltoide posteriore: busto appoggiato alla panca, peso leggero e movimento controllato, niente slancio."},
      {name:"Alzate laterali con manubri", sets:3, reps:"15-20", rest:45, move:"lateral_raise",
        note:"Punto debole - deltoidi: gomito leggermente flesso, salita fino all'altezza della spalla, nessuno slancio con il busto. Se serve, riduci il peso per fare tutte le ripetizioni in modo pulito."},
      {name:"Curl 21 (bicipiti, manubri leggeri)", sets:2, reps:"21 (7+7+7)", rest:75, move:"curl",
        note:"Punto debole - braccia: 7 ripetizioni nella metà bassa del movimento + 7 nella metà alta + 7 complete. Usa un peso leggero: brucia molto ma dà grande volume alle braccia."},
      {name:"Push down tricipiti ai cavi", sets:2, reps:"15-20", rest:60, move:"vertical_press",
        note:"Gomiti fissi lungo il fianco: si muove solo l'avambraccio. Estensione completa in basso."},
    ]},
];

/* Blocco di 8 settimane per un livello intermedio: si parte subito con carichi di lavoro reali,
   progressione per 7 settimane e un solo scarico nella settimana 8 (insieme al check fisico).
   Doppia progressione: prima si sale di ripetizioni fino al massimo del range, poi si aumenta il carico. */
const BLOCK_WEEKS = 8;
const PROGRESSION_TEXT = {
  1: "Settimana 1 — si parte forti: carichi di lavoro veri, 1-2 ripetizioni in riserva su tutti gli esercizi. Usa i pesi delle ultime sessioni dove gli esercizi sono gli stessi.",
  2: "Settimana 2 — doppia progressione: aggiungi ripetizioni fino al massimo del range. Quando lo raggiungi in tutte le serie, aumenta il carico (+2,5 kg sui multiarticolari, +1-2 kg sui complementari).",
  3: "Settimana 3: continua a salire. Multiarticolari a 1-2 ripetizioni in riserva, ultima serie dei complementari vicino al cedimento tecnico.",
  4: "Settimana 4: progressione regolare. Se dormi male o senti dolori articolari, ripeti i carichi della settimana scorsa invece di forzare.",
  5: "Settimana 5: obiettivo battere i numeri della settimana 3 di almeno una ripetizione o un piccolo carico.",
  6: "Settimana 6: multiarticolari a 1 ripetizione in riserva, complementari a cedimento tecnico nell'ultima serie.",
  7: "Settimana 7 — picco del blocco: i carichi più alti per le ripetizioni indicate, tecnica pulita e ginocchio senza dolore.",
  8: "Settimana 8 — SCARICO e CHECK: carico -10/15% e una serie in meno sui multiarticolari. A fine settimana fai il check fisico (Altro → Check fisico) per generare i 2 mesi successivi.",
};
/* Schema delle ripetizioni dei blocchi successivi (generati dopo il check fisico):
   i blocchi pari spostano i multiarticolari verso la forza, quelli dispari tornano all'ipertrofia. */
const BLOCK_REP_SCHEMES = {
  strength: { compound: "5-7", accessory: "8-10" },
  hypertrophy: null,
};

const ANIM_SVG = {
  vertical_press: `<svg viewBox="0 0 200 130"><line x1="30" y1="105" x2="170" y2="105" stroke="#3a4a56" stroke-width="4"/>
    <g><rect x="70" y="35" width="60" height="10" rx="4" fill="#2f9e8f"/><circle cx="70" cy="40" r="13" fill="#e8a33d"/><circle cx="130" cy="40" r="13" fill="#e8a33d"/>
    <animateTransform attributeName="transform" type="translate" values="0 0;0 32;0 0" dur="1.5s" repeatCount="indefinite"/></g></svg>`,
  vertical_pull: `<svg viewBox="0 0 200 130"><rect x="80" y="92" width="40" height="28" rx="6" fill="#3a4a56"/>
    <g><rect x="55" y="14" width="90" height="9" rx="4" fill="#2f9e8f"/><circle cx="60" cy="18" r="10" fill="#e8a33d"/><circle cx="140" cy="18" r="10" fill="#e8a33d"/>
    <animateTransform attributeName="transform" type="translate" values="0 0;0 48;0 0" dur="1.5s" repeatCount="indefinite"/></g></svg>`,
  horizontal_pull: `<svg viewBox="0 0 200 130"><rect x="15" y="58" width="32" height="32" rx="6" fill="#3a4a56"/>
    <g><rect x="115" y="66" width="55" height="9" rx="4" fill="#2f9e8f"/><circle cx="170" cy="70" r="11" fill="#e8a33d"/>
    <animateTransform attributeName="transform" type="translate" values="0 0;-65 0;0 0" dur="1.5s" repeatCount="indefinite"/></g></svg>`,
  hinge: `<svg viewBox="0 0 200 130"><circle cx="100" cy="28" r="10" fill="#e8a33d"/>
    <line x1="100" y1="72" x2="90" y2="118" stroke="#3a4a56" stroke-width="6"/><line x1="100" y1="72" x2="110" y2="118" stroke="#3a4a56" stroke-width="6"/>
    <g><line x1="100" y1="38" x2="100" y2="72" stroke="#2f9e8f" stroke-width="6"/>
    <animateTransform attributeName="transform" type="rotate" values="0 100 72;35 100 72;0 100 72" dur="1.7s" repeatCount="indefinite"/></g></svg>`,
  leg_press: `<svg viewBox="0 0 200 130"><circle cx="55" cy="35" r="8" fill="#e8a33d"/><line x1="55" y1="35" x2="120" y2="70" stroke="#3a4a56" stroke-width="6"/>
    <g><line x1="120" y1="70" x2="150" y2="30" stroke="#2f9e8f" stroke-width="6"/>
    <animateTransform attributeName="transform" type="rotate" values="0 120 70;-38 120 70;0 120 70" dur="1.5s" repeatCount="indefinite"/></g></svg>`,
  lateral_raise: `<svg viewBox="0 0 200 130"><circle cx="100" cy="28" r="10" fill="#e8a33d"/><line x1="100" y1="45" x2="100" y2="95" stroke="#3a4a56" stroke-width="6"/>
    <g><line x1="100" y1="45" x2="100" y2="90" stroke="#2f9e8f" stroke-width="6"/><animateTransform attributeName="transform" type="rotate" values="0 100 45;-82 100 45;0 100 45" dur="1.5s" repeatCount="indefinite"/></g>
    <g><line x1="100" y1="45" x2="100" y2="90" stroke="#2f9e8f" stroke-width="6"/><animateTransform attributeName="transform" type="rotate" values="0 100 45;82 100 45;0 100 45" dur="1.5s" repeatCount="indefinite"/></g></svg>`,
  curl: `<svg viewBox="0 0 200 130"><line x1="90" y1="25" x2="90" y2="78" stroke="#3a4a56" stroke-width="6"/>
    <g><line x1="90" y1="78" x2="90" y2="122" stroke="#2f9e8f" stroke-width="6"/><circle cx="90" cy="122" r="8" fill="#e8a33d"/>
    <animateTransform attributeName="transform" type="rotate" values="0 90 78;-112 90 78;0 90 78" dur="1.5s" repeatCount="indefinite"/></g></svg>`,
  fly: `<svg viewBox="0 0 200 130"><circle cx="100" cy="28" r="10" fill="#e8a33d"/><line x1="100" y1="45" x2="100" y2="102" stroke="#3a4a56" stroke-width="6"/>
    <g><line x1="100" y1="55" x2="100" y2="100" stroke="#2f9e8f" stroke-width="6"/><animateTransform attributeName="transform" type="rotate" values="-70 100 55;0 100 55;-70 100 55" dur="1.6s" repeatCount="indefinite"/></g>
    <g><line x1="100" y1="55" x2="100" y2="100" stroke="#2f9e8f" stroke-width="6"/><animateTransform attributeName="transform" type="rotate" values="70 100 55;0 100 55;70 100 55" dur="1.6s" repeatCount="indefinite"/></g></svg>`,
  core: `<svg viewBox="0 0 200 130"><line x1="55" y1="100" x2="145" y2="100" stroke="#3a4a56" stroke-width="4"/><circle cx="130" cy="80" r="8" fill="#3a4a56"/>
    <g><line x1="70" y1="95" x2="120" y2="80" stroke="#2f9e8f" stroke-width="6"/><circle cx="70" cy="95" r="9" fill="#e8a33d"/>
    <animateTransform attributeName="transform" type="rotate" values="0 120 80;22 120 80;0 120 80" dur="1.5s" repeatCount="indefinite"/></g></svg>`,
  cardio: `<svg viewBox="0 0 200 130"><circle cx="100" cy="22" r="10" fill="#e8a33d"/><line x1="100" y1="32" x2="100" y2="72" stroke="#3a4a56" stroke-width="6"/>
    <g><line x1="100" y1="72" x2="130" y2="115" stroke="#2f9e8f" stroke-width="6"/><animateTransform attributeName="transform" type="rotate" values="0 100 72;-32 100 72;0 100 72" dur="0.8s" repeatCount="indefinite"/></g>
    <g><line x1="100" y1="72" x2="70" y2="115" stroke="#2f9e8f" stroke-width="6"/><animateTransform attributeName="transform" type="rotate" values="0 100 72;32 100 72;0 100 72" dur="0.8s" repeatCount="indefinite"/></g></svg>`,
  kegel: `<svg viewBox="0 0 200 130"><circle cx="100" cy="55" r="30" fill="none" stroke="#2f9e8f" stroke-width="6">
    <animate attributeName="r" values="30;16;30" dur="2.2s" repeatCount="indefinite"/><animate attributeName="stroke" values="#2f9e8f;#e8a33d;#2f9e8f" dur="2.2s" repeatCount="indefinite"/></circle>
    <text x="100" y="105" text-anchor="middle" font-size="13" fill="#9fb0ab">contrai / rilascia</text></svg>`,
};

const MEALS = {
  "d1": {
    "label": "Giorno 1 · Full body A — Allenamento",
    "kcal": "≈ 2899 kcal",
    "macros": "~205g proteine · 327g carbo · 82g grassi",
    "items": [
      {
        "t": "08:00 · Colazione",
        "icon": "🥣",
        "txt": "250g yogurt greco 0% + 80g fiocchi d'avena + 200ml latte parzialmente scremato; 1 banana (circa 120g) + 15g burro d'arachidi. Mescola a freddo, senza cottura.",
        "m": "734 kcal · P48 · C96 · G18"
      },
      {
        "t": "11:30 · Spuntino",
        "icon": "🥜",
        "txt": "30g mandorle + 1 mela",
        "m": "265 kcal · P6 · C31 · G15"
      },
      {
        "t": "13:00 · Pranzo",
        "icon": "🍗",
        "txt": "200g petto di pollo alla griglia; 110g riso basmati (a crudo); verdure con 10g olio EVO",
        "m": "752 kcal · P58 · C94 · G15"
      },
      {
        "t": "16:30 · Spuntino",
        "icon": "🍌",
        "txt": "1 banana + 50g gallette di riso con miele",
        "m": "346 kcal · P5 · C80 · G2"
      },
      {
        "t": "21:00 · Cena",
        "icon": "🥩",
        "txt": "220g manzo magro (5%) alla piastra; 300g patate dolci al forno; insalata con 10g olio EVO",
        "m": "650 kcal · P55 · C60 · G22"
      },
      {
        "t": "23:00 · Pre nanna",
        "icon": "🥣",
        "txt": "250g yogurt greco 0%; 20g cioccolato fondente 85%",
        "m": "260 kcal · P25 · C15 · G9"
      }
    ]
  },
  "d2": {
    "label": "Giorno 2 · Full body B — Allenamento",
    "kcal": "≈ 2715 kcal",
    "macros": "~189g proteine · 263g carbo · 91g grassi",
    "items": [
      {
        "t": "08:00 · Colazione",
        "icon": "🥣",
        "txt": "250g yogurt greco 0% + 70g fiocchi d'avena + 100g mirtilli + 15g burro d'arachidi. Tutto in una ciotola, senza cottura.",
        "m": "555 kcal · P39 · C67 · G14"
      },
      {
        "t": "11:30 · Spuntino",
        "icon": "🍎",
        "txt": "1 mela + 20g burro di arachidi",
        "m": "250 kcal · P7 · C25 · G16"
      },
      {
        "t": "13:00 · Pranzo",
        "icon": "🦃",
        "txt": "220g petto di tacchino alla griglia; 120g pasta integrale (a crudo); verdure con 10g olio EVO",
        "m": "795 kcal · P71 · C88 · G16"
      },
      {
        "t": "16:30 · Spuntino",
        "icon": "🍌",
        "txt": "1 banana + 40g gallette di riso con 20g miele",
        "m": "322 kcal · P5 · C76 · G2"
      },
      {
        "t": "21:00 · Cena",
        "icon": "🐟",
        "txt": "200g salmone al forno; 300g patate; insalata con 10g olio EVO",
        "m": "787 kcal · P49 · C59 · G37"
      },
      {
        "t": "23:00 · Pre nanna",
        "icon": "🥣",
        "txt": "200g fiocchi di latte magri (cottage) + 20g mandorle",
        "m": "280 kcal · P28 · C10 · G14"
      }
    ]
  },
  "d3": {
    "label": "Giorno 3 · Full body C — Allenamento",
    "kcal": "≈ 2910 kcal",
    "macros": "~216g proteine · 311g carbo · 80g grassi",
    "items": [
      {
        "t": "08:00 · Colazione",
        "icon": "🥛",
        "txt": "250ml latte parzialmente scremato + 100g fiocchi d'avena; 250g yogurt greco 0% + 15g burro d'arachidi. Avena a freddo o lasciata in ammollo in frigorifero dalla sera prima.",
        "m": "724 kcal · P51 · C83 · G20"
      },
      {
        "t": "11:30 · Spuntino",
        "icon": "🥣",
        "txt": "200g yogurt greco 0% in vasetto + 1 banana (circa 120g) + 10g mandorle. Pronti da consumare; tieni lo yogurt al fresco.",
        "m": "286 kcal · P24 · C35 · G7"
      },
      {
        "t": "13:00 · Pranzo",
        "icon": "🍗",
        "txt": "200g petto di pollo; 90g riso basmati (a crudo); verdure con 10g olio EVO",
        "m": "740 kcal · P68 · C70 · G17"
      },
      {
        "t": "16:30 · Spuntino",
        "icon": "🍯",
        "txt": "1 banana + 30g miele su 40g gallette di riso",
        "m": "280 kcal · P3 · C60 · G1"
      },
      {
        "t": "21:00 · Cena",
        "icon": "🐟",
        "txt": "200g salmone al forno; 250g patate dolci; insalata con 10g olio EVO",
        "m": "620 kcal · P45 · C48 · G26"
      },
      {
        "t": "23:00 · Pre nanna",
        "icon": "🍫",
        "txt": "250g yogurt greco 0% + 20g cioccolato fondente 85%",
        "m": "260 kcal · P25 · C15 · G9"
      }
    ]
  },
  "d4": {
    "label": "Giorno 4 · Richiamo/aerobico (opzionale)",
    "kcal": "≈ 2780 kcal",
    "macros": "~198g proteine · 312g carbo · 77g grassi",
    "items": [
      {
        "t": "08:00 · Colazione",
        "icon": "🍞",
        "txt": "100g pane integrale con 25g burro d'arachidi e 20g marmellata; 250g yogurt greco 0%. Pane pronto, senza tostatura.",
        "m": "598 kcal · P41 · C67 · G18"
      },
      {
        "t": "11:30 · Spuntino",
        "icon": "🥣",
        "txt": "200g yogurt greco 0% in vasetto + 1 banana (circa 120g) + 10g mandorle. Nessun frullatore; tieni lo yogurt al fresco.",
        "m": "286 kcal · P24 · C35 · G7"
      },
      {
        "t": "13:00 · Pranzo",
        "icon": "🥩",
        "txt": "200g manzo magro (5%) macinato; 60g couscous integrale (a crudo); verdure con 10g olio EVO",
        "m": "624 kcal · P52 · C50 · G22"
      },
      {
        "t": "16:30 · Spuntino",
        "icon": "🍎",
        "txt": "40g gallette di riso con 20g miele + 1 mela",
        "m": "294 kcal · P4 · C70 · G2"
      },
      {
        "t": "21:00 · Cena",
        "icon": "🍳",
        "txt": "2 uova intere ben cotte + 120g petto di pollo alla piastra; 250g patate al forno; 200g insalata con 10g olio EVO. Le uova sostituiscono parte del pollo.",
        "m": "608 kcal · P48 · C51 · G22"
      },
      {
        "t": "23:00 · Pre nanna",
        "icon": "🍫",
        "txt": "250g yogurt greco 0% + 20g cioccolato fondente 85%",
        "m": "260 kcal · P25 · C15 · G9"
      }
    ]
  },
  "r1": {
    "label": "Riposo A",
    "kcal": "≈ 2314 kcal",
    "macros": "~181g proteine · 206g carbo · 83g grassi",
    "items": [
      {
        "t": "08:00 · Colazione",
        "icon": "🥣",
        "txt": "250g yogurt greco 0% + 80g fiocchi d'avena + 200ml latte parzialmente scremato + 20g burro d'arachidi. Mescola a freddo o prepara la sera prima e conserva in frigorifero.",
        "m": "658 kcal · P48 · C69 · G20"
      },
      {
        "t": "11:30 · Spuntino",
        "icon": "🥜",
        "txt": "20g mandorle + 1 mela",
        "m": "200 kcal · P4 · C27 · G10"
      },
      {
        "t": "13:00 · Pranzo",
        "icon": "🦃",
        "txt": "200g petto di tacchino alla griglia; 90g riso basmati (a crudo); verdure con 10g olio EVO",
        "m": "674 kcal · P58 · C78 · G14"
      },
      {
        "t": "16:30 · Spuntino",
        "icon": "🥣",
        "txt": "200g yogurt greco 0% + 20g noci",
        "m": "249 kcal · P24 · C10 · G14"
      },
      {
        "t": "21:00 · Cena",
        "icon": "🐟",
        "txt": "200g merluzzo o platessa al forno; 250g patate al forno; insalata con 10g olio EVO",
        "m": "497 kcal · P44 · C51 · G12"
      },
      {
        "t": "23:00 · Pre nanna",
        "icon": "🍫",
        "txt": "20g cioccolato fondente 85% + 1 kiwi",
        "m": "150 kcal · P2 · C14 · G9"
      }
    ]
  },
  "r2": {
    "label": "Riposo B",
    "kcal": "≈ 2304 kcal",
    "macros": "~168g proteine · 251g carbo · 69g grassi",
    "items": [
      {
        "t": "08:00 · Colazione",
        "icon": "🥣",
        "txt": "250g yogurt greco 0% + 60g fiocchi d'avena + 200ml latte parzialmente scremato + 20g burro d'arachidi. Mescola a freddo o prepara la sera prima e conserva in frigorifero.",
        "m": "584 kcal · P46 · C57 · G18"
      },
      {
        "t": "11:30 · Spuntino",
        "icon": "🧀",
        "txt": "150g fiocchi di latte magri (cottage) + 1 mela",
        "m": "230 kcal · P24 · C25 · G3"
      },
      {
        "t": "13:00 · Pranzo",
        "icon": "🧆",
        "txt": "220g ceci cotti (scolati); 80g riso basmati (a crudo); verdure con 10g olio EVO",
        "m": "786 kcal · P29 · C130 · G17"
      },
      {
        "t": "16:30 · Spuntino",
        "icon": "🥝",
        "txt": "20g mandorle + 1 kiwi",
        "m": "200 kcal · P4 · C22 · G11"
      },
      {
        "t": "21:00 · Cena",
        "icon": "🐟",
        "txt": "200g tonno al naturale (o pesce spada); 250g patate al forno; insalata con 10g olio EVO",
        "m": "565 kcal · P60 · C51 · G13"
      },
      {
        "t": "23:00 · Pre nanna",
        "icon": "🍫",
        "txt": "200g yogurt greco 0% + 20g cioccolato fondente 85%",
        "m": "230 kcal · P22 · C15 · G9"
      }
    ]
  },
  "r3": {
    "label": "Riposo C",
    "kcal": "≈ 2342 kcal",
    "macros": "~164g proteine · 206g carbo · 96g grassi",
    "items": [
      {
        "t": "08:00 · Colazione",
        "icon": "🍞",
        "txt": "80g pane integrale con 20g burro d'arachidi; 250g yogurt greco 0% + 150ml latte parzialmente scremato. Tutto pronto, senza cottura.",
        "m": "538 kcal · P43 · C53 · G17"
      },
      {
        "t": "11:30 · Spuntino",
        "icon": "🍊",
        "txt": "1 arancia + 15g noci",
        "m": "170 kcal · P3 · C20 · G10"
      },
      {
        "t": "13:00 · Pranzo",
        "icon": "🐟",
        "txt": "200g salmone al forno; 80g quinoa (a crudo); verdure con 10g olio EVO",
        "m": "850 kcal · P54 · C59 · G41"
      },
      {
        "t": "16:30 · Spuntino",
        "icon": "🍏",
        "txt": "1 mela + 20g mandorle",
        "m": "215 kcal · P5 · C25 · G12"
      },
      {
        "t": "21:00 · Cena",
        "icon": "🍳",
        "txt": "2 uova intere ben cotte + 120g petto di pollo alla piastra; 250g patate al forno; 200g insalata con 10g olio EVO. Le uova sostituiscono parte del pollo.",
        "m": "569 kcal · P47 · C43 · G22"
      },
      {
        "t": "23:00 · Pre nanna",
        "icon": "🥣",
        "txt": "200g yogurt greco 0% + 10g cioccolato fondente 85%",
        "m": "210 kcal · P22 · C10 · G7"
      }
    ]
  }
};

const FOOD_TABS = [
  {key:"d1", short:"G1 Full A"},
  {key:"d2", short:"G2 Full B"},
  {key:"d3", short:"G3 Full C"},
  {key:"d4", short:"G4 Richiamo"},
  {key:"r1", short:"Riposo A"},
  {key:"r2", short:"Riposo B"},
  {key:"r3", short:"Riposo C"},
];

const SUPPLEMENTS = [
  {icon:"⚡", title:"Creatina monoidrato", txt:"5 g a colazione ogni giorno, inclusi i giorni di riposo. Non serve una fase di carico."},
  {icon:"💊", title:"BCAA", txt:"Inseriti nel pre workout nei giorni di allenamento. Con un apporto proteico già elevato restano opzionali."},
  {icon:"🥤", title:"Maltodestrine", txt:"Inserite nel post workout nei giorni di allenamento. La quantità va definita in base al fabbisogno di carboidrati e alle calorie complessive."},
  {icon:"🐟", title:"Omega-3", txt:"Inseriti nel pre nanna. La dose va letta in termini di EPA + DHA e adattata anche al consumo di pesce della dieta."},
];


/* 1.12.0 — Come si esegue ogni esercizio (mostrato in "info" sotto l'animazione).
   p = posizione di partenza · s = esecuzione passo per passo · r = respirazione · e = errori da evitare */
const HOWTO = {
  "Tapis roulant — camminata in pendenza": {
    p:["Sali sul nastro fermo, piedi ai lati. Avvia a 3-4 km/h e sali sul nastro.","Imposta la pendenza gradualmente (7-10%) e poi la velocità (4,5-5,5 km/h)."],
    s:["Primi 3 minuti tranquilli per scaldarti, poi porta il ritmo in zona 2 (respiro accelerato ma riesci a parlare).","Busto dritto, passo naturale, braccia che oscillano libere.","Negli ultimi 2 minuti abbassa pendenza e velocità per tornare calmo.","Nei giorni A-B-C è il riscaldamento prima dei pesi: non arrivare stanco agli esercizi."],
    r:"Respiro regolare dal naso e dalla bocca, mai in affanno.",
    e:["Tenerti ai corrimano: riduce il lavoro e scarica la schiena in modo scorretto.","Pendenza troppo alta con passo corto sulle punte: affatica polpacci e ginocchia."]},
  "Esercizi di Kegel (pavimento pelvico)": {
    p:["Seduto o sdraiato, glutei, addome e cosce rilassati."],
    s:["Contrai i muscoli che useresti per trattenere la pipì, come a sollevarli verso l'interno.","Tieni la contrazione 5 secondi.","Rilascia completamente per 5 secondi: il rilascio conta quanto la contrazione.","Ripeti 10 volte per serie."],
    r:"Respira normalmente durante la contrazione, non trattenere il fiato.",
    e:["Stringere glutei, addome o cosce al posto del pavimento pelvico.","Spingere verso il basso invece di sollevare."]},
  "Crunch ai cavi in ginocchio": {
    p:["Cavo alto con la corda. Inginocchiati a circa mezzo metro dalla macchina.","Tieni la corda ai lati della testa, fianchi fermi sopra le ginocchia."],
    s:["Arrotola il busto verso il basso portando le costole verso il bacino.","Scendi finché i gomiti arrivano vicino alle cosce, pausa di 1 secondo.","Risali lentamente fino ad allungare l'addome, senza far tornare su il peso di colpo."],
    r:"Espira mentre scendi e contrai, inspira risalendo.",
    e:["Sederti sui talloni muovendo le anche: il movimento deve partire dal busto.","Tirare con le braccia invece che con l'addome."]},
  "Dead bug controllato": {
    p:["Sdraiato sulla schiena, braccia tese verso il soffitto, anche e ginocchia a 90°.","Schiaccia la zona lombare contro il pavimento."],
    s:["Allunga lentamente il braccio destro dietro la testa e la gamba sinistra in avanti, vicino al pavimento.","Torna al centro senza perdere il contatto della schiena con il pavimento.","Ripeti dall'altro lato: una ripetizione per lato."],
    r:"Espira lungo mentre allunghi braccio e gamba, inspira tornando.",
    e:["Inarcare la schiena quando la gamba scende: accorcia il movimento.","Andare veloce: l'esercizio funziona solo lento."]},
  "Leg press 45°": {
    p:["Schiena e glutei ben appoggiati allo schienale, piedi a metà pedana alla larghezza delle spalle, punte leggermente aperte.","Togli le sicure tenendo le gambe quasi tese ma non bloccate."],
    s:["Scendi lentamente (2-3 secondi) piegando le ginocchia verso il petto, ginocchia nella direzione delle punte.","Fermati intorno ai 90° o prima se senti fastidio al ginocchio.","Spingi con tutta la pianta, soprattutto con i talloni, fino quasi a distendere le gambe."],
    r:"Inspira scendendo, espira spingendo.",
    e:["Staccare il bacino dallo schienale in basso: scendi meno.","Bloccare le ginocchia in alto o farle cedere verso l'interno."]},
  "Panca piana con bilanciere": {
    p:["Sdraiato con gli occhi sotto il bilanciere, piedi piantati a terra.","Scapole strette e abbassate, leggero arco naturale della schiena, glutei sulla panca.","Presa poco più larga delle spalle, polsi dritti."],
    s:["Stacca il bilanciere e portalo sopra le spalle a braccia tese.","Scendi in 2-3 secondi fino a sfiorare il petto a metà sterno, gomiti a circa 45° dal busto.","Spingi in alto e leggermente indietro fino a braccia tese, senza perdere le scapole strette."],
    r:"Inspira prima di scendere e tieni l'aria in basso, espira nella spinta.",
    e:["Rimbalzare sul petto o staccare i glutei.","Gomiti aperti a 90°: stressano le spalle.","Allenarti pesante senza qualcuno che ti assista."]},
  "Rematore con manubrio monolaterale": {
    p:["Mano e ginocchio dello stesso lato sulla panca, l'altro piede a terra.","Schiena piatta quasi parallela al pavimento, manubrio a braccio teso sotto la spalla."],
    s:["Tira il manubrio verso l'anca portando il gomito indietro e vicino al fianco.","Stringi la scapola in alto per 1 secondo.","Scendi lentamente fino a braccio teso, lasciando allungare la schiena.","Completa tutte le ripetizioni con un braccio, poi cambia."],
    r:"Espira tirando, inspira scendendo.",
    e:["Ruotare il busto per sollevare più peso.","Tirare verso il petto con il gomito largo: lavora meno il dorsale."]},
  "Lento avanti con manubri, seduto": {
    p:["Panca con schienale quasi verticale, schiena e testa appoggiate.","Manubri all'altezza delle spalle, palmi in avanti, gomiti leggermente davanti al busto."],
    s:["Spingi i manubri verso l'alto fino a braccia quasi tese, avvicinandoli sopra la testa.","Scendi in 2 secondi fino all'altezza delle orecchie o del mento."],
    r:"Espira spingendo, inspira scendendo.",
    e:["Inarcare la zona lombare staccandola dallo schienale.","Far sbattere i manubri in alto o scendere troppo in basso con i gomiti dietro."]},
  "Leg curl sdraiato/seduto": {
    p:["Regola la macchina: ginocchio allineato al perno, rullo appena sopra il tallone.","Da sdraiato: bacino schiacciato sul cuscino. Da seduto: cosce bloccate dal rullo superiore."],
    s:["Piega le ginocchia portando i talloni verso i glutei.","Stringi i femorali 1 secondo in contrazione.","Torna lentamente in 2-3 secondi senza far sbattere il peso."],
    r:"Espira piegando, inspira tornando.",
    e:["Sollevare il bacino (sdraiato) per aiutarti.","Usare lo slancio e lasciare cadere il peso."]},
  "Alzate laterali con manubri": {
    p:["In piedi, piedi alla larghezza dei fianchi, busto appena inclinato in avanti.","Manubri ai lati delle cosce, gomiti leggermente piegati."],
    s:["Solleva le braccia di lato portando i gomiti verso l'alto, come a spingere le mani lontano.","Fermati all'altezza delle spalle, mignolo e pollice alla stessa altezza.","Scendi in 2-3 secondi senza appoggiare i manubri alle gambe."],
    r:"Espira salendo, inspira scendendo.",
    e:["Slanciare con il busto o alzare le spalle verso le orecchie.","Salire oltre le spalle con peso eccessivo."]},
  "Push down tricipiti ai cavi": {
    p:["Cavo alto con la corda, in piedi vicino alla macchina, busto leggermente in avanti.","Gomiti attaccati ai fianchi, avambracci paralleli al pavimento."],
    s:["Spingi la corda verso il basso fino a distendere completamente le braccia.","In fondo apri leggermente le estremità della corda e stringi i tricipiti.","Risali fino a 90° senza muovere i gomiti."],
    r:"Espira spingendo, inspira risalendo.",
    e:["Muovere i gomiti avanti e indietro.","Caricare con il peso del corpo piegandoti sopra la corda."]},
  "Knee raise alla captain chair": {
    p:["Avambracci sui cuscinetti, schiena appoggiata allo schienale, gambe a penzoloni."],
    s:["Porta le ginocchia verso il petto con controllo.","In alto arrotola leggermente il bacino verso di te: è qui che lavora l'addome.","Scendi lentamente senza far oscillare le gambe."],
    r:"Espira salendo, inspira scendendo.",
    e:["Slanciare le gambe e dondolare.","Fermarti a ginocchia a 90° senza chiudere il bacino."]},
  "Pallof press ai cavi": {
    p:["Cavo all'altezza del petto, mettiti di lato alla macchina a un passo di distanza.","Impugna la maniglia con due mani al centro del petto, piedi alla larghezza delle spalle, ginocchia morbide."],
    s:["Spingi le mani dritte davanti a te resistendo al cavo che vuole ruotarti.","Tieni 2 secondi a braccia tese senza far ruotare busto e bacino.","Riporta le mani al petto. Fai tutte le ripetizioni e poi cambia lato."],
    r:"Espira spingendo, respira normalmente nella tenuta.",
    e:["Lasciare ruotare il busto verso la macchina.","Stare troppo vicino: senza tensione l'esercizio non serve."]},
  "Stacco rumeno con bilanciere": {
    p:["In piedi, piedi alla larghezza dei fianchi, bilanciere in mano davanti alle cosce, presa poco più larga dei fianchi.","Ginocchia leggermente piegate, scapole indietro, schiena neutra."],
    s:["Spingi i glutei indietro come a chiudere una porta con il sedere.","Il bilanciere scende strisciando sulle cosce, fino a sotto le ginocchia o a metà tibia.","Fermati quando senti tirare i femorali, senza arrotondare la schiena.","Torna su spingendo il bacino in avanti e stringendo i glutei."],
    r:"Inspira e contrai l'addome prima di scendere, espira tornando su.",
    e:["Arrotondare la schiena per scendere di più.","Trasformarlo in uno squat piegando troppo le ginocchia.","Allontanare il bilanciere dalle gambe."]},
  "Lat machine presa larga": {
    p:["Regola il cuscinetto per bloccare le cosce, impugna la barra larga circa una volta e mezza le spalle.","Busto leggermente inclinato indietro, petto in fuori."],
    s:["Abbassa le scapole, poi tira la barra verso la parte alta del petto portando i gomiti verso i fianchi.","Pausa di 1 secondo con il petto verso la barra.","Risali lentamente fino a braccia quasi tese, sentendo allungare i dorsali."],
    r:"Espira tirando, inspira risalendo.",
    e:["Tirare dietro la nuca.","Dondolare con il busto per far scendere il peso."]},
  "Panca inclinata con manubri (30°)": {
    p:["Panca inclinata a 30°, schiena appoggiata, scapole strette e abbassate.","Manubri sopra il petto alto, palmi in avanti."],
    s:["Scendi in 2-3 secondi aprendo i gomiti a circa 45°, fino a sentire allungare il petto.","Spingi verso l'alto avvicinando i manubri sopra il petto, senza farli toccare."],
    r:"Inspira scendendo, espira spingendo.",
    e:["Inclinazione troppo alta: lavora soprattutto la spalla.","Scendere senza controllo o staccare le scapole dalla panca."]},
  "Affondi bulgari con manubri": {
    p:["Di spalle a una panca, appoggia il collo del piede posteriore sulla panca.","Piede anteriore abbastanza avanti da far scendere il ginocchio senza superare troppo la punta. Manubri lungo i fianchi."],
    s:["Scendi in verticale piegando il ginocchio anteriore, busto leggermente in avanti.","Fermati quando la coscia anteriore è quasi parallela o prima se senti fastidio al ginocchio.","Risali spingendo con il tallone della gamba davanti.","Completa le ripetizioni e poi cambia gamba."],
    r:"Inspira scendendo, espira risalendo.",
    e:["Ginocchio che cade verso l'interno.","Spingere con la gamba dietro: deve lavorare quella davanti.","Usare peso alto prima di avere equilibrio stabile."]},
  "Face pull ai cavi": {
    p:["Cavo all'altezza del viso con la corda, presa con i pollici verso di te.","Un passo indietro, braccia tese, petto alto."],
    s:["Tira la corda verso il viso aprendo le estremità ai lati delle orecchie.","Gomiti alti, all'altezza delle spalle o sopra. Stringi le scapole 1 secondo.","Torna lentamente a braccia tese."],
    r:"Espira tirando, inspira tornando.",
    e:["Gomiti bassi: diventa un rematore.","Inclinarti indietro per usare il peso del corpo."]},
  "Curl bicipiti con bilanciere": {
    p:["In piedi, presa alla larghezza delle spalle con i palmi in avanti.","Gomiti lungo i fianchi, ginocchia morbide, addome contratto."],
    s:["Piega i gomiti portando il bilanciere verso le spalle.","Contrai i bicipiti in alto 1 secondo.","Scendi in 2-3 secondi fino a braccia quasi tese."],
    r:"Espira salendo, inspira scendendo.",
    e:["Slanciare con la schiena o le anche.","Portare i gomiti in avanti durante la salita."]},
  "French press con manubrio": {
    p:["Seduto su panca con schienale, un manubrio tenuto con due mani sopra la testa.","Gomiti stretti e rivolti in avanti."],
    s:["Piega i gomiti facendo scendere il manubrio dietro la testa finché senti allungare i tricipiti.","Distendi le braccia tornando sopra la testa, muovendo solo gli avambracci."],
    r:"Inspira scendendo, espira distendendo.",
    e:["Aprire i gomiti verso l'esterno.","Inarcare la zona lombare: tieni l'addome contratto."]},
  "Ab wheel rollout": {
    p:["In ginocchio su un tappetino, ruota sotto le spalle, braccia tese.","Glutei e addome contratti, bacino leggermente chiuso."],
    s:["Fai rotolare la ruota in avanti allungando il corpo lentamente.","Vai avanti solo finché la zona lombare resta neutra.","Torna indietro tirando con l'addome, non con le braccia."],
    r:"Inspira andando avanti, espira tornando.",
    e:["Lasciare cedere la schiena verso il basso.","Andare troppo lontano le prime volte: aumenta l'ampiezza nelle settimane."]},
  "Side plank": {
    p:["Su un fianco, gomito sotto la spalla, gambe tese una sopra l'altra (o ginocchia piegate per una versione più facile)."],
    s:["Solleva il bacino finché il corpo è in linea dalla testa ai piedi.","Tieni la posizione per il tempo indicato senza far scendere il bacino.","Cambia lato."],
    r:"Respira regolarmente per tutta la tenuta.",
    e:["Bacino che scende o va indietro.","Spalla schiacciata verso l'orecchio: spingi il pavimento con l'avambraccio."]},
  "Hip thrust con bilanciere": {
    p:["Schiena alta appoggiata al bordo della panca (sotto le scapole), bilanciere imbottito sulle anche.","Piedi alla larghezza dei fianchi, ginocchia a 90° quando sei in alto."],
    s:["Spingi con i talloni sollevando il bacino fino a busto e cosce in linea.","Mento verso il petto, stringi i glutei 1 secondo in alto.","Scendi in 2 secondi senza appoggiare il bilanciere."],
    r:"Inspira in basso, espira spingendo.",
    e:["Inarcare la zona lombare in alto invece di chiudere con i glutei.","Piedi troppo vicini o lontani: lavora la coscia invece del gluteo."]},
  "Pulley basso (seated row)": {
    p:["Seduto, piedi sulla pedana, ginocchia leggermente piegate.","Impugna il triangolo, schiena dritta, busto verticale."],
    s:["Tira il triangolo verso l'ombelico portando i gomiti indietro vicino al corpo.","Stringi le scapole 1 secondo con il petto alto.","Torna lentamente allungando le braccia, senza far piegare la schiena in avanti."],
    r:"Espira tirando, inspira tornando.",
    e:["Dondolare con il busto avanti e indietro.","Alzare le spalle verso le orecchie."]},
  "Arnold press con manubri": {
    p:["Seduto con schienale quasi verticale, manubri davanti alle spalle, palmi verso di te come alla fine di un curl."],
    s:["Spingi verso l'alto ruotando i polsi: i palmi finiscono in avanti a braccia tese.","Scendi facendo la rotazione al contrario, fino a tornare con i palmi verso di te."],
    r:"Espira salendo, inspira scendendo.",
    e:["Ruotare tutto in fondo o tutto in cima: la rotazione deve essere continua.","Peso troppo alto che fa inarcare la schiena."]},
  "Croci ai cavi (cable fly)": {
    p:["Due cavi all'altezza delle spalle o poco sopra, una maniglia per mano.","Un passo avanti, busto leggermente inclinato, gomiti un po' piegati e fermi."],
    s:["Porta le mani davanti al petto in un ampio arco, come ad abbracciare un albero.","Pausa di 1 secondo con le mani unite e il petto contratto.","Torna aprendo lentamente fino a sentire allungare il petto, senza andare oltre la linea delle spalle."],
    r:"Espira chiudendo, inspira aprendo.",
    e:["Piegare e distendere i gomiti: diventa una spinta.","Aprire troppo indietro con peso alto: stressa la spalla."]},
  "Leg extension": {
    p:["Schiena appoggiata, ginocchio allineato al perno della macchina, rullo appena sopra le caviglie.","Impugna le maniglie laterali."],
    s:["Distendi le gambe in 1-2 secondi fino a quasi tese.","Stringi i quadricipiti 1 secondo in alto.","Scendi lentamente in 2-3 secondi senza far sbattere il peso."],
    r:"Espira distendendo, inspira scendendo.",
    e:["Carichi alti e movimento veloce: per il ginocchio conta il controllo.","Sollevare il bacino dal sedile."]},
  "Alzate laterali ai cavi (unilaterale)": {
    p:["Cavo basso con maniglia singola, mettiti di lato alla macchina e prendi la maniglia con la mano più lontana.","L'altra mano si tiene alla macchina, busto leggermente inclinato."],
    s:["Solleva il braccio di lato fino all'altezza della spalla, gomito leggermente piegato.","Pausa di 1 secondo in alto.","Scendi lentamente fino davanti al bacino mantenendo la tensione del cavo.","Completa le ripetizioni e cambia lato."],
    r:"Espira salendo, inspira scendendo.",
    e:["Inclinarti per aiutarti con il corpo.","Alzare la spalla verso l'orecchio."]},
  "Curl a martello con manubri": {
    p:["In piedi, manubri lungo i fianchi con i palmi rivolti verso il corpo, gomiti fermi."],
    s:["Piega i gomiti portando i manubri verso le spalle senza ruotare i polsi.","Contrai 1 secondo in alto.","Scendi lentamente fino a braccia quasi tese. Puoi alternare le braccia o farle insieme."],
    r:"Espira salendo, inspira scendendo.",
    e:["Slancio con il busto.","Gomiti che si spostano in avanti."]},
  "Calf raise in piedi": {
    p:["Avampiedi sul bordo della pedana, talloni liberi, spalle sotto i cuscinetti (o manubrio in mano tenendoti a un appoggio).","Gambe tese ma ginocchia non bloccate."],
    s:["Scendi con i talloni sotto il livello della pedana per allungare i polpacci.","Sali sulle punte il più in alto possibile e tieni 1 secondo.","Ritorna giù lentamente."],
    r:"Espira salendo, inspira scendendo.",
    e:["Rimbalzare in basso.","Movimento corto a metà: usa tutta l'ampiezza."]},
  "Plank frontale": {
    p:["A terra sugli avambracci, gomiti sotto le spalle, gambe tese sulle punte dei piedi."],
    s:["Solleva il corpo creando una linea dritta da testa a talloni.","Contrai glutei e addome come se volessi avvicinare gomiti e piedi.","Tieni la posizione per il tempo indicato."],
    r:"Respira regolarmente, senza trattenere il fiato.",
    e:["Bacino troppo basso (schiena che cede) o troppo alto.","Guardare avanti alzando la testa: lo sguardo va verso il pavimento."]},
  "Crunch inverso su panca": {
    p:["Sdraiato sulla panca piana, mani dietro la testa a tenere il bordo.","Anche e ginocchia piegate a 90°."],
    s:["Arrotola il bacino portando le ginocchia verso il petto e staccando il sedere dalla panca.","Contrai 1 secondo.","Torna giù lentamente fino a 90°, senza appoggiare i piedi."],
    r:"Espira salendo, inspira scendendo.",
    e:["Slanciare le gambe.","Usare le braccia per tirarti su."]},
  "Alzate posteriori (rear delt fly) su panca inclinata": {
    p:["Petto appoggiato a una panca inclinata a 30-45°, manubri leggeri che pendono sotto le spalle.","Gomiti leggermente piegati."],
    s:["Apri le braccia di lato portandole all'altezza delle spalle.","Pausa di 1 secondo, senza stringere troppo le scapole: deve lavorare la spalla posteriore.","Scendi lentamente."],
    r:"Espira aprendo, inspira scendendo.",
    e:["Peso troppo alto con slancio.","Alzare la testa e staccare il petto dalla panca."]},
  "Curl 21 (bicipiti, manubri leggeri)": {
    p:["In piedi con due manubri leggeri, palmi in avanti, gomiti lungo i fianchi."],
    s:["7 ripetizioni dalla posizione bassa fino a metà (gomiti a 90°).","7 ripetizioni dalla metà fino in alto.","7 ripetizioni complete dal basso all'alto.","Le 21 ripetizioni sono una serie unica senza pausa."],
    r:"Espira salendo, inspira scendendo.",
    e:["Peso troppo alto: l'ultima parte diventa slancio.","Fermarsi tra un blocco e l'altro."]},
};
