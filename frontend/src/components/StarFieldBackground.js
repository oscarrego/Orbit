import React, { useEffect, useRef } from 'react';

const StarFieldBackground = ({ targetCenter }) => {
  const canvasRef = useRef(null);
  const stars = useRef([]);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const STAR_COUNT = 150;
    const VACUUM_FORCE = 0.4;
    const SWIRL_STRENGTH = 0.05;
    const MIN_SPEED = 0.5;

    const createStar = (initial = false) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let x, y;
      if (initial) {
        x = Math.random() * width;
        y = Math.random() * height;
      } else {
        // Spawn from edges
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { x = Math.random() * width; y = -50; }
        else if (edge === 1) { x = width + 50; y = Math.random() * height; }
        else if (edge === 2) { x = Math.random() * width; y = height + 50; }
        else { x = -50; y = Math.random() * height; }
      }

      return {
        x,
        y,
        vx: (Math.random() - 0.5) * MIN_SPEED,
        vy: (Math.random() - 0.5) * MIN_SPEED,
        opacity: 0
      };
    };

    const initStars = () => {
      stars.current = Array.from({ length: STAR_COUNT }, () => createStar(true));
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();
    initStars();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!targetCenter) {
        animationFrameId.current = requestAnimationFrame(animate);
        return;
      }

      stars.current.forEach((s, i) => {
        const dx = targetCenter.x - s.x;
        const dy = targetCenter.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
          stars.current[i] = createStar();
          return;
        }

        // Physics
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Intensity of pull increases as it gets closer
        const pull = Math.min(VACUUM_FORCE, 1000 / (dist * dist + 100));
        
        s.vx += nx * pull;
        s.vy += ny * pull;

        // Swirl
        s.vx += -ny * SWIRL_STRENGTH;
        s.vy += nx * SWIRL_STRENGTH;

        // Friction
        s.vx *= 0.98;
        s.vy *= 0.98;

        s.x += s.vx;
        s.y += s.vy;

        // Draw
        s.opacity = Math.min(0.4, s.opacity + 0.01);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;

        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

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
