// Story missions and side activities for AZURA HEAT. Vera Solano runs jobs for fixer
// Marco Reyes across Azura Bay: a five-mission chain with dialogue, go-to, steal, deliver,
// escape and timed objectives, plus repeatable taxi fares and checkpoint sprints.
import { clamp } from './config.js';
import { makeCar } from './vehicles.js';

// Mission step kinds: goto | steal | deliver | escape | timer | talk
export const MISSIONS = [
  {
    title: 'First Wheels', giver: 'Marco Reyes', reward: 150,
    intro: ['Marco: Vera! You made it to Azura Bay. I left a Vireo running near Marina Shores.', 'Marco: Take it. Consider it a signing bonus — just do not scratch it.'],
    steps: [
      { kind: 'goto', x: 920, y: 980, label: 'Reach the marked Vireo Coupe', radius: 60 },
      { kind: 'steal', carKind: 'mission', label: 'Get in the Vireo Coupe', radius: 60 },
      { kind: 'deliver', x: 2160, y: 1560, label: 'Deliver the Vireo to the Neon Mile garage', radius: 70 },
    ],
    outro: ['Marco: Clean work. The Bay is yours now — keep your nose down and your foot down.'],
  },
  {
    title: 'Harbor Run', giver: 'Marco Reyes', reward: 260,
    intro: ['Marco: A client in Portside needs a package moved. Fast. No questions.', 'Vera: When do I ever ask questions, Marco?'],
    steps: [
      { kind: 'goto', x: 420, y: 1620, label: 'Pick up the package at the Portside dock', radius: 60 },
      { kind: 'timer', x: 2760, y: 420, seconds: 95, label: 'Deliver to the Neon Mile rooftop meet — hurry!', radius: 70 },
    ],
    outro: ['Marco: Ninety-five seconds. The client is impressed. So am I.'],
  },
  {
    title: 'Hot Property', giver: 'Lena Voss', reward: 380,
    intro: ['Lena: My Ondine Cabrio got lifted and parked up in Old Azura.', 'Lena: Bring it home, Vera. If the law notices... lose them first.'],
    steps: [
      { kind: 'goto', x: 2820, y: 1620, label: 'Find Lena\'s Ondine Cabrio in Old Azura', radius: 60 },
      { kind: 'steal', carKind: 'any', label: 'Steal the Ondine Cabrio', radius: 60 },
      { kind: 'escape', label: 'Lose the police!', radius: 0 },
      { kind: 'deliver', x: 1560, y: 420, label: 'Return the Cabrio to Lena at Marina Shores', radius: 70 },
    ],
    outro: ['Lena: She\'s perfect. You are officially my favourite criminal.'],
  },
  {
    title: 'Night Ledger', giver: 'Marco Reyes', reward: 520,
    intro: ['Marco: The Solace Casino keeps a ledger I need. Their courier drives a black Sable.', 'Marco: Tail the route, take the car at the marina, bring it to me. Quietly.'],
    steps: [
      { kind: 'goto', x: 1560, y: 2160, label: 'Reach the marina overlook in Portside', radius: 60 },
      { kind: 'timer', x: 3360, y: 2160, seconds: 110, label: 'Intercept the courier in Old Azura — do not be late', radius: 70 },
      { kind: 'deliver', x: 920, y: 420, label: 'Bring the Sable to Marco at Marina Shores', radius: 70 },
    ],
    outro: ['Marco: The ledger, Vera. With this, we own half the Neon Mile.'],
  },
  {
    title: 'Azura Heat', giver: 'Marco Reyes', reward: 900,
    intro: ['Marco: One last job. The whole Bay will be watching — and so will every cop in it.', 'Vera: Then let us give them a show.'],
    steps: [
      { kind: 'goto', x: 2160, y: 420, label: 'Reach the Neon Mile start line', radius: 60 },
      { kind: 'timer', x: 420, y: 420, seconds: 120, label: 'Cross the Bay to Marina Shores — beat the clock!', radius: 70 },
      { kind: 'escape', label: 'Shake the heat and finish the story!', radius: 0 },
    ],
    outro: ['Marco: You did it, Vera. Azura Bay is ours.', 'THE END — free roam unlocked. Taxis and sprints still pay.'],
  },
];

