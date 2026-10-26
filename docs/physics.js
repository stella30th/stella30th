/**
 * Interactive 2D Physics Tech Stack Engine
 * Designed for Ho Le Thien An's GitHub Profile & Portfolio
 */

(function () {
  const canvas = document.getElementById('physics-canvas');
  const ctx = canvas.getContext('2d');
  const inspectBar = document.getElementById('inspect-bar');

  // Control buttons
  const btnGravNormal = document.getElementById('btn-gravity-normal');
  const btnGravZero = document.getElementById('btn-gravity-zero');
  const btnGravInvert = document.getElementById('btn-gravity-invert');
  const btnForceRepel = document.getElementById('btn-force-repel');
  const btnForceAttract = document.getElementById('btn-force-attract');
  const btnScatter = document.getElementById('btn-scatter');
  const btnAssemble = document.getElementById('btn-assemble');

  // Simulation State
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const STATE = {
    gravityY: 0,
    gravityX: 0,
    airResistance: 0.988,
    restitution: 0.72,
    mode: 'banner', // 'banner', 'normal', 'zero_g', 'invert', 'assemble'
    forceMode: 'repel', // 'repel', 'attract'
    cursorRadius: 160,
    cursorStrength: 0.7,
  };

  // Mouse / Pointer State
  const mouse = {
    x: -1000,
    y: -1000,
    prevX: -1000,
    prevY: -1000,
    vx: 0,
    vy: 0,
    isDown: false,
    draggedBody: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    hoveredBody: null,
  };

  // Starfield particles
  const stars = [];
  const numStars = 90;
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.03 + 0.01,
      angle: Math.random() * Math.PI * 2,
    });
  }

  // Visual shockwaves on collisions
  const shockwaves = [];

  // Icon Body Class
  class IconBody {
    constructor(data, targetX, targetY, scale) {
      this.id = data.id;
      this.name = data.name;
      this.src = data.src;
      this.img = new Image();
      this.img.src = data.src;

      this.rawW = data.width;
      this.rawH = data.height;
      this.scale = scale;
      this.w = this.rawW * this.scale;
      this.h = this.rawH * this.scale;
      this.radius = Math.max(this.w, this.h) / 2;

      // Exact Initial Positions matching authentic original banner
      this.homeX = targetX;
      this.homeY = targetY;
      this.x = targetX;
      this.y = targetY;

      // Velocities
      this.vx = 0;
      this.vy = 0;

      // Angular dynamics
      this.angle = 0;
      this.angularVelocity = 0;
      this.phaseX = Math.random() * Math.PI * 2;
      this.phaseY = Math.random() * Math.PI * 2;

      this.mass = Math.max(1, (this.radius * this.radius) / 400);
      this.isHovered = false;
      this.isDragged = false;
    }

    update() {
      if (this.isDragged) {
        // Direct tracking with damping
        const targetX = mouse.x - mouse.dragOffsetX;
        const targetY = mouse.y - mouse.dragOffsetY;
        this.vx = (targetX - this.x) * 0.35;
        this.vy = (targetY - this.y) * 0.35;
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.vx * 0.01;
        this.angularVelocity = this.vx * 0.01;
        return;
      }

      // Gentle floating breathing motion in authentic banner formation
      if (STATE.mode === 'banner') {
        const time = Date.now() * 0.0018;
        const targetHoverX = this.homeX + Math.sin(time + this.phaseX) * 1.5;
        const targetHoverY = this.homeY + Math.cos(time + this.phaseY) * 2.0;
        const dx = targetHoverX - this.x;
        const dy = targetHoverY - this.y;
        this.vx += dx * 0.08;
        this.vy += dy * 0.08;
        this.vx *= 0.82;
        this.vy *= 0.82;
        this.angle *= 0.92;
        this.angularVelocity *= 0.9;
        this.x += this.vx;
        this.y += this.vy;
        return;
      }

      // Re-assemble spring force
      if (STATE.mode === 'assemble') {
        const dx = this.homeX - this.x;
        const dy = this.homeY - this.y;
        this.vx += dx * 0.08;
        this.vy += dy * 0.08;
        this.vx *= 0.85;
        this.vy *= 0.85;
        this.angle *= 0.92;
        this.angularVelocity *= 0.9;
        this.x += this.vx;
        this.y += this.vy;
        return;
      }

      // Apply Gravity
      this.vx += STATE.gravityX;
      this.vy += STATE.gravityY;

      // Ambient Zero-G float
      if (STATE.mode === 'zero_g') {
        this.vx += (Math.random() - 0.5) * 0.08;
        this.vy += (Math.random() - 0.5) * 0.08;
      }

      // Mouse Force Field (Repel / Attract)
      if (mouse.x > 0 && mouse.y > 0 && !this.isDragged) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && dist < STATE.cursorRadius) {
          const force = (1 - dist / STATE.cursorRadius) * STATE.cursorStrength;
          const dirX = dx / dist;
          const dirY = dy / dist;

          if (STATE.forceMode === 'repel') {
            this.vx += dirX * force * 5;
            this.vy += dirY * force * 5;
            this.angularVelocity += (Math.random() - 0.5) * force * 0.08;
          } else {
            this.vx -= dirX * force * 3.5;
            this.vy -= dirY * force * 3.5;
          }
        }
      }

      // Air resistance & Angular damping
      this.vx *= STATE.airResistance;
      this.vy *= STATE.airResistance;
      this.angularVelocity *= 0.985;

      // Cap max speed
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const maxSpeed = 26;
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      }

      // Update position & rotation
      this.x += this.vx;
      this.y += this.vy;
      this.angle += this.angularVelocity;

      // Screen boundary collisions
      const pad = this.radius;
      if (this.x < pad) {
        this.x = pad;
        this.vx = -this.vx * STATE.restitution;
      } else if (this.x > width - pad) {
        this.x = width - pad;
        this.vx = -this.vx * STATE.restitution;
      }

      if (this.y < pad) {
        this.y = pad;
        this.vy = -this.vy * STATE.restitution;
      } else if (this.y > height - pad) {
        this.y = height - pad;
        this.vy = -this.vy * STATE.restitution;
        // Ground friction
        this.vx *= 0.95;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Glow effect if hovered or dragged
      if (this.isDragged || this.isHovered) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 24;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
      }

      // Draw Icon Sprite
      if (this.img.complete && this.img.naturalWidth > 0) {
        ctx.drawImage(this.img, -this.w / 2, -this.h / 2, this.w, this.h);
      } else {
        // Fallback pill/circle
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  let bodies = [];

  // Resolve pairwise collisions
  function resolveCollisions() {
    const len = bodies.length;
    for (let i = 0; i < len; i++) {
      const b1 = bodies[i];
      for (let j = i + 1; j < len; j++) {
        const b2 = bodies[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist && dist > 0.001) {
          // Overlap separation
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          const mRatio1 = b2.mass / (b1.mass + b2.mass);
          const mRatio2 = b1.mass / (b1.mass + b2.mass);

          if (!b1.isDragged) {
            b1.x -= nx * overlap * mRatio1;
            b1.y -= ny * overlap * mRatio1;
          }
          if (!b2.isDragged) {
            b2.x += nx * overlap * mRatio2;
            b2.y += ny * overlap * mRatio2;
          }

          // Relative velocity along normal
          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const p = 2 * (nx * kx + ny * ky) / (b1.mass + b2.mass);

          if (nx * kx + ny * ky > 0) {
            const restitution = STATE.restitution;
            if (!b1.isDragged) {
              b1.vx -= p * b2.mass * nx * (1 + restitution) * 0.5;
              b1.vy -= p * b2.mass * ny * (1 + restitution) * 0.5;
            }
            if (!b2.isDragged) {
              b2.vx += p * b1.mass * nx * (1 + restitution) * 0.5;
              b2.vy += p * b1.mass * ny * (1 + restitution) * 0.5;
            }

            // High-speed collision shockwave
            const impactSpeed = Math.abs(kx) + Math.abs(ky);
            if (impactSpeed > 7 && shockwaves.length < 15) {
              shockwaves.push({
                x: (b1.x + b2.x) / 2,
                y: (b1.y + b2.y) / 2,
                r: 4,
                maxR: Math.min(60, impactSpeed * 4),
                alpha: 0.6,
              });
            }
          }
        }
      }
    }
  }

  // Draw Background (Starfield & Circuit Traces)
  function drawBackground() {
    // Cosmic dark gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#060a12');
    grad.addColorStop(0.5, '#0a1122');
    grad.addColorStop(1, '#050810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Glowing nebula spot in center
    const nebula = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.6);
    nebula.addColorStop(0, 'rgba(37, 99, 235, 0.08)');
    nebula.addColorStop(0.5, 'rgba(56, 189, 248, 0.03)');
    nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    // Twinkling stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.angle += s.twinkleSpeed;
      const curAlpha = s.alpha * (0.6 + 0.4 * Math.sin(s.angle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(224, 242, 254, ${curAlpha})`;
      ctx.fill();
    }

    // Circuit board neon traces on left and right
    drawCircuitTraces();

    // Collision shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.r += 2.5;
      sw.alpha *= 0.88;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${sw.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (sw.alpha < 0.03 || sw.r > sw.maxR) {
        shockwaves.splice(i, 1);
      }
    }

    // Mouse cursor field indicator
    if (mouse.x > 0 && mouse.y > 0) {
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, STATE.cursorRadius, 0, Math.PI * 2);
      if (STATE.forceMode === 'repel') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      } else {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
      }
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw subtle circuit board lines
  function drawCircuitTraces() {
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.14)';
    ctx.lineWidth = 1.5;

    // Left circuit lines
    const leftX = Math.min(120, width * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.3);
    ctx.lineTo(leftX * 0.4, height * 0.3);
    ctx.lineTo(leftX * 0.7, height * 0.4);
    ctx.lineTo(leftX, height * 0.4);
    ctx.moveTo(0, height * 0.7);
    ctx.lineTo(leftX * 0.5, height * 0.7);
    ctx.lineTo(leftX * 0.8, height * 0.6);
    ctx.lineTo(leftX, height * 0.6);
    ctx.stroke();

    // Left circuit nodes
    ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
    [
      [leftX, height * 0.4],
      [leftX, height * 0.6],
    ].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Right circuit lines
    const rightX = width - Math.min(120, width * 0.12);
    ctx.beginPath();
    ctx.moveTo(width, height * 0.35);
    ctx.lineTo(width - leftX * 0.5, height * 0.35);
    ctx.lineTo(rightX, height * 0.45);
    ctx.moveTo(width, height * 0.65);
    ctx.lineTo(width - leftX * 0.4, height * 0.65);
    ctx.lineTo(rightX, height * 0.55);
    ctx.stroke();

    // Right circuit nodes
    [
      [rightX, height * 0.45],
      [rightX, height * 0.55],
    ].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  // Animation Loop
  function loop() {
    drawBackground();

    // Physics step
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].update();
    }
    resolveCollisions();

    // Render bodies
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].draw(ctx);
    }

    requestAnimationFrame(loop);
  }

  // Initialize Icon Bodies from metadata
  async function initBodies() {
    let metadata;
    try {
      const res = await fetch('./assets/icons-metadata.json');
      metadata = await res.json();
    } catch (e) {
      console.warn('Using embedded icon catalog fallback');
      metadata = {
        bannerWidth: 1024,
        bannerHeight: 204,
        icons: [
          { id: 'docker', name: 'Docker', src: 'assets/icons/docker.png', width: 90, height: 75, normX: 0.32, normY: 0.55 },
          { id: 'react', name: 'React', src: 'assets/icons/spring.png', width: 70, height: 70, normX: 0.71, normY: 0.3 },
          { id: 'gopher_mascot', name: 'Go Gopher', src: 'assets/icons/gopher_mascot.png', width: 92, height: 102, normX: 0.4990, normY: 0.7500 },
          { id: 'postgres', name: 'PostgreSQL', src: 'assets/icons/postgres.png', width: 75, height: 70, normX: 0.68, normY: 0.8 },
          { id: 'redis', name: 'Redis', src: 'assets/icons/redis.png', width: 60, height: 60, normX: 0.44, normY: 0.7 },
          { id: 'nginx', name: 'Nginx', src: 'assets/icons/nginx.png', width: 60, height: 70, normX: 0.60, normY: 0.7 },
          { id: 'git', name: 'Git', src: 'assets/icons/git.png', width: 55, height: 55, normX: 0.40, normY: 0.6 },
          { id: 'apple', name: 'Apple', src: 'assets/icons/apple.png', width: 60, height: 60, normX: 0.28, normY: 0.9 },
        ]
      };
    }

    const iconsList = Array.isArray(metadata) ? metadata : (metadata.icons || []);
    const bannerWidth = (metadata && metadata.bannerWidth) || 1024;
    const bannerHeight = (metadata && metadata.bannerHeight) || 204;
    const bannerAspect = bannerWidth / bannerHeight;

    // Fit banner inside viewport with padding
    const bannerW = Math.min(width * 0.92, 1024);
    const bannerH = bannerW / bannerAspect;
    const startX = (width - bannerW) / 2;
    const startY = (height - bannerH) / 2;

    const scale = bannerW / bannerWidth;

    // Sort by zIndex to keep correct visual layering
    if (iconsList && iconsList.length > 0) {
      iconsList.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    }

    bodies = iconsList.map((item) => {
      const targetX = startX + item.normX * bannerW;
      const targetY = startY + item.normY * bannerH;
      return new IconBody(item, targetX, targetY, scale);
    });

    console.log(`Initialized ${bodies.length} physics bodies.`);
  }

  // Pointer & Mouse Interaction Handlers
  function getEventPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function handlePointerDown(e) {
    const pos = getEventPos(e);
    mouse.x = pos.x;
    mouse.y = pos.y;
    mouse.isDown = true;

    // Hit test from top (last drawn body first)
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      const dx = mouse.x - b.x;
      const dy = mouse.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) <= b.radius * 1.1) {
        if (STATE.mode === 'banner') {
          STATE.mode = 'zero_g';
          STATE.gravityY = 0;
          setActiveGravityBtn(btnGravZero);
        }
        mouse.draggedBody = b;
        b.isDragged = true;
        mouse.dragOffsetX = mouse.x - b.x;
        mouse.dragOffsetY = mouse.y - b.y;

        // Bring to front
        bodies.splice(i, 1);
        bodies.push(b);

        if (inspectBar) {
          inspectBar.innerHTML = `🚀 Dragging: <strong>${b.name}</strong> • Release to fling!`;
          inspectBar.style.color = '#38bdf8';
        }
        break;
      }
    }
  }

  function handlePointerMove(e) {
    const pos = getEventPos(e);
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = pos.x;
    mouse.y = pos.y;
    mouse.vx = mouse.x - mouse.prevX;
    mouse.vy = mouse.y - mouse.prevY;

    if (!mouse.draggedBody) {
      // Check hover
      let found = null;
      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        const dx = mouse.x - b.x;
        const dy = mouse.y - b.y;
        if (Math.sqrt(dx * dx + dy * dy) <= b.radius) {
          found = b;
          break;
        }
      }

      bodies.forEach((b) => (b.isHovered = b === found));

      if (found && inspectBar) {
        inspectBar.innerHTML = `✨ <strong>${found.name}</strong> • Click to drag & fling!`;
        inspectBar.style.color = '#f59e0b';
      }
    }
  }

  function handlePointerUp() {
    if (mouse.draggedBody) {
      // Transfer throwing inertia
      mouse.draggedBody.vx = mouse.vx * 0.7;
      mouse.draggedBody.vy = mouse.vy * 0.7;
      mouse.draggedBody.angularVelocity = mouse.vx * 0.02;
      mouse.draggedBody.isDragged = false;
      mouse.draggedBody = null;

      if (inspectBar) {
        inspectBar.innerHTML = 'Hover or drag any icon to inspect technology details';
        inspectBar.style.color = 'var(--accent-cyan)';
      }
    }
    mouse.isDown = false;
  }

  // Scroll & Wheel Dynamic Orientation
  window.addEventListener(
    'wheel',
    (e) => {
      const deltaY = e.deltaY;
      // Scrolling down directs icons downward with wind; scrolling up floats them upward
      const impulseY = Math.sign(deltaY) * Math.min(Math.abs(deltaY) * 0.06, 6);
      const impulseX = (e.deltaX || 0) * 0.05;

      bodies.forEach((b) => {
        b.vy += impulseY * (1 / b.mass);
        b.vx += impulseX * (1 / b.mass);
        b.angularVelocity += (Math.random() - 0.5) * 0.02 * impulseY;
      });

      // Brief gravity shift
      STATE.gravityY = deltaY > 0 ? 0.45 : -0.2;
      setTimeout(() => {
        if (STATE.mode === 'normal') STATE.gravityY = 0.28;
        if (STATE.mode === 'zero_g') STATE.gravityY = 0;
        if (STATE.mode === 'invert') STATE.gravityY = -0.28;
      }, 600);
    },
    { passive: true }
  );

  // Event Listeners
  window.addEventListener('mousedown', handlePointerDown);
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', handlePointerUp);

  window.addEventListener('touchstart', handlePointerDown, { passive: true });
  window.addEventListener('touchmove', handlePointerMove, { passive: true });
  window.addEventListener('touchend', handlePointerUp);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // UI Button Controls
  function setActiveGravityBtn(activeBtn) {
    [btnGravNormal, btnGravZero, btnGravInvert].forEach((btn) => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  btnGravNormal.addEventListener('click', () => {
    STATE.mode = 'normal';
    STATE.gravityY = 0.28;
    STATE.gravityX = 0;
    setActiveGravityBtn(btnGravNormal);
  });

  btnGravZero.addEventListener('click', () => {
    STATE.mode = 'zero_g';
    STATE.gravityY = 0;
    STATE.gravityX = 0;
    setActiveGravityBtn(btnGravZero);
    bodies.forEach((b) => {
      b.vx += (Math.random() - 0.5) * 4;
      b.vy += (Math.random() - 0.5) * 4;
    });
  });

  btnGravInvert.addEventListener('click', () => {
    STATE.mode = 'invert';
    STATE.gravityY = -0.32;
    STATE.gravityX = 0;
    setActiveGravityBtn(btnGravInvert);
  });

  btnForceRepel.addEventListener('click', () => {
    STATE.forceMode = 'repel';
    btnForceRepel.classList.add('active');
    btnForceAttract.classList.remove('active');
  });

  btnForceAttract.addEventListener('click', () => {
    STATE.forceMode = 'attract';
    btnForceAttract.classList.add('active');
    btnForceRepel.classList.remove('active');
  });

  btnScatter.addEventListener('click', () => {
    STATE.mode = 'normal';
    setActiveGravityBtn(btnGravNormal);
    bodies.forEach((b) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 16 + 8;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      b.angularVelocity = (Math.random() - 0.5) * 0.15;
    });
    // Add visual shockwave at center
    shockwaves.push({
      x: width / 2,
      y: height / 2,
      r: 10,
      maxR: Math.max(width, height) * 0.5,
      alpha: 0.8,
    });
  });

  btnAssemble.addEventListener('click', () => {
    STATE.mode = 'banner';
    setActiveGravityBtn(null);
  });

  // Start Engine
  initBodies().then(() => {
    loop();
  });
})();
