// AZURA HEAT — boot and main loop. Neon coastal open-world crime game: Vera Solano works
// jobs for fixer Marco Reyes across Azura Bay. Owns the shared game state G that every
// system module reads, the camera, screens (title / pause / busted / wasted), crime and
// crash hooks, saving, and the fixed-step loop.
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, hasSave } from './save.js';
import { spawnParkedCars, collideCars } from './vehicles.js';
import { spawnTraffic, updateTrafficCar } from './traffic.js';
import { spawnPeds, updatePed, scarePeds } from './pedestrians.js';
import { createPlayer, nearestEnterableCar, enterCar, exitCar, updatePlayerOnFoot, updatePlayerDriving } from './player.js';
import { addCrime, updateWanted, updateCop } from './police.js';
import { createCombatState, spawnParticles, tryShoot, tryPunch, startReload, updateCombat } from './combat.js';
import * as missionsApi from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD } from './hud.js';
import { stageScene } from './shots.js';
import { HOSPITAL, POLICE_STATION, districtAt, clamp } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;
const rand = createRandom(seed * 1000 + 42);
const saved = loadSave();

const G = {
  rand,
  world: createWorld(rand),
  audio: createAudio(),
  input: createInput(canvas),
  player: null,
  parked: [], traffic: [], police: [], peds: [],
  combat: createCombatState(),
  missions: missionsApi.createMissionState(saved?.missionIndex || 0),
  missionsApi,
  money: saved?.money ?? 120,
  heat: 0, stars: 0, seenTimer: 0, lastCrimePos: null, spawnTimer: 0, copFootTimer: 0, bustMeter: 0,
  timeOfDay: 0.38, time: 0,
  screen: 'title', started: false, paused: false,
  camX: 0, camY: 0, shakeAmt: 0,
  message: '', messageTimer: 0,
  districtFlash: 0, lastDistrict: '',
  mouseWorld: { x: 0, y: 0 },
  taxiFares: saved?.taxiFares || 0, racesWon: saved?.racesWon || 0,
  contextPrompt: '',
  saveGame() { writeSave({ money: G.money, missionIndex: G.missions.index, player: G.player, ammoReserve: G.player.ammoReserve, taxiFares: G.taxiFares, racesWon: G.racesWon }); },
  showMessage(text) { G.message = text; G.messageTimer = 3.4; },
  shake(amount) { G.shakeAmt = Math.min(0.6, Math.max(G.shakeAmt, amount)); },
  spawnParticles(x, y, n, color, spread) { spawnParticles(G, x, y, n, color, spread); },
  scarePeds(x, y, r) { scarePeds(G, x, y, r); },
  addCrime(kind, x, y) { addCrime(G, kind, x, y); },
  allCars() { return [...G.parked, ...G.traffic, ...G.police, ...(G.missions.targetCar && !G.parked.includes(G.missions.targetCar) ? [G.missions.targetCar] : [])]; },
  enterCarSilent(car) { car.driver = 'player'; G.player.car = car; G.player.x = car.x; G.player.y = car.y; },
  startMission() { missionsApi.startMission(G); },
  onCarCrash(car, impact) {
    G.audio.crash();
    spawnParticles(G, car.x, car.y, Math.min(16, 4 + impact / 18), '#ffb703', 130);
    spawnParticles(G, car.x, car.y, 5, '#9aa5b1', 60);
    if (car.driver === 'player') {
      G.shake(Math.min(0.45, impact / 420));
      if (impact > 130) addCrime(G, 'hitCar', car.x, car.y);
    }
  },
  onBusted() { endRun('busted'); },
  stepWorld(dt, warm) { stepWorld(dt, warm); },
};

G.player = createPlayer(saved);
G.parked = spawnParkedCars(G.world, rand, 34);
G.traffic = spawnTraffic(rand, 15);
G.peds = spawnPeds(rand, 42);
G.camX = G.player.x - window.innerWidth / 2;
G.camY = G.player.y - window.innerHeight / 2;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function endRun(kind) {
  if (G.screen !== 'play') return;
  G.screen = kind;
  G.audio.setEngine(0, false);
  G.audio.setSiren(false);
  if (kind === 'wasted') G.audio.fail();
  const penalty = Math.min(G.money, kind === 'busted' ? 200 : 150);
  G.money -= penalty;
  G.endPenalty = penalty;
}

function respawn() {
  const p = G.player;
  if (p.car) { p.car.driver = null; p.car = null; }
  const spot = G.screen === 'busted' ? POLICE_STATION : HOSPITAL;
  p.x = spot.x + 40; p.y = spot.y + 90;
  p.health = 100; p.ammoMag = 12;
  G.heat = 0; G.stars = 0; G.police = []; G.bustMeter = 0;
  G.screen = 'play';
  G.showMessage(G.screen === 'busted' ? '' : 'Back on the street. Watch yourself, Vera.');
  G.saveGame();
}

