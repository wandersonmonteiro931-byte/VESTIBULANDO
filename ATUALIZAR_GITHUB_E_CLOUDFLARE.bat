@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title VESTIBULANDO - Publicacao completa

set "REPO=https://github.com/wandersonmonteiro931-byte/VESTIBULANDO.git"
set "BRANCH=main"
set "PROJECT_NAME=vestibulando"
set "BUILD_DIR=dist\public"
set "SITE=https://vestibulando.pages.dev"
set "SITE_HOST=vestibulando.pages.dev"
set "EXPECTED_CLOUDFLARE_EMAIL=yasminpereiragabrielly88@gmail.com"
set "CF_PROFILE=vestibulando-yasmin"
set "FIREBASE_PROJECT=plataforma-enem-f3682"
set "LOG=ATUALIZACAO_CLOUDFLARE_LOG.txt"
set "NPM_CONFIG_REGISTRY=https://registry.npmjs.org/"
set "npm_config_registry=https://registry.npmjs.org/"
set "NPM_CONFIG_ENGINE_STRICT=false"
set "npm_config_engine_strict=false"
set "FIRESTORE_WARNING=0"
set "GITHUB_WARNING=0"
set "SITE_WARNING=0"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "DEPLOY_ID=%%I"
if not defined DEPLOY_ID set "DEPLOY_ID=manual-%RANDOM%"

> "%LOG%" echo VESTIBULANDO - PUBLICACAO %DEPLOY_ID%
>> "%LOG%" echo Pasta: %CD%
>> "%LOG%" echo Inicio: %DATE% %TIME%

cls
echo ============================================================
echo  VESTIBULANDO - PUBLICAR ATUALIZACAO REAL
echo ============================================================
echo Versao desta tentativa: %DEPLOY_ID%
echo O site sera publicado diretamente no Cloudflare Pages.
echo.

if not exist "package.json" goto ERRO_PASTA
where node >nul 2>&1
if errorlevel 1 goto ERRO_NODE
where npm >nul 2>&1
if errorlevel 1 goto ERRO_NODE

echo [1/9] Conferindo dependencias...
call npm config get registry
if exist "node_modules\vite\package.json" (
  echo Dependencias ja instaladas.
) else (
  echo Instalando dependencias. Isso pode demorar na primeira vez...
  call npm install --legacy-peer-deps --engine-strict=false --registry=https://registry.npmjs.org/ --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
  if errorlevel 1 (
    echo A primeira tentativa falhou. Verificando o cache...
    call npm cache verify
    call npm install --legacy-peer-deps --engine-strict=false --registry=https://registry.npmjs.org/ --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
    if errorlevel 1 goto ERRO_NPM
  )
)
>> "%LOG%" echo [OK] Dependencias conferidas.

echo.
echo [2/9] Validando TypeScript e os 30 modulos...
call npm run check
if errorlevel 1 goto ERRO_VALIDACAO
call npm run verify:school
if errorlevel 1 goto ERRO_VALIDACAO
>> "%LOG%" echo [OK] TypeScript, requisitos e chat protegido validados.

echo.
echo [3/9] Gerando identificador e build de producao...
> "client\public\deploy-version.json" echo {"version":"%DEPLOY_ID%","generatedAt":"%DATE% %TIME%"}
call npm run build:pages
if errorlevel 1 goto ERRO_BUILD
if not exist "%BUILD_DIR%\index.html" goto ERRO_BUILD
if not exist "%BUILD_DIR%\deploy-version.json" goto ERRO_BUILD
>> "%LOG%" echo [OK] Build %DEPLOY_ID% gerado em %BUILD_DIR%.

echo.
echo [4/9] Vinculando exclusivamente ao projeto existente no Cloudflare...
set "CF_PROJECTS=%TEMP%\vestibulando-projetos-%RANDOM%.json"
set "CF_PROJECTS_ERR=%TEMP%\vestibulando-projetos-erro-%RANDOM%.txt"
set "CF_DEPLOYMENTS=%TEMP%\vestibulando-deployments-%RANDOM%.json"
set "CF_DEPLOYMENTS_ERR=%TEMP%\vestibulando-deployments-erro-%RANDOM%.txt"

