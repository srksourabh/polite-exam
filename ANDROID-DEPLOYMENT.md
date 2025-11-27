# Polite Exam - Android PWA Deployment Guide

Complete guide for converting your Polite Exam web application into an Android app using Trusted Web Activity (TWA) and Bubblewrap CLI.

## 📱 Overview

This setup allows you to package your web app as a native Android application that:
- Works offline with service worker caching
- Appears in the Google Play Store
- Launches like a native app (no browser UI)
- Provides a full-screen experience

## ✅ Files Checklist

All required files have been created in your project:

- ✅ `/manifest.json` - PWA metadata
- ✅ `/sw.js` - Service worker for offline functionality
- ✅ `/assetlinks.json` - Digital Asset Links verification
- ✅ `/icons/` folder - Contains icon instructions
- ✅ `index.html` - Already configured with PWA meta tags

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v16 or higher)
   ```bash
   node --version
   ```

2. **Java Development Kit (JDK 11+)**
   ```bash
   java -version
   ```

3. **Android Studio** (optional but recommended)
   - Download from: https://developer.android.com/studio

4. **HTTPS-hosted web app**
   - Your app must be live on HTTPS (e.g., Vercel, Netlify)

### Step 1: Generate Icons

Before building, create 4 icon files (see `/icons/ICON-INSTRUCTIONS.md`):
- icon-192.png (192x192)
- icon-512.png (512x512)
- icon-maskable-192.png (192x192 with safe zone)
- icon-maskable-512.png (512x512 with safe zone)

### Step 2: Deploy Web App

1. Deploy your web app to production (e.g., Vercel)
2. Ensure HTTPS is working
3. Upload `assetlinks.json` to `/.well-known/assetlinks.json` on your server

### Step 3: Install Bubblewrap

```bash
npm install -g @bubblewrap/cli
```

### Step 4: Initialize Android Project

```bash
cd /path/to/polite-exam
bubblewrap init --manifest=https://yourdomain.com/manifest.json
```

This will prompt you for:
- App name: Polite Exam Management
- Package name: com.politecoaching.exam
- Icon paths (use the ones in /icons/)
- Other configuration options

### Step 5: Build Development APK

```bash
bubblewrap build
```

This creates: `app-release-unsigned.apk` for testing

### Step 6: Test on Android Device

```bash
adb install app-release-unsigned.apk
```

Or drag the APK file to an Android emulator.

### Step 7: Build Production Release

```bash
bubblewrap build --release
```

This creates: `app-release-bundle.aab` for Google Play Store

## 🔐 Digital Asset Links Setup

After building your app, you need to get the SHA256 fingerprint:

```bash
keytool -list -v -keystore ./android.keystore -alias android
```

Copy the SHA256 fingerprint and update `assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.politecoaching.exam",
    "sha256_cert_fingerprints": [
      "YOUR_SHA256_FINGERPRINT_HERE"
    ]
  }
}]
```

Upload this file to: `https://yourdomain.com/.well-known/assetlinks.json`

## 📦 Google Play Store Submission

### Required Assets

1. **App Icon** - 512x512 PNG (hi-res icon)
2. **Feature Graphic** - 1024x500 PNG
3. **Screenshots** - Minimum 2, various device sizes
4. **Privacy Policy URL** - Required for Play Store

### Store Listing Information

- **App Name**: Polite Coaching Centre - Exam System
- **Short Description**: Complete exam management system
- **Category**: Education
- **Content Rating**: Everyone
- **Price**: Free

### Submission Checklist

- [ ] Create Google Play Developer account ($25 one-time fee)
- [ ] Prepare app listing (title, description, screenshots)
- [ ] Upload app-release-bundle.aab
- [ ] Set up store listing graphics
- [ ] Add privacy policy URL
- [ ] Submit for review (1-7 days)

## 🛠️ Updating Your App

When you update your web app:

1. Update version in `manifest.json`
2. Update service worker cache name in `sw.js`:
   ```javascript
   const CACHE_NAME = 'polite-exam-v2'; // Increment version
   ```
3. Rebuild Android app:
   ```bash
   bubblewrap update
   bubblewrap build --release
   ```
4. Upload new .aab to Play Store

## 🔧 Troubleshooting

### App won't verify
- Check assetlinks.json is accessible at `/.well-known/assetlinks.json`
- Verify SHA256 fingerprint matches
- Ensure package name is consistent

### App shows browser UI
- Digital Asset Links not properly configured
- Domain mismatch in manifest.json

### Offline mode not working
- Service worker not registered
- Cache strategy incorrect
- HTTPS not enabled

## 📚 Additional Resources

- [Bubblewrap Documentation](https://github.com/GoogleChromeLabs/bubblewrap)
- [PWA Builder](https://www.pwabuilder.com/)
- [Google Play Console](https://play.google.com/console)
- [Android Asset Links](https://developer.android.com/training/app-links/verify-android-applinks)

## 🎯 App Configuration

**Package Name**: com.politecoaching.exam  
**App Name**: Polite Coaching Centre - Exam System  
**Theme Color**: #2c3e50  
**Background Color**: #ffffff  
**Start URL**: /  
**Display Mode**: standalone

## 📞 Support

For issues or questions about the deployment process, refer to the official Bubblewrap documentation or create an issue in your repository.

---

**Last Updated**: November 2024  
**Version**: 1.0.0
