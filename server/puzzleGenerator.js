// Seeded PRNG (mulberry32)
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function seededPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Lock patterns on a 3x3 grid (dot indices 0-8):
// 0 1 2
// 3 4 5
// 6 7 8
const LOCK_PATTERNS = [
  [0, 3, 6, 7, 8],
  [2, 5, 8, 7, 6],
  [0, 1, 2, 5, 8],
  [6, 3, 0, 1, 2],
  [6, 7, 8, 5, 2],
  [0, 4, 8, 5, 2],
  [2, 4, 6, 3, 0],
  [0, 1, 4, 7, 6],
  [0, 3, 4, 5, 8],
  [8, 7, 4, 1, 0],
  [0, 1, 2, 4, 6, 7, 8],
  [6, 3, 0, 1, 4, 7, 8],
];

// Train geometry constants (must match client/src/train.js)
const HALF_WIDTH = 1.3;
const SEAT_DEPTH = 0.44;
const SECTION_START_Z = -7.0;
const SECTION_LENGTH = 2.8;
const SECTION_STRIDE = SECTION_LENGTH + 0.4;
const WINDOW_ZONE_START = -7.2;
const WINDOW_WIDTH = 1.1;
const WINDOW_SPACING = WINDOW_WIDTH + 0.35;

function sectionCenterZ(section) {
  return SECTION_START_Z + section * SECTION_STRIDE + SECTION_LENGTH / 2;
}

function windowCenterZ(idx) {
  return WINDOW_ZONE_START + idx * WINDOW_SPACING + WINDOW_WIDTH / 2;
}

