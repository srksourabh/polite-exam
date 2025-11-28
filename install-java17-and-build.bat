@echo off
echo ========================================
echo Installing Java JDK 17 for Android
echo ========================================
echo.
echo This will:
echo 1. Download Java 17 (Eclipse Temurin)
echo 2. Install it properly
echo 3. Set JAVA_HOME environment variable
echo 4. Build your Android app
echo.
pause

REM Download Java 17
echo.
echo [1/4] Downloading Java JDK 17...
echo.
curl -L "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%%2B11/OpenJDK17U-jdk_x64_windows_hotspot_17.0.13_11.msi" -o "%TEMP%\jdk17.msi"

if errorlevel 1 (
    echo ERROR: Download failed!
    echo Please download manually from: https://adoptium.net/temurin/releases/?version=17
    pause
    exit /b 1
)

REM Install Java 17
echo.
echo [2/4] Installing Java JDK 17...
echo (This may take a minute)
echo.
msiexec /i "%TEMP%\jdk17.msi" /qn ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome

if errorlevel 1 (
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

REM Wait for installation to complete
timeout /t 10 /nobreak >nul

REM Set JAVA_HOME for current session
echo.
echo [3/4] Configuring environment...
echo.
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM Verify installation
echo.
echo Verifying Java installation:
"%JAVA_HOME%\bin\java" -version

if errorlevel 1 (
    echo ERROR: Java verification failed!
    echo Please restart your computer and try again.
    pause
    exit /b 1
)

REM Clean up
del "%TEMP%\jdk17.msi"

echo.
echo [4/4] Building Android App...
echo.
cd /d "C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam\android"
call gradlew clean
call gradlew bundleRelease

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo AAB file location:
echo android\app\build\outputs\bundle\release\app-release.aab
echo.
echo IMPORTANT: Restart your Command Prompt to use Java 17 permanently
echo.
pause
