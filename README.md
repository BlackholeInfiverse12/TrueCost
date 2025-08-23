# TrueCost Chrome Extension

A Chrome extension that detects hidden fees on checkout pages and provides transparent cost breakdowns.

## Installation

1. Download or clone this project
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select this folder
5. The TrueCost extension should now appear in your extensions

## Testing

1. Open the `demo-checkout.html` file in Chrome
2. Click the TrueCost extension icon in your toolbar
3. The extension will automatically detect hidden fees and show a breakdown

## Files Structure

- `manifest.json` - Extension configuration
- `background.js` - Service worker for extension logic
- `contentScript.js` - Analyzes web pages for hidden fees
- `popup.html/js/css` - Extension popup interface
- `content.css` - Styles for in-page notifications
- `savings-engine.js` - Intelligent savings suggestions
- `demo-checkout.html` - Test page with hidden fees
- `icons/` - Extension icons

## Features

- ✅ Automatic hidden fee detection
- ✅ Real-time cost breakdown
- ✅ Transaction history tracking
- ✅ Savings suggestions
- ✅ In-page notifications
- ✅ Privacy-first local storage

No build process required - just load directly into Chrome!
