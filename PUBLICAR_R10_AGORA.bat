@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO R10 - Publicar telas operacionais

echo ============================================================
echo  VESTIBULANDO R10 - TELAS OPERACIONAIS REAIS
echo ============================================================
echo.

if not exist "client\src\features\school\OperationalModuleWorkspace.tsx" goto PACOTE_ANTIGO
findstr /I /C:"CENTRAL OPERACIONAL" "client\src\features\school\OperationalModuleWorkspace.tsx" >nul
if errorlevel 1 goto PACOTE_ANTIGO

echo Atualizacao R10 confirmada nesta pasta.
echo O projeto existente vestibulando sera validado antes do envio.
echo Nenhum projeto novo sera criado.
echo.
call "ATUALIZAR_GITHUB_E_CLOUDFLARE.bat"
exit /b %ERRORLEVEL%

:PACOTE_ANTIGO
echo ERRO: esta pasta nao contem a atualizacao R10.
echo Extraia o ZIP R10 completo em uma pasta nova e execute PUBLICAR_R10_AGORA.bat.
echo Nenhum projeto sera criado e nada sera publicado agora.
pause
exit /b 1
