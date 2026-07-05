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

function renderStaticHead(pathname: string) {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  return new JSDOM(html, {
    url: `https://os.bath.garden${pathname}`,
  });
}

describe('initial PWA document head', () => {
  it('exposes route-relative module icons without JavaScript for Safari Dock installs', () => {
    const dom = renderStaticHead('/garage/due');
    const document = dom.window.document;

    expect(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href).toBe(
      'https://os.bath.garden/garage/manifest.json',
    );
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe('https://os.bath.garden/garage/favicon.png');
    expect(
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')).map((link) => link.href),
    ).toEqual([
      'https://os.bath.garden/garage/apple-touch-icon.png',
      'https://os.bath.garden/garage/apple-touch-icon.png',
      'https://os.bath.garden/garage/apple-touch-icon.png',
      'https://os.bath.garden/garage/apple-touch-icon.png',
    ]);
  });

  it('still uses the active module metadata when JavaScript runs', () => {
    const dom = renderInitialHead('/garage/due');
    const document = dom.window.document;

    expect(document.title).toBe('Garage');
    expect(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href).toBe('blob:test-manifest');
  });

  it('exposes route-relative module icons for other modules', () => {
    const dom = renderStaticHead('/snake/weights');
    const document = dom.window.document;

    expect(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href).toBe(
      'https://os.bath.garden/snake/manifest.json',
    );
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe('https://os.bath.garden/snake/favicon.png');
    expect(
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')).map((link) => link.href),
    ).toEqual([
      'https://os.bath.garden/snake/apple-touch-icon.png',
      'https://os.bath.garden/snake/apple-touch-icon.png',
      'https://os.bath.garden/snake/apple-touch-icon.png',
      'https://os.bath.garden/snake/apple-touch-icon.png',
    ]);
  });

  it('keeps the BathOS icon for the platform root', () => {
    const dom = renderStaticHead('/');
    const document = dom.window.document;

    expect(document.title).toBe('BathOS');
    expect(document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content).toBe('BathOS');
    expect(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href).toBe('https://os.bath.garden/manifest.json');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe('https://os.bath.garden/favicon.png');
    expect(document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href).toBe(
      'https://os.bath.garden/apple-touch-icon.png',
    );
  });
});
