@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ======================================================================
echo          BirdyTV: Automated Morphe Patch ^& ADB TV Deployment
echo ======================================================================
echo.

rem 1. Setup PATH for tools (Git, ADB, Java)
if exist "%~dp0tools\git\cmd\git.exe" (
    set "PATH=%~dp0tools\git\cmd;!PATH!"
) else if exist "%~dp0..\git\cmd\git.exe" (
    set "PATH=%~dp0..\git\cmd;!PATH!"
)

if exist "%~dp0tools\platform-tools\adb.exe" (
    set "ADB_EXE=%~dp0tools\platform-tools\adb.exe"
) else if exist "%~dp0..\tv clean up\platform-tools\adb.exe" (
    set "ADB_EXE=%~dp0..\tv clean up\platform-tools\adb.exe"
) else (
    set "ADB_EXE=adb"
)

set "JAVA_EXE="
if exist "%~dp0tools\jdk\bin\java.exe" (
    set "JAVA_EXE=%~dp0tools\jdk\bin\java.exe"
) else if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" (
    set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
) else (
    where java >nul 2>&1
    if !errorlevel! equ 0 set "JAVA_EXE=java"
)

rem 2. TV IP Configuration
set "TV_IP="
if exist "tv_ip.txt" (
    set /p TV_IP=<tv_ip.txt
)
if "!TV_IP!"=="" (
    echo Enter your Android TV IP address [Settings - Network]:
    set /p "TV_IP=IP Address: "
    if not "!TV_IP!"=="" (
        echo !TV_IP!>tv_ip.txt
    )
)

if "!TV_IP!"=="" (
    echo [ERROR] No TV IP entered. Aborting.
    pause
    exit /b 1
)

echo [Target TV] !TV_IP!:5555
echo (To change TV IP, edit or delete 'tv_ip.txt')
echo.

rem 3. Step 1: Sync with GitHub
echo [1/4] Syncing patches with GitHub...
if exist "sync.bat" (
    call "sync.bat"
)

rem 4. Step 2: Locate or Download Morphe CLI, Patches Bundle & Base APK
set "MORPHE_CLI=morphe-cli.jar"
set "PATCHES_MPP=patches.mpp"
set "BASE_APK=youtube-tv.apk"
set "OUTPUT_APK=birdytv-patched.apk"

if not exist "%MORPHE_CLI%" (
    echo.
    echo [Notice] '%MORPHE_CLI%' not found.
    echo Downloading latest Morphe CLI...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/MorpheApp/morphe-cli/releases/latest/download/morphe-cli.jar' -OutFile '%MORPHE_CLI%'"
    if not exist "%MORPHE_CLI%" (
        echo [ERROR] Could not download morphe-cli.jar.
        echo Please download it manually and place 'morphe-cli.jar' in this folder.
        pause
        exit /b 1
    )
)

if not exist "%PATCHES_MPP%" (
    echo.
    echo [Notice] '%PATCHES_MPP%' not found.
    echo Downloading latest patch bundle...
    powershell -NoProfile -Command "$url = (Get-Content '%~dp0patches-bundle.json' | ConvertFrom-Json).download_url; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri $url -OutFile '%PATCHES_MPP%'"
    if not exist "%PATCHES_MPP%" (
        echo [ERROR] Could not download patches.mpp.
        pause
        exit /b 1
    )
)

if not exist "%BASE_APK%" (
    echo.
    echo ======================================================================
    echo  [ACTION REQUIRED] Stock YouTube TV APK not found!
    echo ======================================================================
    echo  Please place your stock clean YouTube TV apk as:
    echo  '%cd%\%BASE_APK%'
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

rem 5. Step 3: Patch APK using Morphe CLI
echo.
echo [2/4] Patching YouTube TV using Morphe CLI...
if not defined JAVA_EXE (
    echo [ERROR] Java runtime not found!
    echo Please install Java 21+ or keep portable Java in tools\jdk\.
    pause
    exit /b 1
)

echo Using Java: "!JAVA_EXE!"
"!JAVA_EXE!" -jar "%MORPHE_CLI%" patch --patches "%PATCHES_MPP%" -o "%OUTPUT_APK%" "%BASE_APK%"
if %errorlevel% neq 0 (
    echo [ERROR] Morphe CLI patching failed!
    pause
    exit /b %errorlevel%
)

rem 6. Step 4: ADB Connect and Install
echo.
echo [3/4] Connecting to TV at !TV_IP!:5555...
"!ADB_EXE!" connect !TV_IP!:5555

echo.
echo [4/4] Installing %OUTPUT_APK% on your TV...
"!ADB_EXE!" -s !TV_IP!:5555 install -r "%OUTPUT_APK%"
if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  SUCCESS: BirdyTV installed on your TV!
    echo ======================================================================
    echo.
    echo Launching BirdyTV on TV screen...
    "!ADB_EXE!" -s !TV_IP!:5555 shell monkey -p com.google.android.youtube.tv 1 >nul 2>&1
) else (
    echo.
    echo [ERROR] ADB installation failed.
    echo Make sure:
    echo 1. Your TV is on the same Wi-Fi network.
    echo 2. Network/ADB Debugging is ON in TV Developer Options.
    echo 3. You accepted the 'Allow Debugging' prompt on your TV screen.
)

pause
