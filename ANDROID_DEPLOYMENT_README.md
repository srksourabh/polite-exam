# Android Deployment Guide for Polite Exam System

## Overview
This guide will help you convert the Polite Exam web application into an Android app using Trusted Web Activity (TWA) via Bubblewrap CLI.

## Prerequisites

### Required Software
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **JDK 11+** - [Download](https://adoptium.net/)
- **Android Studio** - [Download](https://developer.android.com/studio)
- **HTTPS-hosted website** - Your web app must be live and accessible via HTTPS

### Verify Installations
```bash
node --version
java -version
```

## File Structure
Your project now includes these Android deployment files:

```
polite-exam/
├── manifest.json              # PWA manifest (already configured)
├── sw.js                      # Service worker (already configured)
├── index.html                 # PWA meta tags (already added)
├── assetlinks.json           # Digital Asset Links (root backup)
├── .well-known/
│   └── assetlinks.json       # Digital Asset Links (required location)
└── icons/
    ├── icon-192.png          # 192x192 icon (CREATE THIS)
    ├── icon-512.png          # 512x512 icon (CREATE THIS)
    ├── icon-maskable-192.png # 192x192 maskable (CREATE THIS)
    └── icon-maskable-512.png # 512x512 maskable (CREATE THIS)
```

## Step 1: Install Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
```

## Step 2: Create Icon Files

You need to create 4 PNG icon files in the `/icons` folder:

1. **icon-192.png** - 192x192 pixels, standard icon
2. **icon-512.png** - 512x512 pixels, standard icon  
3. **icon-maskable-192.png** - 192x192 pixels, maskable (safe zone in center)
4. **icon-maskable-512.png** - 512x512 pixels, maskable (safe zone in center)

**Tools to create icons:**
- Online: [Favicon.io](https://favicon.io/) or [RealFaviconGenerator](https://realfavicongenerator.net/)
- Design: Canva, Figma, or Adobe Illustrator
- Maskable: Use [Maskable.app](https://maskable.app/) to test

**Maskable icon requirements:**
- Put important content in the center 80% safe zone
- Background should extend to full canvas
- Icon should look good when cropped to circle/rounded square

## Step 3: Deploy Your Website

Before building the Android app, ensure:

1. **Upload all files to your web host** (including `.well-known/assetlinks.json`)
2. **Verify HTTPS is working** - Visit your site with https://
3. **Test the manifest** - Visit `https://yourdomain.com/manifest.json`
4. **Test Digital Asset Links** - Visit `https://yourdomain.com/.well-known/assetlinks.json`

**Important:** The `.well-known/assetlinks.json` file MUST be accessible publicly. Configure your web server if needed:

**For Apache** (add to `.htaccess`):
```apache
<Files "assetlinks.json">
    Header set Content-Type "application/json"
    Header set Access-Control-Allow-Origin "*"
</Files>
```

**For Nginx** (add to config):
```nginx
location /.well-known/assetlinks.json {
    default_type application/json;
    add_header Access-Control-Allow-Origin *;
}
```

## Step 4: Initialize Bubblewrap Project

Navigate to your project folder and run:

```bash
cd C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam
bubblewrap init --manifest=https://yourdomain.com/manifest.json
```

**Replace `yourdomain.com` with your actual domain.**

Bubblewrap will ask you questions:

1. **Domain** - Enter your domain (e.g., politecoaching.com)
2. **Package Name** - Use: `com.politecoaching.exam` (already configured)
3. **App Name** - Use: "Polite Exam" (already configured)
4. **Launcher Name** - Use: "Polite Exam"
5. **Theme Color** - Use: `#2c3e50` (already configured)
6. **Background Color** - Use: `#ffffff` (already configured)
7. **Start URL** - Use: `/` (already configured)
8. **Icon URLs** - Will be auto-detected from manifest

This creates a `twa-manifest.json` file in your project.

## Step 5: Build Development APK

For testing on your device:

```bash
bubblewrap build
```

This creates: `app-release-unsigned.apk`

**Install on your Android device:**
```bash
adb install app-release-unsigned.apk
```

Or transfer the APK file to your device and install manually.

## Step 6: Generate Signing Key for Production

For Google Play Store release:

```bash
bubblewrap build --release
```

Follow the prompts to create a keystore:
- **Keystore password** - Choose a strong password
- **Key alias** - Use: `android` (or custom name)
- **Key password** - Choose a strong password
- **Validity** - Use: `10000` (days, ~27 years)

**⚠️ CRITICAL:** Save your keystore file and passwords securely! You'll need them for all future updates.

This creates:
- `android.keystore` - Your signing key (BACKUP THIS!)
- `app-release-bundle.aab` - Google Play Store file

## Step 7: Get SHA-256 Fingerprint

After building with release, get your SHA-256 fingerprint:

```bash
keytool -list -v -keystore ./android.keystore -alias android
```

Enter your keystore password when prompted.

Copy the **SHA256** fingerprint (it looks like: `AA:BB:CC:DD:...`)

## Step 8: Update Digital Asset Links

1. Open `.well-known/assetlinks.json`
2. Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your actual SHA-256 fingerprint
3. Upload the updated file to your web server at: `https://yourdomain.com/.well-known/assetlinks.json`

**Verify it's accessible:**
```
https://yourdomain.com/.well-known/assetlinks.json
```

## Step 9: Test Your App

1. Install the APK on your Android device
2. Open the app
3. Verify it opens without showing browser UI
4. Test all functionality (login, exams, navigation)
5. Check that the app icon appears correctly

## Step 10: Prepare for Google Play Store

### Required Assets

Create these in Android Studio or design tools:

1. **App Icon** - 512x512 PNG (high-res icon)
2. **Feature Graphic** - 1024x500 PNG (Store banner)
3. **Screenshots** - Minimum 2, recommended 4-8
   - Phone: 320-3840 pixels on short side
   - Tablet: 1200-7680 pixels on short side

### Required Information

1. **App Title** - "Polite Exam Management" (30 chars max)
2. **Short Description** - Brief tagline (80 chars max)
3. **Full Description** - Detailed app description (4000 chars max)
4. **Privacy Policy URL** - Required if app handles personal data
5. **Developer Contact** - Email, phone (optional), website

### Content Rating

Complete the content rating questionnaire in Play Console. For an exam system, you'll likely get an "Everyone" rating.

## Step 11: Upload to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a developer account ($25 one-time fee)
3. Click "Create App"
4. Fill in app details
5. Upload `app-release-bundle.aab` under "Release" → "Production"
6. Upload screenshots and graphics
7. Complete all required sections
8. Submit for review

**Review timeline:** 1-7 days (typically 2-3 days)

## Updating Your App

When you update your website and want to release a new app version:

```bash
# Update version number in twa-manifest.json
# Then rebuild
bubblewrap build --release
```

Upload the new `.aab` file to Play Store as an update.

**⚠️ IMPORTANT:** Always use the same keystore file for updates!

## Troubleshooting

### Issue: "Failed to find Build Tools"
**Solution:** Install Android SDK Build Tools via Android Studio:
- Open Android Studio
- Tools → SDK Manager → SDK Tools
- Check "Android SDK Build-Tools"

### Issue: "HTTPS required"
**Solution:** Your website MUST use HTTPS. Get a free SSL certificate:
- Let's Encrypt
- Cloudflare SSL
- Your hosting provider

### Issue: "assetlinks.json not found"
**Solution:** 
1. Verify file exists at: `https://yourdomain.com/.well-known/assetlinks.json`
2. Check web server configuration (see Step 3)
3. Clear CDN cache if using one

### Issue: App shows browser UI
**Solution:**
1. Verify SHA-256 fingerprint in assetlinks.json matches your keystore
2. Wait 24 hours for Digital Asset Links cache to update
3. Uninstall and reinstall the app

### Issue: Icons not displaying correctly
**Solution:**
1. Verify icon files exist in `/icons` folder
2. Check file sizes (exactly 192x192 and 512x512)
3. Ensure PNG format (not JPG)
4. Test maskable icons at [Maskable.app](https://maskable.app/)

## App Configuration Summary

- **Package Name:** com.politecoaching.exam
- **App Name:** Polite Coaching Centre - Exam System
- **Short Name:** Polite Exam
- **Theme Color:** #2c3e50 (Dark Blue)
- **Background Color:** #ffffff (White)
- **Start URL:** /
- **Display Mode:** standalone
- **Orientation:** portrait

## Security Best Practices

1. **Keystore Security:**
   - Store `android.keystore` in a secure location
   - Keep passwords in a password manager
   - Create backups of keystore file

2. **API Keys:**
   - Don't hardcode API keys in the app
   - Use environment variables or secure storage

3. **HTTPS:**
   - Always use HTTPS for your web app
   - Keep SSL certificates up to date

## Support Resources

- **Bubblewrap Documentation:** https://github.com/GoogleChromeLabs/bubblewrap
- **PWA Documentation:** https://web.dev/progressive-web-apps/
- **Android App Bundle:** https://developer.android.com/guide/app-bundle
- **Play Console Help:** https://support.google.com/googleplay/android-developer

## Questions?

For issues specific to this deployment, refer to:
- `ANDROID_QUICK_START.md` - Condensed steps
- `ICON_INSTRUCTIONS.md` - Detailed icon creation guide
- Your web hosting provider's documentation for server configuration

---

**Ready to build?** See `ANDROID_QUICK_START.md` for a condensed checklist.
