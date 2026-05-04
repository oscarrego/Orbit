import React, { useEffect, useRef } from 'react';

const NumericSphereBackground = ({ onAbsorb }) => {
  const canvasRef = useRef(null);
  const sphereParticles = useRef([]);
  const vacuumParticles = useRef([]);
  const coreEnergy = useRef(0);
  const rotation = useRef({ x: 0, y: 0 });
  
  // Cinematic Loop State Machine
  const phaseRef = useRef('WAIT');
  const timerRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const SPHERE_COUNT = 400;
    const PERSPECTIVE = 450;
    const MAX_PARTICLES = 100;

    const getDynamicRadius = () => Math.min(canvas.width, canvas.height) * 0.35;

    const initSphere = () => {
      sphereParticles.current = [];
      const radius = getDynamicRadius();
      
      for (let i = 0; i < SPHERE_COUNT; i++) {
        const phi = Math.acos(1 - 2 * (i + 0.5) / SPHERE_COUNT);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        sphereParticles.current.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi),
          value: Math.floor(Math.random() * 10).toString()
        });
      }
    };

    const spawnParticle = (centerX, centerY, sphereRadius) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = sphereRadius + (40 + Math.random() * 40);
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0.3 + Math.random() * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        opacity: 0,
        size: 1.5 + Math.random() * 1.5
      };
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      initSphere();
      vacuumParticles.current = [];
      phaseRef.current = 'WAIT';
      timerRef.current = 0;
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min(now - lastTimeRef.current, 50);
      lastTimeRef.current = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = getDynamicRadius();

      // --- PHASE LOGIC ---
      if (phaseRef.current === 'WAIT') {
        timerRef.current += dt;
        if (timerRef.current >= 300) {
          phaseRef.current = 'SPAWN';
          timerRef.current = 0;
        }
      } else if (phaseRef.current === 'SPAWN') {
        vacuumParticles.current = [];
        for (let i = 0; i < MAX_PARTICLES; i++) {
          vacuumParticles.current.push(spawnParticle(centerX, centerY, radius));
        }
        coreEnergy.current = 0;
        phaseRef.current = 'FLOW';
        timerRef.current = 0;
      } else if (phaseRef.current === 'FLOW') {
        if (vacuumParticles.current.length === 0) {
          phaseRef.current = 'CORE_ANIMATION';
          timerRef.current = 0;
        }
      } else if (phaseRef.current === 'CORE_ANIMATION') {
        timerRef.current += dt;
        if (timerRef.current >= 700) {
          phaseRef.current = 'WAIT';
          timerRef.current = 0;
          coreEnergy.current = 0;
        }
      }

      // 1. RENDER BACKGROUND PARTICLES
      if (phaseRef.current === 'FLOW') {
        for (let i = vacuumParticles.current.length - 1; i >= 0; i--) {
          const p = vacuumParticles.current[i];
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 8) {
            vacuumParticles.current.splice(i, 1);
            coreEnergy.current += 1;
            continue;
          }

          const nx = dx / dist;
          const ny = dy / dist;
          let pull = 0.05 + Math.max(0, 1 - dist / (radius + 80)) * 0.55; 
          p.vx += nx * pull;
          p.vy += ny * pull;
          p.vx += -ny * 0.03;
          p.vy += nx * 0.03;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.x += p.vx;
          p.y += p.vy;

          let normDist = Math.min(dist / (radius + 80), 1);
          const targetOpacity = 0.1 + (1 - normDist) * 0.5;
          p.opacity += (targetOpacity - p.opacity) * 0.1;

          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- SPHERE ROTATION ---
      rotation.current.y += 0.006;
      rotation.current.x = rotation.current.y * 0.6;

      const angleY = rotation.current.y;
      const angleX = rotation.current.x;
      
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const projected = sphereParticles.current.map(p => {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const scale = PERSPECTIVE / (PERSPECTIVE + z2);
        const screenX = centerX + x1 * scale;
        const screenY = centerY + y1 * scale;
        return { ...p, screenX, screenY, zPrime: z2 };
      });

      projected.sort((a, b) => b.zPrime - a.zPrime);

      // 2. RENDER SPHERE NUMBERS
      projected.forEach(p => {
        let normalizedZ = (p.zPrime + radius) / (2 * radius);
        normalizedZ = Math.max(0, Math.min(1, normalizedZ));
        const opacity = 1 - (normalizedZ * 0.8);
        const size = 14 - (normalizedZ * 6);
        ctx.font = `${size}px monospace`;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.value, p.screenX, p.screenY);
      });

      // 3. RENDER OUTER CIRCLE
      const ringRadius = radius + 25;
      const ringGradient = ctx.createLinearGradient(centerX, centerY - ringRadius, centerX, centerY + ringRadius);
      ringGradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      ringGradient.addColorStop(1, "rgba(255, 255, 255, 0.25)");
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = ringGradient;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // 4. RENDER CORE (MATCHING SPHERE/PARTICLE SYSTEM)
      const timeSec = now * 0.001;
      
      const renderCore = (ctx, x, y, baseRadius, alpha) => {
        // Apply depth-based opacity (depthFactor = 1 for center)
        const depthOpacity = (0.6 + 0.4 * 1) * alpha;
        
        // Micro-pulse based on energy
        const pulsedRadius = baseRadius + (coreEnergy.current * 0.02);
        
        // Subtle jitter to remove "UI sharpness"
        const jitter = Math.sin(timeSec * 4) * 0.5;
        const finalRadius = Math.max(0, pulsedRadius + jitter);

        ctx.save();
        ctx.globalAlpha = depthOpacity;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Layer 1: Outer Density Layer (Slightly dim)
       

        // Layer 2: Inner Compressed Core
        ctx.beginPath();
        ctx.globalAlpha = depthOpacity;
        ctx.arc(x, y, finalRadius, 0, Math.PI * 2);
        ctx.fill();

        // Crisp definition stroke
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${depthOpacity * 0.8})`;
        ctx.stroke();
        
        ctx.restore();
      };

      // Visible during FLOW as a small seed, then full animation
      if (phaseRef.current === 'FLOW' && coreEnergy.current > 0) {
        renderCore(ctx, centerX, centerY, 2, 0.5);
      } else if (phaseRef.current === 'CORE_ANIMATION') {
        const DURATION = 700;
        const progress = Math.min(1, timerRef.current / DURATION);
        const PEAK = 20;
        let animRadius = 0;

        if (progress < 0.3) {
          const p = progress / 0.3;
          const e = 1 - Math.pow(1 - p, 3);
          animRadius = PEAK * e;
        } else if (progress < 0.6) {
          const p = (progress - 0.3) / 0.3;
          animRadius = PEAK + p * 2;
        } else {
          const p = (progress - 0.6) / 0.4;
          const e = p * p * p;
          animRadius = (PEAK + 2) * (1 - e);
        }

        const animOpacity = animRadius / (PEAK + 2);
        if (animOpacity > 0.05) {
          renderCore(ctx, centerX, centerY, animRadius, animOpacity);
        }
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        background: 'transparent'
      }}
    />
  );
};

export default NumericSphereBackground;