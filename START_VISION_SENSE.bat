@echo off
cd /d "%~dp0"
start "" pythonw vision_sense_launcher.py
timeout /t 2 /nobreak >nul
start "" index.html
