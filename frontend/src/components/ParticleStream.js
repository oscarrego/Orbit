import React, { useEffect, useRef } from 'react';

const ParticleStream = ({ isWarping }) => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animationFrameId = useRef(null);
  const colors = ['#818cf8', '#a5b4fc', '#c7d2fe', '#ddd6fe', '#8b5cf6']; // Blue to Violet

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const createParticle = (isInitial = false) => {
      const z = Math.random(); // Depth factor (0 = far, 1 = near)
      
      // Stream path parameters
      const t = isInitial ? Math.random() : -0.1; 
      
      // Non-linear offset for dense center, sparse edges
      const rawOffset = Math.pow(Math.random() - 0.5, 3) * 8; // Cubic distribution
      
      return {
        t,
        z,
        offset: rawOffset * 200 * (1 + (1 - z)), 
        speed: (0.002 + Math.random() * 0.003) * (0.5 + z * 1.5), 
        size: (0.5 + z * 2.5), 
        opacity: (0.2 + z * 0.6), 
        color: colors[Math.floor(Math.random() * colors.length)],
        curveSeed: Math.random() * Math.PI * 2
      };
    };

    const initParticles = () => {
      particles.current = Array.from({ length: 400 }, () => createParticle(true));
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;

      particles.current.forEach((p, i) => {
        // Update progress along the stream
        const currentSpeed = isWarping ? p.speed * 4 : p.speed;
        p.t += currentSpeed;

        // Curve logic: a soft S-curve diagonal
        // x: 0 -> width, y: height -> 0
        const xBase = p.t * width * 1.2 - width * 0.1;
        const yBase = height - (p.t * height * 1.2 - height * 0.1);
        
        // Add subtle curve/wave
        const curve = Math.sin(p.t * 3 + p.curveSeed) * 30;
        
        // Final position with offset (stream thickness)
        // Offset should be perpendicular-ish to diagonal
        const x = xBase + p.offset + curve;
        const y = yBase + p.offset + curve;

        // Draw particle
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        
        // Add subtle glow for "closer" particles
        if (p.z > 0.7) {
          ctx.shadowBlur = p.size * 2;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fill();

        // Respawn
        if (p.t > 1.1) {
          particles.current[i] = createParticle();
        }
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [isWarping]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
        background: 'radial-gradient(circle at center, #0a0a1a 0%, #020205 100%)'
      }}
    />
  );
};

export default ParticleStream;
