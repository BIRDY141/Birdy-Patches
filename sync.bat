@echo off
setlocal
cd /d "%~dp0"

:: Check if portable git exists in ..\git\cmd\git.exe
if exist "%~dp0..\git\cmd\git.exe" (
    set "PATH=%~dp0..\git\cmd;%PATH%"
)

echo ===================================================
echo   Birdy Patches: Automated GitHub Sync
echo ===================================================
echo.

:: 1. Run local test suite to prevent pushing broken code
echo [1/3] Running tests...
powershell -NoProfile -ExecutionPolicy Bypass -File "verify_tests.ps1"
if %errorlevel% neq 0 (
    echo [ERROR] Tests failed! Aborting push to keep GitHub releases clean.
    pause
    exit /b %errorlevel%
)

:: 2. Check for git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or found in PATH.
    pause
    exit /b 1
)

:: 3. Check for changes
echo [2/3] Checking for modified files...
git status -s

:: 4. Commit and push
set /p "msg=Enter commit message (press Enter for default): "
if "%msg%"=="" set "msg=feat: update patches"

git add .
git commit -m "%msg%" >nul 2>&1

echo.
echo [3/3] Pushing changes to GitHub...
:: Clean up stale upstream tags on remote so semantic-release can tag v1.0.0 cleanly
git push origin --delete v1.0.0 v1.0.0-dev.1 v1.1.0 v1.1.0-dev.1 v1.1.0-dev.2 v1.1.0-dev.3 v1.1.0-dev.4 v1.1.1 v1.1.1-dev.1 v1.1.1-dev.2 v1.2.0 v1.2.0-dev.1 v1.2.0-dev.2 v1.2.0-dev.3 v1.3.0 v1.3.0-dev.1 v1.3.0-dev.2 v1.3.0-dev.3 v1.4.0 v1.4.0-dev.1 v1.4.1 v1.4.1-dev.1 v1.4.2 v1.4.2-dev.1 v1.5.0 v1.5.0-dev.1 v1.5.1 v1.5.1-dev.1 v1.6.0 v1.6.0-dev.1 v1.7.0 v1.7.0-dev.1 v1.7.0-dev.10 v1.7.0-dev.11 v1.7.0-dev.2 v1.7.0-dev.3 v1.7.0-dev.4 v1.7.0-dev.5 v1.7.0-dev.6 v1.7.0-dev.7 v1.7.0-dev.8 v1.7.0-dev.9 >nul 2>&1
git push origin main
if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo  SUCCESS: Pushed to GitHub!
    echo  GitHub Actions is now compiling your Morphe release.
    echo ===================================================
) else (
    echo.
    echo [ERROR] Push failed. Check your network or GitHub credentials.
)

pause
