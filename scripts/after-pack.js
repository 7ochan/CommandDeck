import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * electron-builder afterPack hook for macOS.
 *
 * Ensures that the packaged .app bundle is validly code-signed with sealed resources,
 * bound Info.plist, and hardened runtime entitlements.
 *
 * If electron-builder signed the app with a Developer ID certificate (e.g. in CI),
 * this hook verifies the signature. If signing was skipped (e.g. local build without
 * Keychain identity), this hook performs deep ad-hoc signing so the .app bundle passes
 * local Gatekeeper and codesign verification without resource sealing errors.
 */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(context.appOutDir, `${appName}.app`);

  if (!existsSync(appPath)) {
    console.warn(`[afterPack] App path does not exist: ${appPath}`);
    return;
  }

  console.log(`[afterPack] Auditing macOS code signature for: ${appPath}`);

  let needsSigning = true;

  try {
    const details = execSync(`codesign -dv "${appPath}" 2>&1`, {
      encoding: 'utf8',
    });

    const isDeveloperID = details.includes('Authority=Developer ID Application');
    const isSealed =
      details.includes('Sealed Resources') &&
      !details.includes('Sealed Resources=none');
    const isBound = !details.includes('Info.plist=not bound');
    const isCorrectIdentifier = details.includes(
      `Identifier=${context.packager.appInfo.id}`,
    );

    if (isDeveloperID && isSealed && isBound && isCorrectIdentifier) {
      console.log(
        '[afterPack] App bundle is already validly signed with Developer ID certificate.',
      );
      needsSigning = false;
    }
  } catch {
    needsSigning = true;
  }

  if (needsSigning) {
    console.log(
      `[afterPack] Performing deep ad-hoc signing for macOS app bundle...`,
    );

    const projectDir = context.packager.info.projectDir;
    const entitlements = join(
      projectDir,
      'electron',
      'entitlements.mac.plist',
    );

    // Deep sign all binaries, frameworks, and app bundle
    const signCmd = `codesign --force --deep --options runtime ${
      existsSync(entitlements) ? `--entitlements "${entitlements}"` : ''
    } --sign - "${appPath}"`;

    execSync(signCmd, { stdio: 'inherit' });
    console.log('[afterPack] Deep ad-hoc signing completed successfully.');
  }

  // Verify signature structure
  try {
    execSync(`codesign --verify --verbose=4 "${appPath}"`, {
      stdio: 'inherit',
    });
    console.log('[afterPack] Code signature verification PASSED.');
  } catch (err) {
    console.error('[afterPack] Code signature verification FAILED:', err);
    throw err;
  }
}
