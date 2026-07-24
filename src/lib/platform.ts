export function isMacLikePlatform(platform: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}
