import React, { useEffect, useRef } from 'react';

const NumericSphereBackground = () => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const vacuumParticles = useRef([]);
  const coreRadius = useRef(20);
  const targetCoreRadius = useRef(20);
  const rotationAngle = useRef(0);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const sphereParticleCount = 700;
    const vacuumParticleCount = 100;

    const getSphereRadius = () => Math.min(canvas.width, canvas.height) * 0.42;

    const initParticles = () => {
      particles.current = [];
      const currentRadius = getSphereRadius();
      // 1. Initialize Sphere Particles
      for (let i = 0; i < sphereParticleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / sphereParticleCount);
        const theta = Math.sqrt(sphereParticleCount * Math.PI) * phi;

        particles.current.push({
          phi,
          theta,
          digit: Math.floor(Math.random() * 10).toString(),
          size: Math.random() * 2 + 1,
          baseOpacity: Math.random() * 0.4 + 0.3,
        });
      }

      // 2. Initialize Vacuum Particles
      vacuumParticles.current = [];
      for (let i = 0; i < vacuumParticleCount; i++) {
        vacuumParticles.current.push(createVacuumParticle(true));
      }
    };

    const createVacuumParticle = (randomStart = false) => {
      const currentRadius = getSphereRadius();
      const spawnRadius = randomStart 
        ? Math.random() * (currentRadius * 3) + currentRadius 
        : currentRadius * 3; 
      
      const phi = Math.acos(-1 + 2 * Math.random());
      const theta = Math.random() * Math.PI * 2;

      return {
        x: spawnRadius * Math.sin(phi) * Math.cos(theta),
        y: spawnRadius * Math.sin(phi) * Math.sin(theta),
        z: spawnRadius * Math.cos(phi),
        digit: Math.floor(Math.random() * 10).toString(),
        speed: Math.random() * 2 + 1,
        opacity: 0
      };
    };

    const resize = () => {
      // Use client dimensions to match the CSS-scaled container
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      initParticles();
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const currentRadius = getSphereRadius();

      rotationAngle.current += 0.003;

      // 1. Draw Core Energy
      coreRadius.current += (targetCoreRadius.current - coreRadius.current) * 0.1;
      if (targetCoreRadius.current > 20) targetCoreRadius.current -= 0.5;

      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius.current * 3);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.2, 'rgba(120, 160, 255, 0.4)');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius.current * 3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Animate and Draw Sphere Particles
      // Sort by Z for depth illusion
      const sphereRenderData = particles.current.map(p => {
        const rotatedTheta = p.theta + rotationAngle.current;
        const x = currentRadius * Math.sin(p.phi) * Math.cos(rotatedTheta);
        const y = currentRadius * Math.sin(p.phi) * Math.sin(rotatedTheta);
        const z = currentRadius * Math.cos(p.phi);
        return { ...p, x, y, z };
      }).sort((a, b) => a.z - b.z);

      sphereRenderData.forEach(p => {
        const scale = (p.z + currentRadius) / (2 * currentRadius);
        const px = centerX + p.x;
        const py = centerY + p.y;
        
        ctx.font = `${(p.size + scale * 4).toFixed(1)}px monospace`;
        ctx.fillStyle = `rgba(220, 235, 255, ${p.baseOpacity * (0.3 + 0.7 * scale)})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (scale > 0.8) {
          ctx.shadowBlur = 5;
          ctx.shadowColor = 'rgba(120, 160, 255, 0.5)';
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fillText(p.digit, px, py);
      });

      // 3. Animate and Draw Vacuum Particles
      vacuumParticles.current.forEach((p, i) => {
        const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        
        // Acceleration toward center
        const force = 12 / (dist * 0.01 + 1);
        const vx = (-p.x / dist) * (p.speed + force);
        const vy = (-p.y / dist) * (p.speed + force);
        const vz = (-p.z / dist) * (p.speed + force);

        p.x += vx;
        p.y += vy;
        p.z += vz;
        p.opacity = Math.min(p.opacity + 0.02, 0.6);

        if (dist < 20) {
          vacuumParticles.current[i] = createVacuumParticle();
          targetCoreRadius.current = 28; // Pulse core on absorption
        } else {
          const scale = 400 / (400 + p.z); // Simple perspective
          const px = centerX + p.x * scale;
          const py = centerY + p.y * scale;

          ctx.font = `${Math.max(2, 10 * scale)}px monospace`;
          ctx.fillStyle = `rgba(120, 160, 255, ${p.opacity * scale})`;
          ctx.fillText(p.digit, px, py);
        }
      });

      ctx.shadowBlur = 0;
      animationFrameId.current = requestAnimationFrame(animate);
    };

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
        display: 'block'
      }}
    />
  );
};

export default NumericSphereBackground;
