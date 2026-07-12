/* ======================== ENHANCED CONTENT BLOCK ======================== */

import { motion } from 'framer-motion'
import { 
  Lightbulb, 
  Target, 
  MousePointerClick, 
  FerrisWheel,
  CheckCircle2,
  ArrowRight,
  Info
} from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
interface ContentBlockProps {
  title: string
  content: string
  variant?: 'what' | 'why' | 'action'
}

/**
 * Enhanced ContentBlock with visual hierarchy, icons, and layout improvements
 * 
 * Key improvements:
 * 1. Icon-based visual system for each content type
 * 2. Color-coded accent system for instant recognition
 * 3. Better typography and spacing
 * 4. Subtle animations for engagement
 * 5. Responsive design with better mobile layout
 * 6. Visual separation between blocks without walls of text
 */
function ContentBlock({ title, content, variant }: ContentBlockProps) {
  // Configuration for each variant type
  const variantConfig = {
    what: {
      icon: Lightbulb,
      accentColor: 'indigo',
      bgColor: 'bg-indigo-50/50',
      borderColor: 'border-indigo-200',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      titleColor: 'text-indigo-900',
      description: 'Feature explanation'
    },
    why: {
      icon: Target,
      accentColor: 'violet',
      bgColor: 'bg-violet-50/50',
      borderColor: 'border-violet-200',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      titleColor: 'text-violet-900',
      description: 'Purpose & value'
    },
    action: {
      icon: MousePointerClick,
      accentColor: 'emerald',
      bgColor: 'bg-emerald-50/50',
      borderColor: 'border-emerald-200',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      titleColor: 'text-emerald-900',
      description: 'How to use it'
    }
  }

  // Determine variant (with fallback)
  const config = variant ? variantConfig[variant] : {
    icon: Info,
    accentColor: 'slate',
    bgColor: 'bg-slate-50/50',
    borderColor: 'border-slate-200',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    titleColor: 'text-slate-900',
    description: 'Information'
  }

  const Icon = config.icon

  // Split content into sentences for better readability
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim())
  const hasMultipleSentences = sentences.length > 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className={`
        relative rounded-xl border ${config.borderColor} ${config.bgColor}
        backdrop-blur-sm overflow-hidden group
        hover:shadow-md transition-shadow duration-300
      `}
    >
      {/* Subtle gradient accent bar on left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-${config.accentColor}-400 to-${config.accentColor}-600`} />
      
      <div className="p-5 lg:p-6">
        {/* Header with icon and title */}
        <div className="flex items-start gap-3 mb-4">
          {/* Icon container */}
          <div className={`
            flex items-center justify-center w-10 h-10 rounded-lg
            ${config.iconBg} flex-shrink-0 group-hover:scale-105 transition-transform
          `}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          
          {/* Title and meta */}
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-semibold ${config.titleColor} mb-0.5`}>
              {title}
            </h3>
            <p className="text-xs text-slate-500">
              {config.description}
            </p>
          </div>
        </div>

        {/* Content area with improved typography */}
        {hasMultipleSentences ? (
          // Multi-sentence layout with subtle bullets
          <div className="space-y-2.5 ml-1">
            {sentences.map((sentence, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className={`h-4 w-4 ${config.iconColor} flex-shrink-0 mt-0.5 opacity-60`} />
                <p className="text-slate-700 leading-relaxed text-[15px] flex-1">
                  {sentence.trim()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          // Single sentence/paragraph layout
          <p className="text-slate-700 leading-relaxed text-[15px] ml-1">
            {content}
          </p>
        )}
      </div>

      {/* Optional hover effect - subtle glow */}
      <div className={`
        absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100
        transition-opacity duration-300 pointer-events-none
        bg-gradient-to-br from-${config.accentColor}-100/20 to-transparent
      `} />
    </motion.div>
  )
}

/* ======================== ALTERNATIVE: CARD GRID LAYOUT ======================== */

/**
 * Alternative layout that displays all three content blocks in a responsive grid
 * This provides better visual separation and makes scanning easier
 */
interface ContentSectionProps {
  what: string
  why: string
  userAction: string
}

function ContentSection({ what, why, userAction }: ContentSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
      <ContentBlock title="What" content={what} variant="what" />
      <ContentBlock title="Why" content={why} variant="why" />
      <ContentBlock title="User Action" content={userAction} variant="action" />
    </div>
  )
}

/* ======================== ALTERNATIVE: TABBED LAYOUT ======================== */

import { useState } from 'react'

/**
 * Tabbed layout for content that saves vertical space
 * Good for dense information or longer content blocks
 */


/**
 * OPTION 1: Smart Auto-Format ContentTabs
 * Automatically detects and formats content based on structure
 * - Detects bullet points and converts to visual list
 * - Detects numbered lists and styles accordingly
 * - Splits long paragraphs into digestible chunks
 * - Highlights key phrases
 */
function ContentTabsAutoFormat({ what, why, userAction }: ContentSectionProps) {
  const [activeTab, setActiveTab] = useState<'what' | 'why' | 'action'>('what')

  const tabs = [
    { id: 'what' as const, label: 'What', icon: Lightbulb, content: what, color: 'indigo' },
    { id: 'why' as const, label: 'Why', icon: Target, content: why, color: 'violet' },
    { id: 'action' as const, label: 'User Action', icon: MousePointerClick, content: userAction, color: 'emerald' }
  ]

  const activeConfig = tabs.find(t => t.id === activeTab)!

  return (
    // <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm">
    //   {/* Tab navigation */}
    //   <div className="flex border-b border-slate-200 bg-slate-50/50">
    //     {tabs.map((tab) => {
    //       const Icon = tab.icon
    //       const isActive = activeTab === tab.id
          
    //       return (
    //         <button
    //           key={tab.id}
    //           onClick={() => setActiveTab(tab.id)}
    //           className={`
    //             flex-1 flex items-center justify-center gap-2 px-4 py-3
    //             text-sm font-medium transition-all relative
    //             ${isActive 
    //               ? `text-${tab.color}-700 bg-white` 
    //               : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
    //             }
    //           `}
    //         >
    //           <Icon className={`h-4 w-4 ${isActive ? `text-${tab.color}-600` : 'text-slate-400'}`} />
    //           <span>{tab.label}</span>
              
    //           {isActive && (
    //             <motion.div
    //               layoutId="activeTab"
    //               className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`}
    //               transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
    //             />
    //           )}
    //         </button>
    //       )
    //     })}
    //   </div>
     <div className="border border-indigo-200 rounded-xl overflow-hidden bg-white/40 backdrop-blur-md">
      {/* Tab navigation */}
      <div className="flex border-b border-indigo-200 bg-indigo-200/50">
        {tabs.map((tab, index) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isLast = index === tabs.length - 1
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3
                text-sm font-medium transition-all relative  
                ${isActive 
                  ? `text-${tab.color}-700 bg-white` 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }
                ${!isLast ? 'border-r border-indigo-300/50' : ''}
              `}
            >
              <Icon className={`h-4 w-4 ${isActive ? `text-${tab.color}-600` : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content with smart formatting */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-6 lg:p-8"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              bg-${activeConfig.color}-100
            `}>
              <activeConfig.icon className={`h-5 w-5 text-${activeConfig.color}-600`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold text-${activeConfig.color}-900 mb-1`}>
                {activeConfig.label}
              </h3>
              <p className="text-xs text-slate-500">
                {activeConfig.id === 'what' && 'Feature explanation'}
                {activeConfig.id === 'why' && 'Purpose & value'}
                {activeConfig.id === 'action' && 'How to use it'}
              </p>
            </div>
          </div>
          
          {/* Smart formatted content */}
          <SmartFormattedContent content={activeConfig.content} color={activeConfig.color} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * Smart content formatter that auto-detects structure and applies appropriate styling
 */
function SmartFormattedContent({ content, color }: { content: string; color: string }) {
  // Detect if content has sentence structure (split by periods)
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim())
  
  // Detect if content looks like a list (starts with -, *, or numbers)
  const looksLikeList = content.match(/^[\s]*[-*•]\s/m) || content.match(/^[\s]*\d+\.\s/m)
  
  if (looksLikeList) {
    return <ListFormat content={content} color={color} />
  } else if (sentences.length > 3) {
    return <MultiSentenceFormat sentences={sentences} color={color} />
  } else if (sentences.length > 1) {
    return <TwoColumnFormat sentences={sentences} color={color} />
  } else {
    return <SingleParagraphFormat content={content} />
  }
}

/**
 * OPTION 2: List Format
 * Converts bullet points or numbered lists into styled list items
 */
function ListFormat({ content, color }: { content: string; color: string }) {
  // Parse list items (handles -, *, •, and numbered lists)
  const listItems = content
    .split(/\n/)
    .map(line => line.trim())
    .filter(line => line.match(/^[-*•]\s/) || line.match(/^\d+\.\s/))
    .map(line => line.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, ''))

  // Get any intro text before the list
  const introText = content.split(/\n[-*•\d]/)[0]?.trim()

  return (
    <div className="space-y-3">
      {introText && (
        <p className="text-slate-700 leading-relaxed text-[15px] mb-4">
          {introText}
        </p>
      )}
      
      <div className="space-y-2.5">
        {listItems.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="flex items-start gap-2.5"
          >
            <CheckCircle2 className={`h-5 w-5 text-${color}-600 flex-shrink-0 mt-0.5`} />
            <p className="text-slate-700 leading-relaxed text-[15px] flex-1">
              {item}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/**
 * OPTION 3: Multi-Sentence Format (4+ sentences)
 * Breaks long content into scannable chunks with visual separation
 */
function MultiSentenceFormat({ sentences, color }: { sentences: string[]; color: string }) {
  // Group sentences into logical pairs for better readability
  const pairs: string[][] = []
  for (let i = 0; i < sentences.length; i += 2) {
    if (i + 1 < sentences.length) {
      pairs.push([sentences[i], sentences[i + 1]])
    } else {
      pairs.push([sentences[i]])
    }
  }

  return (
    <div className="space-y-4">
      {pairs.map((pair, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.1 }}
          className={`
            pl-4 border-l-2 border-${color}-200 py-1
            hover:border-${color}-400 transition-colors
          `}
        >
          <p className="text-slate-700 leading-relaxed text-[15px]">
            {pair.join(' ')}
          </p>
        </motion.div>
      ))}
    </div>
  )
}

/**
 * OPTION 4: Two-Column Format (2-3 sentences)
 * Splits content into digestible sections with visual separation
 */
function TwoColumnFormat({ sentences, color }: { sentences: string[]; color: string }) {
  return (
    <div className="space-y-3">
      {sentences.map((sentence, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.1 }}
          className="flex items-start gap-3"
        >
          <div className={`
            flex items-center justify-center w-6 h-6 rounded-full
            bg-${color}-100 text-${color}-700 text-xs font-bold
            flex-shrink-0 mt-0.5
          `}>
            {idx + 1}
          </div>
          <p className="text-slate-700 leading-relaxed text-[15px] flex-1">
            {sentence}
          </p>
        </motion.div>
      ))}
    </div>
  )
}

