/**
 * genetic-algorithm.js
 *
 * Cycle d'évolution :
 * 1. Évaluation  : simuler chaque individu → fitness = distance parcourue
 * 2. Tri         : classer par fitness décroissante
 * 3. Sélection   : garder les `eliteCount` meilleurs
 * 4. Reproduction: chaque élite produit exactement N enfants mutés
 *                  N = (populationSize - eliteCount) / eliteCount
 *                  Chaque enfant reçoit UNE SEULE opération de mutation :
 *                    50% → mutation d'un trigger existant
 *                    25% → ajout d'un trigger
 *                    25% → suppression d'un trigger
 */

class GeneticAlgorithm {
	constructor(config = {}) {
		this.config = {
			populationSize:    config.populationSize    ?? 1000,
			eliteCount:        config.eliteCount        ?? 50,
			maxNetworks:       config.maxNetworks       ?? 4,
			maxTriggersPerNet: config.maxTriggersPerNet ?? 5,
			...config,
		};

		this.generation        = 0;
		this.population        = [];
		this.history           = [];
		this.bestEver          = null;
		this.stagnationCounter = 0;
		this.lastBestFitness   = 0;
	}

	// ── Helper ──────────────────────────────────────────────────────────────────

	_randomTrigger() {
		const totalRows = VISION.ROWS + (VISION.ROWS_BELOW ?? 4) + 1;
		return new Trigger(
			Math.random() * (VISION.COLS - 1),
			Math.random() * (totalRows - 1),
			Math.floor(Math.random() * 6)
		);
	}

	// ─── Initialisation ───────────────────────────────────────────────────────────

	init() {
		this.population = Array.from({ length: this.config.populationSize }, () => Genome.random(this.config.maxNetworks, this.config.maxTriggersPerNet));
		this.generation        = 0;
		this.history           = [];
		this.bestEver          = null;
		this.stagnationCounter = 0;
		this.lastBestFitness   = 0;
	}

	restore(state) {
		this.generation = state.generation;
		this.history    = state.history ?? [];
		this.bestEver   = state.bestEver ? Genome.deserialize(state.bestEver) : null;
		this.population = state.population ? state.population.map(g => Genome.deserialize(g)) : [];
	}

	// ─── Évaluation ──────────────────────────────────────────────────────────────

	applyFitness(fitnessValues) {
		// 1. Assigner les scores
		for (let i = 0; i < this.population.length; i++) {
			this.population[i].fitness = fitnessValues[i];
		}

		// 2. Tri décroissant
		this.population.sort((a, b) => b.fitness - a.fitness);

		const rawBest = this.population[0].fitness;

		// 3. Stagnation
		if (rawBest <= this.lastBestFitness * 1.001) {
			this.stagnationCounter++;
		} else {
			this.stagnationCounter = 0;
			this.lastBestFitness   = rawBest;
		}

		// 4. Stats
		const best  = rawBest;
		const worst = this.population[this.population.length - 1].fitness;
		const avg   = this.population.reduce((s, g) => s + g.fitness, 0) / this.population.length;

		this.history.push({ gen: this.generation, best, avg, worst });

		if (!this.bestEver || best > this.bestEver.fitness) {
			this.bestEver = this.population[0].clone();
		}

		// 5. Log similarité sur les élites
		// Algo : on parcourt les élites dans l'ordre de fitness.
		// Pour chaque élite non encore groupé, on trouve tous ceux qui lui ressemblent,
		// on les compte comme un cluster et on les retire du pool.
		const elites = this.population.slice(0, this.config.eliteCount);
		const unprocessed = new Set(elites);
		const clusters = [];

		for (const elite of elites) {
			if (!unprocessed.has(elite)) continue;
			const cluster = [elite];
			unprocessed.delete(elite);
			for (const other of [...unprocessed]) {
				if (this._isTooSimilar(elite, other)) {
					cluster.push(other);
					unprocessed.delete(other);
				}
			}
			clusters.push(cluster.length);
		}

		const distinctNiches = clusters.length;
		const biggestClone = Math.max(...clusters);
		const cloneLog = clusters.filter(s => s > 1).map(s => `${s}x`).join(' ') || 'aucun';

		const similarityLog = `niches=${distinctNiches} | plus grand clone=${biggestClone} | groupes>1: ${cloneLog}`;

		return { best, avg, worst, bestGenome: this.population[0], similarityLog, stagnation: this.stagnationCounter };
	}

