@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
title Avaliacao Fisica

set PY=
where py >nul 2>nul && set PY=py -3
if not defined PY (
  python --version >nul 2>nul && set PY=python
)
if not defined PY (
  echo.
  echo  Python nao encontrado.
  echo  Instale em python.org/downloads e marque a opcao "Add Python to PATH".
  echo  Depois feche esta janela e de dois cliques neste arquivo de novo.
  echo.
  start "" https://www.python.org/downloads/
  pause
  exit /b 1
)

echo.
echo  ============ Avaliacao Fisica ============
echo.
echo    1 - Usar so no notebook
echo    2 - Notebook + celular no mesmo Wi-Fi  [fotos com camera guiada]
echo.
set OP=1
set /p OP=  Digite 1 ou 2 e aperte Enter: 
echo.
if "%OP%"=="2" goto celular

%PY% servidor.py --abrir
goto fim

:celular
echo  O navegador vai mostrar um aviso de seguranca na primeira vez:
echo  clique em Avancado e depois em Continuar. O certificado foi gerado neste notebook.
echo  Se o Windows perguntar sobre o Firewall, marque Redes privadas e clique em Permitir.
echo.
%PY% servidor.py --rede --https --abrir

:fim
echo.
pause
