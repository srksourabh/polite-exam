# Polite Exam - Android App Deployment Guide

## Overview
Complete guide for deploying Polite Exam Management System as an Android app using Trusted Web Activity (TWA) via Bubblewrap CLI.

## ✅ Prerequisites Checklist

### Required Software
- [x] Node.js (v14 or higher) - [Download](https://nodejs.org/)
- [x] Java Development Kit (JDK 11 or higher) - [Download](https://adoptium.net/)
- [x] Android Studio - [Download](https://developer.android.com/studio)
- [x] Git (for version control) - [Download](https://git-scm.com/)

### Required Assets
- [x] HTTPS-hosted web application (Polite Exam must be live at production URL)
- [x] Domain with SSL certificate
- [x] Google Play Developer Account ($25 one-time fee)

## 📁 PWA Files (Already Created)

### Core Files
1. **manifest.json** - PWA configuration ✅
2. **sw.js** - Service worker for offline functionality ✅
3. **assetlinks.json** - Digital Asset Links (needs SHA256 fingerprint) ⚠️
4. **index.html** - Modified with PWA meta tags and service worker registration ✅

### Icons Required (4 Files)
Create these in the `/icons/` folder:
- **icon-192.png** - 192x192px standard icon
- **icon-512.png** - 512x512px standard icon
- **icon-maskable-192.png** - 192x192px adaptive icon
- **icon-maskable-512.png** - 512x512px adaptive icon

See `ICON-INSTRUCTIONS.md` for creation guide.

## 🚀 Quick Start Deployment

### Step 1: Install Bubblewrap CLI
```bash
npm install -g @bubblewrap/cli
```

### Step 2: Verify Installation
```bash
bubblewrap doctor
```
Fix any issues reported before proceeding.

### Step 3: Create Icon Files
Follow `ICON-INSTRUCTIONS.md` to create the 4 required icon files.

### Step 4: Deploy Web App
Upload all PWA files to your production server:
```
your-domain.com/
├── index.html (modified with PWA tags)
├── manifest.json
├── sw.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-192.png
│   └── icon-maskable-512.png
└── .well-known/
    └── assetlinks.json (after Step 7)
```

### Step 5: Initialize Bubblewrap Project
```bash
cd /path/to/polite-exam
bubblewrap init --manifest=https://your-domain.com/manifest.json
```

Answer the prompts:
- **Package Name**: com.politecoaching.exam
- **App Name**: Polite Exam Management
- **Start URL**: / (or your preferred start page)
- **Display Mode**: standalone
- **Status Bar Color**: #2c3e50
- **Theme Color**: #2c3e50
- **Enable Notifications**: Yes
- **Signing Key Passwords**: Choose strong passwords (SAVE THESE!)

### Step 6: Build APK (Development)
```bash
bubblewrap build
```
Output: `app-release-unsigned.apk` in project folder

### Step 7: Get SHA256 Fingerprint
```bash
keytool -list -v -keystore ./android.keystore -alias android
```
Copy the SHA256 fingerprint (format: `XX:XX:XX:XX:...`)

### Step 8: Update assetlinks.json
Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` in `assetlinks.json` with your actual SHA256 from Step 7.

Upload `assetlinks.json` to:
```
https://your-domain.com/.well-known/assetlinks.json
```

### Step 9: Build AAB (Production)
```bash
bubblewrap build --release
```
Output: `app-release-bundle.aab` for Google Play Store

### Step 10: Test on Device
```bash
adb install app-release-unsigned.apk
```

## 📱 Google Play Store Submission

### Required Assets
1. **App Icon**: 512x512px PNG (high-res)
2. **Feature Graphic**: 1024x500px PNG/JPEG
3. **Screenshots**: Minimum 2 (phone/tablet)
4. **Privacy Policy URL**: Required
5. **AAB File**: From Step 9

### Submission Checklist
- [ ] Create Google Play Console account
- [ ] Pay $25 developer registration fee
- [ ] Complete app listing details
- [ ] Upload AAB file
- [ ] Upload assets (icon, graphics, screenshots)
- [ ] Set content rating
- [ ] Add privacy policy URL
- [ ] Submit for review

### Review Timeline
- Initial review: 1-7 days
- Updates: Usually within 24 hours

## 🔧 Configuration Details

### Package Information
- **Package Name**: com.politecoaching.exam
- **Version Code**: Auto-incremented by Bubblewrap
- **Version Name**: Synced with manifest.json
- **Min SDK**: 19 (Android 4.4+)
- **Target SDK**: Latest stable

### Theme Colors
- **Primary**: #2c3e50 (matches existing app design)
- **Background**: #ffffff
- **Status Bar**: #2c3e50

## 🔐 Security Notes

### Keystore Management
- **CRITICAL**: Backup `android.keystore` file securely
- **CRITICAL**: Save keystore passwords in secure location
- Lost keystore = cannot update app on Play Store
- Store in encrypted cloud storage + offline backup

### Digital Asset Links
- Required for TWA to work properly
- Must be accessible at `/.well-known/assetlinks.json`
- SHA256 must match your app signing certificate
- Verify at: https://developers.google.com/digital-asset-links/tools/generator

## 📊 File Structure

```
polite-exam/
├── index.html (✅ Modified)
├── manifest.json (✅ Created)
├── sw.js (✅ Created)
├── assetlinks.json (⚠️ Needs SHA256)
├── icons/ (⚠️ Needs PNG files)
│   ├── icon-192.png (to create)
│   ├── icon-512.png (to create)
│   ├── icon-maskable-192.png (to create)
│   └── icon-maskable-512.png (to create)
├── api-integration.js
├── package.json
└── README.md (this file)
```

## 🆘 Troubleshooting

### Service Worker Not Registering
- Check browser console for errors
- Verify `sw.js` is accessible at `/sw.js`
- Ensure HTTPS is enabled

### Digital Asset Links Failed
- Verify `assetlinks.json` is at `/.well-known/assetlinks.json`
- Check SHA256 fingerprint matches exactly
- Test with Digital Asset Links validator

### App Install Failed
- Check `bubblewrap doctor` output
- Verify JDK and Android SDK paths
- Ensure minimum SDK requirements met

### Icons Not Showing
- Verify PNG files are exactly 192x192 and 512x512
- Check manifest.json paths are correct
- Clear browser cache and re-install PWA

## 📚 Additional Resources

- [Bubblewrap Documentation](https://github.com/GoogleChromeLabs/bubblewrap)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Google Play Console](https://play.google.com/console)
- [Digital Asset Links](https://developers.google.com/digital-asset-links)
- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)

## 🎯 Next Steps

1. ✅ Create icon files (see ICON-INSTRUCTIONS.md)
2. ✅ Deploy PWA files to production server
3. ✅ Run Bubblewrap init
4. ✅ Build development APK
5. ✅ Get SHA256 fingerprint
6. ✅ Update and deploy assetlinks.json
7. ✅ Test on device
8. ✅ Build production AAB
9. ✅ Submit to Play Store

## 📞 Support

For issues specific to Polite Exam system, contact the development team.
For Bubblewrap issues, visit: https://github.com/GoogleChromeLabs/bubblewrap/issues

---

**Last Updated**: November 2025
**App Package**: com.politecoaching.exam
**Version**: 1.0.0
