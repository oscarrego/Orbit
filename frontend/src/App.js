import { useEffect, useState, useRef } from "react";
import MapView from "./components/MapView";
import Login from "./components/Login";
import ProfileModal from "./components/ProfileModal";
import socket from "./components/SocketManager";
import "./App.css";

// 🛠️ Helpers for persistent identity
const getPersistentUser = () => {
  const savedName = localStorage.getItem("username");
  let savedId = localStorage.getItem("userId");
  let savedSeed = localStorage.getItem("avatarSeed");
  
  if (!savedId) {
    savedId = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("userId", savedId);
  }

  if (!savedSeed && savedName) {
    savedSeed = savedName;
    localStorage.setItem("avatarSeed", savedSeed);
  }
  
  return { username: savedName, userId: savedId, avatarSeed: savedSeed || savedName };
};

function App() {
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
    
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [isFollowing, setIsFollowing] = useState(true);
  const [activePanel, setActivePanel] = useState(null); // 'chat', 'users', or null
  const [showProfile, setShowProfile] = useState(false);
  
  // 💬 Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState(localStorage.getItem("roomId") || "Global");
  const [roomInput, setRoomInput] = useState("");
  const chatEndRef = useRef(null);
  
  // 🔑 Auth State
  const [user, setUser] = useState(getPersistentUser());
  const mapRef = useRef(null);

  // 💾 Persist theme
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // 🔌 Socket Listeners
  useEffect(() => {
    // Initial join if logged in
    if (user.username) {
      socket.emit("join_room", { room: currentRoom });
    }

    socket.on("update_users", (data) => {
      const unique = {};
      data.forEach((u) => {
        unique[u.id] = u;
      });
      setUsers(Object.values(unique));
    });

    socket.on("load_messages", (messages) => {
      setChatMessages(messages);
    });

    socket.on("receive_message", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on("sos_alert", (data) => {
  setSosAlerts(prev => [...prev, data]);
    });

    return () => {
      socket.off("update_users");
      socket.off("load_messages");
      socket.off("receive_message");
      socket.off("sos_alert");
    };
  }, [user.username, currentRoom]);

  // 📜 Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
          avatarSeed: user.avatarSeed,
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
  }, [user.username, user.userId, user.avatarSeed]);

  // 🔑 Handle Login
  const handleLogin = (username, roomId) => {
    const trimmed = username.trim();
    if (!trimmed) return;

    const finalRoom = roomId?.trim() || "Global";
    localStorage.setItem("username", trimmed);
    localStorage.setItem("roomId", finalRoom);
    setCurrentRoom(finalRoom);
    
    // Set initial avatar seed as username if not exists
    let seed = localStorage.getItem("avatarSeed");
    if (!seed) {
      seed = trimmed;
      localStorage.setItem("avatarSeed", seed);
    }

    setUser((prev) => ({ ...prev, username: trimmed, avatarSeed: seed }));
    socket.emit("join_room", { room: finalRoom });
    showToast(`👋 Welcome, ${trimmed}!`);
  };

  // 🚪 Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("avatarSeed");
    localStorage.removeItem("roomId");
    window.location.reload();
  };

  // 🎨 Update Avatar
  const changeAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    localStorage.setItem("avatarSeed", newSeed);
    setUser(prev => ({ ...prev, avatarSeed: newSeed }));
    showToast("✨ Avatar updated!");
  };

  // 📝 Update Username
  const updateUsername = (newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === user.username) return;

    localStorage.setItem("username", trimmed);
    setUser(prev => ({ ...prev, username: trimmed }));

    // Force instant socket sync
    if (userLocation) {
      socket.emit("send_location", {
        id: user.userId,
        name: trimmed,
        avatarSeed: user.avatarSeed,
        ...userLocation
      });
    }

    showToast("✅ Name updated!");
  };

  // 🏠 Switch Room
  const handleSwitchRoom = () => {
    const room = roomInput.trim();
    if (!room || room === currentRoom) return;

    setCurrentRoom(room);
    localStorage.setItem("roomId", room);
    socket.emit("join_room", { room });
    setRoomInput("");
    showToast(`🚀 Joined room: ${room}`);
  };

  // 💬 Handle Send Message
  const sendMessage = (e) => {
    e.preventDefault();
    const text = msgInput.trim();
    if (!text) return;

    const msgData = {
      user: user.username,
      text: text,
      timestamp: Date.now() / 1000,
      avatarSeed: user.avatarSeed,
      room: currentRoom,
    };

    socket.emit("send_message", msgData);
    setMsgInput("");
  };

  const handleSOS = () => {
    if (!userLocation || !user.username) return;
    
    const data = {
      id: user.userId,
      name: user.username,
      avatarSeed: user.avatarSeed,
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
    return <Login onLogin={handleLogin} />;
  }

  // 🛰️ Handle Auto-disable Follow Me
  const handleAutoDisableFollowing = () => {
    if (isFollowing) {
      setIsFollowing(false);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }} className={`${theme}-mode`}>
      <MapView 
        ref={mapRef} 
        users={users} 
        userLocation={userLocation} 
        theme={theme} 
        isFollowing={isFollowing} 
        setIsFollowing={setIsFollowing}
        onAutoDisableFollowing={handleAutoDisableFollowing}
        currentUserId={user.userId}
        sosAlerts={sosAlerts}
      />

      {/* 💬 CHAT PANEL (Mica Dark) */}
      <div className={`chat-panel ${activePanel === "chat" ? "open" : "closed"}`}>
        <div className="chat-header">
          <div className="online-dot"></div>
          <span>ORBIT CHAT - ROOM: {currentRoom.toUpperCase()}</span>
        </div>

        <div className="room-controls">
          <input 
            type="text" 
            className="room-input" 
            placeholder="Join or Create Room..." 
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSwitchRoom()}
          />
          <button className="join-btn" onClick={handleSwitchRoom}>JOIN</button>
        </div>
        
        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            <div className="empty-state">
              <p>No messages yet.</p>
              <p style={{ opacity: 0.6 }}>Say hello!</p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.user === user.username ? "mine" : "other"}`}>
                <div className="chat-bubble">
                  {msg.user !== user.username && (
                    <span className="msg-user">{msg.user}</span>
                  )}
                  <span className="msg-text">{msg.text}</span>
                  <span className="msg-time">
                    {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-input-container" onSubmit={sendMessage}>
          <div className="message-input-wrapper">
            <input 
              type="text" 
              placeholder="Type a message..." 
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
            />
            <button type="submit" className="send-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </form>
      </div>


      {/* ⬅️ CHAT TOGGLE BUTTON */}
      <button 
        className={`chat-toggle ${activePanel === "chat" ? "open" : "closed"}`}
        onClick={() => setActivePanel(prev => (prev === "chat" ? null : "chat"))}
        title={activePanel === "chat" ? "Collapse Chat" : "Expand Chat"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {activePanel === "chat" ? (
            <polyline points="15 18 9 12 15 6"></polyline>
          ) : (
            <polyline points="9 18 15 12 9 6"></polyline>
          )}
        </svg>
      </button>

      {/* 👥 ACTIVE USERS INDICATOR */}
      <div 
        className="users-indicator" 
        onClick={() => setActivePanel(prev => (prev === "users" ? null : "users"))}
      >
        <div className="online-dot"></div>
        <span>Active Users: {users.length}</span>
      </div>

      {/* 👥 USERS PANEL */}
      {activePanel === "users" && (
        <div className="users-panel">
          <h3>Nearby Users</h3>
          <div className="user-list">
            {users.length > 0 ? (
              [...users]
                .sort((a, b) => (a.id === user.userId ? -1 : b.id === user.userId ? 1 : 0))
                .map((u, i) => (
                  <div key={u.id}>
                    <div 
                      className={`user-item ${u.id === user.userId ? "current" : ""}`}
                      onClick={() => {
                        mapRef.current?.handleCenterOnUser(u.lng, u.lat);
                        setIsFollowing(false);
                        showToast(`📍 Tracking ${u.name}`);
                      }}
                    >
                      <div className="user-info">
                        <span className="user-name">
                          {u.name} {u.id === user.userId ? <span className="you-label">(You)</span> : ""}
                        </span>
                        <span className="user-status">Online now</span>
                      </div>
                    </div>
                    {u.id === user.userId && users.length > 1 && (
                      <div className="user-divider"></div>
                    )}
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
        <button className="profile-btn" onClick={() => setShowProfile(true)}>
          <div className="avatar">
            <img 
              src={`https://api.dicebear.com/9.x/open-peeps/svg?seed=${user.avatarSeed}`} 
              alt="My Avatar" 
              style={{ width: "100%", height: "100%", borderRadius: "50%" }}
            />
          </div>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>SOS</span>
      </button>

      {toast && <div className="toast">{toast}</div>}

      {showProfile && (
        <ProfileModal 
          user={user} 
          onClose={() => setShowProfile(false)} 
          onChangeAvatar={changeAvatar}
          onUpdateUsername={updateUsername}
        />
      )}
    </div>
  );
}

export default App;