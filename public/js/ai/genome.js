/**
 * genome.js — Représentation du "cerveau" de l'IA.
 *
 * Structure :
 *   Genome → N réseaux (OR entre eux)
 *   Réseau → M triggers (AND entre eux)
 *   Trigger → {x, y, type} en coordonnées flottantes dans la zone de vision
 *
 * Chaque trigger est un capteur de taille 1×1 bloc, positionné librement
 * (coordonnées flottantes). Il peut se superposer avec d'autres triggers.
 * Il s'active selon le contenu de l'obstacle qui le touche (test AABB).
 *
 * Si AU MOINS UN réseau est entièrement validé → le joueur SAUTE.
 * C'est un système DNF (Forme Normale Disjonctive).
 */

// ─── Trigger ─────────────────────────────────────────────────────────────────

class Trigger {
	/**
	 * @param {number} x     Position X en blocs (float), 0 = bord gauche du joueur
	 * @param {number} y     Position Y en blocs (float), 0 = rangée la plus basse de la grille
	 * @param {number} type  Un des TRIGGER_TYPE.*
	 */
	constructor(x, y, type) {
		this.x = x;
		this.y = y;
		this.type = type;
	}

	/**
	 * Évalue le trigger contre un contenu de cellule.
	 * @param {number} cellContent  CELL.AIR | CELL.BLOCK | CELL.SPIKE
	 */
	evaluate(cellContent) {
		switch (this.type) {
			case TRIGGER_TYPE.BLOCK_PRESENT: return cellContent === CELL.BLOCK;
			case TRIGGER_TYPE.BLOCK_ABSENT: return cellContent !== CELL.BLOCK;
			case TRIGGER_TYPE.SPIKE_PRESENT: return cellContent === CELL.SPIKE;
			case TRIGGER_TYPE.SPIKE_ABSENT: return cellContent !== CELL.SPIKE;
			case TRIGGER_TYPE.AIR_PRESENT: return cellContent === CELL.AIR;
			case TRIGGER_TYPE.AIR_ABSENT: return cellContent !== CELL.AIR;
			default: return false;
		}
	}

	serialize() {
		return { x: this.x, y: this.y, type: this.type };
	}

	static deserialize(d) {
		// Rétrocompatibilité avec l'ancien format {col, row}
		const x = d.x ?? d.col ?? 0;
		const y = d.y ?? d.row ?? 0;
		return new Trigger(x, y, d.type);
	}
}

// ─── TriggerNetwork ───────────────────────────────────────────────────────────

class TriggerNetwork {
	/**
	 * @param {Trigger[]} triggers
	 */
	constructor(triggers = []) {
		this.triggers = triggers;
		this.isActive = false;
	}

	/**
	 * Porte ET : tous les triggers doivent s'activer.
	 * Chaque trigger interroge directement les obstacles via l'AIController
	 * avec ses coordonnées flottantes (pas de grille discrète).
	 *
	 * @param {Function} sampleFn  (x, y) => CELL.*  — fournie par AIController
	 */
	evaluate(sampleFn) {
		if (this.triggers.length === 0) {
			this.isActive = false;
			return false;
		}
		this.isActive = this.triggers.every(t => t.evaluate(sampleFn(t.x, t.y)));
		return this.isActive;
	}

	serialize() {
		return this.triggers.map(t => t.serialize());
	}

	static deserialize(d) {
		return new TriggerNetwork(d.map(t => Trigger.deserialize(t)));
	}
}

// ─── Genome ───────────────────────────────────────────────────────────────────

class Genome {
	/**
	 * @param {TriggerNetwork[]} networks
	 */
	constructor(networks = []) {
		this.networks = networks;
		this.fitness = 0;
	}

	/**
	 * Porte OU : au moins un réseau doit être entièrement validé.
	 * @param {Function} sampleFn  (x, y) => CELL.*
	 */
	evaluate(sampleFn) {
		return this.networks.some(n => n.evaluate(sampleFn));
	}

	serialize() {
		return {
			networks: this.networks.map(n => n.serialize()),
			fitness: this.fitness,
		};
	}

	static deserialize(d) {
		const g = new Genome(d.networks.map(n => TriggerNetwork.deserialize(n)));
		g.fitness = d.fitness || 0;
		return g;
	}

	clone() {
		return Genome.deserialize(this.serialize());
	}

	static random(maxNetworks = 3, maxTriggersPerNetwork = 3) {
		const totalRows = VISION.ROWS + (VISION.ROWS_BELOW ?? 4) + 1;
		// On démarre avec des génomes simples : 1-2 réseaux, 1-2 triggers chacun
		const numNetworks = 1 + Math.floor(Math.random() * Math.min(2, maxNetworks));
		const networks = [];

		for (let i = 0; i < numNetworks; i++) {
			const numTriggers = 1 + Math.floor(Math.random() * Math.min(2, maxTriggersPerNetwork));
			const triggers = [];
			for (let j = 0; j < numTriggers; j++) {
				triggers.push(new Trigger(
					Math.random() * (VISION.COLS - 1),
					Math.random() * (totalRows - 1),
					Math.floor(Math.random() * 6)
				));
			}
			networks.push(new TriggerNetwork(triggers));
		}

		return new Genome(networks);
	}

	describe() {
		const rowsBelow = VISION.ROWS_BELOW ?? 4;
		return this.networks.map((n, ni) => {
			const triggers = n.triggers.map(t => {
				const rowReal = (t.y - rowsBelow).toFixed(2);
				return `(x=${t.x.toFixed(2)},y=${rowReal},${TRIGGER_LABELS[t.type]})`;
			}).join(' AND ');
			return `[R${ni}] ${triggers}`;
		}).join('\n  OR ');
	}
}