import React, { useState, useEffect, useRef } from 'react';
import './Login.css';

const SpaceParticles = () => {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: null, y: null });
  const prevMouse = useRef({ x: null, y: null });
  const mouseVelocity = useRef({ x: 0, y: 0 });
  const center = useRef({ x: null, y: null });
  const particles = useRef([]);
  const time = useRef(0);

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left;
    const newY = e.clientY - rect.top;

    if (mouse.current.x !== null) {
      prevMouse.current.x = mouse.current.x;
      prevMouse.current.y = mouse.current.y;
      mouseVelocity.current.x = newX - prevMouse.current.x;
      mouseVelocity.current.y = newY - prevMouse.current.y;
    } else {
      prevMouse.current.x = newX;
      prevMouse.current.y = newY;
    }

    mouse.current.x = newX;
    mouse.current.y = newY;
  };

  const handleMouseLeave = () => {
    if (!canvasRef.current) return;
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
      if (center.current.x === null || isNaN(center.current.x)) {
        center.current.x = canvas.width / 2;
        center.current.y = canvas.height / 2;
      }
      initParticles();
    };

    const initParticles = () => {
      particles.current = [];
      const numParticles = 350; // Low/medium density, airy
      const maxRadius = Math.min(canvas.width, canvas.height) * 0.45; // Must stay within viewport
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      
      for (let i = 0; i < numParticles; i++) {
        const distRatio = Math.sqrt(i / (numParticles - 1));
        const angle = i * goldenRatio * Math.PI * 2;
        const baseRadius = distRatio * maxRadius;
        
        particles.current.push({
          angle,
          distRatio,
          baseRadius,
          driftAngleX: Math.random() * Math.PI * 2,
          driftAngleY: Math.random() * Math.PI * 2,
          driftSpeedX: Math.random() * 0.002 + 0.0005,
          driftSpeedY: Math.random() * 0.002 + 0.0005,
          driftAmplitude: Math.random() * 12 + 4,
          sizeModifier: Math.random() * 0.4 + 0.8,
          lagFactor: Math.random() * 0.15 + 0.05, // Individual random lag to prevent rigid movement
          flowOffsetX: 0,
          flowOffsetY: 0,
        });
      }
    };

    window.addEventListener("resize", resize);
    resize();

    let animationFrameId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time.current += 0.0065; // Slightly faster breathing (~30% increase)

      // Decay mouse velocity to smooth out the flow
      mouseVelocity.current.x *= 0.92;
      mouseVelocity.current.y *= 0.92;

      if (mouse.current.x !== null && mouse.current.y !== null) {
        // Center follows very slightly, but not fully attached
        center.current.x += (mouse.current.x - center.current.x) * 0.015;
        center.current.y += (mouse.current.y - center.current.y) * 0.015;
      } else {
        // Slowly return to middle when mouse leaves
        center.current.x += (canvas.width / 2 - center.current.x) * 0.01;
        center.current.y += (canvas.height / 2 - center.current.y) * 0.01;
      }

      particles.current.forEach((p) => {
        p.driftAngleX += p.driftSpeedX;
        p.driftAngleY += p.driftSpeedY;
        
        const driftX = Math.cos(p.driftAngleX) * p.driftAmplitude;
        const driftY = Math.sin(p.driftAngleY) * p.driftAmplitude;

        const breathAmplitude = 18 + p.distRatio * 12;
        const radius = p.baseRadius + Math.sin(time.current * 1.5) * breathAmplitude;
        
        // Target base position on the breathing sphere
        let targetX = center.current.x + Math.cos(p.angle) * radius + driftX;
        let targetY = center.current.y + Math.sin(p.angle) * radius + driftY;

        // Apply directional flow (space consumption)
        if (Math.abs(mouseVelocity.current.x) > 0.1 || Math.abs(mouseVelocity.current.y) > 0.1) {
          // Particles move in the direction of the mouse, but at different speeds (lag)
          // This naturally pushes particles away in front of the cursor and pulls them in from behind
          p.flowOffsetX += mouseVelocity.current.x * p.lagFactor;
          p.flowOffsetY += mouseVelocity.current.y * p.lagFactor;
        }

        // Slowly decay the flow offset back to the base sphere shape
        p.flowOffsetX *= 0.95;
        p.flowOffsetY *= 0.95;

        let px = targetX + p.flowOffsetX;
        let py = targetY + p.flowOffsetY;

        // Clamp positions strictly inside viewport bounds
        const padding = 6;
        if (px < padding) px = padding;
        if (px > canvas.width - padding) px = canvas.width - padding;
        if (py < padding) py = padding;
        if (py > canvas.height - padding) py = canvas.height - padding;

        let baseSize = (1.8 - p.distRatio * 1.0) * p.sizeModifier;
        let baseOpacity = 0.65 - p.distRatio * 0.45;

        if (mouse.current.x !== null && mouse.current.y !== null) {
          const dx = px - mouse.current.x;
          const dy = py - mouse.current.y;
          const distToMouse = Math.sqrt(dx * dx + dy * dy);
          const emptyRadius = 130; // Clear void around cursor

          if (distToMouse < emptyRadius) {
            baseOpacity = 0; // Empty void inside radius
          } else if (distToMouse < emptyRadius + 100) {
            const fade = (distToMouse - emptyRadius) / 100;
            baseOpacity *= fade;
            
            // Very subtle outward displacement near the void boundary
            const force = (1 - fade) * 8;
            px += (dx / distToMouse) * force;
            py += (dy / distToMouse) * force;
          }
        }

        if (baseOpacity > 0.01) {
          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.1, baseSize), 0, Math.PI * 2);
          
          ctx.fillStyle = `rgba(220, 235, 255, ${baseOpacity})`;
          
          if (p.distRatio < 0.2) {
            ctx.shadowBlur = baseSize * 2;
            ctx.shadowColor = `rgba(220, 235, 255, ${baseOpacity * 0.5})`;
          } else {
            ctx.shadowBlur = 0;
          }
          
          ctx.fill();
          ctx.shadowBlur = 0;
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
  const [errors, setErrors] = useState({});
  const [isAnimating, setIsAnimating] = useState(false);

  const validate = (name, value) => {
    let error = '';
    const trimmed = value.trim();

    if (name === 'username') {
      if (!trimmed) {
        error = 'Name is required';
      } else if (trimmed.length < 2 || trimmed.length > 20) {
        error = 'Name must be 2–20 characters';
      } else {
        const forbidden = ['admin', 'moderator', 'system', 'root', 'fuck', 'shit', 'ass', 'bitch'];
        if (forbidden.some(word => trimmed.toLowerCase().includes(word))) {
          error = 'Please choose an appropriate name';
        }
      }
    }

    if (name === 'roomId') {
      const roomRegex = /^[a-zA-Z0-9 ]*$/;
      if (!roomRegex.test(value)) {
        error = 'Only letters, numbers, and spaces allowed';
      }
    }

    setErrors(prev => ({
      ...prev,
      [name]: error
    }));

    return !error;
  };

  const handleBlur = (e) => {
    validate(e.target.name, e.target.value);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'username') setUsername(value);
    if (name === 'roomId') setRoomId(value);

    // Clear error while typing if it becomes valid
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isAnimating) return;

    const isUsernameValid = validate('username', username);
    const isRoomIdValid = validate('roomId', roomId);

    if (isUsernameValid && isRoomIdValid) {
      setIsAnimating(true);
      setTimeout(() => {
        onLogin(username.trim(), roomId.trim() || 'Global');
      }, 500); // Wait for energy transfer animation to complete
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
            <div className="orbit-logo-container">
              <div className="logo-halo"></div>
              <div className="logo-core"></div>
              <div className="orbit-ring ring-alpha">
                <div className="orbit-node node-alpha"></div>
              </div>
              <div className="orbit-ring ring-beta">
                <div className="orbit-node node-beta"></div>
              </div>
              <div className="orbit-ring ring-gamma"></div>
            </div>
            <h1 className="form-title">Orbit</h1>
          </div>

          <form onSubmit={handleSubmit} className="actual-form">
            <div className={`input-group ${errors.username ? 'has-error' : ''}`}>
              <label className="input-label">Your name</label>
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="off"
                required
              />
              {errors.username && <span className="error-text">{errors.username}</span>}
            </div>

            <div className={`input-group ${errors.roomId ? 'has-error' : ''}`}>
              <label className="input-label">Room</label>
              <input
                type="text"
                name="roomId"
                placeholder="e.g. Global"
                value={roomId}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="off"
              />
              {errors.roomId && <span className="error-text">{errors.roomId}</span>}
            </div>

            <button type="submit" className={`signin-button ${isAnimating ? 'animating' : ''}`}>
              <span className="button-text">Launch Orbit</span>
              {isAnimating && (
                <div className="energy-transfer-container">
                  <div className="energy-streak-line"></div>
                  <div className="streak-head"></div>
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

