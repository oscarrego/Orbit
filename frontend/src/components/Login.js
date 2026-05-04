import React, { useState, useRef, useEffect } from 'react';
import './Login.css';
import NumericSphereBackground from './NumericSphereBackground';

const Login = ({ onLogin }) => {
  const [code, setCode] = useState(['', '', '', '', '']);
  const [boxErrors, setBoxErrors] = useState([false, false, false, false, false]);
  const [showErrorMsg, setShowErrorMsg] = useState(false);
  const [sphereCenter, setSphereCenter] = useState({ x: 0, y: 0 });
  const inputRefs = useRef([]);
  const sphereRef = useRef(null);

  // Auto-focus the first box on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Compute sphere center for star field target
  useEffect(() => {
    const updateCenter = () => {
      if (sphereRef.current) {
        const rect = sphereRef.current.getBoundingClientRect();
        setSphereCenter({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        });
      }
    };

    updateCenter();
    window.addEventListener('resize', updateCenter);
    return () => window.removeEventListener('resize', updateCenter);
  }, []);

  const handleChange = (index, value) => {
    // If it's a deletion, handle it normally
    if (value === '') {
      const newCode = [...code];
      newCode[index] = '';
      setCode(newCode);
      return;
    }

    // Validation: Only allow letters
    if (!/^[a-zA-Z]$/.test(value.slice(-1))) {
      // Trigger error state for this specific box
      const newErrors = [...boxErrors];
      newErrors[index] = true;
      setBoxErrors(newErrors);
      setShowErrorMsg(true);

      // Reset box error after animation
      setTimeout(() => {
        setBoxErrors(prev => {
          const reset = [...prev];
          reset[index] = false;
          return reset;
        });
      }, 400);

      // Reset global error message after a delay
      setTimeout(() => {
        setShowErrorMsg(false);
      }, 1500);

      return; // Stop here, don't update code
    }

    // Process valid input: letters only, uppercase
    const char = value.slice(-1).toUpperCase();
    
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
          <div className="sphere-container" ref={sphereRef}>
            <NumericSphereBackground />
          </div>
          
          <h1 className="login-heading">Enter your Username</h1>
          <p className="login-subtext">Create a name to enter Orbit</p>

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
                  className={`otp-box ${boxErrors[index] ? 'error' : ''}`}
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

          {showErrorMsg && (
            <p className="otp-error-text">Only letters (A–Z) are allowed</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