export function createMissionState(savedIndex) {
  return {
    index: savedIndex || 0, step: 0, active: false, dialogue: [], dialogueTimer: 0,
    timer: 0, targetCar: null, completeFlash: 0, sideMode: null, sideTarget: null, sideTimer: 0,
  };
}

export function currentMission(G) { return MISSIONS[G.missions.index] || null; }
export function currentStep(G) { const m = currentMission(G); return m ? m.steps[G.missions.step] : null; }

export function startMission(G) {
  const m = currentMission(G);
  if (!m || G.missions.active) return;
  G.missions.active = true;
  G.missions.step = 0;
  G.missions.targetCar = null;
  queueDialogue(G, m.intro);
  setupStep(G);
  G.showMessage('Mission: ' + m.title);
}

export function queueDialogue(G, lines) {
  G.missions.dialogue = [...lines];
  G.missions.dialogueTimer = 4.2;
}

export function setupStep(G) {
  const s = currentStep(G);
  if (!s) return;
  if (s.kind === 'timer') G.missions.timer = s.seconds;
  if (s.kind === 'steal' && s.carKind === 'mission' && !G.missions.targetCar) {
    // The First Wheels Vireo waits at the goto point of the previous step.
    const prev = MISSIONS[G.missions.index].steps[G.missions.step - 1];
    const car = makeCar(prev ? prev.x : s.x || 920, prev ? prev.y : s.y || 980, 0, 'mission', G.rand);
    car.name = 'Vireo Coupe'; car.color = '#ff2e88';
    G.parked.push(car);
    G.missions.targetCar = car;
  }
  if (s.kind === 'steal' && s.carKind === 'any' && !G.missions.targetCar) {
    const car = makeCar(2820, 1620, Math.PI, 'mission', G.rand);
    car.name = 'Ondine Cabrio'; car.color = '#ffd700';
    G.parked.push(car);
    G.missions.targetCar = car;
  }
}

export function onCarEntered(G, car) {
  const s = currentStep(G);
  if (!s || !G.missions.active) return;
  if (s.kind === 'steal' && (car === G.missions.targetCar || s.carKind === 'any')) advanceStep(G);
}

export function failMission(G, why) {
  if (!G.missions.active) return;
  G.missions.active = false;
  G.missions.step = 0;
  G.missions.targetCar = null;
  G.audio.fail();
  G.showMessage('Mission failed: ' + why + ' — restart it at the gold marker.');
}

export function advanceStep(G) {
  const m = currentMission(G);
  G.missions.step += 1;
  G.audio.pickup();
  if (G.missions.step >= m.steps.length) {
    G.missions.active = false;
    G.missions.step = 0;
    G.missions.targetCar = null;
    G.money += m.reward;
    G.missions.completeFlash = 3.5;
    G.audio.jingle();
    queueDialogue(G, m.outro);
    G.showMessage('Mission complete! +$' + m.reward);
    G.missions.index = Math.min(G.missions.index + 1, MISSIONS.length);
    G.saveGame();
  } else {
    setupStep(G);
  }
}

export function updateMissions(G, dt) {
  const ms = G.missions;
  if (ms.dialogueTimer > 0) {
    ms.dialogueTimer -= dt;
    if (ms.dialogueTimer <= 0 && ms.dialogue.length > 1) { ms.dialogue.shift(); ms.dialogueTimer = 4.2; }
  }
  if (ms.completeFlash > 0) ms.completeFlash -= dt;
  updateSideActivity(G, dt);
  if (!ms.active) return;
  const s = currentStep(G);
  if (!s) return;
  const p = G.player;
  if (s.kind === 'goto' || s.kind === 'deliver') {
    if (Math.hypot(p.x - s.x, p.y - s.y) < s.radius) {
      if (s.kind === 'deliver' && !p.car) { /* must arrive by car for deliveries after steal steps */ }
      advanceStep(G);
    }
  } else if (s.kind === 'timer') {
    ms.timer -= dt;
    if (ms.timer <= 0) { failMission(G, 'out of time'); return; }
    if (Math.hypot(p.x - s.x, p.y - s.y) < s.radius) advanceStep(G);
  } else if (s.kind === 'escape') {
    if (G.stars === 0 && G.heat < 0.4) advanceStep(G);
  }
}

