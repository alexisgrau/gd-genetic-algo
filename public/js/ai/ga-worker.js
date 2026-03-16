/**
 * ga-worker.js — Web Worker dédié à l'algorithme génétique.
 *
 * S'exécute sur un thread séparé pour ne pas bloquer le rendu du jeu.
 *
 * Messages reçus (main → worker) :
 *   { type: 'start', config, levelData, speedMult }
 *   { type: 'stop' }
 *   { type: 'pause' }
 *   { type: 'resume' }
 *
 * Messages envoyés (worker → main) :
 *   { type: 'generation', gen, best, avg, worst, bestGenome, history }
 *   { type: 'done', reason }
 *   { type: 'log', message }
 */

// ─── Imports des modules dans le Worker ──────────────────────────────────────
// importScripts est disponible dans les Workers classiques (non-module)
importScripts(
	'/js/game/constants.js',
	'/js/game/player.js',
	'/js/game/level.js',
	'/js/ai/genome.js',
	'/js/ai/ai-controller.js',
	'/js/ai/simulator.js',
	'/js/ai/genetic-algorithm.js'
);

// ─── État du worker ───────────────────────────────────────────────────────────

let running = false;
let paused = false;
let ga = null;
let sim = null;
let config = null;
let maxGenerations = 500;

// ─── Réception des messages ───────────────────────────────────────────────────

self.onmessage = function (e) {
	const msg = e.data;

	switch (msg.type) {
		case 'start':
			config = msg.config ?? {};
			maxGenerations = config.maxGenerations ?? 500;
			ga = new GeneticAlgorithm(config);
			sim = new Simulator(msg.levelData, 900, 500, msg.speedMult ?? 1.0);
			ga.init();
			running = true;
			paused = false;
			self.postMessage({ type: 'log', message: `Worker démarré — pop ${config.populationSize ?? 200} / ${maxGenerations} gens` });
			_runLoop();
			break;

		case 'stop':
			running = false;
			self.postMessage({ type: 'done', reason: 'stopped' });
			break;

		case 'pause':
			paused = true;
			break;

		case 'resume':
			if (paused) { paused = false; _runLoop(); }
			break;
	}
};

// ─── Boucle principale ────────────────────────────────────────────────────────

function _runLoop() {
	if (!running) return;
	if (paused) return; // reprendra sur 'resume'

	if (ga.generation >= maxGenerations) {
		running = false;
		self.postMessage({ type: 'done', reason: 'max_generations' });
		return;
	}

	// ── Évaluation ────────────────────────────────────────────────────────────
	const fitnessValues = sim.evaluateAll(ga.population);
	const stats = ga.applyFitness(fitnessValues);

	// ── Notification de la génération ─────────────────────────────────────────
	self.postMessage({
		type: 'generation',
		gen: ga.generation,
		best: stats.best,
		avg: stats.avg,
		worst: stats.worst,
		bestGenome: stats.bestGenome.serialize(),
		history: ga.history,
		totalAttempts: ga.generation * (config.populationSize ?? 200),
	});

	self.postMessage({
		type: 'log',
		message: `[Gen ${ga.generation}] best=${stats.best.toFixed(1)} avg=${stats.avg.toFixed(1)} | stagnation=${stats.stagnation} | ${stats.similarityLog}`,
	});

	// ── Victoire détectée (best = longueur max du niveau) ─────────────────────
	// Un niveau de 300 blocs × 0.95 de marge = considéré terminé
	const WIN_THRESHOLD = 340;
	if (stats.best >= WIN_THRESHOLD) {
		running = false;
		self.postMessage({ type: 'done', reason: 'solved', gen: ga.generation });
		return;
	}

	// ── Évolution ─────────────────────────────────────────────────────────────
	ga.evolve();

	// Yield via setTimeout pour ne pas bloquer le Worker sur des opérations I/O
	// et permettre la réception de messages 'stop'/'pause'
	setTimeout(_runLoop, 0);
}