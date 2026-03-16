class Simulator {
	constructor(levelData, canvasW = 900, canvasH = 500, speedMult = 1.0) {
		this.canvasW = canvasW;
		this.canvasH = canvasH;
		this.speedPx = SPEED_PRESETS[speedMult] * BLOCK_SIZE;
		this.levelData = levelData;
	}

	evaluate(genome, maxSteps = 80000) {
		let level;
		if (this.levelData.tiles) {
			level = Level.fromTiles(this.levelData.tiles, this.canvasW, this.canvasH, this.levelData.name);
		} else {
			level = new Level(this.canvasW, this.canvasH, this.levelData.seed ?? 42);
		}

		const player = new Player(level.groundY);
		const aiCtrl = new AIController(genome);
		const DT = 1 / 60;
		let jumpConsumed = false;
		let steps = 0;

		let jumpCount = 0;

		while (!player.isDead && !player.isWon && steps < maxSteps) {

			// 1. L'IA évalue AVANT le scroll (même ordre que l'engine)
			const wantsJump = aiCtrl.evaluate(player, level);
			let jump = false;
			if (wantsJump && !jumpConsumed) {
				jump = true;
				if (player.isOnGround) { jumpConsumed = true; jumpCount++; }
			}
			if (!wantsJump) jumpConsumed = false;

			// 2. Scroll
			level.update(this.speedPx, DT);

			// 3. Physique joueur avec obstacles en coord monde (x relatif au scroll)
			const worldObs = level.getObstaclesInView(
				level.scrollX, 0, this.canvasW, WORLD.HEIGHT
			).map(o => ({ ...o, x: o.x - level.scrollX }));

			player.update(DT, this.speedPx, jump, worldObs, true);

			if (level.isComplete(level.scrollX)) player.isWon = true;
			steps++;
		}

		// 1. Score de base : la distance parcourue
		let fitness = player.distanceBlocks;

		// 2. Prime massive de victoire
		// Garantit qu'un gagnant sera TOUJOURS au-dessus de n'importe quel perdant
		if (player.isWon) {
			fitness += 1000;
		}

		return Math.max(0, fitness);
	}

	evaluateAll(genomes) {
		return genomes.map(g => this.evaluate(g));
	}
}