call :VALIDAR_PROJETO_CLOUDFLARE
if errorlevel 1 (
  echo.
  echo O perfil exclusivo ainda nao esta ligado a conta correta.
  echo Sera aberto o login seguro do Cloudflare.
  echo ENTRE SOMENTE COM: %EXPECTED_CLOUDFLARE_EMAIL%
  echo AUTORIZE A CONTA QUE JA POSSUI: %SITE_HOST%
  echo.
  call npx --yes wrangler auth create "%CF_PROFILE%"
  if errorlevel 1 goto ERRO_CLOUDFLARE_LOGIN
  call :VALIDAR_PROJETO_CLOUDFLARE
  if errorlevel 1 goto ERRO_CLOUDFLARE_CONTA
)
call :LIMPAR_ARQUIVOS_CLOUDFLARE
>> "%LOG%" echo [OK] Perfil %CF_PROFILE% confirmou o projeto existente %SITE_HOST%.

echo.
echo [5/9] Publicando DIRETAMENTE no dominio principal...
echo Projeto: %PROJECT_NAME%
echo Pasta: %BUILD_DIR%
echo Conta autorizada: %EXPECTED_CLOUDFLARE_EMAIL%
set "CI=true"
call npx --yes wrangler pages deploy "%BUILD_DIR%" --project-name="%PROJECT_NAME%" --commit-dirty=true --profile="%CF_PROFILE%" --experimental-provision=false --experimental-auto-create=false <nul
set "CF_DEPLOY_EXIT=!ERRORLEVEL!"
set "CI="
if not "!CF_DEPLOY_EXIT!"=="0" goto ERRO_CLOUDFLARE_DEPLOY
>> "%LOG%" echo [OK] Deploy direto %DEPLOY_ID% concluido no Cloudflare Pages.

echo.
echo [6/9] Aguardando a propagacao no dominio principal...
call powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\confirm-cloudflare-version.ps1" -Site "%SITE%" -ExpectedVersion "%DEPLOY_ID%" -Attempts 18 -DelaySeconds 5
if errorlevel 1 (
  set "SITE_WARNING=1"
  echo AVISO: o Cloudflare confirmou a producao, mas o dominio principal ainda esta propagando.
  echo Aguarde alguns minutos e pressione CTRL + F5. Nenhum novo projeto foi criado.
  >> "%LOG%" echo [AVISO] Deploy aceito; dominio principal ainda nao devolveu %DEPLOY_ID%.
) else (
  >> "%LOG%" echo [OK] Dominio principal confirmou a versao %DEPLOY_ID%.
)

echo.
echo [7/9] Publicando regras e indices do Firestore...
call npx firebase deploy --only firestore:rules,firestore:indexes --project %FIREBASE_PROJECT%
if errorlevel 1 (
  echo Tentando renovar a autenticacao do Firebase...
  call npx firebase login
  if not errorlevel 1 call npx firebase deploy --only firestore:rules,firestore:indexes --project %FIREBASE_PROJECT%
)
if errorlevel 1 (
  set "FIRESTORE_WARNING=1"
  echo AVISO: o site foi atualizado, mas regras/indices do Firestore falharam.
  >> "%LOG%" echo [AVISO] Falha ao publicar regras/indices do Firestore.
) else (
  >> "%LOG%" echo [OK] Regras e indices do Firestore publicados.
)

echo.
echo [8/9] Salvando o mesmo codigo no GitHub...
where git >nul 2>&1
if errorlevel 1 (
  set "GITHUB_WARNING=1"
  echo AVISO: Git nao instalado. O site ja foi atualizado no Cloudflare.
  >> "%LOG%" echo [AVISO] Git nao encontrado.
  goto VERIFICAR_DEPLOY
)

if not exist ".git" git init
git config core.longpaths true
git config core.quotepath false
git branch -M %BRANCH%
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO%"
) else (
  git remote set-url origin "%REPO%"
)