// Repeatable side work: taxi fares and checkpoint sprints, started at blue markers.
export function startSideActivity(G) {
  const ms = G.missions;
  if (ms.sideMode) return;
  if (G.player.car && (G.player.car.kind === 'taxi' || Math.random() < 0.6)) {
    ms.sideMode = 'taxi';
    ms.sideTarget = randomDrop(G);
    G.showMessage('Taxi fare: take your passenger to the blue marker.');
  } else {
    ms.sideMode = 'sprint';
    ms.sideTarget = randomDrop(G);
    ms.sideTimer = 45;
    G.showMessage('Checkpoint sprint: reach the blue marker before time runs out!');
  }
}

function randomDrop(G) {
  const xs = [420, 920, 1560, 2160, 2760, 3240], ys = [420, 980, 1560, 2160];
  return { x: xs[Math.floor(Math.random() * xs.length)], y: ys[Math.floor(Math.random() * ys.length)] };
}

export function updateSideActivity(G, dt) {
  const ms = G.missions;
  if (!ms.sideMode || !ms.sideTarget) return;
  if (ms.sideMode === 'sprint') {
    ms.sideTimer -= dt;
    if (ms.sideTimer <= 0) { ms.sideMode = null; ms.sideTarget = null; G.showMessage('Sprint failed — too slow.'); G.audio.fail(); return; }
  }
  if (Math.hypot(G.player.x - ms.sideTarget.x, G.player.y - ms.sideTarget.y) < 70) {
    const pay = ms.sideMode === 'taxi' ? 60 + Math.floor(Math.random() * 60) : 120;
    G.money += pay;
    if (ms.sideMode === 'taxi') G.taxiFares += 1; else G.racesWon += 1;
    G.audio.cash();
    G.showMessage((ms.sideMode === 'taxi' ? 'Fare paid: +$' : 'Sprint won: +$') + pay);
    ms.sideMode = null; ms.sideTarget = null;
    G.saveGame();
  }
  void clamp;
}

export function objectiveText(G) {
  const ms = G.missions;
  if (ms.sideMode && ms.sideTarget) {
    return ms.sideMode === 'taxi' ? 'Taxi fare — reach the blue marker' : 'Sprint — ' + Math.ceil(ms.sideTimer) + 's left!';
  }
  const m = currentMission(G);
  if (!m) return 'Free roam — work taxis (T near a cab) or enjoy Azura Bay.';
  if (!ms.active) return 'Go to the gold marker to start: ' + m.title;
  const s = currentStep(G);
  if (!s) return m.title;
  if (s.kind === 'timer') return s.label + ' (' + Math.ceil(ms.timer) + 's)';
  return s.label;
}

export function objectiveMarker(G) {
  const ms = G.missions;
  if (ms.sideMode && ms.sideTarget) return { x: ms.sideTarget.x, y: ms.sideTarget.y, color: '#35c4ff' };
  const m = currentMission(G);
  if (!m) return null;
  if (!ms.active) return { x: 920, y: 420, color: '#ffd94d' }; // Marco's Marina Shores corner
  const s = currentStep(G);
  if (!s) return null;
  if (s.kind === 'steal' && ms.targetCar) return { x: ms.targetCar.x, y: ms.targetCar.y, color: '#ffd94d' };
  if (s.kind === 'escape') return null;
  return { x: s.x, y: s.y, color: '#ffd94d' };
}
