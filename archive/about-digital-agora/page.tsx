// app/about/page.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { 
  ChevronDown, 
  ChevronRight,
  GitBranch,
  MessageSquare,
  Network,
  FileText,
  Database,
  GitCommit,
  Lightbulb,
  Vote,
  Workflow
} from 'lucide-react'
import Link from 'next/link'

export default function AboutPage() {
  const [expandedSections, setExpandedSections] = useState({
    socialSubstrate: false,
    argumentStructure: false,
    mappingKnowledge: false
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="fixed inset-0 z-50 isolate overflow-auto w-full h-full bg-gradient-to-b from-indigo-50 via-rose-50 to-slate-50 text-slate-900">
      <GridBG />
      
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16">
        
        {/* Hero Section */}
        <HeroSection />

        {/* Problem Space */}
        <ProblemSection />

        {/* How It Works - Mini Case */}
        <MiniCaseSection />

        {/* Three Layers */}
        <ThreeLayersSection 
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        />

        {/* Why This Matters */}
        <WhyThisMattersSection />

        {/* Join Alpha */}
        <JoinAlphaSection />

        {/* How This Is Built */}
        <HowBuiltSection />

        {/* Trust & Governance */}
        <TrustSection />

        {/* Metrics */}
        <MetricsSection />

      </div>
    </div>
  )
}

/* ======================== HERO SECTION ======================== */
function HeroSection() {
  return (
    <section className="mb-24">
      <div className="mb-6 inline-flex select-none items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 backdrop-blur">
        <Database className="h-3.5 w-3.5 text-indigo-500" />
        <span>Public Intelligence Infrastructure</span>
      </div>

      <h1 
        className="mb-6 text-5xl font-semibold leading-tight tracking-tight"
        style={{ fontFamily: 'var(--ff-founders)' }}
      >
        Discourse platforms optimize for engagement.<br />
        <span className="text-indigo-600">We optimize for evidence, explicit reasoning, and auditable conclusions.</span>
      </h1>

      <p className="mb-8 text-lg leading-relaxed text-slate-700 max-w-3xl">
        Digital Agora is public infrastructure for evidence-based deliberation. Ideas start as <strong>propositions</strong> you can workshop with votes and feedback, then promote to canonical <strong>claims</strong> when ready. Claims link to sources, arguments diagram their logical structure, and dialogue follows simple moves—<strong>WHY</strong> to ask for grounds, <strong>GROUNDS</strong> to supply reasons. The result is an auditable path from contested ideas to justified positions.
      </p>

      {/* Mini Flow Diagram */}
      <FlowDiagram />

      {/* CTA Buttons */}
      <div className="flex items-center gap-4 mt-8">
        <button className="btnv2 btnv2--lg">
          Request Alpha Access
        </button>
        <button 
          className="btnv2 btnv2--ghost btnv2--lg"
          onClick={() => {
            document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          Learn the Method
        </button>
      </div>
    </section>
  )
}

/* ======================== FLOW DIAGRAM ======================== */
function FlowDiagram() {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className="kbcard p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-600">Deliberation Flow</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          {expanded ? 'Collapse' : 'Expand'} <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <FlowNode icon={Lightbulb} label="Proposition" sublabel="workshop" color="amber" />
        <FlowArrow />
        <FlowNode icon={FileText} label="Claim" sublabel="canonical" color="sky" />
        <FlowArrow />
        <FlowNode icon={MessageSquare} label="Argument" sublabel="reasons" color="indigo" />
        <FlowArrow />
        <FlowNode icon={GitBranch} label="Diagram" sublabel="inferences" color="purple" />
        <FlowArrow />
        <FlowNode icon={Database} label="KB" sublabel="stable artifact" color="emerald" />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 pt-6 border-t border-slate-200 text-sm text-slate-600 space-y-2"
          >
            <p><strong>Proposition:</strong> Lightweight assertion for workshopping (votes, endorsements, replies)</p>
            <p><strong>Claim:</strong> Promoted canonical atom with evidence links and semantic labels</p>
            <p><strong>Argument:</strong> Narrative container linking premises to conclusion</p>
            <p><strong>Diagram:</strong> Logical structure (Statements + Inferences) with targetable warrants</p>
            <p><strong>KB:</strong> Final knowledge artifact with live or pinned blocks</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FlowNode({ icon: Icon, label, sublabel, color }: { 
  icon: any, 
  label: string, 
  sublabel: string,
  color: 'amber' | 'sky' | 'indigo' | 'purple' | 'emerald' 
}) {
  const colorClasses = {
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    sky: 'bg-sky-50 text-sky-600 border-sky-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200'
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-lg border flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-center">
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{sublabel}</div>
      </div>
    </div>
  )
}

function FlowArrow() {
  return (
    <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
  )
}

/* ======================== PROBLEM SECTION ======================== */
function ProblemSection() {
  return (
    <section className="mb-24">
      <h2 
        className="text-3xl font-semibold mb-6"
        style={{ fontFamily: 'var(--ff-founders)' }}
      >
        Why Current Infrastructure Falls Short
      </h2>

      <div className="space-y-4 mb-6">
        <ProblemPoint 
          title="No shared method"
          description="Ideas lack structure; disagreement defaults to rhetoric"
        />
        <ProblemPoint 
          title="Evidence isn't first-class"
          description="Sources sit in PDFs, disconnected from claims"
        />
        <ProblemPoint 
          title="No audit trail"
          description="Decisions and reasoning scatter across threads and files"
        />
      </div>

      <div className="kbcard p-6 bg-gradient-to-br from-rose-50 to-amber-50">
        <p className="text-slate-900 font-medium mb-2">Cost:</p>
        <p className="text-slate-700">Slow, opaque decisions and brittle public trust.</p>
      </div>

      <p className="mt-6 text-slate-700 text-lg">
        The fix isn't "better comments." It's a method and data model for public reasoning—from social workshopping to structured argument to stable knowledge artifacts.
      </p>
    </section>
  )
}

function ProblemPoint({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 flex-shrink-0" />
      <div>
        <span className="font-medium text-slate-900">{title}:</span>{' '}
        <span className="text-slate-700">{description}</span>
      </div>
    </div>
  )
}

/* ======================== MINI CASE SECTION ======================== */
function MiniCaseSection() {
  return (
    <section id="how-it-works" className="mb-24 scroll-mt-8">
      <h2 
        className="text-3xl font-semibold mb-6"
        style={{ fontFamily: 'var(--ff-founders)' }}
      >
        How Digital Agora Works
      </h2>

      <div className="kbcard p-8 bg-gradient-to-br from-indigo-50 to-sky-50">
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-medium text-slate-900">A Concrete Example (120-Second Walkthrough)</h3>
        </div>

        <p className="text-slate-700 leading-relaxed">
          A city deliberation on triage policies. Participants float ideas as <strong>propositions</strong>, voting and refining them. Promising proposals promote to <strong>claims</strong>—canonical assertions with evidence links. Authors construct <strong>arguments</strong> with explicit premise-to-conclusion structure, then drill down to <strong>argument diagrams</strong> that expose individual inferential steps. Critical questions target specific schemes (<em>Is the expert qualified? What are confounders?</em>). Participants use <strong>WHY/GROUNDS</strong> moves to challenge and defend. Alternatives link explicitly via <strong>ALTERNATIVE_TO</strong> relations and are evaluated using transparent criteria (MCDA). The outcome: a <strong>KB page</strong> with the decision, full reasoning, dialogue history, and evidence trail—inspectable by citizens, reviewable by oversight, reusable by other cities, exportable to AIF format for analysis.
        </p>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-slate-600 mb-4">Digital Agora structures reasoning through three integrated layers:</p>
      </div>
    </section>
  )
}

/* ======================== THREE LAYERS SECTION ======================== */
function ThreeLayersSection({ 
  expandedSections, 
  toggleSection 
}: { 
  expandedSections: Record<string, boolean>,
  toggleSection: (section: any) => void 
}) {
  return (
    <section className="mb-24 space-y-8">
      
      {/* Layer 1 */}
      <LayerCard
        number={1}
        title="From Social Substrate to Structured Claims"
        icon={GitCommit}
        color="sky"
        isExpanded={expandedSections.socialSubstrate}
        onToggle={() => toggleSection('socialSubstrate')}
        summary={
          <>
            Ideas begin as <strong>Propositions</strong>—lightweight assertions you can workshop through votes, endorsements, and replies. When ready, promote to <strong>Claims</strong>—canonical atomic assertions that persist across deliberations. Claims link to evidence (citations with locators, quotes, CSL metadata), connect via typed edges (supports, rebuts, undercuts), and can target different scopes (premise, inference, conclusion). Each claim gets a stable identifier (URN) and can map to a <strong>CanonicalClaim</strong> family for cross-room equivalence.
          </>
        }
        expandedContent={<Layer1ExpandedContent />}
      />

      {/* Layer 2 */}
      <LayerCard
        number={2}
        title="Arguments and Their Internal Structure"
        icon={GitBranch}
        color="indigo"
        isExpanded={expandedSections.argumentStructure}
        onToggle={() => toggleSection('argumentStructure')}
        summary={
          <>
            <strong>Arguments</strong> are authored narrative containers linking premises (claims) to conclusions. But arguments also have <strong>internal logical structure</strong>: an <strong>ArgumentDiagram</strong> breaks reasoning into <strong>Statements</strong> (atomic text units) and <strong>Inferences</strong> (inferential steps), making warrants explicit and targetable. <strong>ArgumentEdges</strong> connect arguments (support, rebut, undercut), with fine-grain targeting via <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">targetInferenceId</code> to attack specific warrants. <strong>Argumentation schemes</strong> (expert opinion, causal reasoning, analogy) come with <strong>critical questions</strong> that expose vulnerabilities. <strong>DialogueMoves</strong> (WHY, GROUNDS, CONCEDE, RETRACT) enforce turn-taking and burden-of-proof.
          </>
        }
        expandedContent={<Layer2ExpandedContent />}
      />

      {/* Layer 3 */}
      <LayerCard
        number={3}
        title="Mapping, Clustering, and Knowledge Artifacts"
        icon={Network}
        color="purple"
        isExpanded={expandedSections.mappingKnowledge}
        onToggle={() => toggleSection('mappingKnowledge')}
        summary={
          <>
            Deliberations generate <strong>DebateSheets</strong>—navigable maps where nodes are arguments (each expandable to its internal diagram) and edges show typed relations (supports, rebuts, undercuts, refines). <strong>Clusters</strong> surface camps or themes; <strong>ViewpointSelection</strong> picks k representative arguments under rules (utilitarian | harmonic | maxcov). <strong>BridgeRequests</strong> incentivize syntheses connecting opposing clusters. Alternatives link via <strong>ALTERNATIVE_TO</strong> knowledge edges; evaluations use <strong>WorkPracticalJustification</strong> (MCDA) with explicit criteria, scores, adequacy checks. Final artifacts: <strong>KbPages</strong> with live or pinned blocks, <strong>Briefs</strong> (versioned publications citing source atoms), <strong>TheoryWorks</strong> (DN/IH/TC/OP frameworks). The whole deliberation can export to <strong>AIF/AIF+</strong> for external analysis.
          </>
        }
        expandedContent={<Layer3ExpandedContent />}
      />

    </section>
  )
}

function LayerCard({ 
  number, 
  title, 
  icon: Icon, 
  color,
  isExpanded, 
  onToggle, 
  summary, 
  expandedContent 
}: {
  number: number
  title: string
  icon: any
  color: 'sky' | 'indigo' | 'purple'
  isExpanded: boolean
  onToggle: () => void
  summary: React.ReactNode
  expandedContent: React.ReactNode
}) {
  const colorClasses = {
    sky: 'from-sky-50 to-indigo-50 border-sky-200',
    indigo: 'from-indigo-50 to-purple-50 border-indigo-200',
    purple: 'from-purple-50 to-pink-50 border-purple-200'
  }

  const iconColorClasses = {
    sky: 'text-sky-600',
    indigo: 'text-indigo-600',
    purple: 'text-purple-600'
  }

  return (
    <div className={`kbcard p-8 bg-gradient-to-br ${colorClasses[color]}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center flex-shrink-0 ${iconColorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-slate-500 mb-1">Layer {number}</div>
          <h3 
            className="text-xl font-semibold text-slate-900"
            style={{ fontFamily: 'var(--ff-founders)' }}
          >
            {title}
          </h3>
        </div>
      </div>

      {/* Always visible summary */}
      <div className="prose prose-slate prose-sm max-w-none mb-6 text-slate-700">
        {summary}
      </div>

      {/* Expand/Collapse button */}
      <button 
        onClick={onToggle}
        className="btnv2 btnv2--ghost flex items-center gap-2 mb-4"
      >
        {isExpanded ? (
          <>
            Collapse <ChevronDown className="h-4 w-4 rotate-180" />
          </>
        ) : (
          <>
            Expand to read more <ChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {expandedContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ======================== LAYER EXPANDED CONTENT ======================== */

function Layer1ExpandedContent() {
  return (
    <div className="space-y-6 pt-6 border-t border-slate-200">
      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">The Social Substrate: Proposition → Claim</h4>
        <p className="text-sm text-slate-700 mb-3">
          Not every assertion starts as a canonical claim. Digital Agora includes a <strong>workshop space</strong> where ideas begin as <strong>Propositions</strong>:
        </p>
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside ml-4">
          <li>Contributors create Propositions (status: PUBLISHED)</li>
          <li>Others vote up/down, endorse, reply, tag</li>
          <li>Social signals filter quality before promotion</li>
          <li>When validated, promote → creates a Claim, links via <code className="text-xs bg-white/50 px-1 rounded">promotedClaimId</code>, changes status to CLAIMED</li>
        </ul>
        <p className="text-sm text-slate-700 mt-3">
          This two-stage path (Proposition → Claim) balances accessibility with rigor. Anyone can float an idea; structured reasoning begins when the community validates it.
        </p>
      </div>

      <div className="kbcard p-4 bg-white/50">
        <div className="text-xs font-medium text-slate-500 mb-2">Example: Proposition Workshop UI</div>
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
            <span>"Climate policy reduced emissions by 15%"</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600">↑ 12</span>
              <span className="text-xs text-rose-600">↓ 3</span>
              <button className="btnv2 btnv2--sm">Promote to Claim</button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Claims as Canonical Atoms</h4>
        <p className="text-sm text-slate-700 mb-3">Once promoted, Claims become the fundamental unit of assertion:</p>
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside ml-4">
          <li><strong>Persistent:</strong> Unique identifier (moid) based on content hash</li>
          <li><strong>Cross-deliberation:</strong> Can exist across multiple deliberations via <code className="text-xs bg-white/50 px-1 rounded">canonicalClaimId</code></li>
          <li><strong>Negation-aware:</strong> Explicit negation links (<code className="text-xs bg-white/50 px-1 rounded">negatesClaimId</code>) for duality-based semantics</li>
          <li><strong>Evidence-linked:</strong> ClaimCitation (with locators, excerpts, snapshots) and ClaimEvidence (lightweight URI/title)</li>
          <li><strong>Semantically labeled:</strong> ClaimLabel tracks acceptance status (IN/OUT/UNDEC) under chosen semantics (grounded, preferred, hybrid)</li>
        </ul>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Claim-to-Claim Relations</h4>
        <p className="text-sm text-slate-700 mb-2">ClaimEdge links claims with typed relations:</p>
        <div className="kbcard p-3 bg-white/50 text-xs font-mono space-y-1">
          <div><span className="text-slate-500">type:</span> supports | rebuts</div>
          <div><span className="text-slate-500">attackType:</span> SUPPORTS | REBUTS | UNDERCUTS | UNDERMINES</div>
          <div><span className="text-slate-500">targetScope:</span> premise | inference | conclusion</div>
        </div>
        <p className="text-sm text-slate-700 mt-2">
          <em>Note: Undercuts target warrants/inferences, not just conclusions.</em>
        </p>
      </div>

      <div className="text-xs text-slate-500 italic mt-6 pt-4 border-t border-slate-200">
        Formal grounding: Claims implement Toulmin structure; ClaimLabel semantics follow Dung's abstract argumentation frameworks.
      </div>
    </div>
  )
}

function Layer2ExpandedContent() {
  return (
    <div className="space-y-6 pt-6 border-t border-slate-200">
      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Two-Level Structure: Narrative + Logic</h4>
        <p className="text-sm text-slate-700 mb-3">Arguments work at two levels:</p>
        
        <div className="space-y-4">
          <div className="kbcard p-4 bg-white/50">
            <div className="font-medium text-sm text-slate-900 mb-2">1. Argument (narrative unit)</div>
            <ul className="space-y-1 text-sm text-slate-700 list-disc list-inside ml-2">
              <li>Links multiple premise Claims to a conclusion Claim</li>
              <li>Fields: text, confidence, quantifier (SOME/MANY/MOST/ALL), modality (COULD/LIKELY/NECESSARY)</li>
              <li>Optional scheme link (ArgumentScheme)</li>
              <li>Can be implicit (background knowledge premises)</li>
            </ul>
          </div>

          <div className="kbcard p-4 bg-white/50">
            <div className="font-medium text-sm text-slate-900 mb-2">2. ArgumentDiagram (logical structure)</div>
            <ul className="space-y-1 text-sm text-slate-700 list-disc list-inside ml-2">
              <li><strong>Statement:</strong> atomic text unit with role (premise | intermediate | conclusion | assumption | warrant)</li>
              <li><strong>Inference:</strong> inferential step (kind: presumptive | deductive | inductive | abductive | defeasible | analogy)</li>
              <li>Inferences link premises (Statements) to conclusions (Statements) via InferencePremise join table</li>
              <li>Can attach evidence at diagram level via EvidenceLink</li>
            </ul>
          </div>
        </div>

        <p className="text-sm text-slate-700 mt-3">
          This two-level structure lets you present arguments narratively while exposing logical shape for scrutiny.
        </p>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Fine-Grain Targeting: Attacking Warrants</h4>
        <p className="text-sm text-slate-700 mb-2">ArgumentEdge can target specific inferences:</p>
        <div className="kbcard p-3 bg-white/50 text-xs font-mono space-y-1">
          <div><span className="text-slate-500">type:</span> support | rebut | undercut | concede | CA</div>
          <div><span className="text-slate-500">attackSubtype:</span> SUPPORT_ATTACK | CONSEQUENCE_ATTACK | JUSTIFICATION_ATTACK | UNDERMINE | REBUT | UNDERCUT | OVERCUT</div>
          <div><span className="text-slate-500">targetScope:</span> conclusion | premise | inference</div>
          <div><span className="text-indigo-600">targetInferenceId:</span> Target a specific inference node inside the argument's diagram</div>
        </div>
        <p className="text-sm text-slate-700 mt-2">
          This makes <strong>warrant attacks</strong> (undercuts) precise—you challenge the inferential step, not just the conclusion.
        </p>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Formal Dialogue Moves</h4>
        <p className="text-sm text-slate-700 mb-3">Every exchange follows protocol:</p>
        
        <div className="kbcard p-4 bg-slate-50 font-mono text-xs space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-slate-500">10:23</span>
            <span className="text-sky-600">Alice:</span>
            <span>[CLAIM] Policy X reduced poverty by 12%</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-slate-500">10:31</span>
            <span className="text-purple-600">Bob:</span>
            <span>[WHY] Controlling for what confounds?</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-slate-500">10:45</span>
            <span className="text-sky-600">Alice:</span>
            <span>[GROUNDS] Study design [link] + robustness checks</span>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside ml-4 mt-3">
          <li><strong>DialogueMove:</strong> Turn-taking events (illocution: Assert | Question | Argue | Concede | Retract | Close)</li>
          <li><strong>ReplyTarget:</strong> claim | argument | premise | link | presupposition</li>
          <li><strong>ProofMode:</strong> symmetric | asymmetric (burden differences for Proponent/Opponent)</li>
          <li>Unique constraint prevents duplicate moves</li>
        </ul>

        <p className="text-sm text-slate-700 mt-3">
          Moves are recorded and auditable—you can trace how positions evolved through dialectical pressure.
        </p>
      </div>

      <div className="text-xs text-slate-500 italic mt-6 pt-4 border-t border-slate-200">
        Formal grounding: Dialogical semantics motivate WHY/GROUNDS; schemes follow Walton/Macagno; AIF exports preserve structure. <a href="#" className="text-indigo-600 hover:underline">See Foundations →</a>
      </div>
    </div>
  )
}

function Layer3ExpandedContent() {
  return (
    <div className="space-y-6 pt-6 border-t border-slate-200">
      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Sheet-Level Visualization</h4>
        <p className="text-sm text-slate-700 mb-3">DebateSheet is a two-level navigable map:</p>
        
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside ml-4">
          <li><strong>DebateNode:</strong> Visual "card" representing an argument or claim
            <ul className="list-circle list-inside ml-6 mt-1 space-y-1 text-xs">
              <li>Links 1:1 to ArgumentDiagram</li>
              <li>Fields: title, summary, authors</li>
              <li>Expandable to see full internal inference structure</li>
            </ul>
          </li>
          <li><strong>DebateEdge:</strong> Typed relations between nodes
            <ul className="list-circle list-inside ml-6 mt-1 space-y-1 text-xs">
              <li>Kind: supports | rebuts | objects | undercuts | refines | restates | clarifies | depends_on</li>
            </ul>
          </li>
          <li><strong>SheetAcceptance:</strong> Labels for nodes under chosen semantics (grounded | preferred | hybrid)</li>
          <li><strong>UnresolvedCQ:</strong> Tracks unresolved critical questions per node</li>
        </ul>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Clustering & Viewpoints</h4>
        <div className="kbcard p-4 bg-white/50 space-y-3">
          <div>
            <div className="font-medium text-sm text-slate-900 mb-1">Cluster</div>
            <p className="text-xs text-slate-700">Groups arguments/users by affinity or topic. Relations: UserCluster (userId, score), ArgumentCluster (argumentId, score)</p>
          </div>
          <div>
            <div className="font-medium text-sm text-slate-900 mb-1">ViewpointSelection</div>
            <p className="text-xs text-slate-700">Extract k representatives under a rule (utilitarian | harmonic | maxcov). Fields: deliberationId, rule, k, coverageAvg, explainJson</p>
          </div>
          <div>
            <div className="font-medium text-sm text-slate-900 mb-1">BridgeRequest</div>
            <p className="text-xs text-slate-700">Target a cluster, incentivize syntheses. Status: open | assigned | completed | expired</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 mt-2">
          <em>Cognitive role: Surface "camps," enable viewpoint-diff UIs, spur cross-cluster dialogue.</em>
        </p>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Alternatives and Evaluation</h4>
        <p className="text-sm text-slate-700 mb-2">Digital Agora structures decisions around explicit alternatives:</p>
        
        <div className="kbcard p-3 bg-slate-50 font-mono text-xs space-y-1">
          <div>Issue: Clinical Triage Fairness</div>
          <div className="ml-4">├─ Alternative A: Maximize QALYs (Utilitarian TC)</div>
          <div className="ml-4">├─ Alternative B: Prioritize worst-off (Rawlsian TC)</div>
          <div className="ml-4">└─ Alternative C: Procedural lottery (Egalitarian TC)</div>
        </div>

        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside ml-4 mt-3">
          <li><strong>KnowledgeEdge:</strong> Typed links (ALTERNATIVE_TO | EVALUATES | SUPPLIES_PREMISE | SUPPORTS | REBUTS | UNDERCUTS)</li>
          <li><strong>WorkPracticalJustification:</strong> MCDA evaluation with purpose, criteria (JSON), options, scores, result, adequacy checks (completeness, dominance, robustness)</li>
        </ul>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Theory Works (DN/IH/TC/OP Frameworks)</h4>
        <p className="text-sm text-slate-700 mb-2">TheoryWork supports longform structured reasoning:</p>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="kbcard p-3 bg-white/50">
            <div className="text-xs font-medium text-slate-900 mb-1">DN (Descriptive-Nomological)</div>
            <div className="text-xs text-slate-700">Empirical explanations: explanandum, nomological laws, ceteris paribus conditions</div>
          </div>
          <div className="kbcard p-3 bg-white/50">
            <div className="text-xs font-medium text-slate-900 mb-1">IH (Idealizing-Hermeneutic)</div>
            <div className="text-xs text-slate-700">Interpretive understanding: structure, function, objectivity criteria</div>
          </div>
          <div className="kbcard p-3 bg-white/50">
            <div className="text-xs font-medium text-slate-900 mb-1">TC (Technical-Constructive)</div>
            <div className="text-xs text-slate-700">Design solutions: instrument function, explanation, applications</div>
          </div>
          <div className="kbcard p-3 bg-white/50">
            <div className="text-xs font-medium text-slate-900 mb-1">OP (Ontic-Practical)</div>
            <div className="text-xs text-slate-700">Action recommendations: unrecognizability, alternatives comparison</div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-3">Knowledge Base: Stable, Citable Artifacts</h4>
        <p className="text-sm text-slate-700 mb-3">KbPage is the final publication layer:</p>
        
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside ml-4">
          <li><strong>KbSpace:</strong> Container (personal | team | org | project) with visibility controls</li>
          <li><strong>KbPage:</strong> Title, summary, tags, frontmatter (JSON)</li>
          <li><strong>KbBlock:</strong> Typed blocks (text | image | claim | argument | sheet | evidence_list | cq_tracker | plexus_tile | theory_work)
            <ul className="list-circle list-inside ml-6 mt-1 space-y-1 text-xs">
              <li><strong>Live blocks:</strong> Update as source changes</li>
              <li><strong>Pinned blocks:</strong> Freeze a snapshot</li>
            </ul>
          </li>
          <li><strong>KbSnapshot:</strong> Frozen manifest of page at a point in time</li>
        </ul>

        <p className="text-sm text-slate-700 mt-3">
          Institutions can cite KB pages; communities can fork and revise as understanding improves.
        </p>
      </div>

      <div className="text-xs text-slate-500 italic mt-6 pt-4 border-t border-slate-200">
        The platform is a graph-of-graphs: ArgumentImport, RoomFunctor, and XRef enable cross-room provenance and composition.
      </div>
    </div>
  )
}

/* ======================== WHY THIS MATTERS SECTION ======================== */
function WhyThisMattersSection() {
  return (
    <section className="mb-24">
      <h2 
        className="text-3xl font-semibold mb-6"
        style={{ fontFamily: 'var(--ff-founders)' }}
      >
        Why This Matters
      </h2>

      <div className="kbcard p-8">
        <h3 className="text-xl font-medium text-slate-900 mb-4">Institutional Readiness Meets Public Goods</h3>
        
        <p className="text-slate-700 mb-6 leading-relaxed">
          Digital Agora is built for institutional use—where reasoning must be auditable, defensible, and reproducible:
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <PropertyCard 
            title="Legibility"
            description="Every proposition, claim, inference, and counter-move is linkable"
          />
          <PropertyCard 
            title="Repeatability"
            description="Methods are explicit; dialogues are replayable; others can rerun the reasoning"
          />
          <PropertyCard 
            title="Interoperability"
            description="Export to AIF/AIF+; APIs for claims, arguments, edges, schemes"
          />
          <PropertyCard 
            title="Agent-neutral"
            description="Protocols apply to human and AI participants under shared rules"
          />
          <PropertyCard 
            title="Governance"
            description="Decisions traced through DecisionReceipts; moderation via Panels"
          />
        </div>

        <div className="space-y-4 text-sm text-slate-700 pt-6 border-t border-slate-200">
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Philosophical Anchor</h4>
            <p>
              We treat intelligence as public and de-privatized—objectivity emerges through shared reasons and rules, not private certainty (Negarestani's "public intelligence" lens, operationalized via Ludics proof games and commitment tracking). This isn't aspirational philosophy; it's implemented as data models and protocols.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-slate-900 mb-2">The Urgency</h4>
            <p className="mb-2">
              Knowledge infrastructures—repositories, standards, methods for sharing reasons—are prerequisites for institutional learning and civic trust:
            </p>
            <ul className="space-y-1 list-disc list-inside ml-4">
              <li><strong>Policy decisions</strong> affect millions but rest on opaque reasoning</li>
              <li><strong>Scientific claims</strong> require scrutiny across communities with replication and provenance</li>
              <li><strong>Democratic legitimacy</strong> depends on understanding <em>how</em> conclusions were reached</li>
              <li><strong>AI agents</strong> will participate in discourse—we need protocols that enforce scheme adherence and burden-of-proof for all participants</li>
            </ul>
          </div>

          <div>
            <p>
              The Argument Web vision (AIF, Argument Interchange Format) has existed for two decades. Digital Agora makes it operational for public decision-making, not just academic research.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function PropertyCard({ title, description }: { title: string, description: string }) {
  return (
    <div className="p-4 bg-white/60 rounded-lg border border-slate-200">
      <div className="font-medium text-slate-900 mb-1">{title}</div>
      <div className="text-sm text-slate-600">{description}</div>
    </div>
  )
}

/* ======================== JOIN ALPHA SECTION ======================== */
function JoinAlphaSection() {
  return (
    <section className="mb-24">
      <div className="kbcard p-12 text-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <h2 
          className="text-3xl font-semibold mb-4"
          style={{ fontFamily: 'var(--ff-founders)' }}
        >
          Join the Closed Alpha
        </h2>
        
        <p className="text-lg text-slate-700 max-w-2xl mx-auto mb-8">
          Help us build public infrastructure for evidence-based deliberation. We're onboarding teams running real deliberations (policies, reviews, choices). You'll get hands-on support, exportable artifacts, and a say in what ships.
        </p>

        <button className="btnv2 btnv2--lg mb-8">
          Request Alpha Access
        </button>

        <div className="grid md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto mb-8">
          <div>
            <h3 className="font-medium text-slate-900 mb-2">What we need (4–6 weeks):</h3>
            <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
              <li>Run one real deliberation</li>
              <li>Test Proposition → Claim promotion</li>
              <li>Use ArgumentDiagrams</li>
              <li>Try WHY/GROUNDS dialogue</li>
              <li>Honest feedback</li>
              <li>Permission to publish redacted KB page</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 mb-2">What you get:</h3>
            <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
              <li>Direct design input</li>
              <li>Exportable artifacts (AIF/AIF+, PDF)</li>
              <li>Onboarding support</li>
              <li>Community of serious builders</li>
              <li>Early access to proof-of-concept features</li>
            </ul>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mb-8 text-left">
          <h3 className="font-medium text-slate-900 mb-2">Who's ideal:</h3>
          <p className="text-sm text-slate-700">
            Policy labs, institutional review boards, research groups, student governance, anyone running decisions where justification matters more than consensus.
          </p>
        </div>

        <div className="max-w-2xl mx-auto p-4 bg-white/60 rounded-lg border border-slate-200 text-left">
          <h3 className="font-medium text-slate-900 mb-2">Ground rules (3 commitments):</h3>
          <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
            <li><strong>No harassment:</strong> Respectful challenge only</li>
            <li><strong>Cite when you assert:</strong> Claims need grounds</li>
            <li><strong>Answer WHYs or mark unresolved:</strong> Don't ghost critical questions</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-6 justify-center mt-8 text-sm">
          <Link href="/about/foundations" className="text-indigo-600 hover:underline font-medium">
            Foundations →
          </Link>
          <Link href="/about/getting-started" className="text-indigo-600 hover:underline font-medium">
            Getting Started →
          </Link>
          <Link href="/about/research" className="text-indigo-600 hover:underline font-medium">
            Research & Roadmap →
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ======================== HOW BUILT SECTION ======================== */
function HowBuiltSection() {
  return (
    <section className="mb-24">
      <div className="kbcard p-8 bg-slate-50">
        <h3 className="text-lg font-medium text-slate-900 mb-4">How This Is Built</h3>
        
        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <div className="font-medium text-slate-900 mb-1">Data model:</div>
            <p>
              Propositions (workshop), Claims (canonical atoms), Arguments (narrative), ArgumentDiagrams (logical structure), Statements, Inferences, ClaimEdges, ArgumentEdges, ConflictSchemes, PreferenceSchemes, KnowledgeEdges (ALTERNATIVE_TO | EVALUATES), TheoryWorks (DN/IH/TC/OP), KbPages/Blocks (live | pinned), Briefs.
            </p>
          </div>

          <div>
            <div className="font-medium text-slate-900 mb-1">Protocols:</div>
            <p>
              Proposition → Claim promotion; WHY/GROUNDS dialogue moves; scheme-aware critical questions; fine-grain inference targeting; cross-room ArgumentImport with provenance; interoperable exports (AIF/AIF+).
            </p>
          </div>

          <div>
            <div className="font-medium text-slate-900 mb-1">Assurance:</div>
            <p>
              Integrity checks per theory type; ArgumentSupport quantification; ClaimLabel semantics (grounded | preferred | hybrid); DecisionReceipts; Panel moderation; KbSnapshots for frozen provenance; unique constraints prevent duplicates.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <div className="font-medium text-slate-900 mb-2">Formal foundations:</div>
            <div className="flex gap-4 text-xs">
              <span className="kbcard px-2 py-1 bg-white/60">Argumentation theory & interoperability</span>
              <span className="kbcard px-2 py-1 bg-white/60">Proof-theoretic interaction (Ludics)</span>
              <span className="kbcard px-2 py-1 bg-white/60">Public intelligence</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ======================== TRUST SECTION ======================== */
function TrustSection() {
  return (
    <section className="mb-24">
      <div className="grid md:grid-cols-4 gap-4 text-center">
        <TrustItem 
          title="Auditability"
          description="Every move logged with timestamps"
        />
        <TrustItem 
          title="Attribution"
          description="Sources and interpretations distinct"
        />
        <TrustItem 
          title="Civility"
          description="Dialogue rules apply to all agents"
        />
        <TrustItem 
          title="Moderation"
          description="Panels provide traceable governance"
        />
      </div>
    </section>
  )
}

function TrustItem({ title, description }: { title: string, description: string }) {
  return (
    <div className="kbcard p-4">
      <div className="font-medium text-slate-900 mb-1 text-sm">{title}</div>
      <div className="text-xs text-slate-600">{description}</div>
    </div>
  )
}

/* ======================== METRICS SECTION ======================== */
function MetricsSection() {
  return (
    <section className="mb-24">
      <h3 className="text-xl font-medium text-slate-900 mb-4">Metrics We Track</h3>
      <p className="text-sm text-slate-700 mb-4">
        During closed alpha, we're measuring what matters:
      </p>
      
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <MetricItem 
          metric="Proposition → Claim flow"
          description="Promotion rate, workshop quality signals"
        />
        <MetricItem 
          metric="Evidence coverage"
          description="Claims with ≥1 ClaimCitation / total claims"
        />
        <MetricItem 
          metric="CQ response rate"
          description="CriticalQuestions answered within 7 days"
        />
        <MetricItem 
          metric="Inference targeting"
          description="ArgumentEdges using targetInferenceId"
        />
        <MetricItem 
          metric="Alternative clarity"
          description="Decisions with ≥2 ALTERNATIVE_TO edges"
        />
        <MetricItem 
          metric="Cross-room reuse"
          description="ArgumentImports, KB page forks"
        />
        <MetricItem 
          metric="Dialogue engagement"
          description="WHY/GROUNDS DialogueMove pairs"
        />
      </div>
    </section>
  )
}

function MetricItem({ metric, description }: { metric: string, description: string }) {
  return (
    <div className="kbcard p-3 bg-white/60">
      <div className="font-medium text-slate-900 text-sm mb-1">{metric}</div>
      <div className="text-xs text-slate-600">{description}</div>
    </div>
  )
}

/* ======================== GRID BACKGROUND ======================== */
function GridBG() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* soft grid over a pastel wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-100/60 via-rose-100/60 to-slate-100/60" />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.2) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* gentle moving glows */}
      <motion.div
        className="absolute -top-24 left-1/3 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgba(99,102,241,0.45) 0%, transparent 60%)' }}
        animate={{ x: [0, 20, 0], y: [0, 12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 h-[26rem] w-[26rem] translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgba(244,114,182,0.45) 0%, transparent 60%)' }}
        animate={{ x: [0, -16, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}