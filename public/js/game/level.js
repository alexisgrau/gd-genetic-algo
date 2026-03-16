/**
 * level.js — Niveau avec monde 20 blocs de haut.
 * Supporte : procédural (seed), custom (tiles éditeur), piques inversées.
 */

class Level {
	constructor(canvasWidth, canvasHeight, seed = 42) {
		this.canvasWidth = canvasWidth;
		this.canvasHeight = canvasHeight;
		this.worldHeight = WORLD.HEIGHT;
		this.groundY = this.worldHeight - WORLD.GROUND_BLOCKS * BLOCK_SIZE; // 760
		this.obstacles = [];
		this.scrollX = 0;
		this.name = null;
		this._generate();
	}

	// ─── Factory tiles ────────────────────────────────────────────────────────────

	static fromTiles(tiles, canvasWidth, canvasHeight, name = 'custom') {
		const inst = Object.create(Level.prototype);
		inst.canvasWidth = canvasWidth;
		inst.canvasHeight = canvasHeight;
		inst.worldHeight = WORLD.HEIGHT;
		inst.groundY = WORLD.HEIGHT - WORLD.GROUND_BLOCKS * BLOCK_SIZE;
		inst.obstacles = [];
		inst.scrollX = 0;
		inst.name = name;

		let maxCol = 0;
		for (const tile of tiles) {
			inst._addTile(tile);
			if (tile.col > maxCol) maxCol = tile.col;
		}
		inst.endX = (maxCol + 20) * BLOCK_SIZE;
		return inst;
	}

	toTiles() {
		return this.obstacles.map(obs => ({
			col: Math.round(obs.x / BLOCK_SIZE),
			// row 0 = sol, row croît vers le haut
			row: Math.round((this.groundY - obs.y) / BLOCK_SIZE) - 1,
			type: obs.type,
		}));
	}

	_addTile({ col, row, type }) {
		const worldX = col * BLOCK_SIZE;
		const worldY = this.groundY - (row - 1) * BLOCK_SIZE; // Pas trop compris pk
		this.obstacles.push({ type, x: worldX, y: worldY, w: BLOCK_SIZE, h: BLOCK_SIZE });
	}
	// ─── Runtime ──────────────────────────────────────────────────────────────────

	update(speedPx, dt) { this.scrollX += speedPx * dt; }

	/**
	 * Obstacles en coordonnées MONDE (pas d'offset de caméra).
	 * Le renderer applique ensuite (- scrollX, - cameraY).
	 */
	getObstaclesInView(scrollX, cameraY, viewW, viewH) {
		const margin = BLOCK_SIZE * 3;
		const wx1 = scrollX - margin;
		const wx2 = scrollX + viewW + margin;
		const wy1 = cameraY - margin;
		const wy2 = cameraY + viewH + margin;
		return this.obstacles.filter(o =>
			o.x + o.w > wx1 && o.x < wx2 &&
			o.y + o.h > wy1 && o.y < wy2
		);
	}

	/** Retourne les obstacles en coord. ÉCRAN (pour la collision joueur). */
	getScreenObstacles(scrollX, cameraY, viewW, viewH) {
		return this.getObstaclesInView(scrollX, cameraY, viewW, viewH).map(o => ({
			...o,
			x: o.x - scrollX,
			y: o.y - cameraY,
		}));
	}

	/** Pour l'IA : obstacles en coordonnées monde dans une fenêtre. */
	getObstaclesAround(playerWorldX, range) {
		return this.obstacles.filter(o =>
			o.x >= playerWorldX - BLOCK_SIZE && o.x <= playerWorldX + range
		);
	}

	isComplete(scrollX) {
		return scrollX >= this.endX - this.canvasWidth / 2;
	}
}
