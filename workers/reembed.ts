// // // workers/reembed.ts


// // async function handler(job: any) {
// //   const userId = Number(job.data.userId);          // BullMQ payload → number

//   // const attrs = await prisma.userAttributes.findUnique({
//   //   where: { user_id: BigInt(userId) },
//   // });
//   // if (!attrs) return;

//   // // Build a single descriptive string
//   // const desc = [
//   //   attrs.interests.join(' '),
//   //   attrs.hobbies.join(' '),
//   //   attrs.location ?? '',
//   // ].join(' ');

//   // // Call your embedding service
//   // const { data } = await axios.post(
//   //   process.env.EMBEDDING_URL ?? 'http://localhost:3000/embed',
//   //   { text: desc },
//   // );
// //   const vector = data.vector as number[];

// //   // Upsert into Postgres (vector-extension)
// //   await prisma.$executeRaw`
// //     INSERT INTO user_taste_vectors (user_id, taste, updated_at)
// //     VALUES (${BigInt(userId)}, ${vector}::vector, NOW())
// //     ON CONFLICT (user_id)
// //     DO UPDATE SET taste = ${vector}::vector, updated_at = NOW()
// //   `;

// //   // Invalidate cached discovery candidates
// //   await redis.del(`candCache:${userId}`);
// // }

// // // Register the worker (one line)
// // new Worker('reembed', handler, { connection, concurrency: 4 });

// // workers/reembed.ts
// import { Worker } from "bullmq";
// import { connection } from "@/lib/queue";   // your shared Redis connection
// import { prisma }     from "@/lib/prismaclient";
// import { upsertTasteVector } from "@/lib/tasteVector"; // whatever helper writes
// import { parseRawFile } from "@/lib/spotifyRawParser"; // helper that streams JSON
// import axios            from 'axios';
// import  redis         from '@/lib/redis';        // only for cache-clear helper

// // 1️⃣   One worker, one queue‑name – must exactly match the edge function!
// new Worker(
//   "reembed",
//   async (job) => {
//     const userId = Number(job.data.userId);
//     const attrs = await prisma.userAttributes.findUnique({
//       where: { user_id: BigInt(userId) },
//     });
//     if (!attrs) return;
  
//     // Build a single descriptive string
//     const desc = [
//       attrs.interests.join(' '),
//       attrs.hobbies.join(' '),
//       attrs.location ?? '',
//     ].join(' ');
  
//     // Call your embedding service
//     const { data } = await axios.post(
//       process.env.EMBEDDING_URL ?? 'http://localhost:3000/embed',
//       { text: desc },
//     );
//     /* --------------------------------------------------------
//      * 1.  Find latest raw file   (you already have the code)
//      * 2.  Stream‑parse → vector
//      * 3.  Upsert into user_taste_vectors
//      * 4.  Invalidate Redis caches
//      * ------------------------------------------------------ */
//     const vector = await parseRawFile(userId);      // returns number[]
//     await upsertTasteVector(userId, vector);
//   },
//   { connection, concurrency: 4 }
// );
// workers/reembed.ts  —  MINIMAL version
import { Worker } from 'bullmq';
import { connection } from '@/lib/queue';

// This worker’s sole job: receive the webhook job and immediately re‑dispatch
// to the *taste‑vector* queue (or skip if the webhook already adds that job).
new Worker(
  'reembed',
  async job => {
    const userId = Number(job.data.userId);
    // Forward to the queue your tasteVector worker is listening on:
    await connection.client.lpush('bull:taste-vector:wait', JSON.stringify({
      name:    'taste-vector-now',
      data:    { userId },
      opts:    {},
      timestamp: Date.now()
    }));
  },
  { connection, concurrency: 2 }
);