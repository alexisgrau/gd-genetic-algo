/**
 * player.js — Physique du joueur dans le monde 20-blocs.
 * Gère : gravité, saut, collision sol/blocs, mort sur piques (normales et inversées).
 */

class Player {
	constructor(groundY) {
		this.groundY = groundY;  // Y monde du dessus du sol
		this.size = PLAYER.SIZE;
		this.x = PLAYER.START_X;
		this.y = groundY - this.size;   // posé sur le sol

		this.velocityY = 0;
		this.isOnGround = true;
		this.isDead = false;
		this.isWon = false;
		this.rotation = 0;
		this.distanceBlocks = 0;
		this.hasJumped = false;
	}

	/**
	 * @param {number}  dt
	 * @param {number}  speedPx      Vitesse horizontale px/s
	 * @param {boolean} jumpInput    Front montant = sauter
	 * @param {Array}   obstacles    Obstacles en coordonnées MONDE
	 * @param {boolean} headless     Mode simulation sans rendu
	 */
	update(dt, speedPx, jumpInput, obstacles, headless = false) {
		if (this.isDead || this.isWon) return;

		const BASE_SPEED_PX = BASE_SPEED * BLOCK_SIZE; 
		const ratio = speedPx / BASE_SPEED_PX;

		// On applique les mathématiques de la trajectoire
		const currentGravity = PHYSICS.GRAVITY * (ratio * ratio);
		const currentJumpVelocity = PHYSICS.JUMP_VELOCITY * ratio;

		// 1. Saut
		if (jumpInput && this.isOnGround) {
			this.velocityY = currentJumpVelocity; // On utilise la vélocité ajustée
			this.isOnGround = false;
			this.hasJumped = true;
		}

		// 2. Gravité TOUJOURS
		this.velocityY += currentGravity * dt;

		// 3. Mouvement vertical
		this.y += this.velocityY * dt;

		// 4. Reset
		this.isOnGround = false;

		// 5. Sol monde
		const floorY = this.groundY - this.size;
		if (this.y >= floorY) {
			this.y = floorY;
			this.velocityY = 0;
			this.isOnGround = true;
			if (!headless) this._snapRotation();
		}

		// 6. Plafond
		if (this.y < 0) {
			this.y = 0;
			this.velocityY = Math.max(0, this.velocityY);
		}

		// 7. Distance
		this.distanceBlocks += (speedPx * dt) / BLOCK_SIZE;

		// 8. Collisions obstacles
		this._checkCollisions(obstacles);

		// 9. Anti-sautillement
		if (this.isOnGround) {
			this.velocityY = 0;
			this.hasJumped = false;
		}

		// 10. Rotation uniquement si saut réel
		if (!headless && this.hasJumped && !this.isOnGround) {
			this.rotation += Math.PI * 2.2 * dt;
		}
	}

	_checkCollisions(obstacles) {
		const INSET = 3;

		// 1. Hitbox RÉDUITE (pour les piques / la mort)
		const hx1 = this.x + INSET;
		const hy1 = this.y + INSET;
		const hx2 = this.x + this.size - INSET;
		const hy2 = this.y + this.size - INSET;

		// 2. Hitbox RÉELLE (pour la physique des blocs solides)
		const rx1 = this.x;
		const ry1 = this.y;
		const rx2 = this.x + this.size;
		const ry2 = this.y + this.size;

		for (const obs of obstacles) {
			if (obs.type === 'block') {
				// On passe les coordonnées RÉELLES pour éviter le sautillement
				this._resolveBlock(obs, rx1, ry1, rx2, ry2);
				if (this.isDead) return;

			} else if (obs.type === 'spike') {
				// Pique normale : hitbox triangulaire approchée avec la hitbox réduite
				const SI = 6;
				if (hx1 < obs.x + obs.w - SI && hx2 > obs.x + SI &&
					hy1 < obs.y + obs.h && hy2 > obs.y + SI) {
					this.die(); return;
				}

			} else if (obs.type === 'spike_inv') {
				// Pique inversée : avec la hitbox réduite
				const SI = 6;
				if (hx1 < obs.x + obs.w - SI && hx2 > obs.x + SI &&
					hy1 < obs.y + obs.h - SI && hy2 > obs.y) {
					this.die(); return;
				}
			}
		}
	}

	_resolveBlock(obs, rx1, ry1, rx2, ry2) {
		const bx1 = obs.x, by1 = obs.y, bx2 = obs.x + obs.w, by2 = obs.y + obs.h;

		// Si pas de collision, on ignore
		if (rx1 >= bx2 || rx2 <= bx1 || ry1 >= by2 || ry2 <= by1) return;

		// Calcul de la pénétration (chevauchement) sur chaque bord
		const overlapB = by2 - ry1; // Bas du bloc
		const overlapT = ry2 - by1; // Haut du bloc (Sol)
		const overlapL = bx2 - rx1; // Droite du bloc
		const overlapR = rx2 - bx1; // Gauche du bloc (Mur face au joueur)

		// On cherche le plus petit chevauchement sur l'axe X et Y
		const minX = Math.min(overlapL, overlapR);
		const minY = Math.min(overlapT, overlapB);

		// TOLÉRANCE ANTI-GHOST COLLISION :
		// Si les pieds du joueur sont à moins de 15 pixels du haut du bloc et qu'il tombe,
		// on force la décision en "Atterrissage".
		const isLanding = overlapT <= 15 && this.velocityY >= 0;

		if (isLanding || minY < minX) {
			// --- RÉSOLUTION VERTICALE ---
			if (overlapT <= overlapB && this.velocityY >= 0) {
				// Atterrissage sur le sol
				this.y = by1 - this.size;
				this.velocityY = 0;
				this.isOnGround = true;
				this._snapRotation();
			} else if (overlapB < overlapT && this.velocityY < 0) {
				// Se cogne la tête au plafond
				this.y = by2;
				this.velocityY = Math.abs(this.velocityY) * 0.3;
			}
		} else {
			// --- RÉSOLUTION HORIZONTALE ---
			// Si ce n'est ni le sol ni le plafond, c'est qu'on a foncé dans un mur.
			this.die();
		}
	}

	_snapRotation() {
		const snap = Math.PI / 2;
		this.rotation = Math.round(this.rotation / snap) * snap;
	}

	die() {
		this.isDead = true;
		this.velocityY = 0;
	}

	getBounds() {
		return { x: this.x, y: this.y, w: this.size, h: this.size };
	}
}