git fetch origin %BRANCH%
if errorlevel 1 (
  set "GITHUB_WARNING=1"
  echo AVISO: nao foi possivel ler o GitHub. O site ja foi atualizado.
  >> "%LOG%" echo [AVISO] Falha no git fetch.
  goto VERIFICAR_DEPLOY
)

git reset --mixed origin/%BRANCH%
if errorlevel 1 (
  set "GITHUB_WARNING=1"
  echo AVISO: nao foi possivel preparar o GitHub. O site ja foi atualizado.
  >> "%LOG%" echo [AVISO] Falha no git reset.
  goto VERIFICAR_DEPLOY
)

git add -A
if errorlevel 1 (
  set "GITHUB_WARNING=1"
  echo AVISO: nao foi possivel preparar os arquivos para o GitHub.
  >> "%LOG%" echo [AVISO] Falha no git add.
  goto VERIFICAR_DEPLOY
)
git diff --cached --quiet
if not errorlevel 1 (
  echo O GitHub ja possui exatamente estes arquivos.
  >> "%LOG%" echo [OK] GitHub sem alteracoes pendentes.
  goto VERIFICAR_DEPLOY
)

git commit -m "Publicacao Vestibulando %DEPLOY_ID%"
if errorlevel 1 (
  set "GITHUB_WARNING=1"
  echo AVISO: falha no commit. O site ja foi atualizado.
  >> "%LOG%" echo [AVISO] Falha no git commit.
  goto VERIFICAR_DEPLOY
)

git push -u origin %BRANCH%
if errorlevel 1 (
  set "GITHUB_WARNING=1"
  echo AVISO: falha no envio ao GitHub. O site ja foi atualizado.
  >> "%LOG%" echo [AVISO] Falha no git push.
) else (
  >> "%LOG%" echo [OK] Codigo enviado ao GitHub.
)

:VERIFICAR_DEPLOY
echo.
echo [9/9] Conferindo a lista de publicacoes do Cloudflare...
call npx --yes wrangler pages deployment list --project-name="%PROJECT_NAME%" --environment=production --profile="%CF_PROFILE%"
if errorlevel 1 (
  echo AVISO: nao foi possivel listar, mas o comando de deploy terminou com sucesso.
  >> "%LOG%" echo [AVISO] Nao foi possivel listar os deployments.
) else (
  >> "%LOG%" echo [OK] Lista de deployments consultada.
)

echo.
echo ============================================================
echo  SITE ATUALIZADO COM SUCESSO
echo ============================================================
echo Versao publicada: %DEPLOY_ID%
echo Endereco: %SITE%
echo.
if "%FIRESTORE_WARNING%"=="1" echo ATENCAO: publique depois as regras e indices do Firestore.
if "%GITHUB_WARNING%"=="1" echo ATENCAO: o backup no GitHub falhou, mas o Cloudflare foi atualizado.
if "%SITE_WARNING%"=="1" echo ATENCAO: o deployment esta em Producao; o dominio principal ainda pode levar alguns minutos.
echo.
echo O navegador sera aberto com um codigo novo para evitar cache antigo.
echo Se ele ja estava aberto, pressione CTRL + F5 uma vez.
>> "%LOG%" echo Fim: %DATE% %TIME%
>> "%LOG%" echo Site: %SITE%/?v=%DEPLOY_ID%
start "" "%SITE%/?v=%DEPLOY_ID%"
pause
exit /b 0

