# CommandDeck Application Icons

This directory contains the application icons used by Electron for the desktop
application.

## Files

| File | Platform | Size | Purpose |
|------|----------|------|---------|
| `icon.icns` | macOS | 1024×1024 (multi-resolution) | App icon, Dock, Finder |
| `icon.ico` | Windows | Multi-size (16–256 px) | App icon, Taskbar, Explorer |
| `icon.png` | Linux | 1024×1024 | App icon, Application launcher |
| `icon-512.png` | Linux (fallback) | 512×512 | Used by some desktop environments |

## Replacing Icons

To use a final branded icon, replace the files above with production assets.
**No code changes are required** — the paths are resolved automatically in
`electron/main.ts`.

### macOS (.icns)

1. Create a 1024×1024 PNG source image.
2. Run:
   ```bash
   mkdir -p CommandDeck.iconset
   for size in 16 32 128 256 512; do
     sips -Z $size icon.png --out CommandDeck.iconset/icon_${size}x${size}.png
     sips -Z $((size*2)) icon.png --out CommandDeck.iconset/icon_${size}x${size}@2x.png
   done
   iconutil -c icns CommandDeck.iconset --output icon.icns
   ```

### Windows (.ico)

Use an online converter or `electron-icon-builder` to produce a multi-size
`.ico` from a 1024×1024 PNG. Recommended sizes: 16, 32, 48, 64, 128, 256.

```bash
npx electron-icon-builder --input icon.png --output .
# renames output/icons/win/icon.ico → electron/assets/icon.ico
```

### Linux (.png)

Copy your 1024×1024 PNG directly:
```bash
cp your-icon-1024.png electron/assets/icon.png
```

## Current Status

The current icons are **placeholder assets** generated during development.
Replace them before the production release.
