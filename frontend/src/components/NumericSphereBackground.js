import React, { useEffect, useRef } from 'react';

const NumericSphereBackground = ({ onAbsorb }) => {
  const canvasRef = useRef(null);
  const sphereParticles = useRef([]);
  const rotation = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const SPHERE_COUNT = 400;
    const PERSPECTIVE = 450;

    const getDynamicRadius = () => Math.min(canvas.width, canvas.height) * 0.35;

    const initSphere = () => {
      sphereParticles.current = [];
      const radius = getDynamicRadius();
      
      for (let i = 0; i < SPHERE_COUNT; i++) {
        // Uniform spherical distribution to ensure NO clustering
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

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      initSphere();
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = getDynamicRadius();

      // APPLY ROTATION
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

      // FONT + STYLE & DEPTH EFFECT
      projected.forEach(p => {
        // Map z' from -radius (front) -> radius (back) to 0 -> 1
        let normalizedZ = (p.zPrime + radius) / (2 * radius);
        normalizedZ = Math.max(0, Math.min(1, normalizedZ));
        
        // Front (0) = opacity 1, Back (1) = opacity 0.2
        const opacity = 1 - (normalizedZ * 0.8);
        
        // Front (0) = 14px, Back (1) = 8px
        const size = 14 - (normalizedZ * 6);

        ctx.font = `${size}px monospace`;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillText(p.value, p.screenX, p.screenY);
      });

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
        position: 'absolute',
        top: 0,
        left: 0,
        background: 'transparent'
      }}
    />
  );
};

export default NumericSphereBackground;
