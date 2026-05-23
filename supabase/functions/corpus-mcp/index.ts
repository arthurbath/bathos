import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type JsonRpcRequest = {
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type CorpusTag = {
  id: string;
  name: string;
  description?: string | null;
};

type CorpusDocument = {
  id: string;
  title: string;
  content: string;
  content_type: "markdown" | "plain_text";
  source_filename: string | null;
  created_at: string;
  updated_at: string;
  corpus_document_tags?: Array<{ tag: CorpusTag | null }>;
};

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return jsonResponse({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string, status = 400) {
  return jsonResponse({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticate(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token.");

  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabaseAdmin
    .from("corpus_access_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .single();

  if (error || !data) throw new Error("Invalid bearer token.");

  await supabaseAdmin
    .from("corpus_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data.user_id as string;
}

function documentTags(document: CorpusDocument) {
  return (document.corpus_document_tags ?? [])
    .map((entry) => entry.tag)
    .filter((tag): tag is CorpusTag => Boolean(tag))
    .map((tag) => tag.name)
    .sort((left, right) => left.localeCompare(right));
}

function summarizeDocument(document: CorpusDocument) {
  const tags = documentTags(document);
  const excerpt = document.content.replace(/\s+/g, " ").trim().slice(0, 500);
  return {
    id: document.id,
    title: document.title,
    content_type: document.content_type,
    source_filename: document.source_filename,
    tags,
    updated_at: document.updated_at,
    excerpt,
  };
}

async function listTools(id: JsonRpcRequest["id"]) {
  return rpcResult(id, {
    tools: [
      {
        name: "search",
        description: "Search the authenticated user's Corpus documents by title, body text, source filename, and tags.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            limit: { type: "number", minimum: 1, maximum: 50 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "fetch",
        description: "Fetch one Corpus document by id.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
          additionalProperties: false,
        },
      },
      {
        name: "list_tags",
        description: "List the authenticated user's Corpus tags and document counts.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "get_context_bundle",
        description: "Return documents for a writing, style review, or reference intent using the prescribed Corpus tag vocabulary. For grammar, copyediting, formatting, or convention-compliance review, use intent style_review or apply_conventions.",
        inputSchema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: [
                "write_in_voice",
                "apply_conventions",
                "style_review",
                "professional_tone",
                "personal_tone",
                "prose_tone",
                "technical_tone",
                "biography",
                "avoid_antipatterns",
                "reference",
                "template",
              ],
            },
            query: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 20 },
          },
          required: ["intent"],
          additionalProperties: false,
        },
      },
      {
        name: "get_style_conventions",
        description: "Return the user's authoritative Style Conventions, Instructions, and Anti-pattern documents for grammar, spelling, punctuation, formatting, copyediting, naming, and style-compliance review. Use this before reviewing text against the user's preferences.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 20 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "get_style_profile",
        description: "Return a compact style profile assembled from documents tagged as instructions, conventions, tone examples, biography, or anti-patterns. Prefer get_style_conventions for grammar, copyediting, formatting, or style-review tasks.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "number", minimum: 1, maximum: 20 } },
          additionalProperties: false,
        },
      },
    ],
  });
}

async function listTags(userId: string) {
  const { data: tags, error: tagsError } = await supabaseAdmin
    .from("corpus_tags")
    .select("id, name, description")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (tagsError) throw tagsError;

  const { data: documentTags, error: documentTagsError } = await supabaseAdmin
    .from("corpus_document_tags")
    .select("tag_id")
    .eq("user_id", userId);
  if (documentTagsError) throw documentTagsError;

  const counts = new Map<string, number>();
  for (const row of documentTags ?? []) {
    const tagId = typeof row.tag_id === "string" ? row.tag_id : "";
    if (tagId) counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
  }

  return {
    tags: ((tags ?? []) as CorpusTag[]).map((tag) => ({
      id: tag.id,
      name: tag.name,
      description: tag.description,
      document_count: counts.get(tag.id) ?? 0,
    })),
  };
}

async function searchDocuments(userId: string, args: Record<string, unknown>) {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const tags = Array.isArray(args.tags) ? args.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);

  const request = supabaseAdmin
    .from("corpus_documents")
    .select("id, title, content, content_type, source_filename, created_at, updated_at, corpus_document_tags(tag:corpus_tags(id, name))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit, 200));

  const { data, error } = await request;
  if (error) throw error;

  const normalizedTags = tags.map((tag) => tag.trim().toLocaleLowerCase());
  const normalizedQuery = query.toLocaleLowerCase();
  const documents = ((data ?? []) as CorpusDocument[]).filter((document) => {
    const tagNames = documentTags(document);
    if (normalizedQuery) {
      const matchesQuery = (
        document.title.toLocaleLowerCase().includes(normalizedQuery)
        || document.content.toLocaleLowerCase().includes(normalizedQuery)
        || (document.source_filename ?? "").toLocaleLowerCase().includes(normalizedQuery)
        || tagNames.some((tag) => tag.toLocaleLowerCase().includes(normalizedQuery))
      );
      if (!matchesQuery) return false;
    }
    if (normalizedTags.length === 0) return true;
    const names = tagNames.map((tag) => tag.toLocaleLowerCase());
    return normalizedTags.every((tag) => names.includes(tag));
  }).slice(0, limit);

  return { documents: documents.map(summarizeDocument) };
}

const CONTEXT_INTENT_TAGS: Record<string, string[]> = {
  write_in_voice: [
    "Instructions",
    "Style Conventions",
    "Tone Example: Professional",
    "Tone Example: Personal",
    "Tone Example: Prose",
    "Tone Example: Technical",
    "Anti-patterns",
  ],
  apply_conventions: ["Style Conventions", "Instructions", "Anti-patterns"],
  style_review: ["Style Conventions", "Instructions", "Anti-patterns"],
  professional_tone: ["Instructions", "Style Conventions", "Tone Example: Professional", "Anti-patterns"],
  personal_tone: ["Instructions", "Style Conventions", "Tone Example: Personal", "Anti-patterns"],
  prose_tone: ["Instructions", "Style Conventions", "Tone Example: Prose", "Reference Material", "Anti-patterns"],
  technical_tone: ["Instructions", "Style Conventions", "Tone Example: Technical", "Domain Knowledge", "Reference Material", "Anti-patterns"],
  biography: ["Biography", "Instructions"],
  avoid_antipatterns: ["Anti-patterns"],
  reference: ["Reference Material", "Domain Knowledge", "Instructions"],
  template: ["Template", "Style Conventions", "Instructions"],
};

const QUERY_REQUIRED_CONTEXT_INTENTS = new Set(["biography", "reference"]);

function documentMatchesQuery(document: CorpusDocument, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  const tagNames = documentTags(document);
  return (
    document.title.toLocaleLowerCase().includes(normalizedQuery)
    || document.content.toLocaleLowerCase().includes(normalizedQuery)
    || (document.source_filename ?? "").toLocaleLowerCase().includes(normalizedQuery)
    || tagNames.some((tag) => tag.toLocaleLowerCase().includes(normalizedQuery))
  );
}

function tagWeightsForIntentTags(tagNames: string[]) {
  return new Map(tagNames.map((tag, index) => [tag.toLocaleLowerCase(), (tagNames.length - index) * 10]));
}

function scoreDocumentForTags(document: CorpusDocument, tagWeights: Map<string, number>, query: string) {
  const tagScore = documentTags(document).reduce((score, tag) => score + (tagWeights.get(tag.toLocaleLowerCase()) ?? 0), 0);
  if (tagScore === 0) return 0;
  const queryScore = query && documentMatchesQuery(document, query) ? 5 : 0;
  return tagScore + queryScore;
}

function shouldFilterContextIntentByQuery(intent: string, query: string) {
  return query.trim().length > 0 && QUERY_REQUIRED_CONTEXT_INTENTS.has(intent);
}

function contextGuidanceForIntent(intent: string) {
  if (intent === "style_review" || intent === "apply_conventions") {
    return "Use this bundle before grammar, copyediting, formatting, naming, punctuation, or style-compliance review. Fetch Style Conventions documents first and treat them as authoritative. Apply Anti-patterns as negative guidance.";
  }
  return "Use fetch for any returned document that appears relevant before drafting. Prefer explicit Instructions and Style Conventions over inferred examples. Apply Anti-patterns as negative guidance.";
}

async function getContextBundle(userId: string, args: Record<string, unknown>) {
  const intent = typeof args.intent === "string" ? args.intent : "";
  const tagNames = CONTEXT_INTENT_TAGS[intent];
  if (!tagNames) throw new Error("Unsupported context intent.");

  const query = typeof args.query === "string" ? args.query.trim() : "";
  const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
  const tagWeights = tagWeightsForIntentTags(tagNames);
  const shouldApplyQueryFilter = shouldFilterContextIntentByQuery(intent, query);

  const { data, error } = await supabaseAdmin
    .from("corpus_documents")
    .select("id, title, content, content_type, source_filename, created_at, updated_at, corpus_document_tags(tag:corpus_tags(id, name))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const documents = ((data ?? []) as CorpusDocument[])
    .map((document) => ({ document, score: scoreDocumentForTags(document, tagWeights, query) }))
    .filter(({ document, score }) => score > 0 && (!shouldApplyQueryFilter || documentMatchesQuery(document, query)))
    .sort((left, right) => right.score - left.score || Date.parse(right.document.updated_at) - Date.parse(left.document.updated_at))
    .slice(0, limit)
    .map(({ document }) => summarizeDocument(document));

  return {
    intent,
    tags: tagNames,
    guidance: contextGuidanceForIntent(intent),
    documents,
  };
}

async function getStyleConventions(userId: string, args: Record<string, unknown>) {
  return getContextBundle(userId, { ...args, intent: "style_review" });
}

async function fetchDocument(userId: string, args: Record<string, unknown>) {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) throw new Error("Document id is required.");

  const { data, error } = await supabaseAdmin
    .from("corpus_documents")
    .select("id, title, content, content_type, source_filename, created_at, updated_at, corpus_document_tags(tag:corpus_tags(id, name))")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error || !data) throw new Error("Document not found.");
  const document = data as CorpusDocument;
  return { ...summarizeDocument(document), content: document.content };
}

