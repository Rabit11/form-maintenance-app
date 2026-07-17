@echo off
setlocal
cd /d "%~dp0"
set PORT=18088
"C:\Program Files\nodejs\node.exe" server\src\index.js
