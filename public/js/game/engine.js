/**
 * engine.js — Moteur de jeu avec caméra verticale dynamique.
 *
 * La caméra reste stable tant que le joueur est dans la "deadzone" centrale.
 * Elle bouge lorsqu'il s'approche à moins de CAMERA.DEADZONE_*_BLOCKS du bord.
 */

class Engine {
	constructor(canvas, options = {}) {
		this.canvas = canvas;
		this.speedMultiplier = options.speedMultiplier ?? DEFAULT_SPEED_MULTIPLIER;
		this.seed = options.seed ?? 42;
		this.customTiles = options.customTiles ?? null;
		this.customLevelName = options.customLevelName ?? null;
		this.showAIOverlay = options.showAIOverlay ?? true;

		this.speedPx = SPEED_PRESETS[this.speedMultiplier] * BLOCK_SIZE;
		this.state = 'playing';
		this.attempts = 0;
		this.generation = 0;
		this.mode = 'MANUEL';

		// ── Caméra ────────────────────────────────────────────────────────────────
		// cameraY = coordonnée Y monde du coin supérieur gauche du viewport
		this.cameraY = 0;
		this._targetCameraY = 0;
		this._cameraMinY = 0;
		this._cameraMaxY = WORLD.HEIGHT - canvas.height;

		// ── IA ────────────────────────────────────────────────────────────────────
		this.aiController = null;

		// ── Sous-systèmes ─────────────────────────────────────────────────────────
		this.renderer = new Renderer(canvas);
		this._initGameObjects();

		// ── Inputs ────────────────────────────────────────────────────────────────
		this._jumpPressed = false;
		this._jumpConsumed = false;
		this._bindInputs();

		// ── Boucle ────────────────────────────────────────────────────────────────
		this._raf = null;
		this._lastTime = null;
		this._accumulator = 0;
		this._deathTimer = 0;
		this.DEATH_DELAY = 0.8;

		this.onDeath = null;
		this.onWin = null;
	}

	// ─── Init ─────────────────────────────────────────────────────────────────────

	_initGameObjects() {
		this.level = this.customTiles ? Level.fromTiles(this.customTiles, this.canvas.width, this.canvas.height, this.customLevelName) : new Level(this.canvas.width, this.canvas.height, this.seed);

		this.player = new Player(this.level.groundY);

		// Caméra : positionner sur le sol au démarrage
		this._cameraMaxY = WORLD.HEIGHT - this.canvas.height;
		this.cameraY = Math.max(0, this.level.groundY - this.canvas.height + BLOCK_SIZE * 2);
		this._targetCameraY = this.cameraY;
	}

	// ─── IA ───────────────────────────────────────────────────────────────────────

	setAI(genome) {
		this.aiController = genome ? new AIController(genome) : null;
		this.mode = this.aiController ? 'IA' : 'MANUEL';
	}

	// ─── Inputs ───────────────────────────────────────────────────────────────────

	_bindInputs() {
		this._onKeyDown = (e) => {
			if (e.code === 'Space' || e.code === 'ArrowUp') {
				e.preventDefault();
				if (this.state === 'dead') { this._restart(); return; }
				this._jumpPressed = true;
			}
		};
		this._onKeyUp = (e) => {
			if (e.code === 'Space' || e.code === 'ArrowUp') {
				this._jumpPressed = false; this._jumpConsumed = false;
			}
		};
		this._onClick = () => {
			if (this.state === 'dead') { this._restart(); return; }
			this._jumpPressed = true;
			setTimeout(() => { this._jumpPressed = false; this._jumpConsumed = false; }, 80);
		};
		document.addEventListener('keydown', this._onKeyDown);
		document.addEventListener('keyup', this._onKeyUp);
		this.canvas.addEventListener('click', this._onClick);
	}

	_unbindInputs() {
		document.removeEventListener('keydown', this._onKeyDown);
		document.removeEventListener('keyup', this._onKeyUp);
		this.canvas.removeEventListener('click', this._onClick);
	}

	// ─── Boucle ───────────────────────────────────────────────────────────────────

	start() {
		this._lastTime = performance.now();
		this._accumulator = 0;
		this._loop(this._lastTime);
	}

	stop() {
		if (this._raf) cancelAnimationFrame(this._raf);
		this._raf = null;
		this._unbindInputs();
	}

	_loop(ts) {
		this._raf = requestAnimationFrame(t => this._loop(t));

		// Accumule le temps écoulé et consomme en pas fixes de 1/60s
		// → physique identique au simulateur quel que soit le framerate
		const FIXED_DT = 1 / 60;
		const elapsed = Math.min((ts - this._lastTime) / 1000, 0.1); // cap à 100ms
		this._lastTime = ts;
		this._accumulator += elapsed;

		while (this._accumulator >= FIXED_DT) {
			this._update(FIXED_DT);
			this._accumulator -= FIXED_DT;
		}

		this._draw();
	}

	// ─── Update ───────────────────────────────────────────────────────────────────

