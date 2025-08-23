# TrueCost Chrome Extension - Installation Guide

## How to Install and Test

### Step 1: Download the Extension
1. Click the three dots (⋯) in the top right of the v0 interface
2. Select "Download ZIP" to download all extension files
3. Extract the ZIP file to a folder on your computer

### Step 2: Load in Chrome
1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right corner)
4. Click "Load unpacked" button
5. Select the folder containing the extracted extension files
6. The TrueCost extension should now appear in your extensions list

### Step 3: Test the Extension
1. Open the `demo-checkout.html` file in Chrome (or visit any e-commerce checkout page)
2. The extension will automatically scan for hidden fees
3. Click the TrueCost icon in your Chrome toolbar to see the detailed breakdown
4. Look for highlighted fee elements on the page

## Features Included

✅ **Automatic Fee Detection** - Scans checkout pages for hidden charges  
✅ **Real-time Notifications** - Alerts you when fees are detected  
✅ **Detailed Breakdown** - Shows fee percentages and total markup  
✅ **Transaction History** - Tracks your fee encounters over time  
✅ **Savings Suggestions** - Recommends alternatives and better deals  
✅ **Visual Highlighting** - Highlights detected fees on the page  

## Troubleshooting

- **Extension not working?** Make sure you're on a checkout/payment page
- **No fees detected?** Try the demo-checkout.html page included in the download
- **Popup not showing data?** Refresh the page and wait a few seconds for scanning
- **Permission errors?** Make sure the extension has permission to access website data

## File Structure
\`\`\`
truecost-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── contentScript.js       # Fee detection engine
├── popup.html/js/css      # Extension popup interface
├── savings-engine.js      # Savings suggestions
├── demo-checkout.html     # Test page
└── icons/                 # Extension icons
\`\`\`

The extension is now ready for testing and can be submitted to the Chrome Web Store when ready for public release.
