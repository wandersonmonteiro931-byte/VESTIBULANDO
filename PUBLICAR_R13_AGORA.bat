@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO R13 - Publicar paginas separadas

echo ============================================================
echo  VESTIBULANDO R13 - CADA TAREFA EM SUA PAGINA
echo ============================================================
echo.

if not exist "client\src\features\school-v2\SchoolOS.tsx" goto PACOTE_ANTIGO
findstr /I /C:"R13-PAGINAS-SEPARADAS" "client\src\features\school-v2\SchoolOS.tsx" >nul
if errorlevel 1 goto PACOTE_ANTIGO
if not exist "client\src\features\school-v2\school-os.css" goto PACOTE_ANTIGO
findstr /I /C:"school-task-workbench" "client\src\features\school-v2\school-os.css" >nul
if errorlevel 1 goto PACOTE_ANTIGO
if not exist "client\src\features\school\OperationalModuleWorkspace.tsx" goto PACOTE_ANTIGO
findstr /I /C:"openTask(blueprint)" "client\src\features\school\OperationalModuleWorkspace.tsx" >nul
if errorlevel 1 goto PACOTE_ANTIGO
if not exist "client\src\features\school\SchoolTaskPage.tsx" goto PACOTE_ANTIGO
findstr /I /C:"data-task-id" "client\src\features\school\SchoolTaskPage.tsx" >nul
if errorlevel 1 goto PACOTE_ANTIGO

echo Atualizacao R13 confirmada nesta pasta.
echo As 483 acoes, as 30 secoes e o chat protegido serao validados.
echo Cada tarefa abrira em uma pagina propria com URL individual.
echo O projeto existente vestibulando sera usado.
echo Nenhum projeto novo e nenhum Storage serao criados.
echo.
call "ATUALIZAR_GITHUB_E_CLOUDFLARE.bat"
exit /b %ERRORLEVEL%

:PACOTE_ANTIGO
echo ERRO: esta pasta nao contem a atualizacao R13 completa.
echo Extraia o ZIP R13 em uma pasta nova e execute PUBLICAR_R13_AGORA.bat.
echo Nenhum projeto sera criado e nada sera publicado agora.
pause
exit /b 1
