# Android Deployment Guide - Polite Exam System

Complete guide for deploying Polite Exam as an Android app using Trusted Web Activity (TWA) via Bubblewrap CLI.

## 📋 Prerequisites Checklist

- [x] Web app deployed and accessible via HTTPS
- [ ] Node.js installed (v14 or higher)
- [ ] Java Development Kit (JDK) 11 or higher installed
- [ ] Android Studio installed (optional but recommended)
- [ ] Google Play Developer account ($25 one-time fee)

## 🎯 Current Setup Status

### ✅ Completed Files
1. **manifest.json** - PWA manifest with app metadata
2. **sw.js** - Service worker for offline functionality
3. **.well-known/assetlinks.json** - Digital Asset Links (needs SHA256 fingerprint)
4. **index.html** - Already contains PWA meta tags and service worker registration
5. **/icons/** - Folder created (needs icon files)

### ⏳ Required Actions
1. Create icon files (4 PNG images)
2. Deploy to HTTPS server
3. Install Bubblewrap CLI
4. Generate Android package
5. Get SHA256 fingerprint and update assetlinks.json
6. Deploy assetlinks.json to server
7. Submit to Google Play Store

## 📱 Step-by-Step Deployment

### Step 1: Create Icon Files

You need to create 4 icon files in the `/icons/` folder:

1. **icon-192.png** - 192x192 pixels (standard icon)
2. **icon-512.png** - 512x512 pixels (high-res icon)
3. **icon-maskable-192.png** - 192x192 pixels with safe zone
4. **icon-maskable-512.png** - 512x512 pixels with safe zone

**Maskable Icon Requirements:**
- Keep important content within the central 80% "safe zone"
- Background should extend to full 100% (edges may be cropped)
- Use tools like https://maskable.app/ to preview

**Quick Creation Options:**
- Use online tools: https://realfavicongenerator.net/
- Use Figma/Canva with provided templates
- Hire on Fiverr ($5-20)
- See ICON_INSTRUCTIONS.md for detailed guide

### Step 2: Deploy Web App to HTTPS

Your web app MUST be accessible via HTTPS. Options:

**Option A: Vercel (Recommended - Free)**
```bash
npm install -g vercel
vercel login
vercel
```

**Option B: Netlify (Free)**
- Drag and drop your project folder to https://app.netlify.com/drop

**Option C: Custom Server**
- Ensure SSL certificate is installed
- Test at https://yourdomain.com

**Verify Deployment:**
- Visit https://yourdomain.com
- Check that manifest.json loads at https://yourdomain.com/manifest.json
- Confirm all icons load correctly

### Step 3: Install Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
```

**Verify Installation:**
```bash
bubblewrap --version
```

### Step 4: Initialize Android Project

```bash
bubblewrap init --manifest=https://yourdomain.com/manifest.json
```

**You will be prompted for:**
- Package name (default: com.politecoaching.exam) ✓
- App name (default: Polite Exam) ✓
- Host (your domain)
- Start URL (default: /)
- Icon URLs (confirm they load)
- Theme color (default: #2c3e50) ✓
- Background color (default: #ffffff) ✓

**Answer 'yes' to:**
- Create key store
- Generate signing key

**CRITICAL: Save your keystore password!** You'll need it for all future updates.

### Step 5: Build Development APK

```bash
bubblewrap build
```

This creates: `app-release-unsigned.apk`

**Test the APK:**
1. Transfer APK to Android device via USB or email
2. Enable "Install from Unknown Sources" in device settings
3. Install and test the app
4. Verify all features work (especially login and exam functionality)

### Step 6: Get SHA256 Fingerprint

After building, get your signing certificate fingerprint:

```bash
keytool -list -v -keystore ./android.keystore -alias android
```

**Enter keystore password** when prompted.

Look for the line starting with `SHA256:` - copy the entire fingerprint.

Example output:
```
SHA256: 14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5
```

### Step 7: Update assetlinks.json

1. Open `.well-known/assetlinks.json`
2. Replace `YOUR_SHA256_FINGERPRINT_HERE` with your actual SHA256 fingerprint
3. Save the file

**Example:**
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.politecoaching.exam",
    "sha256_cert_fingerprints": [
      "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5"
    ]
  }
}]
```

### Step 8: Deploy assetlinks.json

Upload `.well-known/assetlinks.json` to your server so it's accessible at:
```
https://yourdomain.com/.well-known/assetlinks.json
```

**Verify Digital Asset Links:**
```bash
curl https://yourdomain.com/.well-known/assetlinks.json
```

Should return your assetlinks.json content.

**Test with Google's Tool:**
https://developers.google.com/digital-asset-links/tools/generator

### Step 9: Build Production AAB (for Play Store)

```bash
bubblewrap build --release
```

This creates: `app-release-bundle.aab`

The `.aab` file is required for Google Play Store submission.

## 🏪 Google Play Store Submission

### Required Assets

1. **App Icon**: 512x512 PNG (use your icon-512.png)
2. **Feature Graphic**: 1024x500 PNG (create in Canva/Figma)
3. **Screenshots**: Minimum 2 (recommended 4-8)
   - Take screenshots on actual Android device
   - Show key features: login, exam taking, results
4. **Privacy Policy**: Required URL
   - Create simple policy at https://www.freeprivacypolicy.com/
   - Host at https://yourdomain.com/privacy-policy.html

### Submission Steps

1. **Create Developer Account**
   - Go to https://play.google.com/console
   - Pay $25 one-time registration fee
   - Complete developer profile

2. **Create New App**
   - Click "Create app"
   - Enter app details:
     - Name: Polite Coaching Centre - Exam System
     - Language: English
     - App or game: App
     - Free or paid: Free

3. **Complete App Content**
   - Privacy policy URL
   - App category: Education
   - Content rating questionnaire
   - Target audience: Select appropriate age range

4. **Upload Assets**
   - Upload app-release-bundle.aab
   - Upload icon, feature graphic, screenshots
   - Write app description (see template below)

5. **Set Pricing & Distribution**
   - Countries: Select target countries
   - Pricing: Free
   - Content rating: Complete questionnaire

6. **Submit for Review**
   - Review all sections
   - Click "Submit for review"
   - Wait 1-7 days for approval

### App Description Template

**Short Description (80 chars):**
```
Complete exam management system for Polite Coaching Centre students
```

**Full Description:**
```
Polite Coaching Centre - Exam System

The official exam management app for Polite Coaching Centre students. Take practice exams, track your progress, and prepare for success!

KEY FEATURES:
✓ Secure candidate login
✓ Timed mock examinations
✓ Multiple subject support
✓ Real-time score tracking
✓ Instant results and feedback
✓ Mobile-optimized interface
✓ Offline support

ABOUT POLITE COACHING CENTRE:
Leading coaching institute providing quality education and exam preparation.

SUPPORT:
For technical support, contact: support@politecoaching.com
```

## 🔧 Troubleshooting

### Build Errors

**"Java not found"**
```bash
# Install JDK 11 or higher
# Set JAVA_HOME environment variable
```

**"Android SDK not found"**
```bash
# Install Android Studio
# Or install Android SDK command-line tools separately
```

### App Not Installing

**"Parse error"**
- Ensure device Android version is compatible (Android 5.0+)
- Try rebuilding: `bubblewrap build`

**"App not installed"**
- Enable "Install from Unknown Sources"
- Uninstall any previous version first

### Digital Asset Links Not Working

**App opens in browser instead of TWA**
- Verify assetlinks.json is accessible at `/.well-known/assetlinks.json`
- Check SHA256 fingerprint matches exactly
- Wait 24-48 hours for Google to verify (first time only)

### Service Worker Issues

**Offline mode not working**
- Check browser console for errors
- Verify sw.js is being registered
- Test on HTTPS (required for service workers)

## 📝 Important Notes

### Security
- **NEVER commit android.keystore to version control**
- Store keystore password in secure password manager
- Losing keystore = cannot update app (must publish new app)

### Updates
To update your app:
```bash
# Update web app files
# Update version in manifest.json
bubblewrap update
bubblewrap build --release
# Upload new .aab to Play Store
```

### Testing
- Test on multiple Android devices/versions
- Test offline functionality
- Test all exam features thoroughly
- Get beta testers via Play Store internal testing

### Performance
- Optimize images for mobile
- Minimize JavaScript bundle size
- Use lazy loading where possible
- Test on slow 3G connections

## 🎓 Additional Resources

- [Bubblewrap Documentation](https://github.com/GoogleChromeLabs/bubblewrap)
- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)

## 📞 Support

For deployment assistance:
- Check GitHub Issues: https://github.com/GoogleChromeLabs/bubblewrap/issues
- PWA Community: https://web.dev/community
- Android Developers: https://developer.android.com/community

---

**Version:** 1.0  
**Last Updated:** November 2024  
**Package:** com.politecoaching.exam
