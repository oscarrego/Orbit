import React, { useState, useEffect, useRef } from 'react';
import './Login.css';

const SpaceParticles = () => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const shootingStars = useRef([]);
  const mouse = useRef({ x: null, y: null });

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouse.current.x = e.clientX - rect.left;
    mouse.current.y = e.clientY - rect.top;
  };

  const handleMouseLeave = () => {
    mouse.current.x = null;
    mouse.current.y = null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initParticles();
    };

    const initParticles = () => {
      particles.current = [];
      const layers = [
        { count: 120, size: [0.4, 0.8], speed: 0.02, opacity: [0.1, 0.3] },
        { count: 60,  size: [0.8, 1.5], speed: 0.05, opacity: [0.3, 0.6] },
        { count: 25,  size: [1.5, 2.5], speed: 0.12, opacity: [0.6, 0.9] }
      ];

      layers.forEach(layer => {
        for (let i = 0; i < layer.count; i++) {
          particles.current.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * (layer.size[1] - layer.size[0]) + layer.size[0],
            vx: (Math.random() - 0.5) * layer.speed,
            vy: (Math.random() - 0.5) * layer.speed,
            opacity: Math.random() * (layer.opacity[1] - layer.opacity[0]) + layer.opacity[0],
            twinkleSpeed: Math.random() * 0.005 + 0.002,
            layerSpeed: layer.speed,
            color: `rgba(200, 220, 255,`
          });
        }
      });
    };

    const spawnShootingStar = () => {
      if (Math.random() > 0.998) {
        shootingStars.current.push({
          x: Math.random() * (canvas.width * 0.5),
          y: Math.random() * (canvas.height * 0.5),
          len: Math.random() * 120 + 80,
          speed: Math.random() * 12 + 8,
          opacity: 1,
        });
      }
    };

    window.addEventListener("resize", resize);
    resize();

    let animationFrameId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        if (mouse.current.x !== null) {
          const dx = p.x - mouse.current.x;
          const dy = p.y - mouse.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 150;

          if (dist < maxDist) {
            const force = (maxDist - dist) / maxDist;
            p.x += (dx / dist) * force * (p.layerSpeed * 10);
            p.y += (dy / dist) * force * (p.layerSpeed * 10);
          }
        }

        p.opacity += p.twinkleSpeed;
        if (p.opacity > 0.9 || p.opacity < 0.1) p.twinkleSpeed *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.opacity})`;
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = "rgba(180, 200, 255, 0.8)";
        ctx.fill();
        ctx.shadowBlur = 0; 
      });

      spawnShootingStar();
      shootingStars.current.forEach((s, index) => {
        s.x += s.speed;
        s.y += s.speed * 0.5;
        s.opacity -= 0.015;

        if (s.opacity <= 0) {
          shootingStars.current.splice(index, 1);
        } else {
          ctx.save();
          const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.len, s.y - s.len * 0.5);
          grad.addColorStop(0, `rgba(255, 255, 255, ${s.opacity})`);
          grad.addColorStop(0.2, `rgba(180, 210, 255, ${s.opacity * 0.5})`);
          grad.addColorStop(1, "rgba(180, 210, 255, 0)");
          
          ctx.beginPath();
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          ctx.shadowBlur = 10;
          ctx.shadowColor = "rgba(180, 210, 255, 0.8)";
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.len, s.y - s.len * 0.5);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
          ctx.arc(s.x, s.y, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="space-particles-canvas"
    />
  );
};

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim(), roomId.trim());
    }
  };

  return (
    <div className="login-page">
      {/* Background Depth Layers */}
      <div className="bg-animation">
        <SpaceParticles />
      </div>
      <div className="vignette"></div>
      <div className="mica-overlay"></div>
      <div className="bg-glow"></div>
      <div className="noise-texture"></div>

      <div className="login-card">
        <div className="form-content">
          <div className="brand-header">
            <div className="orbit-logo">
              <div className="center-dot"></div>
              <div className="orbit-ring ring-1">
                <div className="satellite"></div>
              </div>
              <div className="orbit-ring ring-2"></div>
            </div>
            <h1 className="form-title">Orbit</h1>
          </div>

          <form onSubmit={handleSubmit} className="actual-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="signin-button">
              Launch Orbit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

