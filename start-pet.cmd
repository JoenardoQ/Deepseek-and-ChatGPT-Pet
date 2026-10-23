@echo off
cd /d "%~dp0"
node dsh-pet\bridge\cli.mjs wake
if errorlevel 1 pause
