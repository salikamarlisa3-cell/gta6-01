// HUD and minimap for AZURA HEAT: health, money, wanted stars, weapon and ammo,
// objective text, subtitle dialogue bar, district flash, bust meter, menus text data.
import { ROAD_XS, ROAD_YS } from './config.js';
import { districtAt } from './world.js';

export function drawMinimap(ctx, G, x, y, size) {
  const scale = size / G.world.width;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,26,0.88)';
  ctx.fillRect(x, y, size, size * (G.world.height / G.world.width));
  const h = size * (G.world.height / G.world.width);
  ctx.strokeStyle = 'rgba(120,200,255,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, h);
  // Streets
  ctx.strokeStyle = '#5a6b84';
  ctx.lineWidth = Math.max(1, 46 * scale);
  for (const rx of ROAD_XS) { ctx.beginPath(); ctx.moveTo(x + rx * scale, y); ctx.lineTo(x + rx * scale, y + h); ctx.stroke(); }
  for (const ry of ROAD_YS) { ctx.beginPath(); ctx.moveTo(x, y + ry * scale); ctx.lineTo(x + size, y + ry * scale); ctx.stroke(); }
  // Objective marker
  const mk = G.missionsApi.objectiveMarker(G);
  if (mk) {
    ctx.fillStyle = mk.color;
    ctx.beginPath(); ctx.arc(x + mk.x * scale, y + mk.y * scale, 5, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
  }
  // Traffic dots
  ctx.fillStyle = '#cfd8e3';
  for (const c of G.traffic) ctx.fillRect(x + c.x * scale - 1.5, y + c.y * scale - 1.5, 3, 3);
  // Police flash blue/red
  const flash = Math.floor(performance.now() / 300) % 2 === 0;
  ctx.fillStyle = flash ? '#3d7bff' : '#ff3d5e';
  for (const c of G.police) { ctx.beginPath(); ctx.arc(x + c.x * scale, y + c.y * scale, 4, 0, 6.29); ctx.fill(); }
  // Player arrow
  const px = x + G.player.x * scale, py = y + G.player.y * scale;
  ctx.translate(px, py);
  ctx.rotate(G.player.car ? G.player.car.angle : G.player.angle);
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawHUD(ctx, G, W, H) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'top';
  // Health bar top-left
  ctx.fillStyle = 'rgba(8,14,26,0.7)'; ctx.fillRect(14, 12, 224, 46);
  ctx.fillStyle = '#222'; ctx.fillRect(22, 22, 160, 14);
  ctx.fillStyle = p.health > 30 ? '#37d67a' : '#ff4757';
  ctx.fillRect(22, 22, 160 * Math.max(0, p.health) / 100, 14);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('VERA', 22, 40);
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('$' + G.money, 122, 38);
  // Wanted stars top-right
  ctx.font = '26px system-ui, sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.stars ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 18 - (4 - i) * 30, 12);
  }
  // Weapon / ammo bottom-right
  ctx.textAlign = 'right'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillStyle = '#fff';
  const weapon = p.car ? (p.car.name || 'Vehicle') : 'PISTOL';
  const ammo = p.car ? Math.round(Math.abs(p.car.speed)) + ' km/h' : (p.reloading > 0 ? 'RELOADING…' : p.ammoMag + ' / ' + p.ammoReserve);
  ctx.fillStyle = 'rgba(8,14,26,0.7)'; ctx.fillRect(W - 178, H - 56, 164, 42);
  ctx.fillStyle = '#fff'; ctx.fillText(weapon + '  ' + ammo, W - 24, H - 44);
  // Objective top-centre
  ctx.textAlign = 'center'; ctx.font = 'bold 16px system-ui, sans-serif';
  const obj = G.missionsApi.objectiveText(G);
  ctx.fillStyle = 'rgba(8,14,26,0.66)';
  const tw = ctx.measureText(obj).width + 28;
  ctx.fillRect(W / 2 - tw / 2, 12, tw, 30);
  ctx.fillStyle = '#ffd94d'; ctx.fillText(obj, W / 2, 19);
  // District flash
  if (G.districtFlash > 0) {
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, G.districtFlash) + ')';
    ctx.fillText(districtAt(p.x, p.y).name.toUpperCase(), W / 2, 64);
  }
  // Bust meter
  if (G.bustMeter > 0.05) {
    ctx.fillStyle = 'rgba(8,14,26,0.7)'; ctx.fillRect(W / 2 - 110, H - 120, 220, 22);
    ctx.fillStyle = '#ff4757'; ctx.fillRect(W / 2 - 106, H - 116, 212 * Math.min(1, G.bustMeter / 1.6), 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillText('BUSTED?', W / 2, H - 114);
  }
  // Message toast
  if (G.messageTimer > 0 && G.message) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    const mw = ctx.measureText(G.message).width + 30;
    ctx.fillStyle = 'rgba(8,14,26,0.8)'; ctx.fillRect(W / 2 - mw / 2, H - 168, mw, 32);
    ctx.fillStyle = '#fff'; ctx.fillText(G.message, W / 2, H - 161);
  }
  // Dialogue subtitle bar
  const dlg = G.missions.dialogue[0];
  if (dlg && G.missions.dialogueTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, H - 92, W, 52);
    ctx.font = '17px system-ui, sans-serif'; ctx.fillStyle = '#ffe9a8';
    ctx.fillText(dlg, W / 2, H - 76);
  }
  // Mission complete banner
  if (G.missions.completeFlash > 0) {
    ctx.font = 'bold 40px system-ui, sans-serif'; ctx.fillStyle = '#ffd94d';
    ctx.fillText('MISSION COMPLETE', W / 2, H / 2 - 120);
  }
  // Minimap bottom-left
  drawMinimap(ctx, G, 14, H - 14 - 150 * (G.world.height / G.world.width), 150);
  // Context prompt
  ctx.textAlign = 'left'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.fillStyle = '#bfe9ff';
  if (G.contextPrompt) ctx.fillText(G.contextPrompt, 16, H - 190);
  ctx.restore();
}
