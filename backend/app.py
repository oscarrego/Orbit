import eventlet
eventlet.monkey_patch()
import os


from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import time
from bson.objectid import ObjectId

from pymongo import MongoClient
from datetime import datetime, timedelta

MONGO_URI = os.environ.get("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["orbit"]
messages_collection = db["messages"]

# 🔥 Create TTL index (automatically delete after 24 hours)
messages_collection.create_index("createdAt", expireAfterSeconds=86400)

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

    # 🔥 LOAD OLD MESSAGES FROM MONGO (Only from last 24 hours)
    cutoff = time.time() - 86400
    messages = list(
        messages_collection.find({
            "room": room,
            "timestamp": {"$gt": cutoff}
        }).sort("timestamp", 1)
    )

    for msg in messages:
        msg["_id"] = str(msg["_id"])
        if "createdAt" in msg:
            msg.pop("createdAt") # Remove datetime object before emitting JSON
        if "seenBy" not in msg:
            msg["seenBy"] = []
        if "senderId" not in msg:
            msg["senderId"] = "unknown"

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
    sender_id = data.get("senderId")

    if not user or not text or not sender_id:
        print("❌ INVALID MESSAGE")
        return

    message = {
        "senderId": sender_id,
        "user": user,
        "text": text,
        "room": room,
        "timestamp": time.time(),
        "createdAt": datetime.utcnow(), # 🔥 Field for MongoDB TTL index
        "seenBy": [sender_id]
    }

    result = messages_collection.insert_one(message)

    # Remove createdAt before sending back (datetime not JSON serializable)
    message.pop("createdAt")


    message_to_send = {
        **message,
        "_id": str(result.inserted_id)
    }

    socketio.emit("receive_message", message_to_send, room=room, include_self=False)

@socketio.on("message_seen")
def handle_message_seen(data):
    message_id = data.get("messageId")
    user_id = data.get("userId")

    if not message_id or not user_id:
        return

    messages_collection.update_one(
        {"_id": ObjectId(message_id)},
        {"$addToSet": {"seenBy": user_id}}
    )

    updated_msg = messages_collection.find_one({"_id": ObjectId(message_id)})
    if updated_msg:
        updated_msg["_id"] = str(updated_msg["_id"])
        socketio.emit("message_updated", updated_msg, room=updated_msg["room"])
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