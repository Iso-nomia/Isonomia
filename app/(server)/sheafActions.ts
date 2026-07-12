// app/(server)/sheafActions.ts
'use server';

import { createMessage, listMessagesFor } from '@/app/api/_sheaf-acl-demo/_store';

export async function createSheafMessage(input: Parameters<typeof createMessage>[0]) {
  return createMessage(input);
}

export async function listSheafMessagesFor(userId: string) {
  return listMessagesFor(userId);
}