function startGame(useSave) {
  G.started = true;
  G.screen = 'play';
  if (!useSave) {
    G.money = 120; G.missions.index = 0;
    G.player.x = 1560; G.player.y = 1620; G.player.health = 100;
  }
  G.audio.unlock();
  G.showMessage('Welcome to Azura Bay. Gold marker: your first job.');
}

function stepWorld(dt, warm) {
  const p = G.player;
  G.time += dt;
  G.timeOfDay = (G.timeOfDay + dt / 260) % 1;
  if (G.messageTimer > 0) G.messageTimer -= dt;
  if (G.districtFlash > 0) G.districtFlash -= dt * 0.5;

  if (!warm) {
    if (p.car) updatePlayerDriving(G, dt); else updatePlayerOnFoot(G, dt);
    if (G.demoCruise && p.car && p.car.speed < 175) p.car.speed = 175; // screenshot scenes keep rolling
    // Enter / exit cars
    if (G.input.wasPressed('KeyE')) {
      if (p.car) exitCar(G);
      else { const car = nearestEnterableCar(G, 52); if (car) enterCar(G, car); }
    }
    if (!p.car) {
      if (G.input.mouse.down) tryShoot(G);
      if (G.input.wasPressed('KeyF')) tryPunch(G);
      if (G.input.wasPressed('KeyR')) startReload(G);
    }
    if (G.input.wasPressed('KeyT')) missionsApi.startSideActivity(G);
    // Auto-start story mission at Marco's gold marker
    const mk = missionsApi.objectiveMarker(G);
    if (!G.missions.active && missionsApi.currentMission(G) && mk && Math.hypot(p.x - 920, p.y - 420) < 70) missionsApi.startMission(G);
  }

  for (const car of G.traffic) updateTrafficCar(G, car, dt);
  for (const ped of G.peds) updatePed(G, ped, dt);
  updateWanted(G, dt);
  for (const cop of [...G.police]) updateCop(G, cop, dt);
  updateCombat(G, dt);
  missionsApi.updateMissions(G, dt);

  // Car-to-car collisions across the whole fleet
  const cars = G.allCars();
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const impact = collideCars(cars[i], cars[j]);
      if (impact > 55) {
        const a = cars[i], b = cars[j];
        if (a.driver === 'player' || b.driver === 'player') {
          G.onCarCrash(a.driver === 'player' ? a : b, impact);
          const other = a.driver === 'player' ? b : a;
          if (other.kind === 'police') addCrime(G, 'hitCop', other.x, other.y);
          else if (impact > 120) addCrime(G, 'hitCar', other.x, other.y);
          scarePeds(G, other.x, other.y, 170);
        } else if (impact > 120 && Math.random() < 0.3) {
          G.audio.crash();
          spawnParticles(G, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffb703', 100);
        }
        if (a.driver === 'ai') a.waitTimer = Math.max(a.waitTimer, 0.7);
        if (b.driver === 'ai') b.waitTimer = Math.max(b.waitTimer, 0.7);
      }
    }
  }
  // Remove burnt-out wrecks from traffic flow by resetting them as parked elsewhere
  for (const car of cars) if (car.health < -60) { car.health = 100; car.speed = 0; }

  // District flash on change
  const d = districtAt(p.x, p.y).name;
  if (d !== G.lastDistrict) {
    if (G.lastDistrict) G.districtFlash = 2.2;
    G.lastDistrict = d;
  }
  // Health / wasted check
  if (p.health <= 0 && G.screen === 'play') endRun('wasted');
  if (!p.car) G.audio.setEngine(0, false);

  // Context prompt
  if (!p.car) {
    const car = nearestEnterableCar(G, 52);
    G.contextPrompt = car ? 'E — Enter ' + car.name + (car.driver === 'ai' ? ' (carjack!)' : '') : (missionsApi.currentMission(G) && !G.missions.active ? '' : '');
  } else G.contextPrompt = 'E — Exit vehicle · SPACE — Handbrake';
}

function handleMenuKeys() {
  const input = G.input;
  if (G.screen === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed('Space')) startGame(false);
    if (input.wasPressed('KeyC') && hasSave()) startGame(true);
  } else if (G.screen === 'busted' || G.screen === 'wasted') {
    if (input.wasPressed('Enter') || input.wasPressed('Space')) respawn();
  } else if (G.screen === 'play') {
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) G.screen = 'paused';
  } else if (G.screen === 'paused') {
    if (input.wasPressed('Escape') || input.wasPressed('KeyP') || input.wasPressed('Enter')) G.screen = 'play';
    if (input.wasPressed('KeyS')) { G.saveGame(); G.showMessage('Saved.'); }
  }
  if (input.wasPressed('KeyM')) {
    const m = G.audio.toggleMute();
    G.showMessage(m ? 'Sound muted (M)' : 'Sound on (M)');
  }
}

