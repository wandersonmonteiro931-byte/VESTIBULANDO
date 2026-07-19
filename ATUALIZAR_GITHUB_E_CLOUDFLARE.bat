@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO - Atualizar GitHub e Cloudflare

set "REPO=https://github.com/wandersonmonteiro931-byte/VESTIBULANDO.git"
set "BRANCH=main"
set "SITE=https://vestibulando.pages.dev"
set "FIREBASE_PROJECT=plataforma-enem-f3682"
set "NPM_CONFIG_REGISTRY=https://registry.npmjs.org/"
set "npm_config_registry=https://registry.npmjs.org/"
set "NPM_CONFIG_ENGINE_STRICT=false"
set "npm_config_engine_strict=false"

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

echo Registro npm utilizado:
call npm config get registry
echo.

echo [1/6] Conferindo dependencias...
if exist "node_modules\vite\package.json" (
  echo Dependencias ja instaladas. Pulando npm install.
) else (
  echo Instalando pelo registro oficial do npm...
  call npm install --legacy-peer-deps --engine-strict=false --registry=https://registry.npmjs.org/ --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
  if errorlevel 1 (
    echo.
    echo A primeira tentativa falhou. Verificando o cache e tentando novamente...
    call npm cache verify
    timeout /t 5 /nobreak >nul
    call npm install --legacy-peer-deps --engine-strict=false --registry=https://registry.npmjs.org/ --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
    if errorlevel 1 goto ERRO_NPM
  )
)

echo.
echo [2/6] Testando o build do Cloudflare Pages...
call npm run build:pages
if errorlevel 1 goto ERRO_BUILD
if not exist "dist\public\index.html" goto ERRO_BUILD

echo.
echo [3/6] Publicando regras e indices do Firestore...
call npx firebase deploy --only firestore:rules,firestore:indexes --project %FIREBASE_PROJECT%
if errorlevel 1 (
  echo.
  echo O Firebase precisa de autorizacao neste computador.
  echo O navegador sera aberto para fazer login.
  call npx firebase login
  if errorlevel 1 goto ERRO_FIREBASE
  call npx firebase deploy --only firestore:rules,firestore:indexes --project %FIREBASE_PROJECT%
  if errorlevel 1 goto ERRO_FIREBASE
)

echo.
echo [4/6] Preparando o GitHub...
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
echo [5/6] Criando a atualizacao...
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
echo [6/6] Enviando para o GitHub...
git push -u origin %BRANCH%
if errorlevel 1 goto ERRO_PUSH

echo.
echo ============================================================
echo ATUALIZACAO ENVIADA COM SUCESSO!
echo ============================================================
echo O Cloudflare Pages fara o deploy automaticamente.
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
echo.
echo ERRO: falha ao instalar as dependencias pelo registro oficial.
echo Feche VS Code, terminais e pastas abertas neste projeto.
echo Depois apague a pasta node_modules, se ela existir, e execute novamente.
goto FIM
:ERRO_BUILD
echo ERRO: o projeto nao conseguiu gerar dist\public\index.html.
goto FIM

:ERRO_FIREBASE
echo ERRO: nao foi possivel publicar as regras do Firebase.
echo Sem essas regras, o modulo Financeiro nao conseguira salvar ou ler faturas.
echo Confirme o login da conta que administra o projeto %FIREBASE_PROJECT%.
goto FIM

:ERRO_PUSH
echo ERRO: nao foi possivel enviar para o GitHub.
echo Na primeira vez, conclua o login do GitHub quando solicitado.
goto FIM
:FIM
echo.
pause
exit /b 1
