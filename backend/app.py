import eventlet
eventlet.monkey_patch()

import os
from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import time
from bson.objectid import ObjectId

from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from datetime import datetime

# --------------------------------------------------
# DATABASE
# --------------------------------------------------
MONGO_URI = os.environ.get("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["orbit"]

messages_collection = db["messages"]
rooms_collection    = db["rooms"]

# TTL index: auto-delete messages after 24 hours
messages_collection.create_index("createdAt", expireAfterSeconds=86400)

# Unique index: prevents two rooms with the same name at the DB level
rooms_collection.create_index(
    [("roomName", ASCENDING)],
    unique=True,
    name="roomName_unique"
)

# --------------------------------------------------
# FLASK + SOCKETIO
# --------------------------------------------------
app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=True,
    engineio_logger=True
)

# --------------------------------------------------
# In-memory session state (ephemeral — used only for
# live user tracking and socket routing, NOT for room auth)
# --------------------------------------------------
users          = {}  # user_id -> user data
socket_to_user = {}  # sid    -> user_id
socket_to_room = {}  # sid    -> current room

# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def get_room(room_name):
    """Fetch a room document from MongoDB by name. Returns None if not found."""
    return rooms_collection.find_one({"roomName": room_name})


def create_room(room_name, passcode, creator_sid):
    """
    Insert a new private room document.
    Returns (doc, None) on success or (None, error_message) on failure.
    """
    doc = {
        "roomName":  room_name,
        "passcode":  passcode,
        "creator":   creator_sid,
        "createdAt": datetime.utcnow(),
        "isPrivate": True,
    }
    try:
        result = rooms_collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc, None
    except DuplicateKeyError:
        # Race condition: room was created between our find_one and insert_one
        return None, "Room already exists"
    except Exception as e:
        return None, str(e)

# --------------------------------------------------
# CONNECT
# --------------------------------------------------
@socketio.on("connect")
def connect():
    print(f"✅ Client connected: {request.sid}")

# --------------------------------------------------
# JOIN ROOM
# --------------------------------------------------
@socketio.on("join_room")
def handle_join(data):
    print("📦 ROOM DATA:", data)

    room       = (data.get("room") or "Global").strip()
    passcode   = (data.get("passcode") or "").strip()
    is_private = data.get("isPrivate", False)
    sid        = request.sid

    # --------------------------------------------------
    # PRIVATE ROOM AUTH — all state lives in MongoDB
    # --------------------------------------------------
    if is_private:
        existing = get_room(room)

        if existing:
            # Room already exists — verify passcode
            if existing["passcode"] != passcode:
                emit("room_error", {"message": "Invalid room passcode"})
                return
            # Passcode correct — fall through to join

        else:
            # Room is new — create it
            if not passcode:
                emit("room_error", {"message": "Passcode is required to create a private room"})
                return

            _, err = create_room(room, passcode, sid)
            if err:
                emit("room_error", {"message": f"Could not create room: {err}"})
                return

            print(f"🔒 Private room '{room}' created in MongoDB.")

    else:
        # Public join: reject if a private room with this name already exists
        existing = get_room(room)
        if existing:
            emit("room_error", {"message": "That room is private. Use a passcode to join."})
            return

    # --------------------------------------------------
    # LEAVE OLD SOCKET ROOM
    # --------------------------------------------------
    old_room = socket_to_room.get(sid)
    if old_room:
        leave_room(old_room)

    # --------------------------------------------------
    # JOIN SOCKET ROOM
    # --------------------------------------------------
    join_room(room)
    socket_to_room[sid] = room
    print(f"👤 Client {sid} joined room: {room}")

    # --------------------------------------------------
    # LOAD LAST 24 h OF MESSAGES
    # --------------------------------------------------
    cutoff = time.time() - 86400

    messages = list(
        messages_collection.find({
            "room":      room,
            "timestamp": {"$gt": cutoff}
        }).sort("timestamp", 1)
    )

    for msg in messages:
        msg["_id"] = str(msg["_id"])
        msg.pop("createdAt", None)
        msg.setdefault("seenBy", [])
        msg.setdefault("senderId", "unknown")

    emit("load_messages", messages)

    # Server-side confirmation → frontend shows success toast
    emit("room_joined", {"room": room})

# --------------------------------------------------
# DISCONNECT
# --------------------------------------------------
@socketio.on("disconnect")
def disconnect():
    sid     = request.sid
    user_id = socket_to_user.get(sid)
    socket_to_room.pop(sid, None)

    if user_id:
        users.pop(user_id, None)
        socket_to_user.pop(sid, None)
        print(f"🔌 User {user_id} disconnected")
    else:
        print(f"🔌 Unknown client disconnected: {sid}")

    socketio.emit("update_users", list(users.values()))

# --------------------------------------------------
# LOCATION UPDATE
# --------------------------------------------------
@socketio.on("send_location")
def handle_location(data):
    user_id = data.get("id")
    if not user_id:
        return

    sid = request.sid
    users[user_id] = {
        "id":        user_id,
        "name":      data.get("name", "Unknown"),
        "lat":       data.get("lat"),
        "lng":       data.get("lng"),
        "heading":   data.get("heading", 0),
        "timestamp": time.time(),
    }
    socket_to_user[sid] = user_id

    socketio.emit("update_users", list(users.values()))

# --------------------------------------------------
# CHAT — SEND MESSAGE
# --------------------------------------------------
@socketio.on("send_message")
def handle_message(data):
    print("📨 MESSAGE RECEIVED:", data)

    user      = data.get("user")
    text      = data.get("text", "").strip()
    room      = data.get("room", "Global")
    sender_id = data.get("senderId")

    if not user or not text or not sender_id:
        print("❌ INVALID MESSAGE — missing fields")
        return

    message = {
        "senderId":  sender_id,
        "user":      user,
        "text":      text,
        "room":      room,
        "timestamp": time.time(),
        "createdAt": datetime.utcnow(),  # drives TTL index
        "seenBy":    [sender_id],
    }

    result = messages_collection.insert_one(message)
    message.pop("createdAt")  # datetime is not JSON-serialisable

    message_to_send = {**message, "_id": str(result.inserted_id)}
    socketio.emit("receive_message", message_to_send, room=room, include_self=False)

# --------------------------------------------------
# CHAT — MESSAGE SEEN
# --------------------------------------------------
@socketio.on("message_seen")
def handle_message_seen(data):
    message_id = data.get("messageId")
    user_id    = data.get("userId")

    if not message_id or not user_id:
        return

    messages_collection.update_one(
        {"_id": ObjectId(message_id)},
        {"$addToSet": {"seenBy": user_id}}
    )

    updated_msg = messages_collection.find_one({"_id": ObjectId(message_id)})
    if updated_msg:
        updated_msg["_id"] = str(updated_msg["_id"])
        updated_msg.pop("createdAt", None)
        socketio.emit("message_updated", updated_msg, room=updated_msg["room"])

# --------------------------------------------------
# SOS
# --------------------------------------------------
@socketio.on("sos_alert")
def handle_sos(data):
    print("🚨 SOS ALERT:", data)
    socketio.emit("sos_alert", data)

@socketio.on("sos_cancel")
def handle_sos_cancel(data):
    print("🔕 SOS CANCEL:", data)
    socketio.emit("sos_cancel", data)

# --------------------------------------------------
# RUN
# --------------------------------------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)