	_update(dt) {
		if (this.state === 'playing') this._updatePlaying(dt);
		else if (this.state === 'dead') this._updateDead(dt);
	}

	_updatePlaying(dt) {
		// ── Décision de saut ──────────────────────────────────────────────────────
		let jump = false;
		if (this.aiController) {
			const wants = this.aiController.evaluate(this.player, this.level);
			if (wants && !this._jumpConsumed) {
				jump = true;
				if (this.player.isOnGround) this._jumpConsumed = true;
			}
			if (!wants) this._jumpConsumed = false;
		}
		else {
			jump = this._jumpPressed;
		}

		// ── Scroll horizontal ─────────────────────────────────────────────────────
		this.level.update(this.speedPx, dt);

		// ── Joueur (collision en coord. ÉCRAN) ────────────────────────────────────
		// On passe les obstacles en coordonnées ÉCRAN (avec camera appliquée)
		//const screenObs = this.level.getScreenObstacles(this.level.scrollX, this.cameraY, this.canvas.width, this.canvas.height);
		// Player.y est en coord. MONDE → on adapte le groundY pour la collision écran
		// En fait les obstacles screen ont y = worldY - cameraY
		// Le player.y est en monde, donc on doit aussi convertir le groundY
		// → Meilleure approche : le joueur travaille en coordonnées monde

		// Obstacles en coordonnées MONDE pour la physique — toute la hauteur monde
		// comme dans le simulateur (pas seulement ce qui est visible à l'écran)
		const worldObs = this.level.getObstaclesInView(this.level.scrollX, 0, this.canvas.width, WORLD.HEIGHT).map(o => ({ ...o, x: o.x - this.level.scrollX }));

		this.player.update(dt, this.speedPx, jump, worldObs);

		// ── Caméra ────────────────────────────────────────────────────────────────
		this._updateCamera(dt);

		// ── Mort ──────────────────────────────────────────────────────────────────
		if (this.player.isDead) {
			this.state = 'dead'; this._deathTimer = 0;
			if (this.onDeath) this.onDeath(this.player.distanceBlocks);
		}

		// ── Victoire ──────────────────────────────────────────────────────────────
		if (this.level.isComplete(this.level.scrollX)) {
			this.state = 'won';
			if (this.onWin) this.onWin(this.player.distanceBlocks);
		}
	}

	_updateDead(dt) {
		this._deathTimer += dt;
		if (this._deathTimer > this.DEATH_DELAY && this.mode === 'IA') this._restart();
	}

	// ─── Caméra ───────────────────────────────────────────────────────────────────

	_updateCamera(dt) {
		const H = this.canvas.height;
		const bs = BLOCK_SIZE;
		const dzTop = CAMERA.DEADZONE_TOP_BLOCKS * bs; // 160px
		const dzBot = CAMERA.DEADZONE_BOTTOM_BLOCKS * bs; // 160px

		// Position Y du joueur sur l'écran (avec la caméra actuelle)
		const playerScreenY = this.player.y - this.cameraY;

		// Recalcul de la cible caméra si le joueur sort de la deadzone
		if (playerScreenY < dzTop) {
			// Joueur trop haut → monter la caméra
			this._targetCameraY = this.player.y - dzTop;
		}
		else if (playerScreenY + bs > H - dzBot) {
			// Joueur trop bas → descendre la caméra
			this._targetCameraY = this.player.y + bs - (H - dzBot);
		}

		// Clampe aux bornes du monde
		this._targetCameraY = Math.max(0, Math.min(this._targetCameraY, this._cameraMaxY));

		// Lerp fluide
		this.cameraY += (this._targetCameraY - this.cameraY) * CAMERA.LERP * dt;
		this.cameraY = Math.max(0, Math.min(this.cameraY, this._cameraMaxY));
	}

	_restart() {
		this.attempts++;
		this.state = 'playing'; this._jumpPressed = false; this._jumpConsumed = false;
		this._initGameObjects();
		if (this.aiController) {
			this.aiController.lastGrid = null; this.aiController.lastDecision = false;
		}
	}

	// ─── Draw ─────────────────────────────────────────────────────────────────────

	_draw() {
		const camera = { scrollX: this.level.scrollX, cameraY: this.cameraY };
		const ai = (this.showAIOverlay && this.aiController) ? this.aiController : null;
		const info = {
			generation: this.generation, attempts: this.attempts,
			speedMult: this.speedMultiplier, mode: this.mode,
			seed: this.seed, levelName: this.customLevelName,
		};
		this.renderer.render(this.player, this.level, camera, info, ai);
		if (this.state === 'dead') this.renderer.drawDeathScreen(this.player.distanceBlocks);
	}

	// ─── API ──────────────────────────────────────────────────────────────────────

	setSpeed(mult) {
		if (!SPEED_PRESETS[mult]) return;
		this.speedMultiplier = mult;
		this.speedPx = SPEED_PRESETS[mult] * BLOCK_SIZE;
	}

	getDistance() { return this.player.distanceBlocks; }
}