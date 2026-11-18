// City generation for Azura Bay: road grid, sidewalks, buildings with collision, props,
// parked-car spots, district lookup and spatial helpers shared by every other system.
import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_HALF, BUILDING_COLORS, districtAt } from './config.js';

export function isOnRoadX(x) { return ROAD_XS.some((rx) => Math.abs(x - rx) <= ROAD_HALF); }
export function isOnRoadY(y) { return ROAD_YS.some((ry) => Math.abs(y - ry) <= ROAD_HALF); }
export function isOnRoad(x, y) { return isOnRoadX(x) || isOnRoadY(y); }
export function nearestRoadX(x) { let b = ROAD_XS[0]; for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(b - x)) b = rx; return b; }
export function nearestRoadY(y) { let b = ROAD_YS[0]; for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(b - y)) b = ry; return b; }
export { districtAt };

export function createWorld(rand) {
  const buildings = [];
  const props = [];
  const parkSpots = [];

  // Fill each city block (the land between roads) with 1-4 buildings, leaving sidewalk margins.
  for (let bi = 0; bi < ROAD_XS.length - 1; bi++) {
    for (let bj = 0; bj < ROAD_YS.length - 1; bj++) {
      const bx0 = ROAD_XS[bi] + ROAD_HALF + 26;
      const bx1 = ROAD_XS[bi + 1] - ROAD_HALF - 26;
      const by0 = ROAD_YS[bj] + ROAD_HALF + 26;
      const by1 = ROAD_YS[bj + 1] - ROAD_HALF - 26;
      const bw = bx1 - bx0, bh = by1 - by0;
      const cols = bw > 340 ? 2 : 1;
      const rows = bh > 340 ? 2 : 1;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const pad = 14;
          const x = bx0 + (bw / cols) * cx + pad;
          const y = by0 + (bh / rows) * cy + pad;
          const w = bw / cols - pad * 2 - rand() * 30;
          const h = bh / rows - pad * 2 - rand() * 30;
          buildings.push({
            x, y, w, h,
            color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
            floors: 3 + Math.floor(rand() * 9),
            district: districtAt(x + w / 2, y + h / 2).name,
          });
        }
      }
      // Palms and lamps decorate block corners.
      props.push({ kind: 'palm', x: bx0 - 8, y: by0 - 8 });
      props.push({ kind: 'lamp', x: bx1 + 8, y: by0 - 8 });
      props.push({ kind: 'palm', x: bx1 + 8, y: by1 + 8 });
      props.push({ kind: 'lamp', x: bx0 - 8, y: by1 + 8 });
    }
  }
  // Extra lamps along every road.
  for (const rx of ROAD_XS) for (let y = 120; y < WORLD_H; y += 260) props.push({ kind: 'lamp', x: rx - ROAD_HALF - 10, y });
  for (const ry of ROAD_YS) for (let x = 120; x < WORLD_W; x += 260) props.push({ kind: 'lamp', x, y: ry - ROAD_HALF - 10 });

  // Parked-car spots hug the kerbs of vertical roads.
  for (const rx of ROAD_XS) {
    for (let y = 180; y < WORLD_H - 100; y += 190) {
      if (isOnRoadY(y)) continue;
      parkSpots.push({ x: rx - ROAD_HALF + 22, y, angle: -Math.PI / 2 });
      parkSpots.push({ x: rx + ROAD_HALF - 22, y: y + 90, angle: Math.PI / 2 });
    }
  }

  function hitsBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  // Move a circle by (dx,dy), sliding along building faces and world bounds.
  function moveCircle(pos, dx, dy, r) {
    let nx = pos.x + dx;
    if (!hitsBuilding(nx, pos.y, r) && nx > r && nx < WORLD_W - r) pos.x = nx;
    let ny = pos.y + dy;
    if (!hitsBuilding(pos.x, ny, r) && ny > r && ny < WORLD_H - r) pos.y = ny;
  }

  // Move a rotated car rectangle: sample its four corners plus centre against buildings.
  function carBlocked(x, y, angle, len, wid) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const pts = [[0, 0], [len / 2, wid / 2], [len / 2, -wid / 2], [-len / 2, wid / 2], [-len / 2, -wid / 2]];
    for (const [lx, ly] of pts) {
      const wx = x + lx * c - ly * s, wy = y + lx * s + ly * c;
      if (wx < 8 || wx > WORLD_W - 8 || wy < 8 || wy > WORLD_H - 8) return true;
      if (hitsBuilding(wx, wy, 2)) return true;
    }
    return false;
  }

  return { buildings, props, parkSpots, hitsBuilding, moveCircle, carBlocked, width: WORLD_W, height: WORLD_H };
}
