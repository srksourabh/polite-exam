# 📱 Google Play Store Publishing Guide for Polite Exam

## Step-by-Step Instructions

---

## PHASE 1: Generate Signing Key (ONE-TIME SETUP)

### Step 1: Generate Keystore
1. Open Command Prompt in the `android` folder
2. Run: `generate-keystore.bat`
3. You'll be asked for:
   - **Keystore password**: Choose a STRONG password (save it!)
   - **Key password**: Can be same as keystore password
   - **First and last name**: Your name or company name
   - **Organizational unit**: UDS or your department
   - **Organization**: Ultimate Digital Solutions
   - **City/Locality**: Your city
   - **State/Province**: West Bengal
   - **Country code**: IN

4. **CRITICAL**: Save these passwords in a secure location!
   - You'll need them for EVERY app update
   - If you lose them, you can NEVER update your app!

### Step 2: Update key.properties
1. Open `android/key.properties`
2. Replace `YOUR_KEYSTORE_PASSWORD_HERE` with your keystore password
3. Replace `YOUR_KEY_PASSWORD_HERE` with your key password
4. Save the file

### Step 3: Secure Your Keys
**IMPORTANT**: Add to `.gitignore` to prevent accidental upload:
```
android/key.properties
android/*.keystore
```

---

## PHASE 2: Build Release App Bundle

### Step 4: Update Version (For Future Updates)
Edit `android/app/build.gradle`:
```gradle
versionCode 1        // Increment for each release (2, 3, 4...)
versionName "1.0"    // Your version number (1.0, 1.1, 2.0...)
```

### Step 5: Build the App Bundle
Run these commands:

**Option A: Using Gradle Wrapper (Recommended)**
```cmd
cd android
gradlew clean
gradlew bundleRelease
```

**Option B: Using Android Studio**
1. Open `android` folder in Android Studio
2. Build > Generate Signed Bundle / APK
3. Select "Android App Bundle"
4. Select your keystore file
5. Enter passwords
6. Build

### Step 6: Locate Your App Bundle
Your signed AAB file will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## PHASE 3: Google Play Console Setup

### Step 7: Create App in Play Console
1. Go to: https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - **App name**: Polite Coaching Centre
   - **Default language**: English
   - **App or Game**: App
   - **Free or Paid**: Free
4. Accept declarations
5. Click "Create app"

### Step 8: Complete Store Listing
Navigate to: **"Store presence" > "Main store listing"**

#### Required Information:
- **App name**: Polite Coaching Centre
- **Short description** (80 chars max):
  ```
  Complete exam management system for competitive exam preparation
  ```

- **Full description** (4000 chars max):
  ```
  Polite Coaching Centre - Your Ultimate Exam Preparation Partner

  Prepare for government job exams with our comprehensive exam management system designed for reasoning, mathematics, and general knowledge tests.

  KEY FEATURES:
  ✅ Practice Exams - Take unlimited practice tests
  ✅ Timed Tests - Simulate real exam conditions
  ✅ Instant Results - Get immediate feedback with detailed analysis
  ✅ Performance Tracking - Monitor your progress over time
  ✅ Subject-wise Tests - Focus on specific subjects
  ✅ Secure & Reliable - Your data is always protected

  PERFECT FOR:
  • Banking exam aspirants (IBPS, SBI, RRB)
  • Railway recruitment candidates
  • SSC exam preparation
  • General competitive exam students

  WHY CHOOSE POLITE COACHING CENTRE?
  With 15+ years of experience in exam coaching, we understand what students need to succeed. Our app brings professional exam preparation to your mobile device.

  Start your journey to success today!
  ```

- **App icon**: 512x512 PNG (use your icon from `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`)

#### Screenshots Required (minimum 2, maximum 8):
- Phone screenshots: 16:9 or 9:16 ratio
- Minimum dimension: 320px
- Maximum dimension: 3840px
- Recommended: 1080x1920 or 1080x2340

**Take screenshots of:**
1. Home/Login screen
2. Exam selection screen
3. Question screen during exam
4. Results screen
5. Admin panel (optional)

