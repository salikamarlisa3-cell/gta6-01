// World rendering for AZURA HEAT: day/night tinted city, roads with lane markings,
// sidewalks, buildings with lit windows, palms and lamps, cars with headlights, peds,
// bullets, particles, objective beacons, and the start / pause / end screens.
import { ROAD_XS, ROAD_YS, ROAD_HALF, SIDEWALK, clamp } from './config.js';

export function dayNightFactor(timeOfDay) {
  // timeOfDay 0..1 (0 = midnight). Returns 0 at night, 1 at noon.
  const sun = Math.sin((timeOfDay - 0.25) * Math.PI * 2) * 0.5 + 0.5;
  return clamp(sun, 0, 1);
}

export function drawWorld(ctx, G, camX, camY, W, H) {
  const world = G.world;
  const day = dayNightFactor(G.timeOfDay);
  const night = 1 - day;
  // Ground (grass / city base)
  ctx.fillStyle = '#274d33';
  ctx.fillRect(0, 0, W, H);
  const x0 = Math.max(0, camX - 40), y0 = Math.max(0, camY - 40);
  const x1 = Math.min(world.width, camX + W + 40), y1 = Math.min(world.height, camY + H + 40);
  ctx.save();
  ctx.translate(-camX, -camY);
  // Sidewalks then roads
  ctx.fillStyle = '#8d99a6';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_HALF - SIDEWALK, 0, (ROAD_HALF + SIDEWALK) * 2, world.height);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_HALF - SIDEWALK, world.width, (ROAD_HALF + SIDEWALK) * 2);
  ctx.fillStyle = '#2e3440';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, world.height);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_HALF, world.width, ROAD_HALF * 2);
  // Lane dashes
  ctx.strokeStyle = '#f7d154';
  ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
  for (const rx of ROAD_XS) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, world.height); ctx.stroke(); }
  for (const ry of ROAD_YS) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(world.width, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // Crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const rx of ROAD_XS) for (const ry of ROAD_YS) {
    for (let i = -2; i <= 2; i++) ctx.fillRect(rx + i * 26 - 8, ry - ROAD_HALF - 12, 16, 8);
  }
  // Buildings (only those in view)
  for (const b of world.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Windows: lit warm at night, glassy by day
    const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const lit = ((i * 7 + j * 13 + b.floors) % 5) < 2;
      ctx.fillStyle = lit ? (night > 0.5 ? '#ffd76a' : '#bfe3ff') : 'rgba(160,190,220,0.35)';
      ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 9, 12);
    }
  }
  // Props
  for (const pr of world.props) {
    if (pr.x < x0 || pr.x > x1 || pr.y < y0 || pr.y > y1) continue;
    if (pr.kind === 'palm') {
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 3, pr.y - 14); ctx.stroke();
      ctx.strokeStyle = '#2fae5f'; ctx.lineWidth = 3;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.28 + 0.5;
        ctx.beginPath(); ctx.moveTo(pr.x + 3, pr.y - 14); ctx.lineTo(pr.x + 3 + Math.cos(a) * 17, pr.y - 14 + Math.sin(a) * 9); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#39424e'; ctx.fillRect(pr.x - 2, pr.y - 16, 4, 16);
      ctx.fillStyle = night > 0.4 ? '#ffe9a8' : '#d7dee8';
      ctx.beginPath(); ctx.arc(pr.x, pr.y - 19, 5, 0, 6.29); ctx.fill();
      if (night > 0.4) { ctx.fillStyle = 'rgba(255,220,140,0.13)'; ctx.beginPath(); ctx.arc(pr.x, pr.y - 19, 30, 0, 6.29); ctx.fill(); }
    }
  }
  // Objective beacon
  const mk = G.missionsApi.objectiveMarker(G);
  if (mk) {
    const pulse = 16 + Math.sin(performance.now() / 220) * 5;
    ctx.strokeStyle = mk.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, pulse + 12, 0, 6.29); ctx.stroke();
    ctx.fillStyle = mk.color + '55'; ctx.beginPath(); ctx.arc(mk.x, mk.y, pulse + 12, 0, 6.29); ctx.fill();
    ctx.fillStyle = mk.color; ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼', mk.x, mk.y - pulse - 18 + Math.sin(performance.now() / 180) * 4);
  }
  // Cars
  for (const car of G.allCars()) drawCar(ctx, car, night, G);
  // Peds
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
    drawPed(ctx, ped);
  }
  // Player on foot
  if (!G.player.car) drawPlayer(ctx, G);
  // Bullets, flashes, particles
  ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
  for (const b of G.combat.bullets) { ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke(); }
  for (const f of G.combat.flashes) {
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(f.x, f.y, 10, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, 6.29); ctx.fill();
  }
  for (const pt of G.combat.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color; ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Night tint + vignette
  if (night > 0.03) {
    ctx.fillStyle = 'rgba(10,16,48,' + (night * 0.42) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
}

function drawCar(ctx, car, night, G) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Headlight cones at night
  if (night > 0.35 && car.driver) {
    const g = ctx.createRadialGradient(24, 0, 4, 90, 0, 80);
    g.addColorStop(0, 'rgba(255,240,180,0.35)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(22, -9); ctx.lineTo(110, -30); ctx.lineTo(110, 30); ctx.lineTo(22, 9); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 6); ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#1c2733'; ctx.fillRect(-car.len / 2, -car.wid / 2, car.len, 6); ctx.fillRect(-car.len / 2, car.wid / 2 - 6, car.len, 6);
    const flash = Math.floor(performance.now() / 220 + car.sirenPhase) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3d5e' : '#3d7bff'; ctx.fillRect(-8, -7, 16, 5);
    ctx.fillStyle = flash ? '#3d7bff' : '#ff3d5e'; ctx.fillRect(-8, 2, 16, 5);
    ctx.fillStyle = '#1c2733'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('ABPD', 0, 3);
  }
  if (car.kind === 'taxi') { ctx.fillStyle = '#1c2733'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3); }
  // Cabin + windshield
  ctx.fillStyle = '#bfe3ff'; ctx.fillRect(2, -car.wid / 2 + 4, 9, car.wid - 8);
  ctx.fillStyle = 'rgba(20,30,45,0.85)'; ctx.fillRect(-13, -car.wid / 2 + 4, 15, car.wid - 8);
  ctx.fillStyle = '#a8c6de'; ctx.fillRect(-16, -car.wid / 2 + 4, 3, car.wid - 8);
  // Wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(11, -car.wid / 2 - 2, 11, 4); ctx.fillRect(11, car.wid / 2 - 2, 11, 4);
  ctx.fillRect(-20, -car.wid / 2 - 2, 11, 4); ctx.fillRect(-20, car.wid / 2 - 2, 11, 4);
  // Damage smoke
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(120,120,120,' + (0.3 + Math.random() * 0.25) + ')';
    ctx.beginPath(); ctx.arc(16, 0, 6 + Math.random() * 5, 0, 6.29); ctx.fill();
  }
  ctx.restore();
  void G;
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(1.2);
    ctx.fillStyle = ped.color; ctx.fillRect(-11, -4, 22, 8);
    ctx.fillStyle = '#f2c09a'; ctx.beginPath(); ctx.arc(13, 0, 5, 0, 6.29); ctx.fill();
    ctx.restore(); return;
  }
  const bob = Math.sin(ped.phase) * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 3, 9, 5, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#2b3550'; ctx.fillRect(-6, -2 + bob * 0.3, 5, 9); ctx.fillRect(2, -2 - bob * 0.3, 5, 9);
  ctx.fillStyle = ped.color; roundRect(ctx, -7, -9, 14, 13, 4); ctx.fill();
  ctx.fillStyle = '#f2c09a'; ctx.beginPath(); ctx.arc(0, -12, 5.5, 0, 6.29); ctx.fill();
  if (ped.state === 'flee') { ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -24); }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = p.speed > 0 ? Math.sin(p.walkPhase) * 1.8 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 10, 6, 0, 0, 6.29); ctx.fill();
  ctx.rotate(0);
  ctx.fillStyle = '#20263a'; ctx.fillRect(-6, -1 + bob * 0.3, 5, 10); ctx.fillRect(2, -1 - bob * 0.3, 5, 10);
  ctx.fillStyle = '#ff2e88'; roundRect(ctx, -8, -10, 16, 14, 5); ctx.fill();
  ctx.fillStyle = '#f2c09a'; ctx.beginPath(); ctx.arc(0, -13, 6, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#141a26'; ctx.fillRect(-6, -19, 12, 4); // cap
  // Gun arm toward aim
  const aim = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);
  ctx.rotate(aim);
  ctx.fillStyle = '#f2c09a'; ctx.fillRect(6, -2, 9, 4);
  ctx.fillStyle = '#22262e'; ctx.fillRect(13, -2.5, 10, 5);
  if (p.punchTimer > 0.18) { ctx.fillStyle = '#f2c09a'; ctx.fillRect(18, -3, 8, 6); }
  ctx.restore();
  // Aim line hint
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(G.mouseWorld.x, G.mouseWorld.y); ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
