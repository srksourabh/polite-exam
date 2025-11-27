# ICON GENERATION INSTRUCTIONS

You need to create 4 PNG icon files in the /icons/ folder:

## Required Icons:

1. **icon-192.png** - 192x192 pixels (standard icon)
2. **icon-512.png** - 512x512 pixels (standard icon)
3. **icon-maskable-192.png** - 192x192 pixels (maskable safe zone)
4. **icon-maskable-512.png** - 512x512 pixels (maskable safe zone)

## Option 1: Use Online Tools (Recommended)

### PWA Asset Generator (Easiest)
1. Visit: https://www.pwabuilder.com/imageGenerator
2. Upload a square logo (minimum 512x512px)
3. Download the generated icons
4. Copy the files to the /icons/ folder

### Favicon Generator
1. Visit: https://realfavicongenerator.net/
2. Upload your logo
3. Generate and download all sizes
4. Rename files as needed

## Option 2: Manual Creation (Photoshop/GIMP)

### Standard Icons (icon-192.png & icon-512.png)
- Create square images at exact sizes
- Add your logo/branding
- Use transparent or solid background
- Export as PNG

### Maskable Icons (icon-maskable-192.png & icon-maskable-512.png)
- Same as standard icons BUT
- Keep important content within 80% center circle (safe zone)
- The outer 20% may be cropped on some devices
- Use online maskable icon editor: https://maskable.app/editor

## Quick Tip:
If you have a 512x512 source logo:
1. Use it as icon-512.png
2. Resize to 192x192 for icon-192.png
3. Add safe zone padding for maskable variants
4. All icons should match your brand colors

## Brand Colors (from your app):
- Primary: #2c3e50 (dark blue-gray)
- Secondary: #3498db (blue)
- Accent: #e67e22 (orange)

## Verification:
After creating icons, check that all 4 files exist:
```
/icons/icon-192.png
/icons/icon-512.png
/icons/icon-maskable-192.png
/icons/icon-maskable-512.png
```
