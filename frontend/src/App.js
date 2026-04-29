import { useEffect, useState, useRef } from "react";
import MapView from "./components/MapView";
import socket from "./components/SocketManager";
import "./App.css";

function App() {
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [isFollowing, setIsFollowing] = useState(true);
  const [isUserPanelOpen, setIsUserPanelOpen] = useState(false); // 👥 Panel state
  const mapRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    socket.on("update_users", (data) => {
      setUsers(data);
    });

    return () => socket.off("update_users");
  }, []);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
        };
        setUserLocation(coords);

        socket.emit("send_location", {
          id: "user1",
          name: "Oscar",
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
  }, []);

  const handleSOS = () => {
    if (!userLocation) return;
    
    const data = {
      id: "user1",
      name: "Oscar",
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

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }} className={`${theme}-mode`}>
      <MapView 
        ref={mapRef} 
        users={users} 
        userLocation={userLocation} 
        theme={theme} 
        isFollowing={isFollowing} 
      />

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
              users.map((user) => (
                <div 
                  key={user.id} 
                  className="user-item"
                  onClick={() => {
                    mapRef.current?.handleCenterOnUser(user.lng, user.lat);
                    setIsFollowing(false); // Stop following me to look at them
                    showToast(`📍 Tracking ${user.name}`);
                  }}
                >
                  <div className="user-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{user.name} {user.id === "user1" ? "(You)" : ""}</span>
                    <span className="user-status">Online now</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-users">No users nearby</div>
            )}
          </div>
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