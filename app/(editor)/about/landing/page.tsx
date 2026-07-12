//app/(editor)/about/details/page.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronDown, 
  ChevronRight, 
  Terminal, 
  MessageSquare,
  Lightbulb,
  Vote,
  FileCheck,
  Network,
  GitBranch,
  List,
  Swords,
  Map,
  BookOpen,
  Share2,
  FerrisWheel,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import '../about-styles.css'
import { colorClasses } from '../color-classes'
import { foundationCategories } from '../color-classes'

export default function AboutPage() {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(step)) {
        next.delete(step)
      } else {
        next.add(step)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen  bg-gradient-to-b from-indigo-50/30 via-rose-50/30 to-slate-50 text-slate-900">
      {/* <TechnicalGrid /> */}
      {/* <FloatingOrbs /> */}
                  {/* <FloatingOrbs /> */}

      <div className="relative z-10">
        {/* <HeroSectionAlternate /> */}
  <HeroSection />
        <ProblemSection />
        <CivicRequirementsSection />
        <InstitutionalRequirementsSection />
        <AdvancedCapabilitiesSection />

        <JourneyOverview />
        <JourneySteps expandedSteps={expandedSteps} toggleStep={toggleStep} />
        <UseCasesSection />
        <StatusSection />
        <AlphaSection />
        <FoundationsSection />
        <AccessSection />
        <ClosingSection />

      </div>

    </div>
  )
}

/* ======================== TECHNICAL GRID ======================== */
function TechnicalGrid() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-rose-50/40 to-purple-50/40" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #818cf8 1px, transparent 1px), linear-gradient(to bottom, #818cf8 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  )
}

