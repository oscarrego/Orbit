from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
import time

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# MongoDB (optional)
client = MongoClient("mongodb://localhost:27017/")
db = client["orbit"]

# In-memory store
users = {} # user_id -> user data
socket_to_user = {} # sid -> user_id

# ---------------------------
# CONNECT
# ---------------------------
@socketio.on("connect")
def connect():
    print(f"Client connected: {request.sid}")

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