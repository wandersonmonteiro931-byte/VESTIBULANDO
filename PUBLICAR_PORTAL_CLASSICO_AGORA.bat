@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO - Publicar portal classico

cls
echo ============================================================
echo  VESTIBULANDO - PORTAL CLASSICO PAIS E ALUNOS
echo ============================================================
echo.

if not exist "package.json" goto PACOTE_ERRADO
if not exist "client\src\portal-reference.css" goto PACOTE_ERRADO
if not exist "client\src\components\PortalProfileHeader.tsx" goto PACOTE_ERRADO
if not exist "client\src\components\DashboardSidebar.tsx" goto PACOTE_ERRADO
if not exist "client\src\pages\ChatConversationPage.tsx" goto PACOTE_ERRADO

findstr /I /C:"portal-profile-card" "client\src\components\PortalProfileHeader.tsx" >nul
if errorlevel 1 goto PACOTE_ERRADO
findstr /I /C:"portal-navigation" "client\src\components\DashboardSidebar.tsx" >nul
if errorlevel 1 goto PACOTE_ERRADO
findstr /I /C:"portal-primary-tabs" "client\src\components\DashboardSidebar.tsx" >nul
if errorlevel 1 goto PACOTE_ERRADO
findstr /I /C:"ChatConversationPage" "client\src\App.tsx" >nul
if errorlevel 1 goto PACOTE_ERRADO

echo Pacote correto confirmado.
echo Visual: portal classico com navegacao horizontal.
echo Chat: versao atual preservada.
echo Projeto: vestibulando existente.
echo.

call "ATUALIZAR_GITHUB_E_CLOUDFLARE.bat"
exit /b %ERRORLEVEL%

:PACOTE_ERRADO
echo ============================================================
echo  ESTA NAO E A PASTA DO PORTAL CLASSICO
echo ============================================================
echo Extraia o novo ZIP em uma pasta nova e execute somente:
echo PUBLICAR_PORTAL_CLASSICO_AGORA.bat
echo.
echo Nenhum arquivo foi publicado.
pause
exit /b 1
