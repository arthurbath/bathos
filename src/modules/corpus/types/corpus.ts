export type CorpusContentType = 'markdown' | 'plain_text';

export interface CorpusTag {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorpusDocument {
  id: string;
  user_id: string;
  title: string;
  content: string;
  content_type: CorpusContentType;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
  tags: CorpusTag[];
}

export interface CorpusDocumentInput {
  title: string;
  content: string;
  content_type: CorpusContentType;
  source_filename?: string | null;
  tagIds?: string[];
}

export type CorpusDocumentUpdate = Partial<Pick<CorpusDocumentInput, 'title' | 'content' | 'content_type' | 'source_filename'>>;

export interface CorpusAccessToken {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  hidden_at: string | null;
}
