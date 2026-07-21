@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
echo Este atalho foi substituido pela atualizacao R10.
echo Abrindo o publicador correto...
echo.
call "PUBLICAR_R10_AGORA.bat"
exit /b %ERRORLEVEL%
