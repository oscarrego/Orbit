import React, { useEffect, useRef } from 'react';

const NumericSphereBackground = ({ onAbsorb }) => {
  const canvasRef = useRef(null);
  const sphereParticles = useRef([]);
  const rotation = useRef({ x: 0, y: 0 });
  const corePulse = useRef(0);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const SPHERE_COUNT = 250;
    const PERSPECTIVE = 450;
    const BASE_CORE_RADIUS = 3;
    const BASE_FONT_SIZE = 16;

    const getDynamicRadius = () => Math.min(canvas.width, canvas.height) * 0.35 ;

    const initSphere = () => {
      sphereParticles.current = [];
      const radius = getDynamicRadius();
      
      for (let i = 0; i < SPHERE_COUNT; i++) {
        const phi = Math.acos(-1 + (2 * i) / SPHERE_COUNT) + (Math.random() - 0.5) * 0.05;
        const theta = (Math.sqrt(SPHERE_COUNT * Math.PI) * phi) + (Math.random() * 0.2);

        sphereParticles.current.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi),
          digit: Math.floor(Math.random() * 10).toString()
        });
      }
    };

    const rotateX = (p, angle) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const y = p.y * cos - p.z * sin;
      const z = p.y * sin + p.z * cos;
      return { ...p, y, z };
    };

    const rotateY = (p, angle) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = p.x * cos + p.z * sin;
      const z = -p.x * sin + p.z * cos;
      return { ...p, x, z };
    };

    const project = (p, centerX, centerY) => {
      const scale = PERSPECTIVE / (PERSPECTIVE + p.z);
      return {
        x: centerX + p.x * scale,
        y: centerY + p.y * scale,
        scale
      };
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
      const sphereRadius = getDynamicRadius();
      const ringRadius = sphereRadius + 30;

      // Breathing animation for ring opacity
      const time = Date.now() * 0.001;
      const breathingAlpha = 0.315 + Math.sin(time * 2) * 0.035;

      // 1. Draw OUTER BOUNDARY RING
      const ringGradient = ctx.createLinearGradient(centerX, centerY - ringRadius, centerX, centerY + ringRadius);
      ringGradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * breathingAlpha})`);
      ringGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.5 * breathingAlpha})`);
      ringGradient.addColorStop(1, `rgba(255, 255, 255, ${0.15 * breathingAlpha})`);

      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = ringGradient;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 2. Update and Draw Sphere
      rotation.current.y += 0.004;
      rotation.current.x += 0.0015;

      const renderedSphere = sphereParticles.current.map(p => {
        let rotated = rotateY(p, rotation.current.y);
        rotated = rotateX(rotated, rotation.current.x);
        const projection = project(rotated, centerX, centerY);
        return { ...projection, z: rotated.z, digit: p.digit };
      });

      renderedSphere.sort((a, b) => b.z - a.z);

      renderedSphere.forEach(p => {
        const opacity = 0.2 + p.scale * 0.8;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (p.scale < 0.75) {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const fontSize = Math.max(6, BASE_FONT_SIZE * p.scale * 0.6);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.font = `${fontSize}px monospace`;
          ctx.fillText(p.digit, p.x, p.y);
        }
      });

      // 3. Draw Core
      const currentCoreRadius = BASE_CORE_RADIUS + (corePulse.current * 4);
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentCoreRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + corePulse.current * 0.5})`;
      ctx.fill();

      // Decay pulse
      corePulse.current *= 0.92;

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  // Expose pulse method via ref if needed, or we can use onAbsorb prop
  // For now let's just keep it simple. If we want the starfield to trigger a pulse, 
  // we might need a way to communicate back.

return (
  <canvas
    ref={canvasRef}
    style={{
      width: '100%',
      height: '100%',
      position: 'absolute',
      top: 0,
      left: 0
    }}
  />
);
};

export default NumericSphereBackground;
