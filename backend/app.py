import eventlet
eventlet.monkey_patch()

import os
from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import time
from bson.objectid import ObjectId

from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError, OperationFailure
from datetime import datetime

# --------------------------------------------------
# DATABASE
# --------------------------------------------------
MONGO_URI = os.environ.get("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["orbit"]

messages_collection = db["messages"]
rooms_collection    = db["rooms"]

# --------------------------------------------------
# INDEX SETUP  (safe — won't blow up on corrupt state)
# --------------------------------------------------

# TTL index on messages
try:
    messages_collection.create_index("createdAt", expireAfterSeconds=86400)
    print("✅ messages TTL index ready")
except Exception as e:
    print(f"⚠️  messages TTL index error (non-fatal): {e}")

# Unique index on rooms.roomName
# We drop first so a stale/corrupt index from a previous run can't block inserts.
def ensure_rooms_index():
    try:
        existing = rooms_collection.index_information()
        if "roomName_unique" in existing:
            rooms_collection.drop_index("roomName_unique")
            print("🗑️  Dropped stale roomName_unique index")
    except Exception as e:
        print(f"⚠️  Could not drop rooms index (non-fatal): {e}")

    try:
        rooms_collection.create_index(
            [("roomName", ASCENDING)],
            unique=True,
            name="roomName_unique"
        )
        print("✅ rooms unique index ready")
    except OperationFailure as e:
        # This can happen if existing data has duplicate / null roomName values.
        # Clean those up first, then retry.
        print(f"⚠️  Index creation failed (likely dirty data): {e}")
        print("🧹 Removing documents without a valid roomName and retrying...")
        rooms_collection.delete_many({"roomName": {"$exists": False}})
        rooms_collection.delete_many({"roomName": None})
        # Remove duplicates — keep the first occurrence of each roomName
        seen = set()
        for doc in rooms_collection.find({}, {"roomName": 1}):
            name = doc.get("roomName")
            if name in seen:
                rooms_collection.delete_one({"_id": doc["_id"]})
                print(f"🧹 Removed duplicate room doc: {doc['_id']}")
            else:
                seen.add(name)
        # Second attempt
        try:
            rooms_collection.create_index(
                [("roomName", ASCENDING)],
                unique=True,
                name="roomName_unique"
            )
            print("✅ rooms unique index ready (after cleanup)")
        except Exception as e2:
            print(f"❌ FATAL: Could not create rooms index even after cleanup: {e2}")

ensure_rooms_index()

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
# In-memory session state  (ephemeral — NOT used for room auth)
# --------------------------------------------------
users          = {}  # user_id -> user data
socket_to_user = {}  # sid    -> user_id
socket_to_room = {}  # sid    -> current room

# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def get_room(room_name):
    """
    Fetch a room document from MongoDB by roomName.
    Returns the document dict, or None if not found.
    """
    result = rooms_collection.find_one({"roomName": room_name})
    print(f"🔍 get_room('{room_name}') → {'FOUND' if result else 'NOT FOUND'}")
    return result


def create_room(room_name, passcode, creator_sid):
    """
    Insert a new private room.
    Returns (doc, None) on success, (None, error_str) on failure.
    """
    doc = {
        "roomName":  room_name,
        "passcode":  passcode,
        "creator":   creator_sid,
        "createdAt": datetime.utcnow(),
        "isPrivate": True,
    }
    print(f"📝 Attempting to create room: roomName='{room_name}', passcode='{passcode}'")
    try:
        result = rooms_collection.insert_one(doc)
        inserted_id = str(result.inserted_id)
        doc["_id"] = inserted_id
        print(f"✅ Room '{room_name}' created successfully. _id={inserted_id}")
        return doc, None
    except DuplicateKeyError as e:
        print(f"❌ DuplicateKeyError creating room '{room_name}': {e}")
        return None, "Room already exists"
    except Exception as e:
        print(f"❌ Unexpected error creating room '{room_name}': {e}")
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
    print(f"\n{'='*50}")
    print(f"📦 join_room received: {data}")

    room       = (data.get("room") or "Global").strip()
    passcode   = (data.get("passcode") or "").strip()
    is_private = bool(data.get("isPrivate", False))
    sid        = request.sid

    print(f"   room='{room}'  passcode='{passcode}'  is_private={is_private}  sid={sid}")

    # --------------------------------------------------
    # PRIVATE ROOM AUTH
    # --------------------------------------------------
    if is_private:
        print(f"🔒 Private room flow for '{room}'")
        existing = get_room(room)

        if existing:
            print(f"   Room EXISTS in DB. Stored passcode='{existing.get('passcode')}'  Supplied='{passcode}'")
            # Room exists — verify passcode
            if existing["passcode"] != passcode:
                print(f"   ❌ Passcode mismatch")
                emit("room_error", {"message": "Invalid room passcode"})
                return
            print(f"   ✅ Passcode correct — joining")
            # Fall through to join

        else:
            print(f"   Room DOES NOT EXIST — creating it")
            # Room is new — create it
            if not passcode:
                print(f"   ❌ No passcode provided for new private room")
                emit("room_error", {"message": "Passcode is required to create a private room"})
                return

            new_doc, err = create_room(room, passcode, sid)
            if err:
                print(f"   ❌ create_room failed: {err}")
                emit("room_error", {"message": f"Could not create room: {err}"})
                return

            print(f"   ✅ Room created: {new_doc}")

    else:
        print(f"🌐 Public room flow for '{room}'")
        # Public join: block if a private room already owns this name
        existing = get_room(room)
        if existing:
            print(f"   ❌ '{room}' is a private room — blocking public join")
            emit("room_error", {"message": "That room is private. Use a passcode to join."})
            return
        print(f"   ✅ Public room OK")

    # --------------------------------------------------
    # LEAVE OLD SOCKET ROOM
    # --------------------------------------------------
    old_room = socket_to_room.get(sid)
    if old_room:
        leave_room(old_room)
        print(f"   Left old room: '{old_room}'")

    # --------------------------------------------------
    # JOIN SOCKET ROOM
    # --------------------------------------------------
    join_room(room)
    socket_to_room[sid] = room
    print(f"👤 {sid} joined room '{room}'")

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
    emit("room_joined", {"room": room})
    print(f"   Emitted room_joined for '{room}'")
    print(f"{'='*50}\n")

# --------------------------------------------------
# CHECK ROOM  (called before join to decide modal flow)
# --------------------------------------------------
@socketio.on("check_room")
def handle_check_room(data):
    """
    Client sends {room: "roomName"}.
    Server replies with {exists: bool, isPrivate: bool, room: str}.
    No passcode required — metadata lookup only.
    """
    room_name = (data.get("room") or "").strip()
    print(f"🔍 check_room: '{room_name}'")

    if not room_name:
        emit("check_room_result", {"exists": False, "isPrivate": False, "room": room_name})
        return

    doc = get_room(room_name)
    result = {
        "exists":    doc is not None,
        "isPrivate": doc.get("isPrivate", False) if doc else False,
        "room":      room_name,
    }
    print(f"   check_room_result: {result}")
    emit("check_room_result", result)

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
        "createdAt": datetime.utcnow(),
        "seenBy":    [sender_id],
    }

    result = messages_collection.insert_one(message)
    message.pop("createdAt")

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