	// ─── Similarité structurelle ─────────────────────────────────────────────────

	/**
	 * Retourne true si deux génomes sont structurellement trop proches.
	 * Critères (tous requis) :
	 *   1. Même nombre de réseaux
	 *   2. Pour chaque réseau : même nombre de triggers
	 *   3. Pour chaque trigger : même type
	 *   4. Pour chaque trigger : position à ±0.5 blocs sur X et Y
	 */
	_isTooSimilar(genomeA, genomeB) {
		const netsA = genomeA.networks;
		const netsB = genomeB.networks;
		if (netsA.length !== netsB.length) return false;

		const THRESHOLD = 1;

		for (let ni = 0; ni < netsA.length; ni++) {
			const tA = netsA[ni].triggers;
			const tB = netsB[ni].triggers;
			if (tA.length !== tB.length) return false;
			for (let ti = 0; ti < tA.length; ti++) {
				if (tA[ti].type !== tB[ti].type) return false;
				if (Math.abs(tA[ti].x - tB[ti].x) > THRESHOLD) return false;
				if (Math.abs(tA[ti].y - tB[ti].y) > THRESHOLD) return false;
			}
		}
		return true;
	}

	// ─── Évolution ───────────────────────────────────────────────────────────────

	evolve() {
		const { populationSize, eliteCount } = this.config;
		const elites = this.population.slice(0, eliteCount);

		// Enfants par élite pour atteindre exactement populationSize
		const childrenPerElite = Math.floor((populationSize - eliteCount) / eliteCount);
		const remainder = (populationSize - eliteCount) % eliteCount;

		const newPop = [];

		// 1. Conserver les élites intactes
		for (const e of elites){ newPop.push(e.clone()); }

		// 2. Chaque élite génère ses enfants — chacun avec UNE seule mutation
		for (let ei = 0; ei < elites.length; ei++) {
			const parent    = elites[ei];
			const nChildren = childrenPerElite + (ei < remainder ? 1 : 0);
			for (let ci = 0; ci < nChildren; ci++) {
				const child = parent.clone();
				this._mutateOne(child);
				newPop.push(child);
			}
		}

		this.population = newPop;
		this.generation++;
		return this.population;
	}

	// ─── Mutation : une seule opération par enfant ───────────────────────────────

	/**
	 * Applique exactement UNE opération de mutation :
	 *   50% → muter un trigger existant
	 *   25% → ajouter un trigger
	 *   25% → supprimer un trigger
	 */
	_mutateOne(genome) {
		const roll = Math.random();

		if (roll < 0.50) {
			this._opMutateTrigger(genome);
		}
		else if (roll < 0.75) {
			this._opAddTrigger(genome);
		}
		else {
			this._opRemoveTrigger(genome);
		}

		// Garantie : au moins 1 réseau avec 1 trigger
		if (genome.networks.length === 0) {
			genome.networks.push(new TriggerNetwork([this._randomTrigger()]));
		}
		for (const n of genome.networks) {
			if (n.triggers.length === 0) n.triggers.push(this._randomTrigger());
		}
	}

	// ── Opération : muter un trigger ────────────────────────────────────────────

