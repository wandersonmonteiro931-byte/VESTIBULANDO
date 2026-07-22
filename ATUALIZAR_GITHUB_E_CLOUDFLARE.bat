@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO - Enviar atualizacao para GitHub

set "REPO=https://github.com/wandersonmonteiro931-byte/VESTIBULANDO.git"
set "BRANCH=main"
set "SITE=https://vestibulando.pages.dev"

cls
echo ============================================================
echo  VESTIBULANDO - ATUALIZAR GITHUB E CLOUDFLARE PAGES
echo ============================================================
echo.

if not exist "package.json" goto ERRO_PASTA
where git >nul 2>&1
if errorlevel 1 goto ERRO_GIT
where node >nul 2>&1
if errorlevel 1 goto ERRO_NODE
where npm >nul 2>&1
if errorlevel 1 goto ERRO_NODE

echo [1/5] Instalando dependencias...
call npm install --legacy-peer-deps --no-audit --no-fund
if errorlevel 1 goto ERRO_NPM

echo.
echo [2/5] Testando o build do Cloudflare Pages...
call npm run build:pages
if errorlevel 1 goto ERRO_BUILD
if not exist "dist\public\index.html" goto ERRO_BUILD

echo.
echo [3/5] Preparando o GitHub...
if not exist ".git" (
  git init
  if errorlevel 1 goto ERRO_PUSH
)

git branch -M %BRANCH%
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO%"
) else (
  git remote set-url origin "%REPO%"
)

git fetch origin %BRANCH%
if errorlevel 1 goto ERRO_PUSH

git reset origin/%BRANCH%
if errorlevel 1 goto ERRO_PUSH

echo.
echo [4/5] Criando a atualizacao...
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo Nenhuma alteracao nova encontrada.
  goto ABRIR_SITE
)

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "DATA=%%a-%%b-%%c"
for /f "tokens=1-2 delims=:" %%a in ("%time%") do set "HORA=%%a-%%b"
git commit -m "Atualizacao automatica %DATA% %HORA%"
if errorlevel 1 goto ERRO_PUSH

echo.
echo [5/5] Enviando para o GitHub...
git push -u origin %BRANCH%
if errorlevel 1 goto ERRO_PUSH

echo.
echo ============================================================
echo ATUALIZACAO ENVIADA COM SUCESSO!
echo ============================================================
echo O Cloudflare Pages fara o deploy automaticamente se o

echo repositorio estiver conectado ao projeto vestibulando.
echo Aguarde cerca de 1 a 3 minutos.

:ABRIR_SITE
timeout /t 8 /nobreak >nul
start "" "%SITE%"
pause
exit /b 0

:ERRO_PASTA
echo ERRO: coloque este BAT na raiz do projeto, ao lado do package.json.
goto FIM
:ERRO_GIT
echo ERRO: Git nao foi encontrado. Instale o Git para Windows.
goto FIM
:ERRO_NODE
echo ERRO: Node.js ou npm nao foi encontrado.
goto FIM
:ERRO_NPM
echo ERRO: falha ao instalar as dependencias.
goto FIM
:ERRO_BUILD
echo ERRO: o projeto nao conseguiu gerar dist\public\index.html.
goto FIM
:ERRO_PUSH
echo ERRO: nao foi possivel enviar para o GitHub.
echo Na primeira vez, conclua o login do GitHub quando solicitado.
goto FIM
:FIM
echo.
pause
exit /b 1
