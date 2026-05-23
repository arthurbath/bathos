import { FileText, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS, getFullViewPageTopPaddingClass } from '@/lib/pageLayout';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { CorpusConfigView } from '@/modules/corpus/components/CorpusConfigView';
import { CorpusDocumentsView } from '@/modules/corpus/components/CorpusDocumentsView';
import { useCorpusAccessTokens } from '@/modules/corpus/hooks/useCorpusAccessTokens';
import { useCorpusDocuments } from '@/modules/corpus/hooks/useCorpusDocuments';
import { useCorpusTags } from '@/modules/corpus/hooks/useCorpusTags';

interface CorpusShellProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
}

export function CorpusShell({ userId, displayName, onSignOut }: CorpusShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useModuleBasePath();
  const { tags, loading: tagsLoading, addTag, updateTag, removeTag } = useCorpusTags(userId);
  const { documents, loading: documentsLoading, addDocument, updateDocument, setDocumentTags, removeDocument } = useCorpusDocuments(userId);
  const { tokens, loading: tokensLoading, newToken, clearNewToken, createToken, revokeToken, hideToken } = useCorpusAccessTokens(userId);
  const navItems = [
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/config', label: 'Config', icon: Settings },
  ] as const;
  const isConfigRoute = location.pathname.endsWith('/config');
  const loading = tagsLoading || documentsLoading || tokensLoading;
  const isFullViewGridRoute = !isConfigRoute;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`relative isolate bg-background ${isFullViewGridRoute ? 'flex h-dvh flex-col overflow-y-hidden overflow-x-visible' : 'min-h-screen'}`}>
      <ToplineHeader
        title="Corpus"
        moduleId="corpus"
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher
      />

      <div className="mx-auto hidden w-full max-w-5xl px-4 pt-6 md:block">
        <nav className="hidden w-full grid-cols-2 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-[hsl(var(--switch-off))] p-1 text-muted-foreground md:grid">
          {navItems.map(({ path, label, icon: Icon }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || location.pathname === path;
            return (
              <a
                key={path}
                href={fullPath}
                onClick={(event) => handleClientSideLinkNavigation(event, navigate, fullPath)}
                className={`inline-flex items-center justify-center gap-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:gap-1.5 sm:text-sm ${active ? 'bg-background text-foreground' : 'text-foreground hover:bg-background/50'}`}
              >
                <Icon className="hidden h-4 w-4 sm:inline" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <main className={isFullViewGridRoute ? `flex w-full flex-1 min-h-0 flex-col ${getFullViewPageTopPaddingClass(true)} ${FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS}` : 'w-full'}>
        {isConfigRoute ? (
          <CorpusConfigView
            userId={userId}
            tags={tags}
            documents={documents}
            tokens={tokens}
            newToken={newToken}
            onClearNewToken={clearNewToken}
            onAddTag={addTag}
            onUpdateTag={updateTag}
            onDeleteTag={removeTag}
            onCreateToken={createToken}
            onRevokeToken={revokeToken}
            onHideToken={hideToken}
          />
        ) : (
          <div className="flex-1 min-h-0">
            <CorpusDocumentsView
              userId={userId}
              documents={documents}
              tags={tags}
              loading={documentsLoading}
              onAddDocument={addDocument}
              onUpdateDocument={updateDocument}
              onSetDocumentTags={setDocumentTags}
              onDeleteDocument={removeDocument}
            />
          </div>
        )}
      </main>

      <MobileBottomNav
        items={navItems}
        isActive={(path) => location.pathname === `${basePath}${path}` || location.pathname === path}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
        hrefForPath={(path) => `${basePath}${path}`}
      />
    </div>
  );
}
