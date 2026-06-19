import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyInputGroup, copyTextToClipboard } from '@/components/ui/copy-input-group';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataGridAddFormLabel } from '@/components/ui/data-grid-add-form-label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import type { CorpusAccessToken } from '@/modules/corpus/types/corpus';

interface CorpusConfigViewProps {
  tokens: CorpusAccessToken[];
  newToken: string | null;
  onClearNewToken: () => void;
  onCreateToken: (name: string) => Promise<string>;
  onRevokeToken: (id: string) => Promise<void>;
}

const MCP_URL = 'https://rsqfokyqntmtdejfwmjs.supabase.co/functions/v1/corpus-mcp';

const EXAMPLE_INSTRUCTIONS = `You have access to my BathOS Corpus MCP server. Corpus contains documents I have selected as reusable context for writing, editing, formatting, reasoning, and answering on my behalf.

Use Corpus automatically when I ask you to write, rewrite, edit, copyedit, review text for errors, summarize, generate titles or naming options, apply my conventions, check spelling/grammar/punctuation/formatting, write in my voice, use a professional/personal/prose/technical tone, write about me or my work, answer questions about personal details from my life that you do not already know, or avoid patterns I dislike.

Available Corpus tools:
- list_tags: List the fixed Corpus tags and document counts.
- search: Search documents by title, body text, source filename, and tags. Use query, tags, and limit.
- fetch: Fetch the full content of one document by id. Use this after search returns a relevant result.
- get_context_bundle: Retrieve a task-focused bundle using one of these intents: write_in_voice, apply_conventions, style_review, professional_tone, personal_tone, prose_tone, technical_tone, biography, avoid_antipatterns, reference, or template.
- get_style_conventions: Retrieve authoritative Style Conventions, Instructions, and Anti-patterns for grammar, spelling, punctuation, formatting, copyediting, naming, and style-compliance review.
- get_style_profile: Retrieve a compact writing-style profile when the task is broadly about my voice, conventions, tone, or preferences.

Corpus tag meanings:
- Anti-patterns: Phrases, tones, structures, and habits to avoid.
- Biography: Documents that describe who I am.
- Domain Knowledge: Reusable subject-matter context.
- Instructions: General instructions, preferences, rules, and reusable guidance.
- Reference Material: Source material to consult when answering or drafting.
- Style Conventions: Spelling, grammar, formatting, naming, and usage conventions. Treat these as authoritative for style review and copyediting.
- Template: Reusable structures, formats, and boilerplate.
- Tone Example: Personal: Examples of personal, informal writing.
- Tone Example: Professional: Examples of workplace writing.
- Tone Example: Prose: Examples of polished prose writing.
- Tone Example: Technical: Examples of technical writing.

Retrieval workflow:
1. For grammar, spelling, punctuation, formatting, copyediting, naming, style-review, convention-compliance, or "does this violate my preferences?" tasks, call get_style_conventions or get_context_bundle with intent style_review before reviewing. Fetch returned Style Conventions documents first and use them as the authority.
2. For writing and content-generation tasks, call get_context_bundle with the closest intent and a short query from the request.
3. If I ask about something personal from my life and you do not have specific memory or context, search Corpus before answering. Prioritize Reference Material, Biography, and Domain Knowledge when looking for that context.
4. If a narrower lookup is needed, call search with relevant query terms and tag filters.
5. Inspect returned titles, excerpts, and tags.
6. Call fetch for the most relevant documents before drafting, editing, or reviewing from them.
7. Prefer explicit Instructions and Style Conventions over inferred patterns from examples.
8. Apply Anti-patterns as negative guidance.
9. Do not quote or reveal private Corpus content unless I explicitly ask you to.
10. If Corpus is unavailable, say so briefly and proceed only if the task can still be handled safely.`;

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function CorpusConfigView({
  tokens,
  newToken,
  onClearNewToken,
  onCreateToken,
  onRevokeToken,
}: CorpusConfigViewProps) {
  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CorpusAccessToken | null>(null);

  const createToken = async () => {
    if (creatingToken) return;
    setCreatingToken(true);
    try {
      await onCreateToken(tokenName);
      setTokenName('');
      setCreateTokenOpen(false);
    } catch (error) {
      toast({ title: 'Failed to Create Token', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setCreatingToken(false);
    }
  };

  const openCreateTokenDialog = () => {
    setTokenName('');
    setCreateTokenOpen(true);
  };

  const closeCreateTokenDialog = () => {
    setTokenName('');
    setCreateTokenOpen(false);
  };

  const copyExampleInstructions = async () => {
    try {
      await copyTextToClipboard(EXAMPLE_INSTRUCTIONS);
      toast({ title: 'Copied to Clipboard' });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: error instanceof Error ? error.message : 'Unable to write to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const hasTokens = tokens.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] pt-4 md:pb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>MCP Access</CardTitle>
          {hasTokens && (
            <Button
              type="button"
              variant="outline-success"
              size="sm"
              className="h-8 gap-1.5"
              onClick={openCreateTokenDialog}
            >
              <Plus className="h-4 w-4" />
              Create Token
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasTokens ? (
            <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
              <div className="max-w-xl space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Create a Token to Connect an AI</h3>
                <p className="text-sm text-muted-foreground">
                  Tokens let AI agents read your Corpus documents.
                </p>
              </div>
              <Button
                type="button"
                variant="outline-success"
                className="gap-1.5"
                onClick={openCreateTokenDialog}
              >
                <Plus className="h-4 w-4" />
                Create Token
              </Button>
            </div>
          ) : (
            <>
              <CopyInputGroup readOnly value={MCP_URL} aria-label="MCP URL" buttonAriaLabel="Copy MCP URL" />

              <div className="space-y-2">
                {tokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{token.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(token.created_at)} · Last Used {formatDate(token.last_used_at)}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline-destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setRevokeTarget(token)}
                  >
                    Revoke
                  </Button>
                </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Example Instructions</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void copyExampleInstructions()}
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={EXAMPLE_INSTRUCTIONS}
            className="min-h-[520px] resize-y font-mono text-xs leading-relaxed"
            aria-label="Example Instructions"
          />
        </CardContent>
      </Card>

      <Dialog open={createTokenOpen} onOpenChange={(open) => !creatingToken && (open ? openCreateTokenDialog() : closeCreateTokenDialog())}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Create Token</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <DataGridAddFormLabel htmlFor="corpus-token-name" required>Name</DataGridAddFormLabel>
              <Input
                id="corpus-token-name"
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                placeholder="Codex"
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={creatingToken} onClick={closeCreateTokenDialog}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" variant="outline-success" disabled={creatingToken || !tokenName.trim()} onClick={() => void createToken()}>
              {creatingToken ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newToken} onOpenChange={(open) => !open && onClearNewToken()}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Token Created</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy or write down this token now. It will not be shown again, but you can revoke it at any time from the MCP Access list.
            </p>
            <div className="space-y-2">
              <Label htmlFor="corpus-new-token">Token</Label>
              <CopyInputGroup id="corpus-new-token" readOnly value={newToken ?? ''} aria-label="Token" buttonAriaLabel="Copy Token" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corpus-token-mcp-url">MCP URL</Label>
              <CopyInputGroup id="corpus-token-mcp-url" readOnly value={MCP_URL} aria-label="MCP URL" buttonAriaLabel="Copy MCP URL" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button data-dialog-confirm="true" type="button" variant="outline" onClick={onClearNewToken}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{revokeTarget?.name}"?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>Agents using this token will lose access to Corpus, and the token will be deleted from this list.</AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!revokeTarget) return;
                void onRevokeToken(revokeTarget.id);
                setRevokeTarget(null);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
