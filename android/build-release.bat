@echo off
echo ========================================
echo Building Polite Exam Release AAB
echo ========================================
echo.

cd /d "%~dp0"
cd ..

echo Step 1: Syncing web assets with Android...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Failed to sync assets
    pause
    exit /b 1
)

echo.
echo Step 2: Cleaning previous builds...
cd android
call gradlew clean
if errorlevel 1 (
    echo ERROR: Clean failed
    cd ..
    pause
    exit /b 1
)

echo.
echo Step 3: Building release AAB...
call gradlew bundleRelease
if errorlevel 1 (
    echo ERROR: Build failed
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo ✅ BUILD SUCCESSFUL!
echo ========================================
echo.
echo Your AAB file is ready at:
echo android\app\build\outputs\bundle\release\app-release.aab
echo.
echo Next steps:
echo 1. Go to Google Play Console
echo 2. Create new release
echo 3. Upload the app-release.aab file
echo.
echo ========================================
pause
