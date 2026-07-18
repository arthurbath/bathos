export function getDefaultReceiptName(filename: string): string {
  const finalDotIndex = filename.lastIndexOf('.');
  if (finalDotIndex <= 0 || finalDotIndex === filename.length - 1) return filename;
  return filename.slice(0, finalDotIndex);
}
