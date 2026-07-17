@echo off
setlocal
cd /d "%~dp0"
set PORT=8068
"C:\Program Files\nodejs\node.exe" server\src\index.js >> deploy-8068.out.log 2>> deploy-8068.err.log
