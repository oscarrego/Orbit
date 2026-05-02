import eventlet
eventlet.monkey_patch()

from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import time

from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["orbit"]
messages_collection = db["messages"]

app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=True,
    engineio_logger=True
)

# In-memory store
users = {} # user_id -> user data
socket_to_user = {} # sid -> user_id
socket_to_room = {} # sid -> current room

# ---------------------------
# CONNECT
# ---------------------------
@socketio.on("connect")
def connect():
    print(f"Client connected: {request.sid}")
    # Removed database loading - chat starts empty

# ---------------------------
# JOIN ROOM
# ---------------------------
@socketio.on("join_room")
def handle_join(data):
    room = data.get("room", "Global")
    sid = request.sid

    # Leave old room
    old_room = socket_to_room.get(sid)
    if old_room:
        leave_room(old_room)

    join_room(room)
    socket_to_room[sid] = room

    print(f"Client {sid} joined room: {room}")

    # 🔥 LOAD OLD MESSAGES FROM MONGO
    messages = list(
        messages_collection.find({"room": room}).sort("timestamp", 1)
    )

    for msg in messages:
        msg["_id"] = str(msg["_id"])

    emit("load_messages", messages)
# ---------------------------
# DISCONNECT
# ---------------------------
@socketio.on("disconnect")
def disconnect():
    sid = request.sid
    user_id = socket_to_user.get(sid)
    socket_to_room.pop(sid, None)

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
    print("📨 MESSAGE RECEIVED:", data)

    user = data.get("user")
    text = data.get("text", "").strip()
    room = data.get("room", "Global")

    if not user or not text:
        print("❌ INVALID MESSAGE")
        return

    message = {
        "user": user,
        "text": text,
        "room": room,
        "timestamp": time.time()
    }

    messages_collection.insert_one(message)
    print("💾 SAVED TO MONGO")

    # Fix: Convert ObjectId to string to prevent JSON serialization error during socketio emit
    message["_id"] = str(message["_id"])

    print("🚀 EMITTING TO ROOM:", room)

    socketio.emit("receive_message", message, room=room, include_self=False)
# ---------------------------
# SOS ALERT
# ---------------------------
@socketio.on("sos_alert")
def handle_sos(data):
    print("SOS ALERT:", data)
    socketio.emit("sos_alert", data) # Global broadcast to all
    
@socketio.on("sos_cancel")
def handle_sos_cancel(data):
    print("SOS CANCEL:", data)
    socketio.emit("sos_cancel", data) # Global broadcast to all

# ---------------------------
# RUN SERVER
# ---------------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)