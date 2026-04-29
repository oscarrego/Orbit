@echo off

echo Starting Backend...
start cmd /k "cd backend && python app.py"

echo Starting Frontend...
start cmd /k "cd frontend && npm start"