async function getStyleProfile(userId: string, args: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
  const { data, error } = await supabaseAdmin
    .from("corpus_documents")
    .select("id, title, content, content_type, source_filename, created_at, updated_at, corpus_document_tags(tag:corpus_tags(id, name))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const styleTagWeights = tagWeightsForIntentTags([
    "Style Conventions",
    "Instructions",
    "Anti-patterns",
    "Tone Example: Professional",
    "Tone Example: Personal",
    "Tone Example: Prose",
    "Tone Example: Technical",
    "Biography",
  ]);
  const documents = ((data ?? []) as CorpusDocument[])
    .map((document) => ({ document, score: scoreDocumentForTags(document, styleTagWeights, "") }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || Date.parse(right.document.updated_at) - Date.parse(left.document.updated_at))
    .slice(0, limit)
    .map(({ document }) => summarizeDocument(document));

  return {
    guidance: "Use these documents as source material for the user's writing voice and preferences. Prefer explicit Style Conventions, Instructions, and Anti-patterns over inferred examples. For grammar or style review, call get_style_conventions and fetch the returned Style Conventions documents.",
    documents,
  };
}

function toolContent(payload: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Invalid JSON.");
  }

  if (body.method === "initialize") {
    return rpcResult(body.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "BathOS Corpus", version: "0.1.0" },
    });
  }

  if (body.method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  if (body.method === "tools/list") {
    return listTools(body.id);
  }

  if (body.method !== "tools/call") {
    return rpcError(body.id, -32601, "Method not found.");
  }

  let userId: string;
  try {
    userId = await authenticate(req);
  } catch (error) {
    return rpcError(body.id, -32001, error instanceof Error ? error.message : "Unauthorized.", 401);
  }

  const toolName = typeof body.params?.name === "string" ? body.params.name : "";
  const args = typeof body.params?.arguments === "object" && body.params.arguments !== null
    ? body.params.arguments as Record<string, unknown>
    : {};

  try {
    if (toolName === "search") return rpcResult(body.id, toolContent(await searchDocuments(userId, args)));
    if (toolName === "fetch") return rpcResult(body.id, toolContent(await fetchDocument(userId, args)));
    if (toolName === "list_tags") return rpcResult(body.id, toolContent(await listTags(userId)));
    if (toolName === "get_context_bundle") return rpcResult(body.id, toolContent(await getContextBundle(userId, args)));
    if (toolName === "get_style_conventions") return rpcResult(body.id, toolContent(await getStyleConventions(userId, args)));
    if (toolName === "get_style_profile") return rpcResult(body.id, toolContent(await getStyleProfile(userId, args)));
    return rpcError(body.id, -32602, "Unknown tool.");
  } catch (error) {
    return rpcError(body.id, -32000, error instanceof Error ? error.message : "Tool call failed.", 500);
  }
});