function drawOverlay() {
  const W = canvas.width, H = canvas.height;
  ctx.save();
  ctx.textAlign = 'center';
  if (G.screen === 'title') {
    ctx.fillStyle = 'rgba(5,8,20,0.62)'; ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillStyle = '#ff2e88'; ctx.fillText('AZURA', W / 2, H / 2 - 150);
    ctx.fillStyle = '#ffd94d'; ctx.fillText('HEAT', W / 2, H / 2 - 70);
    ctx.font = '19px system-ui, sans-serif'; ctx.fillStyle = '#eaf6ff';
    ctx.fillText('Vera Solano just hit Azura Bay with nothing but a name and a debt.', W / 2, H / 2 - 20);
    ctx.fillText('Fixer Marco Reyes has work. The ABPD has other ideas. Steal, drive, deliver, survive.', W / 2, H / 2 + 10);
    ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = '#bfe9ff';
    ctx.fillText('WASD move · SHIFT run · E enter/exit car · Mouse aim · CLICK shoot · F punch · R reload', W / 2, H / 2 + 62);
    ctx.fillText('SPACE handbrake · T taxi/sprint job · P pause · M mute', W / 2, H / 2 + 86);
    ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillStyle = '#ffd94d';
    ctx.fillText('ENTER — New Game' + (hasSave() ? '      C — Continue' : ''), W / 2, H / 2 + 140);
  } else if (G.screen === 'paused') {
    ctx.fillStyle = 'rgba(5,8,20,0.66)'; ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 52px system-ui, sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('PAUSED', W / 2, H / 2 - 60);
    ctx.font = '19px system-ui, sans-serif'; ctx.fillStyle = '#eaf6ff';
    ctx.fillText('Money $' + G.money + ' · Mission ' + Math.min(G.missions.index + 1, 5) + ' of 5 · Taxi fares ' + G.taxiFares + ' · Sprints ' + G.racesWon, W / 2, H / 2);
    ctx.fillText('S — Save game · P / ESC — Resume', W / 2, H / 2 + 36);
  } else if (G.screen === 'busted' || G.screen === 'wasted') {
    ctx.fillStyle = G.screen === 'busted' ? 'rgba(10,20,60,0.6)' : 'rgba(60,5,10,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 76px system-ui, sans-serif';
    ctx.fillStyle = G.screen === 'busted' ? '#7db4ff' : '#ff4757';
    ctx.fillText(G.screen === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 40);
    ctx.font = '20px system-ui, sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(G.screen === 'busted' ? 'The ABPD got you. Released from Azura Bay Police HQ.' : 'You wake up at Azura General Hospital.', W / 2, H / 2 + 16);
    ctx.fillText('Penalty: $' + (G.endPenalty || 0) + ' · Press ENTER to continue', W / 2, H / 2 + 48);
  }
  ctx.restore();
}

let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  const W = canvas.width, H = canvas.height;
  accumulator += Math.min((now - last) / 1000, 0.25);
  last = now;
  handleMenuKeys();
  if (G.screen === 'play') {
    while (accumulator >= STEP) { stepWorld(STEP, false); accumulator -= STEP; }
  } else accumulator = 0;

  // Mouse in world space + smooth chase camera
  const targetX = clamp(G.player.x - W / 2, 0, Math.max(0, G.world.width - W));
  const targetY = clamp(G.player.y - H / 2, 0, Math.max(0, G.world.height - H));
  G.camX += (targetX - G.camX) * 0.09;
  G.camY += (targetY - G.camY) * 0.09;
  G.mouseWorld.x = G.input.mouse.x + G.camX;
  G.mouseWorld.y = G.input.mouse.y + G.camY;
  const shX = (Math.random() - 0.5) * G.shakeAmt * 26;
  const shY = (Math.random() - 0.5) * G.shakeAmt * 26;
  G.shakeAmt *= 0.88;

  drawWorld(ctx, G, Math.round(G.camX + shX), Math.round(G.camY + shY), W, H);
  if (G.screen !== 'title') drawHUD(ctx, G, W, H);
  else drawWorldTitleExtras();
  drawOverlay();
  G.input.endFrame();
  if (G.screen === 'play' && Math.random() < 0.002) G.saveGame();
}

function drawWorldTitleExtras() {
  // Title screen still shows the HUD-less city alive behind the panel; nothing extra needed.
}

// Demo / screenshot scenes: ?scene=cover|drive|chase|mission runs the real game staged.
const scene = params.get('scene');
if (scene) {
  G.started = true;
  G.screen = 'play';
  if (scene === 'drive' || scene === 'chase') G.demoCruise = true;
  stageScene(G, scene);
  let ticks = 0;
  const warmTimer = setInterval(() => {
    ticks += 1;
    if (ticks > 2) { clearInterval(warmTimer); window.__shotReady = true; }
  }, 400);
}

window.__azura = G;
requestAnimationFrame(frame);
