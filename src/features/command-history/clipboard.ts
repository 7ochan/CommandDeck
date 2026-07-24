type ClipboardAccess = Pick<Clipboard, 'writeText'>;

export async function copyCommandText(
  command: string,
  clipboard: ClipboardAccess | undefined = globalThis.navigator?.clipboard,
): Promise<void> {
  if (!clipboard) {
    throw new Error('Clipboard API is unavailable.');
  }

  await clipboard.writeText(command);
}
