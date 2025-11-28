@echo off
echo ========================================
echo Rebuilding for Play Store (API 35)
echo ========================================
echo.
echo This will build your app targeting API 35
echo as required by Google Play Store
echo.

REM Set Java 17 path
set "JAVA_PATH=C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"

if not exist "%JAVA_PATH%\bin\java.exe" (
    echo ERROR: Java 17 not found!
    echo Please run: install-java17-alongside.bat
    pause
    exit /b 1
)

set "JAVA_HOME=%JAVA_PATH%"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo Using Java 17 at: %JAVA_PATH%
echo.

cd /d "C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam\android"

echo Step 1: Cleaning previous build...
call gradlew clean

echo.
echo Step 2: Building release AAB for Play Store...
echo (Targeting API 35 - Android 15)
echo.
call gradlew bundleRelease

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
if exist "app\build\outputs\bundle\release\app-release.aab" (
    echo ✅ SUCCESS! AAB built with API 35
    echo.
    echo AAB Location: 
    echo android\app\build\outputs\bundle\release\app-release.aab
    echo.
    for %%I in ("app\build\outputs\bundle\release\app-release.aab") do echo Size: %%~zI bytes
    echo.
    echo ========================================
    echo Ready for Google Play Store Upload!
    echo ========================================
    echo.
    echo Changes made:
    echo   ✅ compileSdkVersion: 34 → 35
    echo   ✅ targetSdkVersion: 34 → 35
    echo   ✅ Updated AndroidX dependencies
    echo.
) else (
    echo ❌ FAILED - AAB file not found
    echo Check the error messages above
)
echo.
pause