:VALIDAR_PROJETO_CLOUDFLARE
del /q "!CF_PROJECTS!" "!CF_PROJECTS_ERR!" "!CF_DEPLOYMENTS!" "!CF_DEPLOYMENTS_ERR!" >nul 2>&1
call npx --yes wrangler pages project list --json --profile="%CF_PROFILE%" > "!CF_PROJECTS!" 2> "!CF_PROJECTS_ERR!"
if errorlevel 1 (
  if exist "!CF_PROJECTS_ERR!" type "!CF_PROJECTS_ERR!"
  exit /b 1
)
findstr /I /C:"%PROJECT_NAME%" "!CF_PROJECTS!" >nul
if errorlevel 1 exit /b 2
findstr /I /C:"%SITE_HOST%" "!CF_PROJECTS!" >nul
if errorlevel 1 exit /b 3
call npx --yes wrangler pages deployment list --project-name="%PROJECT_NAME%" --environment=production --json --profile="%CF_PROFILE%" > "!CF_DEPLOYMENTS!" 2> "!CF_DEPLOYMENTS_ERR!"
if errorlevel 1 (
  if exist "!CF_DEPLOYMENTS_ERR!" type "!CF_DEPLOYMENTS_ERR!"
  exit /b 4
)
echo Projeto existente confirmado: %SITE_HOST%
exit /b 0

:LIMPAR_ARQUIVOS_CLOUDFLARE
if defined CF_PROJECTS del /q "!CF_PROJECTS!" >nul 2>&1
if defined CF_PROJECTS_ERR del /q "!CF_PROJECTS_ERR!" >nul 2>&1
if defined CF_DEPLOYMENTS del /q "!CF_DEPLOYMENTS!" >nul 2>&1
if defined CF_DEPLOYMENTS_ERR del /q "!CF_DEPLOYMENTS_ERR!" >nul 2>&1
exit /b 0

:ERRO_PASTA
echo ERRO: este BAT precisa ficar na raiz do projeto, ao lado de package.json.
>> "%LOG%" echo [ERRO] BAT fora da raiz.
goto FIM_ERRO

:ERRO_NODE
echo ERRO: Node.js ou npm nao foi encontrado. Instale o Node.js 20 ou superior.
>> "%LOG%" echo [ERRO] Node.js ou npm ausente.
goto FIM_ERRO

:ERRO_NPM
echo ERRO: nao foi possivel instalar as dependencias.
echo Feche outros terminais, apague node_modules e execute novamente.
>> "%LOG%" echo [ERRO] npm install falhou.
goto FIM_ERRO

:ERRO_VALIDACAO
echo ERRO: a validacao falhou. Nada foi publicado.
>> "%LOG%" echo [ERRO] Validacao falhou.
goto FIM_ERRO

:ERRO_BUILD
echo ERRO: o build nao gerou %BUILD_DIR%\index.html corretamente.
>> "%LOG%" echo [ERRO] Build falhou.
goto FIM_ERRO

:ERRO_CLOUDFLARE_LOGIN
call :LIMPAR_ARQUIVOS_CLOUDFLARE
echo ERRO: nao foi possivel autenticar o perfil Cloudflare exclusivo.
echo Entre com %EXPECTED_CLOUDFLARE_EMAIL%.
>> "%LOG%" echo [ERRO] Login Cloudflare falhou.
goto FIM_ERRO

:ERRO_CLOUDFLARE_CONTA
call :LIMPAR_ARQUIVOS_CLOUDFLARE
echo ERRO: o perfil nao encontrou o projeto ORIGINAL %PROJECT_NAME%.
echo Nenhum projeto foi criado e nenhum arquivo foi enviado.
echo NAO escolha a opcao "Create a new project" em nenhuma tela antiga.
echo Execute novamente e entre com %EXPECTED_CLOUDFLARE_EMAIL%.
>> "%LOG%" echo [ERRO] Conta Cloudflare sem o dominio %SITE_HOST%.
goto FIM_ERRO

:ERRO_CLOUDFLARE_DEPLOY
echo ERRO: o Cloudflare recusou a publicacao.
echo O modo protegido impediu a criacao de qualquer projeto novo.
echo Confira acima a mensagem exata para o projeto existente %PROJECT_NAME%.
>> "%LOG%" echo [ERRO] Deploy Cloudflare falhou.
goto FIM_ERRO

:FIM_ERRO
echo.
echo Envie o arquivo %LOG% junto com uma foto desta tela para diagnostico.
pause
exit /b 1
