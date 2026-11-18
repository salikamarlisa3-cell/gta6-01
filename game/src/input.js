// Keyboard and mouse input for AZURA HEAT: held keys, one-shot presses, mouse aim position.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    held, mouse,
    isDown(code) { return held.has(code); },
    wasPressed(code) { return pressed.has(code); },
    anyDown(...codes) { return codes.some((c) => held.has(c)); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
    moveAxis() {
      let x = 0, y = 0;
      if (this.anyDown('KeyA', 'ArrowLeft')) x -= 1;
      if (this.anyDown('KeyD', 'ArrowRight')) x += 1;
      if (this.anyDown('KeyW', 'ArrowUp')) y -= 1;
      if (this.anyDown('KeyS', 'ArrowDown')) y += 1;
      return { x, y };
    },
  };
}
