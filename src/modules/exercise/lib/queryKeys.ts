export function exerciseDefinitionsQueryKey(userId: string | undefined) {
  return ['exercise', 'definitions', userId] as const;
}

export function exerciseRoutinesQueryKey(userId: string | undefined) {
  return ['exercise', 'routines', userId] as const;
}
