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
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
    
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [isFollowing, setIsFollowing] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'chat', 'users', or null
  const [showProfile, setShowProfile] = useState(false);
  const [is3DView, setIs3DView] = useState(false);
  
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

    socket.on("sos_alert", (data) => {
      console.log("🚨 ALERT RECEIVED:", data);
      setSosAlerts(prev => [...prev.filter(alert => String(alert.id) !== String(data.id)), data]);
      
      // Show clickable toast for other users' SOS
      if (String(data.id) !== String(user.userId)) {
        showToast({
          message: `${data.name} needs help!`,
          type: "sos",
          userId: data.id,
          lat: data.lat,
          lng: data.lng
        });
      }
    });

    socket.on("sos_cancel", (data) => {
      console.log("🔥 CANCEL RECEIVED:", data);
      setSosAlerts(prev => prev.filter(alert => String(alert.id) !== String(data.id)));
    });

    // 💬 LOAD OLD MESSAGES
    socket.on("load_messages", (messages) => {
      console.log("📜 LOADED MESSAGES:", messages);
      setChatMessages(messages);
    });

    // 💬 RECEIVE NEW MESSAGE
    socket.on("receive_message", (msg) => {
      console.log("🔥 RECEIVED:", msg);
      setChatMessages((prev) => [...prev, msg]);
    });

    // 💬 MESSAGE UPDATED (SEEN STATUS)
    socket.on("message_updated", (updatedMsg) => {
      setChatMessages((prev) => 
        prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
      );
    });

    return () => {
      socket.off("update_users");
      socket.off("load_messages");
      socket.off("receive_message");
      socket.off("message_updated");
      socket.off("sos_alert");
      socket.off("sos_cancel");
    };
  }, [user.username]);

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
    setChatMessages([]); // 🔥 ADD THIS LINE

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
      senderId: user.userId,
      user: user.username,
      text: text,
      timestamp: Date.now() / 1000,
      avatarSeed: user.avatarSeed,
      room: currentRoom,
      seenBy: [user.userId],
    };

    socket.emit("send_message", msgData);
    setChatMessages((prev) => [...prev, msgData]);
    setMsgInput("");
  };

  // 💬 Handle Mark as Seen
  const markAsSeen = (messageId) => {
    if (!messageId) return;
    socket.emit("message_seen", { messageId, userId: user.userId });
  };

  // 💬 Seen Logic Effect (Real-time)
  useEffect(() => {
    if (activePanel !== "chat") return;

    const unseenMessages = chatMessages.filter(
      (msg) =>
        msg._id &&
        msg.senderId !== user.userId &&
        !(msg.seenBy || []).includes(user.userId)
    );

    unseenMessages.forEach((msg) => {
      socket.emit("message_seen", {
        messageId: msg._id,
        userId: user.userId,
      });
    });
  }, [chatMessages, activePanel, user.userId]);

  const unreadCount = chatMessages.filter(
    (msg) =>
      msg.senderId !== user.userId &&
      !(msg.seenBy || []).includes(user.userId)
  ).length;

  const handleSOS = () => {
    if (!userLocation || !user.username) return;
    
    if (isSOSActive) {
      // 🔴 TELL SERVER YOU CANCELLED
      socket.emit("sos_cancel", { id: user.userId });

      // 🔴 REMOVE LOCALLY
      setSosAlerts(prev => prev.filter(alert => alert.id !== user.userId));

      setIsSOSActive(false);
      showToast("SOS cancelled", "cancel");
    } else {
      const data = {
        id: user.userId,
        name: user.username,
        avatarSeed: user.avatarSeed,
        ...userLocation,
      };

      socket.emit("sos_alert", data);
      setIsSOSActive(true);
      showToast({
        message: `${user.username} needs help`,
        type: "sos",
        userId: user.userId,
        lat: userLocation.lat,
        lng: userLocation.lng
      });
    }
  };

  const showToast = (input, type = "default") => {
    if (typeof input === "object") {
      setToast(input);
    } else {
      setToast({ message: input, type });
    }
    
    // Auto-clear toast
    setTimeout(() => {
      setToast(null);
    }, 5000);
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

  // 📏 Haversine distance formula
  function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const handleRecenter = () => {
    if (userLocation) {
      mapRef.current?.handleRecenter();
    } else {
      showToast("📍 Waiting for location...");
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
        is3DView={is3DView}
        setIs3DView={setIs3DView}
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
              <div key={i} className={`chat-msg ${msg.senderId === user.userId ? "mine" : "other"}`}>
                <div className="chat-bubble">
                  {msg.senderId !== user.userId && (
                    <span className="msg-user">{msg.user}</span>
                  )}
                  <span className="msg-text">{msg.text}</span>
                  <div className="msg-meta">
                    <span className="msg-time">
                      {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.senderId === user.userId && (
                      <span className="seen-status">
                        {(msg.seenBy || []).length > 1 ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
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
        onClick={() => {
          setActivePanel(prev => {
            const next = prev === "chat" ? null : "chat";
            if (next === "chat" && window.innerWidth <= 768) {
              setFabOpen(false);
            }
            return next;
          });
        }}
        title={activePanel === "chat" ? "Collapse Chat" : "Expand Chat"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {activePanel === "chat" ? (
            <polyline points="15 18 9 12 15 6"></polyline>
          ) : (
            <polyline points="9 18 15 12 9 6"></polyline>
          )}
        </svg>
        {activePanel !== "chat" && unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
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
                .map((u, i) => {
                  let distance = "Calculating...";

                  if (userLocation && u.lat && u.lng) {
                    const d = getDistanceKm(
                      userLocation.lat,
                      userLocation.lng,
                      u.lat,
                      u.lng
                    );
                    distance = `${d.toFixed(2)} km`;
                  }

                  return (
                    <div key={u.id}>
                      <div 
                        className={`user-item ${u.id === user.userId ? "current" : ""}`}
                        onClick={() => {
                          mapRef.current?.handleCenterOnUser(u.lng, u.lat);
                          setIsFollowing(false);
                          showToast(`Tracking ${u.name}`, "tracking");
                        }}
                      >
                        <div className="user-info">
                          <span className="user-name">
                            {u.name} {u.id === user.userId ? <span className="you-label"></span> : ""}
                          </span>
                          <span className="user-status">
                            Online now {distance && u.id !== user.userId && <span className="distance" style={{ opacity: 0.7 }}> • {distance}</span>}
                          </span>
                        </div>
                      </div>
                      {u.id === user.userId && users.length > 1 && (
                        <div className="user-divider"></div>
                      )}
                    </div>
                  );
                })
            ) : (
              <div className="no-users">No users nearby</div>
            )}
          </div>
        </div>
      )}

      {/* 📱 MOBILE FAB */}
      <div className={`fab-container ${fabOpen ? "open" : ""}`}>
        <div className="fab-actions">
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

          <button 
            className="control-btn recenter-btn" 
            onClick={handleRecenter}
            title="Toggle camera mode"
          >
            {is3DView ? (
              /* ICON FOR 3D VIEW */
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l9-9 9 9-9 9-9-9z" />
              </svg>
            ) : (
              /* ICON FOR TOP VIEW */
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" />
              </svg>
            )}
          </button>

          <button 
            className={`control-btn ${isFollowing ? "active" : ""}`} 
            onClick={() => {
              setIsFollowing(!isFollowing);
              showToast(
                isFollowing ? "Follow Me OFF" : "Follow Me ON",
                "follow"
              );
            }}
            title={isFollowing ? "Disable Follow Me" : "Enable Follow Me"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </button>
        </div>

        <button className="fab-main" onClick={() => {
          setFabOpen(prev => {
            const next = !prev;
            if (next && window.innerWidth <= 768) {
              setActivePanel(current => current === "chat" ? null : current);
            }
            return next;
          });
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>
      </div>

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
            showToast(
              isFollowing ? "Follow Me OFF" : "Follow Me ON",
              "follow"
            );
          }}
          title={isFollowing ? "Disable Follow Me" : "Enable Follow Me"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </button>

        <button 
          className="control-btn recenter-btn" 
          onClick={handleRecenter}
          title="Toggle camera mode"
        >
          {is3DView ? (
            /* ICON FOR 3D VIEW */
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l9-9 9 9-9 9-9-9z" />
            </svg>
          ) : (
            /* ICON FOR TOP VIEW */
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" />
            </svg>
          )}
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

      <button
        className={`sos-btn ${isSOSActive ? "active" : ""}`}
        onClick={handleSOS}
      >
        {/* 👇 Show icon ONLY when NOT active */}
        {!isSOSActive && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 20, height: 20 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}

        <span>{isSOSActive ? "CANCEL" : "SOS"}</span>
      </button>

      {toast && (
        <div 
          className={`toast ${toast.type}`}
          onClick={() => {
            if (toast.type === "sos" && toast.userId !== user.userId) {
              mapRef.current?.handleCenterOnUser(toast.lng, toast.lat);
              setIsFollowing(false);
              showToast({ message: "Tracking user...", type: "tracking" });
            }
          }}
          style={{ 
            cursor: toast.type === "sos" && toast.userId !== user.userId ? "pointer" : "default" 
          }}
        >
          {/* ICON */}
          {toast.type === "tracking" && (
            <svg className="icon radar-sweep" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.3"/>
              <path className="sweep" d="M12 3 A9 9 0 0 1 21 12" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="2" fill="white"/>
            </svg>
          )}

          {toast.type === "follow" && (    
            <svg className="icon follow-fly" viewBox="0 0 24 24" fill="none">
              <path d="M3 11L22 2L13 21L11 13L3 11Z"
                stroke="white" strokeWidth="2"/>
            </svg>
          )}

          {toast.type === "sos" && (
            <svg className="icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
              <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}

          {toast.type === "cancel" && (
            <svg className="icon" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}

          <span className="text">{toast.message}</span>

          {toast.type === "sos" && toast.userId !== user.userId && (
            <button 
              className="view-btn"
              onClick={(e) => {
                e.stopPropagation();
                mapRef.current?.handleCenterOnUser(toast.lng, toast.lat);
                setIsFollowing(false);
                showToast({ message: "Tracking user...", type: "tracking" });
              }}
            >
              VIEW
            </button>
          )}
        </div>
      )}

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
