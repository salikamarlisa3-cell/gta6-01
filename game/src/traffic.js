// Traffic AI for AZURA HEAT: civilian cars follow the road grid in right-hand lanes,
// stop for obstacles ahead, wait after collisions, and flee or brake near danger.
import { ROAD_XS, ROAD_YS, ROAD_HALF, clamp } from './config.js';
import { makeCar, stepCarPhysics, tryMoveCar } from './vehicles.js';

const LANE = 30;

export function spawnTraffic(rand, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rand() < 0.5;
    const rx = ROAD_XS[Math.floor(rand() * ROAD_XS.length)];
    const ry = ROAD_YS[Math.floor(rand() * ROAD_YS.length)];
    let car;
    if (vertical) {
      const south = rand() < 0.5;
      car = makeCar(rx + (south ? LANE : -LANE), 200 + rand() * 2300, south ? Math.PI / 2 : -Math.PI / 2, 'traffic', rand);
      car.dirY = south ? 1 : -1;
    } else {
      const east = rand() < 0.5;
      car = makeCar(200 + rand() * 3200, ry + (east ? LANE : -LANE), east ? 0 : Math.PI, 'traffic', rand);
      car.dirX = east ? 1 : -1;
    }
    car.driver = 'ai';
    car.speed = 120 + rand() * 80;
    cars.push(car);
  }
  return cars;
}

function pickNextLeg(car, rand) {
  // At an intersection: mostly go straight, sometimes turn onto the crossing road.
  const atX = ROAD_XS.some((rx) => Math.abs(car.x - rx) < 60);
  const atY = ROAD_YS.some((ry) => Math.abs(car.y - ry) < 60);
  if (atX && atY && rand() < 0.45) {
    if (car.dirX !== 0) { // turn onto vertical road
      const rx = ROAD_XS.reduce((b, v) => (Math.abs(v - car.x) < Math.abs(b - car.x) ? v : b), ROAD_XS[0]);
      car.dirX = 0; car.dirY = rand() < 0.5 ? 1 : -1;
      car.x = rx + (car.dirY > 0 ? LANE : -LANE);
      car.angle = car.dirY > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = ROAD_YS.reduce((b, v) => (Math.abs(v - car.y) < Math.abs(b - car.y) ? v : b), ROAD_YS[0]);
      car.dirY = 0; car.dirX = rand() < 0.5 ? 1 : -1;
      car.y = ry + (car.dirX > 0 ? LANE : -LANE);
      car.angle = car.dirX > 0 ? 0 : Math.PI;
    }
  }
}

export function updateTrafficCar(G, car, dt) {
  if (car.driver !== 'ai') return;
  const world = G.world;
  if (car.waitTimer > 0) { car.waitTimer -= dt; car.speed = Math.max(0, car.speed - 300 * dt); return; }

  // Desired heading from travel direction; snap position gently toward lane centre.
  let targetAngle = car.angle;
  if (car.dirX > 0) targetAngle = 0; else if (car.dirX < 0) targetAngle = Math.PI;
  else if (car.dirY > 0) targetAngle = Math.PI / 2; else targetAngle = -Math.PI / 2;
  let da = targetAngle - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  car.angle += clamp(da, -2.2 * dt, 2.2 * dt);

  // Obstacle scan ahead: other cars, the player, crossing peds.
  let blocked = false;
  const fx = car.x + Math.cos(car.angle) * 62, fy = car.y + Math.sin(car.angle) * 62;
  for (const o of G.allCars()) {
    if (o !== car && Math.hypot(o.x - fx, o.y - fy) < 34) { blocked = true; break; }
  }
  if (!blocked && !G.player.car && Math.hypot(G.player.x - fx, G.player.y - fy) < 30) blocked = true;
  if (!blocked) for (const p of G.peds) { if (p.alive && Math.hypot(p.x - fx, p.y - fy) < 26) { blocked = true; break; } }

  const cruise = 165;
  const throttle = blocked ? (car.speed > 10 ? -1 : 0) : (car.speed < cruise ? 0.7 : 0);
  const vel = stepCarPhysics(car, { throttle, steer: 0, handbrake: false }, dt);
  const hit = tryMoveCar(world, car, vel.vx, vel.vy, dt);
  if (hit && Math.abs(car.speed) > 60) { car.waitTimer = 0.8; G.onCarCrash(car, Math.abs(car.speed)); car.speed = 0; }

  // Keep to the grid: if we drifted off both road axes, steer back to nearest road.
  pickNextLeg(car, G.rand);
  // Wrap travel at world edges by reversing direction.
  if (car.x < 90) { car.dirX = 1; car.dirY = 0; }
  if (car.x > G.world.width - 90) { car.dirX = -1; car.dirY = 0; }
  if (car.y < 90) { car.dirY = 1; car.dirX = 0; }
  if (car.y > G.world.height - 90) { car.dirY = -1; car.dirX = 0; }
  void ROAD_HALF;
}
