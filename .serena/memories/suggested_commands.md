# Suggested Commands for Development

## Git Commands (Windows)
```powershell
# Check status
git status

# Create new branch for feature
git checkout -b feature-name

# Add and commit changes
git add .
git commit -m "Description of changes"

# Push to remote and create PR
git push origin feature-name
```

## Build Commands
```powershell
# Build web assets
npm run build

# Sync with Capacitor
npm run cap:sync

# Open Android Studio
npm run android:studio

# Full Android build
npm run android:build
```

## Testing
- Currently no automated tests configured
- Manual testing through browser and Android emulator

## Code Formatting
- No automated formatter configured
- Follow existing code style in index.html

## Development Server
- Open index.html directly in browser for local testing
- Or use a local server: `python -m http.server 8000`

## Windows-Specific Utils
- PowerShell for scripting
- `Get-Content` instead of `cat`
- `Select-String` instead of `grep`
- Paths use backslashes: `C:\Users\...`
