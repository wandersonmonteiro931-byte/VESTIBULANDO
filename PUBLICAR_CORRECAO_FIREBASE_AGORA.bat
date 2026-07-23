@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title VESTIBULANDO - Corrigir Firebase e publicar original MAIN2

set "REPO=https://github.com/wandersonmonteiro931-byte/VESTIBULANDO.git"
set "BRANCH=main"
set "SITE=https://vestibulando.pages.dev"
set "FIREBASE_PROJECT=plataforma-enem-f3682"
set "BUILD_DIR=dist\public"
set "LOG=ATUALIZACAO_ORIGINAL_MAIN2_LOG.txt"
set "NPM_CONFIG_REGISTRY=https://registry.npmjs.org/"
set "npm_config_registry=https://registry.npmjs.org/"
set "NPM_CONFIG_ENGINE_STRICT=false"
set "npm_config_engine_strict=false"
set "FIRESTORE_WARNING=0"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "DEPLOY_ID=%%I"
if not defined DEPLOY_ID set "DEPLOY_ID=manual-%RANDOM%"

> "%LOG%" echo VESTIBULANDO MAIN2 COM CHAT ATUAL - %DEPLOY_ID%
>> "%LOG%" echo Pasta: %CD%
>> "%LOG%" echo Inicio: %DATE% %TIME%

cls
echo ============================================================
echo  VESTIBULANDO - CORRECAO FIREBASE + ORIGINAL MAIN2
echo ============================================================
echo.
echo Este publicador atualiza o projeto EXISTENTE vestibulando.pages.dev.
echo Ele NAO cria projeto Cloudflare e NAO usa Firebase Storage.
echo.

if not exist "package.json" goto ERRO_PASTA
if not exist "BASE-OFICIAL-MAIN2-COM-CHAT-ATUAL.txt" goto ERRO_PACOTE
findstr /I /C:"BASE-OFICIAL-VESTIBULANDO-MAIN2-CHAT-ATUAL-FIREBASE-OK" "BASE-OFICIAL-MAIN2-COM-CHAT-ATUAL.txt" >nul
if errorlevel 1 goto ERRO_PACOTE
if not exist "client\.env.production" goto ERRO_FIREBASE_CONFIG
findstr /I /C:"VITE_FIREBASE_PROJECT_ID=plataforma-enem-f3682" "client\.env.production" >nul
if errorlevel 1 goto ERRO_FIREBASE_CONFIG
findstr /I /C:"VITE_FIREBASE_API_KEY=AIzaSyAKPmqetUP_w8SGqr3ooLXAbASpFlRNWBY" "client\.env.production" >nul
if errorlevel 1 goto ERRO_FIREBASE_CONFIG
findstr /I /C:"VITE_FIREBASE_APP_ID=1:1086290785401:web:123ba3c7d224b6497710a8" "client\.env.production" >nul
if errorlevel 1 goto ERRO_FIREBASE_CONFIG
if not exist "client\src\pages\AdminDashboard.tsx" goto ERRO_PACOTE
if not exist "client\src\pages\StudentDashboard.tsx" goto ERRO_PACOTE
if not exist "client\src\pages\TeacherDashboard.tsx" goto ERRO_PACOTE
if not exist "client\src\pages\ChatPage.tsx" goto ERRO_PACOTE
if not exist "client\src\components\ChatWindow.tsx" goto ERRO_PACOTE
if not exist "client\src\hooks\useTypingIndicator.ts" goto ERRO_PACOTE
findstr /I /C:"UserPresenceIndicator" "client\src\pages\ChatPage.tsx" >nul
if errorlevel 1 goto ERRO_PACOTE
findstr /I /C:"participante1UltimaDigitacao" "client\src\hooks\useTypingIndicator.ts" >nul
if errorlevel 1 goto ERRO_PACOTE

where node >nul 2>&1
if errorlevel 1 goto ERRO_NODE
where npm >nul 2>&1
if errorlevel 1 goto ERRO_NODE
where git >nul 2>&1
if errorlevel 1 goto ERRO_GIT

echo [1/6] Conferindo dependencias...
if exist "node_modules\vite\package.json" (
  echo Dependencias ja instaladas.
) else (
  call npm ci --legacy-peer-deps --engine-strict=false --registry=https://registry.npmjs.org/ --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
  if errorlevel 1 (
    echo A instalacao exata falhou. Tentando instalacao compativel...
    call npm install --legacy-peer-deps --engine-strict=false --registry=https://registry.npmjs.org/ --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
    if errorlevel 1 goto ERRO_NPM
  )
)
>> "%LOG%" echo [OK] Dependencias conferidas.

echo.
echo [2/6] Gerando a versao e o build de producao...
if not exist "client\public" mkdir "client\public"
> "client\public\deploy-version.json" echo {"version":"%DEPLOY_ID%","source":"MAIN2-ORIGINAL-CHAT-ATUAL-FIREBASE-OK"}
call npm run build:pages
if errorlevel 1 goto ERRO_BUILD
if not exist "%BUILD_DIR%\index.html" goto ERRO_BUILD
if not exist "%BUILD_DIR%\deploy-version.json" goto ERRO_BUILD
>> "%LOG%" echo [OK] Build %DEPLOY_ID% gerado.