function closestWindow(z) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 10; i++) {
    const dist = Math.abs(windowCenterZ(i) - z);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export function generateCar1(seed) {
  const rng = mulberry32(seed);

  // Phone location: side (0=left, 1=right) and section (0-4)
  const phoneSide = seededInt(rng, 0, 1);
  const phoneSection = seededInt(rng, 0, 4);
  const phoneSeatIndex = phoneSide * 5 + phoneSection;

  const phoneXSign = phoneSide === 0 ? -1 : 1;
  const phonePos = {
    x: phoneXSign * (HALF_WIDTH - SEAT_DEPTH / 2),
    y: 0.38,
    z: sectionCenterZ(phoneSection),
  };

  // Lock pattern
  const lockPattern = seededPick(rng, LOCK_PATTERNS);

  // Scratch marks on opposite-side window
  const scratchSide = 1 - phoneSide;
  const scratchWindowIdx = closestWindow(sectionCenterZ(phoneSection));

  // Compartment — different location from phone
  let compartmentSide, compartmentSection;
  do {
    compartmentSide = seededInt(rng, 0, 1);
    compartmentSection = seededInt(rng, 0, 4);
  } while (compartmentSide === phoneSide && compartmentSection === phoneSection);
  const compartmentIndex = compartmentSide * 5 + compartmentSection;

  // 4-digit code split between phone (first 2) and sticker (last 2)
  const code = String(seededInt(rng, 1000, 9999));
  const phoneCodePart = code.slice(0, 2);
  const stickerCodePart = code.slice(2, 4);

  // Compartment tag color (only one compartment has this color)
  const tagOptions = ['red', 'blue', 'green', 'yellow', 'white'];
  const targetTag = seededPick(rng, tagOptions);

  // Tags for all 10 compartments
  const otherTags = tagOptions.filter((t) => t !== targetTag);
  const compartmentTags = [];
  for (let i = 0; i < 10; i++) {
    compartmentTags.push(i === compartmentIndex ? targetTag : seededPick(rng, otherTags));
  }

  // Hidden meta-puzzle number (on a different seat)
  let hiddenSeat;
  do {
    hiddenSeat = seededInt(rng, 0, 9);
  } while (hiddenSeat === phoneSeatIndex);
  const hiddenNumber = seededInt(rng, 0, 9);

  return {
    phoneSeatIndex,
    phoneSide,
    phoneSection,
    phonePos,
    lockPattern,
    scratchSide,
    scratchWindowIdx,
    compartmentIndex,
    compartmentSide,
    compartmentSection,
    code,
    phoneCodePart,
    stickerCodePart,
    targetTag,
    compartmentTags,
    hiddenSeat,
    hiddenNumber,
  };
}

// Convert lock pattern indices to visual line segments for the client.
// This exposes the scratch *appearance* without revealing which grid dots
// are part of the answer or their order.
function patternToScratchLines(pattern) {
  const cols = [0.25, 0.5, 0.75];
  const rows = [0.25, 0.5, 0.75];
  const dotPos = (idx) => ({ x: cols[idx % 3], y: rows[Math.floor(idx / 3)] });

  const segments = [];
  for (let i = 1; i < pattern.length; i++) {
    const a = dotPos(pattern[i - 1]);
    const b = dotPos(pattern[i]);
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  // Include which dots are highlighted (but NOT the order)
  const highlightedDots = [...new Set(pattern)].sort((a, b) => a - b);
  return { segments, highlightedDots };
}

export function getCar1Layout(config) {
  return {
    phonePos: config.phonePos,
    phoneSeatIndex: config.phoneSeatIndex,
    scratchSide: config.scratchSide,
    scratchWindowIdx: config.scratchWindowIdx,
    scratchVisual: patternToScratchLines(config.lockPattern),
    compartmentIndex: config.compartmentIndex,
    targetTag: config.targetTag,
    stickerCode: config.stickerCodePart,
    compartmentTags: config.compartmentTags,
    hiddenSeat: config.hiddenSeat,
    hiddenNumber: config.hiddenNumber,
  };
}

export function createCar1State() {
  return {
    seatLiftedBy: null,
    phoneGrabbedBy: null,
    phoneUnlocked: false,
    compartmentOpen: false,
    keycardTaken: false,
    keycardHolder: null,
    doorSwiped: false,
    completed: false,
  };
}

// =========================================================
// CAR 2 — "The Route"
// =========================================================

// Short NYC station names — fit comfortably on crossword clues and map labels
const STATION_POOL = [
  'CANAL', 'ASTOR', 'FULTON', 'BOWERY', 'HOUSTON', 'DELANCEY',
  'CHAMBERS', 'SPRING', 'PRINCE', 'NASSAU', 'CORTLANDT', 'BLEECKER',
];

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateCar2(seed) {
  // Different sub-seed from car 1 so each car randomizes independently
  const rng = mulberry32(seed ^ 0x5ca71e);

  const stations = shuffleInPlace([...STATION_POOL], rng);
  const realStations = stations.slice(0, 6);
  const mapDecoys = stations.slice(6, 9);
  const crosswordDecoys = stations.slice(9, 12);

  // Line numbers 1-9. Real stations get unique-ish lines so the code is varied.
  const lineAssignments = {};
  for (const s of [...realStations, ...mapDecoys, ...crosswordDecoys]) {
    lineAssignments[s] = seededInt(rng, 1, 9);
  }

  // Route order (what the ticket shows)
  const routeOrder = shuffleInPlace([...realStations], rng);

  // 6-digit code: concatenated line numbers in route order
  const code = routeOrder.map((s) => String(lineAssignments[s])).join('');

  // Map visual: real + map-decoys all circled. Randomize on-map positions.
  const mapStations = shuffleInPlace([...realStations, ...mapDecoys], rng);
  const mapStationPositions = {};
  mapStations.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    mapStationPositions[s] = {
      x: 0.18 + col * 0.32 + (rng() - 0.5) * 0.06,
      y: 0.22 + row * 0.26 + (rng() - 0.5) * 0.06,
    };
  });

  // Crossword: real + crossword-decoys filled in, plus some empty-numbered clues for flavor.
  const crosswordFilled = shuffleInPlace([...realStations, ...crosswordDecoys], rng);
  const crosswordClues = [];
  let nextClueNum = seededInt(rng, 1, 4);
  for (let i = 0; i < crosswordFilled.length; i++) {
    crosswordClues.push({
      num: nextClueNum,
      dir: rng() < 0.5 ? 'ACROSS' : 'DOWN',
      answer: crosswordFilled[i],
      hint: generateClueHint(crosswordFilled[i], rng),
    });
    nextClueNum += seededInt(rng, 1, 4);
  }
  // Add 2-3 empty clues for red-herring flavor
  const blankCount = seededInt(rng, 2, 3);
  for (let i = 0; i < blankCount; i++) {
    crosswordClues.push({
      num: nextClueNum,
      dir: rng() < 0.5 ? 'ACROSS' : 'DOWN',
      answer: '',
      hint: 'Manhattan landmark (unsolved)',
    });
    nextClueNum += seededInt(rng, 1, 4);
  }
  crosswordClues.sort((a, b) => a.num - b.num);

  // Placement in the 3D car
  const mapSide = seededInt(rng, 0, 1);
  const mapPanelIdx = seededInt(rng, 1, 3); // 5 ad slots; avoid very ends
  const newspaperSeat = seededInt(rng, 0, 9);
  // Ticket on the floor, opposite side of the map and on a different half of car
  const ticketSide = 1 - mapSide;
  const ticketZ = (rng() * 10 - 5);
  const ticketX = (ticketSide === 0 ? -1 : 1) * (0.4 + rng() * 0.3);

  // Hidden meta-puzzle number (Car 8)
  const hiddenNumber = seededInt(rng, 0, 9);
  // Hide it on a seat (different from the newspaper seat)
  let hiddenSeat;
  do {
    hiddenSeat = seededInt(rng, 0, 9);
  } while (hiddenSeat === newspaperSeat);

  return {
    realStations,
    mapDecoys,
    crosswordDecoys,
    lineAssignments,
    routeOrder,
    code,
    mapStations,
    mapStationPositions,
    crosswordClues,
    mapSide,
    mapPanelIdx,
    newspaperSeat,
    ticketZ,
    ticketX,
    hiddenSeat,
    hiddenNumber,
  };
}

