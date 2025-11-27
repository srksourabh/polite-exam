# Android Quick Start Guide

## Prerequisites Checklist
- [ ] Node.js installed (`node --version`)
- [ ] JDK 11+ installed (`java -version`)
- [ ] Android Studio installed
- [ ] Website live with HTTPS
- [ ] 4 icon files created in `/icons` folder

## 5-Minute Deployment

### 1. Install Bubblewrap
```bash
npm install -g @bubblewrap/cli
```

### 2. Create Icons
Create 4 PNG files in `/icons` folder:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `icon-maskable-192.png` (192x192)
- `icon-maskable-512.png` (512x512)

Use: [Favicon.io](https://favicon.io/) or [RealFaviconGenerator](https://realfavicongenerator.net/)

### 3. Deploy Website
Upload all files to your web host, ensuring:
- HTTPS is working
- `/.well-known/assetlinks.json` is accessible

### 4. Initialize Project
```bash
cd C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam
bubblewrap init --manifest=https://YOURDOMAIN.com/manifest.json
```

Accept defaults or use:
- Package: `com.politecoaching.exam`
- Theme: `#2c3e50`
- Background: `#ffffff`

### 5. Build Test APK
```bash
bubblewrap build
```

Install on device:
```bash
adb install app-release-unsigned.apk
```

### 6. Build for Play Store
```bash
bubblewrap build --release
```

Create keystore when prompted:
- **Keystore password**: Choose strong password
- **Alias**: `android`
- **Validity**: `10000`

**⚠️ BACKUP `android.keystore` FILE!**

### 7. Get SHA-256 Fingerprint
```bash
keytool -list -v -keystore ./android.keystore -alias android
```

Copy the SHA256 value.

### 8. Update Digital Asset Links
1. Edit `.well-known/assetlinks.json`
2. Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your SHA-256
3. Upload to: `https://YOURDOMAIN.com/.well-known/assetlinks.json`

### 9. Upload to Play Store
1. Go to [Google Play Console](https://play.google.com/console)
2. Create app ($25 fee if first time)
3. Upload `app-release-bundle.aab`
4. Add screenshots (minimum 2)
5. Submit for review

## File Checklist
- [x] `manifest.json` - Already created ✓
- [x] `sw.js` - Already created ✓
- [x] `index.html` - Already updated with PWA tags ✓
- [x] `.well-known/assetlinks.json` - Created, needs SHA-256 ✓
- [ ] `/icons/icon-192.png` - CREATE THIS
- [ ] `/icons/icon-512.png` - CREATE THIS
- [ ] `/icons/icon-maskable-192.png` - CREATE THIS
- [ ] `/icons/icon-maskable-512.png` - CREATE THIS

## Quick Commands Reference

```bash
# Install Bubblewrap
npm install -g @bubblewrap/cli

# Initialize
bubblewrap init --manifest=https://YOURDOMAIN.com/manifest.json

# Build test APK
bubblewrap build

# Build release AAB
bubblewrap build --release

# Get SHA-256
keytool -list -v -keystore ./android.keystore -alias android

# Install on device
adb install app-release-unsigned.apk

# Update app (after changes)
bubblewrap build --release
```

## Critical Reminders

🔐 **Keystore:** Backup `android.keystore` and save all passwords!

🌐 **HTTPS:** Website MUST use HTTPS - no exceptions

📁 **Asset Links:** File MUST be at `/.well-known/assetlinks.json`

🖼️ **Icons:** All 4 icon files required for proper display

⏱️ **Review Time:** Play Store review takes 1-7 days

## Need More Details?

See `ANDROID_DEPLOYMENT_README.md` for comprehensive guide.

See `ICON_INSTRUCTIONS.md` for icon creation details.
