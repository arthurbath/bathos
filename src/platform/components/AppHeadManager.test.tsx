import { useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import AppHeadManager from '@/platform/components/AppHeadManager';

function HeadTestHarness({ to }: { to: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to);
  }, [navigate, to]);

  return <AppHeadManager />;
}

function resetHead() {
  document.head.innerHTML = `
    <title>BathOS</title>
    <meta property="og:title" content="BathOS" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  `;
}

function getMetaByName(name: string) {
  return document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
}

function getMetaByProperty(property: string) {
  return document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
}

function getLinkByRel(rel: string) {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
}

describe('AppHeadManager', () => {
  it('sets module metadata for module routes', async () => {
    resetHead();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/budget/summary']}>
          <HeadTestHarness to="/budget/summary" />
        </MemoryRouter>,
      );
    });

    expect(document.title).toBe('Budget');
    expect(getMetaByName('apple-mobile-web-app-title')?.getAttribute('content')).toBe('Budget');
    expect(getMetaByName('application-name')?.getAttribute('content')).toBe('Budget');
    expect(getMetaByProperty('og:title')?.getAttribute('content')).toBe('Budget');
    expect(getLinkByRel('icon')?.getAttribute('href')).toBe('/module-budget.png');
    expect(getLinkByRel('apple-touch-icon')?.getAttribute('href')).toBe('/module-budget.png');
    expect(getLinkByRel('manifest')?.getAttribute('href')).toBe('/manifest-budget.json');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('updates module metadata when changing modules', async () => {
    resetHead();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/budget/summary']}>
          <HeadTestHarness to="/budget/summary" />
        </MemoryRouter>,
      );
    });

    expect(document.title).toBe('Budget');

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/budget/summary']}>
          <HeadTestHarness to="/garage/due" />
        </MemoryRouter>,
      );
    });

    expect(document.title).toBe('Garage');
    expect(getLinkByRel('icon')?.getAttribute('href')).toBe('/module-garage.png');
    expect(getLinkByRel('manifest')?.getAttribute('href')).toBe('/manifest-garage.json');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('resets to BathOS metadata when leaving a module route', async () => {
    resetHead();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/budget/summary']}>
          <HeadTestHarness to="/budget/summary" />
        </MemoryRouter>,
      );
    });

    expect(document.title).toBe('Budget');

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/budget/summary']}>
          <HeadTestHarness to="/account" />
        </MemoryRouter>,
      );
    });

    expect(document.title).toBe('BathOS');
    expect(getMetaByName('apple-mobile-web-app-title')?.getAttribute('content')).toBe('BathOS');
    expect(getMetaByName('application-name')?.getAttribute('content')).toBe('BathOS');
    expect(getLinkByRel('icon')?.getAttribute('href')).toBe('/favicon.png');
    expect(getLinkByRel('apple-touch-icon')?.getAttribute('href')).toBe('/apple-touch-icon.png');
    expect(getLinkByRel('manifest')?.getAttribute('href')).toBe('/manifest.json');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
