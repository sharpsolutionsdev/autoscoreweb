@echo off
setlocal enabledelayedexpansion
title DartVoice — Build + Package

echo.
echo  ██████╗  █████╗ ██████╗ ████████╗██╗   ██╗ ██████╗ ██╗ ██████╗███████╗
echo  ██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝██║   ██║██╔═══██╗██║██╔════╝██╔════╝
echo  ██║  ██║███████║██████╔╝   ██║   ██║   ██║██║   ██║██║██║     █████╗
echo  ██║  ██║██╔══██║██╔══██╗   ██║   ╚██╗ ██╔╝██║   ██║██║██║     ██╔══╝
echo  ██████╔╝██║  ██║██║  ██║   ██║    ╚████╔╝ ╚██████╔╝██║╚██████╗███████╗
echo  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝     ╚═══╝   ╚═════╝ ╚═╝ ╚═════╝╚══════╝
echo.
echo  Windows Build Script  v1.7
echo  ============================================================
echo.

:: ── Step 0: Check Python ─────────────────────────────────────────────────────
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Python not found on PATH.
    echo  Install Python 3.11 from python.org and make sure "Add to PATH" is ticked.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo  Python: %%i

:: ── Step 1: Install/upgrade build dependencies ───────────────────────────────
echo.
echo  [1/3]  Installing build dependencies...
python -m pip install --quiet --upgrade pyinstaller pillow >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] pip upgrade returned non-zero — continuing anyway
)
echo         Done.

:: ── Step 2: PyInstaller — build the exe ──────────────────────────────────────
echo.
echo  [2/3]  Building DartVoice.exe with PyInstaller...
echo         This takes 1-3 minutes on first run.
echo.
python -m PyInstaller DartVoice.spec --noconfirm --clean

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ============================================================
    echo  [FAILED] PyInstaller build failed. See errors above.
    echo  ============================================================
    pause
    exit /b 1
)

echo.
echo  [2/3]  Exe built:  dist\DartVoice\DartVoice.exe

:: ── Step 3: Inno Setup — build the installer ─────────────────────────────────
echo.
echo  [3/3]  Looking for Inno Setup...

set "ISCC="

:: Check common install locations (64-bit and 32-bit)
for %%P in (
    "%ProgramFiles%\Inno Setup 6\ISCC.exe"
    "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
    "%ProgramFiles%\Inno Setup 5\ISCC.exe"
    "%ProgramFiles(x86)%\Inno Setup 5\ISCC.exe"
    "C:\InnoSetup\ISCC.exe"
) do (
    if exist "%%~P" (
        set "ISCC=%%~P"
        goto :found_iscc
    )
)

:not_found_iscc
echo.
echo  [WARN]  Inno Setup not found. Skipping installer packaging.
echo.
echo  To build the installer later:
echo    1. Download Inno Setup 6 (free): https://jrsoftware.org/isinfo.php
echo    2. Run:  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
echo    3. Installer appears at: installer_output\DartVoice_Setup.exe
echo.
echo  ============================================================
echo  Partial build complete!
echo  The raw app folder is at: dist\DartVoice\
echo  Users can run DartVoice.exe from that folder directly.
echo  ============================================================
pause
exit /b 0

:found_iscc
echo         Found: %ISCC%
echo.
echo         Building installer...

if not exist "installer_output" mkdir installer_output

"%ISCC%" installer.iss

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [FAILED] Inno Setup compile failed. See errors above.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo  BUILD COMPLETE!
echo.
echo  Installer:  installer_output\DartVoice_Setup.exe
echo.
echo  Share that single file with your users.
echo  They double-click it — no Python, no dependencies.
echo  ============================================================
echo.
pause
