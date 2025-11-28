@echo off
echo ========================================
echo Installing Java 17 Alongside Java 25
echo ========================================
echo.
echo This will install Java 17 for Android development
echo Your Java 25 will remain installed and untouched
echo.
pause

REM Download Java 17
echo.
echo [1/3] Downloading Java JDK 17...
echo.
curl -L "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%%2B11/OpenJDK17U-jdk_x64_windows_hotspot_17.0.13_11.msi" -o "%TEMP%\jdk17.msi"

if errorlevel 1 (
    echo ERROR: Download failed!
    echo Please download manually from: https://adoptium.net/temurin/releases/?version=17
    pause
    exit /b 1
)

REM Install Java 17 (DON'T set as default system Java)
echo.
echo [2/3] Installing Java JDK 17...
echo (This will install to a separate directory)
echo (Your Java 25 will NOT be affected)
echo.
msiexec /i "%TEMP%\jdk17.msi" /qn ADDLOCAL=FeatureMain INSTALLDIR="C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"

if errorlevel 1 (
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

REM Wait for installation to complete
echo Waiting for installation to complete...
timeout /t 15 /nobreak >nul

REM Verify installation
echo.
echo [3/3] Verifying Java 17 installation...
echo.
if exist "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot\bin\java.exe" (
    "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot\bin\java.exe" -version
    echo.
    echo ========================================
    echo ✅ SUCCESS! Java 17 is installed!
    echo ========================================
    echo.
    echo Java 17 location: C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot
    echo Java 25 location: C:\Program Files\Eclipse Adoptium\jdk-25.0.1.8-hotspot
    echo.
    echo Both versions are installed and ready!
) else (
    echo ERROR: Installation verification failed!
    echo Please check if the installation completed successfully.
    pause
    exit /b 1
)

REM Clean up
del "%TEMP%\jdk17.msi"

echo.
echo Now run: quick-build.bat
echo (It will automatically use Java 17 for Android builds)
echo.
pause
