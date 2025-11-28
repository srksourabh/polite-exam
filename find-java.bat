@echo off
echo ========================================
echo Setting up Java Environment Variables
echo ========================================
echo.
echo Common Java installation locations:
echo.
echo Checking: C:\Program Files\Java
dir "C:\Program Files\Java" 2>nul

echo.
echo Checking: C:\Program Files\Eclipse Adoptium
dir "C:\Program Files\Eclipse Adoptium" 2>nul

echo.
echo Checking: C:\Program Files\Android\Android Studio
dir "C:\Program Files\Android\Android Studio\jbr" 2>nul

echo.
echo ========================================
echo.
echo If you found a JDK folder above:
echo 1. Copy the full path (e.g., C:\Program Files\Java\jdk-17)
echo 2. Run this command in PowerShell as ADMINISTRATOR:
echo.
echo [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'YOUR_JDK_PATH', 'Machine')
echo [System.Environment]::SetEnvironmentVariable('PATH', $env:PATH + ';YOUR_JDK_PATH\bin', 'Machine')
echo.
echo Then restart Command Prompt and run: java -version
echo.
echo ========================================
pause
