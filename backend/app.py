from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import sqlite3
import time
import os

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# SQLite Setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "chat.db")

def init_db():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            text TEXT,
            timestamp REAL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# In-memory store
users = {} # user_id -> user data
socket_to_user = {} # sid -> user_id

# ---------------------------
# CONNECT
# ---------------------------
@socketio.on("connect")
def connect():
    print(f"Client connected: {request.sid}")
    
    # Load last 50 messages
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user, text, timestamp 
        FROM messages 
        ORDER BY id DESC 
        LIMIT 50
    """)
    rows = cursor.fetchall()
    conn.close()
    
    # Convert to list of dicts and reverse (oldest first)
    messages = [{"user": r[0], "text": r[1], "timestamp": r[2]} for r in rows]
    messages.reverse()
    
    emit("load_messages", messages)

# ---------------------------
# DISCONNECT
# ---------------------------
@socketio.on("disconnect")
def disconnect():
    sid = request.sid
    user_id = socket_to_user.get(sid)

    if user_id:
        users.pop(user_id, None)
        socket_to_user.pop(sid, None)
        print(f"User {user_id} disconnected")
    else:
        print(f"Unknown client disconnected: {sid}")

    # Always emit clean list
    socketio.emit("update_users", list(users.values()))

# ---------------------------
# LOCATION UPDATE
# ---------------------------
@socketio.on("send_location")
def handle_location(data):
    user_id = data.get("id")
    if not user_id:
        return

    sid = request.sid

    # Store/update user in users dict
    users[user_id] = {
        "id": user_id,
        "name": data.get("name", "Unknown"),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "heading": data.get("heading", 0),
        "timestamp": time.time()
    }

    # Map socket.id -> user_id
    socket_to_user[sid] = user_id

    # Always emit clean list
    socketio.emit("update_users", list(users.values()))

# ---------------------------
# CHAT
# ---------------------------
@socketio.on("send_message")
def handle_message(data):
    user = data.get("user")
    text = data.get("text", "").strip()
    timestamp = data.get("timestamp", time.time())
    
    if not user or not text:
        return

    # Save to SQLite
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO messages (user, text, timestamp) VALUES (?, ?, ?)", 
                   (user, text, timestamp))
    conn.commit()
    conn.close()

    emit("receive_message", data, broadcast=True)

# ---------------------------
# SOS ALERT
# ---------------------------
@socketio.on("sos_alert")
def handle_sos(data):
    print("SOS:", data)
    emit("sos_alert", data, broadcast=True)

# ---------------------------
# RUN SERVER
# ---------------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)