import React, { useEffect, useRef } from 'react';

const ParticleRing = ({ isWarping }) => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animationFrameId = useRef(null);
  const rotation = useRef(0);
  const warpFactor = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const initParticles = () => {
      const particleCount = 1400; // Total particles
      particles.current = [];
      
      // 1. Ring Particles
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const baseRadius = Math.max(window.innerWidth, window.innerHeight) * 1.2;
        const offsetRange = 400;
        const offset = Math.pow(Math.random() * 2 - 1, 3) * offsetRange;
        
        const isRidge = Math.random() > 0.85;
        const ridgeOffset = isRidge ? (Math.random() - 0.5) * 15 : offset;

        particles.current.push({
          angle,
          radius: baseRadius + (isRidge ? ridgeOffset : offset),
          size: isRidge ? Math.random() * 1.2 + 0.8 : Math.random() * 0.6 + 0.2,
          isRidge,
          opacity: isRidge ? Math.random() * 0.4 + 0.4 : Math.random() * 0.2 + 0.1,
          z: Math.random() * 2 - 1,
          type: 'ring'
        });
      }

      // 2. Background Stars
      for (let i = 0; i < 200; i++) {
        particles.current.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 0.8 + 0.1,
          opacity: Math.random() * 0.15 + 0.05,
          type: 'star'
        });
      }
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
      
      // Smoothly transition warp factor (0 to 1)
      if (isWarping) {
        warpFactor.current += (1 - warpFactor.current) * 0.08;
      } else {
        warpFactor.current += (0 - warpFactor.current) * 0.04;
      }

      const centerX = canvas.width * 1.1;
      const centerY = -canvas.height * 0.2;
      
      // Speed up slightly during warp
      rotation.current += 0.0002 + (warpFactor.current * 0.0008);

      const ringParticles = particles.current.filter(p => p.type === 'ring');
      const stars = particles.current.filter(p => p.type === 'star');

      // 1. Background Stars
      stars.forEach(s => {
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // 2. Depth Sort
      ringParticles.sort((a, b) => a.z - b.z);

      // 3. Ring Particles
      ringParticles.forEach(p => {
        const currentAngle = p.angle + rotation.current;
        let x = Math.cos(currentAngle) * p.radius;
        let y = Math.sin(currentAngle) * p.radius;
        
        const tiltAngle = Math.PI / 3.2; 
        const xTilted = x * Math.cos(tiltAngle) - y * Math.sin(tiltAngle);
        const yTilted = (x * Math.sin(tiltAngle) + y * Math.cos(tiltAngle)) * 0.3;

        const finalX = centerX + xTilted;
        const finalY = centerY + yTilted;

        const depthFactor = (Math.sin(currentAngle + tiltAngle) + 1) / 2;
        const size = p.size * (0.7 + depthFactor * 0.3);
        
        // Increase opacity and brightness during warp
        const baseOpacity = p.opacity * (0.15 + depthFactor * 0.85);
        const opacity = baseOpacity * (1 + warpFactor.current * 0.6);

        if (finalX > -100 && finalX < canvas.width + 100 && finalY > -100 && finalY < canvas.height + 100) {
          ctx.beginPath();
          ctx.arc(finalX, finalY, size, 0, Math.PI * 2);
          
          if (p.isRidge) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(opacity * 1.5, 1)})`;
            ctx.shadowBlur = size * (8 + warpFactor.current * 12);
            ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
          } else {
            ctx.fillStyle = `rgba(240, 240, 255, ${Math.min(opacity, 1)})`;
            ctx.shadowBlur = 0;
          }
          ctx.fill();
        }
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [isWarping]); // Re-run effect when isWarping changes to ensure animate has latest state

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
        background: '#020205'
      }}
    />
  );
};

export default ParticleRing;
