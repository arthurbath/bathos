import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

function renderInitialHead(pathname: string) {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  return new JSDOM(html, {
    runScripts: 'dangerously',
    url: `https://os.bath.garden${pathname}`,
    beforeParse(window) {
      window.URL.createObjectURL = () => 'blob:test-manifest';
      window.URL.revokeObjectURL = () => {};
    },
  });
}

describe('initial PWA document head', () => {
  it('uses the active module icon for Apple Dock installs', () => {
    const dom = renderInitialHead('/garage/due');
    const document = dom.window.document;

    expect(document.title).toBe('Garage');
    expect(document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content).toBe('Garage');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe('https://os.bath.garden/module-garage.png');
    expect(
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')).map((link) => link.href),
    ).toEqual([
      'https://os.bath.garden/module-garage.png',
      'https://os.bath.garden/module-garage.png',
      'https://os.bath.garden/module-garage.png',
      'https://os.bath.garden/module-garage.png',
    ]);
  });

  it('keeps the BathOS icon for the platform root', () => {
    const dom = renderInitialHead('/');
    const document = dom.window.document;

    expect(document.title).toBe('BathOS');
    expect(document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content).toBe('BathOS');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe('https://os.bath.garden/favicon.png');
    expect(document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href).toBe(
      'https://os.bath.garden/apple-touch-icon.png',
    );
  });
});
