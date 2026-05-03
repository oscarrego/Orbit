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
  const lastTimeRef = useRef(Date.now());
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
      const now = Date.now();
      const dt = Math.min(now - lastTimeRef.current, 50); // cap delta time to 50ms to avoid huge jumps
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
        }
      } else if (phaseRef.current === 'SPAWN') {
        vacuumParticles.current = [];
        for (let i = 0; i < MAX_PARTICLES; i++) {
          vacuumParticles.current.push(spawnParticle(centerX, centerY, radius));
        }
        coreEnergy.current = 0;
        phaseRef.current = 'FLOW';
      } else if (phaseRef.current === 'FLOW') {
        if (vacuumParticles.current.length === 0) {
          phaseRef.current = 'COLLAPSE';
          timerRef.current = 0;
        }
      } else if (phaseRef.current === 'COLLAPSE') {
        timerRef.current += dt;
        if (timerRef.current >= 1000) { // 1 second collapse
          phaseRef.current = 'WAIT';
          timerRef.current = 0;
        }
      }

      // 1. RENDER BACKGROUND PARTICLES (Draw First)
      if (phaseRef.current === 'FLOW') {
        for (let i = vacuumParticles.current.length - 1; i >= 0; i--) {
          const p = vacuumParticles.current[i];
          
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Absorption
          if (dist < 8) {
            vacuumParticles.current.splice(i, 1);
            coreEnergy.current += 1;
            continue;
          }

          const nx = dx / dist;
          const ny = dy / dist;

          // distance-based pull (clamp between 0.05 and 0.6)
          let pull = 0.05 + Math.max(0, 1 - dist / (radius + 80)) * 0.55; 
          
          p.vx += nx * pull;
          p.vy += ny * pull;

          // swirl (curve motion)
          p.vx += -ny * 0.03;
          p.vy += nx * 0.03;

          // damping
          p.vx *= 0.98;
          p.vy *= 0.98;

          p.x += p.vx;
          p.y += p.vy;

          // Opacity mapping (far -> faint, near -> brighter)
          let normDist = Math.min(dist / (radius + 80), 1);
          const targetOpacity = 0.1 + (1 - normDist) * 0.5;
          // Fade in from 0
          p.opacity += (targetOpacity - p.opacity) * 0.1;

          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // APPLY ROTATION FOR SPHERE
      rotation.current.y += 0.005;
      rotation.current.x = 0.15; // slight X axis tilt

      const angleY = rotation.current.y;
      const angleX = rotation.current.x;
      
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const projected = sphereParticles.current.map(p => {
        // rotate around Y axis
        const xPrime = p.x * cosY - p.z * sinY;
        const zPrime = p.x * sinY + p.z * cosY;

        // rotate slightly on X axis for tilt
        const yPrime = p.y * cosX - zPrime * sinX;
        const zPrimeFinal = p.y * sinX + zPrime * cosX;

        // PERSPECTIVE PROJECTION
        const scale = PERSPECTIVE / (PERSPECTIVE + zPrimeFinal);
        const screenX = centerX + xPrime * scale;
        const screenY = centerY + yPrime * scale;

        return {
          ...p,
          screenX,
          screenY,
          zPrime: zPrimeFinal
        };
      });

      // SORT BY DEPTH (back -> front)
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
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 25, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 4. RENDER CORE GLOW
      let currentCoreRadius = 0;
      let coreOpacity = 0;
      const BASE_CORE_RADIUS = 8;
      const MAX_CORE_RADIUS = BASE_CORE_RADIUS + MAX_PARTICLES * 0.3;

      if (phaseRef.current === 'FLOW' || phaseRef.current === 'SPAWN') {
        currentCoreRadius = BASE_CORE_RADIUS + coreEnergy.current * 0.3;
        coreOpacity = 0.2 + (coreEnergy.current / MAX_PARTICLES) * 0.8;
      } else if (phaseRef.current === 'COLLAPSE') {
        const t = timerRef.current;
        if (t < 300) {
          const progress = t / 300;
          const easeOut = 1 - Math.pow(1 - progress, 3);
          currentCoreRadius = MAX_CORE_RADIUS + easeOut * 15; // expands
          coreOpacity = 1;
        } else {
          const progress = Math.min(1, (t - 300) / 700);
          const easeIn = progress * progress * progress; // shrinks fast
          currentCoreRadius = (MAX_CORE_RADIUS + 15) * (1 - easeIn);
          coreOpacity = 1 - progress;
        }
      } else if (phaseRef.current === 'WAIT') {
        // Core disappears entirely as per phase 8
        currentCoreRadius = 0;
        coreOpacity = 0;
      }

      if (currentCoreRadius > 0 && coreOpacity > 0) {
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, currentCoreRadius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${coreOpacity})`);
        gradient.addColorStop(0.2, `rgba(255, 255, 255, ${coreOpacity * 0.8})`);
        gradient.addColorStop(0.6, `rgba(255, 255, 255, ${coreOpacity * 0.2})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentCoreRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = Date.now();
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