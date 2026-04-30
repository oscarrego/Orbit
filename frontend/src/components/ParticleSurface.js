import React, { useEffect, useRef } from 'react';

const ParticleSurface = () => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const rotation = useRef(0);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const initSurface = () => {
      // u: length/horizontal flow (0 to 1)
      // v: thickness/cross-section (-1 to 1)
      const particleCount = 5000;
      particles.current = [];

      for (let i = 0; i < particleCount; i++) {
        const u = Math.random();
        
        // Probability Falloff for v:
        // Use power function to cluster points toward the center (v=0)
        // This creates the volumetric "ridge" without a hard line
        const vRaw = Math.random() * 2 - 1;
        const v = Math.pow(vRaw, 3); 

        // Initial variation
        particles.current.push({
          u,
          v,
          vRaw,
          zOffset: Math.random() * 200 - 100, // Depth variation
          sizeBase: 0.5 + Math.random() * 1.5,
          opacityBase: 0.1 + Math.random() * 0.3,
          brightness: 0.8 + Math.random() * 0.4,
          driftOffset: Math.random() * 1000
        });
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initSurface();
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width * 0.5;
      const centerY = height * 0.5;

      // Slow rotation and drift
      rotation.current += 0.0002;
      const drift = rotation.current * 0.1;

      // Volumetric Surface Parameters
      const curveScale = 1.5;
      const amplitude = height * 0.45;
      const thickness = 220;
      const surfaceWidth = width * 1.6;

      // Calculate particles and sort by depth for realism
      const frameParticles = particles.current.map(p => {
        // 1. Volumetric Parametric Positioning
        const u = (p.u + drift) % 1.0;
        const uPos = (u - 0.5) * surfaceWidth;
        
        // Sine-based curvature as requested
        const sinVal = Math.sin(u * curveScale + rotation.current);
        const curveOffset = sinVal * amplitude;
        
        // Depth simulation (z affects projection)
        const z = Math.cos(u * curveScale + rotation.current) * 150 + p.zOffset;
        const depthScale = (z + 250) / 400; // 0.25 to 1.0 approx

        // Local Y with thickness spread
        let yLocal = curveOffset + (p.v * thickness);
        
        // Perspective Squash (slightly squash vertically)
        yLocal *= 0.6;

        // Diagonal Alignment Tilt
        const tiltAngle = -Math.PI / 6;
        const cosT = Math.cos(tiltAngle);
        const sinT = Math.sin(tiltAngle);
        
        const xRot = uPos * cosT - yLocal * sinT;
        const yRot = uPos * sinT + yLocal * cosT;

        // Screen projection
        const x = centerX + xRot;
        const y = centerY + yRot;

        // Edge Fade: reduce opacity based on distance from center ridge (vRaw)
        const centerEdgeFade = 1 - Math.pow(Math.abs(p.vRaw), 2);
        
        return {
          x,
          y,
          z,
          size: p.sizeBase * depthScale,
          opacity: p.opacityBase * depthScale * centerEdgeFade * p.brightness,
          depthScale
        };
      });

      // Sort by depth (back to front)
      frameParticles.sort((a, b) => a.z - b.z);

      // Render Loop
      frameParticles.forEach(p => {
        if (p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) return;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        // Soft monochrome variation
        const alpha = Math.min(p.opacity * 1.2, 1);
        ctx.fillStyle = `rgba(240, 240, 255, ${alpha})`;
        
        // Subtle depth glow for front particles
        if (p.depthScale > 0.8) {
          ctx.shadowBlur = p.size * 3;
          ctx.shadowColor = `rgba(255, 255, 255, ${alpha * 0.5})`;
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fill();
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
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9, // Behind login card (10) but above base backgrounds
        pointerEvents: 'none',
        background: 'transparent'
      }}
    />
  );
};

export default ParticleSurface;
