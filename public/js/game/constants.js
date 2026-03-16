const BLOCK_SIZE = 40;

// ─── Vitesses  ────────────────────────────────────────────────────────────────
const SPEED_PRESETS = { 1.0: 10.37 };
const BASE_SPEED = 8.36;
const DEFAULT_SPEED_MULTIPLIER = 1.0;

// ─── Physique ─────────────────────────────────────────────────────────────────
const PHYSICS = {
	GRAVITY: 3400,   // px/s²
	JUMP_VELOCITY: -860,  // px/s (vers le haut)
};

// ─── Monde ───────────────────────────────────────────────────────────────────
const WORLD = {
	HEIGHT_BLOCKS: 20,                      // hauteur du monde en blocs
	HEIGHT: 20 * BLOCK_SIZE,         // hauteur du monde en px
	GROUND_BLOCKS: 2,                       // épaisseur du sol (blocs depuis le bas)
};

// ─── Caméra verticale ─────────────────────────────────────────────────────────
const CAMERA = {
	// Marges (en blocs) avant que la caméra commence à bouger
	DEADZONE_TOP_BLOCKS: 4,
	DEADZONE_BOTTOM_BLOCKS: 4,
	// Vitesse de lerp de la caméra
	LERP: 10,
};

// ─── Joueur ───────────────────────────────────────────────────────────────────
const PLAYER = {
	SIZE: BLOCK_SIZE,
	START_X: 150,
};

// ─── Canvas (viewport) ───────────────────────────────────────────────────────
const CANVAS = {
	WIDTH: 900,
	HEIGHT: 500,   // taille visible — le monde est plus grand (WORLD.HEIGHT)
};

// ─── Vision IA ────────────────────────────────────────────────────────────────
const VISION = {
	COLS: 7,  // colonnes : col 0 = joueur, col 1-8 = devant
	ROWS: 3,  // rangées AU-DESSUS du joueur (row 0 = pieds, row 3 = le plus haut)
	ROWS_BELOW: 3,  // rangées EN DESSOUS du joueur
	// Grille totale : 9 × 9 (4 dessous + 1 niveau pieds + 4 dessus)
};

// ─── Triggers ─────────────────────────────────────────────────────────────────
const TRIGGER_TYPE = {
	BLOCK_PRESENT: 0,
	BLOCK_ABSENT: 1,
	SPIKE_PRESENT: 2,
	SPIKE_ABSENT: 3,
	AIR_PRESENT: 4,
	AIR_ABSENT: 5,
};
const TRIGGER_LABELS = ['B+', 'B-', 'S+', 'S-', 'A+', 'A-'];
const TRIGGER_COLORS = ['#44ff44', '#ff4444', '#44ff44', '#ff4444', '#88ffff', '#ff8844'];
const CELL = { AIR: 0, BLOCK: 1, SPIKE: 2 };

// ─── Types d'obstacles ────────────────────────────────────────────────────────
// 'block'     : bloc solide (carré bleu)
// 'spike'     : pique normale, pointe vers le haut (triangle rouge sur le sol)
// 'spike_inv' : pique inversée, pointe vers le bas (triangle rouge au plafond)

if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		BLOCK_SIZE, SPEED_PRESETS, DEFAULT_SPEED_MULTIPLIER, PHYSICS, WORLD,
		CAMERA, PLAYER, CANVAS, VISION,
		TRIGGER_TYPE, TRIGGER_LABELS, TRIGGER_COLORS, CELL, BASE_SPEED
	};
}