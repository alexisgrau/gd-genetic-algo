/**
 * ai-controller.js — Capteurs de vision en coordonnées continues.
 *
 * Au lieu d'une grille discrète, l'AIController expose une fonction
 * sampleFn(x, y) que chaque Trigger appelle avec ses coordonnées flottantes.
 *
 * Coordonnées des triggers (identiques à Genome/Trigger) :
 *   x ∈ [0, VISION.COLS[  — en blocs depuis le bord gauche du joueur
 *   y ∈ [0, totalRows[     — 0 = rangée la plus basse, ROWS_BELOW = pieds du joueur
 *
 * Le capteur est un carré de 1×1 bloc centré sur (x, y) en coordonnées
 * de trigger. On teste l'intersection AABB avec chaque obstacle monde.
 */

class AIController {
	constructor(genome) {
		this.genome = genome;
		this.lastGrid = null; // conservé pour la visualisation
		this.lastDecision = false;
		this._lastPlayer = null;
		this._lastLevel = null;
	}

	evaluate(player, level) {
		this._lastPlayer = player;
		this._lastLevel = level;

		// Grille pour la visualisation uniquement
		this.lastGrid = this._buildDisplayGrid(player, level);

		// La décision utilise la sampleFn continue
		const sampleFn = this._makeSampleFn(player, level);
		this.lastDecision = this.genome.evaluate(sampleFn);
		return this.lastDecision;
	}

	// ─── SampleFn continue ───────────────────────────────────────────────────────

	/**
	 * Retourne une fonction (x, y) → CELL.* qui teste un capteur 1×1 bloc
	 * aux coordonnées flottantes (x, y) dans le repère trigger.
	 */
	_makeSampleFn(player, level) {
		const bs = BLOCK_SIZE;
		const rowsBelow = VISION.ROWS_BELOW ?? 4;
		const playerWorldX = PLAYER.START_X + level.scrollX;
		const playerWorldY = player.y;

		// Pré-filtrage des obstacles dans la fenêtre de vision
		const totalRows = VISION.ROWS + rowsBelow + 1;
		const wx1 = playerWorldX - bs;
		const wx2 = playerWorldX + VISION.COLS * bs + bs;
		const wy1 = playerWorldY - VISION.ROWS * bs - bs;
		const wy2 = playerWorldY + rowsBelow * bs + bs;
		const nearby = level.obstacles.filter(o => o.x + o.w > wx1 && o.x < wx2 && o.y + o.h > wy1 && o.y < wy2);

		return (tx, ty) => {
			// Conversion coordonnées trigger → monde absolu
			// tx=0 → bord gauche du joueur, ty=rowsBelow → pieds du joueur
			const rowReal = ty - rowsBelow;         // -rowsBelow à +ROWS
			const cellWorldX = playerWorldX + tx * bs;
			const cellWorldY = playerWorldY - rowReal * bs;

			// Sol du monde → BLOCK
			if (cellWorldY >= level.groundY){ return CELL.BLOCK; }

			// Test AABB : le capteur (1×1 bloc) touche-t-il un obstacle ?
			for (const obs of nearby) {
				if (obs.x < cellWorldX + bs && obs.x + obs.w > cellWorldX &&
					obs.y < cellWorldY + bs && obs.y + obs.h > cellWorldY) {
					return obs.type === 'block' ? CELL.BLOCK : CELL.SPIKE;
				}
			}
			return CELL.AIR;
		};
	}

	// ─── Grille discrète (visualisation uniquement) ───────────────────────────────

	_buildDisplayGrid(player, level) {
		const bs = BLOCK_SIZE;
		const rowsBelow = VISION.ROWS_BELOW ?? 4;
		const rowsAbove = VISION.ROWS;
		const totalRows = rowsBelow + 1 + rowsAbove;

		const playerWorldX = PLAYER.START_X + level.scrollX;
		const playerWorldY = player.y;

		const wx1 = playerWorldX - bs;
		const wx2 = playerWorldX + VISION.COLS * bs + bs;
		const wy1 = playerWorldY - rowsAbove * bs - bs;
		const wy2 = playerWorldY + rowsBelow * bs + bs;
		const nearby = level.obstacles.filter(o => o.x + o.w > wx1 && o.x < wx2 && o.y + o.h > wy1 && o.y < wy2);

		const grid = [];
		for (let i = 0; i < totalRows; i++) {
			const row = i - rowsBelow;
			grid[i] = [];
			for (let col = 0; col < VISION.COLS; col++) {
				const cellX = playerWorldX + col * bs;
				const cellY = playerWorldY - row * bs;
				if (cellY >= level.groundY) { 
					grid[i][col] = CELL.BLOCK;
					continue;
				}
				let found = CELL.AIR;
				for (const obs of nearby) {
					if (obs.x < cellX + bs && obs.x + obs.w > cellX && obs.y < cellY + bs && obs.y + obs.h > cellY) {
						found = obs.type === 'block' ? CELL.BLOCK : CELL.SPIKE;
						break;
					}
				}
				grid[i][col] = found;
			}
		}
		return grid;
	}
}