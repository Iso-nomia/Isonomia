import { Pinecone } from '@pinecone-database/pinecone';

export function getPineconeIndex() {
  // constructor already authenticated; nothing async left to do
  return process.env.PINECONE_INDEX_NAME
    ? pc.index(process.env.PINECONE_INDEX_NAME)
    : undefined;                           // graceful fallback
}

// --- singleton pattern avoids reconnecting every call ----
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,   // required
  // environment is no longer needed – the key encodes it
});
