@echo off
echo ========================================
echo Quick Build with Temporary JAVA_HOME
echo ========================================
echo.

REM Try common Java 17/21 installation paths (compatible with Gradle 8.13)
set JAVA_PATH=

REM Check for Java 17 installations
if exist "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot\bin\java.exe" (
    set "JAVA_PATH=C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
)

if exist "C:\Program Files\Java\jdk-17\bin\java.exe" (
    set "JAVA_PATH=C:\Program Files\Java\jdk-17"
)

if exist "C:\Program Files\Microsoft\jdk-17\bin\java.exe" (
    set "JAVA_PATH=C:\Program Files\Microsoft\jdk-17"
)

REM Check for Java 21 installations if Java 17 not found
if "%JAVA_PATH%"=="" (
    if exist "C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe" (
        set "JAVA_PATH=C:\Program Files\Eclipse Adoptium\jdk-21"
    )
)

if "%JAVA_PATH%"=="" (
    if exist "C:\Program Files\Java\jdk-21\bin\java.exe" (
        set "JAVA_PATH=C:\Program Files\Java\jdk-21"
    )
)

if "%JAVA_PATH%"=="" (
    echo ========================================
    echo ERROR: Java 17 or 21 not found!
    echo ========================================
    echo.
    echo Gradle 8.13 requires Java 17 or Java 21 (LTS versions)
    echo Java 25 is too new and not supported yet.
    echo.
    echo Please run: install-java17-and-build.bat
    echo.
    echo This will:
    echo   1. Download and install Java 17
    echo   2. Build your Android app
    echo.
    pause
    exit /b 1
)

echo Found Java at: %JAVA_PATH%
echo.

REM Set JAVA_HOME for this session
set "JAVA_HOME=%JAVA_PATH%"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM Verify
echo Verifying Java:
java -version
echo.

REM Build
echo Building Android App...
echo.
cd /d "C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam\android"

echo Step 1: Cleaning...
call gradlew clean

echo.
echo Step 2: Building release AAB...
call gradlew bundleRelease

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
if exist "app\build\outputs\bundle\release\app-release.aab" (
    echo ✅ SUCCESS!
    echo.
    echo AAB file: android\app\build\outputs\bundle\release\app-release.aab
    echo Size: 
    dir /B app\build\outputs\bundle\release\app-release.aab | findstr /C:"app-release.aab"
) else (
    echo ❌ FAILED - AAB file not found
)
echo.
pause
