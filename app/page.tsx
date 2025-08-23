"use client"

export default function SyntheticV0PageForDeployment() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">TrueCost Extension</h1>
          <p className="text-muted-foreground">Chrome extension for detecting hidden fees on checkout pages</p>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-card-foreground">Installation Instructions</h2>
          <ol className="text-left text-sm text-muted-foreground space-y-2">
            <li>1. Download the extension files</li>
            <li>2. Open Chrome and go to chrome://extensions/</li>
            <li>3. Enable "Developer mode"</li>
            <li>4. Click "Load unpacked" and select the extension folder</li>
            <li>5. Visit any e-commerce checkout page to test</li>
          </ol>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>This page is for deployment purposes only.</p>
          <p>The actual extension runs as a Chrome extension.</p>
        </div>
      </div>
    </div>
  )
}
