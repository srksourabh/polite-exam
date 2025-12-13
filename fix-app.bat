@echo off
cd /d "C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam"

echo Downloading app.js...
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/srksourabh/polite-exam/801d36c/app.js' -OutFile 'app-temp.js'"

echo Fixing version in app.js...
powershell -Command " = Get-Content 'app-temp.js' -Raw;  =  -replace \"const APP_VERSION = '2.2.0'\", \"const APP_VERSION = '3.0.1'\"; Set-Content 'app.js'  -Encoding UTF8"

echo.
echo Git operations:
cd /d "C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam"
"C:\Program Files\Git\bin\git.exe" status
"C:\Program Files\Git\bin\git.exe" add app.js
"C:\Program Files\Git\bin\git.exe" commit -m "URGENT FIX: Restore complete app.js (8576 lines) with APP_VERSION 3.0.1"
"C:\Program Files\Git\bin\git.exe" push origin main

echo.
echo Done!
del app-temp.js
pause
