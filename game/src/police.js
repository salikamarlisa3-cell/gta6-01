// Police and the wanted system for AZURA HEAT: crimes raise heat, stars 0-5 follow,
// cruisers spawn in proportion, chase and ram, and bust the player when they pin them.
import { clamp } from './config.js';
import { makeCar, stepCarPhysics, tryMoveCar } from './vehicles.js';

export const CRIME_HEAT = { theftSeen: 1.2, assault: 1.0, shooting: 0.9, hitCar: 0.55, hitPed: 1.6, hitCop: 2.2, speeding: 0.15 };

export function wantedStars(G) { return clamp(Math.floor(G.heat), 0, 5); }

export function addCrime(G, kind, x, y) {
  const gain = CRIME_HEAT[kind] || 0.5;
  // Crimes only count fully when a witness (ped, driver or cop) is nearby.
  let witnessed = G.police.length > 0;
  if (!witnessed) for (const p of G.peds) { if (p.alive && Math.hypot(p.x - x, p.y - y) < 260) { witnessed = true; break; } }
  if (!witnessed) for (const c of G.traffic) { if (Math.hypot(c.x - x, c.y - y) < 260) { witnessed = true; break; } }
  G.heat = clamp(G.heat + (witnessed ? gain : gain * 0.35), 0, 5.99);
  if (witnessed) { G.lastCrimePos = { x, y }; G.seenTimer = 4; }
}

export function updateWanted(G, dt) {
  // Being seen refreshes the hunt; hiding lets heat decay.
  let seen = false;
  for (const cop of G.police) { if (Math.hypot(cop.x - G.player.x, cop.y - G.player.y) < 460) { seen = true; break; } }
  if (seen) G.seenTimer = Math.max(G.seenTimer, 1.2);
  else G.seenTimer -= dt;
  if (G.seenTimer <= 0 && G.heat > 0) G.heat = Math.max(0, G.heat - dt * 0.09);
  G.stars = wantedStars(G);

  // Spawn cruisers proportional to stars, near but off-screen.
  const want = G.stars === 0 ? 0 : 1 + G.stars;
  G.spawnTimer -= dt;
  if (G.police.length < want && G.spawnTimer <= 0) {
    G.spawnTimer = 2.5;
    const a = Math.random() * Math.PI * 2, d = 620;
    const x = clamp(G.player.x + Math.cos(a) * d, 80, G.world.width - 80);
    const y = clamp(G.player.y + Math.sin(a) * d, 80, G.world.height - 80);
    const cop = makeCar(x, y, a + Math.PI, 'police', G.rand);
    cop.driver = 'cop';
    G.police.push(cop);
    G.copFootTimer = 0;
  }
  // Far-away cruisers despawn when heat is low.
  if (G.stars === 0) {
    G.police = G.police.filter((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 900);
  }
  G.audio.setSiren(G.police.length > 0 && G.stars > 0);
}

export function updateCop(G, cop, dt) {
  const p = G.player;
  const dx = p.x - cop.x, dy = p.y - cop.y;
  const dist = Math.hypot(dx, dy);
  const targetAngle = Math.atan2(dy, dx);
  let da = targetAngle - cop.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const steer = clamp(da * 1.6, -1, 1);
  let throttle = 1;
  if (Math.abs(da) > 2.4) throttle = -0.7; // reverse to re-align
  if (dist < 60 && !p.car) throttle = 0.15; // creep up to a suspect on foot
  const vel = stepCarPhysics(cop, { throttle, steer, handbrake: Math.abs(da) > 1.2 && cop.speed > 200 }, dt);
  const hit = tryMoveCar(G.world, cop, vel.vx, vel.vy, dt);
  if (hit) { cop.speed *= -0.25; if (Math.abs(vel.vx) + Math.abs(vel.vy) > 120) G.onCarCrash(cop, 120); }

  // Bust logic: pin the player's car at low speed, or touch the player on foot.
  if (p.car) {
    if (dist < 70 && Math.abs(p.car.speed) < 26) {
      G.bustMeter += dt;
      if (G.bustMeter > 1.6) G.onBusted();
    } else G.bustMeter = Math.max(0, G.bustMeter - dt * 1.4);
  } else if (dist < 34 && G.stars > 0) {
    G.bustMeter += dt * 1.3;
    if (G.bustMeter > 1.2) G.onBusted();
  }
}
