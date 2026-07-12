
import { getSeededDiscussion } from './data'
import DiscussionViewDemoClient from './discussion-view-demo-client'

/**
 * Server Component - fetches data and passes to client component
 * This file must NOT have 'use client' directive
 */
export default async function DiscussionViewDemo() {
  const data = await getSeededDiscussion()

  // Handle case where no seeded data exists
  if (!data) {
    return (
      <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">
          ⚠️ No Seeded Data Found
        </h3>
        <p className="text-sm text-yellow-800 mb-4">
          Please run the seeding script to populate demo data:
        </p>
        <code className="block bg-yellow-100 px-4 py-2 rounded text-sm font-mono">
          npm run seed:discussion
        </code>
        <p className="text-xs text-yellow-700 mt-3">
          After seeding, refresh this page to see the demo.
        </p>
      </div>
    )
  }

  // Pass data to client component
  return <DiscussionViewDemoClient {...data} />
}