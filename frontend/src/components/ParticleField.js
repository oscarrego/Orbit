import React, { useEffect, useRef } from 'react';

const ParticleField = () => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const mouse = useRef({ x: -1000, y: -1000 });
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const initField = () => {
      particles.current = [];
      const width = canvas.width;
      const height = canvas.height;
      
      // Structured distribution (jittered grid)
      // This ensures particles are distributed across the screen without random chaos
      const spacing = 48; 
      const jitter = 24;

      for (let x = 0; x < width + spacing; x += spacing) {
        for (let y = 0; y < height + spacing; y += spacing) {
          const px = x + (Math.random() - 0.5) * jitter;
          const py = y + (Math.random() - 0.5) * jitter;
          
          particles.current.push({
            x: px,
            y: py,
            ox: px, // original x for spring return
            oy: py, // original y for spring return
            vx: 0,
            vy: 0,
            size: 1 + Math.random() * 0.8,
            opacity: 0.15 + Math.random() * 0.25,
            color: 'rgba(240, 245, 255,',
          });
        }
      }
    };

    const handleMouseMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initField();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const radius = 180;        // Repulsion radius
      const smallRadius = 50;    // Radius for scale/opacity fade
      const repulsionStrength = 0.8;
      const springFactor = 0.04; // How fast particles return
      const friction = 0.85;     // Smooth movement damping

      particles.current.forEach(p => {
        const dx = p.x - mouse.current.x;
        const dy = p.y - mouse.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 1. Repulsion Logic
        if (distance < radius) {
          const force = (radius - distance) / radius;
          const angle = Math.atan2(dy, dx);
          
          // Apply acceleration
          p.vx += Math.cos(angle) * force * repulsionStrength;
          p.vy += Math.sin(angle) * force * repulsionStrength;
        }

        // 2. Spring Logic (return to original position)
        const sx = (p.ox - p.x) * springFactor;
        const sy = (p.oy - p.y) * springFactor;
        
        p.vx += sx;
        p.vy += sy;

        // 3. Apply Friction and Update Position
        p.vx *= friction;
        p.vy *= friction;
        p.x += p.vx;
        p.y += p.vy;

        // 4. Near Cursor Visual Effect
        let currentSize = p.size;
        let currentOpacity = p.opacity;

        if (distance < smallRadius) {
          const scale = distance / smallRadius;
          currentSize *= Math.max(scale, 0.2);
          currentOpacity *= scale;
        }

        // 5. Render
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${currentOpacity})`;
        ctx.fill();
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9, // Behind login card (10)
        pointerEvents: 'none',
        background: 'transparent'
      }}
    />
  );
};

export default ParticleField;