### Step 9: App Content
Navigate to: **"Policy" > "App content"**

Complete these sections:
1. **Privacy Policy**: 
   - Required if you collect user data
   - Host it on your website or use a generator
   - Suggested: https://polite-exam.vercel.app/privacy-policy

2. **App Access**: 
   - Select "All functionality is available without special access"

3. **Ads**:
   - Select "No" if you don't have ads

4. **Content Rating**:
   - Fill out questionnaire
   - Educational app → likely rated "Everyone"

5. **Target Audience**:
   - Select "18-64" (or as appropriate)
   - Not designed for children

6. **News App**: Select "No"

7. **COVID-19 Contact Tracing**: Select "No"

8. **Data Safety**:
   - Disclose what data you collect (name, email, exam scores)
   - Explain how it's used (authentication, progress tracking)
   - Mention it's encrypted in transit

### Step 10: Create Release

Navigate to: **"Release" > "Production" > "Create new release"**

1. Click "Upload" and select your `app-release.aab` file
2. **Release name**: "1.0" (matches your versionName)
3. **Release notes** (what's new):
   ```
   Initial release of Polite Coaching Centre exam app
   
   Features:
   • Take practice exams for competitive tests
   • Timed test simulation
   • Instant results and detailed analysis
   • Subject-wise practice
   • Performance tracking
   
   Perfect for banking, railway, SSC, and other government job exam preparation.
   ```

4. Click "Next" and review
5. Click "Start rollout to Production"

---

## PHASE 4: Wait for Review

### Step 11: App Review Process
- **Review time**: Usually 1-3 days (can be up to 7 days)
- **You'll receive email**: When approved or if changes needed
- **Status**: Check in Play Console dashboard

### Common Rejection Reasons & Fixes:
- ❌ **Privacy Policy missing**: Add privacy policy URL
- ❌ **Incomplete store listing**: Fill all required fields
- ❌ **Screenshots don't match app**: Update screenshots
- ❌ **Permissions not explained**: Update data safety section

---

## PHASE 5: After Approval

### Step 12: Your App is Live! 🎉
- **Play Store Link**: https://play.google.com/store/apps/details?id=com.politecoaching.exam
- Share this link with your users
- Monitor reviews and ratings
- Track installations in Play Console

---

## Future Updates

### How to Release Updates:
1. Update `versionCode` (e.g., 1 → 2)
2. Update `versionName` (e.g., "1.0" → "1.1")
3. Make your changes to the app
4. Run: `npx cap sync android`
5. Build new AAB: `gradlew bundleRelease`
6. Upload to Play Console > Create new release
7. Add release notes describing changes
8. Submit for review

---

## Important Files Checklist

Before uploading, ensure you have:
- ✅ Signed AAB file (app-release.aab)
- ✅ App icon (512x512 PNG)
- ✅ At least 2 screenshots
- ✅ Privacy policy URL
- ✅ Full description written
- ✅ All content questionnaires completed

---

## Troubleshooting

### Build Failed?
```cmd
cd android
gradlew clean
gradlew bundleRelease --stacktrace
```

### Keystore Issues?
- Make sure `key.properties` has correct passwords
- Verify keystore file exists in `android/` folder
- Check file paths in `key.properties`

### Upload Failed?
- Ensure you incremented `versionCode`
- Check AAB file is not corrupted
- Verify signing configuration is correct

---

## Need Help?
- Google Play Console Help: https://support.google.com/googleplay/android-developer
- Capacitor Docs: https://capacitorjs.com/docs/android/deploying-to-google-play

---

## Quick Reference Commands

```cmd
# Navigate to project
cd "C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam"

# Sync web assets
npx cap sync android

# Build release
cd android
gradlew clean
gradlew bundleRelease

# Output location
android\app\build\outputs\bundle\release\app-release.aab
```

---

**REMEMBER**: 
- Keep your keystore and passwords SAFE!
- Increment versionCode for each update
- Test thoroughly before releasing
- Monitor user reviews and respond promptly

Good luck with your app launch! 🚀
