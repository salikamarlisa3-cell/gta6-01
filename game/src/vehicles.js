// Vehicles for AZURA HEAT: car factory (civilian, parked, taxi, police), arcade driving
// physics with handbrake, car-to-car collision response and damage smoke.
import { CAR_COLORS, clamp } from './config.js';

export const CAR_LEN = 46;
export const CAR_WID = 24;
let nextCarId = 1;

export function makeCar(x, y, angle, kind, rand) {
  return {
    id: nextCarId++,
    x, y, angle, speed: 0, steer: 0,
    len: CAR_LEN, wid: CAR_WID,
    color: kind === 'police' ? '#dfe6ee' : kind === 'taxi' ? '#f5c518' : CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)],
    kind, // 'parked' | 'traffic' | 'police' | 'taxi' | 'mission'
    health: 100,
    driver: null, // 'player' | 'ai' | 'cop' | null
    // traffic AI state
    dirX: 0, dirY: 0, targetX: x, targetY: y, waitTimer: 0, honked: false,
    sirenPhase: Math.random() * 6,
    name: pickCarName(rand),
  };
}

const CAR_NAMES = ['Vireo Coupe', 'Sable Sedan', 'Kestrel Hatch', 'Marlin Pickup', 'Ondine Cabrio', 'Bronto Van', 'Lumen GT', 'Tern Wagon'];
export function pickCarName(rand) { return CAR_NAMES[Math.floor(rand() * CAR_NAMES.length)]; }

export function spawnParkedCars(world, rand, count) {
  const cars = [];
  const spots = [...world.parkSpots];
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  for (let i = 0; i < Math.min(count, spots.length); i++) {
    const s = spots[i];
    cars.push(makeCar(s.x, s.y, s.angle, rand() < 0.12 ? 'taxi' : 'parked', rand));
  }
  return cars;
}

// Arcade car physics: throttle, brake/reverse, speed-sensitive steering, handbrake drift.
export function stepCarPhysics(car, input, dt) {
  const maxF = car.kind === 'police' ? 430 : 360;
  const maxR = 130;
  if (input.throttle > 0) car.speed += 260 * dt * input.throttle;
  else if (input.throttle < 0) {
    if (car.speed > 12) car.speed -= 420 * dt;
    else car.speed -= 160 * dt;
  } else {
    car.speed -= car.speed * 0.7 * dt;
    if (Math.abs(car.speed) < 3) car.speed = 0;
  }
  if (input.handbrake) car.speed -= car.speed * 1.6 * dt;
  car.speed = clamp(car.speed, -maxR, maxF);
  const steerTarget = input.steer * 0.55;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = input.handbrake ? 1.5 : 1.0;
  if (Math.abs(car.speed) > 1) {
    const turnRate = car.steer * (car.speed / 90) * grip;
    car.angle += clamp(turnRate, -2.4, 2.4) * dt * (car.speed < 0 ? -1 : 1);
  }
  return { vx: Math.cos(car.angle) * car.speed, vy: Math.sin(car.angle) * car.speed };
}

export function tryMoveCar(world, car, vx, vy, dt) {
  const nx = car.x + vx * dt, ny = car.y + vy * dt;
  if (!world.carBlocked(nx, ny, car.angle, car.len, car.wid)) { car.x = nx; car.y = ny; return false; }
  if (!world.carBlocked(nx, car.y, car.angle, car.len, car.wid)) { car.x = nx; return Math.abs(vy) > 40; }
  if (!world.carBlocked(car.x, ny, car.angle, car.len, car.wid)) { car.y = ny; return Math.abs(vx) > 40; }
  return true; // fully blocked: a hit
}

// Circle collision between two cars: push apart and trade speed, returns impact strength.
export function collideCars(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy), min = 40;
  if (d === 0 || d >= min) return 0;
  const nx = dx / d, ny = dy / d, overlap = (min - d) / 2;
  a.x -= nx * overlap; a.y -= ny * overlap;
  b.x += nx * overlap; b.y += ny * overlap;
  const impact = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.6; b.speed = avg * 0.6;
  a.health -= impact * 0.04; b.health -= impact * 0.04;
  return impact;
}

export function carSpeedRatio(car) { return clamp(car.speed / 380, -1, 1); }
