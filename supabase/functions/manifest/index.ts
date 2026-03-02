const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/manifest+json',
  'Cache-Control': 'no-cache',
};

/** Allowed module configs – prevents arbitrary values in the manifest. */
const MODULES: Record<string, { name: string; icon: string; startUrl: string }> = {
  budget:  { name: 'Budget',          icon: '/module-budget.png',          startUrl: '/budget/summary' },
  drawers: { name: 'Drawer Planner',  icon: '/module-drawer-planner.png',  startUrl: '/drawers/plan' },
  garage:  { name: 'Garage',          icon: '/module-garage.png',          startUrl: '/garage/due' },
  admin:   { name: 'Administration',  icon: '/module-administration.png',  startUrl: '/admin' },
};

const DEFAULT = {
  name: 'BathOS',
  icon: '/icon-192.png',
  startUrl: '/',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const moduleId = url.searchParams.get('module');
  const cfg = moduleId && MODULES[moduleId] ? MODULES[moduleId] : DEFAULT;

  const manifest = {
    name: cfg.name,
    short_name: cfg.name,
    description: 'A bunch of hyper-specific apps for Art and his friends',
    start_url: cfg.startUrl,
    display: 'standalone',
    background_color: '#fcfcfc',
    theme_color: '#1f1f1f',
    icons: [
      { src: cfg.icon, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: cfg.icon, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  return new Response(JSON.stringify(manifest), { headers: corsHeaders });
});