echo.
echo [3/6] Publicando regras e indices do chat no Firestore...
call npx firebase deploy --only firestore:rules,firestore:indexes --project %FIREBASE_PROJECT%
if errorlevel 1 (
  set "FIRESTORE_WARNING=1"
  echo AVISO: as regras do chat nao foram publicadas nesta tentativa.
  echo O site continuara sendo atualizado. O detalhe ficou salvo no log.
  >> "%LOG%" echo [AVISO] Firestore nao foi publicado.
) else (
  >> "%LOG%" echo [OK] Regras e indices do Firestore publicados.
)

echo.
echo [4/6] Enviando o original MAIN2 ao GitHub conectado ao Cloudflare...
if not exist ".git" git init
git config core.longpaths true
git config core.quotepath false
git config user.name "Vestibulando Publisher"
git config user.email "vestibulando@users.noreply.github.com"
git branch -M %BRANCH%
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO%"
) else (
  git remote set-url origin "%REPO%"
)

git fetch origin %BRANCH%
if errorlevel 1 goto ERRO_GITHUB
git reset --mixed origin/%BRANCH%
if errorlevel 1 goto ERRO_GITHUB
git add -A
if errorlevel 1 goto ERRO_GITHUB
git add -f "client\.env.production"
if errorlevel 1 goto ERRO_GITHUB
git commit -m "Corrigir Firebase no original MAIN2 %DEPLOY_ID%"
if errorlevel 1 goto ERRO_GITHUB
git push -u origin %BRANCH%
if errorlevel 1 goto ERRO_GITHUB
>> "%LOG%" echo [OK] Codigo enviado ao GitHub.

echo.
echo [5/6] Aguardando o deploy automatico do projeto existente...
call powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\confirm-cloudflare-version.ps1" -Site "%SITE%" -ExpectedVersion "%DEPLOY_ID%" -Attempts 48 -DelaySeconds 5
if errorlevel 1 goto AVISO_PROPAGACAO
>> "%LOG%" echo [OK] Dominio confirmou %DEPLOY_ID%.

echo.
echo [6/6] Abrindo a versao nova sem cache...
goto SUCESSO

:SUCESSO
echo.
echo ============================================================
echo  SITE ATUALIZADO E CONFIRMADO
echo ============================================================
echo Versao: %DEPLOY_ID%
echo Endereco: %SITE%
if "%FIRESTORE_WARNING%"=="1" echo ATENCAO: envie o arquivo %LOG% para corrigirmos a publicacao das regras do chat.
echo.
echo O navegador sera aberto com um codigo novo para evitar cache antigo.
start "" "%SITE%/?v=%DEPLOY_ID%"
>> "%LOG%" echo Fim: %DATE% %TIME%
pause
exit /b 0

:AVISO_PROPAGACAO
echo.
echo ============================================================
echo  CODIGO ENVIADO - CLOUDFLARE AINDA PROCESSANDO
echo ============================================================
echo O GitHub recebeu a versao %DEPLOY_ID%, mas o dominio demorou mais de 4 minutos.
echo Aguarde dois minutos, abra %SITE% e pressione CTRL + F5.
echo Nenhum projeto novo foi criado.
>> "%LOG%" echo [AVISO] GitHub atualizado; dominio ainda propagando.
start "" "%SITE%/?v=%DEPLOY_ID%"
pause
exit /b 0

:ERRO_PASTA
echo ERRO: este arquivo precisa ficar ao lado de package.json.
goto FIM_ERRO

:ERRO_PACOTE
echo ERRO: esta nao e a pasta MAIN2 original com o chat atual.
echo Extraia novamente o ZIP em uma PASTA NOVA e execute este arquivo nela.
goto FIM_ERRO

:ERRO_FIREBASE_CONFIG
echo ERRO: a configuracao publica do Firebase nao esta completa nesta pasta.
echo Baixe e extraia novamente o pacote FIREBASE CORRIGIDO em uma pasta nova.
goto FIM_ERRO

:ERRO_NODE
echo ERRO: Node.js ou npm nao foi encontrado. Instale o Node.js 20 ou superior.
goto FIM_ERRO

:ERRO_GIT
echo ERRO: Git nao foi encontrado. Instale o Git para Windows e tente novamente.
goto FIM_ERRO

:ERRO_NPM
echo ERRO: nao foi possivel instalar as dependencias.
echo Verifique a internet e execute este arquivo novamente.
goto FIM_ERRO

:ERRO_BUILD
echo ERRO: o sistema nao compilou. Nada foi enviado ao GitHub ou Cloudflare.
goto FIM_ERRO

:ERRO_GITHUB
echo ERRO: nao foi possivel enviar ao repositorio VESTIBULANDO.
echo Se uma janela de login abrir, entre na conta GitHub ligada ao repositorio.
echo Nenhum projeto Cloudflare novo foi criado.
goto FIM_ERRO

:FIM_ERRO
>> "%LOG%" echo [ERRO] Falha em %DATE% %TIME%.
echo.
echo Envie o arquivo %LOG% junto com uma foto desta tela.
pause
exit /b 1
