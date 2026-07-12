// app/onboarding/demos/ceg-explorer/page.tsx
import { Metadata } from 'next'
import CegExplorerDemoClient from '../../_demos/ceg-explorer-demo-client'
import CegExplorerRealDataClient from './ceg-explorer-real/page'
export const metadata: Metadata = {
  title: 'CEG Explorer Demo | Mesh',
  description: 'Interactive demo of the Claim Evaluation Graph with grounded semantics visualization',
}

/**
 * CEG Explorer Demo Page
 * 
 * This demo showcases the Claim Evaluation Graph (CEG) feature, which implements
 * Dung's abstract argumentation framework with grounded semantics.
 * 
 * Key features demonstrated:
 * - Grounded semantics labeling (IN/OUT/UNDEC)
 * - Controversy detection
 * - Centrality analysis
 * - Cluster visualization
 * - Multiple view modes (graph, clusters, controversy, flow)
 * - Interactive annotations explaining key concepts
 * 
 * ARCHITECTURE:
 * - Server component (this file): Handles metadata and static setup
 * - Client component: All interactivity and state management
 * - Mock data: Self-contained for demo purposes
 * 
 * USAGE:
 * This can be used for:
 * - Onboarding new users to CEG concepts
 * - Internal testing of CEG visualization
 * - Documentation and training materials
 * - Feature demonstrations in sales/marketing
 */

export default function CegExplorerDemoPage() {
  return (
    <div className="min-h-screen">
      <CegExplorerDemoClient 
        mockDeliberationId="demo-healthcare-001"
        initialViewMode="graph"
      />
    </div>
  )
}