/* ======================== FLOATING ORBS ======================== */
function FloatingOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed  z-[1000] inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-8 left-1/4 h-96 w-96 rounded-full opacity-100 blur-3xl"
        style={{ 
          background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 50%)'
        }}
        animate={{ 
          x: [0, 30, 0],
          y: [0, 20, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 15, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full opacity-100 blur-3xl"
        style={{ 
          background: 'radial-gradient(circle, rgba(245, 111, 93, 0.4) 0%, transparent 30%)'
        }}
        animate={{ 
          x: [0, -25, 0],
          y: [0, -15, 0],
          scale: [1, 1.15, 1]
        }}
        transition={{ 
          duration: 18, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        }}
      />
      <motion.div
        className="absolute bottom-24 left-8 h-96 w-96 rounded-full opacity-100 blur-3xl"
        style={{ 
          background: 'radial-gradient(circle, rgba(85, 198, 247, 0.35) 0%, transparent 40%)'
        }}
        animate={{ 
          x: [0, 20, 0],
          y: [0, -10, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ 
          duration: 20, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        }}
      />
    </div>
  )
}
function HeroSection() {
  return (
    <section className="border-b border-indigo-100/50 bg-white/40 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-12">
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="about-badge about-badge--primary mb-6 about-shimmer"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>v1.0.0-alpha</span>
          <FerrisWheel className="h-3 w-3" />
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-4xl font-medium leading-tight tracking-tight text-slate-900"
        >
           Isonomia: Infrastructure for Collective Reasoning
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 text-lg leading-relaxed text-slate-700"
        >
          A platform where evidence, arguments, and decisions become structured, composable, and durable—not ephemeral conversation.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 space-y-4 text-base leading-relaxed text-slate-700"
        >
          <p>
            When groups reason together—policy teams, research communities, civic organizations—the structure of their thinking matters as much as the conclusions. But current tools treat reasoning as disposable: ideas scatter across threads, evidence disconnects from claims, and past conclusions cannot be cited or audited. <strong className="text-slate-900">Isonomia changes this.</strong>
          </p>
          
          <p>
            Every assertion becomes an addressable object with a stable identifier. Every relationship is typed—support, attack, equivalence. Every argument follows recognized patterns (60+ schemes) that surface the questions any rigorous thinker would ask. The result is reasoning that persists, compounds, and transfers across contexts.
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="about-glass-card-code w-full rounded-xl panel-edge postcard mb-8"
        >
          <div className='bg-transparent'>
            <div className="mb-4 font-semibold text-[15px] text-slate-900">
              Three Layers of Structured Reasoning
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">1.</span>
                <span>
                  <strong className="text-slate-900">Claims & Evidence:</strong> Transform informal ideas into canonical assertions with stable identifiers. Link claims to source material with character-level precision. Track what depends on what.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">2.</span>
                <span>
                  <strong className="text-slate-900">Arguments & Dialogue:</strong> Structure reasoning with premises, conclusions, and recognized inference patterns. Track every move—assert, challenge, respond, concede. Apply ASPIC+ defeasible logic to compute which arguments survive challenge.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">3.</span>
                <span>
                  <strong className="text-slate-900">Outputs & Artifacts:</strong> Compose reasoning into publishable documents, knowledge base pages, and exportable graphs. Produce citable artifacts in standard formats (AIF, JSON-LD) that integrate with institutional systems.
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-2 text-sm leading-relaxed text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-emerald-600">✓</span>
                <span>Import arguments across deliberations with full provenance</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600">✓</span>
                <span>Fork analyses to adapt to different contexts</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600">✓</span>
                <span>Challenges cannot be silently ignored—protocol enforces response</span>
              </div>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="about-alert about-alert--info mb-8"
        >
          <strong>For researchers:</strong> Turn papers into composable claim graphs where ideas can be challenged, refined, and built upon. <strong>For institutions:</strong> Capture reasoning that transfers across teams and survives personnel changes. <strong>For communities:</strong> Move from circular debate to cumulative knowledge that future participants can inherit.
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-wrap items-center gap-4"
        >
          <Link href="#access">
            <button className="about-btn postcard group">
              <span className="relative flex items-center gap-2">
                Request Access
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </Link>
          
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="font-medium">Current deployment: 20 deliberations, 500 claims, 200 arguments</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function HeroSectionAlternate() {
  return (
    <section className="border-b border-indigo-100/50 bg-white/40 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="about-badge about-badge--primary mb-6 about-shimmer"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>v1.0.0-alpha</span>
          <FerrisWheel className="h-3 w-3" />
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-4xl font-medium leading-tight tracking-tight text-slate-900"
        >
           Isonomia: Rebuilding Public Reasoning Infrastructure
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 text-lg leading-relaxed text-slate-700"
        >
          Civic platform for deliberation where evidence, arguments, and decisions are structured, verifiable, and durable—not ephemeral engagement metrics.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 space-y-4 text-base leading-relaxed text-slate-700"
        >
          <p>
            <strong>The problem is infrastructural.</strong> Contemporary platforms were built for virality, not validity. There is no shared representation for evidential grounding, no protocol for burden of proof, no way to track how decisions emerged from alternatives. Institutions default to opaque processes because the internet provides no tools for transparent, auditable reasoning.
          </p>
          <p>
            <strong> Isonomia is infrastructure for public intelligence.</strong> Rationality becomes objective through language-governed interaction—where claims receive challenges, evidence gets tested, and arguments must survive critical questioning. The platform operationalizes this: every assertion has a stable identifier, every attack targets a specific node, every dialogue move follows protocol. Structure is machine-readable; semantic labels derive from formal calculus; reasoning chains compose across contexts.
          </p>
          <p>
            <strong>Meaning emerges through interaction, not static labels.</strong> A claim's status (accepted/rejected/undecided) computes from its position in the argument graph and the attacks it faces. Schemes auto-generate critical questions. Dialogue games enforce termination: when no legal moves remain, deliberation concludes with an auditable trace. This is not opinion aggregation—it is structured knowledge work that produces reusable, verifiable artifacts.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="about-alert about-alert--info mb-8"
        >
          <strong>Urgency:</strong> Without infrastructure coupling evidence, dialogue, and publication, institutions cannot meet demands for transparency and public trust continues to erode. Complex problems—climate policy, public health, tech governance—require collective intelligence that current platforms actively undermine. We propose minimally normative, auditable commons for reasons.
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="about-glass-card-code   w-full rounded-xl panel-edge postcard mb-8 "
        >
            <div className='bg-transparent'>
          <div className="mb-3 flex items-center gap-2 ">
            <Zap className="h-4 w-4 text-indigo-600 items-center" />
            <div className="font-semibold text-center items-center  text-[14px] text-slate-900">What this enables:</div>
          </div>
          <div className="space-y-2.5 text-sm leading-relaxed text-slate-600">
            <div className="flex items-start gap-2">
              <span className="about-code-keyword ">⤞</span>
              <span><strong className="text-slate-700">Evidential precision:</strong> Link claims to source material with character-level specificity; track provenance across reasoning chains</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="about-code-keyword ">⤞</span>
              <span><strong className="text-slate-700">Protocol enforcement:</strong> WHY moves require GROUNDS; unanswered challenges remain visible; no silent consensus</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="about-code-keyword">⤞</span>
              <span><strong className="text-slate-700">Systematic stress-testing:</strong> Schemes generate critical questions automatically; attacks target specific premises or inferences</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="about-code-keyword">⤞</span>
              <span><strong className="text-slate-700">Reusable reasoning:</strong> Import argument structures; map claims between contexts; fork and revise institutional analyses</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="about-code-keyword ">⤞</span>
              <span><strong className="text-slate-700">Durable publication:</strong> Knowledge base exports to AIF, JSON-LD; stable citations for institutional integration</span>
            </div>
          </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-wrap items-center gap-4"
        >
          <Link href="#access">
            <button className="about-btn postcard group">
              <span className="relative flex items-center gap-2">
                Register for Early Access
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </Link>
          
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="font-medium">Active deployment: 20 deliberations • 500 claims • 200 arguments</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function HeroSectionRevised() {
  return (
    <section className="border-b border-indigo-100/50 bg-white/40 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="about-badge about-badge--primary mb-6 about-shimmer"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>v1.0.0-alpha</span>
          <FerrisWheel className="h-3 w-3" />
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-4xl font-medium leading-tight tracking-tight text-slate-900"
        >
           Isonomia: Infrastructure for Public Reasoning
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 text-lg leading-relaxed text-slate-700"
        >
          A platform for structuring evidence, arguments, and decisions so they can be 
          examined, reused, and verified across institutions and communities.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 space-y-4 text-base leading-relaxed text-slate-700"
        >
          <p>
            When the FDA evaluates drug safety, when a city council debates zoning policy, 
            when a technical committee reviews standards—these deliberations produce 
            reasoning chains that other institutions need. But the reasoning exists only 
            as prose in PDFs. There is no shared format for evidential grounding, no protocol 
            for tracking challenges and responses, no way to see how a conclusion emerged from 
            competing alternatives. Each institution starts from scratch.
          </p>
          
          <p>
            This creates three problems. First, work cannot transfer: the EMA cannot import 
            the FDA's analysis and build on it—they must reconstruct everything manually. 
            Second, reasoning cannot be verified: readers cannot trace which evidence supports 
            which claims, or whether challenges were answered. Third, decisions appear arbitrary: 
            without visible reasoning chains, institutional conclusions look like pronouncements 
            rather than results of structured deliberation.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8 space-y-4 text-base leading-relaxed text-slate-700"
        >
          <p>
             Isonomia addresses this by implementing the structure that rigorous discourse 
            requires. Claims receive stable identifiers so they can be referenced precisely. 
            Challenges target specific components—a premise, an inference, a piece of evidence—rather 
            than entire arguments. Exchanges follow protocols: when someone asks "what is your 
            evidence," the system requires an answer, a concession, or an explicit deferral. 
            Questions cannot be silently ignored.
          </p>
          
          <p>
            The platform computes acceptance from structure rather than votes. A claim's 
            status—accepted, rejected, or undecided—derives from its position in the argument 
            graph and the attacks it faces. Argumentation schemes generate critical questions 
            automatically: if you argue from expert testimony, the system asks about the expert's 
            credentials and potential bias. When deliberation reaches a state where no legal moves 
            remain, it terminates with a complete record of what was considered and why.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-8 space-y-4 text-base leading-relaxed text-slate-700"
        >
          <p>
            The output is machine-readable: a graph of claims, evidence links, attack relations, 
            and computed labels that external systems can import and build on. This means the 
            FDA's drug evaluation can export as structured data (AIF, JSON-LD). The EMA can 
            import it, inspect the reasoning, accept what holds under their standards, and 
            fork what doesn't—preserving the original analysis while documenting exactly where 
            and why their conclusion differs.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="about-glass-card-code w-full rounded-xl panel-edge postcard mb-8"
        >
          <div className='bg-transparent'>
            <div className="mb-4 font-semibold text-[15px] text-slate-900">
              What the system provides
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">→</span>
                <span>
                  Link claims to source material with character-level precision. When evidence 
                  updates or gets challenged, see which conclusions depend on it.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">→</span>
                <span>
                  Enforce response obligations. Questions require answers or explicit deferrals. 
                  Unanswered challenges remain visible in the record.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">→</span>
                <span>
                  Generate critical questions from argument structure. Expert testimony arguments 
                  trigger questions about credentials. Analogies trigger questions about relevance.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">→</span>
                <span>
                  Enable reasoning reuse. Import argument structures between deliberations. Fork 
                  analyses to adapt them to different contexts while preserving provenance.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 font-medium flex-shrink-0">→</span>
                <span>
                  Export to standard formats. Deliberations produce citable artifacts (AIF, 
                  JSON-LD) that integrate with institutional systems.
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="about-alert about-alert--info mb-8"
        >
          Complex problems—climate adaptation, healthcare coordination, technology governance—require 
          institutions to reason together across organizational boundaries. Without infrastructure 
          that makes reasoning chains explicit, reusable, and verifiable, each institution works 
          in isolation and trust continues to erode.
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-wrap items-center gap-4"
        >
          <Link href="#access">
            <button className="about-btn postcard group">
              <span className="relative flex items-center gap-2">
                Request Access
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </Link>
          
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="font-medium">Current deployment: 20 deliberations, 500 claims, 200 arguments</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}


/* ======================== PROBLEM SECTION ======================== */

function ProblemSection() {
  return (
    <section className="border-b border-rose-100/50 about-panel-textured">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6 text-2xl font-medium text-slate-900"
        >
          The Problem: Degradation of the Public Sphere
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4 text-sm leading-relaxed text-slate-700"
        >
          <p className='about-glass-card-paragraph'>
            Voting alone does not establish democratic legitimacy. Decisions must emerge from public
            reasoning: discourse in which participants evaluate arguments to achieve mutual understanding.
            Argument quality determines outcomes. Strategic manipulation and power are excluded. Habermas
            termed this communicative action: interaction oriented toward rationally motivated consensus
            through the examination and justification of validity claims.
          </p>
    
          <p className='about-glass-card-paragraph'>
            The emergence of the Internet was expected to enable communicative action at a global scale. The dominant
            platforms have instead systematically eliminated the conditions under which such collaboration can
            occur. Even if these companies rooted out all the problems they are continually plagued by—misinformation,
            harassment, manipulation—the way these systems are architected would still not be adequate for supporting
            productive discourse. Arguments cannot be structured to show explicit reasoning chains from premises to conclusions.
            Evidence links decay and break, preventing verification. Challenges to claims create no obligation
            to respond. Discussions cannot build on previous exchanges or reference established conclusions.
            No record exists of which arguments have survived challenge, which have been refuted, and which
            remain contested.
          </p>

                   <p className='about-glass-card-paragraph'>

            Deliberate architectural choices produce these failures. Platforms present themselves as neutral
            infrastructure—open spaces where anyone can speak to anyone. This framing is deceptive. The systems
            intercept messages and distribute them according to proprietary algorithms that maximize attention
            and advertising revenue. Creators produce content shaped by platform incentives. Viewers see content
            selected by recommendation systems. The architecture functions as a managed distribution system
            serving commercial goals incompatible with sustained deliberation.
          </p>

               <p className='about-glass-card-paragraph'>

            What emerges is what Habermas diagnosed as re-feudalization: the transformation of spaces for
            rational-critical debate into arenas of spectacle. Where Habermas observed this process through mass
            media and public relations, contemporary platforms have perfected it through architecture. Discourse
            is not suppressed through censorship. It is rendered structurally impossible by systems that make
            every feature required for reasoning—answerability, evidential grounding, inferential coherence,
            cumulative development—technically unachievable.
          </p>

              <p className='about-glass-card-paragraph'>

            Capacity for reasoned deliberation exists. Infrastructure enabling its exercise does not. Current
            platforms were built by corporations that discovered attention maximization through outrage, tribal
            signaling, and parasocial performance generates more revenue than facilitating genuine discourse.
            Every dollar of market capitalization in social media represents a bet against the possibility of
            people reasoning together. These systems serve their intended purpose: advertising revenue through
            attention capture.
          </p>

              <p className='about-glass-card-paragraph'>

            The consequences compound. Institutional decisions that require legitimacy cannot be grounded in
            deliberative processes because no suitable infrastructure exists. People retreat from political
            engagement not because they lack capacity for thought but because attempting collaborative reasoning
            on available platforms produces only confusion and exhaustion. Those exercising power face no
            requirement to justify decisions. No protocol enforces accountability. Those seeking to understand
            complex questions—technological governance, climate coordination, institutional reform—find themselves
            unable to assemble evidence, evaluate arguments, and track how conclusions emerge from analysis.
            Collaborative reasoning cannot be conducted using tools built to prevent it.
          </p>

              <p className='about-glass-card-paragraph'>
            The problem is not a feature gap that can be patched. It represents a structural incompatibility.
            Systems built for content circulation cannot be modified into systems for knowledge formation.
            Different architecture is required from first principles.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ======================== CIVIC REQUIREMENTS ======================== */
function CivicRequirementsSection() {
  return (
    <section className="border-b border-blue-100/50 about-panel-textured">
      <div className="mx-auto max-w-5xl px-8 py-16">
        
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-2xl font-medium text-slate-900"
        >
          Requirements for Democratic Discourse
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 text-sm leading-relaxed text-slate-700"
        >
          Habermas identified five conditions necessary for discourse to serve its epistemic function—producing justified beliefs rather than merely expressing power. These conditions define what civic deliberation infrastructure must provide.
        </motion.p>
        
        <div className="space-y-8">
          <CivicRequirement
            number={1}
            title="Transparency"
            subtitle="Reasoning Chains Must Be Inspectable"
            content="Citizens cannot evaluate institutional decisions when reasoning chains are opaque—buried in meeting minutes, internal memos, or absent entirely. Public consent requires the capacity to inspect how conclusions emerged: what evidence was considered, what alternatives evaluated, what objections raised, how they were resolved. When institutions adopt policies that affect citizens' lives, the reasoning behind those policies must be available for examination. Not as narrative justification written after the decision, but as structured record of the deliberative process itself."
            delay={0.1}
          />
          
          <CivicRequirement
            number={2}
            title="Accessibility"
            subtitle="Complex Reasoning Must Be Navigable"
            content="Policy questions generate reasoning structures too large for linear reading. Citizens need tools to navigate these structures: starting with conclusions, tracing back to evidence, exploring alternative arguments, understanding disputed points—without reading hundreds of pages sequentially. Accessibility is not about simplification. It is about providing structure that makes complexity navigable rather than overwhelming."
            delay={0.2}
          />
          
          <CivicRequirement
            number={3}
            title="Accountability"
            subtitle="Claims Must Be Attributable and Testable"
            content="Public discourse should distinguish grounded claims from ungrounded ones. Every assertion should have clear attribution (who made it, when, in what context), evidential grounding (what supports it), and a mechanism for challenge (what would constitute refutation). This is not about enforcing truth but about making truth-seeking possible. Claims that cannot be challenged cannot be tested. Claims that cannot be tested cannot be distinguished from propaganda."
            delay={0.3}
          />
          
          <CivicRequirement
            number={4}
            title="Collaboration"
            subtitle="Arguments Must Improve Through Critical Examination"
            content="Discourse should produce collaborative refinement, not just competitive victory. When someone identifies a weak premise, authors should be able to strengthen it. When new evidence emerges, arguments should incorporate it. Good-faith criticism should make positions better, not merely defeat them. The goal is collective intelligence—finding better answers through structured interaction—not debate as performance."
            delay={0.4}
          />
          
          <CivicRequirement
            number={5}
            title="Durability"
            subtitle="Reasoning Should Accumulate as Common Resource"
            content="Deliberations should produce durable knowledge artifacts that persist as foundations for future work. When a community resolves a question, that resolution should be available for others facing similar questions—not requiring each generation to rediscover arguments already developed. Democratic knowledge should accumulate. The alternative is permanent amnesia—each discussion starting from scratch, each generation re-litigating questions their predecessors already settled."
            delay={0.5}
          />
        </div>
      </div>
    </section>
  )
}

function CivicRequirement({
  number,
  title,
  subtitle,
  content,
  delay
}: {
  number: number
  title: string
  subtitle: string
  content: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="about-requirement"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="about-number-badge flex-shrink-0" style={{ marginTop: '2px' }}>
          {number}
        </div>
        <div>
          <h3 className="font-mono text-sm font-medium text-slate-900 mb-1">
            {title}
          </h3>
          <div className="text-sm font-medium text-indigo-700 mb-2">
            {subtitle}
          </div>
        </div>
      </div>
      
      <div className="ml-11 text-sm leading-relaxed text-slate-700">
        {content}
      </div>
    </motion.div>
  )
}

/* ======================== INSTITUTIONAL REQUIREMENTS ======================== */
function InstitutionalRequirementsSection() {
  return (
    <section className="border-b border-rose-100/50 about-panel-textured">
      <div className="mx-auto max-w-5xl px-8 py-16">
        
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-2xl font-medium text-slate-900"
        >
          Requirements for Institutional Deliberation
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 text-sm leading-relaxed text-slate-700"
        >
          When institutions evaluate complex questions—regulatory agencies assessing risk, standards bodies developing specifications, research consortia synthesizing evidence—they face recurring failures in how reasoning gets documented. Five gaps prevent institutional knowledge from being reusable, verifiable, or composable.
        </motion.p>
        
        <div className="space-y-8">
          <InstitutionalRequirement
            number={1}
            title="Reusability"
            subtitle="Reasoning Should Transfer Between Institutions"
            content="Institutions repeatedly evaluate the same questions but cannot build on each other's work. When one regulatory body completes an evidence synthesis, another facing the same question must reconstruct the analysis manually from source documents. The reasoning structure—which claims depend on which evidence, which challenges were raised, how they were resolved—does not transfer. The requirement: institutions should be able to import complete reasoning chains, inspect their structure, adopt what survives scrutiny, and fork what doesn't—while preserving visible provenance showing exactly where and why their analysis diverges. Without this, knowledge cannot accumulate across institutional boundaries. Each organization works in isolation even when addressing identical questions."
            delay={0.1}
          />
          
          <InstitutionalRequirement
            number={2}
            title="Granular Addressability"
            subtitle="Challenges Should Target Specific Components"
            content="When reasoning fails, it typically fails at specific points: a questionable premise, an unsupported inference, inadequate evidence for a particular claim. Current practice forces wholesale acceptance or rejection of entire arguments. This prevents incremental refinement—the process by which arguments get stronger through identifying and fixing their weakest points. The requirement: challenges should specify exactly what they target. Not 'this argument is flawed' but 'this argument's second premise contradicts established findings' or 'this inference assumes a causal mechanism that has not been demonstrated.' Precision in challenge enables precision in response. Arguments improve through surgical revision rather than complete reconstruction."
            delay={0.2}
          />
          
          <InstitutionalRequirement
            number={3}
            title="Provenance Tracking"
            subtitle="Dependencies Should Be Visible"
            content="In technical and policy domains, conclusions build on other conclusions. A specification relies on security assumptions. A policy recommendation depends on cost projections. An intervention's justification rests on empirical claims. When foundational elements change—new evidence, revised assumptions, challenged premises—institutions need to identify every downstream conclusion potentially affected. The requirement: the system should maintain dependency graphs. When element X changes status, surface every conclusion that relied on X. This enables systematic impact assessment rather than hopeful searching through potentially related documents. Without dependency tracking, institutions face hidden fragility. Foundations shift and downstream structures fail without anyone noticing until too late."
            delay={0.3}
          />
          
          <InstitutionalRequirement
            number={4}
            title="Protocol Enforcement"
            subtitle="Challenges Cannot Be Silently Ignored"
            content="In institutional deliberation, silence often passes for agreement. Someone raises an objection. It receives no response. Months later, the original proposal moves forward with the challenge forgotten. Outside observers cannot distinguish resolved objections from ignored ones. The requirement: when a claim is challenged, the claimant must either provide justification, concede the point, or explicitly defer response. Challenges that remain unanswered stay visible in the record. The system does not permit silent evasion. This creates accountability through structure. Not social pressure to respond but architectural impossibility of pretending challenges never occurred."
            delay={0.4}
          />
          
          <InstitutionalRequirement
            number={5}
            title="Machine Readability"
            subtitle="Reasoning Should Be Computation-Ready"
            content="Institutional deliberations produce prose documents. Human-readable but structure-implicit. Other institutions wanting to build on this work face manual parsing—extracting the argument structure, identifying premises and conclusions, mapping evidence to claims. The requirement: deliberations should produce machine-readable graphs. Nodes (claims, evidence), edges (support/attack relations), semantic labels (accepted/rejected/undecided), provenance metadata. Structured output that external systems can import, analyze, visualize, or extend algorithmically. Machine readability enables systematic analysis at scale. Pattern detection across deliberations. Automated consistency checking. Integration with computational tools for evidence synthesis and argument evaluation."
            delay={0.5}
          />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="about-alert about-alert--info mt-8"
        >
          <strong>Cross-Institutional Coordination:</strong> These requirements become critical when institutions must coordinate across organizational boundaries. Without infrastructure enabling reasoning transfer, each institution operates in isolation. With it, they can build on each other's work—adopting sound reasoning, challenging weak points, and documenting precisely where their analyses converge or diverge. Knowledge accumulates instead of fragmenting.
        </motion.div>
      </div>
    </section>
  )
}

function InstitutionalRequirement({
  number,
  title,
  subtitle,
  content,
  delay
}: {
  number: number
  title: string
  subtitle: string
  content: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="about-requirement"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="about-number-badge flex-shrink-0" style={{ marginTop: '2px' }}>
          {number}
        </div>
        <div>
          <h3 className="font-mono text-sm font-medium text-slate-900 mb-1">
            {title}
          </h3>
          <div className="text-sm font-medium text-emerald-700 mb-2">
            {subtitle}
          </div>
        </div>
      </div>
      
      <div className="ml-11 text-sm leading-relaxed text-slate-700">
        {content}
      </div>
    </motion.div>
  )
}

/* ======================== ADVANCED CAPABILITIES ======================== */
function AdvancedCapabilitiesSection() {
  return (
    <section className="border-b border-violet-100/50 bg-gradient-to-br from-violet-50/20 to-indigo-50/20 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-2xl font-medium text-slate-900"
        >
          Advanced Capabilities
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-10 text-sm leading-relaxed text-slate-700"
        >
          Beyond basic discussion, Isonomia implements formal systems from argumentation theory and provides infrastructure for evidence management and cross-context reasoning.
        </motion.p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* ASPIC+ Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="about-glass-card-code rounded-xl p-6 panel-edge postcard"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-violet-100/70">
                <GitBranch className="h-5 w-5 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-900">ASPIC+ Defeasible Reasoning</h3>
            </div>
            
            <p className="text-sm text-slate-700 mb-4">
              Full implementation of the ASPIC+ framework for defeasible argumentation, computing which arguments survive challenge under formal semantics.
            </p>
            
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-violet-500 mt-0.5">◆</span>
                <span><strong>Strict & Defeasible Rules:</strong> Distinguish certain inferences from presumptive ones</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-violet-500 mt-0.5">◆</span>
                <span><strong>Attack Types:</strong> Rebut (challenge conclusion), Undercut (challenge inference), Undermine (challenge premise)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-violet-500 mt-0.5">◆</span>
                <span><strong>Preference Orderings:</strong> Resolve conflicts when multiple rules apply</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-violet-500 mt-0.5">◆</span>
                <span><strong>Grounded Extension:</strong> Compute which arguments are ultimately defensible</span>
              </div>
            </div>
          </motion.div>
          
          {/* Stacks/Library Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="about-glass-card-code rounded-xl p-6 panel-edge postcard"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-100/70">
                <BookOpen className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Stacks & Evidence Library</h3>
            </div>
            
            <p className="text-sm text-slate-700 mb-4">
              Document management infrastructure for curating sources, with deep integration into the deliberation engine for evidence-based argumentation.
            </p>
            
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">◆</span>
                <span><strong>PDF Management:</strong> Upload, organize, and annotate documents in curated stacks</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">◆</span>
                <span><strong>Citation Pipeline:</strong> DOI resolution, quote linking with page/paragraph specificity</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">◆</span>
                <span><strong>Source Quality:</strong> Track usage and quality ratings across deliberations</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">◆</span>
                <span><strong>Deliberation Hosting:</strong> Stacks can host their own structured deliberations</span>
              </div>
            </div>
          </motion.div>
          
          {/* Plexus Network Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="about-glass-card-code rounded-xl p-6 panel-edge postcard"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-teal-100/70">
                <Network className="h-5 w-5 text-teal-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Plexus Cross-Room Network</h3>
            </div>
            
            <p className="text-sm text-slate-700 mb-4">
              Meta-level visualization showing how deliberations connect—shared claims, imported arguments, and cross-references form a graph-of-graphs.
            </p>
            
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">◆</span>
                <span><strong>Transport Functors:</strong> Import arguments between rooms with full provenance</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">◆</span>
                <span><strong>Edge Types:</strong> Cross-references, overlaps, stack references, shared authors</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">◆</span>
                <span><strong>Institutional Memory:</strong> See how reasoning spreads and evolves across contexts</span>
              </div>
            </div>
          </motion.div>
          
          {/* Argumentation Schemes Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="about-glass-card-code rounded-xl p-6 panel-edge postcard"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-rose-100/70">
                <Lightbulb className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="font-semibold text-slate-900">60+ Argumentation Schemes</h3>
            </div>
            
            <p className="text-sm text-slate-700 mb-4">
              Recognized patterns of reasoning from Walton's taxonomy, each with auto-generated critical questions that surface vulnerabilities.
            </p>
            
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-rose-500 mt-0.5">◆</span>
                <span><strong>Expert Opinion:</strong> "Is the expert credible? Within their domain? Any bias?"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-500 mt-0.5">◆</span>
                <span><strong>Analogy:</strong> "Are the cases relevantly similar? What differences matter?"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-500 mt-0.5">◆</span>
                <span><strong>Cause to Effect:</strong> "Is the causal claim established? Other factors?"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-500 mt-0.5">◆</span>
                <span><strong>And 57+ more...</strong> Each with tailored critical questions</span>
              </div>
            </div>
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="about-alert about-alert--info mt-10"
        >
          <strong>Mathematical Foundations:</strong> Built on categorical semantics (Ambler's Evidential Closed Categories) with support for Dempster-Shafer uncertainty intervals and temporal confidence decay. This is not aspirational theory—it's implemented infrastructure.
        </motion.div>
      </div>
    </section>
  )
}

/* ======================== JOURNEY OVERVIEW ======================== */
function JourneyOverview() {
  return (
    <section className="border-b border-purple-100/50 bg-gradient-to-br from-white/50 to-purple-50/30 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-2xl font-medium text-slate-900"
        >
          II. User Journey Through the System
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 text-sm text-slate-700"
        >
          The following walkthrough shows how a user moves through the platform, from joining a discussion to publishing knowledge artifacts. Each step corresponds to specific data models and workflows.
        </motion.p>

        {/* Flow Diagram */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="about-flow rounded-xl p-8"
        >
          <div className="flex items-center justify-between text-xs">
            <FlowStep icon={MessageSquare} label="Discussion" />
            <FlowArrow />
            <FlowStep icon={Lightbulb} label="Proposition" />
            <FlowArrow />
            <FlowStep icon={Vote} label="Workshop" />
            <FlowArrow />
            <FlowStep icon={FileCheck} label="Claim" />
            <FlowArrow />
            <FlowStep icon={Network} label="Graph" />
            <FlowArrow />
            <FlowStep icon={GitBranch} label="Argument" />
          </div>
          <div className="mt-6 flex items-center justify-between text-xs">
            <FlowStep icon={List} label="Arguments List" />
            <FlowArrow />
            <FlowStep icon={Swords} label="Dialogue" />
            <FlowArrow />
            <FlowStep icon={Map} label="Debate Sheet" />
            <FlowArrow />
            <FlowStep icon={BookOpen} label="KB Page" />
            <FlowArrow />
            <FlowStep icon={Share2} label="Network" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function FlowStep({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="about-flow-step">
      <div className="about-flow-step__icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="about-flow-step__label">{label}</div>
    </div>
  )
}

function FlowArrow() {
  return <ChevronRight className="h-4 w-4 flex-shrink-0 text-indigo-300" />
}

/* ======================== JOURNEY STEPS ======================== */
function JourneySteps({ expandedSteps, toggleStep }: {
  expandedSteps: Set<number>
  toggleStep: (step: number) => void
}) {
  const steps = [
    {
      number: 1,
      title: "Join Discussion → Deliberation",
      icon: MessageSquare,
      summary: "Discussions are lightweight forums that can upgrade to structured deliberations when formalization is needed.",
      content: <Step1Content />
    },
    {
      number: 2,
      title: "Compose Proposition",
      icon: Lightbulb,
      summary: "Create a lightweight assertion for community workshopping. Anyone can propose; only validated ideas become claims.",
      content: <Step2Content />
    },
    {
      number: 3,
      title: "Workshop (Vote, Endorse, Reply)",
      icon: Vote,
      summary: "Community signals quality through votes, endorsements, and refinement replies. Social validation filters signal before formalization.",
      content: <Step3Content />
    },
    {
      number: 4,
      title: "Promote to Claim",
      icon: FileCheck,
      summary: "Convert validated proposition to canonical claim with stable identifier. Claims are immutable atoms in the argument graph.",
      content: <Step4Content />
    },
    {
      number: 5,
      title: "View Claims (Minimap / CEG Minimap)",
      icon: Network,
      summary: "Navigate claim graph, see connections (supports/rebuts/undercuts). Claims don't exist in isolation—the graph structure makes argument visible.",
      content: <Step5Content />
    },
    {
      number: 6,
      title: "Compose Argument (Scheme Composer)",
      icon: GitBranch,
      summary: "Create argument linking premises to conclusion, optionally using a scheme template. Schemes surface critical questions automatically.",
      content: <Step6Content />
    },
    {
      number: 7,
      title: "View Arguments (AIF Arguments List)",
      icon: List,
      summary: "Browse arguments, see their structure and status. Arguments are the units of discourse; list view enables comparison and selection.",
      content: <Step7Content />
    },
    {
      number: 8,
      title: "Dialogue Move (Attack Menu: Rebut / Undercut)",
      icon: Swords,
      summary: "Respond to an argument using formal dialogue move. Protocol enforcement ensures every challenge is explicit and tracked.",
      content: <Step8Content />
    },
    {
      number: 9,
      title: "Navigate Debate Sheet",
      icon: Map,
      summary: "Two-level map: nodes (arguments) with expandable diagrams, edges (attack relations). Visual overview of entire deliberation structure.",
      content: <Step9Content />
    },
    {
      number: 10,
      title: "Publish to Knowledge Base",
      icon: BookOpen,
      summary: "Create KB page with live or pinned blocks referencing deliberation artifacts. Terminal publication—stable, citable, composable.",
      content: <Step10Content />
    },
    {
      number: 11,
      title: "Explore Network (Plexus / Cross-Room Graph)",
      icon: Share2,
      summary: "Navigate cross-room connections, trace argument imports, explore functors. The platform is a graph-of-graphs.",
      content: <Step11Content />
    }
  ]

  return (
    <section className="border-b border-slate-200/50 bg-white/20 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <div className="space-y-5">
          {steps.map((step, idx) => (
            <StepCard
              key={step.number}
              number={step.number}
              title={step.title}
              icon={step.icon}
              summary={step.summary}
              isExpanded={expandedSteps.has(step.number)}
              onToggle={() => toggleStep(step.number)}
              content={step.content}
              delay={idx * 0.05}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function StepCard({ 
  number, 
  title, 
  icon: Icon,
  summary, 
  isExpanded, 
  onToggle, 
  content,
  delay
}: {
  number: number
  title: string
  icon: any
  summary: string
  isExpanded: boolean
  onToggle: () => void
  content: React.ReactNode
  delay: number
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="about-step-card"
    >
      <div className="about-step-card__header ">
        <div className="flex items-start gap-4">
          <div className="about-step-card__icon-wrapper">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="mb-.5 font-mono tracking-wide text-sm text-indigo-600/70">Step {number}</div>
            <h3 className="text-md tracking-wide font-medium text-slate-900">
              {title}
            </h3>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="about-btn flex-shrink-0"
          style={{ padding: '0.375rem 0.75rem', fontSize: '12px' }}
        >
            <div className='flex items-center tracking-wide align-center gap-1'>
          {isExpanded ? 'Collapse' : 'Expand'}
          <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
      </div>
<hr className='mx-12 my-2 border-slate-200/50'/>
      <div className="px-12  pb-4">
        <p className="text-[14px] tracking-wide text-slate-700">{summary}</p>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="about-step-card__content">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ======================== STEP CONTENT COMPONENTS ======================== */

function Step1Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Discussions are lightweight forums with live chat integration. When structure is needed, they can upgrade to deliberations via a single action.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Lower barrier to entry. Start informal (discussion), formalize when needed (deliberation). Preserve conversation history during transition.</p>
      </div>

      <div>
        <h4 className="mb-3 font-mono text-xs tracking-wide font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">Discussion</span> &#123;</div>
          <div className="pl-4 about-code-property">slug, title, description, visibility</div>
          <div className="pl-4 about-code-property">upgradedToDeliberation: Deliberation?</div>
          <div className="pl-4 about-code-property">messages: DiscussionMessage[]</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">DiscussionDeliberation</span> &#123;</div>
          <div className="pl-4 about-code-property">discussionId, deliberationId (unique pair)</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <p><code className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 border border-indigo-100">UpgradeButton</code> → creates Deliberation, sets bidirectional link, preserves message history</p>
      </div>
    </div>
  )
}

function Step2Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Create a lightweight assertion that can be voted on, endorsed, replied to, and tagged before promotion to canonical claim.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Distinguish ideation from formalization. Anyone can float an idea. Structured reasoning begins when community validates it.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">Proposition</span> &#123;</div>
          <div className="pl-4 about-code-property">deliberationId, authorId, text</div>
          <div className="pl-4 about-code-property">status: DRAFT | PUBLISHED | CLAIMED | ARCHIVED</div>
          <div className="pl-4 about-code-property">promotedClaimId: Claim? (set on promotion)</div>
          <div className="pl-4 about-code-property">voteUpCount, voteDownCount, endorseCount</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <p><code className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 border border-indigo-100">PropositionComposer</code> → creates Proposition with status: PUBLISHED</p>
      </div>
    </div>
  )
}

function Step3Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Community members vote (±1), endorse (commit support), or reply (refine/challenge) to propositions.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Social validation filters quality before formalization. Votes signal overall quality, endorsements indicate commitment, replies enable refinement.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">PropositionVote</span> &#123;</div>
          <div className="pl-4 about-code-property">propositionId, userId, value: -1 | 0 | 1</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">PropositionEndorsement</span> &#123;</div>
          <div className="pl-4 about-code-property">propositionId, userId (unique pair)</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">PropositionReply</span> &#123;</div>
          <div className="pl-4 about-code-property">propositionId, parentId, authorId, text</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Actions</h4>
        <ul className="list-inside list-disc space-y-1 pl-4 text-xs">
          <li><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">VoteButton(±1)</code> → upserts PropositionVote</li>
          <li><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">EndorseButton</code> → creates PropositionEndorsement</li>
          <li><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">ReplyComposer</code> → creates PropositionReply</li>
        </ul>
      </div>
    </div>
  )
}

function Step4Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Convert validated proposition to canonical claim with stable content-addressed identifier (moid). Claims become immutable graph atoms.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Formalization checkpoint. Claims persist across deliberations, can be cited, and serve as nodes in the argument graph.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">Claim</span> &#123;</div>
          <div className="pl-4 about-code-property">text, createdById, moid (content hash)</div>
          <div className="pl-4 about-code-property">deliberationId, canonicalClaimId</div>
          <div className="pl-4 about-code-property">sourceProposition: Proposition? (back-link)</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <div className="text-xs space-y-1">
          <p><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">PromoteButton</code> →</p>
          <ul className="list-inside list-disc pl-4">
            <li>creates Claim(moid: hash(text))</li>
            <li>sets Proposition.promotedClaimId</li>
            <li>changes Proposition.status to CLAIMED</li>
            <li>creates Urn for stable reference</li>
          </ul>
        </div>
      </div>

      <div className="about-alert about-alert--info">
        <strong>Technical note:</strong> Content-addressing (moid = hash(text)) ensures duplicate claims map to same entity. Uniqueness constraint prevents redundancy.
      </div>
    </div>
  )
}

function Step5Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Navigate graph of claims with typed edges (supports, rebuts, undercuts, undermines). View semantic labels (IN/OUT/UNDEC) computed from graph structure.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Claims don't exist in isolation. The graph makes argument structure visible and machine-readable.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">ClaimEdge</span> &#123;</div>
          <div className="pl-4 about-code-property">fromClaimId, toClaimId</div>
          <div className="pl-4 about-code-property">type: supports | rebuts</div>
          <div className="pl-4 about-code-property">attackType: SUPPORTS | REBUTS | UNDERCUTS | UNDERMINES</div>
          <div className="pl-4 about-code-property">targetScope: premise | inference | conclusion</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">ClaimLabel</span> &#123;</div>
          <div className="pl-4 about-code-property">claimId, semantics: grounded | preferred | hybrid</div>
          <div className="pl-4 about-code-property">label: IN | OUT | UNDEC</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <p><code className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 border border-indigo-100">ClaimMinimap</code> → renders force-directed graph, color-coded by label (green=IN, red=OUT, gray=UNDEC)</p>
      </div>

      <div className="about-alert about-alert--info">
        <strong>Technical note:</strong> Labels are computed, not asserted. Follows Dung's extension semantics for abstract argumentation frameworks.
      </div>
    </div>
  )
}

function Step6Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Create argument linking premise claims to conclusion claim. Optionally use scheme template (expert opinion, analogy, consequence) which auto-generates critical questions.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Make reasoning explicit. Schemes surface known vulnerabilities automatically rather than relying on participants to identify weaknesses.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">Argument</span> &#123;</div>
          <div className="pl-4 about-code-property">deliberationId, authorId, text</div>
          <div className="pl-4 about-code-property">conclusionClaimId, schemeId?: ArgumentScheme</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">ArgumentPremise</span> &#123;</div>
          <div className="pl-4 about-code-property">argumentId, claimId (join table)</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">ArgumentScheme</span> &#123;</div>
          <div className="pl-4 about-code-property">key, name, description, cq: JSON</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <div className="text-xs space-y-1">
          <p><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">SchemeComposer</code> →</p>
          <ul className="list-inside list-disc pl-4">
            <li>Select scheme (or none)</li>
            <li>Fill premise slots (select claims)</li>
            <li>State conclusion</li>
            <li>System creates Argument + ArgumentPremise[] + ArgumentDiagram</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function Step7Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Browse all arguments in deliberation. See conclusion text, premise count, approval count, unresolved CQ count, and attack/support indicators.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Arguments are the units of discourse. List view enables comparison, filtering, and selection for engagement.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">Argument</span> &#123;</div>
          <div className="pl-4 about-code-property">approvals: ArgumentApproval[]</div>
          <div className="pl-4 about-code-property">edges: ArgumentEdge[] (incoming/outgoing)</div>
          <div className="pl-4 about-code-property">cqStatuses: CQStatus[] (unresolved count)</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <p><code className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 border border-indigo-100">ArgumentsList</code> → displays cards with metadata, supports filtering (by scheme, approval count, CQ status), sorting, and expansion</p>
      </div>
    </div>
  )
}

function Step8Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Respond to argument using formal dialogue move. Attack types: rebut (challenge conclusion), undercut (attack warrant/inference), undermine (challenge premise).</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Protocol enforcement. Every challenge is explicit, typed, and tracked. No challenges can be ignored without record.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">DialogueMove</span> &#123;</div>
          <div className="pl-4 about-code-property">type: WHY | GROUNDS | CONCEDE | RETRACT</div>
          <div className="pl-4 about-code-property">replyTarget: claim | argument | premise | inference</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">ArgumentEdge</span> &#123;</div>
          <div className="pl-4 about-code-property">type: rebut | undercut | support</div>
          <div className="pl-4 about-code-property">targetInferenceId?: Inference (for warrant attacks)</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <div className="text-xs space-y-1">
          <p><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">AttackMenu</code> →</p>
          <ul className="list-inside list-disc pl-4">
            <li>Select attack type (rebut | undercut | undermine)</li>
            <li>If undercut: select specific inference from ArgumentDiagram</li>
            <li>Provide grounds (create supporting Argument)</li>
            <li>System creates DialogueMove + ArgumentEdge</li>
          </ul>
        </div>
      </div>

      <div className="about-alert about-alert--info">
        <strong>Technical note:</strong> <code className="rounded bg-white/70 px-1.5 py-0.5 border border-blue-100">targetInferenceId</code> enables warrant attacks. You challenge the inferential step, not just the conclusion.
      </div>
    </div>
  )
}

function Step9Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Two-level map: nodes (argument cards) expandable to show internal ArgumentDiagram, edges (typed attack relations). Color-coded by semantic labels.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Visual overview of entire deliberation structure. Navigate between arguments, see connections, drill down to inference details.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">DebateSheet</span> &#123;</div>
          <div className="pl-4 about-code-property">nodes: DebateNode[] (1:1 with ArgumentDiagram)</div>
          <div className="pl-4 about-code-property">edges: DebateEdge[] (supports | rebuts | undercuts)</div>
          <div className="pl-4 about-code-property">acceptance: SheetAcceptance (computed labels)</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <div className="text-xs space-y-1">
          <p><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">DebateSheet</code> viewer →</p>
          <ul className="list-inside list-disc pl-4">
            <li>Click node → expands to show ArgumentDiagram (Statement/Inference graph)</li>
            <li>Click edge → shows rationale and evidence</li>
            <li>Nodes color-coded by semantic label (green=IN, red=OUT, gray=UNDEC)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function Step10Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Create knowledge base page with typed blocks: text, images, claim references, argument embeds, debate sheets, theory works. Blocks can be live (update with source) or pinned (frozen snapshot).</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Terminal publication. Knowledge artifacts are stable, citable, and composable. Institutions can cite KB pages; communities can fork and revise.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">KbPage</span> &#123;</div>
          <div className="pl-4 about-code-property">spaceId, slug, title, visibility</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">KbBlock</span> &#123;</div>
          <div className="pl-4 about-code-property">type: text | claim | argument | sheet | theory_work</div>
          <div className="pl-4 about-code-property">live: boolean (updates vs. pinned snapshot)</div>
          <div className="pl-4 about-code-property">dataJson, citations</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <div className="text-xs space-y-1">
          <p><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">KbPageComposer</code> →</p>
          <ul className="list-inside list-disc pl-4">
            <li>Create page with metadata</li>
            <li>Add blocks (text, claim references, argument embeds)</li>
            <li>Toggle live vs. pinned per block</li>
            <li>Publish; optionally create KbSnapshot</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function Step11Content() {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">What</h4>
        <p>Navigate network of rooms (deliberation contexts) with edges representing argument imports, functor mappings, and cross-references. Trace provenance across the graph-of-graphs.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Why</h4>
        <p>Work travels and composes across rooms. Institutions can reuse reasoning chains, fork deliberations, and track impact.</p>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">Schema</h4>
        <div className="about-glass-card-code   w-full rounded-xl ">
          <div><span className="about-code-keyword">ArgumentImport</span> &#123;</div>
          <div className="pl-4 about-code-property">fromDeliberationId, toDeliberationId</div>
          <div className="pl-4 about-code-property">kind: import | restatement | quote</div>
          <div className="pl-4 about-code-property">fingerprint: string (SHA1 hash for idempotency)</div>
          <div>&#125;</div>
          <div className="mt-2"><span className="about-code-keyword">RoomFunctor</span> &#123;</div>
          <div className="pl-4 about-code-property">claimMapJson: JSON (fromClaimId → toClaimId)</div>
          <div>&#125;</div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-mono text-xs font-medium text-indigo-700">User Action</h4>
        <div className="text-xs space-y-1">
          <p><code className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 border border-indigo-100">Plexus</code> viewer →</p>
          <ul className="list-inside list-disc pl-4">
            <li>Visualizes rooms as nodes, imports/functors as edges</li>
            <li>Click node → enters room</li>
            <li>Click edge → shows import fingerprint and provenance metadata</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ======================== USE CASES SECTION ======================== */
function UseCasesSection() {
  const [activeTab, setActiveTab] = useState<'academic' | 'institutional' | 'community'>('academic')
  
  return (
    <section className="border-b border-cyan-100/50 bg-gradient-to-br from-cyan-50/20 to-blue-50/20 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-2xl font-medium text-slate-900"
        >
          Who This Is For
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 text-sm leading-relaxed text-slate-700"
        >
          The same infrastructure serves different needs. Select your context to see relevant capabilities.
        </motion.p>
        
        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          <button
            onClick={() => setActiveTab('academic')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'academic'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200'
            }`}
          >
            Academic Research
          </button>
          <button
            onClick={() => setActiveTab('institutional')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'institutional'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200'
            }`}
          >
            Institutional & Policy
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'community'
                ? 'bg-violet-600 text-white shadow-md'
                : 'bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200'
            }`}
          >
            Community Deliberation
          </button>
        </motion.div>
        
        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'academic' && (
            <motion.div
              key="academic"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="about-glass-card-code rounded-xl p-6 panel-edge postcard">
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  From Papers-as-PDFs to Papers-as-Debatable Claim Graphs
                </h3>
                <p className="text-sm text-slate-700 mb-4">
                  The unit of scholarly networking has shrunk from people → papers → metadata objects—but has not yet reached <strong>claims and arguments</strong>. Isonomia fills this gap.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="font-medium text-cyan-700 mb-2">Claim-Level Engagement</div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-cyan-500">→</span>
                      <span>Extract claims from papers with AI assistance</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-cyan-500">→</span>
                      <span>Classify claims: thesis, interpretive, historical, normative, methodological</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-cyan-500">→</span>
                      <span>Semantic search across claims, not just paper titles</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="font-medium text-cyan-700 mb-2">GitHub for Scholarship</div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-cyan-500">→</span>
                      <span>Fork deliberations to explore alternative assumptions</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-cyan-500">→</span>
                      <span>Pull requests for arguments with downstream impact visibility</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-cyan-500">→</span>
                      <span>Argument CI: checks for missing citations, unaddressed CQs</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200/50">
                  <div className="font-medium text-cyan-700 mb-2 text-sm">Templates</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-700">Journal Club Mode</span>
                    <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-700">Seminar Mode</span>
                    <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-700">Conference Mode</span>
                    <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-700">Dissertation Defense</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'institutional' && (
            <motion.div
              key="institutional"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="about-glass-card-code rounded-xl p-6 panel-edge postcard">
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  Transparent, Auditable Reasoning That Transfers
                </h3>
                <p className="text-sm text-slate-700 mb-4">
                  When the FDA evaluates drug safety, when a standards body develops specifications—these produce reasoning chains other institutions need. But that reasoning exists only as prose in PDFs. <strong>Isonomia makes it structured, importable, and auditable.</strong>
                </p>
                
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="font-medium text-emerald-700 mb-2">Cross-Institutional Transfer</div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-emerald-500">→</span>
                      <span>Import complete reasoning chains from other organizations</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-emerald-500">→</span>
                      <span>Adopt what survives scrutiny, fork what doesn't</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-emerald-500">→</span>
                      <span>Visible provenance: see exactly where analyses diverge</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="font-medium text-emerald-700 mb-2">Audit & Accountability</div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-emerald-500">→</span>
                      <span>Every claim traceable to author, evidence, and context</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-emerald-500">→</span>
                      <span>Challenges cannot be silently ignored—protocol enforces response</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-emerald-500">→</span>
                      <span>Export to standard formats (AIF, JSON-LD) for external review</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200/50">
                  <div className="font-medium text-emerald-700 mb-2 text-sm">Use Cases</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Policy Analysis</span>
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Regulatory Review</span>
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Standards Development</span>
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Risk Assessment</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'community' && (
            <motion.div
              key="community"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="about-glass-card-code rounded-xl p-6 panel-edge postcard">
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  Democratic Discourse with Rigor
                </h3>
                <p className="text-sm text-slate-700 mb-4">
                  Complex questions—climate policy, public health, technology governance—require collective intelligence that current platforms actively undermine. <strong>Isonomia provides the structure for sustained, productive deliberation.</strong>
                </p>
                
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="font-medium text-violet-700 mb-2">Structured Participation</div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-violet-500">→</span>
                      <span>Start informal, formalize when complexity warrants</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-violet-500">→</span>
                      <span>See how conclusions emerge from argument structure</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-violet-500">→</span>
                      <span>Navigate complexity: zoom from overview to specific claims</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="font-medium text-violet-700 mb-2">Accumulated Knowledge</div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-violet-500">→</span>
                      <span>Past reasoning persists as reusable resource</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-violet-500">→</span>
                      <span>Build on established conclusions rather than starting fresh</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-violet-500">→</span>
                      <span>Publish knowledge base pages that others can cite and extend</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200/50">
                  <div className="font-medium text-violet-700 mb-2 text-sm">Use Cases</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-violet-100 text-violet-700">Civic Deliberation</span>
                    <span className="px-2 py-1 rounded bg-violet-100 text-violet-700">Participatory Budgeting</span>
                    <span className="px-2 py-1 rounded bg-violet-100 text-violet-700">Community Planning</span>
                    <span className="px-2 py-1 rounded bg-violet-100 text-violet-700">Issue Analysis</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

/* ======================== STATUS, ALPHA, FOUNDATIONS, ACCESS, CLOSING ======================== */

function StatusSection() {
  return (
    <section className="border-b border-slate-200/50 bg-gradient-to-br from-white/40 to-slate-50/40 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-2xl font-medium text-slate-900"
        >
          III. Implementation Status
        </motion.h2>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 space-y-3 text-sm text-slate-700"
        >
          <p><strong className="text-slate-900">Deployment:</strong> Closed alpha with active deliberations, growing claim/argument base, and published theory works.</p>
          <p><strong className="text-slate-900">Core Systems:</strong> Claims & Evidence, Arguments & Dialogue, ASPIC+ Defeasible Reasoning, Stacks/Library, Plexus Network, Knowledge Base.</p>
          <p><strong className="text-slate-900">Data model:</strong> Stable. Prisma schema, PostgreSQL backend with full AIF ontology support.</p>
          <p><strong className="text-slate-900">Argumentation:</strong> 60+ Walton schemes with auto-generated critical questions. ASPIC+ grounded extension computation.</p>
          <p><strong className="text-slate-900">Frontend:</strong> All core workflows—proposition workshop, claim graph, argument composer, scheme selector, dialogue interface, debate sheet, KB editor, Plexus network view.</p>
          <p><strong className="text-slate-900">Export formats:</strong> AIF 2.0, AIF+, JSON-LD, PDF.</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="about-alert about-alert--warning"
        >
          <h3 className="mb-3 font-mono text-xs font-medium">Known Limitations</h3>
          <ul className="space-y-1.5">
            <li>• Semantic labeling: grounded semantics implemented; preferred/stable in development</li>
            <li>• Cross-room import: API functional, UI in progress</li>
            <li>• Ludics proof-game interface: prototype quality</li>
            <li>• Mobile UI: functional but not optimized</li>
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

function AlphaSection() {
  return (
    <section className="border-b border-purple-100/50 bg-gradient-to-br from-purple-50/30 to-pink-50/30 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-2xl font-medium text-slate-900"
        >
          IV. Closed Launch Participation Requirements
        </motion.h2>
        <div className="mb-8 space-y-6">
          {[
            { num: 1, title: "Commitment to actual use", desc: "Run at least one real deliberation over 4-6 weeks." },
            { num: 2, title: "Methodological feedback", desc: "Identify where the data model helps and where it hinders." },
            { num: 3, title: "Evidence contribution", desc: "Populate with real evidence links, not placeholders." },
            { num: 4, title: "Dialogue participation", desc: "Use WHY/GROUNDS moves, answer CQs or defer explicitly." },
            { num: 5, title: "Publication", desc: "Produce at least one KB page with mixed live/pinned blocks." }
          ].map((req, idx) => (
            <motion.div 
              key={req.num}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="flex gap-4 group"
            >
              <div className="about-number-badge">
                {req.num}
              </div>
              <div>
                <h3 className="mb-1 font-mono text-sm font-medium text-slate-900">
                  {req.title}
                </h3>
                <p className="text-sm text-slate-700">{req.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FoundationsSection() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)


  return (
    <section className="border-b border-indigo-100/50">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-2xl font-medium text-slate-900"
        >
          V. Theoretical Foundations
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 text-sm text-slate-700"
        >
           Isonomia synthesizes formal theories from argumentation, logic, dialogue systems, and platform design. 
          Each theoretical contribution maps to specific data models, API contracts, or UI affordances.
        </motion.p>

        <div className="space-y-6">
          {foundationCategories.map((category, catIdx) => (
            <FoundationCategory
              key={category.id}
              category={category}
              isExpanded={expandedCategory === category.id}
              onToggle={() => setExpandedCategory(
                expandedCategory === category.id ? null : category.id
              )}
              delay={catIdx * 0.1}
            />
          ))}
        </div>

        {/* <motion.div 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="about-alert about-alert--info mt-10"
        >
          <strong>Implementation Note:</strong> This is not a theoretical project that cites these works aspirationally. 
          Every source listed has directly influenced the data model, API design, or user interface. 
          The platform is an <em>implementation</em> of these theories, not a commentary on them.
        </motion.div> */}
      </div>
    </section>
  )
}

function FoundationCategory({ 
  category, 
  isExpanded, 
  onToggle, 
  delay 
}: { 
  category: any
  isExpanded: boolean
  onToggle: () => void
  delay: number
}) {


  const colors = colorClasses[category.color as keyof typeof colorClasses]

  return (
  <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={`p-4 w-full rounded-lg panel-edge border  ${colors.border} overflow-hidden transition-colors duration-500 ${
        isExpanded ? `bg-gradient-to-br ${colors.bg}` : 'bg-transparent '
      }`}
    >
      <button
        onClick={onToggle}
        className=" p-4 w-full bg-white/30 hover:bg-white/40 rounded-lg panel-edge "
      >
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors.badge}`}>
                {category.sources.length} sources
              </span>
              <h3 className={`text-base font-semibold ${colors.text}`}>
                {category.title}
              </h3>
            </div>
            <p className="text-sm  text-slate-600">
              {category.description}
            </p>
          </div>
          <ChevronDown 
            className={`h-5 w-5 flex-shrink-0 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            } ${colors.icon}`}
          />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={`border-t ${colors.border}  rounded-xl p-4 space-y-4`}>
              {category.sources.map((source: any, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="postcard p-4 bg-white/30 w-full rounded-lg panel-edge"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="font-mono text-xs font-medium text-slate-900">
                      {source.cite}
                    </div>
                  </div>
                  {source.title && (
                    <div className="mb-2 text-sm italic text-slate-700">
                      {source.title}
                    </div>
                  )}
                  <div className="mb-2 font-mono text-xs text-slate-600">
                    → <span className={colors.text}>{source.impl}</span>
                  </div>
                  {source.detail && (
                    <div className="text-xs leading-relaxed text-slate-600 border-l-2 pl-3" style={{ borderColor: `rgb(${colors.icon})` }}>
                      {source.detail}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AccessSection() {
  return (
    <section id="access" className="border-b border-rose-100/50 bg-gradient-to-br from-rose-50/30 to-orange-50/20 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-2xl font-medium text-slate-900"
        >
          VI. Request Access
        </motion.h2>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 space-y-4 text-sm text-slate-700"
        >
          <p>Submit request with institutional affiliation, proposed deliberation topic, expected timeline, team size.</p>
          <p>Response within 5 business days. Current limit: 10 concurrent deliberations per deployment.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* <button className="about-btn about-btn--gradient group about-pulse-glow">
            <span className="relative flex items-center gap-2">
              Request Alpha Access
              <Zap className="h-4 w-4" />
            </span>
          </button> */}
          <Link href="#access">
            <button className="about-btn postcard group">
              <span className="relative flex items-center gap-2">
                Register for Early Access
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

function ClosingSection() {
  return (
    <section className="bg-gradient-to-b from-white/40 to-slate-100/60 about-backdrop-blur">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="about-glass-elevated p-10 text-center"
        >
          <p className="text-base font-medium leading-relaxed text-slate-800 mb-4">
            This is not marketing material. It is technical specification.
          </p>
          <div className="about-divider my-6" />
          <p className="text-sm leading-relaxed text-slate-700 mb-4">
            The system described here exists and is deployable. Every capability listed—claims with stable identifiers, typed argument relationships, scheme-based critical questions, composable outputs—is implemented and in use. This is infrastructure for reasoning, available to any group that needs to think together seriously.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            The question is not "would this be nice to have" but: <strong className="text-slate-800">does this solve a problem you currently face?</strong> If your research community needs claim-level engagement—if your organization's reasoning needs to outlive project teams—if your deliberations need more than threads and votes—Isonomia provides the substrate.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
