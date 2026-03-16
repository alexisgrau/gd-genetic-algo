/**
 * ga-manager.js — Pont entre le Web Worker GA et l'interface.
 *
 * Responsabilités :
 *   - Démarrer / arrêter / pauser le Worker
 *   - Recevoir les résultats de chaque génération
 *   - Stocker l'historique localement (IndexedDB-free : tableau en mémoire)
 *   - Sauvegarder les meilleures générations sur le serveur
 *   - Exposer le meilleur génome pour le replay dans l'Engine
 */

class GAManager {
	/**
	 * @param {object}   options
	 * @param {Function} options.onGeneration   (stats) => void  — callback par génération
	 * @param {Function} options.onDone         (reason) => void
	 * @param {Function} options.onLog          (msg) => void
	 */
	constructor(options = {}) {
		this.onGeneration = options.onGeneration ?? (() => { });
		this.onDone = options.onDone ?? (() => { });
		this.onLog = options.onLog ?? ((m) => console.log('[GA]', m));

		this.worker = null;
		this.isRunning = false;
		this.isPaused = false;

		// Historique complet de la session
		this.history = []; // [{ gen, best, avg, worst, bestGenome }]
		this.currentBest = null; // Genome

		// Stats
		this.totalAttempts = 0;
		this.startTime = null;
	}

	// ─── Démarrage ───────────────────────────────────────────────────────────────

	/**
	 * Démarre le worker GA.
	 * @param {Object} levelData    { seed } ou { tiles, name }
	 * @param {Object} config       Paramètres de l'AG
	 * @param {number} speedMult    Vitesse de simulation
	 */
	start(levelData, config = {}, speedMult = 1.0) {
		if (this.worker) this.worker.terminate();

		this.history = [];
		this.currentBest = null;
		this.totalAttempts = 0;
		this.startTime = Date.now();
		this.isRunning = true;
		this.isPaused = false;

		this.worker = new Worker('/js/ai/ga-worker.js');
		this.worker.onmessage = (e) => this._handleMessage(e.data);
		this.worker.onerror = (e) => this.onLog(`❌ Worker error: ${e.message}`);

		this.worker.postMessage({ type: 'start', config, levelData, speedMult });
		this.onLog(`🧬 GA démarré — population ${config.populationSize ?? 200}`);
	}

	// ─── Contrôle ─────────────────────────────────────────────────────────────────

	stop() {
		if (!this.worker) return;
		this.worker.postMessage({ type: 'stop' });
		this.isRunning = false;
		this.isPaused = false;
	}

	pause() {
		if (!this.worker || !this.isRunning) return;
		this.worker.postMessage({ type: 'pause' });
		this.isPaused = true;
		this.onLog('⏸ GA mis en pause');
	}

	resume() {
		if (!this.worker || !this.isPaused) return;
		this.worker.postMessage({ type: 'resume' });
		this.isPaused = false;
		this.onLog('▶ GA repris');
	}

	terminate() {
		if (this.worker) { this.worker.terminate(); this.worker = null; }
		this.isRunning = false;
		this.isPaused = false;
	}

	// ─── Réception messages Worker ────────────────────────────────────────────────

	_handleMessage(msg) {
		switch (msg.type) {
			case 'generation':
				this._onGeneration(msg);
				break;
			case 'done':
				this.isRunning = false;
				this.onLog(`✅ GA terminé — raison : ${msg.reason}` + (msg.gen ? ` (gen ${msg.gen})` : ''));
				this.onDone(msg.reason, msg.gen);
				break;
			case 'log':
				this.onLog(msg.message);
				break;
		}
	}

	_onGeneration(msg) {
		this.totalAttempts = msg.totalAttempts;

		const genome = Genome.deserialize(msg.bestGenome);
		const entry = {
			gen: msg.gen,
			best: msg.best,
			avg: msg.avg,
			worst: msg.worst,
			bestGenome: genome,
		};

		this.history.push(entry);
		this.currentBest = genome;

		this.onGeneration(entry, this.history);

		// Sauvegarde sur le serveur (toutes les 10 générations ou si c'est le meilleur)
		const isNewBest = this.history.length < 2 || msg.best > this.history[this.history.length - 2]?.best;
		if (msg.gen % 10 === 0 || isNewBest) {
			this._saveToServer(entry).catch(() => { });
		}
	}

	// ─── Sauvegarde serveur ───────────────────────────────────────────────────────

	async _saveToServer(entry) {
		try {
			await fetch('/api/generations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					generationNumber: entry.gen,
					bestFitness: entry.best,
					avgFitness: entry.avg,
					bestGenome: entry.bestGenome.serialize(),
				}),
			});
		} catch { }
	}

	// ─── Lecture depuis le serveur (pour le dashboard) ───────────────────────────

	static async fetchHistory() {
		const res = await fetch('/api/generations');
		const data = await res.json();
		return data.generations ?? [];
	}

	static async clearHistory() {
		await fetch('/api/generations', { method: 'DELETE' });
	}

	// ─── Accesseurs ──────────────────────────────────────────────────────────────

	getBestGenome() { return this.currentBest; }

	getStats() {
		if (this.history.length === 0) return null;
		const last = this.history[this.history.length - 1];
		return {
			generation: last.gen,
			best: last.best,
			avg: last.avg,
			totalAttempts: this.totalAttempts,
			elapsed: Math.round((Date.now() - this.startTime) / 1000),
		};
	}

	getHistoryForGenIndex(genIdx) {
		return this.history[genIdx] ?? null;
	}
}
