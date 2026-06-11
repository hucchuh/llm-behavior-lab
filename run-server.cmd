@echo off
cd /d "%~dp0"
echo [%date% %time%] starting LLM Behavior Lab > run-server.log
"C:\Program Files\nodejs\node.exe" app\server.mjs >> run-server.log 2>&1
echo [%date% %time%] node exited with %errorlevel% >> run-server.log
