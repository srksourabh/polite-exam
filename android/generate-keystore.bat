@echo off
echo ========================================
echo Generating Android Release Keystore
echo ========================================
echo.
echo Please answer the following questions:
echo.

keytool -genkey -v -keystore polite-exam-release.keystore -alias polite-exam -keyalg RSA -keysize 2048 -validity 10000

echo.
echo ========================================
echo Keystore generated successfully!
echo Location: polite-exam-release.keystore
echo ========================================
echo.
echo IMPORTANT: Keep this file and password safe!
echo You will need it for ALL future updates!
echo ========================================
pause