	/**
	 * Choisit un trigger au hasard, puis applique l'une des 3 sous-mutations :
	 *   ~34% → changer le type (parmi les 5 autres types)
	 *   ~33% → changer la position (petit, grand ou téléportation)
	 *   ~33% → changer de réseau (existant ou nouveau)
	 */
	_opMutateTrigger(genome) {
		const all = [];
		for (const net of genome.networks) {
			for (const t of net.triggers) all.push({ net, t });
		}
		if (all.length === 0) return;

		const { net: srcNet, t } = all[Math.floor(Math.random() * all.length)];
		const totalRows = VISION.ROWS + (VISION.ROWS_BELOW ?? 4) + 1;
		const subRoll   = Math.random();

		if (subRoll < 0.34) { // ── Changer le type
			const otherTypes = [0, 1, 2, 3, 4, 5].filter(v => v !== t.type);
			t.type = otherTypes[Math.floor(Math.random() * otherTypes.length)];

		}
		else if (subRoll < 0.67) { // ── Changer la position
			const posRoll = Math.random();
			if (posRoll < 0.50) {
				// Petit déplacement ±1 bloc
				t.x += (Math.random() - 0.5) * 2;
				t.y += (Math.random() - 0.5) * 2;
			}
			else if (posRoll < 0.80) {
				// Grand déplacement ±3 blocs
				t.x += (Math.random() - 0.5) * 6;
				t.y += (Math.random() - 0.5) * 6;
			}
			else {
				// Téléportation complète
				t.x = Math.random() * (VISION.COLS - 1);
				t.y = Math.random() * (totalRows - 1);
			}
			t.x = Math.max(0, Math.min(VISION.COLS - 1, t.x));
			t.y = Math.max(0, Math.min(totalRows - 1,   t.y));

		}
		else { // ── Changer de réseau
			// Candidats : réseaux existants sauf celui d'origine + 1 slot "nouveau réseau"
			const otherNets = genome.networks.filter(n => n !== srcNet);
			const slot = Math.floor(Math.random() * (otherNets.length + 1));

			srcNet.triggers.splice(srcNet.triggers.indexOf(t), 1);
			if (srcNet.triggers.length === 0) {
				genome.networks.splice(genome.networks.indexOf(srcNet), 1);
			}

			if (slot < otherNets.length) {
				otherNets[slot].triggers.push(t);
			} else {
				genome.networks.push(new TriggerNetwork([t]));
			}
		}
	}

	// ── Opération : ajouter un trigger ──────────────────────────────────────────

	/**
	 * Crée un trigger aléatoire et le place dans un réseau existant
	 * ou dans un nouveau réseau (si le slot "vide" est tiré).
	 */
	_opAddTrigger(genome) {
		const trigger = this._randomTrigger();
		const slotCount = genome.networks.length + 1;
		const slot = Math.floor(Math.random() * slotCount);

		if (slot < genome.networks.length) {
			genome.networks[slot].triggers.push(trigger);
		}
		else {
			genome.networks.push(new TriggerNetwork([trigger]));
		}
	}

	// ── Opération : supprimer un trigger ────────────────────────────────────────

	/**
	 * Choisit un trigger au hasard et le supprime.
	 * Si le réseau devient vide, il est supprimé aussi.
	 */
	_opRemoveTrigger(genome) {
		const all = [];
		for (const net of genome.networks) {
			for (const t of net.triggers) all.push({ net, t });
		}
		if (all.length === 0) return;

		const { net, t } = all[Math.floor(Math.random() * all.length)];
		net.triggers.splice(net.triggers.indexOf(t), 1);
		if (net.triggers.length === 0) {
			genome.networks.splice(genome.networks.indexOf(net), 1);
		}
	}

	// ─── Sérialisation ────────────────────────────────────────────────────────────

	serializeState() {
		return {
			generation: this.generation,
			history: this.history,
			bestEver: this.bestEver ? this.bestEver.serialize() : null,
			population: this.population.slice(0, this.config.eliteCount).map(g => g.serialize()),
		};
	}

	getBestGenome() {
		return this.bestEver || this.population[0] || null;
	}
}