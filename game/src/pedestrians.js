// Pedestrians for AZURA HEAT: citizens stroll the sidewalks, chat in pairs, flee from
// gunfire, crashes and reckless cars, panic-scream, and can be knocked down.
import { ROAD_XS, ROAD_YS, ROAD_HALF, PED_COLORS, clamp } from './config.js';

export function spawnPeds(rand, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const vertical = rand() < 0.5;
    let x, y, tx, ty;
    if (vertical) {
      const rx = ROAD_XS[Math.floor(rand() * ROAD_XS.length)];
      x = rx + (rand() < 0.5 ? -1 : 1) * (ROAD_HALF + 12);
      y = 150 + rand() * 2400;
      tx = x; ty = 150 + rand() * 2400;
    } else {
      const ry = ROAD_YS[Math.floor(rand() * ROAD_YS.length)];
      y = ry + (rand() < 0.5 ? -1 : 1) * (ROAD_HALF + 12);
      x = 150 + rand() * 3300;
      tx = 150 + rand() * 3300; ty = y;
    }
    peds.push({
      x, y, tx, ty, angle: rand() * 6.28, speed: 0,
      color: PED_COLORS[Math.floor(rand() * PED_COLORS.length)],
      state: 'walk', // walk | flee | down
      panic: 0, downTimer: 0, phase: rand() * 6.28, alive: true,
    });
  }
  return peds;
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (!p.alive || p.state === 'down') continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) { p.state = 'flee'; p.panic = 2.5 + Math.random() * 2; }
  }
}

export function knockDownPed(G, ped, crime) {
  if (ped.state === 'down') return;
  ped.state = 'down'; ped.downTimer = 6; ped.speed = 0;
  G.spawnParticles(ped.x, ped.y, 8, '#e74c3c', 90);
  if (crime) G.addCrime('assault', ped.x, ped.y);
}

export function updatePed(G, ped, dt) {
  ped.phase += dt * 8;
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) { ped.state = 'flee'; ped.panic = 3; }
    return;
  }
  let speed = 62;
  if (ped.state === 'flee') {
    ped.panic -= dt;
    speed = 175;
    // Run directly away from the player.
    const away = Math.atan2(ped.y - G.player.y, ped.x - G.player.x);
    ped.tx = ped.x + Math.cos(away) * 220;
    ped.ty = ped.y + Math.sin(away) * 220;
    if (ped.panic <= 0) ped.state = 'walk';
  }
  const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 14) {
    if (ped.state === 'walk') {
      // Pick a new stroll target along a sidewalk.
      if (Math.random() < 0.5) {
        const rx = ROAD_XS[Math.floor(Math.random() * ROAD_XS.length)];
        ped.tx = rx + (Math.random() < 0.5 ? -1 : 1) * (ROAD_HALF + 12);
        ped.ty = clamp(ped.y + (Math.random() - 0.5) * 700, 60, G.world.height - 60);
      } else {
        const ry = ROAD_YS[Math.floor(Math.random() * ROAD_YS.length)];
        ped.ty = ry + (Math.random() < 0.5 ? -1 : 1) * (ROAD_HALF + 12);
        ped.tx = clamp(ped.x + (Math.random() - 0.5) * 700, 60, G.world.width - 60);
      }
    }
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.speed = speed;
  const step = Math.min(d, speed * dt);
  G.world.moveCircle(ped, Math.cos(ped.angle) * step, Math.sin(ped.angle) * step, 9);
  // Cars running over a walking ped knock them down.
  for (const car of G.allCars()) {
    if (Math.abs(car.speed) > 55 && Math.hypot(car.x - ped.x, car.y - ped.y) < 26) {
      knockDownPed(G, ped, car.driver === 'player');
      if (car.driver === 'player') G.shake(0.25);
      break;
    }
  }
}
