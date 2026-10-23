@echo off
chcp 65001 >nul
title Sorte ^& Sangue - servidor local
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node servidor.js
) else (
  echo Node.js nao encontrado. Usando o Python...
  start "" http://localhost:8080
  python -m http.server 8080 --bind 127.0.0.1
)
pause
