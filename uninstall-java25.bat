@echo off
echo ========================================
echo Uninstalling Java 25
echo ========================================
echo.
echo This will remove Java 25 from your system
echo.
echo WARNING: If you use Java 25 for other projects,
echo          you should keep it and use Option 1 instead!
echo.
pause

echo.
echo Looking for Java 25 installations...
echo.

REM Option 1: Uninstall via MSI product code (if available)
echo Attempting to uninstall Eclipse Adoptium JDK 25...
wmic product where "name like '%%Eclipse Temurin JDK%%25%%'" call uninstall /nointeractive

echo.
echo Attempting to uninstall via Control Panel...
echo.

REM Option 2: Use Programs and Features
echo Opening Windows Settings - Apps...
echo Please manually uninstall "Eclipse Temurin JDK with Hotspot 25.0.1+8 (x64)"
echo.
start ms-settings:appsfeatures

echo.
echo ========================================
echo Manual Uninstall Steps:
echo ========================================
echo.
echo 1. In the Windows Settings window that just opened:
echo    - Scroll down to find "Eclipse Temurin" or "Java 25"
echo    - Click on it
echo    - Click "Uninstall"
echo    - Follow the prompts
echo.
echo 2. After uninstalling, delete this folder if it still exists:
echo    C:\Program Files\Eclipse Adoptium\jdk-25.0.1.8-hotspot
echo.
echo 3. Then run: install-java17-and-build.bat
echo.
pause

REM Verify if Java 25 directory still exists
if exist "C:\Program Files\Eclipse Adoptium\jdk-25.0.1.8-hotspot" (
    echo.
    echo Java 25 directory still exists. Attempting to delete...
    echo (You may need Administrator permissions)
    echo.
    rmdir /S /Q "C:\Program Files\Eclipse Adoptium\jdk-25.0.1.8-hotspot"
    
    if errorlevel 1 (
        echo.
        echo Could not delete directory automatically.
        echo Please delete manually: C:\Program Files\Eclipse Adoptium\jdk-25.0.1.8-hotspot
        echo.
    ) else (
        echo ✅ Directory deleted successfully!
    )
) else (
    echo ✅ Java 25 directory not found - uninstall complete!
)

echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Restart your Command Prompt
echo 2. Run: install-java17-and-build.bat
echo.
pause
