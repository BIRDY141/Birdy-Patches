@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo          BirdyTV: Automated Morphe Patch ^& ADB TV Deployment
echo ======================================================================
echo.

:: 1. Setup PATH for portable tools
if exist "%~dp0..\git\cmd\git.exe" (
    set "PATH=%~dp0..\git\cmd;%PATH%"
)
if exist "%~dp0..\tv clean up\platform-tools\adb.exe" (
    set "ADB_EXE=%~dp0..\tv clean up\platform-tools\adb.exe"
) else (
    where adb >nul 2>&1
    if !errorlevel! equ 0 (
        set "ADB_EXE=adb"
    ) else (
        echo [ERROR] adb.exe not found in 'tv clean up\platform-tools' or PATH.
        pause
        exit /b 1
    )
)

:: 2. TV IP Configuration
if exist "tv_ip.txt" (
    set /p TV_IP=<tv_ip.txt
)
if "%TV_IP%"=="" (
    echo Enter your Android TV IP address (found in TV Settings ^> Network):
    set /p "TV_IP=IP Address: "
    echo !TV_IP!> tv_ip.txt
)
echo [Target TV] %TV_IP%:5555
echo (To change TV IP, edit or delete 'tv_ip.txt')
echo.

:: 3. Step 1: Sync with GitHub
echo [1/4] Syncing patches with GitHub...
call "sync.bat"
if %errorlevel% neq 0 (
    echo [WARNING] GitHub sync did not complete cleanly. Continuing local deployment...
)

:: 4. Step 2: Locate or Download Morphe CLI & Base APK
set "MORPHE_CLI=morphe-cli.jar"
set "BASE_APK=youtube-tv.apk"
set "OUTPUT_APK=birdytv-patched.apk"

if not exist "%MORPHE_CLI%" (
    echo.
    echo [Notice] '%MORPHE_CLI%' not found in this folder.
    echo Downloading latest Morphe CLI...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/MorpheApp/morphe-cli/releases/latest/download/morphe-cli.jar' -OutFile '%MORPHE_CLI%'"
    if not exist "%MORPHE_CLI%" (
        echo [ERROR] Could not automatically download morphe-cli.jar.
        echo Please place 'morphe-cli.jar' in this directory.
        pause
        exit /b 1
    )
)

if not exist "%BASE_APK%" (
    echo.
    echo [ERROR] Stock YouTube TV APK not found!
    echo Please place your clean YouTube TV apk as '%BASE_APK%' in this folder:
    echo %cd%\%BASE_APK%
    echo.
    pause
    exit /b 1
)

:: 5. Step 3: Patch APK using Morphe CLI
echo.
echo [2/4] Patching YouTube TV using Morphe CLI...
java -jar "%MORPHE_CLI%" patch -p "patches-bundle.json" -a "%BASE_APK%" -o "%OUTPUT_APK%"
if %errorlevel% neq 0 (
    echo [ERROR] Morphe CLI patching failed!
    pause
    exit /b %errorlevel%
)

:: 6. Step 4: ADB Connect and Install
echo.
echo [3/4] Connecting to TV at %TV_IP%:5555...
"%ADB_EXE%" connect %TV_IP%:5555

echo.
echo [4/4] Installing %OUTPUT_APK% on your TV...
"%ADB_EXE%" -s %TV_IP%:5555 install -r "%OUTPUT_APK%"
if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  SUCCESS: BirdyTV installed on your TV!
    echo ======================================================================
    echo.
    echo Launching BirdyTV on TV screen...
    "%ADB_EXE%" -s %TV_IP%:5555 shell monkey -p com.google.android.youtube.tv 1 >nul 2>&1
) else (
    echo.
    echo [ERROR] ADB installation failed.
    echo Make sure:
    echo 1. Your TV is on the same Wi-Fi network.
    echo 2. ADB Debugging is enabled in TV Developer Options.
    echo 3. You accepted the 'Allow USB/Network Debugging' prompt on your TV screen.
)

pause
