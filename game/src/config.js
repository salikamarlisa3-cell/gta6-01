// Tuning constants for AZURA HEAT: world size, road grid, speeds, colours, district names.

export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const ROAD_XS = [300, 900, 1500, 2100, 2700, 3300];
export const ROAD_YS = [300, 900, 1500, 2100];
export const ROAD_HALF = 72;
export const SIDEWALK = 16;

export const DISTRICTS = [
  { name: 'Marina Shores', x0: 0, y0: 0, x1: 1800, y1: 1350, tint: '#173a4d' },
  { name: 'Neon Mile', x0: 1800, y0: 0, x1: 3600, y1: 1350, tint: '#3d1e4d' },
  { name: 'Portside', x0: 0, y0: 1350, x1: 1800, y1: 2700, tint: '#2e3a1e' },
  { name: 'Old Azura', x0: 1800, y0: 1350, x1: 3600, y1: 2700, tint: '#4d3319' },
];

export const BUILDING_COLORS = ['#2b3a55', '#3a2b55', '#553a2b', '#2b5548', '#55482b', '#40355e', '#5e3548', '#35505e'];
export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#ecf0f1', '#9b59b6', '#1abc9c', '#fd79a8', '#95a5a6'];
export const PED_COLORS = ['#f39c12', '#e91e63', '#00bcd4', '#8bc34a', '#ff5722', '#b39dfb', '#fff176', '#81d4fa'];

export const PLAYER_SPEED_WALK = 150;
export const PLAYER_SPEED_RUN = 265;
export const PLAYER_RADIUS = 13;
export const MAG_SIZE = 12;

export const HOSPITAL = { x: 1500, y: 1500, label: 'Azura General Hospital' };
export const POLICE_STATION = { x: 2100, y: 900, label: 'Azura Bay Police HQ' };
export const PLAYER_START = { x: 1500, y: 1620 };

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[0];
}
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
