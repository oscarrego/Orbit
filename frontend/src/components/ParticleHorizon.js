import React, { useEffect, useRef } from 'react';

const ParticleHorizon = () => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const sunPulse = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rows = 25;
    const cols = 40;
    const horizonY = window.innerHeight * 0.55;
    
    const initParticles = () => {
      particles.current = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          particles.current.push({
            xOffset: (c / (cols - 1) - 0.5) * 2.5, // Spacing from -1.25 to 1.25
            z: (r / rows), // Z position from 0 (horizon) to 1 (near viewer)
            speed: 0.0015 + Math.random() * 0.0005,
          });
        }
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('resize', resize);
    resize();

    let animationFrameId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height; // Vanishing point at bottom? No, horizon.
      const vPointX = centerX;
      const vPointY = horizonY;

      // Draw Sun
      sunPulse.current += 0.01;
      const pulse = Math.sin(sunPulse.current) * 5;
      const sunRadius = 60 + pulse;
      
      const sunGradient = ctx.createRadialGradient(vPointX, vPointY - 20, 0, vPointX, vPointY - 20, sunRadius * 2);
      sunGradient.addColorStop(0, 'rgba(255, 180, 50, 0.4)'); // Muted gold
      sunGradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.15)'); // Soft orange
      sunGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      
      ctx.fillStyle = sunGradient;
      ctx.beginPath();
      ctx.arc(vPointX, vPointY - 20, sunRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core Sun
      ctx.beginPath();
      ctx.arc(vPointX, vPointY - 20, sunRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
      ctx.fill();

      // Draw Particles
      particles.current.forEach((p) => {
        // Move forward
        p.z += p.speed;
        if (p.z > 1) {
          p.z = 0; // Loop back to horizon
        }

        // Perspective Calculation
        // x increases as it moves closer (z increases)
        // y moves down from horizon as it moves closer
        
        const perspectiveScale = p.z * p.z; // Exponential feel for depth
        const x = vPointX + (p.xOffset * canvas.width * perspectiveScale);
        const y = vPointY + (perspectiveScale * (canvas.height - vPointY));

        // Visual effects
        const opacity = p.z * 0.8; // Fades in from horizon
        const size = 0.5 + p.z * 1.5;

        // Fade out near bottom
        let finalOpacity = opacity;
        if (p.z > 0.8) {
          finalOpacity *= (1 - p.z) / 0.2;
        }

        if (x > 0 && x < canvas.width && y > vPointY && y < canvas.height) {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 210, 255, ${finalOpacity})`; // Soft bluish white
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
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
        zIndex: -1,
        pointerEvents: 'none',
        background: 'transparent'
      }}
    />
  );
};

export default ParticleHorizon;