/**
 * OPTION 5: Single Paragraph Format (1 sentence or short content)
 * Simple, clean single paragraph with nice typography
 */
function SingleParagraphFormat({ content }: { content: string }) {
  return (
    <p className="text-slate-700 leading-relaxed text-[15px]">
      {content}
    </p>
  )
}

/**
 * OPTION 6: Highlighted Keywords Format
 * Automatically highlights important keywords in the content
 */
function ContentTabsWithHighlights({ what, why, userAction }: ContentSectionProps) {
  const [activeTab, setActiveTab] = useState<'what' | 'why' | 'action'>('what')

  const tabs = [
    { id: 'what' as const, label: 'What', icon: Lightbulb, content: what, color: 'indigo' },
    { id: 'why' as const, label: 'Why', icon: Target, content: why, color: 'violet' },
    { id: 'action' as const, label: 'User Action', icon: MousePointerClick, content: userAction, color: 'emerald' }
  ]

  const activeConfig = tabs.find(t => t.id === activeTab)!

  // Keywords to highlight
  const keywords = [
    'users', 'can', 'enables', 'provides', 'allows', 'helps',
    'click', 'select', 'choose', 'view', 'access', 'navigate',
    'important', 'key', 'critical', 'essential', 'primary'
  ]

  const highlightKeywords = (text: string) => {
    const words = text.split(' ')
    return words.map((word, idx) => {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:]/, '')
      const isKeyword = keywords.includes(cleanWord)
      
      if (isKeyword) {
        return (
          <span key={idx} className={`font-semibold text-${activeConfig.color}-700`}>
            {word}{' '}
          </span>
        )
      }
      return word + ' '
    })
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm">
      {/* Tab navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/50">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3
                text-sm font-medium transition-all relative
                ${isActive 
                  ? `text-${tab.color}-700 bg-white` 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }
              `}
            >
              <Icon className={`h-4 w-4 ${isActive ? `text-${tab.color}-600` : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-6 lg:p-8"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              bg-${activeConfig.color}-100
            `}>
              <activeConfig.icon className={`h-5 w-5 text-${activeConfig.color}-600`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold text-${activeConfig.color}-900 mb-1`}>
                {activeConfig.label}
              </h3>
              <p className="text-xs text-slate-500">
                {activeConfig.id === 'what' && 'Feature explanation'}
                {activeConfig.id === 'why' && 'Purpose & value'}
                {activeConfig.id === 'action' && 'How to use it'}
              </p>
            </div>
          </div>
          
          <p className="text-slate-700 leading-relaxed text-[15px]">
            {highlightKeywords(activeConfig.content)}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * OPTION 7: Progressive Reveal Format
 * Shows content with a nice fade-in animation, sentence by sentence
 */
function ContentTabsProgressiveReveal({ what, why, userAction }: ContentSectionProps) {
  const [activeTab, setActiveTab] = useState<'what' | 'why' | 'action'>('what')

  const tabs = [
    { id: 'what' as const, label: 'What', icon: Lightbulb, content: what, color: 'indigo' },
    { id: 'why' as const, label: 'Why', icon: Target, content: why, color: 'violet' },
    { id: 'action' as const, label: 'User Action', icon: MousePointerClick, content: userAction, color: 'emerald' }
  ]

  const activeConfig = tabs.find(t => t.id === activeTab)!
  const sentences = activeConfig.content.split(/(?<=[.!?])\s+/).filter(s => s.trim())

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm">
      {/* Tab navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/50">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3
                text-sm font-medium transition-all relative
                ${isActive 
                  ? `text-${tab.color}-700 bg-white` 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }
              `}
            >
              <Icon className={`h-4 w-4 ${isActive ? `text-${tab.color}-600` : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content with progressive reveal */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-6 lg:p-8"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              bg-${activeConfig.color}-100
            `}>
              <activeConfig.icon className={`h-5 w-5 text-${activeConfig.color}-600`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold text-${activeConfig.color}-900 mb-1`}>
                {activeConfig.label}
              </h3>
              <p className="text-xs text-slate-500">
                {activeConfig.id === 'what' && 'Feature explanation'}
                {activeConfig.id === 'why' && 'Purpose & value'}
                {activeConfig.id === 'action' && 'How to use it'}
              </p>
            </div>
          </div>
          
          {/* Progressive reveal of sentences */}
          <div className="space-y-3">
            {sentences.map((sentence, idx) => (
              <motion.p
                key={`${activeTab}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.15 }}
                className="text-slate-700 leading-relaxed text-[15px]"
              >
                {sentence}
              </motion.p>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * OPTION 8: Callout Box Format
 * Wraps important sentences in styled callout boxes
 */
function ContentTabsWithCallouts({ what, why, userAction }: ContentSectionProps) {
  const [activeTab, setActiveTab] = useState<'what' | 'why' | 'action'>('what')

  const tabs = [
    { id: 'what' as const, label: 'What', icon: Lightbulb, content: what, color: 'indigo' },
    { id: 'why' as const, label: 'Why', icon: Target, content: why, color: 'violet' },
    { id: 'action' as const, label: 'User Action', icon: MousePointerClick, content: userAction, color: 'emerald' }
  ]

  const activeConfig = tabs.find(t => t.id === activeTab)!
  const sentences = activeConfig.content.split(/(?<=[.!?])\s+/).filter(s => s.trim())

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm">
      {/* Tab navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/50">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3
                text-sm font-medium transition-all relative
                ${isActive 
                  ? `text-${tab.color}-700 bg-white` 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }
              `}
            >
              <Icon className={`h-4 w-4 ${isActive ? `text-${tab.color}-600` : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content with callout boxes */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-6 lg:p-8"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              bg-${activeConfig.color}-100
            `}>
              <activeConfig.icon className={`h-5 w-5 text-${activeConfig.color}-600`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold text-${activeConfig.color}-900 mb-1`}>
                {activeConfig.label}
              </h3>
              <p className="text-xs text-slate-500">
                {activeConfig.id === 'what' && 'Feature explanation'}
                {activeConfig.id === 'why' && 'Purpose & value'}
                {activeConfig.id === 'action' && 'How to use it'}
              </p>
            </div>
          </div>
          
          {/* Callout boxes for each sentence */}
          <div className="space-y-3">
            {sentences.map((sentence, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className={`
                  p-4 rounded-lg border-l-4
                  border-${activeConfig.color}-400 bg-${activeConfig.color}-50/50
                `}
              >
                <p className="text-slate-700 leading-relaxed text-[15px]">
                  {sentence}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}


function ContentTabs({ what, why, userAction }: ContentSectionProps) {
  const [activeTab, setActiveTab] = useState<'what' | 'why' | 'action'>('what')

  const tabs = [
    { id: 'what' as const, label: 'What', icon: Lightbulb, content: what, color: 'indigo' },
    { id: 'why' as const, label: 'Why', icon: Target, content: why, color: 'violet' },
    { id: 'action' as const, label: 'User Action', icon: MousePointerClick, content: userAction, color: 'emerald' }
  ]

  const activeConfig = tabs.find(t => t.id === activeTab)!

  return (
    <div className="border border-indigo-200 rounded-xl overflow-hidden bg-white/40 backdrop-blur-md">
      {/* Tab navigation */}
      <div className="flex border-b border-indigo-200 bg-indigo-200/50">
        {tabs.map((tab, index) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isLast = index === tabs.length - 1
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3
                text-sm font-medium transition-all relative  
                ${isActive 
                  ? `text-${tab.color}-700 bg-white` 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }
                ${!isLast ? 'border-r border-indigo-300/50' : ''}
              `}
            >
              <Icon className={`h-4 w-4 ${isActive ? `text-${tab.color}-600` : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-6 lg:p-8"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              bg-${activeConfig.color}-100
            `}>
              <activeConfig.icon className={`h-5 w-5 text-${activeConfig.color}-600`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold text-${activeConfig.color}-900 mb-1`}>
                {activeConfig.label}
              </h3>
              <p className="text-xs text-slate-500">
                {activeConfig.id === 'what' && 'Feature explanation'}
                {activeConfig.id === 'why' && 'Purpose & value'}
                {activeConfig.id === 'action' && 'How to use it'}
              </p>
            </div>
          </div>
          
          <p className="text-slate-700 leading-relaxed text-[15px]">
            {activeConfig.content}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ======================== ALTERNATIVE: ACCORDION LAYOUT ======================== */

/**
 * Accordion layout for progressive disclosure
 * Users can expand only what they need to read
 */
function ContentAccordion({ what, why, userAction }: ContentSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['what'])) // Start with 'what' open

  const toggleSection = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const sections = [
    { id: 'what', title: 'What', content: what, icon: Lightbulb, color: 'indigo' },
    { id: 'why', title: 'Why', content: why, icon: Target, color: 'violet' },
    { id: 'action', title: 'User Action', content: userAction, icon: MousePointerClick, color: 'emerald' }
  ]

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const Icon = section.icon
        const isExpanded = expanded.has(section.id)
        
        return (
          <div
            key={section.id}
            className={`
              border rounded-xl overflow-hidden transition-all
              ${isExpanded 
                ? `border-${section.color}-200 bg-${section.color}-50/50` 
                : 'border-slate-200 bg-white/50 hover:bg-slate-50/50'
              }
            `}
          >
            {/* Accordion header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className={`
                  flex items-center justify-center w-9 h-9 rounded-lg transition-colors
                  ${isExpanded ? `bg-${section.color}-100` : 'bg-slate-100 group-hover:bg-slate-200'}
                `}>
                  <Icon className={`h-5 w-5 ${isExpanded ? `text-${section.color}-600` : 'text-slate-500'}`} />
                </div>
                <h3 className={`
                  text-base font-semibold transition-colors
                  ${isExpanded ? `text-${section.color}-900` : 'text-slate-700 group-hover:text-slate-900'}
                `}>
                  {section.title}
                </h3>
              </div>
              
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className={`h-5 w-5 ${isExpanded ? `text-${section.color}-600` : 'text-slate-400'}`} />
              </motion.div>
            </button>

            {/* Accordion content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-0">
                    <div className={`pl-12 border-l-2 border-${section.color}-200`}>
                      <p className="text-slate-700 leading-relaxed text-[15px]">
                        {section.content}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/* ======================== ALTERNATIVE: TIMELINE LAYOUT ======================== */

import { ChevronDown, Circle } from 'lucide-react'

/**
 * Timeline/flow layout that emphasizes the progression from What → Why → Action
 * Great for showing the logical flow of understanding a feature
 */
function ContentTimeline({ what, why, userAction }: ContentSectionProps) {
  const steps = [
    { 
      id: 'what', 
      title: 'Understanding', 
      subtitle: 'What is this feature?',
      content: what, 
      icon: Lightbulb, 
      color: 'indigo',
      number: '1'
    },
    { 
      id: 'why', 
      title: 'Value', 
      subtitle: 'Why does it matter?',
      content: why, 
      icon: Target, 
      color: 'violet',
      number: '2'
    },
    { 
      id: 'action', 
      title: 'Interaction', 
      subtitle: 'How to use it',
      content: userAction, 
      icon: MousePointerClick, 
      color: 'emerald',
      number: '3'
    }
  ]

  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute left-[31px] top-[60px] bottom-[60px] w-0.5 bg-gradient-to-b from-indigo-200 via-violet-200 to-emerald-200" />
      
      <div className="space-y-6">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isLast = idx === steps.length - 1
          
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="relative"
            >
              <div className="flex items-start gap-5">
                {/* Timeline node */}
                <div className="relative flex-shrink-0">
                  <div className={`
                    w-[60px] h-[60px] rounded-full flex items-center justify-center
                    bg-gradient-to-br from-${step.color}-400 to-${step.color}-600
                    shadow-lg shadow-${step.color}-500/30
                    relative z-10
                  `}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  {/* Step number badge */}
                  <div className={`
                    absolute -top-1 -right-1 w-6 h-6 rounded-full
                    bg-white border-2 border-${step.color}-400
                    flex items-center justify-center text-xs font-bold
                    text-${step.color}-700 z-20
                  `}>
                    {step.number}
                  </div>
                </div>

                {/* Content card */}
                <div className="flex-1 pt-1">
                  <div className={`
                    border-2 rounded-xl p-5 lg:p-6
                    border-${step.color}-200 bg-${step.color}-50/50
                    backdrop-blur-sm
                  `}>
                    <div className="mb-3">
                      <h3 className={`text-xl font-bold text-${step.color}-900 mb-1`}>
                        {step.title}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {step.subtitle}
                      </p>
                    </div>
                    
                    <p className="text-slate-700 leading-relaxed text-[15px]">
                      {step.content}
                    </p>
                  </div>
                </div>
              </div>

              {/* Arrow connector between steps */}
              {!isLast && (
                <div className="flex justify-center my-2">
                  <ArrowRight className="h-5 w-5 text-slate-300 ml-[31px]" style={{ transform: 'rotate(90deg)' }} />
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ======================== EXPORTS ======================== */

export { 
  ContentBlock,           // Enhanced individual block
  ContentSection,         // 3-column grid layout
  ContentTabs,           // Tabbed interface
  ContentAccordion,      // Expandable accordion
  ContentTimeline,        // Visual timeline/flow
  ContentTabsAutoFormat,        // DEFAULT - Smart auto-detection
  ContentTabsWithHighlights,    // Highlights keywords
  ContentTabsProgressiveReveal, // Animated sentence reveal
  ContentTabsWithCallouts,      // Each sentence in callout box
}

export type { ContentBlockProps, ContentSectionProps }