@echo off
rem Inicia a mesa do Crepusculo dos Reinos (compila e sobe o servidor na porta 3001)
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run mesa
pause
