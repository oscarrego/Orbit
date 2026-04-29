from flask import Flask
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

# In-memory store (fast)
users = {}

# ---------------------------
# CONNECT
# ---------------------------
@socketio.on("connect")
def connect():
    print("User connected")

# ---------------------------
# DISCONNECT
# ---------------------------
@socketio.on("disconnect")
def disconnect():
    print("User disconnected")

# ---------------------------
# LOCATION UPDATE
# ---------------------------
@socketio.on("send_location")
def handle_location(data):
    user_id = data["id"]

    users[user_id] = {
        "id": user_id,
        "name": data["name"],
        "lat": data["lat"],
        "lng": data["lng"],
        "heading": data.get("heading", 0),
        "timestamp": time.time()
    }

    # Broadcast all users
    emit("update_users", list(users.values()), broadcast=True)

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