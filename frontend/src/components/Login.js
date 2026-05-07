import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, Sphere, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import Lenis from 'lenis';
import { Globe2, Activity, ShieldAlert, Crosshair, Fingerprint, MapPin, RadioReceiver, Network, UserPlus } from 'lucide-react';
import './Login.css';

// --- GLOBAL SCROLL STATE FOR 3D ---
const scrollState = { current: 0 };

// --- 3D COMPONENTS ---

const DigitalEarth = () => {
  const earthRef = useRef();
  const wireframeRef = useRef();
  const ringRef = useRef();
  const pulseRef = useRef();

  const uniforms = useMemo(() => ({
    time: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    const p = scrollState.current; // 0 to 1 over entire page
    uniforms.time.value = state.clock.elapsedTime;
    
    const rotSpeed = 0.05 + (p * 0.1); 
    
    // Determine target positions based on scroll sections (5 sections roughly 0.2 each)
    let targetX = 0, targetY = 0, targetZ = 0, targetTilt = 0;
    let isSOS = false;
    let isNearby = false;

    if (p < 0.2) {
      // Sec 1: Hero
      targetX = 0; targetY = 0; targetZ = 0; targetTilt = p * Math.PI * 0.2;
    } else if (p >= 0.2 && p < 0.4) {
      // Sec 2: Presence (UI on right, Earth on left)
      targetX = -1.5; targetY = 0; targetZ = 1.5; targetTilt = Math.PI * 0.1;
    } else if (p >= 0.4 && p < 0.6) {
      // Sec 3: Nearby Users (UI on left, Earth on right)
      targetX = 1.5; targetY = 0; targetZ = 1.8; targetTilt = -Math.PI * 0.1;
      isNearby = true;
    } else if (p >= 0.6 && p < 0.8) {
      // Sec 4: SOS (Centered, intense)
      targetX = 0; targetY = 0; targetZ = 1.0; targetTilt = Math.PI * 0.2;
      isSOS = true;
    } else {
      // Sec 5: Login (Top down view)
      targetX = 0; targetY = 1.8; targetZ = 2.0; targetTilt = Math.PI * 0.45;
    }

    if (earthRef.current && wireframeRef.current) {
      // Smooth interpolation for camera/earth moves
      earthRef.current.position.x = THREE.MathUtils.lerp(earthRef.current.position.x, targetX, 0.05);
      earthRef.current.position.y = THREE.MathUtils.lerp(earthRef.current.position.y, targetY, 0.05);
      earthRef.current.position.z = THREE.MathUtils.lerp(earthRef.current.position.z, targetZ, 0.05);
      
      earthRef.current.rotation.x = THREE.MathUtils.lerp(earthRef.current.rotation.x, targetTilt, 0.05);
      earthRef.current.rotation.y += delta * rotSpeed;
      
      wireframeRef.current.position.copy(earthRef.current.position);
      wireframeRef.current.rotation.copy(earthRef.current.rotation);
    }
    
    // Color interpolation
    const targetWireframeColor = isSOS ? '#ff003c' : (isNearby ? '#00ff88' : '#0088ff');
    wireframeRef.current.material.color.lerp(new THREE.Color(targetWireframeColor), 0.05);
    wireframeRef.current.material.opacity = isSOS ? 0.3 : 0.15;

    if (ringRef.current) {
      ringRef.current.position.copy(earthRef.current.position);
      const isFinal = p >= 0.8;
      const targetScale = isSOS ? 1.8 : (isFinal ? 2.5 : (isNearby ? 1.4 : 1.0));
      ringRef.current.scale.setScalar(THREE.MathUtils.lerp(ringRef.current.scale.x, targetScale, 0.05));
      
      const ringColor = isSOS ? '#ff003c' : (isFinal ? '#ffffff' : (isNearby ? '#00ff88' : '#00bfff'));
      ringRef.current.material.color.lerp(new THREE.Color(ringColor), 0.05);
      ringRef.current.material.opacity = isFinal ? 0.2 : (isSOS ? 0.6 : 0.15);
    }

    // Pulse Effect for SOS
    if (pulseRef.current) {
      pulseRef.current.position.copy(earthRef.current.position);
      if (isSOS) {
        pulseRef.current.scale.setScalar(pulseRef.current.scale.x + delta * 2.5);
        pulseRef.current.material.opacity -= delta * 1.0;
        if (pulseRef.current.scale.x > 4) {
          pulseRef.current.scale.setScalar(2);
          pulseRef.current.material.opacity = 0.8;
        }
      } else {
        pulseRef.current.scale.setScalar(2);
        pulseRef.current.material.opacity = 0;
      }
    }
  });

  return (
    <group>
      <Sphere ref={earthRef} args={[2, 64, 64]}>
        <meshBasicMaterial color="#010103" />
      </Sphere>
      <Sphere ref={wireframeRef} args={[2.02, 32, 32]}>
        <meshBasicMaterial color="#0088ff" wireframe transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </Sphere>
      <mesh ref={ringRef} rotation={[Math.PI / 2.1, 0, 0]}>
        <ringGeometry args={[2.4, 2.42, 128]} />
        <meshBasicMaterial color="#00bfff" transparent opacity={0.15} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <Sphere ref={pulseRef} args={[1, 32, 32]}>
        <meshBasicMaterial color="#ff003c" transparent opacity={0} wireframe blending={THREE.AdditiveBlending} />
      </Sphere>
    </group>
  );
};

const NetworkNodes = () => {
  const nodesRef = useRef();
  const count = 400;
  
  const [positions, phases, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    const sp = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 2.05 + Math.random() * 0.1; 
      
      pos[i * 3] = r * Math.cos(theta) * Math.sin(phi);
      pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = r * Math.cos(phi);
      
      ph[i] = Math.random() * Math.PI * 2;
      sp[i] = 0.5 + Math.random() * 2;
    }
    return [pos, ph, sp];
  }, []);

  const uniforms = useMemo(() => ({
    time: { value: 0 },
    colorNormal: { value: new THREE.Color('#00e5ff') },
    colorSOS: { value: new THREE.Color('#ff003c') },
    colorNearby: { value: new THREE.Color('#00ff88') },
    mixRatioSOS: { value: 0.0 }, 
    mixRatioNearby: { value: 0.0 },
  }), []);

  useFrame((state, delta) => {
    const p = scrollState.current;
    uniforms.time.value = state.clock.elapsedTime;
    
    let targetX = 0, targetY = 0, targetZ = 0, targetTilt = 0;
    if (p < 0.2) { targetTilt = p * Math.PI * 0.2; }
    else if (p >= 0.2 && p < 0.4) { targetX = -1.5; targetZ = 1.5; targetTilt = Math.PI * 0.1; }
    else if (p >= 0.4 && p < 0.6) { targetX = 1.5; targetZ = 1.8; targetTilt = -Math.PI * 0.1; }
    else if (p >= 0.6 && p < 0.8) { targetZ = 1.0; targetTilt = Math.PI * 0.2; }
    else { targetY = 1.8; targetZ = 2.0; targetTilt = Math.PI * 0.45; }

    if (nodesRef.current) {
      nodesRef.current.position.x = THREE.MathUtils.lerp(nodesRef.current.position.x, targetX, 0.05);
      nodesRef.current.position.y = THREE.MathUtils.lerp(nodesRef.current.position.y, targetY, 0.05);
      nodesRef.current.position.z = THREE.MathUtils.lerp(nodesRef.current.position.z, targetZ, 0.05);
      nodesRef.current.rotation.x = THREE.MathUtils.lerp(nodesRef.current.rotation.x, targetTilt, 0.05);
      nodesRef.current.rotation.y += delta * (0.05 + (p * 0.1)); 
    }

    const isSOS = p >= 0.6 && p < 0.8;
    const isNearby = p >= 0.4 && p < 0.6;
    
    uniforms.mixRatioSOS.value = THREE.MathUtils.lerp(uniforms.mixRatioSOS.value, isSOS ? 1.0 : 0.0, 0.05);
    uniforms.mixRatioNearby.value = THREE.MathUtils.lerp(uniforms.mixRatioNearby.value, isNearby ? 1.0 : 0.0, 0.05);
  });

  return (
    <points ref={nodesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-phase" count={count} array={phases} itemSize={1} />
        <bufferAttribute attach="attributes-speed" count={count} array={speeds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial 
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float phase;
          attribute float speed;
          varying float vAlpha;
          uniform float time;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = (14.0 / -mvPosition.z);
            vAlpha = 0.3 + 0.7 * sin(time * speed + phase);
          }
        `}
        fragmentShader={`
          uniform vec3 colorNormal;
          uniform vec3 colorSOS;
          uniform vec3 colorNearby;
          uniform float mixRatioSOS;
          uniform float mixRatioNearby;
          varying float vAlpha;
          void main() {
            vec2 xy = gl_PointCoord.xy - vec2(0.5);
            float ll = length(xy);
            if (ll > 0.5) discard;
            
            vec3 finalColor = mix(colorNormal, colorNearby, mixRatioNearby);
            finalColor = mix(finalColor, colorSOS, mixRatioSOS);
            
            gl_FragColor = vec4(finalColor, vAlpha * pow(1.0 - (ll * 2.0), 2.0));
          }
        `}
      />
    </points>
  );
};

const BackgroundScene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
      <color attach="background" args={['#010103']} />
      <fog attach="fog" args={['#010103', 4, 18]} />
      <Stars radius={100} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
      <Sparkles count={500} scale={12} size={2} speed={0.2} opacity={0.1} color="#0088ff" />
      <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.1}>
        <DigitalEarth />
        <NetworkNodes />
      </Float>
    </Canvas>
  );
};

// --- REACT HTML SCROLL CONTENT ---

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Setup Lenis for Genuine Smooth Scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
      wheelMultiplier: 1.0,
    });

    lenis.on('scroll', (e) => {
      scrollState.current = e.progress; // Directly provides 0 to 1 over the document
    });

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    setUsername(val);
  };

  const handleEnterClick = () => {
    if (username.length === 5) {
      onLogin(username, 'Global');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && username.length === 5) {
      handleEnterClick();
    }
  };

  // Animation variants for scroll reveals
  const revealUp = {
    hidden: { opacity: 0, y: 80 },
    visible: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
  };

  const revealStagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  return (
    <div className="orbit-login-wrapper">
      
      {/* 3D Background - Fixed in place */}
      <div className="canvas-container">
        <BackgroundScene />
      </div>

      {/* Genuine Scrolling Document */}
      <div className="scroll-content">
        
        {/* SECTION 1: HERO */}
        <section className="cinematic-section hero-section">
          <motion.div 
            className="section-inner center-align"
            variants={revealStagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-10%" }}
          >
            <motion.div variants={revealUp} className="badge-glow">
              <Globe2 size={14} className="inline-icon" />
              <span>ORBIT PLANETARY NETWORK</span>
            </motion.div>
            <motion.h1 variants={revealUp} className="hero-title">REALTIME HUMAN<br/><span className="text-gradient-blue">PRESENCE</span></motion.h1>
            <motion.p variants={revealUp} className="hero-subtitle">The live social layer of Earth. Connect through proximity. Exist together in realtime space.</motion.p>
            
            <motion.div variants={revealUp} className="scroll-indicator">
              <div className="scroll-mouse">
                <div className="scroll-wheel"></div>
              </div>
              <span className="scroll-text">SCROLL TO EXPLORE</span>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 2: HUMAN PRESENCE */}
        <section className="cinematic-section presence-section">
          <motion.div 
            className="section-inner right-align"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-20%" }}
          >
            <div className="glass-panel">
              <div className="panel-glow-effect blue"></div>
              <div className="icon-wrapper blue-glow">
                <Network size={28} />
              </div>
              <h2 className="section-title">LIVE POSITIONAL<br/>SYNCHRONIZATION</h2>
              <p className="section-desc">Nodes representing humans. When you move, the network moves. Discover who is sharing your exact orbital space at this very second.</p>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <MapPin size={16} className="stat-icon text-blue" />
                  <span className="stat-val">ACTIVE</span>
                  <span className="stat-label">Proximity Nodes</span>
                </div>
                <div className="stat-card">
                  <Activity size={16} className="stat-icon text-blue" />
                  <span className="stat-val">LIVE</span>
                  <span className="stat-label">Data Stream</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 3: NEARBY USERS */}
        <section className="cinematic-section nearby-section">
          <motion.div 
            className="section-inner left-align"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-20%" }}
          >
            <div className="glass-panel">
              <div className="panel-glow-effect green"></div>
              <div className="icon-wrapper green-glow">
                <UserPlus size={28} />
              </div>
              <h2 className="section-title">REALTIME NEARBY<br/>DETECTION</h2>
              <p className="section-desc">Distance matters. Orbit continuously scans your perimeter, revealing the network of human activity orbiting around your immediate location.</p>
            </div>
          </motion.div>
        </section>

        {/* SECTION 4: SOS EMERGENCY */}
        <section className="cinematic-section sos-section">
          <motion.div 
            className="section-inner center-align"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-20%" }}
          >
            <div className="glass-panel massive-panel">
              <div className="panel-glow-effect red"></div>
              <div className="icon-wrapper red-glow large-icon">
                <ShieldAlert size={40} />
              </div>
              <h2 className="section-title text-center">WHEN A SIGNAL IS SENT,<br/>THE NETWORK RESPONDS</h2>
              <p className="section-desc text-center">Orbit is built for safety. Activate an SOS to instantly alert nearby users. The network converges, synchronizing live location data to coordinate a human response.</p>
              
              <div className="alert-bar">
                <div className="alert-pulse"></div>
                <span>REALTIME DISTRESS BEACON CAPABILITY ACTIVE</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 5: ENTER ORBIT (TERMINAL) */}
        <section className="cinematic-section enter-section">
          <motion.div 
            className="section-inner center-align"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-10%" }}
          >
            <h2 className="hero-title final-title" style={{ marginBottom: '60px' }}>ENTER <span className="text-gradient-white">ORBIT</span></h2>
            
            {/* The Integrated Username Terminal physically placed in the scroll flow */}
            <div className="holographic-terminal">
              <div className="terminal-header">
                <Crosshair size={20} className="scanner-icon" />
                <span>IDENTITY SYNCHRONIZATION</span>
              </div>
              
              <div className={`input-wrapper ${isFocused ? 'focused' : ''} ${username.length === 5 ? 'ready' : ''}`}>
                <div className="input-bracket left">[</div>
                <input
                  type="text"
                  value={username}
                  onChange={handleInputChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="DESIGNATION"
                  className="terminal-input"
                  spellCheck="false"
                  autoComplete="off"
                />
                <div className="input-bracket right">]</div>
              </div>

              <div className="terminal-status">
                {username.length < 5 ? (
                  <span className="status-text blink">AWAITING NODE DESIGNATION... {username.length}/5</span>
                ) : (
                  <span className="status-text success">NODE READY FOR DEPLOYMENT</span>
                )}
              </div>

              <div className="action-container">
                <button 
                  className={`sync-btn ${username.length === 5 ? 'active' : ''}`}
                  disabled={username.length !== 5}
                  onClick={handleEnterClick}
                >
                  <Fingerprint size={18} className="btn-icon" />
                  <span>INITIALIZE ORBIT CONNECTION</span>
                </button>
                <div className="encryption-notice">
                  <RadioReceiver size={12} />
                  <span>SECURE ORBITAL CHANNEL</span>
                </div>
              </div>
            </div>
            
          </motion.div>
        </section>

      </div>
    </div>
  );
};

export default Login;
