@echo off
echo ========================================
echo Installing Java JDK 17 (Temurin)
echo ========================================
echo.
echo This will install Eclipse Temurin JDK 17 (LTS)
echo.
pause

echo Downloading Java JDK 17...
curl -L "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.9%%2B9/OpenJDK17U-jdk_x64_windows_hotspot_17.0.9_9.msi" -o "%TEMP%\openjdk17.msi"

if errorlevel 1 (
    echo.
    echo ERROR: Download failed!
    echo Please download manually from:
    echo https://adoptium.net/temurin/releases/?version=17
    pause
    exit /b 1
)

echo.
echo Installing JDK 17...
echo (This will open installer - follow the prompts)
start /wait msiexec /i "%TEMP%\openjdk17.msi" /qn ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome INSTALLDIR="C:\Program Files\Eclipse Adoptium\jdk-17.0.9.9-hotspot\"

echo.
echo Cleaning up...
del "%TEMP%\openjdk17.msi"

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Please CLOSE and REOPEN your Command Prompt
echo Then verify with: java -version
echo.
echo ========================================
pause
