@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO - Original com chat atual

set "REPO=https://github.com/wandersonmonteiro931-byte/VESTIBULANDO.git"
set "BRANCH=main"
set "SITE=https://vestibulando.pages.dev"
set "FIREBASE_PROJECT=plataforma-enem-f3682"

cls
echo ============================================================
echo  VESTIBULANDO - ORIGINAL COM O CHAT ATUAL
echo ============================================================
echo.
echo Este publicador usa o projeto existente vestibulando.
echo Nenhum projeto novo sera criado.
echo Somente Firestore sera atualizado. Storage nao sera publicado.
echo.

if not exist "package.json" goto ERRO_PASTA
if not exist "client\src\pages\AdminDashboard.tsx" goto ERRO_PACOTE
if not exist "client\src\pages\ChatPage.tsx" goto ERRO_PACOTE
if not exist "client\src\pages\ChatConversationPage.tsx" goto ERRO_PACOTE
findstr /I /C:"AdminDashboard" "client\src\App.tsx" >nul
if errorlevel 1 goto ERRO_PACOTE
findstr /I /C:"ChatConversationPage" "client\src\App.tsx" >nul
if errorlevel 1 goto ERRO_PACOTE

where git >nul 2>&1
if errorlevel 1 goto ERRO_GIT
where node >nul 2>&1
if errorlevel 1 goto ERRO_NODE
where npm >nul 2>&1
if errorlevel 1 goto ERRO_NODE

echo [1/6] Pacote correto confirmado.
echo.
echo [2/6] Instalando dependencias...
call npm install --legacy-peer-deps --no-audit --no-fund
if errorlevel 1 goto ERRO_NPM

echo.
echo [3/6] Testando o site antes de publicar...
call npm run build:pages
if errorlevel 1 goto ERRO_BUILD
if not exist "dist\public\index.html" goto ERRO_BUILD

echo.
echo [4/6] Atualizando as regras e os indices do chat...
call npx firebase deploy --only firestore:rules,firestore:indexes --project %FIREBASE_PROJECT%
if not errorlevel 1 goto FIREBASE_OK

echo.
echo O Firebase precisa confirmar o seu login.
echo O navegador sera aberto. Entre com a conta dona do projeto.
call npx firebase login
if errorlevel 1 goto ERRO_FIREBASE
call npx firebase deploy --only firestore:rules,firestore:indexes --project %FIREBASE_PROJECT%
if errorlevel 1 goto ERRO_FIREBASE

:FIREBASE_OK
echo.
echo [5/6] Preparando a atualizacao no GitHub...
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

git add -A
git diff --cached --quiet
if not errorlevel 1 goto SEM_ALTERACOES

git commit -m "Restaurar visual original e manter chat atual"
if errorlevel 1 goto ERRO_PUSH

echo.
echo [6/6] Enviando para o GitHub e Cloudflare Pages...
git push -u origin %BRANCH%
if errorlevel 1 goto ERRO_PUSH
goto SUCESSO

:SEM_ALTERACOES
echo.
echo [6/6] O GitHub ja possui exatamente estes arquivos.

:SUCESSO
echo.
echo ============================================================
echo  SITE ATUALIZADO COM SUCESSO
echo ============================================================
echo Visual: projeto original enviado por voce.
echo Chat: versao atual mantida.
echo Projeto Cloudflare: vestibulando existente.
echo Aguarde de 1 a 3 minutos para o site atualizar.
echo.
timeout /t 12 /nobreak >nul
start "" "%SITE%"
pause
exit /b 0

:ERRO_PASTA
echo ERRO: execute este arquivo dentro da pasta do projeto.
goto FIM

:ERRO_PACOTE
echo ERRO: esta nao e a pasta ORIGINAL COM CHAT ATUAL.
echo Extraia novamente o ZIP em uma pasta nova.
goto FIM

:ERRO_GIT
echo ERRO: Git nao foi encontrado. Instale o Git para Windows.
goto FIM

:ERRO_NODE
echo ERRO: Node.js ou npm nao foi encontrado.
goto FIM

:ERRO_NPM
echo ERRO: nao foi possivel instalar as dependencias.
goto FIM

:ERRO_BUILD
echo ERRO: o teste do site falhou. Nada foi enviado ao GitHub.
goto FIM

:ERRO_FIREBASE
echo ERRO: as regras do chat nao foram publicadas.
echo Confirme que a conta possui acesso ao projeto %FIREBASE_PROJECT%.
echo Nada foi enviado ao GitHub.
goto FIM

:ERRO_PUSH
echo ERRO: nao foi possivel enviar para o GitHub.
echo Conclua o login do GitHub quando ele for solicitado.
goto FIM

:FIM
echo.
pause
exit /b 1
