// Save and load for AZURA HEAT via localStorage: money, mission progress, position, health.

const SAVE_KEY = 'azura-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch { return null; }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      missionIndex: state.missionIndex,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: state.player.health,
      ammoReserve: state.player.ammoReserve,
      taxiFares: state.taxiFares || 0,
      racesWon: state.racesWon || 0,
    }));
  } catch { /* storage unavailable: play session-only */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function hasSave() { return loadSave() !== null; }
