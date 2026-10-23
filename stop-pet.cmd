@echo off
cd /d "%~dp0"
node dsh-pet\bridge\cli.mjs stop
if errorlevel 1 pause
