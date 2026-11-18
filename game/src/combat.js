// Combat for AZURA HEAT: mouse-aimed pistol with magazine and reload, melee punches,
// bullets with tracers, hit reactions, muzzle flash and particle effects.
import { MAG_SIZE } from './config.js';
import { scarePeds, knockDownPed } from './pedestrians.js';

export function createCombatState() {
  return { bullets: [], particles: [], flashes: [] };
}

export function spawnParticles(G, x, y, n, color, spread) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * (spread || 80);
    G.combat.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, max: 0.8, color, size: 2 + Math.random() * 3 });
  }
  if (G.combat.particles.length > 400) G.combat.particles.splice(0, G.combat.particles.length - 400);
}

export function tryShoot(G) {
  const p = G.player;
  if (p.car || p.fireTimer > 0 || p.reloading > 0) return;
  if (p.ammoMag <= 0) { G.audio.reload(); startReload(G); return; }
  p.fireTimer = 0.16;
  p.ammoMag -= 1;
  const aim = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);
  p.angle = aim;
  const spread = (Math.random() - 0.5) * 0.05;
  G.combat.bullets.push({ x: p.x + Math.cos(aim) * 20, y: p.y + Math.sin(aim) * 20, vx: Math.cos(aim + spread) * 950, vy: Math.sin(aim + spread) * 950, life: 0.7 });
  G.combat.flashes.push({ x: p.x + Math.cos(aim) * 24, y: p.y + Math.sin(aim) * 24, life: 0.05 });
  G.audio.shot();
  G.shake(0.06);
  G.addCrime('shooting', p.x, p.y);
  scarePeds(G, p.x, p.y, 330);
}

export function tryPunch(G) {
  const p = G.player;
  if (p.car || p.punchTimer > 0) return;
  p.punchTimer = 0.32;
  G.audio.punch();
  const hx = p.x + Math.cos(p.angle) * 30, hy = p.y + Math.sin(p.angle) * 30;
  for (const ped of G.peds) {
    if (ped.alive && ped.state !== 'down' && Math.hypot(ped.x - hx, ped.y - hy) < 30) {
      knockDownPed(G, ped, true);
      G.showMessage('Assault! Witnesses are calling it in.');
      return;
    }
  }
  for (const car of G.allCars()) {
    if (Math.hypot(car.x - hx, car.y - hy) < 40) {
      car.health -= 4;
      spawnParticles(G, hx, hy, 5, '#ffd76a', 70);
      if (car.driver === 'ai') { car.waitTimer = 1; G.addCrime('hitCar', car.x, car.y); }
    }
  }
}

export function startReload(G) {
  const p = G.player;
  if (p.reloading > 0 || p.ammoMag >= MAG_SIZE || p.ammoReserve <= 0) return;
  p.reloading = 1.1;
  G.audio.reload();
}

export function updateCombat(G, dt) {
  const p = G.player;
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const take = Math.min(MAG_SIZE - p.ammoMag, p.ammoReserve);
      p.ammoMag += take; p.ammoReserve -= take;
    }
  }
  // Bullets
  for (let i = G.combat.bullets.length - 1; i >= 0; i--) {
    const b = G.combat.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || G.world.hitsBuilding(b.x, b.y, 2);
    if (!dead) {
      for (const ped of G.peds) {
        if (ped.alive && ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
          knockDownPed(G, ped, true);
          spawnParticles(G, ped.x, ped.y, 10, '#e74c3c', 110);
          dead = true; break;
        }
      }
    }
    if (!dead) {
      for (const car of G.allCars()) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.health -= 9;
          spawnParticles(G, b.x, b.y, 6, '#ffd76a', 90);
          if (car.kind === 'police') G.addCrime('hitCop', car.x, car.y);
          else if (car.driver === 'ai') { car.waitTimer = 0.6; G.addCrime('hitCar', car.x, car.y); }
          dead = true; break;
        }
      }
    }
    if (dead) G.combat.bullets.splice(i, 1);
  }
  // Particles and flashes
  for (let i = G.combat.particles.length - 1; i >= 0; i--) {
    const pt = G.combat.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.92; pt.vy *= 0.92; pt.life -= dt;
    if (pt.life <= 0) G.combat.particles.splice(i, 1);
  }
  for (let i = G.combat.flashes.length - 1; i >= 0; i--) {
    G.combat.flashes[i].life -= dt;
    if (G.combat.flashes[i].life <= 0) G.combat.flashes.splice(i, 1);
  }
  // Getting run over or shot at drains health near chaos; cars hitting player on foot:
  if (!p.car) {
    for (const car of G.allCars()) {
      if (car.driver !== 'player' && Math.abs(car.speed) > 90 && Math.hypot(car.x - p.x, car.y - p.y) < 27) {
        p.health -= 22 * dt * 4;
        G.shake(0.3);
        spawnParticles(G, p.x, p.y, 6, '#e74c3c', 90);
      }
    }
  }
}
