import React, { useEffect, useRef } from 'react';

const StarFieldBackground = ({ targetCenter }) => {
  const canvasRef = useRef(null);
  const stars = useRef([]);
  const coreEnergy = useRef(0);
  const isResetting = useRef(false);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const STAR_COUNT = 80;
    const BASE_SPHERE_RADIUS = 110;
    const SWIRL_STRENGTH = 0.03;
    const ABSORPTION_THRESHOLD = 8;

    const createStar = () => {
      const center = targetCenter && targetCenter.x !== 0 ? targetCenter : {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };

      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = BASE_SPHERE_RADIUS + 40 + Math.random() * 40;

      return {
        x: center.x + Math.cos(angle) * spawnRadius,
        y: center.y + Math.sin(angle) * spawnRadius,
        vx: 0.3 + Math.random() * 0.5, // Left to right flow
        vy: (Math.random() - 0.5) * 0.4,
        opacity: 0,
        active: true
      };
    };

    const initWave = () => {
      stars.current = Array.from({ length: STAR_COUNT }, () => createStar());
      isResetting.current = false;
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();
    initWave();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const center = targetCenter && targetCenter.x !== 0 ? targetCenter : {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };

      // Handle Wave Reset
      if (stars.current.length === 0 && !isResetting.current) {
        isResetting.current = true;
        setTimeout(() => {
          coreEnergy.current = 0;
          initWave();
        }, 600);
      }

      // Update and Draw Stars
      stars.current = stars.current.filter(s => {
        const dx = center.x - s.x;
        const dy = center.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ABSORPTION_THRESHOLD) {
          coreEnergy.current += 1.5;
          return false;
        }

        // Vacuum Force Calculation
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Force increases as distance decreases
        const force = Math.min(0.6, Math.max(0.05, 500 / (dist * dist + 10)));
        
        s.vx += nx * force;
        s.vy += ny * force;

        // Spiral Curve
        s.vx += -ny * SWIRL_STRENGTH;
        s.vy += nx * SWIRL_STRENGTH;

        // Apply velocities
        s.x += s.vx;
        s.y += s.vy;

        // Visuals
        s.opacity = Math.min(0.4, s.opacity + 0.02);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // Draw Glowing Core
      if (coreEnergy.current > 0) {
        const coreRadius = 2 + coreEnergy.current * 0.12;
        const gradient = ctx.createRadialGradient(
          center.x, center.y, 0,
          center.x, center.y, coreRadius * 2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(center.x, center.y, coreRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Decay core energy slightly for pulsing effect
        coreEnergy.current *= 0.98;
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [targetCenter]);

  return (
    <canvas
      ref={canvasRef}
      className="star-bg"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        display: 'block'
      }}
    />
  );
};

export default StarFieldBackground;
