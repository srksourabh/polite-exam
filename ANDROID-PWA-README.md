# Android PWA Deployment Guide - Polite Exam Management System

## Overview
This guide explains how to convert the Polite Exam web application into an Android app using **Trusted Web Activity (TWA)** via **Bubblewrap CLI**.

## What is TWA?
Trusted Web Activity allows you to package your Progressive Web App (PWA) as a native Android app that runs in fullscreen Chrome without browser UI, giving users a native app experience.

## Prerequisites

### System Requirements
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **Java Development Kit (JDK)** (v11 or higher) - [Download](https://www.oracle.com/java/technologies/downloads/)
- **Android Studio** (optional but recommended) - [Download](https://developer.android.com/studio)

### Web App Requirements
- ✅ HTTPS-hosted website (mandatory for TWA)
- ✅ Valid manifest.json (already created)
- ✅ Service worker (sw.js - already created)
- ✅ PWA icons (need to be created - see ICON-GENERATION.md)

## Files Created

### Core PWA Files
1. **manifest.json** - PWA configuration with app metadata
2. **sw.js** - Service worker for offline functionality and caching
3. **assetlinks.json** - Digital Asset Links for Android verification
4. **icons/** - Folder for app icons (4 PNG files needed)

### Configuration Details
- **Package Name**: com.politecoaching.exam
- **App Name**: Polite Coaching Centre - Exam System
- **Short Name**: Polite Exam
- **Theme Color**: #2c3e50 (matches your brand)
- **Background Color**: #ffffff

## Installation Steps

### 1. Install Bubblewrap CLI
```bash
npm install -g @bubblewrap/cli
```

### 2. Verify Installation
```bash
bubblewrap --version
```

### 3. Generate Icons
Before building, you need to create 4 icon files in the `/icons` folder:
- icon-192.png (192x192 pixels)
- icon-512.png (512x512 pixels)
- icon-maskable-192.png (192x192 pixels, maskable format)
- icon-maskable-512.png (512x512 pixels, maskable format)

See **ICON-GENERATION.md** for detailed instructions.

### 4. Deploy assetlinks.json
Upload `assetlinks.json` to your web server at:
```
https://yourdomain.com/.well-known/assetlinks.json
```

**IMPORTANT**: Update the SHA256 fingerprint in assetlinks.json after building (Step 6).

### 5. Initialize Bubblewrap Project
Navigate to your project folder and run:
```bash
bubblewrap init --manifest=https://yourdomain.com/manifest.json
```

Follow the prompts:
- **Domain**: Your actual domain (e.g., politecoaching.com)
- **Package ID**: com.politecoaching.exam (suggested)
- **App name**: Polite Exam (or customize)
- **Display mode**: standalone
- **Status bar color**: #2c3e50

This creates:
- `twa-manifest.json` - TWA configuration
- `android.keystore` - Signing key (KEEP SECURE!)

### 6. Get SHA256 Fingerprint
After initialization, extract your app's SHA256 fingerprint:
```bash
keytool -list -v -keystore ./android.keystore -alias android
```

Copy the SHA256 fingerprint and update `assetlinks.json`:
```json
"sha256_cert_fingerprints": [
  "YOUR_ACTUAL_SHA256_FINGERPRINT_HERE"
]
```

Re-upload assetlinks.json to your server.

### 7. Build Development APK
```bash
bubblewrap build
```

This creates: `app-release-unsigned.apk` in the project folder.

### 8. Test on Device
```bash
bubblewrap install
```
Or manually install the APK on an Android device.

### 9. Build Production Bundle
For Google Play Store submission:
```bash
bubblewrap build --release
```

This creates: `app-release-bundle.aab`

## Google Play Store Submission

### Required Assets
1. **App Icon**: 512x512 PNG
2. **Feature Graphic**: 1024x500 PNG
3. **Screenshots**: Minimum 2 (phone), recommended 4-8
4. **Privacy Policy**: Required URL
5. **Content Rating**: Complete questionnaire
6. **Store Listing**: Title, description, category

### Costs
- **One-time Developer Fee**: $25 USD
- **No recurring fees** for app distribution

### Review Process
- **Initial review**: 1-7 days
- **Updates**: 1-3 days typically

## Security & Maintenance

### Keystore Management
⚠️ **CRITICAL**: Keep `android.keystore` secure and backed up!
- If lost, you CANNOT update your app
- Store in encrypted backup
- Never commit to version control (already in .gitignore)

### Updating Your App
1. Make changes to your web app
2. Deploy to your website
3. Increment version in twa-manifest.json
4. Rebuild: `bubblewrap build --release`
5. Submit new .aab to Play Store

## Troubleshooting

### Common Issues

**Digital Asset Links not verified:**
- Ensure assetlinks.json is at `/.well-known/assetlinks.json`
- Verify HTTPS is working
- Check SHA256 fingerprint matches
- Test: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yourdomain.com

**Build fails:**
- Verify JDK version: `java -version` (needs v11+)
- Check Android SDK path in environment variables
- Ensure manifest.json is publicly accessible

**App shows Chrome UI:**
- Digital Asset Links not properly configured
- Wait 5-10 minutes after uploading assetlinks.json
- Clear Chrome app data and retry

## Alternative Solutions

If Bubblewrap doesn't meet your needs, consider:
- **Capacitor** by Ionic - More features, larger app size
- **Cordova** - Older but stable
- **React Native WebView** - If using React
- **PWABuilder** - Microsoft's online tool (no CLI)

## Support Resources

- **Bubblewrap Documentation**: https://github.com/GoogleChromeLabs/bubblewrap
- **TWA Guide**: https://developer.chrome.com/docs/android/trusted-web-activity/
- **Digital Asset Links**: https://developers.google.com/digital-asset-links
- **Play Console**: https://play.google.com/console

## File Checklist

Before building, ensure you have:
- ✅ manifest.json (in root)
- ✅ sw.js (in root)
- ✅ assetlinks.json (created, needs upload)
- ✅ index.html (with PWA meta tags and SW registration)
- ⬜ icons/icon-192.png
- ⬜ icons/icon-512.png
- ⬜ icons/icon-maskable-192.png
- ⬜ icons/icon-maskable-512.png

## Next Steps

1. **Create icons** - See ICON-GENERATION.md
2. **Deploy to production** - Ensure your site is on HTTPS
3. **Upload assetlinks.json** - To /.well-known/ directory
4. **Run Bubblewrap init** - Start the build process
5. **Test thoroughly** - On multiple devices
6. **Submit to Play Store** - Follow submission guide

---

**Package**: com.politecoaching.exam  
**Version**: 1.0.0  
**Last Updated**: November 2024
