import { useEffect, useState, useRef } from "react";
import MapView from "./components/MapView";
import socket from "./components/SocketManager";
import "./App.css";

// 🛠️ Helpers for persistent identity
const getPersistentUser = () => {
  const savedName = localStorage.getItem("username");
  let savedId = localStorage.getItem("userId");
  
  if (!savedId) {
    savedId = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("userId", savedId);
  }
  
  return { username: savedName, userId: savedId };
};

function App() {
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [isFollowing, setIsFollowing] = useState(true);
  const [isUserPanelOpen, setIsUserPanelOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // 🔑 Auth State
  const [user, setUser] = useState(getPersistentUser());
  const [tempName, setTempName] = useState("");
  const mapRef = useRef(null);

  // 💾 Persist theme
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // 🔌 Receive live users
  useEffect(() => {
    socket.on("update_users", (data) => {
      // 🛡️ Safety filter: Ensure only unique user IDs are stored
      const unique = {};
      data.forEach((u) => {
        unique[u.id] = u;
      });
      setUsers(Object.values(unique));
    });

    return () => socket.off("update_users");
  }, []);

  // 📍 Send live location
  useEffect(() => {
    if (!user.username) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
        };
        setUserLocation(coords);

        socket.emit("send_location", {
          id: user.userId,
          name: user.username,
          ...coords,
        });
      },
      (err) => {
        console.error("Geolocation error:", err);
        setUserLocation((prev) => prev || { lat: 12.9716, lng: 77.5946, heading: null });
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user.username, user.userId]);

  // 🔑 Handle Login
  const handleLogin = (e) => {
    e.preventDefault();
    const trimmed = tempName.trim();
    if (!trimmed) return;

    localStorage.setItem("username", trimmed);
    setUser((prev) => ({ ...prev, username: trimmed }));
    showToast(`👋 Welcome, ${trimmed}!`);
  };

  // 🚪 Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("username");
    window.location.reload();
  };

  const handleSOS = () => {
    if (!userLocation || !user.username) return;
    
    const data = {
      id: user.userId,
      name: user.username,
      ...userLocation,
    };

    socket.emit("sos_alert", data);
    showToast("🚨 SOS button clicked!");
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // 🛸 If no username, show Login Page
  if (!user.username) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <h2>Enter your name</h2>
          <form onSubmit={handleLogin}>
            <input 
              type="text" 
              placeholder="Username" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              autoFocus
              maxLength={20}
            />
            <button type="submit">Continue</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }} className={`${theme}-mode`}>
      <MapView 
        ref={mapRef} 
        users={users} 
        userLocation={userLocation} 
        theme={theme} 
        isFollowing={isFollowing} 
      />

      {/* 💬 CHAT PANEL (Mica Dark) */}
      <div className={`chat-panel ${isChatOpen ? "open" : "closed"}`}>
        <div className="chat-header">
          <div className="online-dot"></div>
          <span>Global Chat</span>
        </div>
        
        <div className="chat-messages">
          <div className="empty-state">
            <p>No messages yet.</p>
            <p style={{ opacity: 0.6 }}>Say hello!</p>
          </div>
        </div>

        <div className="chat-input-container">
          <div className="message-input-wrapper">
            <input type="text" placeholder="Type a message..." />
            <button className="send-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ⬅️ CHAT TOGGLE BUTTON */}
      <button 
        className={`chat-toggle ${isChatOpen ? "open" : "closed"}`}
        onClick={() => setIsChatOpen(!isChatOpen)}
        title={isChatOpen ? "Collapse Chat" : "Expand Chat"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isChatOpen ? (
            <polyline points="15 18 9 12 15 6"></polyline>
          ) : (
            <polyline points="9 18 15 12 9 6"></polyline>
          )}
        </svg>
      </button>

      {/* 👥 ACTIVE USERS INDICATOR */}
      <div 
        className="users-indicator" 
        onClick={() => setIsUserPanelOpen(!isUserPanelOpen)}
      >
        <div className="online-dot"></div>
        <span>Active Users: {users.length}</span>
      </div>

      {/* 👥 USERS PANEL */}
      {isUserPanelOpen && (
        <div className="users-panel">
          <h3>Nearby Users</h3>
          <div className="user-list">
            {users.length > 0 ? (
              users.map((u) => (
                <div 
                  key={u.id} 
                  className="user-item"
                  onClick={() => {
                    mapRef.current?.handleCenterOnUser(u.lng, u.lat);
                    setIsFollowing(false);
                    showToast(`📍 Tracking ${u.name}`);
                  }}
                >
                  <div className="user-avatar">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{u.name} {u.id === user.userId ? "(You)" : ""}</span>
                    <span className="user-status">Online now</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-users">No users nearby</div>
            )}
          </div>
          <button className="logout-btn" onClick={handleLogout}>Reset Username</button>
        </div>
      )}

      {/* 🛠️ CONTROL CLUSTER */}
      <div className="control-cluster">
        <button 
          className="control-btn" 
          onClick={() => {
            if (userLocation) {
              mapRef.current?.handleRecenter();
            } else {
              showToast("📍 Waiting for location...");
            }
          }}
          title="Recenter to my location"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="22" y1="12" x2="18" y2="12"></line>
            <line x1="6" y1="12" x2="2" y2="12"></line>
            <line x1="12" y1="6" x2="12" y2="2"></line>
            <line x1="12" y1="22" x2="12" y2="18"></line>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>

        <button 
          className={`control-btn ${isFollowing ? "active" : ""}`} 
          onClick={() => {
            setIsFollowing(!isFollowing);
            showToast(isFollowing ? "🛰️ Follow Me: OFF" : "🛰️ Follow Me: ON");
          }}
          title={isFollowing ? "Disable Follow Me" : "Enable Follow Me"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </button>

        <button 
          className="control-btn" 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </div>

      <button className="sos-btn" onClick={handleSOS}>
        🚨 SOS
      </button>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;