// Tiny clue-hint generator — purely flavor text so the crossword reads like a real one.
// The answer is already filled in; the hint just adds atmosphere.
const CLUE_FLAVOR = [
  'Lower Manhattan stop', 'Named for a street', 'Downtown transfer',
  'On the east side', 'Former ferry terminus', 'Historic district',
  'Near the park', 'Cast iron district', 'Near the bridge',
  'Turn-of-century name', 'Commuter hub', 'Greenwich Village',
];
function generateClueHint(_answer, rng) {
  return CLUE_FLAVOR[Math.floor(rng() * CLUE_FLAVOR.length)];
}

export function getCar2Layout(config) {
  // Expose line numbers only for map-circled stations — crossword shows plain words.
  const mapLineNumbers = {};
  for (const s of config.mapStations) {
    mapLineNumbers[s] = config.lineAssignments[s];
  }
  return {
    mapSide: config.mapSide,
    mapPanelIdx: config.mapPanelIdx,
    mapStations: config.mapStations,
    mapStationPositions: config.mapStationPositions,
    mapLineNumbers,
    crosswordClues: config.crosswordClues,
    routeOrder: config.routeOrder,
    codeLength: config.code.length,
    newspaperSeat: config.newspaperSeat,
    ticketZ: config.ticketZ,
    ticketX: config.ticketX,
    hiddenSeat: config.hiddenSeat,
    hiddenNumber: config.hiddenNumber,
  };
}

export function createCar2State() {
  return {
    wrongAttempts: 0,
    lockoutUntil: 0,
    completed: false,
  };
}

