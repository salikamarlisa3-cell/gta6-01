// Scripted demo scenes for AZURA HEAT screenshots and smoke tests, behind ?scene=name.
// Each scene places the REAL game state into a lively moment (no fake rendering): cover is
// Vera on foot downtown with a mission marker, drive is traffic on the Neon Mile, chase is a
// police pursuit with stars up, mission is a shootout moment during Hot Property.
import { PLAYER_START } from './config.js';
import { makeCar } from './vehicles.js';

export function stageScene(G, name) {
  const p = G.player;
  G.screen = 'play';
  G.started = true;
  if (name === 'drive') {
    const car = G.traffic[0] || G.parked[0];
    if (car) { G.missions.index = 1; G.enterCarSilent(car); car.x = 1560; car.y = 930; car.angle = 0; car.speed = 210; p.x = car.x; p.y = car.y; }
    G.showMessage('Neon Mile traffic — mind the crosswalks!');
  } else if (name === 'chase') {
    const car = G.traffic[1] || G.parked[1];
    if (car) { G.enterCarSilent(car); car.x = 2160; car.y = 930; car.angle = 0; car.speed = 260; p.x = car.x; p.y = car.y; }
    G.heat = 3.4; G.stars = 3; G.seenTimer = 5;
    // Two cruisers already on the tail, visible in frame.
    for (const off of [[-190, -60], [-260, 70]]) {
      const cop = makeCar(p.x + off[0], p.y + off[1], 0, 'police', G.rand);
      cop.driver = 'cop'; cop.speed = 200;
      G.police.push(cop);
    }
    G.showMessage('The ABPD is on you — lose them!');
  } else if (name === 'mission') {
    p.x = 2760; p.y = 1560;
    G.missions.index = 2; G.missions.active = true; G.missions.step = 1;
    G.missionsApi.setupStep(G);
    G.heat = 1.4; G.stars = 1;
    queueMicroDialogue(G);
    G.showMessage('Hot Property — take the Ondine Cabrio!');
  } else {
    // cover (default)
    p.x = PLAYER_START.x + 60; p.y = PLAYER_START.y - 60;
    p.angle = -0.6;
    G.missions.index = 0;
    if (!G.missions.active) G.startMission();
    G.showMessage('Welcome to Azura Bay, Vera.');
  }
  // Warm the simulation a little so traffic and peds are mid-motion.
  for (let i = 0; i < 40; i++) G.stepWorld(1 / 30, true);
}

function queueMicroDialogue(G) {
  G.missions.dialogue = ['Lena: That is my Cabrio — the gold one! Take it, Vera!'];
  G.missions.dialogueTimer = 30;
}
