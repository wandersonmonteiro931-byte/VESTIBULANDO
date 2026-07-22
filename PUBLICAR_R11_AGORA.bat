@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO R11 - Publicar novo app

echo ============================================================
echo  VESTIBULANDO R11 - NOVO APP ESCOLAR
echo ============================================================
echo.

if not exist "client\src\features\school-v2\SchoolOS.tsx" goto PACOTE_ANTIGO
findstr /I /C:"R11-NOVO-APP" "client\src\features\school-v2\SchoolOS.tsx" >nul
if errorlevel 1 goto PACOTE_ANTIGO
if not exist "client\src\features\school-v2\school-os.css" goto PACOTE_ANTIGO
findstr /I /C:"school-task-workbench" "client\src\features\school-v2\school-os.css" >nul
if errorlevel 1 goto PACOTE_ANTIGO

echo Novo app R11 confirmado nesta pasta.
echo As 30 secoes e o chat protegido serao validados antes do envio.
echo O projeto existente vestibulando sera usado.
echo Nenhum projeto novo e nenhum Storage serao criados.
echo.
call "ATUALIZAR_GITHUB_E_CLOUDFLARE.bat"
exit /b %ERRORLEVEL%

:PACOTE_ANTIGO
echo ERRO: esta pasta nao contem o novo app R11 completo.
echo Extraia o ZIP R11 em uma pasta nova e execute PUBLICAR_R11_AGORA.bat.
echo Nenhum projeto sera criado e nada sera publicado agora.
pause
exit /b 1
