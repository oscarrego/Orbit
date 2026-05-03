import React, { useState, useRef, useEffect } from 'react';
import './Login.css';
import NumericSphereBackground from './NumericSphereBackground';

const Login = ({ onLogin }) => {
  const [code, setCode] = useState(['', '', '', '', '']);
  const inputRefs = useRef([]);

  // Auto-focus the first box on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    // Only allow letters, convert to uppercase
    const char = value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(-1);
    
    // If empty and wasn't backspace (handled in onKeyDown), do nothing
    if (value && !char) return;

    const newCode = [...code];
    newCode[index] = char;
    setCode(newCode);

    // Auto-focus next box
    if (char && index < 4) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Focus previous box on backspace if current is empty
      inputRefs.current[index - 1].focus();
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-content">
          <div className="sphere-wrapper">
            <NumericSphereBackground />
          </div>
          
          <h1 className="login-heading">Enter Username</h1>
          <p className="login-subtext">Choose a name to enter Orbit</p>

          <div className="otp-row">
            <div className="otp-container">
              {code.map((char, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="otp-box"
                  autoComplete="off"
                />
              ))}
            </div>

            {code.join('').length === 5 && (
              <button
                className="enter-btn"
                onClick={() => onLogin(code.join(''), 'Global')}
              >
                →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

