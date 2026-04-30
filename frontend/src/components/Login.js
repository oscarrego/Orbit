import React, { useState } from 'react';
import './Login.css';

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
      <div className="login-card">
        {/* Left Side: Form */}
        <div className="login-form-section">
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

              <div className="recovery-link">
                <a href="#recovery">Recovery Password</a>
              </div>

              <button type="submit" className="signin-button">
                Launch Orbit
              </button>
            </form>

            <div className="divider">
              <span>Or continue with</span>
            </div>

            <div className="social-login">
              <button className="social-icon google">
                <svg viewBox="0 0 24 24"><path fill="#EA4335" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
              </button>
              <button className="social-icon apple">
                <svg viewBox="0 0 24 24"><path fill="#000" d="M17.057 14.887c-.03 2.474 2.139 3.664 2.17 3.679-.018.061-.338 1.156-1.103 2.274-.662.966-1.352 1.927-2.43 1.947-1.059.02-1.398-.626-2.612-.626-1.211 0-1.587.606-2.607.646-1.018.04-1.815-.89-2.483-1.856-1.365-1.977-2.405-5.588-1.002-8.024.697-1.21 1.943-1.976 3.304-1.996 1.033-.02 2.008.696 2.64.696.634 0 1.823-.874 3.064-.749.52.021 1.983.21 2.922 1.583-.075.047-1.746 1.018-1.728 3.054zm-2.493-9.531c.56-.677.936-1.619.833-2.556-.803.032-1.774.536-2.348 1.21-.515.599-.966 1.559-.844 2.478.895.069 1.8-.455 2.359-1.132z"/></svg>
              </button>
              <button className="social-icon facebook">
                <svg viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Illustration */}
        <div className="login-visual-section">
          <div className="illustration-container">
            <div className="sky-gradient">
              <div className="sun"></div>
            </div>
            <div className="landscape">
              <div className="mountain mountain-1"></div>
              <div className="mountain mountain-2"></div>
              <div className="tree-group">
                <div className="tree tree-1"></div>
                <div className="tree tree-2"></div>
                <div className="tree tree-3"></div>
              </div>
            </div>
            <div className="visual-text">
              <h2 className="visual-title">Finally, your dream workspace.</h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

