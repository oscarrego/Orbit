import React from 'react';

const ProfileModal = ({ user, onClose }) => {
  const roomId = localStorage.getItem("roomId") || "Global";

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="profile-avatar">
          {user.username.charAt(0).toUpperCase()}
        </div>

        <h2 className="profile-name">{user.username}</h2>

        <div className="profile-section">
          <label className="profile-label">Current Room</label>
          <div className="profile-box">#{roomId}</div>
        </div>

        <div className="profile-toggle">
          <span>Invisible Mode</span>
          <input type="checkbox" />
        </div>

        <div className="profile-toggle">
          <span>Notifications</span>
          <input type="checkbox" defaultChecked />
        </div>

        <div className="status">
          <span className="dot"></span>
          ACTIVE / VISIBLE
        </div>

        <button className="close-btn" onClick={onClose}>Close</button>

      </div>
    </div>
  );
};

export default ProfileModal;
