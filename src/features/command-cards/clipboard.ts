export async function copyCommandText(
  command: string,
  clipboard: Pick<Clipboard, 'writeText'> = navigator.clipboard,
): Promise<void> {
  await clipboard.writeText(command);
}
