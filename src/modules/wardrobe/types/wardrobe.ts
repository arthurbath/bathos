import type { Enums, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type WardrobeCategory = Enums<'wardrobe_category'>;
export type WardrobeStatus = Enums<'wardrobe_status'>;
export type WardrobeItem = Tables<'wardrobe_items'>;
export type WardrobeItemInsert = TablesInsert<'wardrobe_items'>;
export type WardrobeItemUpdate = TablesUpdate<'wardrobe_items'>;

export type WardrobeItemInput = Pick<
  WardrobeItemInsert,
  'name' | 'category' | 'brand' | 'model' | 'color' | 'size' | 'link_url' | 'status' | 'notes'
>;
