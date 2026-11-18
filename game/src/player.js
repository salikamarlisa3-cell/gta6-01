// The player, Vera Solano, for AZURA HEAT: on-foot walking and running with collision,
// entering and stealing cars, driving the car she is in, health and respawn state.
import { PLAYER_SPEED_WALK, PLAYER_SPEED_RUN, PLAYER_RADIUS, PLAYER_START, MAG_SIZE } from './config.js';
import { stepCarPhysics, tryMoveCar } from './vehicles.js';

export function createPlayer(saved) {
  return {
    x: saved?.x ?? PLAYER_START.x, y: saved?.y ?? PLAYER_START.y,
    angle: -Math.PI / 2, speed: 0, radius: PLAYER_RADIUS,
    health: saved?.health ?? 100, maxHealth: 100,
    car: null, walkPhase: 0, punchTimer: 0, fireTimer: 0,
    ammoMag: MAG_SIZE, ammoReserve: saved?.ammoReserve ?? 60, reloading: 0,
    dead: false,
  };
}

export function nearestEnterableCar(G, range) {
  let best = null, bestD = range;
  for (const car of G.allCars()) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  const wasParked = car.driver === null;
  const wasTraffic = car.driver === 'ai';
  if (car.driver === 'ai') G.audio.horn();
  car.driver = 'player';
  car.waitTimer = 0;
  p.car = car;
  p.x = car.x; p.y = car.y;
  G.audio.door();
  if (wasParked || wasTraffic) {
    G.addCrime('theftSeen', car.x, car.y);
    G.showMessage(wasTraffic ? 'Carjacked! The driver ran off.' : 'Vehicle stolen: ' + car.name);
    if (wasTraffic) G.scarePeds(car.x, car.y, 200);
  }
  G.missionsApi.onCarEntered(G, car);
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = car.kind === 'police' ? 'cop' : null;
  if (car.kind === 'traffic' || car.kind === 'taxi') car.driver = null; // abandoned
  p.car = null;
  // Step out to the left side of the car.
  p.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
  if (G.world.hitsBuilding(p.x, p.y, p.radius)) { p.x = car.x; p.y = car.y; }
  G.audio.door();
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player, input = G.input;
  const axis = input.moveAxis();
  const running = input.anyDown('ShiftLeft', 'ShiftRight');
  const len = Math.hypot(axis.x, axis.y);
  if (len > 0) {
    const sp = running ? PLAYER_SPEED_RUN : PLAYER_SPEED_WALK;
    const nx = (axis.x / len) * sp * dt, ny = (axis.y / len) * sp * dt;
    G.world.moveCircle(p, nx, ny, p.radius);
    p.angle = Math.atan2(axis.y, axis.x);
    p.speed = sp;
    p.walkPhase += dt * (running ? 13 : 9);
  } else p.speed = 0;
  // Bump into parked cars is handled by car proximity; walking into traffic hurts.
  if (p.punchTimer > 0) p.punchTimer -= dt;
}

export function updatePlayerDriving(G, dt) {
  const p = G.player, input = G.input, car = p.car;
  const throttle = (input.anyDown('KeyW', 'ArrowUp') ? 1 : 0) + (input.anyDown('KeyS', 'ArrowDown') ? -1 : 0);
  const steer = (input.anyDown('KeyA', 'ArrowLeft') ? -1 : 0) + (input.anyDown('KeyD', 'ArrowRight') ? 1 : 0);
  const handbrake = input.isDown('Space');
  const vel = stepCarPhysics(car, { throttle, steer: steer * (car.speed < 0 ? -1 : 1), handbrake }, dt);
  const hit = tryMoveCar(G.world, car, vel.vx, vel.vy, dt);
  if (hit) {
    const impact = Math.abs(car.speed);
    if (impact > 90) {
      G.onCarCrash(car, impact);
      p.health -= impact * 0.02;
      G.shake(Math.min(0.5, impact / 500));
    }
    car.speed *= -0.3;
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  G.audio.setEngine(car.speed / 380, true);
  if (handbrake && Math.abs(car.speed) > 120 && Math.random() < 0.5) {
    G.spawnParticles(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1, '#cccccc', 30);
  }
}
