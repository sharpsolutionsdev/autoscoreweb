@echo off
echo ============================================
echo  DartVoice - Windows Build Script
echo ============================================
echo.

:: Install / upgrade PyInstaller using the same Python that has all packages
python -m pip install --quiet --upgrade pyinstaller

echo Building exe...
python -m PyInstaller DartVoice.spec --noconfirm

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo BUILD FAILED. See errors above.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Build complete!
echo  Distributable folder: dist\DartVoice\
echo  Users run: dist\DartVoice\DartVoice.exe
echo ============================================
pause
