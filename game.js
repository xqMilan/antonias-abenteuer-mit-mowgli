const PERSONAL = {
    heroName: 'Antonia',
    catName: 'Mogli',
    endingTitle: 'Geschafft!',
    endingLines: [
        
    ],
    endingSignature: 'Alles gute zum Jahrestag Mausi!',
    heroColors: {
        hair: '#d9b380',
        dress: '#e2574c',
        skin: '#f6c9a4',
        shoes: '#3c3b4d',
    },

    partnerColors: {
        hair: '#4a3222',
        shirt: '#3f6fb0',
        skin: '#f0c29c',
        pants: '#34344a',
    },


    chapters: {
        prag: {
            flag: 'Prag', 
            title: 'Prag',
            subtitle: '',
            message: [
            ],
        },
        italien: {
            flag: "L'Oasi",
            title: '',
            subtitle: '',
            message: [
            ],
        },
        afrika: {
            flag: 'Afrikanisches Restaurant',
            title: '',
            subtitle: '',
            message: [
            ],
        },
        marokko: {
            flag: 'Marokko',
            title: 'Marokko',
            subtitle: '',
            message: [
            ],
        },
        harz: {
            flag: 'Harz', 
            title: 'Harz',
            subtitle: '',
            message: [

            ],
        },
        finale: {
            title: 'Und weiter',
            subtitle: '',
            message: [
            ],
        },
    },
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        const radius = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
        this.moveTo(x + radius, y);
        this.arcTo(x + w, y, x + w, y + h, radius);
        this.arcTo(x + w, y + h, x, y + h, radius);
        this.arcTo(x, y + h, x, y, radius);
        this.arcTo(x, y, x + w, y, radius);
        this.closePath();
        return this;
    };
}

const VIEW_HEIGHT_BASE = 540;
const VIEW_WIDTH_MIN = 660;

let viewScale = 1;
let viewWidth = 960;
let viewHeight = VIEW_HEIGHT_BASE;

// Die eigentliche Bildschirmgröße - bevorzugt visualViewport, weil sich bei
// Mobilgeräten die Adressleiste ein-/ausblendet und window.innerHeight dabei
// veraltete Werte liefern kann. Die Canvas-Größe selbst regelt CSS
// (position: fixed; inset: 0), hier geht es nur um die Zeichenauflösung.
function currentViewportSize() {
    const vv = window.visualViewport;
    return vv ? { w: vv.width, h: vv.height } : { w: window.innerWidth, h: window.innerHeight };
}

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h } = currentViewportSize();
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));

    viewScale = Math.min(canvas.height / VIEW_HEIGHT_BASE, canvas.width / VIEW_WIDTH_MIN);
    viewWidth = canvas.width / viewScale;
    viewHeight = canvas.height / viewScale;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 60));
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}




const STEP_MS = 1000 / 60;


// Laufen 

// Höchsttempo beim Laufen
const MAX_RUN_SPEED = 3.0;

// Wie schnell man am Boden auf Tempo kommt.
const RUN_ACCEL = 0.15;

// Bremsen am Boden, wenn man nichts drückt.
const RUN_FRICTION = 0.22;

// Lenken in der Luft.
// Höher = volle Kontrolle im Sprung, niedriger = Flugbahn ist fast festgelegt.
const AIR_ACCEL = 0.3;

// Luftwiderstand, wenn man in der Luft nichts drückt.
// 0 = behält das Tempo, 0.1 = bremst spürbar ab.
const AIR_DRAG = 0.015;

// Tempo beim Ducken, als Anteil vom Höchsttempo (0.45 = 45 %).
const DUCK_SPEED_FACTOR = 0.5;


// Springen & Fallen 

// Schwerkraft. Bestimmt zusammen mit JUMP_VELOCITY Sprunghöhe UND -dauer:
//   Sprunghöhe = JUMP_VELOCITY² / (2 · GRAVITY)
// Weniger = schwebender, mehr = knackiger und schneller wieder unten.
const GRAVITY = 0.42;

// Absprungkraft (negativ = nach oben). Größerer Betrag = höherer Sprung.
// Tipp: Gleich hoch, aber knackiger -> GRAVITY verdoppeln und
// JUMP_VELOCITY mit 1.41 multiplizieren.
const JUMP_VELOCITY = -7.2;

// Höchste Fallgeschwindigkeit - verhindert, dass lange Stürze unkontrollierbar werden.
const MAX_FALL_SPEED = 15;

// Kurz tippen = kleiner Sprung: beim Loslassen wird die Aufwärtsbewegung auf
// diesen Wert gekappt. Näher an 0 = Tippen gibt nur winzige Hüpfer.
// Gleich JUMP_VELOCITY = jeder Sprung ist gleich hoch, egal wie lange man drückt.
const JUMP_CUT_VELOCITY = -3.5;

// "Coyote-Zeit": so viele Frames nach dem Verlassen einer Kante darf man noch
// springen. 0 = gnadenlos, 6-8 = sehr verzeihend.
const COYOTE_FRAMES = 3;

// Sprungpuffer: wer so viele Frames VOR der Landung drückt, springt beim
// Aufkommen trotzdem sofort. Höher = verzeihender.
const JUMP_BUFFER_FRAMES = 10;

// Kanten bis zu dieser Höhe steigt man automatisch hoch, ohne zu springen.
const STEP_ASSIST = 9;


/* --- Kuh (Sprungbrett) -------------------------------------------- */

// Wie stark die Kuh nach oben schleudert. Boost-Höhe = Wert² / (2 · GRAVITY).
// Muss höher tragen als ein normaler Sprung, sonst kommt man nicht über die
// hohen Mauern hinter den Kühen.
const COW_BOUNCE_VELOCITY = -16.5;

// Unsichtbare Landefläche links und rechts neben der Kuh / dem Heuballen.
// 0 = aus: das Sprungbrett löst nur aus, wenn man wirklich darauf landet.
const COW_LANDING_LIP = 0;


/* --- Mowgli ------------------------------------------------------- */

// Sprungkraft, wenn man auf Mowgli sitzt (beide springen zusammen).
const MOWGLI_JUMP_VELOCITY = -8.4;

// Absprung von Mowgli (zweiter Druck, während er in der Luft ist).
const DISMOUNT_VELOCITY = -8.4;

// Anlaufen beim Reiten, als Anteil von RUN_ACCEL. Höchsttempo = MAX_RUN_SPEED.
const MOWGLI_ACCEL_FACTOR = 0.95;

// So viele Frames nach dem Absteigen kann man nicht sofort wieder aufsitzen.
const MOWGLI_REMOUNT_FRAMES = 14;

// Läuft Mowgli beim Reiten in eine Gefahr, wirft er Antonia ab (ihm selbst
// passiert nichts). So stark fliegt sie dabei hoch und nach hinten weg:
const MOWGLI_THROW_VELOCITY = -7;
const MOWGLI_THROW_PUSH = 3;
// Danach kann man so viele Frames nicht wieder aufsitzen
const MOWGLI_THROW_REMOUNT_FRAMES = 45;

// Unsichtbare Landehilfe auf Mowglis Rücken (wie bei der Kuh). 0 = aus.
const CAT_LANDING_LIP = 0;

// Springt man über Mowgli, läuft er einem bis zu dieser Entfernung entgegen. 0 = aus.
const CAT_FOLLOW_RANGE = 0;
const CAT_FOLLOW_SPEED = 1.7; // Tempo dabei


/* --- Käfer, Sand, Tod --------------------------------------------- */

const CRITTER_SPEED = 1.1;          // Laufgeschwindigkeit der Käfer
const STOMP_BOUNCE_VELOCITY = -9;   // Rückstoß nach oben beim Draufspringen

// Sand in Marokko, jeweils als Faktor gegenüber normalem Boden (1 = kein Unterschied)
const SAND_ACCEL_FACTOR = 0.68;     // schwerer anzulaufen
const SAND_FRICTION_FACTOR = 0.55;  // rutscht länger nach
const SAND_SPEED_FACTOR = 0.88;     // etwas langsamer

// Nach dem Tod reagiert die Leertaste erst nach so vielen Frames, damit ein
// noch gedrückter Sprung nicht sofort weiterschaltet.
const RESPAWN_INPUT_DELAY = 18;


/* --- Kamera ------------------------------------------------------- */

// Wo die Figur waagerecht im Bild steht (0.38 = bei 38 % von links).
// Kleiner = man sieht mehr vom Weg voraus.
const CAMERA_PLAYER_POSITION = 0.38;

// Die Kamera schaut in Laufrichtung voraus: Tempo × dieser Wert.
const CAMERA_LOOK_AHEAD = 12;

/* --- Admin-Modus (nur zum Testen) ---------------------------------- */

// Taste 0 schaltet den Admin-Modus an/aus. Darin:
//   1-6 = an den Anfang von Kapitel 1-6 springen
//   V   = Fliegen an/aus (frei bewegen, durch Wände, unverwundbar)
// Vor dem Verschenken auf false setzen, dann gibt es ihn gar nicht.
const ADMIN_ENABLED = false;
const ADMIN_FLY_SPEED = 8;        // Fluggeschwindigkeit (Pixel pro Frame)

// Wie schnell die Kamera waagerecht folgt (0 bis 1).
// 1 = klebt starr, 0.05 = schwebt weich hinterher.
const CAMERA_SMOOTHING = 0.05;


/* --- Hindernisse & Schwierigkeit ---------------------------------- */

// Wie weit die bewusst schweren Sprünge in den Kapiteln gehen dürfen, als
// Anteil der rechnerisch maximalen Sprungweite. 0.75 = anspruchsvoll, aber
// mit Anlauf sicher schaffbar. Kleiner = leichter, größer = härter.
const HARD_JUMP_FACTOR = 0.75;

// Bröckelnde Plattformen (lose Dachziegel, Felsvorsprünge)
const CRUMBLE_DELAY_FRAMES = 28;     // so lange hält sie, nachdem man draufsteht
const CRUMBLE_RESPAWN_FRAMES = 150;  // danach taucht sie wieder auf

// Plattformen im Takt (Apostelfiguren der Prager Uhr): so viele Frames vor dem
// Verschwinden blinken sie als Warnung.
const TIMED_BLINK_FRAMES = 45;

// Fallende Gegenstände (Blumentöpfe, Tonkrüge, Steine)
const DROPPER_WARN_FRAMES = 40;      // so lange wackelt der Gegenstand vorher
const DROPPER_GRAVITY = 0.5;

// Rutschiger Boden (Olivenöl): weniger Halt beim Anlaufen und Bremsen
const SLIPPERY_ACCEL_FACTOR = 0.35;
const SLIPPERY_FRICTION_FACTOR = 0.08;

// Treibsand (Marokko): wer stehen bleibt, versinkt
const QUICKSAND_SINK_SPEED = 0.55;    // so schnell sinkt man ein (Pixel pro Frame)
const QUICKSAND_DEPTH = 34;           // so tief - dann ist man versunken
const QUICKSAND_SPEED_FACTOR = 0.55;  // Laufen im Treibsand ist mühsam

// Sprungbretter (Markise, Trommel, Pizzateig): so viel Schwung nach oben
const BOUNCE_PAD_VELOCITY = -11.5;

// Bodengefahren (Feuer, Topf, Pfanne, Kaktus) treffen erst so viele Pixel
// innerhalb ihrer Zeichnung. Größer = verzeihender beim Drüberspringen.
const HAZARD_HITBOX_INSET = 6;

// Deko ohne Spielfunktion (Laternen, Tauben, Schilder, Stände) wird blasser
// gezeichnet, damit man sofort sieht, was interaktiv ist. 1 = volle Farbe.
const BACKGROUND_DECOR_ALPHA = 0.45;         // wie schnell er fällt


/* --- Maße (Trefferflächen) ---------------------------------------- */
// Vorsicht: Die Figuren sind auf diese Größen gezeichnet. Größere Werte
// vergrößern vor allem die unsichtbare Trefferfläche, nicht die Zeichnung.

const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 44;
const PLAYER_DUCK_HEIGHT = 26;  // geduckt - muss unter die niedrigen Durchgänge passen
const COW_WIDTH = 76;
const COW_HEIGHT = 52;
const CAT_WIDTH = 56;
const CAT_HEIGHT = 32;


/* --- Welt --------------------------------------------------------- */

const GROUND_BASE_Y = 400;    // normale Bodenhöhe
const GROUND_MIN_Y = 215;     // höchster erlaubter Boden (kleinere Zahl = weiter oben)
const GROUND_MAX_Y = 470;     // tiefster erlaubter Boden
const WORLD_BOTTOM = 1200;    // wie weit Bodenblöcke nach unten reichen
const DEATH_Y = 700;          // wer tiefer fällt, ist ins Loch gefallen
const GOAL_DISTANCE = 11000;  // nur Startwert - das echte Ziel setzt das Finale-Kapitel


/* --- Fairness des Levels ------------------------------------------ */
// Lücken und Stufen werden aus der Sprungphysik berechnet. Diese Faktoren
// legen fest, wie viel Reserve bleibt. Kleinere Werte = leichteres Level.

const JUMP_SAFETY_FACTOR = 0.6;   // Lücken höchstens so breit: Anteil der maximalen Sprungweite
const GAP_HEADROOM = 0.92;        // beim Bauen nochmal etwas schmaler (0.92 = 8 % Luft)
const STEP_SAFETY_FACTOR = 0.60;  // Stufen höchstens so hoch: Anteil der maximalen Sprunghöhe


const MAX_JUMP_HEIGHT = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
const SAFE_STEP_MAX = MAX_JUMP_HEIGHT * STEP_SAFETY_FACTOR;

function jumpReach(rise) {
    const v = Math.abs(JUMP_VELOCITY);
    const disc = v * v - 2 * GRAVITY * Math.max(0, rise);
    if (disc <= 0) return 0; 
    const timeToFallBackToHeight = (v + Math.sqrt(disc)) / GRAVITY;
    return timeToFallBackToHeight * MAX_RUN_SPEED;
}

function safeGapFor(rise) {
    return Math.max(45, jumpReach(rise) * JUMP_SAFETY_FACTOR);
}

const SAFE_GAP_MAX = safeGapFor(0);



function clamp(value, min, max) { return value < min ? min : (value > max ? max : value); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function chance(p) { return Math.random() < p; }
function pick(list) { return list[randInt(0, list.length - 1)]; }

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}



const input = {
    left: false,
    right: false,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
    confirmPressed: false,
};

window.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': input.left = true; break;
        case 'ArrowRight': case 'KeyD': input.right = true; break;
        case 'ArrowDown': case 'KeyS': input.down = true; break;
        case 'Space': case 'ArrowUp': case 'KeyW':

            if (!input.jumpHeld) {
                input.jumpPressed = true;
                input.confirmPressed = true;
            }
            input.jumpHeld = true;
            e.preventDefault();
            break;
        case 'Enter': input.confirmPressed = true; break;
        case 'KeyP': case 'Escape': togglePause(); break;
        case 'KeyR': restartGame(); break;
        case 'KeyF': toggleFullscreen(); break;
        case 'Digit0': case 'Numpad0': toggleAdmin(); break;
        case 'KeyV': if (admin.active) toggleFlying(); break;
        default: {
            const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
            if (m && admin.active) jumpToChapter(Number(m[1]) - 1);
        }
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': input.left = false; break;
        case 'ArrowRight': case 'KeyD': input.right = false; break;
        case 'ArrowDown': case 'KeyS': input.down = false; break;
        case 'Space': case 'ArrowUp': case 'KeyW': input.jumpHeld = false; break;
    }
});

window.addEventListener('blur', () => {
    input.left = input.right = input.down = false;
    input.jumpHeld = false;
    joystick = null;
    rightGesture = null;
    duckHeld = false;
});

// --- Touch-Steuerung für kleine Bildschirme -------------------------
// Linke Bildschirmhälfte: schwebender Joystick - Finger draufhalten und
// nach links/rechts ziehen, kein Wechseln zwischen einzelnen Knöpfen.
// Rechte Bildschirmhälfte: Wischgesten - hoch = springen, runter = dauerhaft
// ducken, hoch (während man duckt) = aufstehen und gleich mitspringen.

let touchActive = false;
const activeTouches = new Map(); // nur fürs Zeichnen: pointerId -> 'move' | 'gesture'

const JOY_RADIUS = 52;      // wie weit der Steuerknüppel maximal auswandert
const JOY_DEADZONE = 14;    // so weit muss man ihn erst auslenken
const SWIPE_THRESHOLD = 34; // ab dieser Höhe gilt eine Wischbewegung als erkannt

let joystick = null;   // { pointerId, anchorX, anchorY, curX, curY }
let rightGesture = null; // { pointerId, startY, triggered, holdingJump }
let duckHeld = false;  // bleibt an, bis die nächste Hoch-Wischgeste kommt

function touchPointToView(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    return {
        x: (e.clientX - rect.left) * dpr / viewScale,
        y: (e.clientY - rect.top) * dpr / viewScale,
    };
}

function updateJoystickInput() {
    if (!joystick) { input.left = false; input.right = false; return; }
    const dx = clamp(joystick.curX - joystick.anchorX, -JOY_RADIUS, JOY_RADIUS);
    input.left = dx < -JOY_DEADZONE;
    input.right = dx > JOY_DEADZONE;
}

function triggerTouchJump() {
    if (!input.jumpHeld) input.jumpPressed = true;
    input.jumpHeld = true;
}

canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && state.mode === 'playing') return;
    touchActive = touchActive || e.pointerType !== 'mouse';
    input.confirmPressed = true; // Tippen bestätigt auch Menüs/Tod-Bildschirm

    const point = touchPointToView(e);
    if (point.x < viewWidth / 2) {
        if (!joystick) {
            joystick = { pointerId: e.pointerId, anchorX: point.x, anchorY: point.y, curX: point.x, curY: point.y };
            activeTouches.set(e.pointerId, 'move');
            updateJoystickInput();
        }
    } else if (!rightGesture) {
        rightGesture = { pointerId: e.pointerId, startY: point.y, triggered: null, holdingJump: false };
        activeTouches.set(e.pointerId, 'gesture');
    }
    try { canvas.setPointerCapture?.(e.pointerId); } catch (err) { /* ignoriert */ }
    e.preventDefault();
});

canvas.addEventListener('pointermove', (e) => {
    const point = touchPointToView(e);
    if (joystick && e.pointerId === joystick.pointerId) {
        joystick.curX = point.x;
        joystick.curY = point.y;
        updateJoystickInput();
    } else if (rightGesture && e.pointerId === rightGesture.pointerId && !rightGesture.triggered) {
        const dy = point.y - rightGesture.startY;
        if (dy <= -SWIPE_THRESHOLD) {
            rightGesture.triggered = 'up';
            if (duckHeld) duckHeld = false; // aufstehen ...
            triggerTouchJump();             // ... und gleich mitspringen
            rightGesture.holdingJump = true;
            input.down = duckHeld;
        } else if (dy >= SWIPE_THRESHOLD) {
            rightGesture.triggered = 'down';
            duckHeld = true;
            input.down = duckHeld;
        }
    }
    e.preventDefault();
}, { passive: false });

function endPointer(e) {
    if (joystick && e.pointerId === joystick.pointerId) {
        joystick = null;
        activeTouches.delete(e.pointerId);
        updateJoystickInput();
    }
    if (rightGesture && e.pointerId === rightGesture.pointerId) {
        if (rightGesture.holdingJump) input.jumpHeld = false;
        rightGesture = null;
        activeTouches.delete(e.pointerId);
    }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', endPointer);


/* ---------- 6. Weltdaten & Spielzustand ---------- */

const level = {
    terrain: [],      // feste Bodenblöcke  {x,y,w,h}
    platforms: [],    // Plattformen (statisch oder beweglich)
    obstacles: [],    // Hindernisse: 'thorn' | 'crate' | 'wall' | 'branch'
    cows: [],
    cats: [],         // Mowgli (kann mehrfach vorkommen)
    critters: [],     // laufende Gegner
    hearts: [],
    checkpoints: [],
    decor: [],        // Büsche/Blumen/Steine auf dem Boden
    pits: [],         // Lücken zwischen Bodenblöcken (nur zum Zeichnen der Tiefe)
    clouds: [],
    biomes: [],       // {index, startX, endX} - feste Reihenfolge der Kapitel
    landmarks: [],    // große Hintergrundbauten je Biom (Türme, Brücke, Dünen ...)
    hazards: [],
    zones: [],        // Wind- und Dunkelzonen      // Gefahren im Takt und fallende Gegenstände
    goalX: GOAL_DISTANCE,
    spawn: { x: 90, y: GROUND_BASE_Y - PLAYER_HEIGHT },
};

const state = {
    mode: 'playing',  // playing | paused | dead | finished
    time: 0,
    hearts: 0,
    deaths: 0,
    frames: 0,
    respawnTimer: 0,
    deathReason: '',
    finishFrames: 0,
    shake: 0,
    currentBiome: 0,      // welches Kapitel gerade gespielt wird
};

const player = {
    x: 0, y: 0, w: PLAYER_WIDTH, h: PLAYER_HEIGHT,
    vx: 0, vy: 0,
    onGround: false,
    groundRef: null,
    mode: 'air',      // 'ground' | 'air' | 'riding'  (klar getrennte Zustände)
    mount: null,      // Mowgli, auf dem gerade geritten wird
    ducking: false,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    runPhase: 0,
    squash: 1,
    blink: 0,
};

const camera = { x: 0, y: 0 };
const particles = [];


/* ---------- 6b. Biome: die Kapitel unserer Geschichte ---------- */
// Die Welt ist KEINE Zufallsfolge mehr, sondern eine feste Reihe von Biomen.
// Jedes Biom hat eine eigene Palette, eigene Bodenart, eigene Plattform- und
// Hindernisformen und einen fest platzierten Höhepunkt mit Nachricht.
// Neue Erinnerungen lassen sich später einfach als weiterer Eintrag ergänzen.

const TRANSITION_BLEND = 320; // über diese Strecke werden Farben überblendet

const BIOMES = [
    {
        id: 'prag',
        backdrop: [
            { kind: 'pragTower', depth: 0.30, spacing: 880, w: 90, h: 330 },
            { kind: 'pragHouses', depth: 0.45, spacing: 660, w: 760, h: 250 },
            { kind: 'pragHouses', depth: 0.62, spacing: 560, w: 620, h: 180 },
        ],
        text: PERSONAL.chapters.prag,
        build: buildBiomePrag,
        palette: {
            sky: ['#3b3f72', '#8a6a8e', '#f0a878'],   // Abendlicht über der Altstadt
            sun: { color: '#ffdca8', glow: 'rgba(255,214,150,0.85)', x: 0.76, y: 0.2, r: 30 },
            cloud: 'rgba(255,214,198,0.55)',
            far: '#4c4a72',
            mid: '#5f5580',
            earth: ['#7b7784', '#5f5b6c', '#403d4c'],
            surfaceTop: '#9a96a6',
            surfaceEdge: '#7d7989',
            ground: 'cobble',
            pit: ['#4a4660', '#322f44', '#1d1b28'],
            platform: 'roof',
            platformBody: '#9c4f3c',
            platformDark: '#6f3529',
            hazard: 'fire',
            crate: 'marketCrate',
            duck: 'awning',
            bouncer: 'haybale',
            critter: { body: '#6d7fa8', light: '#93a4c8' },
            decor: ['lantern', 'sign', 'window', 'pigeon'],
            accent: '#f0c07a',
        },
    },
    {
        id: 'italien',
        backdrop: [
            { kind: 'townNight', depth: 0.35, spacing: 700, w: 760, h: 240 },
            { kind: 'townNight', depth: 0.55, spacing: 560, w: 640, h: 180 },
        ],
        entry: { surface: 'pavement' },
        exit: { surface: 'pavement' },
        text: PERSONAL.chapters.italien,
        build: buildBiomeItalien,
        palette: {
            sky: ['#3a2029', '#6d3630', '#c9743f'],   // warmes Kerzenlicht
            sun: { color: '#ffd9a0', glow: 'rgba(255,190,120,0.7)', x: 0.7, y: 0.22, r: 22 },
            cloud: 'rgba(255,200,160,0.25)',
            far: '#54282c',
            mid: '#6b3a33',
            earth: ['#8a5a3a', '#6b442b', '#4a2e1d'],
            surfaceTop: '#a9713f',
            surfaceEdge: '#7d4f2c',
            ground: 'planks',
            pit: ['#5a3324', '#3d2118', '#24140f'],
            platform: 'table',
            platformBody: '#c8b49a',
            platformDark: '#8c6a4a',
            hazard: 'pan',
            crate: 'chair',
            duck: 'shelf',
            bouncer: 'cushion',
            critter: { body: '#c4453c', light: '#e2685c' },  // rollende Tomate
            decor: ['candle', 'wineBottle', 'plant', 'plant'],
            accent: '#5fa055',
        },
    },
    {
        id: 'afrika',
        backdrop: [
            { kind: 'townNight', depth: 0.35, spacing: 700, w: 760, h: 240 },
            { kind: 'townNight', depth: 0.55, spacing: 560, w: 640, h: 180 },
        ],
        entry: { surface: 'pavement' },
        exit: { surface: 'pavement' },
        text: PERSONAL.chapters.afrika,
        build: buildBiomeAfrika,
        palette: {
            sky: ['#3b2318', '#7a3c1e', '#d98b3c'],
            sun: { color: '#ffce8a', glow: 'rgba(255,180,100,0.7)', x: 0.72, y: 0.2, r: 24 },
            cloud: 'rgba(255,200,150,0.22)',
            far: '#5c2f1c',
            mid: '#74401f',
            earth: ['#9a6034', '#7a4826', '#523018'],
            surfaceTop: '#b8783c',
            surfaceEdge: '#8a5628',
            ground: 'clay',
            pit: ['#63381f', '#432414', '#26150c'],
            platform: 'tray',
            platformBody: '#cfa14a',
            platformDark: '#96712f',
            hazard: 'pot',
            crate: 'stool',
            duck: 'archway',
            bouncer: 'cushion',
            critter: { body: '#3f7d5a', light: '#5fa87c' },
            decor: ['bowl', 'spiceJar', 'jar', 'plant'],
            accent: '#e0a94a',
        },
    },
    {
        id: 'marokko',
        exit: { sand: false, surface: 'zellige' },
        backdrop: [
            { kind: 'atlas', depth: 0.20, spacing: 1150, w: 1400, h: 300 },
            { kind: 'dunes', depth: 0.40, spacing: 880, w: 1200, h: 150 },
            { kind: 'kasbah', depth: 0.58, spacing: 680, w: 820, h: 250 },
        ],
        text: PERSONAL.chapters.marokko,
        build: buildBiomeMarokko,
        palette: {
            sky: ['#4aa6d8', '#9fd0e0', '#f6d9a0'],   // heller Wüstenhimmel
            sun: { color: '#fff3c8', glow: 'rgba(255,240,190,0.9)', x: 0.8, y: 0.15, r: 38 },
            cloud: 'rgba(255,255,255,0.6)',
            far: '#c9a578',
            mid: '#d9b98a',
            earth: ['#e0bc84', '#c79f68', '#9c7847'],
            surfaceTop: '#f0d5a0',
            surfaceEdge: '#cfae78',
            ground: 'sand',
            pit: ['#c79f68', '#9c7847', '#6a5030'],
            platform: 'stall',
            platformBody: '#d9694f',
            platformDark: '#a34a37',
            hazard: 'cactus',
            crate: 'basket',
            duck: 'awning',
            bouncer: 'cow',
            critter: { body: '#b8863c', light: '#d9a95c' },
            decor: ['palm', 'jar', 'lantern', 'cactusDeco'],
            accent: '#3f8f9e',
        },
    },
    {
        id: 'harz',
        backdrop: [
            { kind: 'firForest', depth: 0.26, spacing: 900, w: 1400, h: 260 },
            { kind: 'harzRocks', depth: 0.44, spacing: 640, w: 620, h: 230 },
            { kind: 'firForest', depth: 0.62, spacing: 760, w: 1150, h: 195 },
        ],
        text: PERSONAL.chapters.harz,
        build: buildBiomeHarz,
        palette: {
            sky: ['#8fb8c8', '#c4d8d4', '#e8ecd8'],   // weiche Morgenstimmung
            sun: { color: '#fbf4dc', glow: 'rgba(250,246,225,0.75)', x: 0.68, y: 0.18, r: 30 },
            cloud: 'rgba(255,255,255,0.75)',
            far: '#6d8a86',
            mid: '#547063',
            earth: ['#6b5a3f', '#54462f', '#382e20'],
            surfaceTop: '#4f7a3c',
            surfaceEdge: '#3c5f2c',
            ground: 'moss',
            pit: ['#5c7452', '#3e5238', '#232f20'],
            platform: 'log',
            platformBody: '#8a6540',
            platformDark: '#5f452b',
            hazard: 'thorn',
            crate: 'rock',
            duck: 'branch',
            bouncer: 'cow',
            critter: { body: '#6b4fa8', light: '#8f70cc' },
            decor: ['fir', 'fern', 'mushroom', 'stone'],
            accent: '#8fbf6a',
        },
    },
    {
        id: 'finale',
        backdrop: [
            { kind: 'sunsetHills', depth: 0.28, spacing: 1000, w: 1600, h: 220 },
            { kind: 'sunsetHills', depth: 0.46, spacing: 820, w: 1200, h: 150 },
        ],
        text: PERSONAL.chapters.finale,
        build: buildBiomeFinale,
        palette: {
            sky: ['#f09a6a', '#f7c48c', '#ffe9c0'],   // Sonnenuntergang
            sun: { color: '#fff0c0', glow: 'rgba(255,200,140,0.95)', x: 0.72, y: 0.42, r: 52 },
            cloud: 'rgba(255,210,180,0.7)',
            far: '#c98a6a',
            mid: '#b8785e',
            earth: ['#a07a4c', '#7e5c37', '#5a4126'],
            surfaceTop: '#7bb455',
            surfaceEdge: '#5d9040',
            ground: 'meadow',
            pit: ['#7bb455', '#5d9040', '#3c5f2c'],
            platform: 'plank',
            platformBody: '#c69a63',
            platformDark: '#96703f',
            hazard: 'thorn',
            crate: 'crate',
            duck: 'branch',
            bouncer: 'cow',
            critter: { body: '#c98fb0', light: '#e0aecb' },
            decor: ['flower', 'grass', 'bush', 'lantern'],
            accent: '#ff8fa8',
        },
    },
];

// --- Farbwerkzeuge für weiche Biom-Übergänge ---
function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mixColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const r = Math.round(lerp(ca[0], cb[0], t));
    const g = Math.round(lerp(ca[1], cb[1], t));
    const bl = Math.round(lerp(ca[2], cb[2], t));
    return `rgb(${r},${g},${bl})`;
}

// Welches Biom liegt an dieser Weltposition?
function biomeIndexAt(x) {
    const list = level.biomes;
    for (let i = 0; i < list.length; i++) {
        if (x < list[i].endX) return i;
    }
    return Math.max(0, list.length - 1);
}

function biomeAt(x) {
    return BIOMES[biomeIndexAt(x)];
}

// Hintergrundfarben am Übergang weich überblenden, damit der Wechsel
// atmosphärisch wirkt statt hart umzuspringen.
function backgroundPaletteAt(x) {
    const index = biomeIndexAt(x);
    const here = BIOMES[index];
    const band = level.biomes[index];
    if (!band) return here.palette;

    const next = BIOMES[index + 1];
    const distanceToEnd = band.endX - x;
    if (!next || distanceToEnd > TRANSITION_BLEND) return here.palette;

    const t = clamp(1 - distanceToEnd / TRANSITION_BLEND, 0, 1) * 0.5;
    const a = here.palette;
    const b = next.palette;
    return {
        sky: [mixColor(a.sky[0], b.sky[0], t), mixColor(a.sky[1], b.sky[1], t), mixColor(a.sky[2], b.sky[2], t)],
        sun: t > 0.25 ? b.sun : a.sun,
        cloud: t > 0.25 ? b.cloud : a.cloud,
        far: mixColor(a.far, b.far, t),
        mid: mixColor(a.mid, b.mid, t),
        accent: t > 0.25 ? b.accent : a.accent,
    };
}


/* ---------- 7. Level-Bau ---------- */
// Die Welt wird einmal komplett gebaut (kein Streaming). Dadurch kann es
// Checkpoints, ein echtes Ziel und ein durchdachtes Level geben.
// Jedes Segment beginnt und endet auf sicherem Boden.

let buildX = 0;         // Baucursor
let buildY = 0;         // aktuelle Bodenhöhe
let buildBiome = 0;     // welches Biom gerade gebaut wird (wird an alle Objekte gehängt)
let buildSand = false;  // Sandboden? (verändert das Laufgefühl)

function addGround(x, w, y, options = {}) {
    level.terrain.push({
        x, y, w, h: WORLD_BOTTOM - y,
        biome: buildBiome,
        sand: options.sand !== undefined ? options.sand : buildSand,
        surface: options.surface || null,   // eigene Bodenoptik (z. B. Gehweg, Dach)
        body: options.body || null,         // 'house': darunter eine Hauswand
        pitLook: options.pitLook || null,   // 'water': Lücke dahinter ist Wasser
        slippery: !!options.slippery,       // rutschig (Olivenöl)
    });
}

function addPlatform(x, y, w, options = {}) {
    level.platforms.push({
        x, y, w, h: options.h || 14,
        baseX: x, baseY: y,
        prevX: x, prevY: y,
        dx: 0, dy: 0,
        axis: options.axis || null,          // null = statisch, 'x' oder 'y'
        amplitude: options.amplitude || 0,
        speed: options.speed || 0.02,
        phase: options.phase !== undefined ? options.phase : Math.random() * Math.PI * 2,
        biome: buildBiome,
        look: options.look || null,          // überschreibt den Biom-Stil
        crumble: !!options.crumble,          // bröckelt, wenn man draufsteht
        crumbleState: 'idle', crumbleTimer: 0, fallVy: 0,
        timed: options.timed || null,        // {period, on, offset}: erscheint im Takt
        bounce: options.bounce === true ? BOUNCE_PAD_VELOCITY : (options.bounce || 0), // Sprungbrett
        squash: 1,
    });
}

function addThorn(x, groundY, width = 30, look = null) {
    level.obstacles.push({ kind: 'thorn', x, y: groundY - 24, w: width, h: 24, look, biome: buildBiome });
}

function addCrate(x, groundY, height = 34, look = null, width = 38) {
    level.obstacles.push({ kind: 'crate', x, y: groundY - height, w: width, h: height, look, biome: buildBiome });
}

function addWall(x, groundY, height) {
    level.obstacles.push({ kind: 'wall', x, y: groundY - height, w: 46, h: height, biome: buildBiome });
}

function addBranch(x, groundY, width, look = null) {
    // Unterführung: Durchgang ist zu niedrig zum Stehen, aber hoch genug zum Ducken
    const clearance = PLAYER_DUCK_HEIGHT + 8;
    level.obstacles.push({ kind: 'branch', x, y: groundY - clearance - 26, w: width, h: 26, look, biome: buildBiome });
}

function addCow(x, groundY, look = null) {
    level.cows.push({
        x, y: groundY - COW_HEIGHT, w: COW_WIDTH, h: COW_HEIGHT,
        squash: 1, chew: Math.random() * 10, biome: buildBiome, look,
    });
}

// Bauwerk, das fest zur Spielwelt gehört (Brücke, Oase, Bach, Tisch ...).
// Es wird ohne Parallax gezeichnet und sitzt exakt an seiner Weltposition.
function addLandmark(kind, x, options = {}) {
    level.landmarks.push(Object.assign({
        kind, x, biome: buildBiome, layer: false,
        y: options.y !== undefined ? options.y : buildY,
        w: options.w || 200,
        h: options.h || 200,
        depth: 1,
        phase: Math.random() * 6,
    }, options, { depth: 1, layer: false }));
}

// Hintergrund-Ebene eines Bioms füllen.
// Wichtig: Hintergründe werden in EBENEN-Koordinaten abgelegt (worldX * depth).
// Legt man sie an Weltkoordinaten ab und zeichnet sie mit Parallax, driften sie
// bei großen Welten um tausende Pixel weg und verschwinden aus dem Bild.
function addBackdrop(biomeIndex, startX, endX, spec) {
    const depth = spec.depth;
    // Das sichtbare Ebenen-Fenster reicht am Biom-Ende noch eine Bildbreite
    // weiter - sonst reißt der Hintergrund kurz vor dem Übergang ab.
    const from = startX * depth - spec.w;
    const to = endX * depth + 1400 + spec.w;
    let i = 0;
    for (let x = from; x < to; x += spec.spacing) {
        level.landmarks.push({
            kind: spec.kind,
            x, layer: true, depth,
            biome: biomeIndex,
            y: GROUND_BASE_Y,          // Hintergründe stehen auf der Horizontlinie
            w: spec.w, h: spec.h,
            phase: (i * 1.7) % 6,
        });
        i++;
    }
}

function addCat(x, groundY) {
    level.cats.push({
        x, y: groundY - CAT_HEIGHT, w: CAT_WIDTH, h: CAT_HEIGHT,
        homeX: x, homeY: groundY - CAT_HEIGHT,
        vx: 0, vy: 0,
        onGround: true, groundRef: null,
        ridden: false, remountCooldown: 0,
        blink: 0, tailPhase: Math.random() * 6, facing: 1,
    });
}

function addCritter(x, groundY, range, look = null) {
    level.critters.push({
        x, y: groundY - 26, w: 34, h: 26,
        homeX: x, homeY: groundY - 26,
        minX: x - range, maxX: x + range,
        vx: CRITTER_SPEED, alive: true, squashTimer: 0, phase: Math.random() * 6,
        look, biome: buildBiome,
    });
}

function addHeart(x, y) {
    level.hearts.push({ x: x - 11, y: y - 11, w: 22, h: 22, taken: false, phase: Math.random() * 6 });
}

function addHeartArc(centerX, topY, count) {
    for (let i = 0; i < count; i++) {
        const t = (i - (count - 1) / 2) / Math.max(1, count);
        addHeart(centerX + t * 90, topY + Math.abs(t) * 60);
    }
}

// Findet den Boden an einer Stelle - null bedeutet: dort ist ein Loch
function groundSurfaceAt(x) {
    let best = null;
    for (const block of level.terrain) {
        if (x >= block.x + 20 && x <= block.x + block.w - 20) {
            if (best === null || block.y < best) best = block.y;
        }
    }
    return best;
}

// --- Bausteine für die Biome -----------------------------------------
// Die Biome bauen ihre Welt aus diesen Bausteinen. Jeder Baustein achtet
// selbst darauf, dass die Sprünge fair bleiben (siehe safeGapFor).

function beatGround(width, options) {
    addGround(buildX, width, buildY, options || {});
    buildX += width;
}

// Lücke. `rise` = wie viel höher der Boden dahinter liegt (0 = gleich hoch).
function beatGap(width, rise) {
    buildX += Math.min(width, safeGapFor(Math.max(0, rise || 0)) * GAP_HEADROOM);
}

// Höhenwechsel innerhalb der erlaubten Grenzen
function beatStep(delta) {
    const target = clamp(buildY + delta, GROUND_MIN_Y, GROUND_MAX_Y);
    const changed = Math.abs(target - buildY) >= MIN_STEP;
    if (changed) buildY = target;
    return changed;
}

const MIN_STEP = 22;

// Eine Reihe Plattformen über einer Lücke oder über festem Boden.
// opts: {count, w, rise, hop, axis, amplitude, speed, phaseStep, hearts, look}
function beatPlatformRun(opts) {
    const count = opts.count || 1;
    const w = opts.w || 100;
    const rise = opts.rise || 20;
    const amplitude = opts.amplitude || 0;
    const vertical = opts.axis === 'y';
    // Schlimmster Fall einplanen: die Plattform steht gerade ganz oben
    const worstRise = rise + (vertical ? amplitude : 0);
    const hop = Math.min(opts.hop || 85, safeGapFor(worstRise) * GAP_HEADROOM);

    for (let i = 0; i < count; i++) {
        buildX += hop;
        addPlatform(buildX, buildY - rise, w, {
            axis: opts.axis || null,
            amplitude,
            speed: opts.speed || 0.018,
            // Fester Phasenversatz ergibt eine rhythmische, lesbare Bewegung
            phase: opts.phaseStep !== undefined ? i * opts.phaseStep : undefined,
            look: opts.look,
        });
        if (opts.hearts) addHeart(buildX + w / 2, buildY - rise - 48);
        buildX += w;
    }
    buildX += hop;
}

// Treppe aus festen Bodenblöcken
function beatStairs(steps, riseEach, stepWidth) {
    for (let i = 0; i < steps; i++) {
        if (!beatStep(-riseEach)) break;
        beatGround(stepWidth);
    }
}

// Checkpoint-Flagge am Anfang eines Kapitels - pro Kapitel genau eine.
// Kapitel ohne `flag`-Namen (das Finale) bekommen keine.
function addChapterFlag(x, groundY, chapterIndex) {
    const label = BIOMES[chapterIndex].text.flag;
    if (!label) return;
    level.checkpoints.push({ x, y: groundY, label, active: false, phase: 0 });
}

// Aussichtspunkt / Erinnerungsort: erhöhtes Podest mit Nachricht.
// Das ist der feste Höhepunkt jedes Bioms.
function beatViewpoint(chapterText, options) {
    const opts = options || {};
    const width = opts.width || 420;
    const x0 = buildX;
    beatGround(width);
    const centerX = x0 + width / 2;

    addHeartArc(centerX, buildY - 95, 5);
    if (opts.landmark) {
        addLandmark(opts.landmark, centerX - 160, {
            y: buildY, w: 320, h: opts.landmarkHeight || 220, depth: 0.75,
        });
    }
    return centerX;
}


/* --- Hilfen für die handgebauten Kapitel ------------------------------ */

// Gezielt schwerer Sprung: Anteil der echten Sprungweite (HARD_JUMP_FACTOR).
function hardGap(rise) {
    return jumpReach(Math.max(0, rise || 0)) * HARD_JUMP_FACTOR;
}

// Lücke ohne automatische Kürzung - nur mit hardGap() oder bewusst kleinen Werten nutzen
function gapTo(width) {
    buildX += width;
}

// Zurück auf die normale Bodenhöhe (als Sprung nach unten)
function stepToBase() {
    if (Math.abs(buildY - GROUND_BASE_Y) >= 1) buildY = GROUND_BASE_Y;
}

// Kapitel auf die gewünschte Länge auffüllen
function padChapter(startX, length, options) {
    if (buildX < startX + length) beatGround(startX + length - buildX, options);
}


/* --- Biom 1: Prag -----------------------------------------------------
   Altstadtgasse mit Torbogen und Kneipe, ein altes Haus mit Marionetten
   und Paternoster, die Dächer, die Straßenbahn, die Astronomische Uhr,
   die Karlsbrücke und der Aufgang zur Burg.                             */

function buildBiomePrag() {
    const text = PERSONAL.chapters.prag;
    const start = buildX;
    const B = buildY;

    // 1) Altstadtgasse: geduckt durch einen niedrigen Torbogen, dann rollen
    //    Bierfässer aus der Kneipe, und aus einem Fenster fällt ein Blumentopf
    let x0 = buildX;
    beatGround(520);
    addHeartArc(x0 + 60, B - 80, 3);
    addBranch(x0 + 130, B, 90, 'archway');
    // Das ganze Haus über dem Durchgang ist fest - man kann nicht daraufspringen,
    // sondern nur geduckt hindurch
    const arch = level.obstacles[level.obstacles.length - 1];
    arch.y -= 190;
    arch.h += 190;
    arch.x -= 16;
    arch.w += 32;
    addLandmark('pub', x0 + 390, { y: B, w: 132, h: 110 });        // Kneipe mit Theke und Bier
    addRoller(x0 + 260, x0 + 480, B, { w: 28, speed: 2.2, period: 150, look: 'barrel' });
    addDropper(x0 + 320, B, { topY: B - 196, period: 170, offset: 60, look: 'flowerPot' });

    // 2) Das alte Haus: Marionetten, ein schwingender Kronleuchter, die Kommode
    x0 = buildX;
    const houseW = 640;
    const ceilY = B - 174;                        // Unterkante der Decke: B - 150
    addLandmark('pragHouse', x0, { y: B, w: houseW, h: 380 });
    beatGround(houseW, { pitLook: 'shaft' });
    addBlock(x0 + 30, ceilY, houseW - 30, 24, 'beam');
    addDropper(x0 + 130, B, { mode: 'yoyo', topY: ceilY + 24, period: 130, look: 'marionette', w: 24, h: 38 });
    addPendulum(x0 + 280, B - 150, 110, { r: 12, amp: 0.85, period: 150, look: 'chandelier' });
    addCrate(x0 + 400, B, 34, 'dresser', 44);
    addDropper(x0 + 480, B, { mode: 'yoyo', topY: ceilY + 24, period: 110, offset: 40, look: 'marionette', w: 24, h: 38 });
    addDropper(x0 + 570, B, { mode: 'yoyo', topY: ceilY + 24, period: 110, offset: 95, look: 'marionette', w: 24, h: 38 });

    // 3) Der Aufzug ohne Türen: die Kabinen halten nie an. Hineinspringen,
    //    hochfahren und oben aufs Dach springen - unten ist der offene Schacht.
    const shaftX = buildX;
    addLandmark('paternosterShaft', shaftX - 6, { y: B, w: 150, h: 230 });
    addPaternoster(shaftX + 14, shaftX + 76, B - 196, B + 130, { cabins: 4, speed: 1, w: 54 });
    buildX = shaftX + 140;
    buildY = B - 150;

    // 4) Über die Dächer: Schornsteine mit Rauchstößen, lose Ziegel, Tauben
    const roof = { surface: 'roof', body: 'house' };
    x0 = buildX;
    beatGround(230, roof);
    addHeartArc(x0 + 60, buildY - 60, 3);
    addBlock(x0 + 150, buildY - 34, 26, 34, 'chimney');
    addPulse(x0 + 145, buildY - 124, 36, 90, { period: 160, active: 60, warn: 40, look: 'chimneySmoke' });
    gapTo(hardGap(0) * 0.9);
    beatGround(110, roof);

    const tileY = buildY;
    gapTo(50);
    addPlatform(buildX, tileY + 4, 64, { crumble: true, look: 'tile' });
    buildX += 64;
    gapTo(56);
    addPlatform(buildX, tileY - 18, 64, { crumble: true, look: 'tile' });
    buildX += 64;
    gapTo(58);

    x0 = buildX;
    beatGround(250, roof);
    addFlyer(x0 + 80, buildY - 40, { rangeX: 50, rangeY: 5, speed: 0.03, look: 'pigeon' });
    addBlock(x0 + 190, buildY - 40, 28, 40, 'chimney');
    addPulse(x0 + 186, buildY - 130, 36, 90, { period: 160, active: 60, warn: 40, offset: 80, look: 'chimneySmoke' });

    // 5) Die Straßenbahn kommt aus dem Tunnel, hält an beiden Haltestellen und
    //    fährt links wieder in den Tunnel. Bei "Bim bim" aufs Wartehäuschen!
    stepToBase();
    const street = buildX;
    beatGround(600, { surface: 'tramRails' });
    addLandmark('tramTunnel', street + 10, { y: B, w: 60, h: 170 });
    addLandmark('tramTunnel', street + 530, { y: B, w: 60, h: 170 });
    for (const sx of [140, 400]) {
        addLandmark('tramStop', street + sx, { y: B, w: 110, h: 130 });
        addCrate(street + sx + 10, B, 34, 'bench', 60);
        addPlatform(street + sx, B - 80, 96, { look: 'shelterRoof' });
    }
    addRoller(street + 40, street + 560, B, {
        w: 210, h: 74, speed: 5, period: 560, warn: 90, offset: 200, look: 'tram',
        clip: [street + 40, street + 560],
        stops: [{ x: street + 380, wait: 80 }, { x: street + 120, wait: 80 }],
    });
    addHeartArc(street + 448, B - 120, 3);

    // 6) Altstädter Ring: die Apostelfiguren der Astronomischen Uhr erscheinen
    //    im Takt - nur über sie kommt man auf den hohen Sockel des Uhrturms.
    x0 = buildX;
    beatGround(600);
    addThorn(x0 + 110, B, 30, 'fire');
    addLandmark('orloj', x0 + 250, { y: B, w: 260, h: 330 });
    addPlatform(x0 + 290, B - 46, 58, { look: 'clockFigure', timed: { period: 230, on: 160, offset: 0 } });
    addPlatform(x0 + 380, B - 92, 58, { look: 'clockFigure', timed: { period: 230, on: 160, offset: -50 } });
    addBlock(x0 + 490, B - 110, 90, 110, 'clockBase');
    addHeartArc(x0 + 535, B - 150, 3);

    // 7) Karlsbrücke: Statuensockel, eine tief fliegende Taube, Feuerschalen
    const bridgeStart = buildX;
    beatGround(480);
    addLandmark('pragBridge', bridgeStart - 40, { y: B, w: 560, h: 260 });
    addBlock(bridgeStart + 90, B - 46, 36, 46, 'pedestal');
    addThorn(bridgeStart + 200, B, 30, 'fire');
    addFlyer(bridgeStart + 300, B - 36, { rangeX: 40, rangeY: 4, speed: 0.04, look: 'pigeon' });
    addBlock(bridgeStart + 400, B - 46, 36, 46, 'pedestal');
    addHeartArc(bridgeStart + 250, B - 120, 5);

    // 8) Aufgang zur Prager Burg: der Heuballen ist das Sprungbrett über die Mauer
    x0 = buildX;
    beatGround(280);
    addCow(x0 + 280 - COW_WIDTH, B, 'haybale');
    beatStep(-(MAX_JUMP_HEIGHT + 60));
    const viewX = beatViewpoint(text, { landmark: 'pragSpires', landmarkHeight: 240, width: 360 });
    // Wir beide, ganz nah - "erster Schmusi?"
    addLandmark('kissCouple', viewX + 100, { y: buildY, w: 70, h: 150 });

    stepToBase();
    padChapter(start, 4534);
}


/* --- Biom 2: L'Oasi ---------------------------------------------------
   Draußen kommt ein Roller aus der Einfahrt, drinnen Kronleuchter, Olivenöl
   auf dem Boden, der Kellner, die Küche mit Pizzaofen, Schinken und
   Tomaten, und am Ende unser Tisch. Kapitel: unser erstes Date.          */

function buildBiomeItalien() {
    const start = buildX;
    const B = buildY;
    const street = { surface: 'pavement' };

    // 1) Die Straße vor dem Restaurant: aus der Hofeinfahrt fährt ein Roller
    let x0 = buildX;
    beatGround(520, street);
    addLandmark('oasiFacade', x0 + 40, { y: B, w: 300, h: 290 });
    addLandmark('garage', x0 + 400, { y: B, w: 86, h: 96 });
    addRoller(x0 - 160, x0 + 420, B, {
        w: 64, h: 40, speed: 3.5, period: 300, offset: 120, look: 'scooter',
        clip: [x0 - 400, x0 + 420],
    });
    addHeartArc(x0 + 120, B - 90, 3);

    // 2) Der Speisesaal - mit hoher Decke
    const inside = buildX;
    const ceilY = B - 304;                        // Unterkante der Decke: B - 280
    const hallW = 1100;
    const kitchenW = 860;
    addLandmark('oasiInterior', inside, { y: B, w: hallW + kitchenW + 480, h: 380 });
    beatGround(300);
    beatGround(140, { surface: 'oil', slippery: true });   // verschüttetes Olivenöl
    beatGround(hallW - 440);
    addPlatform(inside + 50, B - 54, 96, { look: 'table' });
    addPendulum(inside + 220, B - 280, 234, { r: 13, amp: 0.45, period: 200, look: 'chandelier' });
    addThorn(inside + 510, B, 30, 'pan');                   // hinter dem Öl: rechtzeitig springen
    addCrate(inside + 570, B, 36);                          // Stuhl: von hier aufs Tablett
    keepLastObstacle();
    addCritter(inside + 720, B, 45, 'meatball');
    addPlatform(inside + 660, B - 72, 60, { axis: 'x', amplitude: 90, speed: 0.02, look: 'waiter' });
    addPlatform(inside + 800, B - 54, 96, { look: 'table' });
    addPendulum(inside + 920, B - 280, 234, { r: 13, amp: 0.45, period: 200, offset: 100, look: 'chandelier' });
    addCrate(inside + 1010, B, 40);                         // Stuhl
    addHeart(inside + 98, B - 104);
    addHeart(inside + 372, B - 60);
    addHeart(inside + 690, B - 124);
    addHeart(inside + 848, B - 104);

    // 3) Die Küche: Pizzaofen-Flammen im Takt, ein Pizzateig als Sprungbrett
    //    zum Gewürzregal, Schinken zum Ducken, Tomaten rollen aus der Kiste, Dampf
    const kitchen = buildX;
    beatGround(kitchenW, { surface: 'kitchenTiles' });
    addLandmark('kitchen', kitchen, { y: B, w: kitchenW, h: 280 });
    addPulse(kitchen + 120, B - 60, 90, 44, { period: 150, active: 60, offset: 0, look: 'ovenFlame' });
    addPlatform(kitchen + 232, B - 18, 50, { bounce: true, look: 'doughPad' });
    addPlatform(kitchen + 200, B - 150, 130, { look: 'shelfPlank' });
    addHeartArc(kitchen + 265, B - 175, 3);
    addPulse(kitchen + 330, B - 60, 90, 44, { period: 150, active: 60, offset: 75, look: 'ovenFlame' });
    addBranch(kitchen + 470, B, 120, 'hams');
    addLandmark('tomatoCrate', kitchen + 730, { y: B, w: 60, h: 40 });
    addRoller(kitchen + 620, kitchen + 740, B, { w: 18, speed: 2.6, period: 80, look: 'tomato' });
    addPulse(kitchen + 790, B - 74, 40, 74, { period: 110, active: 40, offset: 20, look: 'steam' });

    // 4) Unser Tisch: ruhiger Abschluss - wir beide sitzen noch da
    const table = buildX;
    beatGround(480);
    addLandmark('dateCouple', table + 150, { y: B, w: 220, h: 170 });
    addHeartArc(table + 425, B - 95, 3);              // neben der Szene, damit wir beide sichtbar bleiben

    addBlock(inside + 20, ceilY, buildX - inside - 20, 24, 'oasiCeiling');

    padChapter(start, 3040);
}


/* --- Biom 3: Der Afrikaner --------------------------------------------
   Eingang mit Kreidetafel, Gaststube mit Mowgli, das berüchtigte Buffet,
   Dosenberge mit einem verspielten Hund und am Ende unser Tisch.         */

function buildBiomeAfrika() {
    const start = buildX;
    const B = buildY;
    const street = { surface: 'pavement' };

    // 1) Straße und Eingang
    let x0 = buildX;
    beatGround(480, street);
    addLandmark('menuBoard', x0 + 100, { y: B, w: 64, h: 86 });
    addLandmark('afroFacade', x0 + 180, { y: B, w: 300, h: 290 });
    addHeartArc(x0 + 130, B - 110, 3);

    // 2) Gaststube: Mowgli wartet am Eingang und hilft über die heißen Töpfe.
    //    Dann eine schwingende Korblampe und das Sitzkissen zum Wandregal.
    const inside = buildX;
    const ceilY = B - 304;                        // Unterkante der Decke: B - 280
    addLandmark('afroInterior', inside, { y: B, w: 760 + 920 + 700 + 480, h: 380 });
    beatGround(760);
    addCat(inside + 50, B);
    addThorn(inside + 170, B, 30, 'pot');
    addCrate(inside + 290, B, 34);                // Hocker
    addThorn(inside + 400, B, 30, 'pot');
    addPendulum(inside + 520, B - 280, 235, { r: 12, amp: 0.45, period: 190, look: 'lamp' });
    addCow(inside + 600, B, 'cushion');
    addPlatform(inside + 640, B - 144, 110, { look: 'shelfPlank' });
    addHeartArc(inside + 695, B - 170, 3);

    // 3) Das Buffet: Stinkwolken steigen im Takt auf.
    //    Oben schaukeln Servierplatten als Ausweichroute.
    const buffet = buildX;
    beatGround(920);
    addBlock(buffet + 60, B - 34, 780, 34, 'counter');
    for (let i = 0; i < 5; i++) {
        addPulse(buffet + 110 + i * 150, B - 34 - 72, 46, 72, {
            period: 170, active: 70, offset: i * 34, look: 'stink',
        });
    }
    for (let i = 0; i < 5; i++) {
        addPlatform(buffet + 80 + i * 150, B - 80, 90, {
            axis: 'y', amplitude: 16, speed: 0.02, phase: i * Math.PI / 2, look: 'tray',
        });
    }

    // 4) Die Hundefutter-Dosen: Dosenberg, Dosen fallen aus dem Vorratsregal,
    //    ein verspielter Hund rennt hin und her, und eine Trommel katapultiert
    //    zum Regal mit den Herzen
    const cans = buildX;
    beatGround(700);
    addBlock(cans + 100, B - 36, 60, 36, 'cans');
    addBlock(cans + 160, B - 72, 60, 72, 'cans');
    addBlock(cans + 220, B - 36, 60, 36, 'cans');
    addDropper(cans + 179, B - 72, { topY: ceilY + 24, period: 140, look: 'can' });
    addDog(cans + 430, B, 110, 2.3);
    addDropper(cans + 360, B, { topY: ceilY + 24, period: 120, offset: 50, look: 'can' });
    addPlatform(cans + 600, B - 40, 44, { bounce: true, look: 'djembe' });
    addPlatform(cans + 540, B - 170, 120, { look: 'shelfPlank' });
    addHeartArc(cans + 600, B - 195, 3);

    // 5) Unser Tisch
    const table = buildX;
    beatGround(480);
    addLandmark('afroCouple', table + 60, { y: B, w: 320, h: 190 });   // wir beide vor stinkendem Hundefutter
    addHeartArc(table + 425, B - 95, 3);              // neben der Szene, damit das Hundefutter sichtbar bleibt

    addBlock(inside + 20, ceilY, buildX - inside - 20, 24, 'afroCeiling');

    padChapter(start, 3483);
}


/* --- Biom 4: Marokko --------------------------------------------------
   Im ganzen Kapitel weht der Wüstenwind. Treibsand, die Kamelkarawane
   durchs Treibsandtal, der Arganbaum, der Souk, der Gewürzmarkt, die
   blaue Stadt Chefchaouen und ein Riad mit Brunnen.                     */

function buildBiomeMarokko() {
    const text = PERSONAL.chapters.marokko;
    const start = buildX;
    const B = buildY;

    // Wüstenwind im ganzen Kapitel: Böen im Takt, kurz vorher erste Schlieren
    addWind(start, start + 5177, { force: -1.0, period: 360, active: 140, warn: 70, look: 'sandstorm' });

    // 1) Wüstenpiste: Kaktus, Treibsand, Skorpion
    let x0 = buildX;
    beatGround(200);
    addThorn(x0 + 110, B, 32, 'cactus');
    beatGround(160, { sand: false, surface: 'quicksand' });
    beatGround(140);
    addCritter(x0 + 410, B, 36, 'scorpion');
    beatStep(-44);                                 // hinauf auf die Düne
    beatGround(120);

    // 2) Kamelkarawane durch das Treibsandtal: die Kamele laufen unten durch
    //    den Treibsand, man reitet auf ihrem Rücken hinüber
    const valley = buildX;
    const valleyW = 540;
    addGround(valley, valleyW, B + 6, { sand: false, surface: 'quicksand' });
    addStaticHazard(valley, B - 4, valleyW, 16, 'quicksandPool');
    addPlatform(valley + 100, B - 34, 74, { axis: 'x', amplitude: 60, speed: 0.012, phase: 0, look: 'camel' });
    addPlatform(valley + 330, B - 34, 74, { axis: 'x', amplitude: 60, speed: 0.012, phase: Math.PI, look: 'camel' });
    addHeart(valley + 137, B - 90);
    addHeart(valley + 367, B - 90);
    buildX = valley + valleyW;
    beatGround(120);
    stepToBase();

    // 3) Der Arganbaum: das Kakteenfeld darunter ist nur über die Äste zu schaffen
    const tree = buildX;
    beatGround(600);
    addThorn(tree + 170, B, 370, 'cactusField');
    addLandmark('arganTree', tree + 90, { y: B, w: 480, h: 230 });
    addPlatform(tree + 90, B - 50, 80, { look: 'argan' });
    addPlatform(tree + 200, B - 96, 80, { look: 'argan' });
    addPlatform(tree + 320, B - 112, 90, { look: 'argan' });
    addPlatform(tree + 450, B - 70, 80, { look: 'argan' });
    addHeartArc(tree + 365, B - 150, 3);

    // 4) Der Souk: schwingende Laterne, Tonkrüge fallen vom Regal, Teppiche zum
    //    Ducken, rollende Orangen vom Obststand und eine Markise als Sprungbrett
    const souk = buildX;
    beatGround(720, { sand: false, surface: 'souk' });
    addLandmark('souk', souk, { y: B, w: 720, h: 270 });
    addLandmark('monkey', souk + 150, { y: B - 270, w: 40, h: 40, facing: 1 });
    addLandmark('monkey', souk + 470, { y: B - 270, w: 40, h: 40, facing: -1, pose: 'scratch' });
    addPendulum(souk + 90, B - 190, 146, { r: 11, amp: 0.7, period: 150, look: 'lantern' });
    addDropper(souk + 190, B, { topY: B - 150, period: 130, look: 'pottery' });
    addBranch(souk + 260, B, 120);
    addLandmark('orangeStall', souk + 505, { y: B, w: 70, h: 100 });
    addRoller(souk + 410, souk + 520, B, { w: 16, speed: 2.4, period: 70, look: 'orange' });
    addPlatform(souk + 540, B - 30, 60, { bounce: true, look: 'awning' });
    addBlock(souk + 620, B - 120, 90, 120, 'carpetStack');
    addHeartArc(souk + 665, B - 200, 3);

    // 5) Der Gewürzmarkt: von Kiste zu Kiste - wer daneben landet, fällt
    //    mitten in die Gewürzkörbe
    const spice = buildX;
    beatGround(640, { sand: false, surface: 'souk' });
    addLandmark('spiceMarket', spice, { y: B, w: 640, h: 240 });
    addLandmark('monkey', spice + 570, { y: B - 240, w: 40, h: 40, facing: -1, pose: 'eat' });
    let sx = spice + 60;
    for (let i = 0; i < 6; i++) {
        addCrate(sx, B, 30, 'spiceCrate', 40);
        keepLastObstacle();
        sx += 40;
        if (i < 5) {
            const gap = i % 2 ? 66 : 58;
            addThorn(sx, B, gap, 'spice');
            keepLastObstacle();
            sx += gap;
        }
    }
    addFlyer(spice + 330, B - 100, { rangeX: 120, rangeY: 14, speed: 0.02, look: 'pigeon' });
    addHeartArc(spice + 330, B - 90, 5);

    // 6) Chefchaouen, die blaue Stadt voller Katzen: Mowgli hilft über die hohe Mauer
    const blue = { sand: false, surface: 'blueTiles' };
    x0 = buildX;
    beatGround(180, blue);
    addLandmark('chefchaouen', x0, { y: B, w: 900, h: 300 });
    addCat(x0 + 80, B);
    beatStep(-40);
    beatGround(120, blue);
    beatStep(-40);
    beatGround(120, blue);
    beatStep(-74);                                 // zu hoch für einen normalen Sprung
    x0 = buildX;
    beatGround(220, blue);
    addDropper(x0 + 120, buildY, { topY: buildY - 120, period: 130, look: 'flowerPot' });
    addHeartArc(x0 + 110, buildY - 70, 3);
    beatStep(70);
    beatGround(140, blue);
    stepToBase();
    beatGround(120, blue);

    // 7) Der Riad: Fontänen tragen über das Brunnenbecken, dann die Dachterrasse
    x0 = buildX;
    beatGround(150, { sand: false, surface: 'zellige' });
    addLandmark('riad', x0, { y: B, w: 900, h: 270 });
    addLandmark('sickBed', x0 + 8, { y: B, w: 104, h: 90 });            // Antonia liegt krank im Bett
    const basin = buildX;
    addGround(basin, 320, B + 46, { sand: false, surface: 'pool' });
    addPlatform(basin + 50, B - 20, 70, { axis: 'y', amplitude: 30, speed: 0.03, phase: 0, look: 'fountain' });
    addPlatform(basin + 200, B - 40, 70, { axis: 'y', amplitude: 30, speed: 0.03, phase: Math.PI, look: 'fountain' });
    addHeart(basin + 85, B - 90);
    addHeart(basin + 235, B - 110);
    buildX = basin + 320;
    beatGround(120, { sand: false, surface: 'zellige' });
    beatViewpoint(text, { landmark: 'roofTerrace', landmarkHeight: 210, width: 380 });

    padChapter(start, 5177, { sand: false, surface: 'zellige' });
}


/* --- Biom 5: Harz -----------------------------------------------------
   Wanderweg mit Holzstapel, Steinschlag, die dunkle Baumannshöhle, die
   Brockenbahn, die Seilbahn übers Rappbodetal, der Wasserfall, der
   Hexentanzplatz und mit Mowgli im Brockenwind hinauf.                  */

function buildBiomeHarz() {
    const text = PERSONAL.chapters.harz;
    const start = buildX;
    const B = buildY;

    // 1) Wanderweg: Wildschwein, Baumstämme rollen vom Holzstapel
    let x0 = buildX;
    beatGround(700);
    addLandmark('sleepCar', x0 + 60, { y: B, w: 190, h: 100 });        // wir beide schlafen im Auto
    addLandmark('gasStove', x0 + 262, { y: B, w: 40, h: 90 });         // ... daneben der Gaskocher
    addHeartArc(x0 + 340, B - 100, 3);
    addCritter(x0 + 350, B, 50, 'boar');
    addLandmark('logPile', x0 + 600, { y: B, w: 90, h: 70 });
    addRoller(x0 + 430, x0 + 610, B, { w: 30, speed: 2, period: 170, look: 'log' });

    // 2) Steinschlag und ein umgestürzter Baum zum Ducken
    x0 = buildX;
    beatGround(300);
    addLandmark('rockfallSign', x0 + 10, { y: B, w: 40, h: 80 });
    addDropper(x0 + 80, B, { topY: B - 230, period: 120, look: 'rock', w: 30, h: 26 });
    addBranch(x0 + 140, B, 110);
    addDropper(x0 + 268, B, { topY: B - 230, period: 110, offset: 55, look: 'rock', w: 30, h: 26 });

    // 3) Die Baumannshöhle: dunkel, tropfende Tropfsteine, Fledermäuse, niedrige Decken
    const cave = buildX;
    addLandmark('cave', cave, { y: B, w: 760, h: 300 });
    addDarkZone(cave + 20, cave + 740);
    beatGround(760, { surface: 'caveFloor' });
    addBlock(cave + 10, B - 230, 740, 40, 'caveCeiling');
    addDropper(cave + 140, B, { topY: B - 190, period: 140, look: 'stalactite', w: 18, h: 30 });
    addBranch(cave + 220, B, 120, 'stalactites');
    addFlyer(cave + 440, B - 66, { rangeX: 50, rangeY: 20, speed: 0.04, look: 'bat', w: 28, h: 18 });
    addBlock(cave + 530, B - 40, 44, 40, 'stalagmite');
    addDropper(cave + 610, B, { topY: B - 190, period: 120, offset: 60, look: 'stalactite', w: 18, h: 30 });
    addBranch(cave + 650, B, 80, 'stalactites');
    addHeartArc(cave + 400, B - 120, 3);

    // 4) Mit der Brockenbahn über die Schlucht
    x0 = buildX;
    beatGround(160);
    const gorge = buildX;
    const gorgeW = 520;
    addLandmark('viaduct', gorge - 20, { y: B, w: gorgeW + 40, h: 260 });
    addPlatform(gorge + 190, B - 20, 190, { axis: 'x', amplitude: 150, speed: 0.008, phase: -Math.PI / 2, look: 'train', h: 16 });
    buildX = gorge + gorgeW;
    beatGround(130, { pitLook: 'water' });

    // 5) Die Seilbahn übers Rappbodetal: die Gondel fährt los, sobald man
    //    drinsteht - bei den Fichtenästen ducken!
    const zipStart = buildX;
    const zipW = 440;
    const zx1 = zipStart + 2;
    const zx2 = zipStart + zipW - 72;
    const zy2 = B + 40;
    addGondola(zx1, B, zx2, zy2, { w: 70, speed: 2 });
    addLandmark('zipline', zx1 - 60, {
        y: B, w: zx2 - zx1 + 190, h: 200,
        x1: zx1 + 35, y1: B - 72, x2: zx2 + 35, y2: zy2 - 72, ground1: B, ground2: zy2,
    });
    for (const k of [0.33, 0.72]) {
        const bx = zx1 + (zx2 - zx1) * k;
        const floorY = B + (zy2 - B) * k;
        addStaticHazard(bx + 20, floorY - 66, 36, 32, 'spruceBranch');
    }
    addHeartArc(zipStart + zipW / 2, B - 20, 3);
    buildX = zipStart + zipW;
    buildY = zy2;

    // 6) Am Wasserfall hinauf: nasse Stufen, schwimmende Stämme im Gegentakt
    x0 = buildX;
    addLandmark('waterfall', x0 + 250, { y: B, w: 130, h: 340 });
    beatGround(140);
    beatStep(-40);
    beatGround(110);
    beatStep(-40);
    beatGround(110, { pitLook: 'water' });
    const logs = buildX;
    addPlatform(logs + 50, buildY - 20, 80, { axis: 'y', amplitude: 28, speed: 0.022, phase: 0, look: 'log' });
    addPlatform(logs + 190, buildY - 48, 80, { axis: 'y', amplitude: 28, speed: 0.022, phase: Math.PI, look: 'log' });
    buildX = logs + 330;
    buildY = buildY - 70;

    // 7) Der Hexentanzplatz: zwei Hexen, und die Kuh bringt einen über die Rosstrappe
    x0 = buildX;
    beatGround(540);
    addFlyer(x0 + 130, buildY - 96, { rangeX: 60, rangeY: 18, speed: 0.03, look: 'witch', w: 34, h: 26 });
    addCow(x0 + 300, buildY, 'cow');
    addBlock(x0 + 376, buildY - 120, 64, 120, 'rockWall');
    addFlyer(x0 + 470, buildY - 80, { rangeX: 40, rangeY: 12, speed: 0.035, look: 'witch', w: 34, h: 26 });

    // wieder hinunter ins Tal
    beatStep(74);
    beatGround(110);
    stepToBase();
    beatGround(120);

    // 8) Mit Mowgli hinauf auf den Brocken - der berüchtigte Brockenwind bläst
    x0 = buildX;
    beatGround(260);
    addCat(x0 + 70, B);
    addWind(x0 + 160, x0 + 700, { force: -1, period: 280, active: 120, warn: 60, look: 'gust' });
    beatStep(-70);                                 // zu hoch ohne Mowgli
    beatGround(200);
    beatStep(-70);
    beatGround(200);
    addHeartArc(buildX - 100, buildY - 110, 3);
    beatStep(-38);
    x0 = buildX;
    beatViewpoint(text, { landmark: 'harzView', landmarkHeight: 230, width: 420 });
    addLandmark('brockenSign', x0 + 40, { y: buildY, w: 70, h: 100 });

    stepToBase();
    padChapter(start, 5976);
}



/* --- Biom 6: Persönlicher Abschluss -----------------------------------
   Ruhige Wiese im Sonnenuntergang. Keine Gefahren, nur der Weg zum Ziel. */

function buildBiomeFinale() {
    const text = PERSONAL.chapters.finale;

    let x0 = buildX;
    beatGround(420);
    addHeartArc(x0 + 220, buildY - 90, 5);

    // Ein paar sanfte Hügel, nichts Gefährliches mehr
    beatStep(-34);
    beatGround(260);
    addHeartArc(buildX - 130, buildY - 80, 3);
    beatStep(34);
    beatGround(300);

    // Der persönliche Ort mit der Abschlussnachricht
    const centerX = beatViewpoint(text, { landmark: 'finaleBench', landmarkHeight: 170, width: 440 });
    addCat(centerX + 120, buildY);             // Mowgli ist am Ende dabei

    beatGround(520);
    level.goalX = buildX - 200;
}


/* --- Übergänge zwischen den Biomen ------------------------------------ */
// An der Grenze wechselt der Boden sichtbar, dahinter steht die Kapitel-Flagge.

function buildTransition(fromIndex, toIndex) {
    const half = 240;

    buildBiome = fromIndex;
    buildSand = BIOMES[fromIndex].palette.ground === 'sand';
    beatGround(half, BIOMES[fromIndex].exit || {});

    const gateX = buildX; // Grenze zwischen den beiden Kapiteln

    buildBiome = toIndex;
    buildSand = BIOMES[toIndex].palette.ground === 'sand';
    beatGround(half, BIOMES[toIndex].entry || {});
    addChapterFlag(gateX + 90, buildY, toIndex);

    return gateX;
}


/* --- Das komplette Level aus den Biomen zusammensetzen ---------------- */

function buildLevel() {
    level.terrain.length = 0;
    level.platforms.length = 0;
    level.obstacles.length = 0;
    level.cows.length = 0;
    level.cats.length = 0;
    level.critters.length = 0;
    level.hearts.length = 0;
    level.checkpoints.length = 0;
    level.decor.length = 0;
    level.clouds.length = 0;
    level.biomes.length = 0;
    level.landmarks.length = 0;
    level.hazards.length = 0;
    level.zones.length = 0;

    buildY = GROUND_BASE_Y;
    buildX = -200;
    buildBiome = 0;
    buildSand = false;

    // Ruhiger Startbereich vor dem ersten Biom - hier steht nie ein Hindernis
    addGround(buildX, 620, buildY);
    buildX += 620;
    level.spawn = { x: 90, y: buildY - PLAYER_HEIGHT };
    addChapterFlag(150, buildY, 0);             // Flagge von Kapitel 1 direkt am Start
    addHeartArc(230, buildY - 70, 3);

    for (let i = 0; i < BIOMES.length; i++) {
        const startX = buildX;
        buildBiome = i;
        buildSand = BIOMES[i].palette.ground === 'sand';
        BIOMES[i].build();

        let endX;
        if (i < BIOMES.length - 1) {
            endX = buildTransition(i, i + 1);
        } else {
            endX = buildX + 600;
        }
        level.biomes.push({ index: i, startX, endX });

        // Hintergrund-Ebenen dieses Kapitels über die gesamte Strecke füllen
        const specs = BIOMES[i].backdrop || [];
        for (const spec of specs) addBackdrop(i, startX - 300, buildX + 300, spec);
    }

    if (!level.goalX || level.goalX < 1000) level.goalX = buildX - 200;

    enforceObstacleSpacing();
    buildPits();
    buildDecoration();
    buildClouds();
}

// Sicherheitsnetz gegen unfaire Hindernis-Kombinationen.
// Es greift nur bei kleinen Bodenhindernissen (Feuer, Dornen, Kisten).
// Decken, Mauern und Schornsteine sind in den Kapiteln bewusst so platziert.
function enforceObstacleSpacing() {
    const isSmall = o => (o.kind === 'thorn' || o.kind === 'crate') && !o.keep;
    const branches = level.obstacles.filter(o => o.kind === 'branch');

    // 1. Im und direkt vor einem Durchgang darf nichts stehen
    level.obstacles = level.obstacles.filter(o => {
        if (!isSmall(o)) return true;
        for (const b of branches) {
            if (o.x + o.w > b.x - 110 && o.x < b.x + b.w + 60) return false;
        }
        return true;
    });
    level.critters = level.critters.filter(c => {
        if (c.fly) return true;
        for (const b of branches) {
            if (c.maxX + c.w > b.x - 80 && c.minX < b.x + b.w + 60) return false;
        }
        return true;
    });

    // 2. Gefahren nie direkt an eine Kante setzen (breite Kakteenfelder sind gewollt)
    // Nur echte Kanten (Loch oder Stufe) - ein Wechsel der Bodenoptik ist keine Kante
    const edges = [];
    for (const block of level.terrain) {
        const joins = (edgeX) => level.terrain.some(o => o !== block && o.y === block.y &&
            (Math.abs(o.x + o.w - edgeX) < 1 || Math.abs(o.x - edgeX) < 1));
        if (!joins(block.x)) edges.push(block.x);
        if (!joins(block.x + block.w)) edges.push(block.x + block.w);
    }
    level.obstacles = level.obstacles.filter(o => {
        if (o.kind !== 'thorn' || o.w > 120 || o.keep) return true;
        for (const edge of edges) {
            if (Math.abs(o.x - edge) < 60 || Math.abs(o.x + o.w - edge) < 60) return false;
        }
        return true;
    });

    // 3. Mindestabstand zwischen zwei kleinen Hindernissen
    const sorted = level.obstacles.filter(isSmall).sort((a, b) => a.x - b.x);
    const removed = new Set();
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (removed.has(prev)) continue;
        if (cur.x - (prev.x + prev.w) < 70) removed.add(cur);
    }
    if (removed.size) level.obstacles = level.obstacles.filter(o => !removed.has(o));
}

// Alle echten Lücken zwischen Bodenblöcken einsammeln
function buildPits() {
    level.pits.length = 0;
    const blocks = level.terrain.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < blocks.length - 1; i++) {
        const a = blocks[i];
        const b = blocks[i + 1];
        const gap = b.x - (a.x + a.w);
        if (gap <= 2) continue;
        // Liegt ein tieferer Auffangboden darunter? Dann ist es keine Schlucht.
        const covered = blocks.some(o => o !== a && o !== b &&
            o.x <= a.x + a.w + 2 && o.x + o.w >= b.x - 2 && o.y > a.y);
        if (covered) continue;
        level.pits.push({ x1: a.x + a.w, x2: b.x, y: Math.min(a.y, b.y), biome: a.biome, look: a.pitLook });
    }
}

function buildClouds() {
    const end = level.goalX + 600;
    for (let x = -400; x < end; x += rand(240, 480)) {
        level.clouds.push({ x, y: rand(20, 190), scale: rand(0.6, 1.4), drift: rand(0.05, 0.16) });
    }
}

// Bodenschmuck passend zum jeweiligen Biom
function buildDecoration() {
    for (const block of level.terrain) {
        if (NO_DECOR_SURFACES.has(block.surface)) continue;
        const palette = BIOMES[block.biome] ? BIOMES[block.biome].palette : BIOMES[0].palette;
        const count = Math.floor(block.w / 130);
        for (let i = 0; i < count; i++) {
            const x = block.x + rand(20, Math.max(30, block.w - 30));
            if (isBlockedForDecor(x)) continue;
            level.decor.push({
                x, y: block.y,
                kind: pick(palette.decor),
                biome: block.biome,
                phase: Math.random() * 6,
                scale: rand(0.85, 1.2),
            });
        }
    }
}

function isBlockedForDecor(x) {
    for (const o of level.obstacles) if (x > o.x - 40 && x < o.x + o.w + 40) return true;
    for (const c of level.cows) if (x > c.x - 40 && x < c.x + c.w + 40) return true;
    for (const c of level.cats) if (x > c.x - 40 && x < c.x + c.w + 40) return true;
    return false;
}


/* ---------- 7b. Hindernis-Mechaniken ---------- */
// Bausteine für die handgebauten Kapitel: Decken und Mauern, Gefahren im Takt,
// fallende Gegenstände, fliegende Gegner, bröckelnde und blinkende Plattformen.

// Solider Block: Decke, Schornstein, Mauer, Theke ... `look` bestimmt die Optik.
function addBlock(x, y, w, h, look) {
    level.obstacles.push({ kind: 'wall', x, y, w, h, look: look || null, biome: buildBiome });
}

// Gefahr im Takt (Ofenflamme, Dampf, Stinkwolke): nur zeitweise aktiv,
// kurz vorher gibt es eine sichtbare Warnung.
function addPulse(x, y, w, h, opts = {}) {
    level.hazards.push({
        type: 'pulse', x, y, w, h,
        period: opts.period || 150,
        active: opts.active || 60,
        warn: opts.warn || 35,
        offset: opts.offset || 0,
        look: opts.look || 'steam',
        biome: buildBiome,
    });
}

// Gegenstand, der herunterfällt (mode 'fall') oder an einer Schnur auf und ab
// pendelt (mode 'yoyo'). groundY ist die Fläche, auf der er aufschlägt.
function addDropper(x, groundY, opts = {}) {
    const w = opts.w || 22;
    const h = opts.h || 22;
    const mode = opts.mode || 'fall';
    let period = opts.period || 140;
    if (mode === 'fall') {
        const fallFrames = Math.sqrt((2 * (groundY - h - opts.topY)) / DROPPER_GRAVITY);
        period = Math.max(period, DROPPER_WARN_FRAMES + fallFrames + 30);
    }
    level.hazards.push({
        type: 'dropper', mode, x, w, h,
        topY: opts.topY, groundY, period,
        offset: opts.offset || 0,
        look: opts.look || 'rock',
        biome: buildBiome,
        lastPhase: null,
    });
}

// Fliegender Gegner (Taube, Hexe): fliegt eine liegende Acht, man kann
// von oben draufspringen.
function addFlyer(x, y, opts = {}) {
    const rangeX = opts.rangeX || 50;
    level.critters.push({
        x, y, w: opts.w || 28, h: opts.h || 20,
        homeX: x, homeY: y,
        minX: x - rangeX, maxX: x + rangeX,
        fly: true, rangeX, rangeY: opts.rangeY || 10,
        speed: opts.speed || 0.03,
        vx: 1, alive: true, squashTimer: 0,
        phase: opts.phase !== undefined ? opts.phase : Math.random() * 6,
        look: opts.look || 'pigeon',
        biome: buildBiome,
    });
}

// --- Zustände der zeitgesteuerten Dinge ---
// Alles hängt nur an state.time: dadurch ist der Takt nach einem Tod sofort
// wieder derselbe und man kann ihn lernen.

// Position im Takt, auch bei negativem Versatz immer zwischen 0 und period
function cyclePos(offset, period) {
    return (((state.time + offset) % period) + period) % period;
}

function pulseState(hz) {
    const t = cyclePos(hz.offset, hz.period);
    if (t < hz.active) return 'on';
    if (t >= hz.period - hz.warn) return 'warn';
    return 'off';
}

function dropperState(hz) {
    const t = cyclePos(hz.offset, hz.period);
    if (hz.mode === 'yoyo') {
        const k = 0.5 - 0.5 * Math.cos((t / hz.period) * Math.PI * 2);
        return { y: hz.topY + (hz.groundY - hz.h - hz.topY) * k, phase: 'moving', danger: true, progress: k };
    }
    const distance = hz.groundY - hz.h - hz.topY;
    const fallFrames = Math.sqrt((2 * distance) / DROPPER_GRAVITY);
    if (t < DROPPER_WARN_FRAMES) {
        return { y: hz.topY, phase: 'warn', danger: false, progress: t / DROPPER_WARN_FRAMES };
    }
    const ft = t - DROPPER_WARN_FRAMES;
    if (ft < fallFrames) {
        return { y: hz.topY + 0.5 * DROPPER_GRAVITY * ft * ft, phase: 'falling', danger: true, progress: ft / fallFrames };
    }
    return { y: hz.groundY - hz.h, phase: 'landed', danger: false, progress: (ft - fallFrames) / 30 };
}

// Trefferfläche einer Gefahr - etwas kleiner als die Zeichnung, damit
// knappe Situationen sich fair anfühlen.
function hazardRect(hz) {
    if (hz.type === 'pulse') {
        if (pulseState(hz) !== 'on') return null;
        return { x: hz.x + 4, y: hz.y + 4, w: hz.w - 8, h: hz.h - 6 };
    }
    const s = dropperState(hz);
    if (!s.danger) return null;
    return { x: hz.x + 3, y: s.y + 3, w: hz.w - 6, h: hz.h - 6 };
}

function updateHazards() {
    for (const hz of level.hazards) {
        if (hz.type !== 'dropper' || hz.mode !== 'fall') continue;
        if (hz.x + hz.w < camera.x - 200 || hz.x > camera.x + viewWidth + 200) { hz.lastPhase = null; continue; }
        const s = dropperState(hz);
        if (hz.lastPhase === 'falling' && s.phase === 'landed') {
            spawnDust(hz.x + hz.w / 2, hz.groundY, 8);
        }
        hz.lastPhase = s.phase;
    }
}

// --- Bröckelnde und blinkende Plattformen ---

function platformHasRider(p) {
    if (player.groundRef && player.groundRef.ref === p) return true;
    if (player.mount && player.mount.groundRef && player.mount.groundRef.ref === p) return true;
    return false;
}

function resetCrumble(p) {
    p.crumbleState = 'idle';
    p.crumbleTimer = 0;
    p.fallVy = 0;
    p.x = p.baseX;
    p.y = p.baseY;
}

function updateCrumble(p) {
    switch (p.crumbleState) {
        case 'idle':
            if (platformHasRider(p)) {
                p.crumbleState = 'shaking';
                p.crumbleTimer = CRUMBLE_DELAY_FRAMES;
            }
            break;
        case 'shaking':
            if (--p.crumbleTimer <= 0) {
                p.crumbleState = 'falling';
                p.fallVy = 0;
            }
            break;
        case 'falling':
            p.fallVy = Math.min(p.fallVy + 0.45, 12);
            p.y += p.fallVy;
            if (p.y > DEATH_Y + 80) {
                p.crumbleState = 'gone';
                p.crumbleTimer = CRUMBLE_RESPAWN_FRAMES;
            }
            break;
        case 'gone':
            if (--p.crumbleTimer <= 0) resetCrumble(p);
            break;
    }
}

// 'on' | 'blink' | 'off'
function timedPhase(p) {
    const t = cyclePos(p.timed.offset, p.timed.period);
    if (t >= p.timed.on) return 'off';
    if (t >= p.timed.on - TIMED_BLINK_FRAMES) return 'blink';
    return 'on';
}

function platformIsSolid(p) {
    if (p.crumbleState === 'gone') return false;
    if (p.timed) return timedPhase(p) !== 'off';
    return true;
}

function resetCrumblingPlatforms() {
    for (const p of level.platforms) {
        if (!p.crumble) continue;
        resetCrumble(p);
        p.prevX = p.x;
        p.prevY = p.y;
        p.dx = 0;
        p.dy = 0;
    }
}

// --- Passende Todesmeldungen ---

const DEATH_TEXTS = {
    fire: 'Zu nah am Feuer!',
    pan: 'Aua, heiß!',
    pot: 'Aua, heiß!',
    cactus: 'Autsch, ein Kaktus!',
    cactusField: 'Autsch, lauter Kakteen!',
    thorn: 'Aua, Dornen!',
    flowerPot: 'Ein Blumentopf von oben!',
    marionette: 'Von der Marionette erwischt!',
    ovenFlame: 'Der Pizzaofen war zu heiß!',
    steam: 'Heißer Dampf!',
    stink: 'Der Geruch hat dich umgehauen!',
    can: 'Eine Dose Hundefutter von oben!',
    pottery: 'Vorsicht, Tonkrug!',
    rock: 'Steinschlag!',
    pigeon: 'Die Tauben von Prag ...',
    meatball: 'Vom Fleischbällchen überrollt!',
    scorpion: 'Ein Skorpion!',
    boar: 'Ein Wildschwein!',
    witch: 'Eine Harzhexe!',
    beetle: 'Der Käfer war schneller!',
};

const PIT_TEXTS = {
    prag: 'Zwischen die Häuser gefallen!',
    marokko: 'In der Sandgrube versunken!',
    harz: 'In die Tiefe gestürzt!',
};

function deathText(look) {
    return DEATH_TEXTS[look] || 'Autsch!';
}



/* ---------- 7c. Weitere Mechaniken ---------- */
// Rollende und fahrende Dinge, Pendel, Wind, Dunkelheit, Paternoster,
// Seilbahn-Gondel, Sprungbretter, Treibsand und ein verspielter Hund.

// Rollt/fährt von rechts (x2) nach links bis x1 - dem Spieler entgegen.
// Bierfass, Straßenbahn, Roller, Tomate, Orange, Baumstamm ...
function addRoller(x1, x2, groundY, opts = {}) {
    const w = opts.w || 26;
    const h = opts.h || w;
    level.hazards.push({
        type: 'roller', x: x1 - w, w: x2 - x1 + 2 * w,
        x1, x2, groundY, rw: w, rh: h,
        speed: opts.speed || 2.5,
        period: opts.period || 200,
        count: opts.count || 1,
        offset: opts.offset || 0,
        warn: opts.warn || 0,
        look: opts.look || 'barrel',
        stops: (opts.stops || []).slice().sort((a, b) => b.x - a.x), // Haltestellen (von rechts nach links)
        clip: opts.clip || null,          // nur hier sichtbar und gefährlich (Tunnel, Einfahrt)
        biome: buildBiome,
    });
}

// Position eines rollenden/fahrenden Objekts, inklusive Halt an Haltestellen
function rollerXAt(hz, t) {
    let x = hz.x2;
    let time = t;
    for (const stop of hz.stops) {
        const drive = (x - stop.x) / hz.speed;
        if (time < drive) return x - time * hz.speed;
        time -= drive;
        x = stop.x;
        if (time < stop.wait) return x;
        time -= stop.wait;
    }
    return x - time * hz.speed;
}

// Alle gerade unterwegs befindlichen Exemplare (und angekündigte, falls warn)
function rollerInstances(hz) {
    const list = [];
    let travel = (hz.x2 - hz.x1 + hz.rw) / hz.speed;
    for (const stop of hz.stops) travel += stop.wait;
    for (let k = 0; k < hz.count; k++) {
        const t = cyclePos(hz.offset + (k * hz.period) / hz.count, hz.period);
        if (t < travel) {
            list.push({ x: rollerXAt(hz, t), y: hz.groundY - hz.rh, moving: true });
        } else if (hz.warn && t > hz.period - hz.warn) {
            list.push({ x: hz.x2, y: hz.groundY - hz.rh, moving: false });
        }
    }
    return list;
}

// Schwingendes Pendel (Kronleuchter, Lampe, Laterne). Am tiefsten Punkt
// muss man sich ducken oder den Moment abpassen.
function addPendulum(pivotX, pivotY, length, opts = {}) {
    const r = opts.r || 14;
    level.hazards.push({
        type: 'pendulum', px: pivotX, py: pivotY, len: length, r,
        x: pivotX - length - r, y: pivotY, w: 2 * (length + r), h: length + r,
        amp: opts.amp || 0.9,
        period: opts.period || 150,
        offset: opts.offset || 0,
        look: opts.look || 'chandelier',
        biome: buildBiome,
    });
}

function pendulumBob(hz) {
    const a = hz.amp * Math.sin((cyclePos(hz.offset, hz.period) / hz.period) * Math.PI * 2);
    return { x: hz.px + Math.sin(a) * hz.len, y: hz.py + Math.cos(a) * hz.len, a };
}

// Feste Gefahr an beliebiger Stelle (z. B. Ast über der Seilbahn)
function addStaticHazard(x, y, w, h, look) {
    level.hazards.push({ type: 'static', x, y, w, h, look, biome: buildBiome });
}

// Trifft eine Gefahr den Spieler gerade?
function hazardHits(hz, p) {
    if (hz.type === 'roller') {
        for (const r of rollerInstances(hz)) {
            if (!r.moving) continue;
            let left = r.x + 4;
            let right = r.x + hz.rw - 4;
            if (hz.clip) {
                left = Math.max(left, hz.clip[0]);
                right = Math.min(right, hz.clip[1]);
            }
            if (right <= left) continue;
            if (overlaps(p, { x: left, y: r.y + 4, w: right - left, h: hz.rh - 4 })) return true;
        }
        return false;
    }
    if (hz.type === 'pendulum') {
        const b = pendulumBob(hz);
        const nx = clamp(b.x, p.x, p.x + p.w);
        const ny = clamp(b.y, p.y, p.y + p.h);
        const dx = b.x - nx;
        const dy = b.y - ny;
        const r = hz.r * 0.85;
        return dx * dx + dy * dy < r * r;
    }
    if (hz.type === 'static') {
        return overlaps(p, { x: hz.x + 2, y: hz.y + 2, w: hz.w - 4, h: hz.h - 4 });
    }
    const rect = hazardRect(hz);
    return !!rect && overlaps(p, rect);
}


// --- Wind (Brockenwind, Sandsturm) ---------------------------------------
// Böen im Takt schieben einen zurück. Kurz vorher sieht man erste Schlieren.

function addWind(x1, x2, opts = {}) {
    level.zones.push({
        type: 'wind', x1, x2,
        force: opts.force || -1.2,
        period: opts.period || 260,
        active: opts.active || 120,
        warn: opts.warn || 60,
        offset: opts.offset || 0,
        look: opts.look || 'gust',
        biome: buildBiome,
    });
}

function windPhase(z) {
    const t = cyclePos(z.offset, z.period);
    if (t < z.active) return 'on';
    if (t >= z.period - z.warn) return 'warn';
    return 'off';
}

function windAt(body) {
    const cx = body.x + body.w / 2;
    for (const z of level.zones) {
        if (z.type !== 'wind' || cx < z.x1 || cx > z.x2) continue;
        const t = cyclePos(z.offset, z.period);
        if (t >= z.active) continue;
        const ramp = Math.min(1, t / 20, (z.active - t) / 20); // weich an und aus
        return z.force * ramp;
    }
    return 0;
}

// --- Dunkelheit (Baumannshöhle) ------------------------------------------

function addDarkZone(x1, x2) {
    level.zones.push({ type: 'dark', x1, x2, biome: buildBiome });
}

function darknessAt(x) {
    let k = 0;
    for (const z of level.zones) {
        if (z.type !== 'dark' || x < z.x1 || x > z.x2) continue;
        k = Math.max(k, clamp(Math.min(x - z.x1, z.x2 - x) / 140, 0, 1));
    }
    return k;
}


// --- Paternoster (Prag): Kabinen fahren ohne Halt im Kreis ---------------
// Links hoch, oben rüber, rechts runter, unten zurück.

function addPaternoster(x1, x2, yTop, yBottom, opts = {}) {
    const cabins = opts.cabins || 4;
    const perimeter = 2 * (yBottom - yTop) + 2 * (x2 - x1);
    for (let i = 0; i < cabins; i++) {
        addPlatform(x1, yBottom, opts.w || 54, { look: 'paternoster', phase: 0 });
        const p = level.platforms[level.platforms.length - 1];
        p.loop = { x1, x2, yTop, yBottom, perimeter, speed: opts.speed || 1, start: (i * perimeter) / cabins };
        placeLoop(p);
        p.baseX = p.prevX = p.x;
        p.baseY = p.prevY = p.y;
    }
}

function placeLoop(p) {
    const L = p.loop;
    const up = L.yBottom - L.yTop;
    const across = L.x2 - L.x1;
    let s = (((L.start + state.time * L.speed) % L.perimeter) + L.perimeter) % L.perimeter;
    if (s < up) { p.x = L.x1; p.y = L.yBottom - s; return; }
    s -= up;
    if (s < across) { p.x = L.x1 + s; p.y = L.yTop; return; }
    s -= across;
    if (s < up) { p.x = L.x2; p.y = L.yTop + s; return; }
    s -= up;
    p.x = L.x2 - s;
    p.y = L.yBottom;
}


// --- Seilbahn-Gondel (Harz): fährt los, sobald man drinsteht --------------

function addGondola(x1, y1, x2, y2, opts = {}) {
    addPlatform(x1, y1, opts.w || 70, { look: 'gondola', phase: 0 });
    const p = level.platforms[level.platforms.length - 1];
    p.zip = { x1, y1, x2, y2, length: Math.hypot(x2 - x1, y2 - y1), speed: opts.speed || 2, pos: 0, wait: 0 };
}

function updateZip(p) {
    const z = p.zip;
    if (platformHasRider(p)) {
        z.pos = Math.min(z.length, z.pos + z.speed);
        z.wait = 90;
    } else if (z.wait > 0) {
        z.wait--;
    } else if (z.pos > 0) {
        z.pos = Math.max(0, z.pos - z.speed * 1.5); // leer zurück zur Station
    }
    const k = z.pos / z.length;
    p.x = z.x1 + (z.x2 - z.x1) * k;
    p.y = z.y1 + (z.y2 - z.y1) * k;
}

function resetZips() {
    for (const p of level.platforms) {
        if (!p.zip) continue;
        p.zip.pos = 0;
        p.zip.wait = 0;
        p.x = p.prevX = p.zip.x1;
        p.y = p.prevY = p.zip.y1;
        p.dx = 0;
        p.dy = 0;
    }
}


// --- Sprungbretter (Markise, Trommel, Pizzateig) ---------------------------

function bounceOnPad(pad) {
    const p = player;
    p.vy = pad.bounce;
    p.onGround = false;
    p.mode = 'air';
    p.groundRef = null;
    p.squash = 1.3;
    p.noCut = true;       // Schwung nicht durch Loslassen der Sprungtaste abbremsen
    pad.squash = 0.55;
    spawnDust(pad.x + pad.w / 2, pad.y, 8);
}


// --- Treibsand (Marokko): wer stehen bleibt, versinkt ---------------------

function onQuicksand(body) {
    return body.onGround && body.groundRef && body.groundRef.ref &&
           body.groundRef.ref.surface === 'quicksand';
}

function updateQuicksand(p) {
    if (onQuicksand(p)) {
        p.sink = (p.sink || 0) + QUICKSAND_SINK_SPEED;
        if (state.time % 9 === 0) spawnDust(p.x + p.w / 2, p.y + p.h, 1);
        if (p.sink >= QUICKSAND_DEPTH) {
            p.sink = QUICKSAND_DEPTH;
            killPlayer('Im Treibsand versunken!');
        }
    } else if (p.sink) {
        p.sink = Math.max(0, p.sink - 1.5);
    }
}


// --- Der Hund: läuft hin und her, man kann über ihn springen oder
//     von ihm abfedern - zerquetscht wird er natürlich nicht.

function addDog(x, groundY, range, speed) {
    addCritter(x, groundY, range, 'dog');
    const c = level.critters[level.critters.length - 1];
    c.w = 44;
    c.h = 30;
    c.y = c.homeY = groundY - c.h;
    c.vx = speed || 2.2;
    c.friendly = true;
}


// --- Jeden Frame --------------------------------------------------------

function updateExtras() {
    for (const p of level.platforms) {
        if (p.bounce) p.squash = lerp(p.squash, 1, 0.15);
    }
}

// Todesmeldung beim Sturz: hängt davon ab, wohinein man gefallen ist
function pitDeathText() {
    const cx = player.x + player.w / 2;
    for (const pit of level.pits) {
        if (cx < pit.x1 - 30 || cx > pit.x2 + 30) continue;
        if (pit.look === 'dye') return 'In den Farbbottich gefallen!';
        if (pit.look === 'water') return 'Platsch! Ins Wasser gefallen!';
        if (pit.look === 'shaft') return 'Den Paternoster verpasst!';
    }
    return PIT_TEXTS[BIOMES[state.currentBiome].id] || 'Ins Loch gefallen!';
}

// Auf diesen Böden wächst keine Deko
const NO_DECOR_SURFACES = new Set(['pool', 'quicksand', 'caveFloor', 'tannery', 'tramRails']);

Object.assign(DEATH_TEXTS, {
    barrel: 'Vom Bierfass überrollt!',
    tram: 'Die Straßenbahn hatte Vorfahrt!',
    chimneySmoke: 'Zu viel Rauch aus dem Schornstein!',
    chandelier: 'Vom Kronleuchter getroffen!',
    scooter: 'Vom Roller erwischt!',
    tomato: 'Über eine Tomate gestolpert!',
    lamp: 'Gegen die Lampe gelaufen!',
    lantern: 'Von der Laterne getroffen!',
    orange: 'Über eine Orange gestolpert!',
    dog: 'Der Hund hat dich erwischt!',
    log: 'Vom Baumstamm überrollt!',
    stalactite: 'Ein Tropfstein von oben!',
    bat: 'Eine Fledermaus!',
    spruceBranch: 'Gegen einen Ast geknallt!',
});

/* ---------- 8. Kollision ---------- */
// Einheitliches System: Boden, Plattformen, Kisten, Kühe und Mowgli werden
// alle als "Solids" behandelt. Der Unterschied liegt nur in zwei Flags:
//   oneWay  - nur von oben betretbar (Plattformen, Mowgli)
//   type    - entscheidet, was beim Landen passiert

let activeSolids = [];

function rebuildSolids() {
    activeSolids.length = 0;
    const left = camera.x - 260;
    const right = camera.x + viewWidth + 260;

    for (const t of level.terrain) {
        if (t.x + t.w < left || t.x > right) continue;
        activeSolids.push({ rect: t, type: 'ground', ref: t, oneWay: false });
    }
    for (const p of level.platforms) {
        if (p.x + p.w < left || p.x > right) continue;
        if (!platformIsSolid(p)) continue;
        activeSolids.push({ rect: p, type: 'platform', ref: p, oneWay: true });
    }
    for (const o of level.obstacles) {
        if (o.x + o.w < left || o.x > right) continue;
        if (o.kind === 'thorn') continue; // Dornen sind Gefahr, kein Solid
        activeSolids.push({ rect: o, type: o.kind, ref: o, oneWay: false });
    }
    for (const c of level.cows) {
        if (c.x + c.w < left || c.x > right) continue;
        activeSolids.push({ rect: c, type: 'cow', ref: c, oneWay: false });
        // Breitere, nur von oben wirksame Landefläche: dadurch federt man
        // zuverlässig ab, auch wenn der Sprung etwas zu weit trägt.
        activeSolids.push({
            rect: { x: c.x - COW_LANDING_LIP, y: c.y, w: c.w + COW_LANDING_LIP * 2, h: 10 },
            type: 'cow', ref: c, oneWay: true,
        });
    }
    for (const c of level.cats) {
        if (c.x + c.w < left || c.x > right) continue;
        if (player.mount === c) continue; // worauf man reitet, ist kein Hindernis
        // Mowgli ist wie die Kuh von allen Seiten fest: dadurch merkt man
        // überhaupt erst, dass man auf ihm landen kann, statt durchzulaufen.
        activeSolids.push({ rect: c, type: 'mowgli', ref: c, oneWay: false });
        // Zusätzlich eine breitere, nur von oben wirksame Landefläche.
        // Sein Rücken ist damit ein gut treffbares Ziel, ohne dass er seitlich
        // breiter wirkt, als er aussieht.
        activeSolids.push({
            rect: { x: c.x - CAT_LANDING_LIP, y: c.y, w: c.w + CAT_LANDING_LIP * 2, h: 10 },
            type: 'mowgli', ref: c, oneWay: true,
        });
    }
}

// Passt der Körper an dieser Stelle hin, ohne in etwas Festem zu stecken?
function fitsAt(x, y, w, h, ignore) {
    const test = { x, y, w, h };
    for (const solid of activeSolids) {
        if (solid.oneWay || solid.ref === ignore) continue;
        if (overlaps(test, solid.rect)) return false;
    }
    return true;
}

// Bewegt einen Körper um seine Geschwindigkeit und löst Kollisionen auf.
// X und Y getrennt - das ist der Standardweg und vermeidet Ecken-Sonderfälle.
function moveBody(body, ignore) {
    body.onGround = false;
    let landedOn = null;
    let hitCeiling = false;

    // --- X-Achse ---
    body.x += body.vx;
    for (const solid of activeSolids) {
        if (solid.oneWay || solid.ref === ignore) continue;
        if (!overlaps(body, solid.rect)) continue;

        // Winzige Kanten automatisch hochsteigen. Ohne das bleibt man an
        // einer 4px-Stufe kleben und versteht überhaupt nicht, warum.
        const rise = (body.y + body.h) - solid.rect.y;
        if (rise > 0 && rise <= STEP_ASSIST && body.vy >= 0 &&
            fitsAt(body.x, solid.rect.y - body.h, body.w, body.h, ignore)) {
            body.y = solid.rect.y - body.h;
            continue;
        }

        // Steckte der Körper schon vorher tief drin, nicht ans andere Ende eines
        // langen Blocks schieben - das wäre ein Teleport. Die Y-Achse löst es.
        const push = body.vx > 0 ? body.x + body.w - solid.rect.x : solid.rect.x + solid.rect.w - body.x;
        if (body.vx !== 0 && push > Math.abs(body.vx) + 8) continue;

        if (body.vx > 0) body.x = solid.rect.x - body.w;
        else if (body.vx < 0) body.x = solid.rect.x + solid.rect.w;
        body.vx = 0;
    }

    // --- Y-Achse ---
    const previousBottom = body.y + body.h;
    body.y += body.vy;
    for (const solid of activeSolids) {
        if (solid.ref === ignore) continue;
        const r = solid.rect;
        if (!overlaps(body, r)) continue;

        if (solid.oneWay) {
            // Einweg: nur von oben, und nur wenn man vorher wirklich drüber war
            if (body.vy < 0) continue;
            if (previousBottom > r.y + 8) continue;
        }

        if (body.vy > 0) {
            // Steckt der Kopf von unten in einer Decke, nicht obendrauf setzen -
            // sonst läuft man über dem Level herum. Stattdessen nach unten.
            if (!solid.oneWay && previousBottom > r.y + body.vy + 10 && r.y + r.h <= body.y + body.h * 0.6) {
                body.y = r.y + r.h;
                continue;
            }
            body.y = r.y - body.h;
            body.vy = 0;
            body.onGround = true;
            landedOn = solid;
        } else if (body.vy < 0) {
            body.y = r.y + r.h;
            body.vy = 0;
            hitCeiling = true;
        }
    }

    body.groundRef = landedOn;
    body.hitCeiling = hitCeiling;
    return landedOn;
}

// Prüft, ob an einer Position Platz für die volle Körperhöhe ist
function hasHeadroom(body, fullHeight) {
    const test = { x: body.x, y: body.y + body.h - fullHeight, w: body.w, h: fullHeight };
    for (const solid of activeSolids) {
        if (solid.oneWay) continue;
        if (overlaps(test, solid.rect)) return false;
    }
    return true;
}


/* ---------- 9. Spieler, Mowgli, Kuh, Käfer ---------- */

function updatePlatforms() {
    for (const p of level.platforms) {
        p.prevX = p.x;
        p.prevY = p.y;
        if (p.loop) {
            placeLoop(p);
        } else if (p.zip) {
            updateZip(p);
        } else if (p.crumble) {
            updateCrumble(p);
        } else if (p.axis === 'y') {
            p.y = p.baseY + Math.sin(state.time * p.speed + p.phase) * p.amplitude;
        } else if (p.axis === 'x') {
            p.x = p.baseX + Math.sin(state.time * p.speed + p.phase) * p.amplitude;
        }
        p.dx = p.x - p.prevX;
        p.dy = p.y - p.prevY;
    }
}

// Wer auf einer beweglichen Plattform steht, wird mitgenommen
function carryWithPlatform(body) {
    const ref = body.groundRef;
    if (!ref || ref.type !== 'platform') return;
    body.x += ref.ref.dx;
    body.y += ref.ref.dy;
}

function updatePlayer() {
    const p = player;

    if (p.jumpBuffer > 0) p.jumpBuffer--;
    if (p.coyote > 0) p.coyote--;
    if (p.blink > 0) p.blink--;
    else if (chance(0.004)) p.blink = 10;

    if (admin.flying) {
        updateFlying();
        return;
    }

    if (p.mode === 'riding') {
        updateRiding();
        return;
    }

    carryWithPlatform(p);

    // --- Ducken ---
    const wantsDuck = input.down && p.onGround;
    if (wantsDuck && !p.ducking) {
        p.y += p.h - PLAYER_DUCK_HEIGHT;
        p.h = PLAYER_DUCK_HEIGHT;
        p.ducking = true;
    } else if (!input.down && p.ducking && hasHeadroom(p, PLAYER_HEIGHT)) {
        p.y -= PLAYER_HEIGHT - p.h;
        p.h = PLAYER_HEIGHT;
        p.ducking = false;
    }

    // --- Horizontale Bewegung mit Beschleunigung/Bremsen ---
    // Auf Sand (Marokko) läuft es sich schwerer: weniger Zug, längeres Ausrollen.
    const onSand = p.onGround && p.groundRef && p.groundRef.ref && p.groundRef.ref.sand;
    const onSlippery = p.onGround && p.groundRef && p.groundRef.ref && p.groundRef.ref.slippery;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = (p.onGround ? RUN_ACCEL : AIR_ACCEL) * (onSand ? SAND_ACCEL_FACTOR : 1) * (onSlippery ? SLIPPERY_ACCEL_FACTOR : 1);
    if (dir !== 0) {
        p.vx += dir * accel;
        p.facing = dir;
        if (onSand && p.onGround && state.time % 7 === 0 && Math.abs(p.vx) > 2) {
            spawnDust(p.x + p.w / 2, p.y + p.h, 1); // aufgewirbelter Sand
        }
    } else if (p.onGround) {
        const friction = RUN_FRICTION * (onSand ? SAND_FRICTION_FACTOR : 1) * (onSlippery ? SLIPPERY_FRICTION_FACTOR : 1);
        if (Math.abs(p.vx) <= friction) p.vx = 0;
        else p.vx -= Math.sign(p.vx) * friction;
    } else {
        p.vx *= (1 - AIR_DRAG);
    }
    const maxSpeed = MAX_RUN_SPEED * (p.ducking ? DUCK_SPEED_FACTOR : 1) * (onSand ? SAND_SPEED_FACTOR : 1) *
                     (onQuicksand(p) ? QUICKSAND_SPEED_FACTOR : 1);
    p.vx = clamp(p.vx, -maxSpeed, maxSpeed);

    // --- Springen (mit Coyote-Zeit und Eingabepuffer) ---
    if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0) && !p.ducking) {
        p.vy = JUMP_VELOCITY * (1 - 0.3 * (p.sink || 0) / QUICKSAND_DEPTH);
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.onGround = false;
        p.mode = 'air';
        p.squash = 1.25;
        spawnDust(p.x + p.w / 2, p.y + p.h, 5);
    }
    // Sprunghöhe steuerbar: früh loslassen = niedriger Sprung
    // Nach Kuh oder Sprungbrett wird der Schwung nicht abgeschnitten
    if (p.vy >= 0) p.noCut = false;
    if (!input.jumpHeld && !p.noCut && p.vy < JUMP_CUT_VELOCITY) p.vy = JUMP_CUT_VELOCITY;

    // --- Schwerkraft & Bewegung ---
    p.vy = Math.min(p.vy + GRAVITY, MAX_FALL_SPEED);
    const wasInAir = !p.onGround;
    const ownVx = p.vx;
    p.vx += windAt(p);               // Wind schiebt nur mit, verändert nicht das eigene Tempo
    const landed = moveBody(p);
    if (p.vx !== 0) p.vx = ownVx;

    if (p.onGround) {
        p.mode = 'ground';
        p.coyote = COYOTE_FRAMES;
        if (wasInAir) onLanded(landed);
    } else {
        p.mode = 'air';
    }
    updateQuicksand(p);

    // Sonderfälle: Kuh federt ab, auf Mowgli wird aufgesattelt.
    // Aufsatteln hängt am Zustand "steht auf Mowgli" (nicht an einem einzelnen
    // Frame) - dadurch klappt es auch, wenn man nach dem Absprung wieder landet.
    if (landed && landed.type === 'platform' && landed.ref.bounce) {
        bounceOnPad(landed.ref);
    } else if (landed && landed.type === 'cow') {
        bounceOnCow(landed.ref);
    } else if (p.onGround && p.groundRef && p.groundRef.type === 'mowgli' &&
               p.mode !== 'riding' && p.groundRef.ref.remountCooldown <= 0) {
        mountMowgli(p.groundRef.ref);
    }

    // Laufanimation & Squash
    if (p.onGround && Math.abs(p.vx) > 0.2) p.runPhase += Math.abs(p.vx) * 0.16;
    else p.runPhase = 0;
    p.squash = lerp(p.squash, 1, 0.18);
}

function onLanded(solid) {
    if (!solid || solid.type === 'cow' || solid.type === 'mowgli') return;
    player.squash = 0.78;
    spawnDust(player.x + player.w / 2, player.y + player.h, 6);
}

function bounceOnCow(cow) {
    const p = player;
    p.vy = COW_BOUNCE_VELOCITY;
    p.onGround = false;
    p.mode = 'air';
    p.groundRef = null;
    p.squash = 1.3;
    cow.squash = 0.7;
    p.noCut = true;
    state.shake = 5;
    spawnDust(cow.x + cow.w / 2, cow.y, 10);
}

function mountMowgli(cat) {
    const p = player;
    p.mount = cat;
    p.mode = 'riding';
    p.vy = 0;
    p.vx = 0;
    p.onGround = true;
    cat.ridden = true;
    cat.vy = 0;
    // Ruhig sitzen: es passiert bewusst nichts automatisch
    p.x = cat.x + (cat.w - p.w) / 2;
    p.y = cat.y - p.h;
    spawnSparkle(cat.x + cat.w / 2, cat.y, 6, '#ffd9a0');
}

function dismountMowgli() {
    const p = player;
    const cat = p.mount;
    p.mount = null;
    p.mode = 'air';
    p.onGround = false;
    p.groundRef = null;
    p.vy = DISMOUNT_VELOCITY;
    p.squash = 1.2;
    if (cat) {
        cat.ridden = false;
        cat.remountCooldown = MOWGLI_REMOUNT_FRAMES;
        spawnDust(cat.x + cat.w / 2, cat.y, 6);
    }
}

// Trefferfläche von Bodengefahren (Feuer, Topf, Pfanne, Kaktus ...):
// etwas kleiner als die Zeichnung, damit knappe Sprünge nicht an einem
// einzigen Pixel scheitern. Einstellbar über HAZARD_HITBOX_INSET.
function thornHitbox(o) {
    const inset = Math.min(HAZARD_HITBOX_INSET, o.w / 3);
    return { x: o.x + inset, y: o.y + HAZARD_HITBOX_INSET, w: o.w - inset * 2, h: o.h - HAZARD_HITBOX_INSET };
}

// Berührt Mowgli gerade eine Gefahr? (Dornen, Feuer, Fallendes, Gegner ...)
function mowgliTouchesHazard(cat) {
    for (const o of level.obstacles) {
        if (o.kind === 'thorn' && overlaps(cat, thornHitbox(o))) return true;
    }
    for (const hz of level.hazards) {
        if (hz.x > cat.x + cat.w + 10 || hz.x + hz.w < cat.x - 10) continue;
        if (hazardHits(hz, cat)) return true;
    }
    for (const c of level.critters) {
        if (c.alive && overlaps(cat, c)) return true;
    }
    return false;
}

// Mowgli erschrickt und wirft Antonia ab: hoch und entgegen der Laufrichtung
function throwOffMowgli(cat) {
    const away = -(Math.sign(cat.vx) || cat.facing || 1);
    dismountMowgli();
    player.vy = MOWGLI_THROW_VELOCITY;
    player.vx = away * MOWGLI_THROW_PUSH;
    player.noCut = true;
    player.facing = -away;
    cat.vx = 0;
    // Mowgli weicht selbst ein Stück zurück - sonst würde man beim nächsten
    // Aufsitzen sofort wieder abgeworfen
    for (let step = 0; step < 24 && mowgliTouchesHazard(cat); step += 4) {
        if (!fitsAt(cat.x + away * 4, cat.y, cat.w, cat.h, cat)) break;
        cat.x += away * 4;
    }
    cat.remountCooldown = MOWGLI_THROW_REMOUNT_FRAMES;
    state.shake = 4;
    spawnSparkle(cat.x + cat.w / 2, cat.y, 8, '#ffd9a0');
}

// Reiten: der Spieler steuert Mowgli, Mowgli hat die echte Physik
function updateRiding() {
    const p = player;
    const cat = p.mount;
    if (!cat) { p.mode = 'air'; return; }

    carryWithPlatform(cat);

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = cat.onGround ? RUN_ACCEL * MOWGLI_ACCEL_FACTOR : AIR_ACCEL;
    if (dir !== 0) {
        cat.vx += dir * accel;
        p.facing = dir;
        cat.facing = dir;
    } else if (cat.onGround) {
        if (Math.abs(cat.vx) <= RUN_FRICTION) cat.vx = 0;
        else cat.vx -= Math.sign(cat.vx) * RUN_FRICTION;
    }
    cat.vx = clamp(cat.vx, -MAX_RUN_SPEED, MAX_RUN_SPEED);

    // Sprungtaste: am Boden springen beide gemeinsam, in der Luft steigt man ab
    if (p.jumpBuffer > 0) {
        p.jumpBuffer = 0;
        if (cat.onGround) {
            cat.vy = MOWGLI_JUMP_VELOCITY;
            cat.onGround = false;
            spawnDust(cat.x + cat.w / 2, cat.y + cat.h, 7);
        } else {
            dismountMowgli();
            return;
        }
    }
    if (!input.jumpHeld && cat.vy < JUMP_CUT_VELOCITY) cat.vy = JUMP_CUT_VELOCITY;

    cat.vy = Math.min(cat.vy + GRAVITY, MAX_FALL_SPEED);
    const catVx = cat.vx;
    cat.vx += windAt(cat);
    // Mowgli und Reiterin bewegen sich als EIN hoher Körper: so steckt ihr Kopf
    // nie in einer Decke oder einem Schild (sonst würde sie beim Absteigen
    // durch die Kollision quer durchs Level geschoben).
    const rider = { x: cat.x, y: cat.y - p.h, w: cat.w, h: cat.h + p.h, vx: cat.vx, vy: cat.vy };
    moveBody(rider, cat);
    cat.x = rider.x;
    cat.y = rider.y + p.h;
    cat.vx = rider.vx;
    cat.vy = rider.vy;
    cat.onGround = rider.onGround;
    cat.groundRef = rider.groundRef;
    if (cat.vx !== 0) cat.vx = catVx;

    // Der Spieler sitzt sauber oben auf Mowgli
    p.x = cat.x + (cat.w - p.w) / 2;
    p.y = cat.y - p.h;
    p.vx = cat.vx;
    p.vy = cat.vy;
    p.onGround = cat.onGround;
    p.squash = lerp(p.squash, 1, 0.2);
    if (cat.onGround && Math.abs(cat.vx) > 0.2) cat.tailPhase += 0.2;
}

function updateCats() {
    for (const cat of level.cats) {
        if (cat.remountCooldown > 0) cat.remountCooldown--;
        if (cat.blink > 0) cat.blink--;
        else if (chance(0.005)) cat.blink = 9;
        cat.tailPhase += 0.05;

        if (player.mount === cat) continue; // wird beim Reiten bewegt

        carryWithPlatform(cat);

        // Mowgli ist eine Katze: springt Antonia über ihm, läuft er ihr
        // entgegen, damit sie sicher auf seinem Rücken landet. Das macht das
        // Aufsatteln zuverlässig, ohne den Spieler magisch zu versetzen.
        const playerCenter = player.x + player.w / 2;
        const catCenter = cat.x + cat.w / 2;
        const distance = playerCenter - catCenter;
        const playerAbove = player.y + player.h < cat.y + 6;
        const wantsCatch = cat.onGround && player.mode !== 'riding' &&
                           player.vy > 0 && playerAbove &&
                           Math.abs(distance) < CAT_FOLLOW_RANGE;
        if (wantsCatch && Math.abs(distance) > 4) {
            cat.vx = clamp(distance * 0.12, -CAT_FOLLOW_SPEED, CAT_FOLLOW_SPEED);
        } else {
            cat.vx *= 0.8;
        }
        if (Math.abs(cat.vx) < 0.05) cat.vx = 0;
        else cat.facing = Math.sign(cat.vx);
        cat.vy = Math.min(cat.vy + GRAVITY, MAX_FALL_SPEED);
        moveBody(cat, cat);

        // Mowgli darf nie verloren gehen: fällt er ins Loch, kommt er heim
        if (cat.y > DEATH_Y) {
            cat.x = cat.homeX;
            cat.y = cat.homeY;
            cat.vx = 0;
            cat.vy = 0;
        }
    }
}

function updateCritters() {
    for (const c of level.critters) {
        if (!c.alive) {
            c.squashTimer--;
            if (c.fly) c.y += 4; // getroffene Flieger fallen herunter
            continue;
        }
        if (c.fly) {
            const a = state.time * c.speed + c.phase;
            const nx = c.homeX + Math.sin(a) * c.rangeX;
            c.vx = nx - c.x;
            c.x = nx;
            c.y = c.homeY + Math.sin(a * 2) * c.rangeY;
            continue;
        }
        c.x += c.vx;
        if (c.x < c.minX) { c.x = c.minX; c.vx = Math.abs(c.vx); }
        if (c.x > c.maxX) { c.x = c.maxX; c.vx = -Math.abs(c.vx); }
        c.phase += 0.18;
    }
}

function updateCows() {
    for (const cow of level.cows) {
        cow.squash = lerp(cow.squash, 1, 0.12);
        cow.chew += 0.03;
    }
}

// Gefahren: Dornen, Käfer, Absturz
function checkHazards() {
    const p = player;

    for (const o of level.obstacles) {
        if (o.kind !== 'thorn') continue;
        if (overlaps(p, thornHitbox(o))) { killPlayer(deathText(o.look || paletteOf(o).hazard)); return; }
    }

    for (const hz of level.hazards) {
        if (hz.x > p.x + p.w + 10 || hz.x + hz.w < p.x - 10) continue;
        if (hazardHits(hz, p)) { killPlayer(deathText(hz.look)); return; }
    }

    for (const c of level.critters) {
        if (!c.alive) continue;
        if (!overlaps(p, c)) continue;
        const cameFromAbove = p.vy > 0 && (p.y + p.h) - p.vy <= c.y + 8;
        if (cameFromAbove && p.mode !== 'riding' && c.friendly) {
            // Der Hund wird nicht zerquetscht - man federt einfach von ihm ab
            p.vy = STOMP_BOUNCE_VELOCITY;
            p.onGround = false;
            p.mode = 'air';
            continue;
        } else if (cameFromAbove && p.mode !== 'riding') {
            c.alive = false;
            c.squashTimer = 40;
            p.vy = STOMP_BOUNCE_VELOCITY;
            p.onGround = false;
            p.mode = 'air';
            state.shake = 3;
            state.hearts++;
            spawnSparkle(c.x + c.w / 2, c.y, 8, '#ffe08a');
        } else {
            killPlayer(deathText(c.look || 'beetle'));
            return;
        }
    }

    // Reitet man auf Mowgli und ER berührt eine Gefahr, wird man abgeworfen
    if (p.mode === 'riding' && p.mount && mowgliTouchesHazard(p.mount)) {
        throwOffMowgli(p.mount);
    }

    // Brunnenbecken im Riad: wer hineinfällt, muss zurück
    if (p.onGround && p.groundRef && p.groundRef.ref && p.groundRef.ref.surface === 'pool') {
        killPlayer('Platsch! Ins Brunnenbecken gefallen!');
        return;
    }

    if (p.y > DEATH_Y) killPlayer(pitDeathText());
}

function collectHearts() {
    for (const h of level.hearts) {
        if (h.taken) continue;
        h.phase += 0.08;
        if (!overlaps(player, h)) continue;
        h.taken = true;
        state.hearts++;
        spawnSparkle(h.x + h.w / 2, h.y + h.h / 2, 9, '#ff8fa8');
    }
}

function updateCheckpoints() {
    for (const cp of level.checkpoints) {
        if (cp.active) { cp.phase += 0.06; continue; }
        if (Math.abs(player.x - cp.x) < 50 && Math.abs((player.y + player.h) - cp.y) < 140) {
            cp.active = true;
            spawnSparkle(cp.x, cp.y - 60, 12, '#ffd0dc');
        }
    }
}

function lastCheckpoint() {
    // Noch keine Flagge berührt? Dann geht es am Startpunkt weiter.
    let best = { x: level.spawn.x + PLAYER_WIDTH / 2, y: level.spawn.y + PLAYER_HEIGHT };
    for (const cp of level.checkpoints) {
        if (cp.active && cp.x <= player.x + 40 && cp.x >= best.x) best = cp;
    }
    return best;
}

function killPlayer(reason) {
    if (state.mode !== 'playing') return;
    if (admin.flying) return;   // im Admin-Flug unverwundbar
    state.mode = 'dead';
    state.deathReason = reason;
    state.deaths++;
    state.respawnTimer = RESPAWN_INPUT_DELAY;
    state.shake = 8;
    if (player.mount) {
        player.mount.ridden = false;
        player.mount = null;
    }
    spawnDust(player.x + player.w / 2, player.y + player.h / 2, 14);
}

function respawn() {
    const cp = lastCheckpoint();
    player.x = cp.x - player.w / 2;
    player.y = cp.y - PLAYER_HEIGHT - 4;
    player.w = PLAYER_WIDTH;
    player.h = PLAYER_HEIGHT;
    player.vx = 0;
    player.vy = 0;
    player.ducking = false;
    player.mode = 'air';
    player.mount = null;
    player.groundRef = null;

    for (const cat of level.cats) {
        cat.x = cat.homeX;
        cat.y = cat.homeY;
        cat.vx = 0; cat.vy = 0;
        cat.ridden = false;
        cat.remountCooldown = 0;
    }
    for (const c of level.critters) {
        c.x = c.homeX;
        c.y = c.homeY;
        c.alive = true;
        c.squashTimer = 0;
    }
    resetCrumblingPlatforms();
    resetZips();
    player.sink = 0;
    player.noCut = false;
    particles.length = 0;
    state.mode = 'playing';
    updateCamera(true);
}


/* --- Admin-Modus ------------------------------------------------------ */

const admin = { active: false, flying: false };

function toggleAdmin() {
    if (!ADMIN_ENABLED) return;
    admin.active = !admin.active;
    if (!admin.active) admin.flying = false;
}

function toggleFlying() {
    admin.flying = !admin.flying;
    const p = player;
    if (admin.flying && p.mount) {
        p.mount.ridden = false;
        p.mount = null;
    }
    p.vx = 0;
    p.vy = 0;
    p.onGround = false;
    p.groundRef = null;
    p.mode = 'air';
    if (p.ducking) {
        p.y -= PLAYER_HEIGHT - p.h;
        p.h = PLAYER_HEIGHT;
        p.ducking = false;
    }
}

// Fliegen: Pfeile/WASD bewegen frei, Leertaste/hoch = rauf, runter = runter
function updateFlying() {
    const p = player;
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.jumpHeld ? 1 : 0);
    p.x += dx * ADMIN_FLY_SPEED;
    p.y = clamp(p.y + dy * ADMIN_FLY_SPEED, 20, DEATH_Y - 80);
    p.vx = dx * 0.01;   // nur für Blickrichtung und Kamera
    p.vy = 0;
    if (dx !== 0) p.facing = dx;
    p.onGround = false;
    p.groundRef = null;
    p.mode = 'air';
    p.runPhase = 0;
}

// An den Anfang eines Kapitels springen (an seine Flagge).
// Die Flaggen davor gelten als erreicht, damit man dort auch wieder startet.
function jumpToChapter(index) {
    const biome = level.biomes[index];
    if (!biome) return;
    const label = BIOMES[index].text.flag;
    const flag = label ? level.checkpoints.find(cp => cp.label === label) : null;
    const targetX = flag ? flag.x : biome.startX + 60;

    for (const cp of level.checkpoints) cp.active = cp.x <= targetX;

    // respawn() nimmt nur Flaggen links vom Spieler - also erst dorthin setzen
    player.x = targetX;
    respawn();   // setzt Gegner, Mowgli und Plattformen zurück
    if (!flag) {
        const groundY = groundSurfaceAt(targetX) ?? GROUND_BASE_Y;
        player.x = targetX - player.w / 2;
        player.y = groundY - PLAYER_HEIGHT - 4;
        updateCamera(true);
    }
    state.currentBiome = index;
    state.mode = 'playing';
}


/* ---------- 10. Partikel & Kamera ---------- */

function spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: rand(-1.6, 1.6), vy: rand(-1.8, -0.2),
            life: randInt(18, 32), maxLife: 32,
            size: rand(2, 5), color: '#e8dcc8', gravity: 0.06,
        });
    }
}

function spawnSparkle(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: rand(-2, 2), vy: rand(-2.6, -0.6),
            life: randInt(22, 40), maxLife: 40,
            size: rand(2.5, 5), color, gravity: 0.03,
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function updateCamera(instant) {
    const targetX = player.x + player.w / 2 - viewWidth * CAMERA_PLAYER_POSITION + player.vx * CAMERA_LOOK_AHEAD;
    const targetY = player.y + player.h / 2 - viewHeight * 0.56;

    const minX = -260;
    const maxX = level.goalX + 400 - viewWidth;
    const minY = -220;
    const maxY = GROUND_MAX_Y + 180 - viewHeight * 0.5;

    if (instant) {
        camera.x = clamp(targetX, minX, Math.max(minX, maxX));
        camera.y = clamp(targetY, minY, Math.max(minY, maxY));
        return;
    }
    camera.x = lerp(camera.x, clamp(targetX, minX, Math.max(minX, maxX)), CAMERA_SMOOTHING);
    // camera.y = lerp(camera.y, clamp(targetY, minY, Math.max(minY, maxY)), 0.08);
}


/* ---------- 11. Zeichnen ---------- */

// Hilfsfunktion: die Palette eines Objekts (jedes Objekt kennt sein Biom)
function paletteOf(obj) {
    const b = BIOMES[obj && obj.biome !== undefined ? obj.biome : 0];
    return (b || BIOMES[0]).palette;
}

function drawSky() {
    const pal = backgroundPaletteAt(camera.x + viewWidth * 0.5);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(0.55, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sonne / Lichtquelle des jeweiligen Kapitels
    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    const sun = pal.sun;
    const sunX = viewWidth * sun.x;
    const sunY = viewHeight * sun.y;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, sun.r * 4);
    glow.addColorStop(0, sun.glow);
    glow.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sun.r * 4, sunY - sun.r * 4, sun.r * 8, sun.r * 8);
    ctx.fillStyle = sun.color;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sun.r, 0, Math.PI * 2);
    ctx.fill();
}


function drawParallax() {
    const pal = backgroundPaletteAt(camera.x + viewWidth * 0.5);

    // Wolken
    ctx.save();
    ctx.translate(-camera.x * 0.2, -camera.y * 0.25);
    const cloudLeft = camera.x * 0.2 - 120;
    const cloudRight = camera.x * 0.2 + viewWidth + 120;
    ctx.fillStyle = pal.cloud;
    for (const c of level.clouds) {
        const x = c.x - state.time * c.drift;
        if (x < cloudLeft || x > cloudRight) continue;
        drawCloud(x, c.y, c.scale);
    }
    ctx.restore();

    // Hintergrund-Ebenen der Biome (hintere zuerst).
    // Die x-Werte liegen bereits in Ebenen-Koordinaten (siehe addBackdrop),
    // deshalb genügt hier eine einfache Verschiebung um camera.x * depth.
    const background = level.landmarks
        .filter(l => l.layer)
        .sort((a, b) => a.depth - b.depth);

    // In Ebenen-Koordinaten überlappen sich die Bereiche benachbarter Biome.
    // Deshalb wird immer nur der Hintergrund des aktuellen Kapitels gezeichnet
    // und am Übergang weich zum nächsten überblendet.
    const camCenter = camera.x + viewWidth * 0.4;
    const currentIndex = biomeIndexAt(camCenter);
    const band = level.biomes[currentIndex];
    const distanceToEnd = band ? band.endX - camCenter : Infinity;
    const fade = clamp(1 - distanceToEnd / TRANSITION_BLEND, 0, 1);

    for (const lm of background) {
        let alpha;
        if (lm.biome === currentIndex) alpha = 1 - fade;
        else if (lm.biome === currentIndex + 1) alpha = fade;
        else continue;
        if (alpha <= 0.02) continue;

        const screenX = lm.x - camera.x * lm.depth;
        if (screenX + lm.w < -140 || screenX > viewWidth + 140) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        // Vertikal nur gedämpft mitziehen, damit der Horizont ruhig bleibt
        ctx.translate(-camera.x * lm.depth, -camera.y * (0.35 + lm.depth * 0.4));
        drawLandmark(lm, paletteOf(lm));
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

function drawCloud(x, y, scale) {
    ctx.beginPath();
    ctx.ellipse(x, y, 38 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 30 * scale, y + 6 * scale, 26 * scale, 15 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 28 * scale, y + 8 * scale, 22 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
}


/* --- Die großen Bauwerke der einzelnen Kapitel --- */

function drawLandmark(lm, pal) {
    switch (lm.kind) {
        case 'pragHouses': drawPragHouses(lm, pal); break;
        case 'pragTower': drawPragTower(lm, pal); break;
        case 'pragBridge': drawPragBridge(lm, pal); break;
        case 'pragSpires': drawPragSpires(lm, pal); break;
        case 'restaurantWall': drawRestaurantWall(lm, pal, false); break;
        case 'afroWall': drawRestaurantWall(lm, pal, true); break;
        case 'hangingLamps': drawHangingLamps(lm, pal, '#ffd9a0'); break;
        case 'afroLamps': drawHangingLamps(lm, pal, '#ffc46a'); break;
        case 'dateTable': drawSpecialTable(lm, pal, 'italien'); break;
        case 'afroTable': drawSpecialTable(lm, pal, 'afrika'); break;
        case 'atlas': drawAtlas(lm, pal); break;
        case 'dunes': drawDunes(lm, pal); break;
        case 'oasis': drawOasis(lm, pal); break;
        case 'kasbah': drawKasbah(lm, pal); break;
        case 'courtyard': drawCourtyard(lm, pal); break;
        case 'roofTerrace': drawRoofTerrace(lm, pal); break;
        case 'firForest': drawFirForest(lm, pal); break;
        case 'harzRocks': drawHarzRocks(lm, pal); break;
        case 'brook': drawBrook(lm, pal); break;
        case 'harzView': drawHarzView(lm, pal); break;
        case 'sunsetHills': drawSunsetHills(lm, pal); break;
        case 'finaleBench': drawFinaleBench(lm, pal); break;
        default: drawCustomLandmark(lm, pal);
    }
}

// --- Prag ---
function drawPragHouses(lm, pal) {
    const base = lm.y + 10;
    let x = lm.x;
    let i = 0;
    while (x < lm.x + lm.w) {
        const w = 78 + ((i * 37) % 46);
        const h = lm.h * (0.55 + ((i * 53) % 40) / 100);
        const body = i % 2 ? pal.far : pal.mid;
        ctx.fillStyle = body;
        ctx.fillRect(x, base - h, w, h);
        // Dach
        ctx.fillStyle = pal.platformDark;
        ctx.beginPath();
        ctx.moveTo(x - 6, base - h);
        ctx.lineTo(x + w / 2, base - h - 26);
        ctx.lineTo(x + w + 6, base - h);
        ctx.closePath();
        ctx.fill();
        // Fenster mit warmem Licht
        ctx.fillStyle = 'rgba(255,206,140,0.75)';
        for (let wy = base - h + 26; wy < base - 24; wy += 34) {
            for (let wx = x + 12; wx < x + w - 14; wx += 26) {
                if ((wx + wy) % 3 === 0) continue;
                ctx.fillRect(wx, wy, 11, 15);
            }
        }
        x += w + 6;
        i++;
    }
}

function drawPragTower(lm, pal) {
    const base = lm.y + 10;
    const w = lm.w;
    ctx.fillStyle = pal.far;
    ctx.fillRect(lm.x, base - lm.h, w, lm.h);
    ctx.fillStyle = pal.mid;
    ctx.fillRect(lm.x, base - lm.h, w * 0.35, lm.h);
    // Spitzdach
    ctx.fillStyle = pal.platformDark;
    ctx.beginPath();
    ctx.moveTo(lm.x - 10, base - lm.h);
    ctx.lineTo(lm.x + w / 2, base - lm.h - 70);
    ctx.lineTo(lm.x + w + 10, base - lm.h);
    ctx.closePath();
    ctx.fill();
    // Turmuhr
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(lm.x + w / 2, base - lm.h + 58, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lm.x + w / 2, base - lm.h + 58);
    ctx.lineTo(lm.x + w / 2 + 10, base - lm.h + 52);
    ctx.moveTo(lm.x + w / 2, base - lm.h + 58);
    ctx.lineTo(lm.x + w / 2, base - lm.h + 45);
    ctx.stroke();
    // Fenster
    ctx.fillStyle = 'rgba(255,206,140,0.7)';
    for (let y = base - lm.h + 100; y < base - 40; y += 46) {
        ctx.fillRect(lm.x + w / 2 - 8, y, 16, 24);
    }
}

function drawPragBridge(lm, pal) {
    const deck = lm.y;

    // Steinerne Brückenwand unterhalb der Fahrbahn, mit durchscheinenden Bögen.
    // (Wird über den Boden gezeichnet, damit die Brücke als Bauwerk lesbar ist.)
    ctx.fillStyle = '#8f8b99';
    ctx.fillRect(lm.x, deck + 16, lm.w, 210);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = deck + 40; y < deck + 220; y += 26) ctx.fillRect(lm.x, y, lm.w, 2);

    // Bögen als Öffnungen: dahinter sieht man den Abendhimmel
    for (let x = lm.x + 60; x < lm.x + lm.w - 120; x += 210) {
        const grad = ctx.createLinearGradient(0, deck + 40, 0, deck + 200);
        grad.addColorStop(0, pal.sky[1]);
        grad.addColorStop(1, pal.sky[2]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x + 70, deck + 120, 62, Math.PI, 0);
        ctx.fillRect(x + 8, deck + 120, 124, 106);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + 70, deck + 120, 62, Math.PI, 0);
        ctx.stroke();
    }

    // Brüstung mit Pfosten
    ctx.fillStyle = pal.earth[0];
    ctx.fillRect(lm.x, deck - 46, lm.w, 12);
    for (let x = lm.x + 10; x < lm.x + lm.w - 10; x += 42) {
        ctx.fillRect(x, deck - 44, 8, 44);
    }

    // Statuen auf der Brüstung
    ctx.fillStyle = pal.earth[1];
    for (let x = lm.x + 120; x < lm.x + lm.w - 80; x += 240) {
        ctx.fillRect(x - 9, deck - 92, 18, 46);
        ctx.beginPath();
        ctx.arc(x, deck - 100, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 14, deck - 78, 28, 8);
    }
}

function drawPragSpires(lm, pal) {
    const base = lm.y;
    ctx.fillStyle = pal.mid;
    for (let i = 0; i < 3; i++) {
        const x = lm.x + 50 + i * 105;
        const h = lm.h * (0.7 + i * 0.12);
        ctx.fillRect(x, base - h, 44, h);
        ctx.fillStyle = pal.platformDark;
        ctx.beginPath();
        ctx.moveTo(x - 8, base - h);
        ctx.lineTo(x + 22, base - h - 58);
        ctx.lineTo(x + 52, base - h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.mid;
    }
}

// --- Restaurants (italienisch & afrikanisch) ---
function drawRestaurantWall(lm, pal, patterned) {
    const base = lm.y + 8;
    ctx.fillStyle = pal.far;
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);

    if (patterned) {
        // Dezentes, abstraktes Zickzack-Band als Wandschmuck
        ctx.strokeStyle = 'rgba(255,220,170,0.32)';
        ctx.lineWidth = 4;
        const bandY = base - lm.h * 0.62;
        ctx.beginPath();
        for (let x = lm.x; x < lm.x + lm.w; x += 26) {
            ctx.lineTo(x, bandY);
            ctx.lineTo(x + 13, bandY - 12);
        }
        ctx.stroke();
    } else {
        // Holzvertäfelung
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = lm.x; x < lm.x + lm.w; x += 54) ctx.fillRect(x, base - lm.h, 3, lm.h);
        ctx.fillStyle = pal.mid;
        ctx.fillRect(lm.x, base - lm.h * 0.34, lm.w, 10);
    }

    // Fenster mit Abendlicht
    for (let x = lm.x + 70; x < lm.x + lm.w - 90; x += 230) {
        ctx.fillStyle = 'rgba(40,25,20,0.55)';
        ctx.beginPath();
        ctx.roundRect(x, base - lm.h * 0.82, 86, 96, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,196,120,0.5)';
        ctx.beginPath();
        ctx.roundRect(x + 8, base - lm.h * 0.82 + 8, 70, 80, 8);
        ctx.fill();
    }
}

function drawHangingLamps(lm, pal, glowColor) {
    for (let i = 0; i < 4; i++) {
        const x = lm.x + 60 + i * (lm.w / 4);
        const sway = Math.sin(state.time * 0.02 + i + lm.phase) * 4;
        const topY = lm.y - lm.h;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x + sway, topY + 54);
        ctx.stroke();
        // Schirm - bewusst warm, nicht in der Akzentfarbe des Kapitels
        ctx.fillStyle = '#c98a4a';
        ctx.beginPath();
        ctx.moveTo(x + sway - 17, topY + 74);
        ctx.lineTo(x + sway, topY + 52);
        ctx.lineTo(x + sway + 17, topY + 74);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,235,190,0.9)';
        ctx.beginPath();
        ctx.ellipse(x + sway, topY + 76, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Lichtschein
        const glow = ctx.createRadialGradient(x + sway, topY + 84, 2, x + sway, topY + 84, 54);
        glow.addColorStop(0, glowColor);
        glow.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = glow;
        ctx.fillRect(x + sway - 54, topY + 30, 108, 108);
        ctx.globalAlpha = 1;
    }
}

function drawSpecialTable(lm, pal, style) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;

    // Zwei Stühle
    ctx.fillStyle = pal.platformDark;
    ctx.fillRect(cx - 96, base - 54, 12, 54);
    ctx.fillRect(cx - 104, base - 58, 30, 8);
    ctx.fillRect(cx + 84, base - 54, 12, 54);
    ctx.fillRect(cx + 74, base - 58, 30, 8);

    // Tisch
    ctx.fillStyle = pal.platformBody;
    ctx.beginPath();
    ctx.roundRect(cx - 68, base - 62, 136, 14, 6);
    ctx.fill();
    ctx.fillStyle = pal.platformDark;
    ctx.fillRect(cx - 8, base - 48, 16, 48);
    ctx.fillRect(cx - 32, base - 6, 64, 8);

    if (style === 'italien') {
        // Kerze und zwei Gläser
        ctx.fillStyle = '#f3e6cf';
        ctx.fillRect(cx - 4, base - 88, 8, 26);
        ctx.fillStyle = '#ffcf6a';
        ctx.beginPath();
        ctx.ellipse(cx, base - 92 + Math.sin(state.time * 0.15) * 1.5, 5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(220,235,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(cx - 44, base - 62); ctx.lineTo(cx - 32, base - 62); ctx.lineTo(cx - 38, base - 84); ctx.closePath();
        ctx.moveTo(cx + 32, base - 62); ctx.lineTo(cx + 44, base - 62); ctx.lineTo(cx + 38, base - 84); ctx.closePath();
        ctx.fill();
    } else {
        // Gemeinsame Schale in der Mitte
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.ellipse(cx, base - 66, 34, 12, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#c9713a';
        ctx.beginPath();
        ctx.ellipse(cx, base - 68, 26, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // aufsteigender Dampf
        ctx.strokeStyle = 'rgba(255,235,200,0.4)';
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(cx + i * 12, base - 76);
            ctx.quadraticCurveTo(cx + i * 12 + Math.sin(state.time * 0.05 + i) * 8, base - 96, cx + i * 12, base - 116);
            ctx.stroke();
        }
    }
}

// --- Marokko ---
function drawAtlas(lm, pal) {
    const base = lm.y + 40;
    ctx.fillStyle = pal.far;
    for (let i = 0; i < 5; i++) {
        const x = lm.x + i * (lm.w / 5);
        const h = lm.h * (0.5 + ((i * 41) % 50) / 100);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + lm.w / 10, base - h);
        ctx.lineTo(x + lm.w / 5, base);
        ctx.closePath();
        ctx.fill();
    }
}

function drawDunes(lm, pal) {
    const base = lm.y + 30;
    ctx.fillStyle = pal.mid;
    ctx.beginPath();
    ctx.moveTo(lm.x, base);
    for (let x = 0; x <= lm.w; x += 40) {
        ctx.lineTo(lm.x + x, base - lm.h * (0.5 + 0.5 * Math.sin(x * 0.006 + lm.phase)));
    }
    ctx.lineTo(lm.x + lm.w, base);
    ctx.closePath();
    ctx.fill();
}

function drawOasis(lm, pal) {
    const base = lm.y;
    const poolX = lm.x + lm.w * 0.5;
    // Der Teich liegt HINTER dem Laufweg (etwas höher gezeichnet), sonst sieht
    // es aus, als würde man mitten im Wasser stehen.
    const poolY = base - 30;

    // Sandiger Rand
    ctx.fillStyle = '#e8cb96';
    ctx.beginPath();
    ctx.ellipse(poolX, poolY + 2, lm.w * 0.27, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wasser
    ctx.fillStyle = '#3f8f9e';
    ctx.beginPath();
    ctx.ellipse(poolX, poolY, lm.w * 0.24, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 3; i++) {
        const w = 26 + i * 12;
        ctx.fillRect(poolX - w / 2 + Math.sin(state.time * 0.03 + i) * 6, poolY - 4 + i * 4, w, 2);
    }
    // Palmen links und rechts
    drawPalm(lm.x + 60, base, 1.15);
    drawPalm(lm.x + lm.w - 70, base, 0.95);
}

function drawPalm(x, groundY, scale) {
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.quadraticCurveTo(x + 10 * scale, groundY - 60 * scale, x + 4 * scale, groundY - 110 * scale);
    ctx.stroke();
    ctx.fillStyle = '#4f8f52';
    for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        ctx.save();
        ctx.translate(x + 4 * scale, groundY - 110 * scale);
        ctx.rotate(a + Math.sin(state.time * 0.02 + i) * 0.05);
        ctx.beginPath();
        ctx.ellipse(0, 22 * scale, 12 * scale, 34 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawKasbah(lm, pal) {
    const base = lm.y + 6;
    let x = lm.x;
    let i = 0;
    while (x < lm.x + lm.w) {
        const w = 96 + ((i * 43) % 60);
        const h = lm.h * (0.5 + ((i * 29) % 45) / 100);
        ctx.fillStyle = i % 2 ? pal.far : pal.mid;
        ctx.fillRect(x, base - h, w, h);
        // Zinnen
        ctx.fillStyle = pal.far;
        for (let cx2 = x; cx2 < x + w - 8; cx2 += 20) ctx.fillRect(cx2, base - h - 10, 12, 10);
        // Türbogen
        ctx.fillStyle = 'rgba(60,35,20,0.45)';
        ctx.beginPath();
        ctx.arc(x + w / 2, base - 30, 16, Math.PI, 0);
        ctx.fillRect(x + w / 2 - 16, base - 30, 32, 30);
        ctx.fill();
        x += w + 8;
        i++;
    }
}

function drawCourtyard(lm, pal) {
    const base = lm.y;
    ctx.fillStyle = pal.far;
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    // Hufeisenbögen
    ctx.fillStyle = pal.mid;
    for (let i = 0; i < 3; i++) {
        const x = lm.x + 50 + i * (lm.w / 3);
        ctx.beginPath();
        ctx.arc(x, base - 70, 34, Math.PI, 0);
        ctx.fillRect(x - 34, base - 70, 68, 70);
        ctx.fill();
        ctx.fillStyle = 'rgba(40,25,15,0.4)';
        ctx.beginPath();
        ctx.arc(x, base - 66, 24, Math.PI, 0);
        ctx.fillRect(x - 24, base - 66, 48, 66);
        ctx.fill();
        ctx.fillStyle = pal.mid;
    }
}

function drawRoofTerrace(lm, pal) {
    const base = lm.y;
    // Geländer
    ctx.fillStyle = pal.earth[0];
    ctx.fillRect(lm.x, base - 52, lm.w, 10);
    for (let x = lm.x + 8; x < lm.x + lm.w - 8; x += 34) ctx.fillRect(x, base - 50, 7, 50);
    // Teppich und Kissen
    ctx.fillStyle = pal.platformBody;
    ctx.beginPath();
    ctx.roundRect(lm.x + lm.w * 0.3, base - 14, 140, 12, 5);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect(lm.x + lm.w * 0.34, base - 32, 46, 20, 8);
    ctx.roundRect(lm.x + lm.w * 0.34 + 60, base - 30, 46, 18, 8);
    ctx.fill();
}

// --- Harz ---
function drawFirForest(lm, pal) {
    const base = lm.y + 30;
    let x = lm.x;
    let i = 0;
    while (x < lm.x + lm.w) {
        const h = lm.h * (0.55 + ((i * 37) % 45) / 100);
        const w = h * 0.42;
        ctx.fillStyle = i % 2 ? pal.far : pal.mid;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + w / 2, base - h);
        ctx.lineTo(x + w, base);
        ctx.closePath();
        ctx.fill();
        x += w * 0.62;
        i++;
    }
}

function drawHarzRocks(lm, pal) {
    const base = lm.y + 10;
    ctx.fillStyle = pal.far;
    for (let i = 0; i < 4; i++) {
        const x = lm.x + i * (lm.w / 4);
        const h = lm.h * (0.4 + ((i * 31) % 55) / 100);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + 30, base - h);
        ctx.lineTo(x + 78, base - h * 0.72);
        ctx.lineTo(x + 120, base);
        ctx.closePath();
        ctx.fill();
    }
}

function drawBrook(lm, pal) {
    const surface = lm.y + 66;
    ctx.fillStyle = '#5f93a8';
    ctx.fillRect(lm.x, surface, lm.w, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 8; i++) {
        const x = lm.x + 20 + i * (lm.w / 8);
        const w = 26 + Math.sin(state.time * 0.05 + i) * 8;
        ctx.fillRect(x, surface + 8 + (i % 3) * 12, w, 3);
    }
}

function drawHarzView(lm, pal) {
    const base = lm.y;
    // Nebelbank unterhalb des Aussichtspunkts
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 3; i++) {
        const y = base + 40 + i * 26;
        const off = Math.sin(state.time * 0.01 + i) * 20;
        ctx.beginPath();
        ctx.ellipse(lm.x + lm.w / 2 + off, y, lm.w * 0.55, 16, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    // Wegweiser
    ctx.fillStyle = pal.platformDark;
    ctx.fillRect(lm.x + lm.w - 90, base - 96, 9, 96);
    ctx.fillStyle = pal.platformBody;
    ctx.beginPath();
    ctx.roundRect(lm.x + lm.w - 140, base - 96, 60, 20, 4);
    ctx.roundRect(lm.x + lm.w - 132, base - 70, 56, 18, 4);
    ctx.fill();
}

// --- Finale ---
function drawSunsetHills(lm, pal) {
    const base = lm.y + 50;
    ctx.fillStyle = pal.far;
    ctx.beginPath();
    ctx.moveTo(lm.x, base);
    for (let x = 0; x <= lm.w; x += 60) {
        ctx.lineTo(lm.x + x, base - lm.h * (0.45 + 0.4 * Math.sin(x * 0.004 + lm.phase)));
    }
    ctx.lineTo(lm.x + lm.w, base);
    ctx.closePath();
    ctx.fill();
}

function drawFinaleBench(lm, pal) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    // Bank
    ctx.fillStyle = '#8a6540';
    ctx.fillRect(cx - 60, base - 26, 120, 10);
    ctx.fillRect(cx - 60, base - 56, 120, 8);
    ctx.fillStyle = '#6b4c2f';
    ctx.fillRect(cx - 54, base - 26, 8, 26);
    ctx.fillRect(cx + 46, base - 26, 8, 26);
    ctx.fillRect(cx - 54, base - 58, 8, 34);
    ctx.fillRect(cx + 46, base - 58, 8, 34);
    // Herzballons
    for (let i = 0; i < 3; i++) {
        const x = cx - 60 + i * 60;
        const y = base - 130 - Math.sin(state.time * 0.03 + i) * 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x, base - 60);
        ctx.stroke();
        ctx.fillStyle = i % 2 ? '#ff6d8b' : '#ffd0dc';
        heartPath(x, y, 13);
        ctx.fill();
    }
}


/* --- Tiefe in den Löchern --- */
function drawPits() {
    for (const pit of level.pits) {
        if (pit.x2 < camera.x - 60 || pit.x1 > camera.x + viewWidth + 60) continue;
        if (pit.look && drawCustomPit(pit)) continue;
        const pal = paletteOf(pit);
        const grad = ctx.createLinearGradient(0, pit.y, 0, pit.y + 300);
        grad.addColorStop(0, pal.pit[0]);
        grad.addColorStop(0.25, pal.pit[1]);
        grad.addColorStop(1, pal.pit[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(pit.x1, pit.y, pit.x2 - pit.x1, 900);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(pit.x1, pit.y, 10, 900);
        ctx.fillRect(pit.x2 - 10, pit.y, 10, 900);
    }
}


/* --- Boden: jedes Biom hat eine eigene Oberfläche --- */

function drawTerrain() {
    for (const block of level.terrain) {
        if (block.x + block.w < camera.x - 60 || block.x > camera.x + viewWidth + 60) continue;
        const pal = paletteOf(block);

        // Untergrund mit Tiefenverlauf
        const depth = Math.min(block.h, viewHeight + 300);
        const earth = ctx.createLinearGradient(0, block.y, 0, block.y + depth);
        earth.addColorStop(0, pal.earth[0]);
        earth.addColorStop(0.35, pal.earth[1]);
        earth.addColorStop(1, pal.earth[2]);
        ctx.fillStyle = earth;
        ctx.fillRect(block.x, block.y, block.w, depth);
        if (block.body === 'house') drawHouseBody(block, depth);

        drawGroundSurface(block, pal);
    }
}

function drawGroundSurface(block, pal) {
    const x = block.x;
    const y = block.y;
    const w = block.w;

    if (block.surface && drawCustomSurface(block, pal)) return;

    switch (pal.ground) {
        case 'cobble': {
            // Kopfsteinpflaster
            ctx.fillStyle = pal.surfaceEdge;
            ctx.fillRect(x, y, w, 16);
            ctx.fillStyle = pal.surfaceTop;
            for (let sx = x + 2; sx < x + w - 2; sx += 20) {
                const off = (Math.floor(sx / 20) % 2) * 4;
                ctx.beginPath();
                ctx.roundRect(sx, y + 1 + off * 0.4, 16, 10, 4);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            for (let sx = x + 10; sx < x + w; sx += 40) ctx.fillRect(sx, y + 16, 22, 3);
            break;
        }
        case 'planks': {
            // Dielenboden
            ctx.fillStyle = pal.surfaceTop;
            ctx.fillRect(x, y, w, 15);
            ctx.fillStyle = pal.surfaceEdge;
            ctx.fillRect(x, y + 12, w, 4);
            ctx.strokeStyle = 'rgba(60,35,20,0.35)';
            ctx.lineWidth = 1.5;
            for (let sx = x + 30; sx < x + w; sx += 62) {
                ctx.beginPath();
                ctx.moveTo(sx, y);
                ctx.lineTo(sx, y + 14);
                ctx.stroke();
            }
            break;
        }
        case 'clay': {
            // Glatter, warmer Lehmboden mit dezentem Muster
            ctx.fillStyle = pal.surfaceTop;
            ctx.fillRect(x, y, w, 14);
            ctx.fillStyle = pal.surfaceEdge;
            ctx.fillRect(x, y + 11, w, 5);
            ctx.strokeStyle = 'rgba(255,225,180,0.16)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let sx = x; sx < x + w; sx += 34) {
                ctx.lineTo(sx, y + 24);
                ctx.lineTo(sx + 17, y + 28);
            }
            ctx.stroke();
            break;
        }
        case 'sand': {
            // Sand: weiche Kante, feine Körnung
            ctx.fillStyle = pal.surfaceTop;
            ctx.beginPath();
            ctx.moveTo(x, y + 14);
            for (let sx = 0; sx <= w; sx += 30) {
                ctx.lineTo(x + sx, y + Math.sin((x + sx) * 0.02) * 2);
            }
            ctx.lineTo(x + w, y + 14);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            for (let sx = x + 8; sx < x + w; sx += 26) {
                ctx.fillRect(sx, y + 8 + ((sx / 26) % 3) * 5, 5, 2);
            }
            break;
        }
        case 'moss': {
            // Waldboden mit Moos und Gras
            ctx.fillStyle = pal.surfaceEdge;
            ctx.fillRect(x, y, w, 15);
            ctx.fillStyle = pal.surfaceTop;
            ctx.fillRect(x, y, w, 8);
            ctx.fillStyle = pal.surfaceTop;
            for (let sx = x + 4; sx < x + w - 4; sx += 15) {
                const hgt = 5 + ((sx * 7) % 6);
                ctx.fillRect(sx, y - hgt, 3, hgt);
            }
            ctx.fillStyle = 'rgba(120,170,90,0.5)';
            for (let sx = x + 12; sx < x + w; sx += 44) {
                ctx.beginPath();
                ctx.ellipse(sx, y + 4, 12, 5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }
        default: {
            // Wiese
            ctx.fillStyle = pal.surfaceEdge;
            ctx.fillRect(x, y, w, 14);
            ctx.fillStyle = pal.surfaceTop;
            ctx.fillRect(x, y, w, 6);
            ctx.fillStyle = pal.surfaceTop;
            for (let sx = x + 4; sx < x + w - 4; sx += 17) {
                const hgt = 5 + ((sx * 7) % 5);
                ctx.fillRect(sx, y - hgt, 3, hgt);
            }
        }
    }
}


/* --- Plattformen in Biom-Form --- */

function drawPlatform(p) {
    const pal = paletteOf(p);
    const look = p.look || pal.platform;
    if (p.crumbleState === 'gone') return;

    // Plattformen im Takt: unsichtbar = nur ein Schatten, kurz vorher blinken
    let alpha = 1;
    if (p.timed) {
        const phase = timedPhase(p);
        if (phase === 'off') alpha = 0.16;
        else if (phase === 'blink') alpha = Math.floor(state.time / 5) % 2 ? 0.35 : 1;
    }
    const bob = p.axis && !NO_BOB_LOOKS.has(look) ? Math.sin(state.time * 0.08 + p.phase) * 0.6 : 0;
    const shake = p.crumbleState === 'shaking' ? Math.sin(state.time * 1.7) * 1.6 : 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(shake, bob);

    if (drawPlatformLook(p, look, pal)) {
        ctx.restore();
        return;
    }

    switch (look) {
        case 'roof': {
            // Ziegeldach
            ctx.fillStyle = pal.platformBody;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
            ctx.strokeStyle = 'rgba(60,25,20,0.35)';
            ctx.lineWidth = 1.5;
            for (let x = p.x + 8; x < p.x + p.w; x += 14) {
                ctx.beginPath();
                ctx.arc(x, p.y + 2, 6, Math.PI, 0);
                ctx.stroke();
            }
            break;
        }
        case 'table': {
            // Tischplatte mit Decke
            ctx.fillStyle = pal.platformBody;
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.w, p.h, 5);
            ctx.fill();
            ctx.fillStyle = '#b9453f';
            for (let x = p.x + 6; x < p.x + p.w - 6; x += 18) ctx.fillRect(x, p.y + p.h - 5, 9, 5);
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(p.x + p.w / 2 - 7, p.y + p.h, 14, 26);
            break;
        }
        case 'tray': {
            // Servierplatte mit Rand
            ctx.fillStyle = pal.platformBody;
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.w, p.h, 7);
            ctx.fill();
            ctx.strokeStyle = pal.platformDark;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(p.x + 2, p.y + 1.5, p.w - 4, p.h - 3, 6);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(p.x + 10, p.y + 3, p.w - 20, 2);
            break;
        }
        case 'stall': {
            // Marktstand mit gestreifter Markise
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(p.x, p.y + p.h - 5, p.w, 5);
            for (let i = 0; i * 18 < p.w; i++) {
                ctx.fillStyle = i % 2 ? pal.platformBody : '#f0e0c8';
                ctx.fillRect(p.x + i * 18, p.y, Math.min(18, p.w - i * 18), p.h - 4);
            }
            break;
        }
        case 'log': {
            // Baumstamm mit Jahresringen
            ctx.fillStyle = pal.platformBody;
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.w, p.h + 4, 7);
            ctx.fill();
            ctx.fillStyle = pal.platformDark;
            ctx.beginPath();
            ctx.ellipse(p.x + 6, p.y + p.h / 2 + 2, 6, p.h / 2 + 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,235,200,0.3)';
            ctx.lineWidth = 1.5;
            for (let i = 1; i <= 2; i++) {
                ctx.beginPath();
                ctx.ellipse(p.x + 6, p.y + p.h / 2 + 2, 2 * i, (p.h / 2) * (i / 2.4), 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            break;
        }
        case 'stone': {
            // Trittstein im Bach
            ctx.fillStyle = '#8e8e94';
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.w, p.h + 6, 8);
            ctx.fill();
            ctx.fillStyle = '#a8a8ae';
            ctx.beginPath();
            ctx.roundRect(p.x + 4, p.y + 1, p.w - 8, 6, 4);
            ctx.fill();
            ctx.fillStyle = 'rgba(110,160,90,0.55)';
            ctx.fillRect(p.x + 8, p.y, 16, 3);
            break;
        }
        default: {
            // Einfaches Brett
            ctx.fillStyle = pal.platformBody;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(p.x, p.y, p.w, 3);
        }
    }

    // Bewegliche Plattformen bekommen einen kleinen Hinweis
    if (p.axis) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        if (p.axis === 'y') {
            ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx - 5, cy - 6); ctx.lineTo(cx + 5, cy - 6); ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.lineTo(cx - 5, cy + 6); ctx.lineTo(cx + 5, cy + 6); ctx.fill();
        } else {
            ctx.beginPath(); ctx.moveTo(p.x - 8, cy); ctx.lineTo(p.x - 2, cy - 5); ctx.lineTo(p.x - 2, cy + 5); ctx.fill();
            ctx.beginPath(); ctx.moveTo(p.x + p.w + 8, cy); ctx.lineTo(p.x + p.w + 2, cy - 5); ctx.lineTo(p.x + p.w + 2, cy + 5); ctx.fill();
        }
    }
    ctx.restore();
}


/* --- Hindernisse in Biom-Form --- */

function drawObstacle(o) {
    const pal = paletteOf(o);
    if (o.kind === 'thorn') {
        if (!drawCustomHazard(o, o.look)) drawHazard(o, pal);
    } else if (o.kind === 'crate') {
        if (!drawCustomProp(o, pal)) drawSolidProp(o, pal);
    } else if (o.kind === 'branch') {
        if (!drawCustomOverhang(o)) drawOverhang(o, pal);
    } else if (o.kind === 'wall') {
        drawWallBlock(o, pal);
    }
}

function drawHazard(o, pal) {
    const flicker = 0.75 + Math.sin(state.time * 0.25 + o.x) * 0.25;
    switch (o.look || pal.hazard) {
        case 'fire': {
            // Feuerschale
            ctx.fillStyle = '#5a5560';
            ctx.beginPath();
            ctx.ellipse(o.x + o.w / 2, o.y + o.h - 4, o.w / 2, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(o.x + o.w / 2 - 4, o.y + o.h - 10, 8, 10);
            ctx.fillStyle = `rgba(255,140,40,${flicker})`;
            ctx.beginPath();
            ctx.moveTo(o.x + 6, o.y + o.h - 8);
            ctx.quadraticCurveTo(o.x + o.w / 2, o.y - 8 * flicker, o.x + o.w - 6, o.y + o.h - 8);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = `rgba(255,225,140,${flicker})`;
            ctx.beginPath();
            ctx.ellipse(o.x + o.w / 2, o.y + o.h - 14, 5, 9 * flicker, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'pan': {
            // Heiße Pfanne auf dem Boden
            ctx.fillStyle = '#3a3a42';
            ctx.beginPath();
            ctx.roundRect(o.x, o.y + o.h - 12, o.w, 12, 5);
            ctx.fill();
            ctx.fillRect(o.x + o.w - 6, o.y + o.h - 12, 18, 4);
            ctx.fillStyle = `rgba(255,150,60,${flicker * 0.8})`;
            ctx.beginPath();
            ctx.ellipse(o.x + o.w / 2, o.y + o.h - 14, o.w * 0.35, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(255,235,200,${0.25 + flicker * 0.2})`;
            ctx.lineWidth = 3;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(o.x + o.w / 2 + i * 10, o.y + o.h - 20);
                ctx.quadraticCurveTo(o.x + o.w / 2 + i * 10 + 6, o.y - 4, o.x + o.w / 2 + i * 10, o.y - 18);
                ctx.stroke();
            }
            break;
        }
        case 'pot': {
            // Heißer Topf über kleiner Flamme
            ctx.fillStyle = `rgba(255,150,50,${flicker})`;
            ctx.beginPath();
            ctx.ellipse(o.x + o.w / 2, o.y + o.h - 3, o.w * 0.3, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a3a30';
            ctx.beginPath();
            ctx.roundRect(o.x + 4, o.y + 2, o.w - 8, o.h - 10, 6);
            ctx.fill();
            ctx.fillStyle = '#6b5445';
            ctx.fillRect(o.x, o.y, o.w, 6);
            ctx.strokeStyle = 'rgba(255,235,200,0.35)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(o.x + o.w / 2, o.y - 2);
            ctx.quadraticCurveTo(o.x + o.w / 2 + Math.sin(state.time * 0.05) * 8, o.y - 18, o.x + o.w / 2, o.y - 32);
            ctx.stroke();
            break;
        }
        case 'cactus': {
            ctx.fillStyle = '#4f8f52';
            ctx.beginPath();
            ctx.roundRect(o.x + o.w / 2 - 7, o.y, 14, o.h, 7);
            ctx.roundRect(o.x + 2, o.y + 8, 8, 14, 4);
            ctx.roundRect(o.x + o.w - 10, o.y + 6, 8, 16, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const y = o.y + 5 + i * 5;
                ctx.beginPath();
                ctx.moveTo(o.x + o.w / 2 - 9, y); ctx.lineTo(o.x + o.w / 2 - 12, y - 2);
                ctx.moveTo(o.x + o.w / 2 + 9, y); ctx.lineTo(o.x + o.w / 2 + 12, y - 2);
                ctx.stroke();
            }
            break;
        }
        default: {
            // Dornbusch
            ctx.fillStyle = '#3f7d33';
            ctx.beginPath();
            ctx.ellipse(o.x + o.w / 2, o.y + o.h, o.w / 2, o.h * 0.75, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#2e5f26';
            for (let i = 0; i < 5; i++) {
                const tx = o.x + 4 + i * (o.w / 6);
                ctx.beginPath();
                ctx.moveTo(tx, o.y + o.h);
                ctx.lineTo(tx + 3, o.y + 2 + (i % 2) * 5);
                ctx.lineTo(tx + 6, o.y + o.h);
                ctx.fill();
            }
            ctx.fillStyle = '#c9506a';
            ctx.beginPath();
            ctx.arc(o.x + 8, o.y + o.h - 7, 3, 0, Math.PI * 2);
            ctx.arc(o.x + o.w - 9, o.y + o.h - 10, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawSolidProp(o, pal) {
    switch (o.look || pal.crate) {
        case 'marketCrate': {
            ctx.fillStyle = '#b98a52';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.strokeStyle = '#7d5a33';
            ctx.lineWidth = 3;
            ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
            ctx.fillStyle = '#c9503f';
            ctx.beginPath();
            ctx.arc(o.x + 12, o.y - 6, 7, 0, Math.PI * 2);
            ctx.arc(o.x + 26, o.y - 5, 6, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'chair': {
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(o.x + 4, o.y + o.h - 26, o.w - 8, 7);
            ctx.fillRect(o.x + 6, o.y + o.h - 20, 6, 20);
            ctx.fillRect(o.x + o.w - 12, o.y + o.h - 20, 6, 20);
            ctx.fillStyle = pal.platformBody;
            ctx.beginPath();
            ctx.roundRect(o.x + 4, o.y, o.w - 8, o.h - 24, 4);
            ctx.fill();
            break;
        }
        case 'stool': {
            ctx.fillStyle = pal.accent;
            ctx.beginPath();
            ctx.ellipse(o.x + o.w / 2, o.y + 6, o.w / 2, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(o.x + 6, o.y + 6, 6, o.h - 6);
            ctx.fillRect(o.x + o.w - 12, o.y + 6, 6, o.h - 6);
            break;
        }
        case 'basket': {
            ctx.fillStyle = '#c99a5c';
            ctx.beginPath();
            ctx.moveTo(o.x + 4, o.y + o.h);
            ctx.lineTo(o.x, o.y);
            ctx.lineTo(o.x + o.w, o.y);
            ctx.lineTo(o.x + o.w - 4, o.y + o.h);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(110,75,35,0.5)';
            ctx.lineWidth = 2;
            for (let y = o.y + 8; y < o.y + o.h; y += 9) {
                ctx.beginPath();
                ctx.moveTo(o.x + 2, y); ctx.lineTo(o.x + o.w - 2, y);
                ctx.stroke();
            }
            break;
        }
        case 'rock': {
            ctx.fillStyle = '#8e8e94';
            ctx.beginPath();
            ctx.moveTo(o.x, o.y + o.h);
            ctx.lineTo(o.x + 6, o.y + 6);
            ctx.lineTo(o.x + o.w * 0.55, o.y);
            ctx.lineTo(o.x + o.w, o.y + 10);
            ctx.lineTo(o.x + o.w, o.y + o.h);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath();
            ctx.moveTo(o.x + 8, o.y + 8);
            ctx.lineTo(o.x + o.w * 0.55, o.y + 2);
            ctx.lineTo(o.x + o.w * 0.5, o.y + 14);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(110,160,90,0.5)';
            ctx.fillRect(o.x + 6, o.y + 4, 14, 4);
            break;
        }
        default: {
            ctx.fillStyle = '#c08b52';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.strokeStyle = '#8a5c33';
            ctx.lineWidth = 3;
            ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
        }
    }
}

function drawOverhang(o, pal) {
    switch (pal.duck) {
        case 'awning': {
            // Markise über der Gasse
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(o.x, o.y, o.w, 6);
            for (let i = 0; i * 22 < o.w; i++) {
                ctx.fillStyle = i % 2 ? pal.platformBody : '#f2e3cc';
                ctx.fillRect(o.x + i * 22, o.y + 6, Math.min(22, o.w - i * 22), o.h - 6);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(o.x, o.y + o.h - 4, o.w, 4);
            break;
        }
        case 'shelf': {
            // Regalbrett mit Flaschen
            ctx.fillStyle = pal.platformDark;
            ctx.fillRect(o.x, o.y + o.h - 8, o.w, 8);
            ctx.fillStyle = '#4a6b3a';
            for (let x = o.x + 14; x < o.x + o.w - 10; x += 26) {
                ctx.fillRect(x, o.y + 2, 9, o.h - 10);
                ctx.fillRect(x + 2, o.y - 6, 5, 8);
            }
            break;
        }
        case 'archway': {
            // Niedriger Durchgang
            ctx.fillStyle = pal.earth[1];
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = pal.accent;
            ctx.fillRect(o.x, o.y + o.h - 5, o.w, 5);
            ctx.strokeStyle = 'rgba(255,225,180,0.35)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let x = o.x + 6; x < o.x + o.w; x += 20) {
                ctx.lineTo(x, o.y + 8);
                ctx.lineTo(x + 10, o.y + 16);
            }
            ctx.stroke();
            break;
        }
        default: {
            // Ast mit Blättern
            ctx.fillStyle = '#7a5230';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#5f3f24';
            ctx.fillRect(o.x, o.y + o.h - 5, o.w, 5);
            ctx.fillStyle = '#4f8f46';
            for (let x = o.x + 10; x < o.x + o.w - 6; x += 30) {
                ctx.beginPath();
                ctx.ellipse(x, o.y - 4, 16, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}


/* --- Bodenschmuck je Biom --- */

function drawDecor(d) {
    const pal = paletteOf(d);
    const sway = Math.sin(state.time * 0.03 + d.phase) * 2;
    const s = d.scale;

    switch (d.kind) {
        case 'lantern': {
            ctx.fillStyle = '#4a4550';
            ctx.fillRect(d.x - 2, d.y - 54 * s, 4, 54 * s);
            ctx.fillStyle = pal.accent;
            ctx.beginPath();
            ctx.roundRect(d.x - 8 * s, d.y - 72 * s, 16 * s, 20 * s, 4);
            ctx.fill();
            const glow = ctx.createRadialGradient(d.x, d.y - 62 * s, 2, d.x, d.y - 62 * s, 40);
            glow.addColorStop(0, 'rgba(255,210,140,0.55)');
            glow.addColorStop(1, 'rgba(255,210,140,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(d.x - 40, d.y - 102 * s, 80, 80);
            break;
        }
        case 'sign': {
            ctx.fillStyle = '#5a4636';
            ctx.fillRect(d.x - 2, d.y - 40 * s, 4, 40 * s);
            ctx.fillStyle = pal.platformBody;
            ctx.beginPath();
            ctx.roundRect(d.x - 20 * s, d.y - 58 * s, 40 * s, 18 * s, 3);
            ctx.fill();
            break;
        }
        case 'window': {
            ctx.fillStyle = 'rgba(255,206,140,0.35)';
            ctx.beginPath();
            ctx.roundRect(d.x - 12 * s, d.y - 46 * s, 24 * s, 30 * s, 4);
            ctx.fill();
            break;
        }
        case 'pigeon': {
            const hop = Math.abs(Math.sin(state.time * 0.04 + d.phase)) * 3;
            ctx.fillStyle = '#8d93a8';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 8 - hop, 9 * s, 6 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(d.x + 7 * s, d.y - 13 - hop, 4 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e0a44a';
            ctx.fillRect(d.x + 10 * s, d.y - 14 - hop, 4, 2);
            break;
        }
        case 'candle': {
            ctx.fillStyle = '#f3e6cf';
            ctx.fillRect(d.x - 3, d.y - 24 * s, 6, 24 * s);
            ctx.fillStyle = '#ffcf6a';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 29 * s, 4, 7 + Math.sin(state.time * 0.2) * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'wineBottle': {
            ctx.fillStyle = '#3f5f38';
            ctx.beginPath();
            ctx.roundRect(d.x - 6 * s, d.y - 30 * s, 12 * s, 30 * s, 4);
            ctx.fill();
            ctx.fillRect(d.x - 2.5 * s, d.y - 44 * s, 5 * s, 16 * s);
            ctx.fillStyle = '#c9a24a';
            ctx.fillRect(d.x - 6 * s, d.y - 22 * s, 12 * s, 7 * s);
            break;
        }
        case 'pizza': {
            ctx.fillStyle = '#e8c07a';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 6, 14 * s, 5 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c9503f';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 8, 10 * s, 3.5 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'plant': {
            ctx.fillStyle = '#a05a3c';
            ctx.beginPath();
            ctx.roundRect(d.x - 10 * s, d.y - 16 * s, 20 * s, 16 * s, 3);
            ctx.fill();
            ctx.fillStyle = '#4f8f46';
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.ellipse(d.x + i * 8 * s + sway, d.y - 30 * s, 6 * s, 14 * s, i * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }
        case 'bowl': {
            ctx.fillStyle = pal.accent;
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 6, 15 * s, 8 * s, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#c9713a';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 8, 11 * s, 3 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'spiceJar': {
            ctx.fillStyle = '#d9944a';
            ctx.beginPath();
            ctx.roundRect(d.x - 8 * s, d.y - 20 * s, 16 * s, 20 * s, 4);
            ctx.fill();
            ctx.fillStyle = '#8a5a2f';
            ctx.fillRect(d.x - 9 * s, d.y - 24 * s, 18 * s, 5 * s);
            break;
        }
        case 'hangLamp': {
            ctx.fillStyle = pal.accent;
            ctx.beginPath();
            ctx.moveTo(d.x - 10 * s, d.y - 30 * s);
            ctx.lineTo(d.x, d.y - 48 * s);
            ctx.lineTo(d.x + 10 * s, d.y - 30 * s);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'palm': drawPalm(d.x, d.y, s * 0.8); break;
        case 'jar': {
            ctx.fillStyle = '#c98a5c';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 14 * s, 11 * s, 14 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(d.x - 4 * s, d.y - 32 * s, 8 * s, 10 * s);
            break;
        }
        case 'cactusDeco': {
            ctx.fillStyle = '#4f8f52';
            ctx.beginPath();
            ctx.roundRect(d.x - 5 * s, d.y - 26 * s, 10 * s, 26 * s, 5);
            ctx.roundRect(d.x + 4 * s, d.y - 20 * s, 6 * s, 12 * s, 3);
            ctx.fill();
            break;
        }
        case 'fir': {
            ctx.fillStyle = '#5f3f28';
            ctx.fillRect(d.x - 3, d.y - 12 * s, 6, 12 * s);
            ctx.fillStyle = '#356b3c';
            for (let i = 0; i < 3; i++) {
                const yy = d.y - 12 * s - i * 14 * s;
                const ww = (18 - i * 4) * s;
                ctx.beginPath();
                ctx.moveTo(d.x - ww, yy);
                ctx.lineTo(d.x, yy - 20 * s);
                ctx.lineTo(d.x + ww, yy);
                ctx.closePath();
                ctx.fill();
            }
            break;
        }
        case 'fern': {
            ctx.strokeStyle = '#4f8f46';
            ctx.lineWidth = 2.5;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.quadraticCurveTo(d.x + i * 14 * s + sway, d.y - 18 * s, d.x + i * 20 * s + sway, d.y - 30 * s);
                ctx.stroke();
            }
            break;
        }
        case 'mushroom': {
            ctx.fillStyle = '#f0e6d2';
            ctx.fillRect(d.x - 3 * s, d.y - 12 * s, 6 * s, 12 * s);
            ctx.fillStyle = '#c9503f';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 13 * s, 11 * s, 8 * s, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(d.x - 4 * s, d.y - 16 * s, 2 * s, 0, Math.PI * 2);
            ctx.arc(d.x + 4 * s, d.y - 18 * s, 1.6 * s, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'stone': {
            ctx.fillStyle = '#a8a8ad';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - 5 * s, 11 * s, 7 * s, 0, Math.PI, 0);
            ctx.fill();
            break;
        }
        case 'bush': {
            ctx.fillStyle = '#4f9a45';
            ctx.beginPath();
            ctx.arc(d.x, d.y - 10 * s, 13 * s, 0, Math.PI * 2);
            ctx.arc(d.x - 11 * s, d.y - 4 * s, 10 * s, 0, Math.PI * 2);
            ctx.arc(d.x + 11 * s, d.y - 4 * s, 10 * s, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'flower': {
            ctx.strokeStyle = '#4f8f46';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x + sway, d.y - 16 * s);
            ctx.stroke();
            ctx.fillStyle = pickFlowerColor(d.phase);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(d.x + sway + Math.cos(a) * 4, d.y - 16 * s + Math.sin(a) * 4, 3.2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#ffe9a8';
            ctx.beginPath();
            ctx.arc(d.x + sway, d.y - 16 * s, 2.4, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        default: {
            // Grasbüschel
            ctx.strokeStyle = pal.surfaceTop;
            ctx.lineWidth = 2;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(d.x + i * 5, d.y);
                ctx.quadraticCurveTo(d.x + i * 5 + sway, d.y - 10, d.x + i * 7 + sway * 1.5, d.y - 16);
                ctx.stroke();
            }
        }
    }
}

function pickFlowerColor(phase) {
    const colors = ['#f2879f', '#f7c04a', '#c78bec', '#ffffff'];
    return colors[Math.floor(phase) % colors.length];
}


function heartPath(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.95);
    ctx.bezierCurveTo(x - s * 1.45, y - s * 0.25, x - s * 0.62, y - s * 1.15, x, y - s * 0.32);
    ctx.bezierCurveTo(x + s * 0.62, y - s * 1.15, x + s * 1.45, y - s * 0.25, x, y + s * 0.95);
    ctx.closePath();
}

function drawHeart(h) {
    if (h.taken) return;
    const float = Math.sin(state.time * 0.06 + h.phase) * 4;
    const cx = h.x + h.w / 2;
    const cy = h.y + h.h / 2 + float;
    ctx.save();
    ctx.fillStyle = 'rgba(255,190,208,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6d8b';
    heartPath(cx, cy, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(cx - 3.5, cy - 3.5, 2.4, 1.7, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawCheckpoint(cp) {
    const active = cp.active;
    const poleHeight = 128;
    const flagHeight = 38;
    const top = cp.y - poleHeight;

    ctx.font = 'bold 17px Georgia, serif';
    const textWidth = ctx.measureText(cp.label).width;
    const heartSpace = 26;                          // Platz fürs Herz, auch bevor es erscheint
    const flagWidth = heartSpace + textWidth + 26;
    const wave = Math.sin(state.time * 0.1 + cp.phase) * (active ? 5 : 2);

    // Mast mit Knauf
    ctx.fillStyle = '#8a6b4f';
    ctx.fillRect(cp.x - 3, top, 6, poleHeight);
    ctx.beginPath();
    ctx.arc(cp.x, top, 5, 0, Math.PI * 2);
    ctx.fill();

    // Fahnentuch mit eingeschnittenem Ende - nur das freie Ende weht
    const left = cp.x + 3;
    const right = left + flagWidth;
    const y1 = top + 4;
    const y2 = y1 + flagHeight;
    const midY = (y1 + y2) / 2;
    ctx.fillStyle = active ? '#ff6d8b' : '#b9b9c2';
    ctx.beginPath();
    ctx.moveTo(left, y1);
    ctx.lineTo(right + wave, y1 + 2);
    ctx.lineTo(right - 12 + wave * 0.6, midY);
    ctx.lineTo(right + wave, y2 - 2);
    ctx.lineTo(left, y2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(left, y2 - 4, flagWidth - 14, 4);

    // Herz erscheint erst, wenn die Flagge berührt wurde
    if (active) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        heartPath(left + heartSpace / 2 + 3, midY - 1, 7);
        ctx.fill();
    }

    // Kapitelname
    ctx.fillStyle = active ? '#ffffff' : '#4a4550';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cp.label, left + heartSpace, midY + 1);
    ctx.textBaseline = 'alphabetic';
}

// Das Sprungbrett sieht je nach Kapitel anders aus - die Mechanik bleibt gleich.
function drawCow(cow) {
    const pal = paletteOf(cow);
    const look = cow.look || pal.bouncer;
    if (look === 'haybale') { drawHaybale(cow); return; }
    if (look === 'cushion') { drawCushion(cow, pal); return; }
    if (drawCustomBouncer(cow, look, pal)) return;

    const squash = cow.squash;
    const bottom = cow.y + cow.h;
    const h = cow.h * squash;
    const w = cow.w * (2 - squash);
    const x = cow.x + (cow.w - w) / 2;
    const y = bottom - h;
    const s = w / COW_WIDTH; // Skalierung, Optik bleibt wie gehabt

    // Beine
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(x + 10 * s, y + h - 16, 9 * s, 16);
    ctx.fillRect(x + 46 * s, y + h - 16, 9 * s, 16);
    // Körper
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y + 6, 58 * s, h - 20, 12 * s);
    ctx.fill();
    // Flecken
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(x + 16 * s, y + 20, 9 * s, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 40 * s, y + 30, 7 * s, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Kopf
    const headBob = Math.sin(cow.chew) * 1.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x + 50 * s, y + 10 + headBob, 26 * s, 26, 8 * s);
    ctx.fill();
    // Hörner
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 56 * s, y + 2 + headBob, 5 * s, 10);
    ctx.fillRect(x + 68 * s, y + 2 + headBob, 5 * s, 10);
    // Schnauze
    ctx.fillStyle = '#f4a6a6';
    ctx.beginPath();
    ctx.roundRect(x + 62 * s, y + 24 + headBob, 15 * s, 12, 5 * s);
    ctx.fill();
    // Augen
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(x + 60 * s, y + 19 + headBob, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 70 * s, y + 19 + headBob, 2.2, 0, Math.PI * 2);
    ctx.fill();
}

// Heuballen (Prag) - gleiche Sprungbrett-Mechanik wie die Kuh
function drawHaybale(cow) {
    const squash = cow.squash;
    const bottom = cow.y + cow.h;
    const h = cow.h * squash;
    const w = cow.w * (2 - squash);
    const x = cow.x + (cow.w - w) / 2;
    const y = bottom - h;

    ctx.fillStyle = '#d9b25c';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,100,40,0.5)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, (w / 2) * (i / 4), h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    // Schnüre
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x + w * 0.28, y, 5, h);
    ctx.fillRect(x + w * 0.66, y, 5, h);
    // Halme oben
    ctx.strokeStyle = '#e8c877';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        const hx = x + 8 + i * (w - 16) / 5;
        ctx.beginPath();
        ctx.moveTo(hx, y + 2);
        ctx.lineTo(hx + Math.sin(i + state.time * 0.02) * 3, y - 7);
        ctx.stroke();
    }
}

// Sitzkissen (Restaurants) - ebenfalls ein Sprungbrett
function drawCushion(cow, pal) {
    const squash = cow.squash;
    const bottom = cow.y + cow.h;
    const h = cow.h * squash;
    const w = cow.w * (2 - squash);
    const x = cow.x + (cow.w - w) / 2;
    const y = bottom - h;

    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 6, w - 16, h * 0.35, 12);
    ctx.fill();
    // Naht und Quasten
    ctx.strokeStyle = 'rgba(90,50,40,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 5, w - 12, h - 10, 14);
    ctx.stroke();
    ctx.fillStyle = pal.platformDark;
    for (const cx2 of [x + 6, x + w - 6]) {
        ctx.beginPath();
        ctx.arc(cx2, y + h - 6, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawMowgli(cat) {
    const x = cat.x;
    const y = cat.y;
    const body = '#c95735';
    const light = '#e07a52';
    const ridden = player.mount === cat;

    // Mowgli ist immer "nach rechts blickend" gezeichnet (Kopf/Schwauz-Layout
    // unten) und wird bei Bedarf gespiegelt - sonst sieht es beim Laufen nach
    // links so aus, als würde er rückwärts laufen.
    const facing = cat.facing || 1;
    const mirrorX = x + cat.w / 2;
    ctx.save();
    ctx.translate(mirrorX, 0);
    ctx.scale(facing, 1);
    ctx.translate(-mirrorX, 0);

    // Schwanz
    ctx.strokeStyle = body;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 22);
    ctx.quadraticCurveTo(
        x - 12, y + 16 + Math.sin(cat.tailPhase) * 6,
        x - 6, y + 2 + Math.sin(cat.tailPhase) * 8
    );
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Körper
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 10, 40, 22, 10);
    ctx.fill();
    // Streifen
    ctx.fillStyle = light;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 12 + i * 9, y + 11, 3, 8);

    // Pfoten
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 26, 10, 6, 3);
    ctx.roundRect(x + 26, y + 26, 10, 6, 3);
    ctx.fill();

    // Kopf
    const headX = x + 36;
    const headY = y + (ridden ? 6 : 2);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(headX, headY, 20, 18, 8);
    ctx.fill();
    // Ohren
    ctx.beginPath();
    ctx.moveTo(headX + 1, headY + 4); ctx.lineTo(headX + 3, headY - 8); ctx.lineTo(headX + 10, headY + 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX + 11, headY + 2); ctx.lineTo(headX + 18, headY - 8); ctx.lineTo(headX + 20, headY + 4); ctx.fill();
    ctx.fillStyle = '#f4a6a6';
    ctx.beginPath();
    ctx.moveTo(headX + 3, headY + 2); ctx.lineTo(headX + 4, headY - 4); ctx.lineTo(headX + 8, headY + 1); ctx.fill();

    // Gesicht
    ctx.fillStyle = '#2a2a2a';
    if (cat.blink > 0) {
        ctx.fillRect(headX + 4, headY + 8, 4, 1.6);
        ctx.fillRect(headX + 13, headY + 8, 4, 1.6);
    } else {
        ctx.beginPath();
        ctx.arc(headX + 6, headY + 8, 2.1, 0, Math.PI * 2);
        ctx.arc(headX + 15, headY + 8, 2.1, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#f4a6a6';
    ctx.beginPath();
    ctx.moveTo(headX + 10.5, headY + 12);
    ctx.lineTo(headX + 8, headY + 10);
    ctx.lineTo(headX + 13, headY + 10);
    ctx.fill();
    // Schnurrhaare
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headX + 6, headY + 12); ctx.lineTo(headX - 2, headY + 11);
    ctx.moveTo(headX + 15, headY + 12); ctx.lineTo(headX + 23, headY + 11);
    ctx.stroke();

    ctx.restore();
}

function drawCritter(c) {
    if (c.look && drawCritterLook(c)) return;
    const squashed = !c.alive;
    const h = squashed ? 8 : c.h;
    const y = c.y + c.h - h;
    const wobble = squashed ? 0 : Math.sin(c.phase) * 2;

    ctx.fillStyle = '#6b4fa8';
    ctx.beginPath();
    ctx.roundRect(c.x, y, c.w, h, squashed ? 4 : 11);
    ctx.fill();
    if (squashed) return;

    ctx.fillStyle = '#8f70cc';
    ctx.beginPath();
    ctx.roundRect(c.x + 4, y + 3, c.w - 8, 7, 4);
    ctx.fill();
    // Füße
    ctx.fillStyle = '#4a3578';
    ctx.fillRect(c.x + 5, c.y + c.h - 3 + wobble, 7, 4);
    ctx.fillRect(c.x + c.w - 12, c.y + c.h - 3 - wobble, 7, 4);
    // Augen
    ctx.fillStyle = '#ffffff';
    const dir = Math.sign(c.vx) || 1;
    ctx.beginPath();
    ctx.arc(c.x + c.w / 2 + dir * 6, y + 11, 4, 0, Math.PI * 2);
    ctx.arc(c.x + c.w / 2 + dir * 13, y + 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(c.x + c.w / 2 + dir * 7, y + 11, 1.8, 0, Math.PI * 2);
    ctx.arc(c.x + c.w / 2 + dir * 14, y + 11, 1.8, 0, Math.PI * 2);
    ctx.fill();
}

function drawHero() {
    const p = player;
    if (state.mode === 'dead' && Math.floor(state.time / 4) % 2 === 0) return; // blinkt

    const c = PERSONAL.heroColors;
    const bottom = p.y + p.h;
    const h = p.h * p.squash;
    const w = p.w * (2 - p.squash);
    const cx = p.x + p.w / 2;
    const top = bottom - h;
    const airborne = !p.onGround && p.mode !== 'riding';
    const swing = p.onGround ? Math.sin(p.runPhase) : 0.5;
    const legSwing = Math.abs(p.vx) > 0.2 ? swing * 6 : 0;

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, bottom + 2, w * 0.42, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const headR = p.ducking ? 9 : 11;
    const headY = top + headR + 2;

    // Die ganze Figur wird für "facing right" gezeichnet und bei Bedarf
    // horizontal gespiegelt - dadurch dreht sich die Figur wirklich sichtbar
    // um, statt nur einen 1px-Gesichtsversatz zu haben.
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(p.facing, 1);
    ctx.translate(-cx, 0);

    // Beine
    ctx.fillStyle = c.shoes;
    if (airborne) {
        ctx.fillRect(cx - 9, bottom - 10, 7, 10);
        ctx.fillRect(cx + 3, bottom - 12, 7, 12);
    } else {
        ctx.fillRect(cx - 9 + legSwing, bottom - 10, 7, 10);
        ctx.fillRect(cx + 2 - legSwing, bottom - 10, 7, 10);
    }

    // Kleid
    ctx.fillStyle = c.dress;
    ctx.beginPath();
    ctx.moveTo(cx - 7, headY + headR - 1);
    ctx.lineTo(cx + 7, headY + headR - 1);
    ctx.lineTo(cx + (p.ducking ? 12 : 13), bottom - 9);
    ctx.lineTo(cx - (p.ducking ? 12 : 13), bottom - 9);
    ctx.closePath();
    ctx.fill();

    // Arme
    ctx.strokeStyle = c.skin;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (airborne) {
        ctx.moveTo(cx - 6, headY + headR + 3); ctx.lineTo(cx - 13, headY + 2);
        ctx.moveTo(cx + 6, headY + headR + 3); ctx.lineTo(cx + 13, headY + 2);
    } else {
        ctx.moveTo(cx - 6, headY + headR + 3); ctx.lineTo(cx - 11 - legSwing * 0.5, headY + headR + 13);
        ctx.moveTo(cx + 6, headY + headR + 3); ctx.lineTo(cx + 11 + legSwing * 0.5, headY + headR + 13);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Haare hinten + Zopf (weht hinter der Laufrichtung her)
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(cx, headY, headR + 2.5, 0, Math.PI * 2);
    ctx.fill();
    const ponytail = Math.sin(state.time * 0.12) * 2 - Math.abs(p.vx) * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx - (headR + 4), headY + 6 + ponytail * 0.3, 5, 10, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Gesicht (leicht zur Blickrichtung verschoben)
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(cx + 1.5, headY + 1.5, headR - 1, 0, Math.PI * 2);
    ctx.fill();

    // Augen & Mund
    ctx.fillStyle = '#2c2c2c';
    if (p.blink > 0) {
        ctx.fillRect(cx - 3, headY + 1, 3.5, 1.4);
        ctx.fillRect(cx + 3, headY + 1, 3.5, 1.4);
    } else {
        ctx.beginPath();
        ctx.arc(cx - 2, headY + 1.5, 1.6, 0, Math.PI * 2);
        ctx.arc(cx + 5, headY + 1.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = '#b8556a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx + 1, headY + 4.5, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Wangen
    ctx.fillStyle = 'rgba(240,140,150,0.45)';
    ctx.beginPath();
    ctx.arc(cx - 5, headY + 4, 2.2, 0, Math.PI * 2);
    ctx.arc(cx + 8, headY + 4, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawGoal() {
    const gx = level.goalX;
    const gy = GROUND_BASE_Y;
    // Torbogen
    ctx.fillStyle = '#8a6b4f';
    ctx.fillRect(gx - 70, gy - 150, 10, 150);
    ctx.fillRect(gx + 60, gy - 150, 10, 150);
    ctx.fillStyle = '#ff8fa8';
    ctx.beginPath();
    ctx.roundRect(gx - 74, gy - 168, 148, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#fff6ea';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('ZIEL', gx, gy - 147);
    ctx.textAlign = 'left';

    // Girlande aus Herzen
    for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const hx = gx - 66 + t * 132;
        const hy = gy - 136 + Math.sin(t * Math.PI) * -10 + Math.sin(state.time * 0.05 + i) * 3;
        ctx.fillStyle = i % 2 ? '#ff6d8b' : '#ffd0dc';
        heartPath(hx, hy, 6);
        ctx.fill();
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// Räume und Kulissen, in denen man läuft: Sie liegen HINTER dem Boden,
// sonst würden sie Treppen und Stufen verdecken.
const BEHIND_LANDMARKS = new Set([
    'pragInterior', 'oasiInterior', 'afroInterior', 'kitchen',
    'souk', 'chefchaouen', 'riad', 'waterfall',
    'pragHouse', 'paternosterShaft', 'tannery', 'cave', 'spiceMarket',
]);

function drawWorld() {
    drawPits();
    for (const lm of level.landmarks) {
        if (lm.layer || !BEHIND_LANDMARKS.has(lm.kind)) continue;
        if (lm.x + lm.w < camera.x - 120 || lm.x > camera.x + viewWidth + 120) continue;
        drawLandmark(lm, paletteOf(lm));
    }
    drawTerrain();

    // Bauwerke, die genau zur Welt gehören (Brücke, Oase, Bach, Tische ...).
    // Sie werden NACH dem Boden gezeichnet, sonst verschwinden sie dahinter.
    for (const lm of level.landmarks) {
        if (lm.layer || BEHIND_LANDMARKS.has(lm.kind)) continue;
        if (lm.x + lm.w < camera.x - 120 || lm.x > camera.x + viewWidth + 120) continue;
        // Reine Deko-Bauwerke blass - damit klar ist: nicht interaktiv
        ctx.globalAlpha = DIM_LANDMARKS.has(lm.kind) ? BACKGROUND_DECOR_ALPHA : 1;
        drawLandmark(lm, paletteOf(lm));
        ctx.globalAlpha = 1;
    }

    // Deko am Boden (Laternen, Tauben, Schilder ...) ist nur Hintergrund
    ctx.globalAlpha = BACKGROUND_DECOR_ALPHA;
    for (const d of level.decor) {
        if (d.x < camera.x - 60 || d.x > camera.x + viewWidth + 60) continue;
        drawDecor(d);
    }
    ctx.globalAlpha = 1;
    for (const cp of level.checkpoints) {
        if (cp.x < camera.x - 220 || cp.x > camera.x + viewWidth + 80) continue;
        drawCheckpoint(cp);
    }
    for (const p of level.platforms) {
        if (p.x + p.w < camera.x - 60 || p.x > camera.x + viewWidth + 60) continue;
        drawPlatform(p);
    }
    for (const o of level.obstacles) {
        if (o.x + o.w < camera.x - 60 || o.x > camera.x + viewWidth + 60) continue;
        drawObstacle(o);
    }
    drawHazards();
    for (const h of level.hearts) {
        if (h.x < camera.x - 60 || h.x > camera.x + viewWidth + 60) continue;
        drawHeart(h);
    }
    for (const c of level.cows) {
        if (c.x + c.w < camera.x - 80 || c.x > camera.x + viewWidth + 80) continue;
        drawCow(c);
    }
    for (const c of level.critters) {
        if (c.squashTimer < 0 && !c.alive) continue;
        if (c.x + c.w < camera.x - 80 || c.x > camera.x + viewWidth + 80) continue;
        drawCritter(c);
    }
    for (const c of level.cats) {
        if (c.x + c.w < camera.x - 100 || c.x > camera.x + viewWidth + 100) continue;
        drawMowgli(c);
    }
    if (level.goalX > camera.x - 200 && level.goalX < camera.x + viewWidth + 200) drawGoal();
    drawHeroSunk();
    drawParticles();
    drawWindStreaks();
    drawDarkness();
}



/* --- Zeichnen der neuen Hindernisse, Figuren und Orte ---------------- */

// Diese Plattformen bewegen sich selbst sichtbar (Fahrzeuge, Tiere) und
// brauchen weder Wackeln noch Richtungspfeile.
const NO_BOB_LOOKS = new Set(['train', 'camel', 'waiter', 'fountain', 'plankBridge', 'paternoster', 'gondola', 'awning', 'djembe', 'doughPad']);

function fillRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
}

function fillCircle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function drawHazards() {
    for (const hz of level.hazards) {
        if (hz.x + hz.w < camera.x - 140 || hz.x > camera.x + viewWidth + 140) continue;
        if (hz.type === 'pulse') drawPulseHazard(hz);
        else if (hz.type === 'roller') drawRollerHazard(hz);
        else if (hz.type === 'pendulum') drawPendulumHazard(hz);
        else if (hz.type === 'static') drawStaticHazard(hz);
        else drawDropperHazard(hz);
    }
}


/* --- Gefahren im Takt --- */

function drawPulseHazard(hz) {
    const st = pulseState(hz);
    const t = state.time;
    const cx = hz.x + hz.w / 2;
    const bottom = hz.y + hz.h;

    if (hz.look === 'chimneySmoke') { drawChimneySmoke(hz, st); return; }

    if (hz.look === 'ovenFlame') {
        // Pizzaofen links, die Flamme schlägt nach rechts heraus
        const ox = hz.x - 58;
        ctx.fillStyle = '#9a5a3c';
        fillRoundRect(ox, hz.y - 40, 60, hz.h + 60, 18);
        ctx.fillStyle = '#7a4430';
        for (let r = 0; r < 4; r++) ctx.fillRect(ox + 4, hz.y - 30 + r * 18, 52, 2);
        ctx.fillStyle = '#3a1f16';
        ctx.beginPath();
        ctx.arc(ox + 60, hz.y + hz.h / 2, 17, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fill();
        const glow = st === 'on' ? 1 : st === 'warn' ? 0.55 + 0.45 * Math.sin(t * 0.6) : 0.25;
        ctx.fillStyle = `rgba(255,150,50,${glow})`;
        fillCircle(ox + 54, hz.y + hz.h / 2, 8);
        if (st === 'on') {
            for (let i = 0; i < 4; i++) {
                const flick = Math.sin(t * 0.5 + i) * 5;
                ctx.fillStyle = i % 2 ? 'rgba(255,200,90,0.9)' : 'rgba(255,110,40,0.85)';
                ctx.beginPath();
                ctx.ellipse(hz.x + 10 + i * (hz.w / 4), hz.y + hz.h / 2 + flick * 0.4,
                    hz.w / 4 + 6, hz.h / 2 - i * 3 + flick, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (st === 'warn') {
            ctx.fillStyle = 'rgba(255,160,60,0.6)';
            fillCircle(hz.x + 6, hz.y + hz.h / 2 + Math.sin(t * 0.8) * 3, 6);
        }
        return;
    }

    if (hz.look === 'steam') {
        // Gitter im Boden, daraus schießt Dampf
        ctx.fillStyle = '#5a5a62';
        ctx.fillRect(hz.x - 4, bottom - 4, hz.w + 8, 5);
        ctx.fillStyle = '#34343a';
        for (let i = 0; i < 4; i++) ctx.fillRect(hz.x + i * (hz.w / 4) + 3, bottom - 3, 4, 3);
        if (st === 'on') {
            for (let i = 0; i < 6; i++) {
                const k = ((t * 0.08 + i / 6) % 1);
                ctx.fillStyle = `rgba(245,245,250,${0.75 - k * 0.5})`;
                fillCircle(cx + Math.sin(t * 0.2 + i) * 6, bottom - k * hz.h, 10 + k * 8);
            }
        } else if (st === 'warn') {
            ctx.fillStyle = 'rgba(240,240,245,0.55)';
            fillCircle(cx + Math.sin(t * 0.4) * 4, bottom - 10, 6);
        }
        return;
    }

    if (hz.look === 'stink') {
        // Teller auf der Theke, darüber steigt die berüchtigte Stinkwolke auf
        ctx.fillStyle = '#f2ede2';
        ctx.beginPath();
        ctx.ellipse(cx, bottom - 3, hz.w / 2 + 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5a36';
        ctx.beginPath();
        ctx.ellipse(cx, bottom - 7, hz.w / 3, 6, 0, Math.PI, 0);
        ctx.fill();
        if (st === 'on') {
            for (let i = 0; i < 5; i++) {
                const k = ((t * 0.05 + i / 5) % 1);
                ctx.fillStyle = `rgba(140,190,70,${0.65 - k * 0.45})`;
                fillCircle(cx + Math.sin(t * 0.15 + i * 2) * 10, bottom - 12 - k * (hz.h - 12), 11 + k * 9);
            }
            ctx.strokeStyle = 'rgba(90,130,40,0.7)';
            ctx.lineWidth = 2;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                for (let s = 0; s < 6; s++) {
                    ctx.lineTo(cx + i * 12 + Math.sin(t * 0.2 + s) * 4, bottom - 14 - s * 10);
                }
                ctx.stroke();
            }
        } else {
            const a = st === 'warn' ? 0.8 : 0.3;
            ctx.strokeStyle = `rgba(110,160,50,${a})`;
            ctx.lineWidth = 2;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                for (let s = 0; s < 3; s++) {
                    ctx.lineTo(cx + i * 10 + Math.sin(t * 0.25 + s + i) * 3, bottom - 12 - s * 7);
                }
                ctx.stroke();
            }
        }
    }
}


/* --- Fallende und pendelnde Gegenstände --- */

function drawDropperHazard(hz) {
    const s = dropperState(hz);
    const cx = hz.x + hz.w / 2;

    if (hz.mode === 'yoyo') {
        // Marionette an ihren Fäden
        ctx.strokeStyle = 'rgba(240,230,210,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 8, hz.topY);
        ctx.lineTo(cx - 6, s.y + 4);
        ctx.moveTo(cx + 8, hz.topY);
        ctx.lineTo(cx + 6, s.y + 14);
        ctx.stroke();
        ctx.fillStyle = '#6b3f2a';
        ctx.fillRect(cx - 12, hz.topY - 2, 24, 4);
        drawMarionette(hz.x, s.y, hz.w, hz.h);
        return;
    }

    // Ablage, von der der Gegenstand herunterfällt
    const ledgeY = hz.topY + hz.h;
    if (hz.look === 'flowerPot') {
        drawFlowerWindow(hz, cx, ledgeY);
    } else if (hz.look === 'can') {
        drawCanShelf(hz, cx, ledgeY);
    } else if (hz.look === 'pottery') {
        drawPotteryShelf(hz, cx, ledgeY);
    } else if (hz.look === 'rock') {
        ctx.fillStyle = '#76767d';
        ctx.beginPath();
        ctx.moveTo(cx - 44, ledgeY - 14);
        ctx.lineTo(cx + 40, ledgeY - 18);
        ctx.lineTo(cx + 30, ledgeY + 6);
        ctx.lineTo(cx - 34, ledgeY + 4);
        ctx.closePath();
        ctx.fill();
    }

    // Schatten auf dem Boden kündigt den Aufschlag an
    if (s.phase === 'warn' || s.phase === 'falling') {
        const k = s.phase === 'warn' ? s.progress * 0.4 : 0.4 + s.progress * 0.6;
        ctx.fillStyle = `rgba(0,0,0,${0.12 + k * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(cx, hz.groundY - 1, 6 + hz.w * 0.6 * k, 3 + 2 * k, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    if (s.phase === 'landed') {
        const fade = 1 - clamp(s.progress, 0, 1);
        if (fade <= 0) return;
        ctx.globalAlpha = fade;
        ctx.fillStyle = dropColor(hz.look);
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(cx - 14 + i * 9, hz.groundY - 5 - (i % 2) * 3, 6, 4);
        }
        ctx.globalAlpha = 1;
        return;
    }

    const wobble = s.phase === 'warn' ? Math.sin(state.time * 0.9) * 1.5 * s.progress : 0;
    drawDropObject(hz.look, hz.x + wobble, s.y, hz.w, hz.h);
}

function dropColor(look) {
    return { flowerPot: '#b8683f', can: '#9aa0a8', pottery: '#c98a5c', rock: '#8e8e94' }[look] || '#888';
}

function drawDropObject(look, x, y, w, h) {
    if (look === 'stalactite') { drawStalactite(x, y, w, h); return; }
    const cx = x + w / 2;
    if (look === 'flowerPot') {
        ctx.fillStyle = '#b8683f';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 8);
        ctx.lineTo(x + w - 2, y + 8);
        ctx.lineTo(x + w - 5, y + h);
        ctx.lineTo(x + 5, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4f8f46';
        fillCircle(cx - 5, y + 5, 5);
        fillCircle(cx + 5, y + 4, 5);
        ctx.fillStyle = '#e2574c';
        fillCircle(cx, y + 1, 4);
    } else if (look === 'can') {
        ctx.fillStyle = '#9aa0a8';
        fillRoundRect(x + 2, y, w - 4, h, 3);
        ctx.fillStyle = '#d9a441';
        ctx.fillRect(x + 2, y + 6, w - 4, h - 12);
        drawPaw(cx, y + h / 2, 3);
    } else if (look === 'pottery') {
        ctx.fillStyle = '#c98a5c';
        ctx.beginPath();
        ctx.ellipse(cx, y + h * 0.6, w / 2, h * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - 4, y, 8, 6);
        ctx.fillStyle = '#3f8f9e';
        ctx.fillRect(x + 3, y + h * 0.55, w - 6, 3);
    } else {
        ctx.fillStyle = '#8e8e94';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.6);
        ctx.lineTo(x + w * 0.3, y);
        ctx.lineTo(x + w * 0.85, y + 3);
        ctx.lineTo(x + w, y + h * 0.7);
        ctx.lineTo(x + w * 0.5, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x + w * 0.35, y + 4, w * 0.3, 3);
    }
}

function drawPaw(x, y, s) {
    ctx.fillStyle = '#5a3a22';
    fillCircle(x, y + s * 0.8, s * 1.1);
    fillCircle(x - s * 1.3, y - s * 0.4, s * 0.55);
    fillCircle(x - s * 0.45, y - s * 1.1, s * 0.55);
    fillCircle(x + s * 0.45, y - s * 1.1, s * 0.55);
    fillCircle(x + s * 1.3, y - s * 0.4, s * 0.55);
}

function drawMarionette(x, y, w, h) {
    const cx = x + w / 2;
    ctx.fillStyle = '#f2d2b0';
    fillCircle(cx, y + 6, 6);
    ctx.fillStyle = '#c9503f';
    ctx.beginPath();
    ctx.moveTo(cx - 3, y);
    ctx.lineTo(cx + 9, y - 3);
    ctx.lineTo(cx + 3, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3f6fb0';
    fillRoundRect(cx - 7, y + 12, 14, 14, 3);
    ctx.strokeStyle = '#3f6fb0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const swing = Math.sin(state.time * 0.15) * 4;
    ctx.moveTo(cx - 6, y + 14); ctx.lineTo(cx - 11, y + 24 + swing);
    ctx.moveTo(cx + 6, y + 14); ctx.lineTo(cx + 11, y + 24 - swing);
    ctx.stroke();
    ctx.strokeStyle = '#4a3a30';
    ctx.beginPath();
    ctx.moveTo(cx - 3, y + 26); ctx.lineTo(cx - 5 - swing * 0.5, y + h);
    ctx.moveTo(cx + 3, y + 26); ctx.lineTo(cx + 5 + swing * 0.5, y + h);
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    fillCircle(cx - 2, y + 6, 1.2);
    fillCircle(cx + 2, y + 6, 1.2);
}


/* --- Gegner --- */

function drawCritterLook(c) {
    if (!c.alive) {
        if (c.fly || c.squashTimer < 0) return true;
    }
    const dir = Math.sign(c.vx) || 1;
    const t = state.time;
    const x = c.x;
    const y = c.y;

    switch (c.look) {
        case 'pigeon': {
            const flap = Math.sin(t * 0.5 + c.phase) * 7;
            ctx.save();
            ctx.translate(x + c.w / 2, y + c.h / 2);
            ctx.scale(dir, 1);
            ctx.fillStyle = '#8d93a8';
            ctx.beginPath();
            ctx.ellipse(0, 2, 13, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6f7690';
            ctx.beginPath();
            ctx.moveTo(-4, 0); ctx.lineTo(8, -2); ctx.lineTo(0, -8 - flap);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#9aa0b4';
            fillCircle(11, -3, 6);
            ctx.fillStyle = '#6aa08c';
            ctx.fillRect(7, 1, 5, 3);
            ctx.fillStyle = '#e0a44a';
            ctx.fillRect(16, -3, 5, 2);
            ctx.fillStyle = '#2a2a2a';
            fillCircle(13, -4, 1.4);
            ctx.restore();
            return true;
        }
        case 'witch': {
            const bob = Math.sin(t * 0.12 + c.phase) * 2;
            ctx.save();
            ctx.translate(x + c.w / 2, y + c.h / 2 + bob);
            ctx.scale(dir, 1);
            ctx.strokeStyle = '#8a6540';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-20, 8); ctx.lineTo(18, 4);
            ctx.stroke();
            ctx.fillStyle = '#c9a25c';
            ctx.beginPath();
            ctx.moveTo(-20, 8); ctx.lineTo(-30, 2); ctx.lineTo(-30, 14);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#6b4fa8';
            ctx.beginPath();
            ctx.moveTo(-8, 6); ctx.lineTo(8, 6); ctx.lineTo(2, -8); ctx.lineTo(-4, -8);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#b8d99a';
            fillCircle(0, -11, 5);
            ctx.fillStyle = '#3a2a48';
            ctx.beginPath();
            ctx.moveTo(-8, -14); ctx.lineTo(8, -14); ctx.lineTo(-2, -28);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#2a2a2a';
            fillCircle(2, -11, 1.2);
            ctx.restore();
            return true;
        }
        case 'meatball': {
            if (!c.alive) {
                ctx.fillStyle = '#8a4a2c';
                ctx.beginPath();
                ctx.ellipse(x + c.w / 2, y + c.h - 3, c.w / 2, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                return true;
            }
            const cx = x + c.w / 2;
            const cy = y + c.h / 2 + 1;
            ctx.fillStyle = '#8a4a2c';
            fillCircle(cx, cy, c.h / 2);
            ctx.fillStyle = '#c9503f';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 6, 10, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            const roll = t * 0.15 * dir;
            fillCircle(cx + Math.cos(roll) * 6, cy + Math.sin(roll) * 6, 2);
            ctx.fillStyle = '#fff';
            fillCircle(cx + dir * 4, cy - 1, 3);
            fillCircle(cx + dir * 10, cy - 1, 3);
            ctx.fillStyle = '#2a2a2a';
            fillCircle(cx + dir * 5, cy - 1, 1.4);
            fillCircle(cx + dir * 11, cy - 1, 1.4);
            return true;
        }
        case 'scorpion': {
            const cx = x + c.w / 2;
            const base = y + c.h;
            ctx.save();
            ctx.translate(cx, base);
            ctx.scale(dir, 1);
            if (!c.alive) {
                ctx.fillStyle = '#a07a3c';
                ctx.fillRect(-14, -4, 28, 4);
                ctx.restore();
                return true;
            }
            ctx.strokeStyle = '#8a6a2c';
            ctx.lineWidth = 2;
            for (let i = -1; i <= 1; i++) {
                const k = Math.sin(t * 0.4 + i) * 2;
                ctx.beginPath();
                ctx.moveTo(i * 5, -6); ctx.lineTo(i * 7 - 3, k);
                ctx.stroke();
            }
            ctx.fillStyle = '#b8863c';
            ctx.beginPath();
            ctx.ellipse(0, -8, 11, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#b8863c';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-9, -9);
            ctx.quadraticCurveTo(-22, -26, -6, -24 + Math.sin(t * 0.2) * 2);
            ctx.stroke();
            ctx.fillStyle = '#7a4a1c';
            fillCircle(-6, -24, 3);
            ctx.fillStyle = '#b8863c';
            fillCircle(14, -10, 4);
            fillCircle(14, -4, 3);
            ctx.restore();
            return true;
        }
        case 'boar': {
            const cx = x + c.w / 2;
            const base = y + c.h;
            ctx.save();
            ctx.translate(cx, base);
            ctx.scale(dir, 1);
            if (!c.alive) {
                ctx.fillStyle = '#5a4030';
                ctx.beginPath();
                ctx.ellipse(0, -4, 18, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                return true;
            }
            const leg = Math.sin(t * 0.3) * 3;
            ctx.fillStyle = '#4a3528';
            ctx.fillRect(-12 + leg, -8, 5, 8);
            ctx.fillRect(8 - leg, -8, 5, 8);
            ctx.fillStyle = '#5e4332';
            ctx.beginPath();
            ctx.ellipse(-2, -15, 18, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6e5040';
            ctx.beginPath();
            ctx.ellipse(14, -13, 8, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c99a8a';
            fillRoundRect(19, -14, 6, 6, 2);
            ctx.fillStyle = '#f2ede2';
            ctx.beginPath();
            ctx.moveTo(18, -8); ctx.lineTo(22, -14); ctx.lineTo(20, -8);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#2a2a2a';
            fillCircle(14, -17, 1.5);
            ctx.fillStyle = '#3a2820';
            for (let i = 0; i < 4; i++) ctx.fillRect(-14 + i * 6, -27, 2, 5);
            ctx.restore();
            return true;
        }
    }
    return drawCritterLook2(c);
}


/* --- Plattformen --- */

function drawPlatformLook(p, look, pal) {
    const t = state.time;
    switch (look) {
        case 'tile': {
            ctx.fillStyle = '#b5563f';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#8a3c2c';
            ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
            ctx.strokeStyle = 'rgba(60,20,15,0.45)';
            ctx.lineWidth = 1.5;
            for (let x = p.x + 8; x < p.x + p.w; x += 14) {
                ctx.beginPath();
                ctx.arc(x, p.y + 2, 6, Math.PI, 0);
                ctx.stroke();
            }
            // Risse zeigen, dass die Ziegel lose sind
            ctx.strokeStyle = 'rgba(40,15,10,0.7)';
            ctx.beginPath();
            ctx.moveTo(p.x + p.w * 0.3, p.y);
            ctx.lineTo(p.x + p.w * 0.4, p.y + 7);
            ctx.lineTo(p.x + p.w * 0.33, p.y + p.h);
            ctx.moveTo(p.x + p.w * 0.72, p.y + 2);
            ctx.lineTo(p.x + p.w * 0.66, p.y + p.h);
            ctx.stroke();
            return true;
        }
        case 'clockFigure': {
            // Vergoldeter Sims, darunter eine der Apostelfiguren im Fensterbogen
            ctx.fillStyle = '#d9b25c';
            fillRoundRect(p.x, p.y, p.w, p.h, 4);
            ctx.fillStyle = '#a8843c';
            ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
            const cx = p.x + p.w / 2;
            ctx.fillStyle = '#3a3050';
            ctx.beginPath();
            ctx.arc(cx, p.y + p.h + 12, 12, Math.PI, 0);
            ctx.fillRect(cx - 12, p.y + p.h + 12, 24, 22);
            ctx.fill();
            ctx.fillStyle = '#e8dcc0';
            fillCircle(cx, p.y + p.h + 12, 5);
            ctx.fillStyle = '#7a5a9a';
            fillRoundRect(cx - 6, p.y + p.h + 17, 12, 16, 3);
            ctx.fillStyle = '#d9b25c';
            ctx.beginPath();
            ctx.arc(cx, p.y + p.h + 9, 7, Math.PI, 0);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#d9b25c';
            ctx.stroke();
            return true;
        }
        case 'waiter': {
            // Kellner: das Tablett ist die Plattform, er selbst läuft darunter
            const cx = p.x + p.w / 2;
            const feet = p.y + 72;
            const step = Math.abs(p.dx) > 0.05 ? Math.sin(t * 0.3) * 5 : 0;
            ctx.fillStyle = '#2a2a34';
            ctx.fillRect(cx - 7 + step, feet - 22, 6, 22);
            ctx.fillRect(cx + 1 - step, feet - 22, 6, 22);
            ctx.fillStyle = '#f4f2ee';
            fillRoundRect(cx - 10, feet - 50, 20, 30, 4);
            ctx.fillStyle = '#2a2a34';
            ctx.fillRect(cx - 10, feet - 44, 20, 4);
            ctx.fillStyle = '#f0c29c';
            fillCircle(cx, feet - 58, 8);
            ctx.fillStyle = '#3a2a22';
            ctx.beginPath();
            ctx.arc(cx, feet - 60, 8, Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#f0c29c';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(cx - 8, feet - 44); ctx.lineTo(cx - 14, p.y + p.h);
            ctx.moveTo(cx + 8, feet - 44); ctx.lineTo(cx + 14, p.y + p.h);
            ctx.stroke();
            ctx.fillStyle = '#c8ccd4';
            ctx.beginPath();
            ctx.ellipse(cx, p.y + p.h / 2, p.w / 2 + 6, p.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(cx - p.w / 3, p.y + 2, p.w / 1.5, 2);
            ctx.fillStyle = '#e2574c';
            fillCircle(cx + 14, p.y - 2, 4);
            return true;
        }
        case 'camel': {
            // Kamel stapft durch den Treibsand, sein Rücken ist die Plattform
            const cx = p.x + p.w / 2;
            const dir = p.dx < 0 ? -1 : 1;
            const step = Math.sin(t * 0.18) * 4;
            ctx.save();
            ctx.translate(cx, p.y);
            ctx.scale(dir, 1);
            ctx.fillStyle = '#b8864c';
            ctx.fillRect(-26 + step, 18, 7, 22);
            ctx.fillRect(18 - step, 18, 7, 22);
            ctx.fillStyle = '#c99a5c';
            fillRoundRect(-34, 6, 60, 20, 10);
            ctx.beginPath();
            ctx.ellipse(-6, 6, 18, 9, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#c99a5c';
            ctx.beginPath();
            ctx.moveTo(22, 12); ctx.lineTo(34, -6); ctx.lineTo(40, -4); ctx.lineTo(30, 16);
            ctx.closePath();
            ctx.fill();
            fillRoundRect(32, -14, 16, 11, 5);
            ctx.fillStyle = '#2a2a2a';
            fillCircle(42, -10, 1.4);
            ctx.fillStyle = '#c9503f';
            ctx.fillRect(-28, 0, 44, 5);
            ctx.fillStyle = '#3f8f9e';
            ctx.fillRect(-28, 5, 44, 2);
            ctx.restore();
            ctx.fillStyle = 'rgba(240,213,160,0.9)';
            ctx.beginPath();
            ctx.ellipse(cx, p.y + 40, 34, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            return true;
        }
        case 'argan': {
            ctx.fillStyle = '#7a5530';
            fillRoundRect(p.x, p.y + 2, p.w, p.h - 2, 6);
            ctx.fillStyle = '#5e4024';
            ctx.fillRect(p.x + 4, p.y + p.h - 4, p.w - 8, 3);
            ctx.fillStyle = '#5f8f3a';
            fillCircle(p.x + 10, p.y + 1, 7);
            fillCircle(p.x + p.w - 12, p.y, 8);
            ctx.fillStyle = '#c9a23c';
            fillCircle(p.x + p.w - 10, p.y + 2, 2.5);
            return true;
        }
        case 'fountain': {
            const floor = GROUND_BASE_Y + 46;
            const jet = ctx.createLinearGradient(0, p.y, 0, floor);
            jet.addColorStop(0, 'rgba(170,220,240,0.85)');
            jet.addColorStop(1, 'rgba(90,170,200,0.35)');
            ctx.fillStyle = jet;
            ctx.fillRect(p.x + p.w / 2 - 12, p.y + p.h, 24, Math.max(0, floor - p.y - p.h));
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(p.x + p.w / 2 - 8 + i * 6, p.y + p.h + ((t * 3 + i * 17) % 40), 2, 8);
            }
            ctx.fillStyle = '#e8dcc0';
            fillRoundRect(p.x, p.y, p.w, p.h, 6);
            ctx.fillStyle = '#3f8f9e';
            ctx.fillRect(p.x + 6, p.y + 4, p.w - 12, 3);
            return true;
        }
        case 'train': {
            // Wagen der Brockenbahn, vorne die Dampflok
            const x = p.x;
            const y = p.y;
            const bodyH = 40;
            ctx.fillStyle = '#2e2e34';
            fillRoundRect(x + p.w - 64, y - 6, 64, p.h + bodyH + 6, 6);
            ctx.fillStyle = '#1e1e22';
            ctx.fillRect(x + p.w - 30, y - 30, 14, 26);
            ctx.fillStyle = '#b03a2e';
            ctx.fillRect(x + p.w - 64, y + p.h + bodyH - 10, 64, 6);
            ctx.fillStyle = '#6b2a24';
            fillRoundRect(x, y, p.w - 66, p.h + bodyH, 5);
            ctx.fillStyle = '#e8dcc0';
            for (let wx = x + 10; wx < x + p.w - 84; wx += 28) {
                ctx.fillRect(wx, y + p.h + 6, 18, 14);
            }
            ctx.fillStyle = '#1a1a1e';
            for (let wx = x + 20; wx < x + p.w; wx += 42) {
                fillCircle(wx, y + p.h + bodyH + 4, 8);
            }
            ctx.fillStyle = '#c9c9d0';
            for (let wx = x + 20; wx < x + p.w; wx += 42) {
                fillCircle(wx, y + p.h + bodyH + 4, 3);
            }
            // Dampfwolken aus dem Schornstein
            for (let i = 0; i < 4; i++) {
                const k = ((t * 0.02 + i / 4) % 1);
                ctx.fillStyle = `rgba(235,235,240,${0.7 - k * 0.6})`;
                fillCircle(x + p.w - 23 - k * 40, y - 34 - k * 50, 7 + k * 12);
            }
            return true;
        }
        case 'plankBridge': {
            ctx.strokeStyle = 'rgba(90,70,50,0.8)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x + 2, p.y);
            ctx.lineTo(p.x + 2, p.y - 70);
            ctx.moveTo(p.x + p.w - 2, p.y);
            ctx.lineTo(p.x + p.w - 2, p.y - 70);
            ctx.stroke();
            ctx.fillStyle = '#9a7248';
            fillRoundRect(p.x, p.y, p.w, p.h, 3);
            ctx.fillStyle = '#6e4f30';
            ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
            return true;
        }
        case 'rockLedge': {
            ctx.fillStyle = '#86868c';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.w, p.y);
            ctx.lineTo(p.x + p.w - 8, p.y + p.h + 10);
            ctx.lineTo(p.x + 10, p.y + p.h + 6);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#5f8f3a';
            ctx.fillRect(p.x + 6, p.y - 2, 18, 4);
            ctx.strokeStyle = 'rgba(40,40,45,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x + p.w * 0.5, p.y);
            ctx.lineTo(p.x + p.w * 0.44, p.y + p.h + 6);
            ctx.stroke();
            return true;
        }
        case 'shelfPlank': {
            ctx.fillStyle = '#7a4a26';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#5a3418';
            ctx.fillRect(p.x + 8, p.y + p.h, 5, 14);
            ctx.fillRect(p.x + p.w - 13, p.y + p.h, 5, 14);
            return true;
        }
    }
    return drawPlatformLook2(p, look);
}


/* --- Blöcke: Decken, Schornsteine, Mauern, Theke ... --- */

function drawWallBlock(o, pal) {
    if (drawWallBlock2(o)) return;
    switch (o.look) {
        case 'beam': {
            ctx.fillStyle = '#e8dcc6';
            ctx.fillRect(o.x, o.y - 30, o.w, 30);
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#44291a';
            for (let x = o.x + 30; x < o.x + o.w; x += 90) ctx.fillRect(x, o.y - 30, 12, o.h + 30);
            return;
        }
        case 'oasiCeiling': {
            ctx.fillStyle = '#6b4a30';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            const band = ['#3f8f4a', '#f4f0e6', '#c9503f'];
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = band[i];
                ctx.fillRect(o.x, o.y + o.h - 9 + i * 3, o.w, 3);
            }
            return;
        }
        case 'afroCeiling': {
            ctx.fillStyle = '#6b3f22';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.strokeStyle = 'rgba(240,200,130,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = o.x; x < o.x + o.w; x += 16) {
                ctx.lineTo(x, o.y + o.h - 4);
                ctx.lineTo(x + 8, o.y + 6);
            }
            ctx.stroke();
            return;
        }
        case 'chimney': {
            ctx.fillStyle = '#9a4a38';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            for (let y = o.y + 8; y < o.y + o.h; y += 9) ctx.fillRect(o.x, y, o.w, 2);
            ctx.fillStyle = '#5a5560';
            ctx.fillRect(o.x - 4, o.y - 5, o.w + 8, 6);
            ctx.fillStyle = 'rgba(200,200,210,0.35)';
            const k = (state.time * 0.02 + o.x) % 1;
            fillCircle(o.x + o.w / 2 + k * 10, o.y - 12 - k * 30, 5 + k * 6);
            return;
        }
        case 'pedestal': {
            ctx.fillStyle = '#8a8694';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#a19eab';
            ctx.fillRect(o.x - 4, o.y, o.w + 8, 6);
            ctx.fillRect(o.x - 3, o.y + o.h - 6, o.w + 6, 6);
            ctx.fillStyle = '#c9a25c';
            ctx.fillRect(o.x + 8, o.y + 16, o.w - 16, 10);
            return;
        }
        case 'clockBase': {
            ctx.fillStyle = '#6e6a78';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            for (let y = o.y + 12; y < o.y + o.h; y += 16) ctx.fillRect(o.x, y, o.w, 2);
            ctx.fillStyle = '#3a3448';
            ctx.beginPath();
            ctx.arc(o.x + o.w / 2, o.y + o.h - 30, 16, Math.PI, 0);
            ctx.fillRect(o.x + o.w / 2 - 16, o.y + o.h - 30, 32, 30);
            ctx.fill();
            ctx.fillStyle = '#9a96a6';
            ctx.fillRect(o.x - 4, o.y, o.w + 8, 6);
            return;
        }
        case 'counter': {
            ctx.fillStyle = '#7a4a26';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#e8d6b8';
            ctx.fillRect(o.x - 4, o.y, o.w + 8, 7);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            for (let x = o.x + 40; x < o.x + o.w; x += 80) ctx.fillRect(x, o.y + 9, 3, o.h - 9);
            return;
        }
        case 'cans': {
            const size = 20;
            for (let row = 0; row * size < o.h; row++) {
                for (let col = 0; col * size < o.w; col++) {
                    const cx = o.x + col * size;
                    const cy = o.y + o.h - (row + 1) * size;
                    ctx.fillStyle = '#9aa0a8';
                    ctx.fillRect(cx + 1, cy, size - 2, size);
                    ctx.fillStyle = '#d9a441';
                    ctx.fillRect(cx + 1, cy + 5, size - 2, size - 10);
                    drawPaw(cx + size / 2, cy + size / 2, 2);
                }
            }
            return;
        }
        case 'carpetStack': {
            const colors = ['#c9503f', '#3f8f9e', '#d9a441', '#7a4a8a', '#5a9a5a'];
            const rows = Math.ceil(o.h / 20);
            for (let i = 0; i < rows; i++) {
                ctx.fillStyle = colors[i % colors.length];
                fillRoundRect(o.x, o.y + o.h - (i + 1) * 20, o.w, 19, 9);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(o.x + 8, o.y + o.h - (i + 1) * 20 + 8, o.w - 16, 2);
            }
            return;
        }
        case 'rockWall': {
            ctx.fillStyle = '#7e7e86';
            ctx.beginPath();
            ctx.moveTo(o.x, o.y + o.h);
            ctx.lineTo(o.x + 4, o.y + 10);
            ctx.lineTo(o.x + o.w * 0.4, o.y);
            ctx.lineTo(o.x + o.w, o.y + 8);
            ctx.lineTo(o.x + o.w, o.y + o.h);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#5f8f3a';
            ctx.fillRect(o.x + 6, o.y + 2, o.w - 20, 5);
            ctx.strokeStyle = 'rgba(40,40,45,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(o.x + o.w * 0.3, o.y + 20);
            ctx.lineTo(o.x + o.w * 0.5, o.y + 60);
            ctx.lineTo(o.x + o.w * 0.35, o.y + 100);
            ctx.stroke();
            return;
        }
    }
    ctx.fillStyle = pal.earth[1];
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = o.y + 14; y < o.y + o.h; y += 16) ctx.fillRect(o.x, y, o.w, 2);
}


/* --- Kisten, Gefahren, Sprungbretter mit eigener Optik --- */

function drawCustomProp(o, pal) {
    if (drawCustomProp2(o)) return true;
    if (o.look === 'vespa') {
        const base = o.y + o.h;
        ctx.fillStyle = '#8fd1c0';
        fillRoundRect(o.x + 6, base - 26, o.w - 12, 16, 8);
        fillRoundRect(o.x + o.w - 22, base - 34, 12, 22, 4);
        ctx.fillStyle = '#6fb0a0';
        fillRoundRect(o.x + 10, base - 32, 26, 8, 4);
        ctx.fillStyle = '#2a2a2a';
        fillCircle(o.x + 12, base - 6, 7);
        fillCircle(o.x + o.w - 12, base - 6, 7);
        ctx.fillStyle = '#b8b8c0';
        fillCircle(o.x + 12, base - 6, 3);
        fillCircle(o.x + o.w - 12, base - 6, 3);
        ctx.fillStyle = '#d9d9e0';
        ctx.fillRect(o.x + o.w - 18, base - 40, 12, 3);
        return true;
    }
    if (o.look === 'dresser') {
        ctx.fillStyle = '#7a4a26';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#5a3418';
        ctx.fillRect(o.x + 3, o.y + o.h / 2 - 1, o.w - 6, 2);
        ctx.fillStyle = '#d9b25c';
        fillCircle(o.x + o.w / 2, o.y + o.h / 4, 2);
        fillCircle(o.x + o.w / 2, o.y + (o.h * 3) / 4, 2);
        ctx.fillStyle = '#e8dcc6';
        fillRoundRect(o.x + 6, o.y - 14, 12, 14, 3);
        return true;
    }
    return false;
}

function drawCustomHazard(o, look) {
    if (look === 'spice') { drawSpiceBowls(o); return true; }
    if (look !== 'cactusField') return false;
    const base = o.y + o.h;
    for (let x = o.x + 10; x < o.x + o.w - 6; x += 22) {
        const h = 18 + ((x * 13) % 10);
        ctx.fillStyle = '#4f8f52';
        fillRoundRect(x - 5, base - h, 10, h, 5);
        fillRoundRect(x - 11, base - h * 0.7, 6, 9, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x - 1, base - h + 3, 2, 2);
        ctx.fillRect(x - 1, base - h + 9, 2, 2);
    }
    ctx.fillStyle = 'rgba(200,170,110,0.5)';
    ctx.fillRect(o.x, base - 3, o.w, 3);
    return true;
}

function drawCustomBouncer(cow, look, pal) {
    if (look !== 'camelSit') return false;
    const squash = cow.squash;
    const bottom = cow.y + cow.h;
    const h = cow.h * squash;
    const x = cow.x;
    const y = bottom - h;
    ctx.fillStyle = '#c99a5c';
    fillRoundRect(x, y + h * 0.45, cow.w - 14, h * 0.55, 14);
    ctx.beginPath();
    ctx.ellipse(x + cow.w * 0.38, y + h * 0.5, cow.w * 0.24, h * 0.42, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + cow.w - 20, y + h * 0.6);
    ctx.lineTo(x + cow.w - 6, y + h * 0.1);
    ctx.lineTo(x + cow.w + 2, y + h * 0.16);
    ctx.lineTo(x + cow.w - 8, y + h * 0.7);
    ctx.closePath();
    ctx.fill();
    fillRoundRect(x + cow.w - 8, y, 16, 12, 5);
    ctx.fillStyle = '#2a2a2a';
    fillCircle(x + cow.w + 3, y + 4, 1.5);
    ctx.fillStyle = '#c9503f';
    ctx.fillRect(x + cow.w * 0.2, y + h * 0.28, cow.w * 0.36, 6);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(x + cow.w * 0.2, y + h * 0.28 + 6, cow.w * 0.36, 2);
    return true;
}


/* --- Böden --- */

function drawCustomSurface(block, pal) {
    if (drawCustomSurface2(block)) return true;
    const x = block.x;
    const y = block.y;
    const w = block.w;
    switch (block.surface) {
        case 'pavement': {
            ctx.fillStyle = '#8a8690';
            ctx.fillRect(x, y, w, 14);
            ctx.fillStyle = '#a4a0aa';
            ctx.fillRect(x, y, w, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            for (let sx = x + 36; sx < x + w; sx += 48) ctx.fillRect(sx, y + 4, 2, 10);
            return true;
        }
        case 'roof': {
            ctx.fillStyle = '#9c4f3c';
            ctx.fillRect(x, y, w, 16);
            ctx.strokeStyle = 'rgba(60,25,20,0.4)';
            ctx.lineWidth = 1.5;
            for (let sx = x + 7; sx < x + w; sx += 14) {
                ctx.beginPath();
                ctx.arc(sx, y + 4, 6, Math.PI, 0);
                ctx.stroke();
            }
            ctx.fillStyle = '#6f3529';
            ctx.fillRect(x, y + 13, w, 3);
            return true;
        }
        case 'kitchenTiles': {
            for (let sx = x, i = 0; sx < x + w; sx += 14, i++) {
                ctx.fillStyle = i % 2 ? '#2e2e34' : '#f2efe8';
                ctx.fillRect(sx, y, Math.min(14, x + w - sx), 7);
                ctx.fillStyle = i % 2 ? '#f2efe8' : '#2e2e34';
                ctx.fillRect(sx, y + 7, Math.min(14, x + w - sx), 7);
            }
            return true;
        }
        case 'souk': {
            ctx.fillStyle = '#c9a270';
            ctx.fillRect(x, y, w, 14);
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            for (let sx = x + 10; sx < x + w; sx += 34) {
                ctx.beginPath();
                ctx.ellipse(sx, y + 7, 12, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            return true;
        }
        case 'blueTiles': {
            ctx.fillStyle = '#5f8fd0';
            ctx.fillRect(x, y, w, 16);
            ctx.fillStyle = '#8fb4e6';
            ctx.fillRect(x, y, w, 5);
            ctx.fillStyle = 'rgba(30,50,110,0.25)';
            for (let sx = x + 20; sx < x + w; sx += 40) ctx.fillRect(sx, y + 5, 2, 11);
            return true;
        }
        case 'zellige': {
            const colors = ['#3f8f9e', '#f2ede2', '#d9a441', '#2f6b5a'];
            for (let sx = x, i = 0; sx < x + w; sx += 12, i++) {
                ctx.fillStyle = colors[i % colors.length];
                ctx.beginPath();
                ctx.moveTo(sx + 6, y);
                ctx.lineTo(sx + 12, y + 7);
                ctx.lineTo(sx + 6, y + 14);
                ctx.lineTo(sx, y + 7);
                ctx.closePath();
                ctx.fill();
            }
            return true;
        }
        case 'pool': {
            ctx.fillStyle = '#3f8f9e';
            ctx.fillRect(x, y - 10, w, 24);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            for (let i = 0; i < 6; i++) {
                const wx = x + 20 + ((state.time * 0.6 + i * 53) % (w - 40));
                ctx.fillRect(wx, y - 6 + (i % 3) * 5, 22, 2);
            }
            return true;
        }
    }
    return false;
}

// Dächer in Prag: unter dem Dach steht die Hauswand mit Fenstern
function drawHouseBody(block, depth) {
    ctx.fillStyle = '#6c6480';
    ctx.fillRect(block.x, block.y + 16, block.w, depth);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(block.x, block.y + 16, 6, depth);
    ctx.fillRect(block.x + block.w - 6, block.y + 16, 6, depth);
    ctx.fillStyle = 'rgba(255,206,140,0.7)';
    for (let wy = block.y + 40; wy < block.y + 360; wy += 46) {
        for (let wx = block.x + 22; wx < block.x + block.w - 26; wx += 42) {
            if ((wx + wy) % 5 === 0) continue;
            ctx.fillRect(wx, wy, 14, 20);
        }
    }
}

function drawWaterPit(pit) {
    const top = pit.y + 40;
    const grad = ctx.createLinearGradient(0, top, 0, top + 300);
    grad.addColorStop(0, '#5f93a8');
    grad.addColorStop(1, '#2a4a5a');
    ctx.fillStyle = 'rgba(40,60,50,0.35)';
    ctx.fillRect(pit.x1, pit.y, pit.x2 - pit.x1, 40);
    ctx.fillStyle = grad;
    ctx.fillRect(pit.x1, top, pit.x2 - pit.x1, 900);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 8; i++) {
        const wx = pit.x1 + ((state.time * 0.5 + i * 67) % Math.max(20, pit.x2 - pit.x1 - 20));
        ctx.fillRect(wx, top + 6 + (i % 3) * 8, 20, 2);
    }
}


/* --- Orte und Bauwerke der Kapitel --- */

function drawCustomLandmark(lm, pal) {
    switch (lm.kind) {
        case 'townNight': drawPragHouses(lm, pal); break;
        case 'pragInterior': drawPragInterior(lm); break;
        case 'orloj': drawOrloj(lm); break;
        case 'oasiFacade': drawRestaurantFacade(lm, 'oasi'); break;
        case 'oasiInterior': drawRestaurantInterior(lm, 'oasi'); break;
        case 'kitchen': drawKitchen(lm); break;
        case 'dateCouple': drawDateCouple(lm); break;
        case 'afroFacade': drawRestaurantFacade(lm, 'afro'); break;
        case 'afroInterior': drawRestaurantInterior(lm, 'afro'); break;
        case 'menuBoard': drawMenuBoard(lm); break;
        case 'dogScene': drawDogScene(lm); break;
        case 'arganTree': drawArganTree(lm); break;
        case 'souk': drawSouk(lm); break;
        case 'chefchaouen': drawChefchaouen(lm); break;
        case 'riad': drawRiad(lm); break;
        case 'stampBox': drawStampBox(lm); break;
        case 'rockfallSign': drawRockfallSign(lm); break;
        case 'stationSign': drawStationSign(lm); break;
        case 'viaduct': drawViaduct(lm); break;
        case 'damBridge': drawDamBridge(lm); break;
        case 'waterfall': drawWaterfall(lm); break;
        case 'brockenSign': drawBrockenSign(lm); break;
        default: drawCustomLandmark2(lm);
    }
}

function drawPragInterior(lm) {
    const floor = lm.y;
    const top = lm.y - lm.h;
    // Außenmauer und Dach des aufgeschnittenen Hauses
    ctx.fillStyle = '#5f5580';
    ctx.fillRect(lm.x - 12, top + 40, lm.w + 24, lm.h - 40);
    ctx.fillStyle = '#6f3529';
    ctx.beginPath();
    ctx.moveTo(lm.x - 30, top + 44);
    ctx.lineTo(lm.x + lm.w / 2, top - 10);
    ctx.lineTo(lm.x + lm.w + 30, top + 44);
    ctx.closePath();
    ctx.fill();
    // Innenwand mit Tapete
    ctx.fillStyle = '#e8d8b8';
    ctx.fillRect(lm.x, floor - 150, lm.w - 240, 150);
    ctx.fillStyle = 'rgba(160,110,80,0.18)';
    for (let x = lm.x + 12; x < lm.x + lm.w - 240; x += 24) {
        for (let y = floor - 140; y < floor - 10; y += 24) fillCircle(x + ((y / 24) % 2) * 12, y, 3);
    }
    // Holzvertäfelung unten
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(lm.x, floor - 36, lm.w - 240, 36);
    // Offene Haustür links
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(lm.x - 12, floor - 70, 16, 70);
    // Regal mit Marionetten (Deko) und Bilderrahmen
    ctx.fillStyle = '#6b3f2a';
    ctx.fillRect(lm.x + 60, floor - 96, 70, 5);
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['#c9503f', '#3f6fb0', '#5a9a5a'][i];
        fillRoundRect(lm.x + 66 + i * 22, floor - 114, 12, 18, 3);
        ctx.fillStyle = '#f2d2b0';
        fillCircle(lm.x + 72 + i * 22, floor - 118, 5);
    }
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(lm.x + 240, floor - 120, 50, 38);
    ctx.fillStyle = '#9fb7c9';
    ctx.fillRect(lm.x + 245, floor - 115, 40, 28);
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(lm.x + 470, floor - 118, 44, 36);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(lm.x + 475, floor - 113, 34, 26);
    // Schild "Loutky" (tschechisch: Marionetten)
    ctx.fillStyle = '#6b3f2a';
    fillRoundRect(lm.x + 330, floor - 142, 90, 22, 5);
    ctx.fillStyle = '#f2e3cc';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Loutky', lm.x + 375, floor - 131);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // Treppenhaus rechts
    ctx.fillStyle = '#d8c8a8';
    ctx.fillRect(lm.x + lm.w - 240, floor - 260, 240, 260);
    ctx.fillStyle = 'rgba(90,60,40,0.25)';
    ctx.fillRect(lm.x + lm.w - 240, floor - 260, 6, 260);
    ctx.fillStyle = '#3a3448';
    ctx.fillRect(lm.x + lm.w - 60, floor - 150, 44, 36);
    ctx.fillStyle = '#9fb7c9';
    ctx.fillRect(lm.x + lm.w - 56, floor - 146, 36, 28);
}

function drawOrloj(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    ctx.fillStyle = '#6e6a78';
    ctx.fillRect(cx - 70, base - lm.h, 140, lm.h);
    ctx.fillStyle = '#3a3448';
    ctx.beginPath();
    ctx.moveTo(cx - 80, base - lm.h);
    ctx.lineTo(cx - 40, base - lm.h - 70);
    ctx.lineTo(cx, base - lm.h - 110);
    ctx.lineTo(cx + 40, base - lm.h - 70);
    ctx.lineTo(cx + 80, base - lm.h);
    ctx.closePath();
    ctx.fill();
    // Zifferblatt mit Ringen
    const clockY = base - lm.h + 150;
    ctx.fillStyle = '#2f4a8a';
    fillCircle(cx, clockY, 54);
    ctx.fillStyle = '#c98a4a';
    fillCircle(cx, clockY, 40);
    ctx.fillStyle = '#2a2a3a';
    fillCircle(cx, clockY, 28);
    ctx.strokeStyle = '#d9b25c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, clockY, 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 8, clockY - 6, 20, 0, Math.PI * 2);
    ctx.stroke();
    const a = state.time * 0.004;
    ctx.beginPath();
    ctx.moveTo(cx, clockY);
    ctx.lineTo(cx + Math.cos(a) * 46, clockY + Math.sin(a) * 46);
    ctx.stroke();
    ctx.fillStyle = '#d9b25c';
    fillCircle(cx + Math.cos(a) * 46, clockY + Math.sin(a) * 46, 5);
    // Fensterchen der Apostel
    ctx.fillStyle = '#3a3050';
    for (const dx of [-28, 28]) {
        ctx.beginPath();
        ctx.arc(cx + dx, clockY - 80, 10, Math.PI, 0);
        ctx.fillRect(cx + dx - 10, clockY - 80, 20, 16);
        ctx.fill();
    }
}

function drawRestaurantFacade(lm, style) {
    const base = lm.y;
    const top = base - lm.h;
    const oasi = style === 'oasi';
    ctx.fillStyle = oasi ? '#d9a86a' : '#b8643a';
    ctx.fillRect(lm.x, top, lm.w, lm.h);
    ctx.fillStyle = oasi ? '#c49058' : '#9a5028';
    ctx.fillRect(lm.x, top, lm.w, 14);
    if (!oasi) {
        ctx.strokeStyle = 'rgba(255,220,160,0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = lm.x; x < lm.x + lm.w; x += 20) {
            ctx.lineTo(x, top + 60);
            ctx.lineTo(x + 10, top + 72);
        }
        ctx.stroke();
    }
    // Schild mit dem Namen
    const name = oasi ? PERSONAL.chapters.italien.flag : PERSONAL.chapters.afrika.flag;
    ctx.fillStyle = oasi ? '#2f5a36' : '#4a2a1a';
    fillRoundRect(lm.x + 40, top + 24, lm.w - 80, 34, 8);
    ctx.fillStyle = '#f7eedb';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, lm.x + lm.w / 2, top + 42);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // Markise
    const stripes = oasi ? ['#3f8f4a', '#f4f0e6', '#c9503f'] : ['#d9a441', '#6b3f22'];
    for (let i = 0; i * 20 < lm.w - 70; i++) {
        ctx.fillStyle = stripes[i % stripes.length];
        ctx.beginPath();
        ctx.moveTo(lm.x + i * 20, top + 96);
        ctx.lineTo(lm.x + i * 20 + 20, top + 96);
        ctx.lineTo(lm.x + i * 20 + 24, top + 120);
        ctx.lineTo(lm.x + i * 20 + 4, top + 120);
        ctx.closePath();
        ctx.fill();
    }
    // Fenster mit Kerzenlicht
    for (let i = 0; i < 2; i++) {
        const wx = lm.x + 26 + i * 100;
        ctx.fillStyle = '#4a2a1e';
        fillRoundRect(wx, base - 118, 72, 80, 8);
        ctx.fillStyle = 'rgba(255,196,110,0.8)';
        fillRoundRect(wx + 6, base - 112, 60, 68, 6);
        ctx.fillStyle = '#f3e6cf';
        ctx.fillRect(wx + 32, base - 70, 6, 14);
        ctx.fillStyle = '#ffcf6a';
        fillCircle(wx + 35, base - 74, 3);
    }
    // Offene Tür rechts - hier geht es hinein
    ctx.fillStyle = '#2a1a14';
    fillRoundRect(lm.x + lm.w - 62, base - 110, 56, 110, 8);
    ctx.fillStyle = 'rgba(255,190,110,0.55)';
    fillRoundRect(lm.x + lm.w - 56, base - 104, 44, 104, 6);
    // Pflanzen am Eingang
    ctx.fillStyle = '#a05a3c';
    fillRoundRect(lm.x + lm.w - 86, base - 20, 20, 20, 3);
    ctx.fillStyle = '#4f8f46';
    fillCircle(lm.x + lm.w - 76, base - 30, 12);
}

function drawRestaurantInterior(lm, style) {
    const floor = lm.y;
    const top = floor - lm.h;
    const oasi = style === 'oasi';
    ctx.fillStyle = oasi ? '#8a3a30' : '#8a4a26';
    ctx.fillRect(lm.x, top, lm.w, lm.h);
    ctx.fillStyle = oasi ? '#b8553f' : '#b8703a';
    ctx.fillRect(lm.x, floor - 190, lm.w, 190);
    ctx.fillStyle = oasi ? '#5a2a20' : '#5a3018';
    ctx.fillRect(lm.x, floor - 50, lm.w, 50);
    if (!oasi) {
        ctx.strokeStyle = 'rgba(255,220,170,0.28)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = lm.x; x < lm.x + lm.w; x += 26) {
            ctx.lineTo(x, floor - 120);
            ctx.lineTo(x + 13, floor - 132);
        }
        ctx.stroke();
    }
    // Fenster, Bilder und Lampen im Wechsel
    for (let x = lm.x + 80, i = 0; x < lm.x + lm.w - 80; x += 230, i++) {
        if (i % 2 === 0) {
            ctx.fillStyle = '#3a2018';
            fillRoundRect(x, floor - 170, 70, 80, 8);
            ctx.fillStyle = 'rgba(60,70,110,0.85)';
            fillRoundRect(x + 6, floor - 164, 58, 68, 6);
            ctx.fillStyle = 'rgba(255,240,200,0.8)';
            fillCircle(x + 46, floor - 148, 5);
        } else {
            ctx.fillStyle = '#d9a441';
            ctx.fillRect(x, floor - 160, 60, 46);
            ctx.fillStyle = oasi ? '#5f9a6a' : '#c96a3a';
            ctx.fillRect(x + 5, floor - 155, 50, 36);
            ctx.fillStyle = oasi ? '#e8d6a0' : '#3a5a3a';
            fillCircle(x + 30, floor - 138, 10);
        }
        const lampX = x + 150;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lampX, floor - 190);
        ctx.lineTo(lampX, floor - 150);
        ctx.stroke();
        ctx.fillStyle = '#c98a4a';
        ctx.beginPath();
        ctx.moveTo(lampX - 14, floor - 136);
        ctx.lineTo(lampX, floor - 152);
        ctx.lineTo(lampX + 14, floor - 136);
        ctx.closePath();
        ctx.fill();
        const glow = ctx.createRadialGradient(lampX, floor - 130, 2, lampX, floor - 130, 60);
        glow.addColorStop(0, 'rgba(255,220,150,0.45)');
        glow.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(lampX - 60, floor - 190, 120, 120);
    }
    // Hintertür am Ende
    ctx.fillStyle = '#2a1a14';
    fillRoundRect(lm.x + lm.w - 50, floor - 104, 44, 104, 6);
    ctx.fillStyle = 'rgba(160,190,220,0.35)';
    fillRoundRect(lm.x + lm.w - 44, floor - 98, 32, 98, 4);
}

function drawKitchen(lm) {
    const floor = lm.y;
    ctx.fillStyle = '#e8e6e0';
    ctx.fillRect(lm.x, floor - lm.h, lm.w, lm.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let x = lm.x; x < lm.x + lm.w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, floor - lm.h);
        ctx.lineTo(x, floor);
        ctx.stroke();
    }
    for (let y = floor - lm.h; y < floor; y += 20) {
        ctx.beginPath();
        ctx.moveTo(lm.x, y);
        ctx.lineTo(lm.x + lm.w, y);
        ctx.stroke();
    }
    ctx.fillStyle = '#6b4a30';
    fillRoundRect(lm.x + 20, floor - 180, 90, 24, 6);
    ctx.fillStyle = '#f7eedb';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Küche', lm.x + 65, floor - 168);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // Pfannen und Kellen an der Wand
    for (let x = lm.x + 500; x < lm.x + lm.w - 20; x += 46) {
        ctx.strokeStyle = '#5a5a62';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, floor - 170);
        ctx.lineTo(x, floor - 150);
        ctx.stroke();
        ctx.fillStyle = '#3a3a42';
        fillCircle(x, floor - 140, 12);
    }
}

// Eine sitzende Person am Tisch (Blick zur Tischmitte)
function drawSeatedPerson(x, seatY, colors, facing, longHair, mood) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(facing, 1);
    ctx.fillStyle = colors.pants || colors.shoes;
    ctx.fillRect(-2, seatY - 4, 18, 8);
    ctx.fillRect(12, seatY - 4, 6, 26);
    ctx.fillStyle = colors.shirt || colors.dress;
    fillRoundRect(-8, seatY - 34, 18, 32, 6);
    ctx.fillStyle = colors.hair;
    if (longHair) {
        fillRoundRect(-12, seatY - 56, 22, 34, 10);
    }
    fillCircle(1, seatY - 44, 12);
    ctx.fillStyle = colors.skin;
    fillCircle(4, seatY - 43, 10);
    ctx.fillStyle = '#2c2c2c';
    fillCircle(9, seatY - 45, 1.5);
    ctx.strokeStyle = '#b8556a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (mood === 'yuck') {
        // angewidert: Wellenmund und grünliche Wangen
        ctx.moveTo(4, seatY - 39);
        ctx.lineTo(6, seatY - 41);
        ctx.lineTo(8, seatY - 39);
        ctx.lineTo(10, seatY - 41);
    } else {
        ctx.arc(8, seatY - 40, 3, 0.1 * Math.PI, 0.8 * Math.PI);
    }
    ctx.stroke();
    ctx.fillStyle = mood === 'yuck' ? 'rgba(120,180,80,0.55)' : 'rgba(240,140,150,0.45)';
    fillCircle(6, seatY - 40, 2);
    ctx.strokeStyle = colors.skin;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4, seatY - 28);
    ctx.lineTo(20, seatY - 22);
    ctx.stroke();
    ctx.restore();
}

function drawDateCouple(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    // Stühle
    ctx.fillStyle = '#6b3f2a';
    ctx.fillRect(cx - 100, base - 90, 8, 90);
    ctx.fillRect(cx - 100, base - 44, 36, 7);
    ctx.fillRect(cx + 92, base - 90, 8, 90);
    ctx.fillRect(cx + 64, base - 44, 36, 7);
    // Wir beide
    drawSeatedPerson(cx - 78, base - 44, PERSONAL.heroColors, 1, true);
    drawSeatedPerson(cx + 78, base - 44, PERSONAL.partnerColors, -1, false);
    // Tisch mit Kerze und zwei Gläsern
    ctx.fillStyle = '#f4f0e6';
    fillRoundRect(cx - 58, base - 64, 116, 14, 5);
    ctx.fillStyle = '#c9503f';
    for (let x = cx - 54; x < cx + 54; x += 16) ctx.fillRect(x, base - 52, 8, 5);
    ctx.fillStyle = '#6b3f2a';
    ctx.fillRect(cx - 6, base - 50, 12, 50);
    ctx.fillStyle = '#f3e6cf';
    ctx.fillRect(cx - 4, base - 88, 8, 24);
    ctx.fillStyle = '#ffcf6a';
    ctx.beginPath();
    ctx.ellipse(cx, base - 92 + Math.sin(state.time * 0.15) * 1.2, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,30,50,0.8)';
    ctx.fillRect(cx - 34, base - 78, 8, 12);
    ctx.fillRect(cx + 26, base - 78, 8, 12);
    // Kleine Herzen steigen auf
    for (let i = 0; i < 3; i++) {
        const k = ((state.time * 0.006 + i / 3) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = i % 2 ? '#ff6d8b' : '#ffd0dc';
        heartPath(cx + Math.sin(k * 6 + i) * 14, base - 110 - k * 70, 6);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawMenuBoard(lm) {
    const base = lm.y;
    ctx.strokeStyle = '#6b4a30';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lm.x + 8, base);
    ctx.lineTo(lm.x + lm.w / 2, base - lm.h);
    ctx.lineTo(lm.x + lm.w - 8, base);
    ctx.stroke();
    ctx.fillStyle = '#2e3a32';
    fillRoundRect(lm.x, base - lm.h + 6, lm.w, lm.h - 30, 4);
    ctx.fillStyle = '#f2f2ea';
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tages-', lm.x + lm.w / 2, base - lm.h + 22);
    ctx.fillText('gericht', lm.x + lm.w / 2, base - lm.h + 34);
    ctx.textAlign = 'left';
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawPaw(lm.x + lm.w / 2, base - lm.h + 48, 4);
    ctx.restore();
}

function drawDogScene(lm) {
    const base = lm.y;
    const x = lm.x + 40;
    const t = state.time;
    const wag = Math.sin(t * 0.35) * 0.6;
    // Napf mit dem "Tagesgericht"
    if (!lm.begging) {
        ctx.fillStyle = '#c9503f';
        ctx.beginPath();
        ctx.ellipse(x + 78, base - 6, 20, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5a36';
        ctx.beginPath();
        ctx.ellipse(x + 78, base - 10, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    // Schwanz
    ctx.save();
    ctx.translate(x, base - 30);
    ctx.rotate(-0.6 + wag);
    ctx.fillStyle = '#9a6a3c';
    fillRoundRect(-20, -3, 22, 6, 3);
    ctx.restore();
    // Körper und Beine
    ctx.fillStyle = '#9a6a3c';
    fillRoundRect(x, base - 40, 50, 26, 12);
    ctx.fillRect(x + 6, base - 18, 7, 18);
    ctx.fillRect(x + 36, base - 18, 7, 18);
    // Kopf: frisst (unten) oder schaut bettelnd hoch
    const eating = !lm.begging;
    const headY = eating ? base - 26 + Math.abs(Math.sin(t * 0.25)) * 3 : base - 54;
    const headX = x + 50;
    ctx.fillStyle = '#9a6a3c';
    fillRoundRect(headX - 4, headY - 12, 26, 22, 9);
    ctx.fillStyle = '#6b4526';
    fillRoundRect(headX - 2, headY - 14, 9, 18, 5);
    ctx.fillStyle = '#2a2a2a';
    fillCircle(headX + 20, headY - 1, 2.5);
    fillCircle(headX + 11, headY - 5, 1.6);
    if (!eating) {
        ctx.fillStyle = '#e88a9a';
        fillRoundRect(headX + 14, headY + 6, 5, 8, 2);
    }
    // Sprechblase
    const show = Math.floor(t / 150) % 2 === 0;
    if (show) {
        const bx = x + 40;
        const by = base - (eating ? 84 : 104);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        fillRoundRect(bx, by, 64, 24, 10);
        ctx.beginPath();
        ctx.moveTo(bx + 18, by + 24);
        ctx.lineTo(bx + 26, by + 34);
        ctx.lineTo(bx + 30, by + 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4a3b45';
        ctx.font = 'bold 13px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(eating ? 'Mmmh!' : 'Reste?', bx + 32, by + 12);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
    }
}

function drawGoat(x, y, facing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.fillStyle = '#f2ede2';
    fillRoundRect(-12, -14, 24, 12, 5);
    ctx.fillStyle = '#d9cfb8';
    ctx.fillRect(-10, -3, 3, 5);
    ctx.fillRect(7, -3, 3, 5);
    ctx.fillStyle = '#f2ede2';
    fillRoundRect(9, -22, 11, 10, 4);
    ctx.fillStyle = '#8a7a60';
    ctx.fillRect(10, -26, 2, 5);
    ctx.fillRect(15, -26, 2, 5);
    ctx.fillStyle = '#2a2a2a';
    fillCircle(17, -18, 1.2);
    ctx.restore();
}

function drawArganTree(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    ctx.fillStyle = '#6b4a2c';
    ctx.beginPath();
    ctx.moveTo(cx - 20, base);
    ctx.quadraticCurveTo(cx - 10, base - 70, cx - 30, base - 120);
    ctx.lineTo(cx + 10, base - 124);
    ctx.quadraticCurveTo(cx + 10, base - 60, cx + 22, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6f9a4a';
    for (const [dx, dy, r] of [[-150, -150, 40], [-70, -190, 52], [30, -200, 56], [130, -170, 46], [-10, -150, 44]]) {
        fillCircle(cx + dx, base + dy, r);
    }
    ctx.fillStyle = '#5a8a3a';
    for (const [dx, dy, r] of [[-110, -175, 26], [60, -220, 30], [160, -185, 22]]) {
        fillCircle(cx + dx, base + dy, r);
    }
}

function drawSouk(lm) {
    const base = lm.y;
    ctx.fillStyle = '#c98a5a';
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    for (let x = lm.x + 20, i = 0; x < lm.x + lm.w - 100; x += 170, i++) {
        ctx.fillStyle = '#7a4a2a';
        ctx.beginPath();
        ctx.arc(x + 50, base - 150, 50, Math.PI, 0);
        ctx.fillRect(x, base - 150, 100, 150);
        ctx.fill();
        // Teppiche und Gewürzkegel
        const rug = ['#c9503f', '#3f8f9e', '#7a4a8a', '#d9a441'][i % 4];
        ctx.fillStyle = rug;
        ctx.fillRect(x + 10, base - 170, 34, 70);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + 14, base - 150, 26, 3);
        ctx.fillRect(x + 14, base - 124, 26, 3);
        const spices = ['#d9a441', '#c9503f', '#8a6a2c'];
        for (let s = 0; s < 3; s++) {
            ctx.fillStyle = spices[s];
            ctx.beginPath();
            ctx.moveTo(x + 52 + s * 16, base - 44);
            ctx.lineTo(x + 60 + s * 16, base - 62);
            ctx.lineTo(x + 68 + s * 16, base - 44);
            ctx.closePath();
            ctx.fill();
        }
        // Laterne
        const lx = x + 130;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, base - lm.h);
        ctx.lineTo(lx, base - 200);
        ctx.stroke();
        ctx.fillStyle = '#d9a441';
        fillRoundRect(lx - 8, base - 200, 16, 22, 5);
        const glow = ctx.createRadialGradient(lx, base - 190, 2, lx, base - 190, 40);
        glow.addColorStop(0, 'rgba(255,210,130,0.5)');
        glow.addColorStop(1, 'rgba(255,210,130,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(lx - 40, base - 230, 80, 80);
    }
}

function drawChefchaouen(lm) {
    const base = lm.y;
    ctx.fillStyle = '#7fa6dc';
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    for (let x = lm.x + 10, i = 0; x < lm.x + lm.w; x += 130, i++) {
        const h = 150 + ((i * 47) % 120);
        ctx.fillStyle = i % 2 ? '#6b95d0' : '#8fb4e6';
        ctx.fillRect(x, base - h, 120, h);
        ctx.fillStyle = '#2f5a9a';
        ctx.beginPath();
        ctx.arc(x + 60, base - 40, 18, Math.PI, 0);
        ctx.fillRect(x + 42, base - 40, 36, 40);
        ctx.fill();
        ctx.fillStyle = '#c9503f';
        fillRoundRect(x + 12, base - h + 30, 16, 12, 3);
        ctx.fillStyle = '#5a9a5a';
        fillCircle(x + 20, base - h + 26, 8);
        // Katzen auf den Mauern - die blaue Stadt ist voller Katzen
        if (i % 2 === 0) {
            ctx.fillStyle = i % 4 === 0 ? '#3a3a42' : '#d9a441';
            const catX = x + 86;
            const catY = base - h;
            fillRoundRect(catX, catY - 10, 18, 10, 5);
            fillCircle(catX + 18, catY - 12, 5);
            ctx.beginPath();
            ctx.moveTo(catX + 14, catY - 15); ctx.lineTo(catX + 16, catY - 21); ctx.lineTo(catX + 19, catY - 16);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(catX, catY - 4);
            ctx.quadraticCurveTo(catX - 8, catY + 4 + Math.sin(state.time * 0.05 + i) * 3, catX - 4, catY + 12);
            ctx.stroke();
        }
    }
}

function drawRiad(lm) {
    const base = lm.y;
    ctx.fillStyle = '#e8d6b0';
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    const colors = ['#3f8f9e', '#f2ede2', '#d9a441', '#2f6b5a'];
    for (let x = lm.x, i = 0; x < lm.x + lm.w; x += 14, i++) {
        ctx.fillStyle = colors[i % 4];
        ctx.fillRect(x, base - 70, 14, 14);
    }
    for (let x = lm.x + 40; x < lm.x + lm.w - 120; x += 180) {
        ctx.fillStyle = '#c9a270';
        ctx.beginPath();
        ctx.arc(x + 60, base - 170, 60, Math.PI, 0);
        ctx.fillRect(x, base - 170, 120, 100);
        ctx.fill();
        ctx.fillStyle = 'rgba(90,60,30,0.35)';
        ctx.beginPath();
        ctx.arc(x + 60, base - 162, 46, Math.PI, 0);
        ctx.fillRect(x + 14, base - 162, 92, 92);
        ctx.fill();
    }
    // Orangenbäumchen
    for (const dx of [70, lm.w - 90]) {
        ctx.fillStyle = '#6b4a2c';
        ctx.fillRect(lm.x + dx, base - 50, 6, 50);
        ctx.fillStyle = '#4f8f46';
        fillCircle(lm.x + dx + 3, base - 60, 22);
        ctx.fillStyle = '#e8943a';
        fillCircle(lm.x + dx - 8, base - 62, 4);
        fillCircle(lm.x + dx + 12, base - 54, 4);
    }
}

function drawStampBox(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(cx - 3, base - 70, 6, 70);
    ctx.fillStyle = '#2f6b3a';
    fillRoundRect(cx - 18, base - 96, 36, 30, 4);
    ctx.fillStyle = '#f2ede2';
    ctx.font = 'bold 9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stempel', cx, base - 84);
    ctx.fillText('stelle', cx, base - 74);
    ctx.textAlign = 'left';
}

function drawRockfallSign(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    ctx.fillStyle = '#8a8a90';
    ctx.fillRect(cx - 2, base - 60, 4, 60);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, base - 92); ctx.lineTo(cx + 22, base - 56); ctx.lineTo(cx - 22, base - 56);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c9303a';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    fillCircle(cx - 5, base - 64, 3);
    fillCircle(cx + 3, base - 71, 2.5);
    fillCircle(cx + 6, base - 63, 2);
}

function drawStationSign(lm) {
    const base = lm.y;
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(lm.x + 10, base - 90, 5, 90);
    ctx.fillRect(lm.x + lm.w - 15, base - 90, 5, 90);
    ctx.fillStyle = '#f4f4ee';
    fillRoundRect(lm.x, base - 110, lm.w, 28, 4);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Drei Annen Hohne', lm.x + lm.w / 2, base - 96);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}

function drawViaduct(lm) {
    const rail = lm.y + 38;
    ctx.fillStyle = '#7e7a74';
    ctx.fillRect(lm.x, rail, lm.w, 12);
    for (let x = lm.x + 30; x < lm.x + lm.w - 20; x += 110) {
        ctx.fillRect(x, rail + 12, 22, 300);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 16, rail + 12, 6, 300);
        ctx.fillStyle = '#7e7a74';
        ctx.beginPath();
        ctx.arc(x + 76, rail + 12, 54, Math.PI, 0, true);
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#7e7a74';
        ctx.stroke();
    }
    ctx.fillStyle = '#4a4a50';
    ctx.fillRect(lm.x, rail - 2, lm.w, 3);
}

function drawDamBridge(lm) {
    const deck = lm.y - 6;
    const leftX = lm.x + 10;
    const rightX = lm.x + lm.w - 10;
    const topY = deck - 150;
    ctx.fillStyle = '#6e6e76';
    ctx.fillRect(leftX - 8, topY, 16, 170);
    ctx.fillRect(rightX - 8, topY, 16, 170);
    ctx.strokeStyle = 'rgba(70,70,80,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.quadraticCurveTo((leftX + rightX) / 2, deck + 10, rightX, topY);
    ctx.stroke();
    // Staumauer weit unten
    ctx.fillStyle = '#9a9aa2';
    ctx.fillRect(lm.x + lm.w - 70, lm.y + 120, 70, 300);
}

function drawWaterfall(lm) {
    const base = lm.y;
    const top = base - lm.h;
    ctx.fillStyle = '#6e6e76';
    ctx.fillRect(lm.x - 20, top, lm.w + 40, lm.h + 40);
    const water = ctx.createLinearGradient(0, top, 0, base);
    water.addColorStop(0, 'rgba(190,225,240,0.9)');
    water.addColorStop(1, 'rgba(120,180,210,0.9)');
    ctx.fillStyle = water;
    ctx.fillRect(lm.x, top, lm.w, lm.h + 40);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 10; i++) {
        const sx = lm.x + 8 + i * (lm.w - 16) / 10;
        const sy = top + ((state.time * 4 + i * 37) % lm.h);
        ctx.fillRect(sx, sy, 3, 24);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 4; i++) {
        fillCircle(lm.x + i * lm.w / 3, base + 30 + Math.sin(state.time * 0.05 + i) * 4, 18);
    }
}

function drawBrockenSign(lm) {
    const base = lm.y;
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(lm.x + lm.w / 2 - 3, base - 80, 6, 80);
    ctx.fillStyle = '#8a6540';
    fillRoundRect(lm.x - 10, base - 100, lm.w + 20, 34, 5);
    ctx.fillStyle = '#f2ede2';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Brocken', lm.x + lm.w / 2, base - 86);
    ctx.font = '11px Georgia, serif';
    ctx.fillText('1141 m', lm.x + lm.w / 2, base - 72);
    ctx.textAlign = 'left';
}



/* --- Zeichnen der weiteren Mechaniken -------------------------------- */

function drawRollerHazard(hz) {
    if (hz.x + hz.w < camera.x - 60 || hz.x > camera.x + viewWidth + 60) return;
    for (const r of rollerInstances(hz)) {
        if (!r.moving) {
            if (hz.look === 'tram') drawTramWarning(hz);
            continue;
        }
        let alpha = 1;
        if (hz.look !== 'tram') {
            const fadeIn = hz.clip ? 1 : clamp((hz.x2 - r.x) / 20, 0, 1);
            alpha = fadeIn * clamp((r.x - (hz.x1 - hz.rw)) / 20, 0, 1);
        }
        if (alpha <= 0) continue;
        ctx.save();
        if (hz.clip) {
            // kommt sichtbar aus Tunnel/Einfahrt und fährt wieder hinein
            ctx.beginPath();
            ctx.rect(hz.clip[0], r.y - 220, hz.clip[1] - hz.clip[0], hz.rh + 260);
            ctx.clip();
        }
        ctx.globalAlpha = alpha;
        drawRollerObject(hz, r.x, r.y);
        ctx.restore();
        if (hz.look === 'tram' && r.x > camera.x + viewWidth - 60) drawTramWarning(hz);
    }
}

// "Bim bim!" - die Straßenbahn kündigt sich an, auch wenn sie noch nicht zu sehen ist
function drawTramWarning(hz) {
    const x = clamp(hz.x2 - 120, camera.x + 80, camera.x + viewWidth - 140);
    const y = hz.groundY - 170;
    const blink = Math.floor(state.time / 8) % 2 === 0;
    ctx.fillStyle = 'rgba(38,28,36,0.85)';
    fillRoundRect(x, y, 112, 32, 9);
    ctx.fillStyle = blink ? '#ffd84a' : '#9a7a22';
    ctx.beginPath();
    ctx.arc(x + 18, y + 16, 8, Math.PI, 0);
    ctx.lineTo(x + 28, y + 22);
    ctx.lineTo(x + 8, y + 22);
    ctx.closePath();
    ctx.fill();
    fillCircle(x + 18, y + 25, 2.5);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Bim bim!', x + 36, y + 17);
    ctx.textBaseline = 'alphabetic';
}

function drawRollerObject(hz, x, y) {
    const w = hz.rw;
    const h = hz.rh;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const R = w / 2;
    const spin = x / R;     // rollt nach links
    switch (hz.look) {
        case 'barrel': {
            ctx.fillStyle = '#8a5a30';
            fillCircle(cx, cy, R);
            ctx.strokeStyle = '#4a4a50';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, R - 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(60,35,15,0.7)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const a = spin + (i * Math.PI) / 3;
                ctx.beginPath();
                ctx.moveTo(cx - Math.cos(a) * (R - 3), cy - Math.sin(a) * (R - 3));
                ctx.lineTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3));
                ctx.stroke();
            }
            ctx.fillStyle = '#d9a441';
            fillCircle(cx, cy, 3);
            return;
        }
        case 'tomato': {
            const by = cy - Math.abs(Math.sin(x * 0.09)) * 6;
            ctx.fillStyle = '#d9392f';
            fillCircle(cx, by, R);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            fillCircle(cx - R * 0.35, by - R * 0.35, R * 0.25);
            ctx.fillStyle = '#3f8f3a';
            ctx.save();
            ctx.translate(cx, by);
            ctx.rotate(spin);
            for (let i = 0; i < 5; i++) {
                ctx.rotate((Math.PI * 2) / 5);
                ctx.fillRect(-1, -R - 1, 2, 5);
            }
            ctx.restore();
            return;
        }
        case 'orange': {
            ctx.fillStyle = '#ef8a1f';
            fillCircle(cx, cy, R);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            fillCircle(cx - R * 0.3, cy - R * 0.3, R * 0.25);
            ctx.fillStyle = '#4f8f3a';
            fillCircle(cx + Math.cos(spin) * R * 0.7, cy + Math.sin(spin) * R * 0.7, 2.5);
            return;
        }
        case 'log': {
            ctx.fillStyle = '#b8864c';
            fillCircle(cx, cy, R);
            ctx.strokeStyle = '#5a3a22';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, R - 1.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(107,69,38,0.8)';
            ctx.lineWidth = 1.5;
            for (const k of [0.65, 0.35]) {
                ctx.beginPath();
                ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(spin) * R * 0.9, cy + Math.sin(spin) * R * 0.9);
            ctx.stroke();
            return;
        }
        case 'scooter': {
            // Roller fährt nach links: Front links
            const base = y + h;
            const wheel = spin * 1.2;
            ctx.fillStyle = '#c9503f';
            fillRoundRect(x + 10, base - 24, w - 18, 14, 7);
            fillRoundRect(x + 4, base - 34, 12, 22, 4);
            ctx.fillStyle = '#e8e2d6';
            ctx.fillRect(x + 2, base - 38, 14, 3);
            ctx.fillStyle = '#3a3a42';
            fillRoundRect(x + w - 34, base - 30, 24, 7, 3);
            for (const wx of [x + 12, x + w - 12]) {
                ctx.fillStyle = '#2a2a2a';
                fillCircle(wx, base - 6, 7);
                ctx.strokeStyle = '#b8b8c0';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(wx - Math.cos(wheel) * 5, base - 6 - Math.sin(wheel) * 5);
                ctx.lineTo(wx + Math.cos(wheel) * 5, base - 6 + Math.sin(wheel) * 5);
                ctx.stroke();
            }
            // Fahrer mit Helm
            ctx.fillStyle = '#3f6fb0';
            fillRoundRect(x + w - 34, base - 52, 16, 22, 5);
            ctx.fillStyle = '#f0c29c';
            fillCircle(x + w - 30, base - 58, 6);
            ctx.fillStyle = '#f4f0e6';
            ctx.beginPath();
            ctx.arc(x + w - 30, base - 60, 7, Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#3f6fb0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + w - 32, base - 46);
            ctx.lineTo(x + 12, base - 36);
            ctx.stroke();
            return;
        }
        case 'tram': {
            // Prager Tatra-Straßenbahn in Rot-Creme, Front links
            const top = y;
            const bottom = y + h;
            ctx.strokeStyle = '#3a3a42';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + w * 0.45, top);
            ctx.lineTo(x + w * 0.55, top - 18);
            ctx.lineTo(x + w * 0.4, top - 30);
            ctx.stroke();
            ctx.fillStyle = '#f2e6cf';
            fillRoundRect(x, top, w, h - 8, 14);
            ctx.fillStyle = '#c8323a';
            fillRoundRect(x, top + h * 0.48, w, h * 0.52 - 8, 8);
            ctx.fillStyle = '#9a9aa2';
            ctx.fillRect(x + 12, top - 4, w - 24, 5);
            ctx.fillStyle = '#44506a';
            fillRoundRect(x + 6, top + 8, 26, h * 0.34, 8);
            for (let wx = x + 42; wx < x + w - 24; wx += 30) {
                fillRoundRect(wx, top + 10, 22, h * 0.3, 3);
            }
            ctx.fillStyle = '#ffd84a';
            fillCircle(x + 8, top + h * 0.62, 4);
            ctx.fillStyle = '#2a2a2a';
            fillRoundRect(x + w - 46, top + 4, 30, 12, 3);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('22', x + w - 31, top + 14);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#1e1e22';
            for (const wx of [x + 34, x + 64, x + w - 64, x + w - 34]) fillCircle(wx, bottom - 6, 7);
            return;
        }
    }
    ctx.fillStyle = '#7a7a82';
    fillCircle(cx, cy, R);
}

function drawPendulumHazard(hz) {
    const b = pendulumBob(hz);
    ctx.strokeStyle = hz.look === 'lantern' ? '#6b5a3a' : '#4a3a30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hz.px, hz.py);
    ctx.lineTo(b.x, b.y - hz.r * 0.6);
    ctx.stroke();
    ctx.fillStyle = '#3a2a22';
    fillRoundRect(hz.px - 8, hz.py - 4, 16, 6, 2);

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(-b.a);
    const r = hz.r;
    switch (hz.look) {
        case 'chandelier': {
            ctx.strokeStyle = '#d9b25c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 2, r * 1.2, r * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#d9b25c';
            fillCircle(0, 0, r * 0.45);
            for (const dx of [-r * 1.1, 0, r * 1.1]) {
                ctx.fillStyle = '#f3e6cf';
                ctx.fillRect(dx - 2, -10, 4, 9);
                ctx.fillStyle = '#ffcf6a';
                ctx.beginPath();
                ctx.ellipse(dx, -13 + Math.sin(state.time * 0.3 + dx) * 0.8, 2.5, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }
        case 'lamp': {
            const glow = ctx.createRadialGradient(0, 4, 2, 0, 4, r * 3);
            glow.addColorStop(0, 'rgba(255,210,130,0.45)');
            glow.addColorStop(1, 'rgba(255,210,130,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6);
            ctx.fillStyle = '#c98a3a';
            ctx.beginPath();
            ctx.moveTo(-4, -r);
            ctx.lineTo(4, -r);
            ctx.lineTo(r, r * 0.7);
            ctx.lineTo(-r, r * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7a4a1c';
            ctx.lineWidth = 1.5;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 2, -r);
                ctx.lineTo(i * r * 0.4, r * 0.7);
                ctx.stroke();
            }
            ctx.fillStyle = '#ffe3a0';
            fillCircle(0, r * 0.75, 3);
            break;
        }
        case 'lantern': {
            const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 3);
            glow.addColorStop(0, 'rgba(255,200,110,0.5)');
            glow.addColorStop(1, 'rgba(255,200,110,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6);
            ctx.fillStyle = '#b8903c';
            ctx.beginPath();
            ctx.moveTo(0, -r - 4);
            ctx.lineTo(r * 0.8, -r * 0.3);
            ctx.lineTo(r * 0.8, r * 0.5);
            ctx.lineTo(0, r + 2);
            ctx.lineTo(-r * 0.8, r * 0.5);
            ctx.lineTo(-r * 0.8, -r * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffe3a0';
            for (const [dx, dy] of [[0, -2], [-4, 5], [4, 5]]) fillCircle(dx, dy, 1.8);
            break;
        }
        default:
            ctx.fillStyle = '#4a4a52';
            fillCircle(0, 0, r);
    }
    ctx.restore();
}

function drawStaticHazard(hz) {
    if (hz.look === 'quicksandPool') { drawQuicksandPool(hz); return; }
    if (hz.look === 'spruceBranch') {
        // Fichtenast ragt von oben ins Tal
        ctx.strokeStyle = '#5a3a22';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(hz.x + hz.w + 20, hz.y - 60);
        ctx.quadraticCurveTo(hz.x + hz.w, hz.y + 4, hz.x, hz.y + hz.h / 2);
        ctx.stroke();
        ctx.fillStyle = '#2f5a36';
        for (let i = 0; i < 6; i++) {
            const bx = hz.x + (i / 5) * hz.w;
            ctx.beginPath();
            ctx.moveTo(bx - 10, hz.y + 4);
            ctx.lineTo(bx + 10, hz.y + 4);
            ctx.lineTo(bx, hz.y + hz.h);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = '#3f7a46';
        fillRoundRect(hz.x - 6, hz.y - 4, hz.w + 12, 12, 6);
        return;
    }
    ctx.fillStyle = '#7a3a3a';
    ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
}

function drawChimneySmoke(hz, st) {
    const bottom = hz.y + hz.h;
    const cx = hz.x + hz.w / 2;
    const t = state.time;
    if (st === 'on') {
        for (let i = 0; i < 7; i++) {
            const k = ((t * 0.06 + i / 7) % 1);
            ctx.fillStyle = `rgba(90,86,96,${0.75 - k * 0.45})`;
            fillCircle(cx + Math.sin(t * 0.1 + i) * 5, bottom - k * hz.h, 11 + k * 9);
        }
    } else if (st === 'warn') {
        for (let i = 0; i < 3; i++) {
            const k = ((t * 0.04 + i / 3) % 1);
            ctx.fillStyle = `rgba(120,116,126,${0.5 - k * 0.4})`;
            fillCircle(cx + Math.sin(t * 0.3 + i) * 3, bottom - 6 - k * 30, 5 + k * 4);
        }
    }
}

function drawStalactite(x, y, w, h) {
    ctx.fillStyle = '#a49c92';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + w * 0.35, y + 2, 2, h * 0.5);
}


/* --- Plattformen, Blöcke, Böden --- */

function drawPlatformLook2(p, look) {
    switch (look) {
        case 'paternoster': {
            // offene Holzkabine: der Boden ist die Plattform
            ctx.fillStyle = 'rgba(90,55,30,0.9)';
            ctx.fillRect(p.x, p.y - 68, p.w, 68);
            ctx.fillStyle = '#4a2c18';
            ctx.fillRect(p.x, p.y - 72, p.w, 6);
            ctx.fillRect(p.x, p.y - 68, 4, 68);
            ctx.fillRect(p.x + p.w - 4, p.y - 68, 4, 68);
            ctx.fillStyle = '#b8864c';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#ffe3a0';
            fillCircle(p.x + p.w / 2, p.y - 60, 3);
            return true;
        }
        case 'gondola': {
            const cx = p.x + p.w / 2;
            ctx.strokeStyle = '#3a3a42';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, p.y - 72);
            ctx.lineTo(cx, p.y - 50);
            ctx.lineTo(p.x + 6, p.y - 16);
            ctx.moveTo(cx, p.y - 50);
            ctx.lineTo(p.x + p.w - 6, p.y - 16);
            ctx.stroke();
            ctx.fillStyle = '#2a2a2a';
            fillCircle(cx - 6, p.y - 74, 4);
            fillCircle(cx + 6, p.y - 74, 4);
            ctx.fillStyle = '#c9503f';
            fillRoundRect(p.x, p.y - 16, p.w, 16 + p.h, 5);
            ctx.fillStyle = '#e8d6b8';
            ctx.fillRect(p.x + 4, p.y - 12, p.w - 8, 3);
            return true;
        }
        case 'awning':
        case 'djembe':
        case 'doughPad': {
            ctx.save();
            const bottom = p.y + p.h;
            ctx.translate(0, bottom);
            ctx.scale(1, p.squash || 1);
            ctx.translate(0, -bottom);
            if (look === 'awning') {
                const stripes = ['#c9503f', '#f2ede2'];
                for (let i = 0; i < 6; i++) {
                    ctx.fillStyle = stripes[i % 2];
                    const sx = p.x - 6 + (i * (p.w + 12)) / 6;
                    ctx.fillRect(sx, p.y, (p.w + 12) / 6 + 0.5, p.h);
                }
                ctx.fillStyle = '#8a5a30';
                ctx.fillRect(p.x - 4, p.y + p.h, 3, 30);
                ctx.fillRect(p.x + p.w + 1, p.y + p.h, 3, 30);
            } else if (look === 'djembe') {
                ctx.fillStyle = '#7a4a26';
                ctx.beginPath();
                ctx.moveTo(p.x, p.y + 4);
                ctx.lineTo(p.x + p.w, p.y + 4);
                ctx.lineTo(p.x + p.w * 0.66, p.y + 26);
                ctx.lineTo(p.x + p.w * 0.8, p.y + 40);
                ctx.lineTo(p.x + p.w * 0.2, p.y + 40);
                ctx.lineTo(p.x + p.w * 0.34, p.y + 26);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#e8d6b8';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                    ctx.lineTo(p.x + 4 + (i * (p.w - 8)) / 6, p.y + (i % 2 ? 22 : 6));
                }
                ctx.stroke();
                ctx.fillStyle = '#e8d6b0';
                ctx.beginPath();
                ctx.ellipse(p.x + p.w / 2, p.y + 4, p.w / 2, 5, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#f2e2c0';
                ctx.beginPath();
                ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2 + 2, p.w / 2 + 4, p.h / 2 + 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(200,160,110,0.5)';
                fillCircle(p.x + p.w * 0.35, p.y + 4, 3);
                fillCircle(p.x + p.w * 0.65, p.y + 7, 2);
            }
            ctx.restore();
            return true;
        }
        case 'shelterRoof': {
            ctx.fillStyle = '#7a8a96';
            ctx.fillRect(p.x + 8, p.y + p.h, 4, 80 - p.h);
            ctx.fillRect(p.x + p.w - 12, p.y + p.h, 4, 80 - p.h);
            ctx.fillStyle = '#5a6a78';
            fillRoundRect(p.x, p.y, p.w, p.h, 3);
            ctx.fillStyle = 'rgba(190,220,240,0.6)';
            ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 3);
            return true;
        }
    }
    return false;
}

function drawWallBlock2(o) {
    switch (o.look) {
        case 'caveCeiling': {
            ctx.fillStyle = '#3a3438';
            ctx.fillRect(o.x, o.y - 200, o.w, o.h + 200);
            ctx.fillStyle = '#4a4248';
            for (let x = o.x + 6; x < o.x + o.w - 10; x += 22) {
                const len = 8 + ((x * 7) % 12);
                ctx.beginPath();
                ctx.moveTo(x, o.y + o.h);
                ctx.lineTo(x + 12, o.y + o.h);
                ctx.lineTo(x + 6, o.y + o.h + len);
                ctx.closePath();
                ctx.fill();
            }
            return true;
        }
        case 'stalagmite': {
            ctx.fillStyle = '#d2c4b0';
            ctx.strokeStyle = '#fff4dc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(o.x, o.y + o.h);
            ctx.lineTo(o.x + 6, o.y + 10);
            ctx.quadraticCurveTo(o.x + o.w / 2, o.y - 6, o.x + o.w - 6, o.y + 10);
            ctx.lineTo(o.x + o.w, o.y + o.h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(o.x + o.w * 0.3, o.y + 8, 3, o.h - 12);
            return true;
        }
    }
    return false;
}

function drawCustomProp2(o) {
    if (o.look === 'spiceCrate') { drawSpiceCrate(o); return true; }
    if (o.look !== 'bench') return false;
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(o.x, o.y + 6, o.w, 8);
    ctx.fillRect(o.x + 4, o.y + 14, 5, o.h - 14);
    ctx.fillRect(o.x + o.w - 9, o.y + 14, 5, o.h - 14);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(o.x, o.y, o.w, 6);
    return true;
}

function drawCustomOverhang(o) {
    switch (o.look) {
        case 'archway': {
            // niedriger Torbogen: ein Haus mit Durchgang, unter dem man sich duckt
            // Die Trefferfläche ist das ganze Haus - Zeichnung und Kollision decken sich
            const bottom = o.y + o.h;
            const groundY = bottom + PLAYER_DUCK_HEIGHT + 8;
            ctx.fillStyle = '#6a5f84';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#5a4f72';
            ctx.fillRect(o.x - 6, o.y - 6, o.w + 12, 10);
            ctx.fillStyle = 'rgba(255,214,150,0.65)';
            ctx.fillRect(o.x + 10, bottom - 176, 22, 30);
            ctx.fillRect(o.x + o.w - 32, bottom - 176, 22, 30);
            ctx.fillRect(o.x + 10, bottom - 116, 22, 30);
            ctx.fillRect(o.x + o.w - 32, bottom - 116, 22, 30);
            ctx.fillStyle = 'rgba(30,24,36,0.5)';
            ctx.fillRect(o.x, o.y + o.h, o.w, groundY - o.y - o.h);
            ctx.fillStyle = '#6a5f84';
            ctx.fillRect(o.x, bottom, 14, groundY - bottom);
            ctx.fillRect(o.x + o.w - 14, bottom, 14, groundY - bottom);
            ctx.fillStyle = '#9a90b0';
            ctx.fillRect(o.x - 2, o.y + o.h - 6, o.w + 4, 6);
            return true;
        }
        case 'pubSign': {
            ctx.fillStyle = '#2a2a30';
            ctx.fillRect(o.x, o.y - 80, 5, 84);
            ctx.fillRect(o.x, o.y, o.w, 4);
            ctx.fillStyle = '#2f5a36';
            fillRoundRect(o.x + 10, o.y + 4, o.w - 16, o.h - 4, 4);
            ctx.strokeStyle = '#d9b25c';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(o.x + 13, o.y + 7, o.w - 22, o.h - 10);
            ctx.fillStyle = '#f2d27a';
            ctx.font = 'bold 11px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('PIVO', o.x + o.w / 2 + 3, o.y + 19);
            ctx.textAlign = 'left';
            return true;
        }
        case 'stalactites': {
            // dunkler Fels, die gefährliche Unterkante hell mit Umriss
            ctx.fillStyle = '#5e545c';
            ctx.fillRect(o.x, o.y - 140, o.w, 140 + o.h - 12);
            ctx.fillStyle = '#d2c4b0';
            ctx.strokeStyle = '#fff4dc';
            ctx.lineWidth = 1.5;
            for (let x = o.x; x < o.x + o.w; x += 16) {
                ctx.beginPath();
                ctx.moveTo(x, o.y + o.h - 14);
                ctx.lineTo(x + 16, o.y + o.h - 14);
                ctx.lineTo(x + 8, o.y + o.h);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            return true;
        }
        case 'hams': {
            ctx.fillStyle = '#5a5a62';
            ctx.fillRect(o.x, o.y - 40, 3, 44);
            ctx.fillRect(o.x + o.w - 3, o.y - 40, 3, 44);
            ctx.fillRect(o.x, o.y, o.w, 4);
            for (let x = o.x + 10, i = 0; x < o.x + o.w - 12; x += 22, i++) {
                ctx.fillStyle = i % 2 ? '#a0463a' : '#c98a5a';
                const sway = Math.sin(state.time * 0.04 + i) * 1.5;
                fillRoundRect(x + sway, o.y + 4, 12, o.h - 4, 6);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                fillCircle(x + 4 + sway, o.y + 10, 1.5);
            }
            return true;
        }
    }
    return false;
}

function drawCustomSurface2(block) {
    const x = block.x;
    const y = block.y;
    const w = block.w;
    switch (block.surface) {
        case 'oil': {
            ctx.fillStyle = '#8a5a34';
            ctx.fillRect(x, y, w, 14);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            for (let sx = x + 30; sx < x + w; sx += 60) ctx.fillRect(sx, y, 2, 14);
            ctx.fillStyle = 'rgba(170,160,40,0.75)';
            ctx.beginPath();
            ctx.ellipse(x + w * 0.5, y + 2, w * 0.48, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,220,0.6)';
            ctx.fillRect(x + w * 0.3, y, w * 0.2, 2);
            ctx.fillRect(x + w * 0.62, y + 2, w * 0.12, 1.5);
            // Warnschild "Vorsicht, rutschig"
            ctx.fillStyle = '#f2c53a';
            ctx.beginPath();
            ctx.moveTo(x + 4, y);
            ctx.lineTo(x + 14, y - 30);
            ctx.lineTo(x + 24, y);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#2a2a2a';
            ctx.font = 'bold 13px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', x + 14, y - 6);
            ctx.textAlign = 'left';
            return true;
        }
        case 'tramRails': {
            ctx.fillStyle = '#8a8690';
            ctx.fillRect(x, y, w, 16);
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            for (let sx = x + 8; sx < x + w; sx += 16) ctx.fillRect(sx, y + 4, 10, 4);
            ctx.fillStyle = '#c8c8d0';
            ctx.fillRect(x, y + 1, w, 2);
            ctx.fillRect(x, y + 10, w, 2);
            return true;
        }
        case 'quicksand': {
            ctx.fillStyle = '#c29a5c';
            ctx.fillRect(x, y, w, 16);
            ctx.strokeStyle = 'rgba(120,85,40,0.45)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
                const k = ((state.time * 0.01 + i / 4) % 1);
                ctx.beginPath();
                ctx.ellipse(x + w * (0.2 + i * 0.2), y + 5, 6 + k * 22, 2 + k * 3, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(90,60,30,0.5)';
            fillCircle(x + w * 0.4 + Math.sin(state.time * 0.05) * 20, y + 4, 2);
            return true;
        }
        case 'caveFloor': {
            ctx.fillStyle = '#a89a8a';
            ctx.fillRect(x, y, w, 14);
            ctx.fillStyle = '#efe2cb';
            ctx.fillRect(x, y, w, 3);
            ctx.fillStyle = '#8a7e72';
            for (let sx = x + 10; sx < x + w; sx += 26) {
                ctx.beginPath();
                ctx.ellipse(sx, y + 3, 7, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            return true;
        }
        case 'tannery': {
            ctx.fillStyle = '#c08a5a';
            ctx.fillRect(x, y, w, 12);
            ctx.fillStyle = '#9a6a42';
            ctx.fillRect(x, y + 10, w, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x + 3, y + 2, w - 6, 2);
            return true;
        }
    }
    return false;
}

function drawCustomPit(pit) {
    if (pit.look === 'water') { drawWaterPit(pit); return true; }
    if (pit.look === 'dye') {
        const colors = ['#c9503f', '#d9a441', '#3f7fae', '#6b8f3a', '#8a4a8a'];
        const color = colors[Math.floor(pit.x1 / 57) % colors.length];
        ctx.fillStyle = '#7a5236';
        ctx.fillRect(pit.x1, pit.y + 8, pit.x2 - pit.x1, 900);
        ctx.fillStyle = color;
        ctx.fillRect(pit.x1, pit.y + 16, pit.x2 - pit.x1, 900);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        const span = Math.max(10, pit.x2 - pit.x1 - 16);
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(pit.x1 + 6 + ((state.time * 0.3 + i * 23) % span), pit.y + 20 + i * 5, 10, 2);
        }
        return true;
    }
    if (pit.look === 'shaft') {
        ctx.fillStyle = '#1e1a22';
        ctx.fillRect(pit.x1, pit.y, pit.x2 - pit.x1, 900);
        ctx.fillStyle = '#4a4046';
        ctx.fillRect(pit.x1 + 10, pit.y, 3, 900);
        ctx.fillRect(pit.x2 - 13, pit.y, 3, 900);
        return true;
    }
    return false;
}


/* --- Orte und Kulissen --- */

function drawCustomLandmark2(lm) {
    switch (lm.kind) {
        case 'pragHouse': drawPragHouse(lm); break;
        case 'pubDoor': drawPubDoor(lm); break;
        case 'paternosterShaft': drawPaternosterShaft(lm); break;
        case 'tramStop': drawTramStop(lm); break;
        case 'tomatoCrate': drawTomatoCrate(lm); break;
        case 'orangeStall': drawOrangeStall(lm); break;
        case 'tannery': drawTannery(lm); break;
        case 'cave': drawCave(lm); break;
        case 'logPile': drawLogPile(lm); break;
        case 'zipline': drawZipline(lm); break;
        case 'spiceMarket': drawSpiceMarket(lm); break;
        case 'garage': drawGarage(lm); break;
        case 'tramTunnel': drawTramTunnel(lm); break;
        case 'pub': drawPub(lm); break;
        case 'kissCouple': drawKissCouple(lm); break;
        case 'afroCouple': drawAfroCouple(lm); break;
        case 'monkey': drawMonkey(lm); break;
        case 'sickBed': drawSickBed(lm); break;
        case 'sleepCar': drawSleepCar(lm); break;
        case 'gasStove': drawGasStove(lm); break;
    }
}

function drawPragHouse(lm) {
    const floor = lm.y;
    const top = floor - lm.h;
    ctx.fillStyle = '#5f5580';
    ctx.fillRect(lm.x - 12, top + 40, lm.w + 24, lm.h - 40);
    ctx.fillStyle = '#6f3529';
    ctx.beginPath();
    ctx.moveTo(lm.x - 30, top + 44);
    ctx.lineTo(lm.x + lm.w / 2, top - 10);
    ctx.lineTo(lm.x + lm.w + 30, top + 44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8d8b8';
    ctx.fillRect(lm.x, floor - 150, lm.w, 150);
    ctx.fillStyle = 'rgba(160,110,80,0.18)';
    for (let x = lm.x + 12; x < lm.x + lm.w; x += 24) {
        for (let y = floor - 140; y < floor - 40; y += 24) fillCircle(x + ((y / 24) % 2) * 12, y, 3);
    }
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(lm.x, floor - 36, lm.w, 36);
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(lm.x - 12, floor - 70, 16, 70);
    ctx.fillStyle = '#6b3f2a';
    ctx.fillRect(lm.x + 40, floor - 96, 70, 5);
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['#c9503f', '#3f6fb0', '#5a9a5a'][i];
        fillRoundRect(lm.x + 46 + i * 22, floor - 114, 12, 18, 3);
        ctx.fillStyle = '#f2d2b0';
        fillCircle(lm.x + 52 + i * 22, floor - 118, 5);
    }
    for (const [dx, color] of [[200, '#9fb7c9'], [440, '#d9a441']]) {
        ctx.fillStyle = '#7a5530';
        ctx.fillRect(lm.x + dx, floor - 120, 48, 36);
        ctx.fillStyle = color;
        ctx.fillRect(lm.x + dx + 5, floor - 115, 38, 26);
    }
    ctx.fillStyle = '#6b3f2a';
    ctx.fillStyle = '#f2e3cc';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}

function drawPubDoor(lm) {
    const base = lm.y;
    ctx.fillStyle = '#7a6a8a';
    ctx.fillRect(lm.x - 10, base - lm.h - 30, lm.w + 20, lm.h + 30);
    ctx.fillStyle = '#3a2418';
    ctx.beginPath();
    ctx.arc(lm.x + lm.w / 2, base - lm.h + 30, lm.w / 2, Math.PI, 0);
    ctx.fillRect(lm.x, base - lm.h + 30, lm.w, lm.h - 30);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,196,110,0.55)';
    ctx.fillRect(lm.x + 8, base - lm.h + 34, lm.w - 16, lm.h - 34);
    ctx.fillStyle = '#2f5a36';
    fillRoundRect(lm.x - 8, base - lm.h - 26, lm.w + 16, 20, 4);
    ctx.fillStyle = '#f2d27a';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Kneipe', lm.x + lm.w / 2, base - lm.h - 12);
    ctx.textAlign = 'left';
}

function drawPaternosterShaft(lm) {
    const floor = lm.y;
    ctx.fillStyle = '#5f5580';
    ctx.fillRect(lm.x, floor - lm.h, lm.w, lm.h);
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(lm.x + 16, floor - lm.h + 20, lm.w - 32, lm.h + 200);
    ctx.fillStyle = '#b8903c';
    ctx.fillRect(lm.x + 12, floor - lm.h + 16, lm.w - 24, 5);
    ctx.fillStyle = '#6b3f2a';
    ctx.fillStyle = '#f2e3cc';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // Pfeile: links hoch, rechts runter
    ctx.fillStyle = 'rgba(255,220,150,0.7)';
    const ay = floor - 40;
    ctx.beginPath();
    ctx.moveTo(lm.x + 44, ay - 10); ctx.lineTo(lm.x + 52, ay); ctx.lineTo(lm.x + 36, ay);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lm.x + lm.w - 44, ay + 10); ctx.lineTo(lm.x + lm.w - 36, ay); ctx.lineTo(lm.x + lm.w - 52, ay);
    ctx.closePath();
    ctx.fill();
}

function drawTramStop(lm) {
    const base = lm.y;
    ctx.fillStyle = 'rgba(170,200,220,0.35)';
    ctx.fillRect(lm.x, base - 80, lm.w - 14, 76);
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(lm.x + lm.w - 8, base - lm.h, 4, lm.h);
    ctx.fillStyle = '#f4f4ee';
    fillRoundRect(lm.x + lm.w - 60, base - lm.h - 4, 108, 22, 4);
    ctx.fillStyle = '#c8323a';
    ctx.fillRect(lm.x + lm.w - 60, base - lm.h - 4, 8, 22);
    ctx.fillStyle = '#2a2a2a';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText('Haltestelle', lm.x + lm.w - 48, base - lm.h + 11);
}

function drawTomatoCrate(lm) {
    const base = lm.y;
    ctx.save();
    ctx.translate(lm.x + 30, base);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#b8864c';
    ctx.fillRect(-26, -30, 52, 30);
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(-26, -20, 52, 3);
    ctx.fillRect(-26, -10, 52, 3);
    ctx.restore();
    ctx.fillStyle = '#d9392f';
    for (const [dx, dy] of [[4, -30], [16, -36], [28, -32], [10, -8]]) fillCircle(lm.x + dx, base + dy, 7);
}

function drawOrangeStall(lm) {
    const base = lm.y;
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(lm.x, base - 40, lm.w, 30);
    ctx.fillStyle = '#5a3a22';
    fillCircle(lm.x + 12, base - 8, 8);
    fillCircle(lm.x + lm.w - 12, base - 8, 8);
    ctx.fillStyle = '#ef8a1f';
    for (let i = 0; i < 9; i++) fillCircle(lm.x + 10 + (i % 5) * 14, base - 44 - Math.floor(i / 5) * 10, 7);
    ctx.fillStyle = '#3f8f9e';
    ctx.fillRect(lm.x - 6, base - lm.h, lm.w + 12, 10);
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(lm.x + 2, base - lm.h, 3, lm.h - 40);
    ctx.fillRect(lm.x + lm.w - 5, base - lm.h, 3, lm.h - 40);
}

function drawTannery(lm) {
    const base = lm.y;
    ctx.fillStyle = '#d9b88a';
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    for (let x = lm.x + 30, i = 0; x < lm.x + lm.w - 60; x += 110, i++) {
        ctx.fillStyle = '#b8905c';
        ctx.beginPath();
        ctx.arc(x + 30, base - 150, 30, Math.PI, 0);
        ctx.fillRect(x, base - 150, 60, 90);
        ctx.fill();
        // trocknende Lederhäute auf der Mauer
        const hides = ['#c9503f', '#d9a441', '#7a4a2a', '#3f7fae'];
        ctx.fillStyle = hides[i % hides.length];
        ctx.beginPath();
        ctx.ellipse(x + 85, base - lm.h + 30, 18, 12, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawCave(lm) {
    const base = lm.y;
    const g = ctx.createLinearGradient(0, base - lm.h, 0, base);
    g.addColorStop(0, '#2a2428');
    g.addColorStop(1, '#4a4046');
    ctx.fillStyle = g;
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    // Tropfsteine hängen im Hintergrund nur oben - am Boden stehen nur echte Hindernisse
    ctx.fillStyle = 'rgba(90,82,86,0.6)';
    for (let x = lm.x + 30; x < lm.x + lm.w - 20; x += 70) {
        const h = 20 + ((x * 13) % 30);
        ctx.beginPath();
        ctx.moveTo(x, base - lm.h);
        ctx.lineTo(x + 12, base - lm.h + h);
        ctx.lineTo(x + 24, base - lm.h);
        ctx.closePath();
        ctx.fill();
    }
    for (let x = lm.x + 80; x < lm.x + lm.w; x += 190) {
        const pulse = 0.6 + 0.4 * Math.sin(state.time * 0.05 + x);
        ctx.fillStyle = `rgba(140,220,255,${0.5 * pulse})`;
        fillCircle(x, base - 120, 5);
        ctx.fillStyle = `rgba(140,220,255,${0.15 * pulse})`;
        fillCircle(x, base - 120, 16);
    }
    // Eingang mit Schild
    ctx.fillStyle = '#6e6e76';
    ctx.fillRect(lm.x - 30, base - lm.h, 40, lm.h);
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(lm.x - 70, base - 70, 5, 70);
    ctx.fillStyle = '#8a6540';
    fillRoundRect(lm.x - 120, base - 96, 110, 28, 5);
    ctx.fillStyle = '#f2ede2';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Baumannshöhle', lm.x - 65, base - 77);
    ctx.textAlign = 'left';
}

function drawLogPile(lm) {
    const base = lm.y;
    for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 3 - row; i++) {
            const cx = lm.x + 18 + i * 30 + row * 15;
            const cy = base - 14 - row * 24;
            ctx.fillStyle = '#b8864c';
            fillCircle(cx, cy, 13);
            ctx.strokeStyle = '#5a3a22';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawZipline(lm) {
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lm.x1 - 30, lm.y1 - 6);
    ctx.lineTo(lm.x2 + 30, lm.y2 + 3);
    ctx.stroke();
    for (const [tx, ty, gy] of [[lm.x1 - 30, lm.y1 - 6, lm.ground1], [lm.x2 + 30, lm.y2 + 3, lm.ground2]]) {
        ctx.fillStyle = '#6b4a2c';
        ctx.fillRect(tx - 4, ty - 10, 8, gy - ty + 10);
        ctx.fillRect(tx - 16, ty - 12, 32, 6);
    }
    ctx.fillStyle = '#8a6540';
    fillRoundRect(lm.x1 - 110, lm.ground1 - 100, 84, 30, 5);
    ctx.fillStyle = '#f2ede2';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Seilbahn', lm.x1 - 68, lm.ground1 - 88);
    ctx.font = '9px Georgia, serif';
    ctx.fillText('Rappbodetal', lm.x1 - 68, lm.ground1 - 76);
    ctx.textAlign = 'left';
}


/* --- Gegner --- */

function drawCritterLook2(c) {
    const dir = Math.sign(c.vx) || 1;
    const t = state.time;
    if (c.look === 'dog') {
        const base = c.y + c.h;
        ctx.save();
        ctx.translate(c.x + c.w / 2, base);
        ctx.scale(dir, 1);
        const leg = Math.sin(t * 0.45) * 5;
        ctx.fillStyle = '#8a5a30';
        ctx.fillRect(-16 + leg, -10, 5, 10);
        ctx.fillRect(12 - leg, -10, 5, 10);
        ctx.save();
        ctx.translate(-20, -20);
        ctx.rotate(-0.8 + Math.sin(t * 0.5) * 0.5);
        fillRoundRect(-12, -2, 14, 5, 2);
        ctx.restore();
        ctx.fillStyle = '#9a6a3c';
        fillRoundRect(-22, -26, 40, 18, 9);
        fillRoundRect(10, -34, 20, 17, 7);
        ctx.fillStyle = '#6b4526';
        fillRoundRect(11, -36, 8, 15, 4);
        ctx.fillStyle = '#2a2a2a';
        fillCircle(28, -26, 2.2);
        fillCircle(21, -29, 1.5);
        ctx.fillStyle = '#e88a9a';
        fillRoundRect(23, -20, 4, 6 + Math.abs(Math.sin(t * 0.3)) * 3, 2);
        ctx.restore();
        return true;
    }
    if (c.look === 'bat') {
        const flap = Math.sin(t * 0.6 + c.phase);
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        ctx.fillStyle = '#2a2230';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx - 10, cy - 12 * flap, cx - 18, cy - 2 * flap);
        ctx.quadraticCurveTo(cx - 10, cy + 2, cx, cy + 4);
        ctx.quadraticCurveTo(cx + 10, cy + 2, cx + 18, cy - 2 * flap);
        ctx.quadraticCurveTo(cx + 10, cy - 12 * flap, cx, cy);
        ctx.fill();
        fillCircle(cx, cy, 5);
        ctx.fillStyle = '#ffd84a';
        fillCircle(cx - 2, cy - 1, 1.2);
        fillCircle(cx + 2, cy - 1, 1.2);
        return true;
    }
    return false;
}


/* --- Held im Treibsand, Wind, Dunkelheit --- */

function drawHeroSunk() {
    const sink = player.sink || 0;
    if (sink <= 0.5) { drawHero(); return; }
    const groundY = player.y + player.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(player.x - 80, groundY - 300, player.w + 160, 300);
    ctx.clip();
    ctx.translate(0, sink);
    drawHero();
    ctx.restore();
    ctx.fillStyle = '#c29a5c';
    ctx.beginPath();
    ctx.ellipse(player.x + player.w / 2, groundY, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawWindStreaks() {
    for (const z of level.zones) {
        if (z.type !== 'wind') continue;
        if (z.x2 < camera.x || z.x1 > camera.x + viewWidth) continue;
        const phase = windPhase(z);
        if (phase === 'off') continue;
        const strong = phase === 'on';
        const sand = z.look === 'sandstorm';
        if (sand && strong) {
            const left = Math.max(z.x1, camera.x);
            const right = Math.min(z.x2, camera.x + viewWidth);
            ctx.fillStyle = 'rgba(214,170,110,0.18)';
            ctx.fillRect(left, camera.y, right - left, viewHeight);
        }
        const span = z.x2 - z.x1;
        const count = strong ? 28 : 8;
        ctx.strokeStyle = sand
            ? `rgba(200,150,90,${strong ? 0.6 : 0.35})`
            : `rgba(255,255,255,${strong ? 0.65 : 0.35})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < count; i++) {
            const seed = i * 97.13;
            const x = z.x2 - ((state.time * (strong ? 9 : 4) + seed * 13) % span);
            const y = camera.y + 60 + ((seed * 7.7) % Math.max(60, viewHeight - 120));
            const len = strong ? 42 : 18;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + len, y + Math.sin(state.time * 0.05 + i) * 3);
            ctx.stroke();
        }
    }
}

function drawDarkness() {
    const cx = player.x + player.w / 2;
    const k = darknessAt(cx);
    if (k <= 0) return;
    const cy = player.y + player.h / 2;
    const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, 240);
    g.addColorStop(0, 'rgba(8,6,12,0)');
    g.addColorStop(0.5, `rgba(8,6,12,${0.3 * k})`);
    g.addColorStop(1, `rgba(8,6,12,${0.82 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(camera.x - 40, camera.y - 40, viewWidth + 80, viewHeight + 80);
}



/* --- Überarbeitung nach dem Playtest ------------------------------------ */

// Reine Deko-Bauwerke ohne Spielfunktion werden blass gezeichnet
const DIM_LANDMARKS = new Set(['menuBoard', 'rockfallSign', 'logPile', 'orangeStall', 'tomatoCrate', 'tramStop']);

// Dieses Hindernis nie durch das automatische Sicherheitsnetz entfernen
function keepLastObstacle() {
    level.obstacles[level.obstacles.length - 1].keep = true;
}

Object.assign(DEATH_TEXTS, {
    spice: 'Hatschi! Mitten in die Gewürze!',
    quicksandPool: 'Im Treibsand versunken!',
});

// Fenster mit Blumenkasten an einer Hauswand: von dort fällt der Blumentopf
function drawFlowerWindow(hz, cx, ledgeY) {
    const blue = BIOMES[hz.biome] && BIOMES[hz.biome].id === 'marokko';
    const top = ledgeY - 84;
    ctx.fillStyle = blue ? 'rgba(95,140,205,0.95)' : 'rgba(96,86,122,0.95)';
    ctx.fillRect(cx - 40, top, 80, hz.groundY - top);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(cx - 40, top, 5, hz.groundY - top);
    ctx.fillRect(cx - 40, top, 80, 6);
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(cx - 20, ledgeY - 62, 40, 50);
    ctx.fillStyle = 'rgba(255,214,150,0.9)';
    ctx.fillRect(cx - 16, ledgeY - 58, 32, 42);
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(cx - 1, ledgeY - 58, 2, 42);
    ctx.fillRect(cx - 16, ledgeY - 38, 32, 2);
    ctx.fillStyle = blue ? '#2f5a9a' : '#4f7a4a';
    ctx.fillRect(cx - 34, ledgeY - 62, 12, 50);
    ctx.fillRect(cx + 22, ledgeY - 62, 12, 50);
    ctx.fillStyle = '#9a4a30';
    ctx.fillRect(cx - 28, ledgeY, 56, 8);
    ctx.fillStyle = '#4f8f46';
    fillCircle(cx - 20, ledgeY - 3, 5);
    fillCircle(cx + 20, ledgeY - 3, 5);
    ctx.fillStyle = '#e2574c';
    fillCircle(cx + 20, ledgeY - 7, 3);
}

// Vorratsregal unter der Decke, voller Hundefutter-Dosen
function drawCanShelf(hz, cx, ledgeY) {
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(cx - 42, ledgeY - 70, 4, 72);
    ctx.fillRect(cx + 38, ledgeY - 70, 4, 72);
    ctx.fillStyle = '#7a4c2c';
    ctx.fillRect(cx - 46, ledgeY, 92, 7);
    for (const dx of [-34, -20, 20, 34]) drawDropObject('can', cx + dx - 6, ledgeY - 20, 12, 20);
}

// Regal mit Tonkrügen am Marktstand
function drawPotteryShelf(hz, cx, ledgeY) {
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(cx - 42, ledgeY, 84, 7);
    ctx.fillRect(cx - 40, ledgeY - 70, 4, 90);
    ctx.fillRect(cx + 36, ledgeY - 70, 4, 90);
    ctx.fillRect(cx - 46, ledgeY - 74, 92, 6);
    for (const dx of [-30, 30]) drawDropObject('pottery', cx + dx - 9, ledgeY - 22, 18, 22);
}

function drawSpiceBowls(o) {
    const colors = ['#c9503f', '#e0a526', '#8a5a2c', '#6b8f3a', '#d9772f'];
    const color = colors[Math.floor(o.x / 61) % colors.length];
    const base = o.y + o.h;
    const cx = o.x + o.w / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(o.x + 4, base - 8);
    ctx.quadraticCurveTo(cx, base - o.h - 10, o.x + o.w - 4, base - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a6a44';
    ctx.beginPath();
    ctx.moveTo(o.x, base - 10);
    ctx.lineTo(o.x + o.w, base - 10);
    ctx.lineTo(o.x + o.w - 6, base);
    ctx.lineTo(o.x + 6, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,0.5)';
    ctx.lineWidth = 1;
    for (let x = o.x + 8; x < o.x + o.w - 6; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, base - 10);
        ctx.lineTo(x - 2, base);
        ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    fillCircle(cx - o.w * 0.15, base - o.h * 0.6, 2.5);
}

function drawSpiceCrate(o) {
    ctx.fillStyle = '#9a6a3c';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#6b4526';
    ctx.fillRect(o.x, o.y, o.w, 4);
    ctx.fillRect(o.x, o.y + o.h / 2, o.w, 2);
    ctx.fillRect(o.x + 3, o.y, 3, o.h);
    ctx.fillRect(o.x + o.w - 6, o.y, 3, o.h);
    ctx.fillStyle = 'rgba(255,240,200,0.35)';
    ctx.fillRect(o.x, o.y, o.w, 2);
}

function drawSpiceMarket(lm) {
    const base = lm.y;
    ctx.fillStyle = '#c99a6a';
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    const stripes = ['#c9503f', '#f2ede2'];
    const sacks = ['#c9503f', '#e0a526', '#8a5a2c'];
    for (let x = lm.x + 20, i = 0; x < lm.x + lm.w - 80; x += 160, i++) {
        for (let s = 0; s < 6; s++) {
            ctx.fillStyle = stripes[s % 2];
            ctx.fillRect(x + s * 20, base - lm.h + 40, 20, 24);
        }
        for (let s = 0; s < 3; s++) {
            ctx.fillStyle = sacks[(i + s) % 3];
            fillRoundRect(x + 12 + s * 36, base - 160, 28, 44, 9);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(x + 18 + s * 36, base - 150, 16, 3);
        }
    }
}

function drawQuicksandPool(hz) {
    for (let i = 0; i < 7; i++) {
        const k = ((state.time * 0.02 + i / 7) % 1);
        ctx.fillStyle = `rgba(90,60,30,${0.45 - k * 0.35})`;
        fillCircle(hz.x + 30 + ((i * 97) % Math.max(10, hz.w - 60)), hz.y + 9 - k * 5, 2 + k * 3);
    }
}

// Straßenbahn-Tunnel: die Bahn fährt hinein bzw. heraus
function drawTramTunnel(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    ctx.fillStyle = '#6e6878';
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = base - lm.h + 12; y < base; y += 16) ctx.fillRect(lm.x, y, lm.w, 2);
    ctx.fillStyle = '#1e1a22';
    ctx.beginPath();
    ctx.moveTo(lm.x + 6, base);
    ctx.lineTo(lm.x + 6, base - 104);
    ctx.quadraticCurveTo(cx, base - 132, lm.x + lm.w - 6, base - 104);
    ctx.lineTo(lm.x + lm.w - 6, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9a96a6';
    ctx.fillRect(lm.x - 4, base - lm.h, lm.w + 8, 8);
}

// Hofeinfahrt, aus der der Roller kommt
function drawGarage(lm) {
    const base = lm.y;
    ctx.fillStyle = '#b8835a';
    ctx.fillRect(lm.x, base - lm.h, lm.w, lm.h);
    ctx.fillStyle = '#6b4a30';
    ctx.fillRect(lm.x, base - lm.h, lm.w, 8);
    ctx.fillStyle = '#2a2224';
    fillRoundRect(lm.x + 8, base - 68, lm.w - 16, 68, 6);
    ctx.fillStyle = '#8a8a92';
    ctx.fillRect(lm.x + 8, base - 68, lm.w - 16, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = base - 66; y < base - 56; y += 3) ctx.fillRect(lm.x + 8, y, lm.w - 16, 1);
}



/* --- Szenen aus unserer Geschichte ---------------------------------------- */

// Stehende Person für Szenen. facing 1 = schaut nach rechts.
function drawStandingPerson(x, groundY, colors, facing, longHair, height) {
    const s = (height || 56) / 56;
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(facing * s, s);
    if (colors.dress) {
        ctx.fillStyle = colors.skin;
        ctx.fillRect(-6, -16, 4, 14);
        ctx.fillRect(2, -16, 4, 14);
        ctx.fillStyle = colors.shoes || '#3a3a4a';
        ctx.fillRect(-7, -3, 6, 3);
        ctx.fillRect(1, -3, 6, 3);
        ctx.fillStyle = colors.dress;
        ctx.beginPath();
        ctx.moveTo(-6, -44);
        ctx.lineTo(7, -44);
        ctx.lineTo(11, -14);
        ctx.lineTo(-10, -14);
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.fillStyle = colors.pants || '#3a3a4a';
        ctx.fillRect(-7, -22, 6, 22);
        ctx.fillRect(1, -22, 6, 22);
        ctx.fillStyle = colors.shirt;
        fillRoundRect(-9, -46, 18, 26, 6);
    }
    ctx.fillStyle = colors.hair;
    if (longHair) fillRoundRect(-11, -62, 15, 30, 7);
    ctx.fillStyle = colors.skin;
    fillCircle(2, -53, 9);
    ctx.fillStyle = colors.hair;
    ctx.beginPath();
    ctx.arc(1, -55, 9.5, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    // geschlossene Augen, rote Wangen
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(6, -53, 2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,120,140,0.6)';
    fillCircle(5, -49, 2.2);
    // Arm zur anderen Person
    ctx.strokeStyle = colors.skin;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3, -40);
    ctx.lineTo(13, -33);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
}

// Prag: wir beide ganz nah, fast ein Kuss
function drawKissCouple(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    const lean = Math.sin(state.time * 0.03) * 0.8;
    drawStandingPerson(cx - 13 + lean, base, PERSONAL.heroColors, 1, true, 54);
    drawStandingPerson(cx + 13 - lean, base, PERSONAL.partnerColors, -1, false, 60);

    const pulse = 1 + Math.sin(state.time * 0.12) * 0.15;
    ctx.fillStyle = '#ff6d8b';
    heartPath(cx, base - 76, 5 * pulse);
    ctx.fill();

    const text = 'erster Schmusi?';
    ctx.font = 'bold 15px Georgia, serif';
    const tw = ctx.measureText(text).width + 22;
    const by = base - 122;
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    fillRoundRect(cx - tw / 2, by, tw, 28, 12);
    ctx.beginPath();
    ctx.moveTo(cx - 6, by + 28);
    ctx.lineTo(cx, by + 37);
    ctx.lineTo(cx + 6, by + 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8405a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, by + 14);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}

// Prag: die Kneipe mit Theke, Zapfhähnen und Bier im Schaufenster
function drawBeerGlass(x, bottom) {
    ctx.fillStyle = 'rgba(230,165,40,0.95)';
    ctx.fillRect(x, bottom - 16, 9, 16);
    ctx.fillStyle = '#fff8e8';
    fillRoundRect(x - 1, bottom - 20, 11, 6, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 10, bottom - 9, 3.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
}

function drawPub(lm) {
    const base = lm.y;
    const top = base - lm.h;
    ctx.fillStyle = '#2f5a36';
    ctx.fillRect(lm.x - 6, top - 30, lm.w + 12, lm.h + 30);
    ctx.fillStyle = '#244a2c';
    ctx.fillRect(lm.x - 10, top - 34, lm.w + 20, 8);

    // Schild mit Bierkrug
    ctx.fillStyle = '#d9b25c';
    fillRoundRect(lm.x + 8, top - 26, 96, 20, 4);
    ctx.fillStyle = '#2f2418';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Kneipe', lm.x + 46, top - 16);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    drawBeerGlass(lm.x + 84, top - 8);

    // Schaufenster mit Bar
    const wx = lm.x + 8;
    const wy = base - 94;
    const ww = 62;
    const wh = 72;
    ctx.fillStyle = '#1e140e';
    fillRoundRect(wx - 3, wy - 3, ww + 6, wh + 6, 4);
    ctx.fillStyle = 'rgba(255,196,110,0.9)';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#6b4526';
    ctx.fillRect(wx, wy + 16, ww, 3);
    const bottleColors = ['#3f5f38', '#7a4a1c', '#3f5f38', '#c9a24a', '#7a4a1c'];
    for (let i = 0; i < 5; i++) {
        ctx.fillStyle = bottleColors[i];
        ctx.fillRect(wx + 6 + i * 11, wy + 4, 5, 12);
        ctx.fillRect(wx + 7 + i * 11, wy + 1, 3, 4);
    }
    ctx.fillStyle = '#6b3f22';
    ctx.fillRect(wx, wy + wh - 24, ww, 24);
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(wx - 2, wy + wh - 27, ww + 4, 4);
    ctx.fillStyle = '#d9b25c';
    for (const tx of [wx + 10, wx + 20]) {
        ctx.fillRect(tx, wy + wh - 42, 3, 15);
        fillCircle(tx + 1.5, wy + wh - 43, 3);
    }
    drawBeerGlass(wx + 34, wy + wh - 27);
    drawBeerGlass(wx + 48, wy + wh - 27);

    // Tür rechts - aus ihr rollen die Fässer
    const dx = lm.x + lm.w - 52;
    const dh = 100;
    ctx.fillStyle = '#3a2418';
    ctx.beginPath();
    ctx.arc(dx + 26, base - dh + 26, 26, Math.PI, 0);
    ctx.fillRect(dx, base - dh + 26, 52, dh - 26);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,196,110,0.55)';
    ctx.fillRect(dx + 8, base - dh + 30, 36, dh - 30);
}

// Afrikaner: wir beide am Tisch, vor uns stinkendes Hundefutter
function drawAfroCouple(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    const t = state.time;
    ctx.fillStyle = '#6b3f2a';
    ctx.fillRect(cx - 100, base - 90, 8, 90);
    ctx.fillRect(cx - 100, base - 44, 36, 7);
    ctx.fillRect(cx + 92, base - 90, 8, 90);
    ctx.fillRect(cx + 64, base - 44, 36, 7);
    drawSeatedPerson(cx - 78, base - 44, PERSONAL.heroColors, 1, true, 'yuck');
    drawSeatedPerson(cx + 78, base - 44, PERSONAL.partnerColors, -1, false, 'yuck');

    ctx.fillStyle = '#d98a3a';
    fillRoundRect(cx - 62, base - 64, 124, 14, 5);
    ctx.fillStyle = '#6b3f2a';
    ctx.fillRect(cx - 6, base - 50, 12, 50);

    for (const dx of [-34, 34]) {
        const px = cx + dx;
        ctx.fillStyle = '#f2ede2';
        ctx.beginPath();
        ctx.ellipse(px, base - 65, 20, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4526';
        fillCircle(px - 8, base - 69, 5);
        fillCircle(px, base - 71, 6);
        fillCircle(px + 8, base - 69, 5);
        ctx.fillStyle = '#8a5a34';
        fillCircle(px - 2, base - 73, 3);
        fillCircle(px + 6, base - 71, 2);
        // Stinkwolken
        ctx.strokeStyle = 'rgb(110,160,50)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
            const k = ((t * 0.015 + i * 0.5 + (dx > 0 ? 0.25 : 0)) % 1);
            ctx.globalAlpha = 1 - k;
            ctx.beginPath();
            for (let s = 0; s < 5; s++) {
                ctx.lineTo(px - 6 + i * 12 + Math.sin(t * 0.1 + s + i) * 3, base - 78 - s * 7 - k * 20);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    // Dose Hundefutter mit Pfote in der Mitte
    drawDropObject('can', cx - 7, base - 84, 14, 20);
    // eine Fliege kreist
    const fa = t * 0.12;
    const fx = cx + Math.cos(fa) * 28;
    const fy = base - 98 + Math.sin(fa * 2) * 8;
    ctx.fillStyle = 'rgba(220,230,240,0.8)';
    ctx.beginPath();
    ctx.ellipse(fx - 2, fy - 3, 3, 2, -0.5, 0, Math.PI * 2);
    ctx.ellipse(fx + 2, fy - 3, 3, 2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1e22';
    fillCircle(fx, fy, 2.2);
}

// Marokko: Berberaffe, sitzt auf Dächern und Mauern
function drawMonkey(lm) {
    const x = lm.x + lm.w / 2;
    const base = lm.y;
    const f = lm.facing || 1;
    const t = state.time + (lm.phase || 0) * 50;
    const fur = '#8a7458';
    const light = '#b09a7a';
    const face = '#e8a898';
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(f, 1);
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(-3, -5, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -17, 9, 13, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(2, -15, 5, 8, 0.1, 0, Math.PI * 2);
    ctx.fill();
    const bob = lm.pose === 'scratch' ? Math.sin(t * 0.3) : 0;
    ctx.fillStyle = fur;
    fillCircle(4, -33 + bob, 8);
    ctx.fillStyle = face;
    fillCircle(-2, -35 + bob, 2.5);
    ctx.beginPath();
    ctx.ellipse(7, -32 + bob, 5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    fillCircle(6, -34 + bob, 1.2);
    fillCircle(10, -34 + bob, 1.2);
    ctx.strokeStyle = fur;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (lm.pose === 'scratch') {
        ctx.moveTo(-4, -23);
        ctx.lineTo(-7, -32 + Math.sin(t * 0.4) * 3);
        ctx.stroke();
    } else if (lm.pose === 'eat') {
        ctx.moveTo(4, -21);
        ctx.lineTo(10, -28);
        ctx.stroke();
        ctx.fillStyle = '#ef8a1f';
        fillCircle(11, -29, 3.5);
    } else {
        ctx.moveTo(4, -19);
        ctx.lineTo(8, -8);
        ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.restore();
}

// Marokko: Antonia liegt krank im Bett im Riad
function drawSickBed(lm) {
    const base = lm.y;
    const x = lm.x;
    const w = lm.w;
    const t = state.time;
    const c = PERSONAL.heroColors;

    // Nachttisch mit Tee
    ctx.fillStyle = '#7a4a26';
    ctx.fillRect(x + w + 6, base - 34, 26, 34);
    ctx.fillStyle = '#f2ede2';
    fillRoundRect(x + w + 12, base - 46, 13, 12, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
        const k = ((t * 0.02 + i / 2) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.moveTo(x + w + 16 + i * 5, base - 48 - k * 14);
        ctx.lineTo(x + w + 18 + i * 5 + Math.sin(t * 0.1 + i) * 2, base - 56 - k * 14);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Bett
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(x, base - 62, 8, 62);
    ctx.fillRect(x + w - 6, base - 40, 6, 40);
    ctx.fillRect(x, base - 18, w, 8);
    ctx.fillStyle = '#f2ede2';
    ctx.fillRect(x + 8, base - 28, w - 14, 10);
    ctx.fillStyle = '#ffffff';
    fillRoundRect(x + 10, base - 42, 34, 15, 6);

    // Antonia: blass, verschwitzt, mit Thermometer
    ctx.fillStyle = c.hair;
    fillRoundRect(x + 12, base - 48, 26, 15, 7);
    ctx.fillStyle = '#dfe0b0';
    fillCircle(x + 32, base - 38, 9);
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 29, base - 41);
    ctx.lineTo(x + 32, base - 40);
    ctx.moveTo(x + 34, base - 41);
    ctx.lineTo(x + 37, base - 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 33, base - 32, 3, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = '#e8e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 36, base - 34);
    ctx.lineTo(x + 48, base - 42);
    ctx.stroke();
    ctx.fillStyle = '#e2574c';
    fillCircle(x + 48, base - 42, 2);
    ctx.fillStyle = 'rgba(120,190,230,0.9)';
    const drop = (t * 0.03) % 1;
    fillCircle(x + 25, base - 44 + drop * 8, 2);

    // Decke im Zellige-Muster
    ctx.fillStyle = '#3f8f9e';
    fillRoundRect(x + 40, base - 38, w - 48, 20, 7);
    ctx.fillStyle = '#d9a441';
    for (let sx = x + 48; sx < x + w - 14; sx += 14) ctx.fillRect(sx, base - 32, 6, 6);

    // "Mir ist schlecht"-Kringel über dem Kopf
    ctx.strokeStyle = 'rgba(120,160,60,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.4) {
        const r = 2 + a * 1.2;
        ctx.lineTo(x + 32 + Math.cos(a + t * 0.08) * r, base - 64 + Math.sin(a + t * 0.08) * r * 0.5);
    }
    ctx.stroke();
}

// Harz: wir beide schlafen im Auto
function drawSleepHead(x, y, colors, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = colors.skin;
    fillCircle(0, 0, 7);
    ctx.fillStyle = colors.hair;
    ctx.beginPath();
    ctx.arc(0, -1, 7.5, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(2.5, 0.5, 1.8, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.restore();
}

function drawSleepCar(lm) {
    const base = lm.y;
    const x = lm.x;
    const w = lm.w;
    const t = state.time;
    const bodyTop = base - 46;

    ctx.fillStyle = '#5a7a9a';
    ctx.beginPath();
    ctx.moveTo(x + 16, bodyTop + 4);
    ctx.lineTo(x + 34, base - 86);
    ctx.lineTo(x + w - 56, base - 86);
    ctx.lineTo(x + w - 26, bodyTop + 4);
    ctx.closePath();
    ctx.fill();
    fillRoundRect(x, bodyTop, w, 34, 9);

    // Fensterfläche mit den beiden Schlafenden
    ctx.fillStyle = '#2a3440';
    ctx.beginPath();
    ctx.moveTo(x + 26, bodyTop + 1);
    ctx.lineTo(x + 40, base - 80);
    ctx.lineTo(x + w - 60, base - 80);
    ctx.lineTo(x + w - 36, bodyTop + 1);
    ctx.closePath();
    ctx.fill();
    drawSleepHead(x + 80, base - 58, PERSONAL.heroColors, 0.45);
    drawSleepHead(x + 96, base - 64, PERSONAL.partnerColors, 0.2);
    ctx.fillStyle = '#5a7a9a';
    ctx.fillRect(x + w / 2 + 18, base - 80, 5, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 44, base - 78, 30, 4);

    ctx.fillStyle = '#ffe3a0';
    fillRoundRect(x + w - 8, bodyTop + 8, 8, 8, 2);
    ctx.fillStyle = '#c9303a';
    ctx.fillRect(x, bodyTop + 8, 5, 10);
    for (const wx of [x + 38, x + w - 42]) {
        ctx.fillStyle = '#1e1e22';
        fillCircle(wx, base - 12, 13);
        ctx.fillStyle = '#9a9aa2';
        fillCircle(wx, base - 12, 5);
    }

    // Zzz
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
        const k = ((t * 0.008 + i / 3) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.font = `bold ${10 + i * 3}px Georgia, serif`;
        ctx.fillText('Z', x + 96 + k * 34 + i * 6, base - 92 - k * 40);
    }
    ctx.globalAlpha = 1;
}

// Harz: der Gaskocher, der aussieht, als würde er gleich explodieren
function drawGasStove(lm) {
    const base = lm.y;
    const cx = lm.x + lm.w / 2;
    const t = state.time;
    const shake = Math.sin(t * 1.3) * 1.2;
    ctx.save();
    ctx.translate(shake, 0);
    const bulge = 1.12 + Math.sin(t * 0.08) * 0.08;
    ctx.fillStyle = '#c9303a';
    ctx.beginPath();
    ctx.ellipse(cx, base - 12, 11 * bulge, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ede2';
    ctx.fillRect(cx - 6, base - 16, 12, 5);
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(cx - 3, base - 30, 6, 8);
    ctx.fillRect(cx - 15, base - 32, 30, 4);
    for (let i = 0; i < 5; i++) {
        const fl = Math.sin(t * 0.5 + i) * 4;
        ctx.fillStyle = i % 2 ? 'rgba(255,200,80,0.9)' : 'rgba(255,110,40,0.85)';
        ctx.beginPath();
        ctx.ellipse(cx - 16 + i * 8, base - 42, 5, 12 + fl, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#8a8a92';
    fillRoundRect(cx - 12, base - 52, 24, 16, 3);
    ctx.fillStyle = '#6e6e76';
    ctx.fillRect(cx - 14, base - 53, 28, 3);
    for (let i = 0; i < 6; i++) {
        const k = ((t * 0.04 + i / 6) % 1);
        ctx.fillStyle = `rgba(255,220,120,${1 - k})`;
        fillCircle(cx + Math.sin(i * 2.3) * 24 * k, base - 50 - k * 34, 1.6);
    }
    ctx.restore();

    if (Math.floor(t / 12) % 2 === 0) {
        const wx = cx + 22;
        const wy = base - 78;
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath();
        ctx.moveTo(wx, wy - 12);
        ctx.lineTo(wx + 12, wy + 9);
        ctx.lineTo(wx - 12, wy + 9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#c9303a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#2a2a2a';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', wx, wy + 7);
        ctx.textAlign = 'left';
    }
}


/* ---------- HUD & Overlays ---------- */

function drawHud() {
    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);

    // Herzen
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.roundRect(16, 14, 108, 38, 12);
    ctx.fill();
    ctx.fillStyle = '#ff6d8b';
    heartPath(40, 27, 9);
    ctx.fill();
    ctx.fillStyle = '#4a3b45';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(state.hearts), 58, 41);

    if (admin.active) {
        const text = 'ADMIN  ·  1-6 Kapitel  ·  V Fliegen ' + (admin.flying ? '(AN)' : '(aus)') + '  ·  0 Aus';
        ctx.font = 'bold 13px Arial, sans-serif';
        const w = ctx.measureText(text).width + 20;
        ctx.fillStyle = admin.flying ? 'rgba(200,40,70,0.85)' : 'rgba(38,28,36,0.8)';
        ctx.beginPath();
        ctx.roundRect(viewWidth - w - 16, 14, w, 28, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, viewWidth - w - 6, 33);
    }

    if (touchActive) drawTouchControls();
}

function drawTouchControls() {
    // Linke Hälfte: der Joystick, nur solange der Finger wirklich draufliegt
    if (joystick) {
        const dx = clamp(joystick.curX - joystick.anchorX, -JOY_RADIUS, JOY_RADIUS);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(joystick.anchorX, joystick.anchorY, JOY_RADIUS + 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = (input.left || input.right) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(joystick.anchorX + dx, joystick.anchorY, 26, 0, Math.PI * 2);
        ctx.fill();
    }

    // Rechte Hälfte: dezenter Hinweis auf die Wischgesten, plus Duck-Anzeige
    const hintX = viewWidth - 62;
    const hintY = viewHeight - 110;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillStyle = (rightGesture && rightGesture.triggered === 'up' && rightGesture.holdingJump)
        ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)';
    ctx.fillText('▲', hintX, hintY - 30);
    ctx.fillStyle = duckHeld ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)';
    ctx.fillText('▼', hintX, hintY + 30);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}

function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(38,28,36,0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,220,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawCenteredLines(lines, startY, font, color, lineHeight) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, viewWidth / 2, startY + i * lineHeight));
    ctx.textAlign = 'left';
}

function drawOverlays() {
    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);

    if (state.mode === 'paused') {
        ctx.fillStyle = 'rgba(20,14,20,0.45)';
        ctx.fillRect(0, 0, viewWidth, viewHeight);
        const w = Math.min(420, viewWidth - 60);
        panel(viewWidth / 2 - w / 2, viewHeight / 2 - 80, w, 160);
        drawCenteredLines(['Pause'], viewHeight / 2 - 20, 'bold 36px Georgia, serif', '#ffe9ef', 40);
        drawCenteredLines(['P oder Esc = weiter    R = Neustart'], viewHeight / 2 + 20, '16px Georgia, serif', '#f4e7ec', 22);
    }

    if (state.mode === 'dead') {
        // Weicher Schatten statt Textkasten: bleibt auch auf hellem
        // Wüstenhimmel oder dunklem Restaurant lesbar.
        ctx.save();
        ctx.shadowColor = 'rgba(20,12,18,0.85)';
        ctx.shadowBlur = 14;
        drawCenteredLines([state.deathReason], viewHeight / 2 - 10,
            'bold 30px Georgia, serif', '#ffe9ef', 36);
        const pulse = 0.55 + Math.sin(state.time * 0.08) * 0.45;
        ctx.globalAlpha = pulse;
        drawCenteredLines([touchActive ? 'Tippen zum Weitermachen' : 'Leertaste zum Weitermachen'],
            viewHeight / 2 + 28, '17px Georgia, serif', '#f4e7ec', 22);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    if (state.mode === 'finished') {
        const fade = clamp(state.finishFrames / 60, 0, 1);
        ctx.fillStyle = `rgba(30,18,28,${0.55 * fade})`;
        ctx.fillRect(0, 0, viewWidth, viewHeight);

        const w = Math.min(620, viewWidth - 50);
        const h = 330;
        const x = viewWidth / 2 - w / 2;
        const y = viewHeight / 2 - h / 2;
        ctx.globalAlpha = fade;
        panel(x, y, w, h);
        drawCenteredLines([PERSONAL.endingTitle], y + 62, 'bold 40px Georgia, serif', '#ffe9ef', 44);
        drawCenteredLines(PERSONAL.endingLines, y + 118, '18px Georgia, serif', '#f7e4ea', 30);
        drawCenteredLines([PERSONAL.endingSignature], y + 128 + PERSONAL.endingLines.length * 30,
            'italic bold 22px Georgia, serif', '#ffb7c8', 26);
        drawCenteredLines([
            `${state.hearts} Herzen gesammelt  ·  ${state.deaths} Versuche  ·  ${Math.floor(state.frames / 60)} Sekunden`,
            'R = nochmal spielen',
        ], y + h - 54, '15px Georgia, serif', '#f4e7ec', 22);
        ctx.globalAlpha = 1;
    }
}

function render() {
    drawSky();
    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    drawParallax();

    const shakeX = state.shake ? rand(-state.shake, state.shake) : 0;
    const shakeY = state.shake ? rand(-state.shake, state.shake) : 0;
    ctx.save();
    ctx.translate(-camera.x + shakeX, -camera.y + shakeY);
    drawWorld();
    ctx.restore();

    drawHud();
    drawOverlays();
}


/* ---------- 12. Spielablauf & Hauptschleife ---------- */

function startGame() {
    state.mode = 'playing';
    state.frames = 0;
    state.currentBiome = biomeIndexAt(player.x);
    input.jumpPressed = false;
    player.jumpBuffer = 0;
}

function togglePause() {
    if (state.mode === 'playing') state.mode = 'paused';
    else if (state.mode === 'paused') state.mode = 'playing';
}

function restartGame() {
    buildLevel();
    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.w = PLAYER_WIDTH;
    player.h = PLAYER_HEIGHT;
    player.vx = 0; player.vy = 0;
    player.mode = 'air';
    player.mount = null;
    player.ducking = false;
    player.groundRef = null;
    player.facing = 1;

    state.hearts = 0;
    state.deaths = 0;
    state.frames = 0;
    state.finishFrames = 0;
    state.shake = 0;
    state.mode = 'playing';
    state.currentBiome = 0;
    particles.length = 0;

    rebuildSolids();
    updateCamera(true);
}

// Welches Kapitel spielen wir gerade? Beim Wechsel gibt es eine Einblendung.
function updateBiome() {
    state.currentBiome = biomeIndexAt(player.x + player.w / 2);
}

function updatePlaying() {
    state.frames++;
    updatePlatforms();
    rebuildSolids();
    updatePlayer();
    updateCats();
    updateCritters();
    updateCows();
    updateHazards();
    updateExtras();
    collectHearts();
    updateCheckpoints();
    updateBiome();
    checkHazards();
    updateCamera(false);

    if (player.x + player.w / 2 >= level.goalX && state.mode === 'playing') {
        state.mode = 'finished';
        state.finishFrames = 0;
        for (let i = 0; i < 40; i++) {
            spawnSparkle(level.goalX + rand(-120, 120), GROUND_BASE_Y - rand(20, 180), 1, i % 2 ? '#ff6d8b' : '#ffd0dc');
        }
    }
}

function stepGame() {
    state.time++;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.6);

    const jumpPressed = input.jumpPressed;
    const confirmPressed = input.confirmPressed;
    input.jumpPressed = false;
    input.confirmPressed = false;

    switch (state.mode) {
        case 'playing':
            if (jumpPressed) player.jumpBuffer = JUMP_BUFFER_FRAMES;
            updatePlaying();
            updateParticles();
            break;

        case 'paused':
            break;

        case 'dead':
            updateParticles();
            updateCamera(false);
            // Kurze Sperre, damit ein gehaltener Sprung nicht sofort auslöst
            if (state.respawnTimer > 0) state.respawnTimer--;
            else if (jumpPressed || confirmPressed) respawn();
            break;

        case 'finished':
            state.finishFrames++;
            updateParticles();
            updateCamera(false);
            if (state.finishFrames % 12 === 0) {
                spawnSparkle(camera.x + rand(60, viewWidth - 60), camera.y + viewHeight - 40, 2, '#ff8fa8');
            }
            break;
    }
}

let lastTime = performance.now();
let accumulator = 0;

function gameLoop(now) {
    let delta = now - lastTime;
    lastTime = now;
    if (delta > 250) delta = 250; // nach Tab-Wechsel nicht aufholen

    accumulator += delta;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < 5) {
        stepGame();
        accumulator -= STEP_MS;
        steps++;
    }

    render();
    requestAnimationFrame(gameLoop);
}

buildLevel();
player.x = level.spawn.x;
player.y = level.spawn.y;
rebuildSolids();
updateCamera(true);
requestAnimationFrame(gameLoop);
 