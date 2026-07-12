/**
 * Seed comprehensive argumentation schemes with full field population
 * Based on ArgumentSchemeTypeExamples.md
 * 
 * This script seeds schemes with:
 * - All Macagno taxonomy fields
 * - Formal premise-conclusion structures with variables
 * - Critical questions with proper attack types
 * - Phase 6D clustering (parent-child relationships)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CQData = {
  cqKey: string;
  text: string;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope: "conclusion" | "inference" | "premise";
};

type PremiseData = {
  id: string;
  type: "major" | "minor";
  text: string;
  variables: string[];
};

type SchemeData = {
  key: string;
  name: string;
  summary: string;
  description: string;
  purpose: string | null;
  source: string | null;
  materialRelation: string | null;
  reasoningType: string | null;
  ruleForm: string | null;
  conclusionType: string | null;
  premises: PremiseData[];
  conclusion: {
    text: string;
    variables: string[];
  } | null;
  cqs: CQData[];
  parentSchemeKey?: string; // Used to link after creation
  clusterTag: string | null;
  inheritCQs: boolean;
};

const schemes: SchemeData[] = [
  // 1. Argument from Witness Testimony (root scheme)
  {
    key: "witness_testimony",
    name: "Argument from Witness Testimony",
    summary: "Reasoning based on direct observation by someone present at an event",
    description: "A witness is someone who was present at an event and can report what happened based on direct observation. This scheme evaluates testimony credibility through questions about reliability, bias, and corroboration.",
    purpose: "state_of_affairs",
    source: "external",
    materialRelation: "authority",
    reasoningType: "inductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "Witness W was in a position to observe whether event E occurred.",
        variables: ["W", "E"]
      },
      {
        id: "P2",
        type: "minor",
        text: "W asserts that E occurred (or did not occur).",
        variables: ["W", "E"]
      }
    ],
    conclusion: {
      text: "Therefore, E occurred (or did not occur).",
      variables: ["E"]
    },
    cqs: [
      {
        cqKey: "witness_consistent?",
        text: "Is W internally consistent in the testimony?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "witness_honest?",
        text: "Is W an honest person?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "witness_biased?",
        text: "Is W biased?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "testimony_corroborated_witnesses?",
        text: "Is the testimony corroborated by other witnesses?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "testimony_corroborated_evidence?",
        text: "Is the testimony corroborated by evidence?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "testimony_credible?",
        text: "Is W's testimony credible?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      }
    ],
    clusterTag: "authority_family",
    inheritCQs: true
  },

  // 2. Argument from Popular Opinion (root scheme)
  {
    key: "popular_opinion",
    name: "Argument from Popular Opinion",
    summary: "Appeals to what most people believe or accept as true",
    description: "This scheme appeals to what most people believe or accept as true. It creates a presumption based on widespread acceptance, but remains defeasible when evidence or reasoning undermines the popular belief.",
    purpose: "state_of_affairs",
    source: "external",
    materialRelation: "authority",
    reasoningType: "inductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "A is generally accepted as true (by most people, or in a particular community).",
        variables: ["A"]
      },
      {
        id: "P2",
        type: "minor",
        text: "(Implicit: What most people accept is presumed to be true.)",
        variables: []
      }
    ],
    conclusion: {
      text: "Therefore, there is a presumption that A is true.",
      variables: ["A"]
    },
    cqs: [
      {
        cqKey: "acceptance_evidence?",
        text: "What evidence supports the claim that A is generally accepted?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "group_representative?",
        text: "Is the group cited representative of the relevant population?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "alternative_opinions?",
        text: "Are there other groups whose opinion differs from the cited group?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      },
      {
        cqKey: "basis_for_acceptance?",
        text: "What is the basis for the popular acceptance of A?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "domain_appropriate_opinion?",
        text: "Is this a domain where popular opinion is a reliable indicator of truth?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      }
    ],
    clusterTag: "authority_family",
    inheritCQs: true
  },

  // 3. Argument from Popular Practice (child of Popular Opinion)
  {
    key: "popular_practice",
    name: "Argument from Popular Practice",
    summary: "Because most people do something, it is acceptable or should be done",
    description: "This scheme argues that because most people do something, it is acceptable or should be done. Unlike popular opinion (about beliefs), this concerns popular practice (about actions).",
    purpose: "action",
    source: "external",
    materialRelation: "practical",
    reasoningType: "practical",
    ruleForm: "defeasible_MP",
    conclusionType: "ought",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "If a large majority (everyone, nearly everyone) does X, then there is a presumption that X is the right (acceptable, approved) thing to do.",
        variables: ["X"]
      },
      {
        id: "P2",
        type: "minor",
        text: "A large majority (everyone, nearly everyone) does X.",
        variables: ["X"]
      }
    ],
    conclusion: {
      text: "Therefore, there is a presumption that X is the right (acceptable, approved) thing to do.",
      variables: ["X"]
    },
    cqs: [
      {
        cqKey: "practice_evidence?",
        text: "What evidence supports the claim that most people do X?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "practitioners_representative?",
        text: "Are the people who do X representative?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "majority_wrong?",
        text: "Is there some reason why the majority might be wrong to do X?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      },
      {
        cqKey: "domain_appropriate_practice?",
        text: "Is this a domain where popular practice is a reliable guide to proper action?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "ethical_violation?",
        text: "Does the practice of the majority violate ethical standards?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      }
    ],
    parentSchemeKey: "popular_opinion", // Will be linked after creation
    clusterTag: "authority_family",
    inheritCQs: true
  },

  // 4. Argument from Example (root scheme)
  {
    key: "argument_from_example",
    name: "Argument from Example",
    summary: "Reasons from a particular case to a general rule, then applies it to a new case",
    description: "This scheme reasons from a particular case to a general rule, then applies that rule to justify a conclusion about another particular case. It combines inductive generalization with deductive application.",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "analogy",
    reasoningType: "inductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "In this particular case C, individual a has property F and also property G.",
        variables: ["C", "a", "F", "G"]
      },
      {
        id: "P2",
        type: "minor",
        text: "Therefore, generally, if x has property F, then x also has property G.",
        variables: ["x", "F", "G"]
      },
      {
        id: "P3",
        type: "minor",
        text: "(Applying the generalization to a new case) Individual b has property F.",
        variables: ["b", "F"]
      }
    ],
    conclusion: {
      text: "Therefore, b also has property G.",
      variables: ["b", "G"]
    },
    cqs: [
      {
        cqKey: "example_representative?",
        text: "Is the example cited representative of the population?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "counterexamples?",
        text: "Are there other relevant examples that would support a different conclusion?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      },
      {
        cqKey: "sample_size?",
        text: "Is the number of examples sufficient to support the generalization?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "relevant_differences?",
        text: "Are there relevant differences between the cited example and the case to which the conclusion is being applied?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "causal_link?",
        text: "Is the property F genuinely causally or evidentially connected to property G?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      }
    ],
    clusterTag: "similarity_family",
    inheritCQs: true
  },

  // 5. Argument from Composition (root scheme)
  {
    key: "argument_from_composition",
    name: "Argument from Composition",
    summary: "Infers properties of a whole from properties of its parts",
    description: "This scheme infers properties of a whole from properties of its parts. It's defeasible because not all properties transfer from parts to wholes (e.g., each part being lightweight doesn't make the whole lightweight).",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "definition",
    reasoningType: "deductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "The parts (or members) of the whole W all have property F.",
        variables: ["W", "F"]
      },
      {
        id: "P2",
        type: "minor",
        text: "(Implicit: What is true of the parts is true of the whole.)",
        variables: []
      }
    ],
    conclusion: {
      text: "Therefore, the whole W has property F.",
      variables: ["W", "F"]
    },
    cqs: [
      {
        cqKey: "all_parts_have_property?",
        text: "Do all the parts really have property F?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "property_transfers?",
        text: "Is F the kind of property that transfers from parts to wholes?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "emergent_properties?",
        text: "Are there emergent properties of the whole that differ from the parts?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      },
      {
        cqKey: "other_factors?",
        text: "Is the composition of the parts the only relevant factor for F in the whole?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "structural_organization?",
        text: "Are the parts organized in a way that affects whether F applies to the whole?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      }
    ],
    clusterTag: "definition_family",
    inheritCQs: true
  },

  // 6. Argument from Division (sibling of Composition)
  {
    key: "argument_from_division",
    name: "Argument from Division",
    summary: "Infers properties of parts from properties of the whole",
    description: "This scheme infers properties of parts from properties of the whole (the inverse of composition). Like composition, it's defeasible because not all properties distribute from wholes to parts.",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "definition",
    reasoningType: "deductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "The whole W has property F.",
        variables: ["W", "F"]
      },
      {
        id: "P2",
        type: "minor",
        text: "(Implicit: What is true of the whole is true of its parts.)",
        variables: []
      }
    ],
    conclusion: {
      text: "Therefore, the parts (or members) of W have property F.",
      variables: ["W", "F"]
    },
    cqs: [
      {
        cqKey: "whole_has_property?",
        text: "Does the whole really have property F?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "property_distributes?",
        text: "Is F the kind of property that transfers from wholes to parts?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "non_distributive?",
        text: "Are there properties of the whole that do not distribute to the parts?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "all_parts?",
        text: "Do all parts have F, or only some?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      },
      {
        cqKey: "exceptions?",
        text: "Are there specific parts that are exceptions?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      }
    ],
    clusterTag: "definition_family",
    inheritCQs: true
  },

  // 7. Argument from Verbal Classification (root scheme)
  {
    key: "verbal_classification",
    name: "Argument from Verbal Classification",
    summary: "Classifies an individual under a category term, then applies category knowledge",
    description: "This scheme classifies an individual case under a general category term, then applies what is known about the category to the individual case. Central to definitional reasoning and taxonomy-based argument.",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "definition",
    reasoningType: "deductive",
    ruleForm: "MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "For all x, if x has property F, then x can be classified as having property G.",
        variables: ["x", "F", "G"]
      },
      {
        id: "P2",
        type: "minor",
        text: "Individual a has property F.",
        variables: ["a", "F"]
      }
    ],
    conclusion: {
      text: "Therefore, a has property G.",
      variables: ["a", "G"]
    },
    cqs: [
      {
        cqKey: "has_property?",
        text: "Does a definitely have property F, or is there room for doubt?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "classification_acceptable?",
        text: "Is the verbal classification in the major premise acceptable?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "exceptional_circumstances?",
        text: "Are there exceptional circumstances in this case that would prevent the classification from holding?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      },
      {
        cqKey: "boundary_clear?",
        text: "Is the boundary of the classification category clear?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "alternative_classifications?",
        text: "Are there alternative classifications that might apply?",
        attackType: "REBUTS",
        targetScope: "conclusion"
      }
    ],
    clusterTag: "definition_family",
    inheritCQs: true
  },

  // 8. Argument from Definition to Verbal Classification (child of Verbal Classification)
  {
    key: "definition_to_classification",
    name: "Argument from Definition to Verbal Classification",
    summary: "Uses an established definition to justify classifying something under a term",
    description: "This scheme uses an established definition to justify classifying something under a term. It makes the definitional basis explicit, distinguishing stipulative, lexical, and precising definitions.",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "definition",
    reasoningType: "deductive",
    ruleForm: "MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "By definition, G means having properties F₁, F₂, ... Fₙ.",
        variables: ["G", "F₁", "F₂", "Fₙ"]
      },
      {
        id: "P2",
        type: "minor",
        text: "Individual a has properties F₁, F₂, ... Fₙ.",
        variables: ["a", "F₁", "F₂", "Fₙ"]
      }
    ],
    conclusion: {
      text: "Therefore, a is (can be classified as) G.",
      variables: ["a", "G"]
    },
    cqs: [
      {
        cqKey: "has_defining_properties?",
        text: "Does a really have all the properties F₁, F₂, ... Fₙ listed?",
        attackType: "UNDERMINES",
        targetScope: "premise"
      },
      {
        cqKey: "definition_acceptable?",
        text: "Is the definition of G acceptable and authoritative?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "definition_type?",
        text: "Is the definition stipulative, lexical, or precising?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "properties_sufficient?",
        text: "Are the defining properties F₁, F₂, ... Fₙ sufficient for G?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "properties_necessary?",
        text: "Are the defining properties necessary for G?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      },
      {
        cqKey: "context_appropriate?",
        text: "Is the context one where this definition appropriately applies?",
        attackType: "UNDERCUTS",
        targetScope: "inference"
      }
    ],
    parentSchemeKey: "verbal_classification", // Will be linked after creation
    clusterTag: "definition_family",
    inheritCQs: true
  }
];

async function main() {
  console.log("🌱 Starting comprehensive scheme seeding...\n");

  // Track created schemes for parent linking
  const createdSchemes: Record<string, string> = {};

  for (const schemeData of schemes) {
    try {
      console.log(`📝 Creating scheme: ${schemeData.name} (${schemeData.key})`);

      // Find parent scheme ID if parentSchemeKey is specified
      let parentConnection: { connect: { id: string } } | undefined;
      if (schemeData.parentSchemeKey) {
        const parentId = createdSchemes[schemeData.parentSchemeKey];
        if (!parentId) {
          console.log(`⚠️  Parent scheme "${schemeData.parentSchemeKey}" not found yet, will create as root`);
        } else {
          console.log(`   🔗 Linking to parent: ${schemeData.parentSchemeKey}`);
          parentConnection = { connect: { id: parentId } };
        }
      }

      const scheme = await prisma.argumentScheme.create({
        data: {
          key: schemeData.key,
          name: schemeData.name,
          summary: schemeData.summary,
          description: schemeData.description,
          purpose: schemeData.purpose,
          source: schemeData.source,
          materialRelation: schemeData.materialRelation,
          reasoningType: schemeData.reasoningType,
          ruleForm: schemeData.ruleForm,
          conclusionType: schemeData.conclusionType,
          premises: schemeData.premises as any,
          conclusion: schemeData.conclusion as any,
          clusterTag: schemeData.clusterTag,
          inheritCQs: schemeData.inheritCQs,
          parentScheme: parentConnection as any,
          cq: schemeData.cqs as any, // Store CQs in JSON field
        },
      });

      // Store for parent linking
      createdSchemes[schemeData.key] = scheme.id;

      // Create CriticalQuestion records (needed for CQ seeding in arguments)
      if (schemeData.cqs.length > 0) {
        await prisma.criticalQuestion.createMany({
          data: schemeData.cqs.map((cq) => ({
            schemeId: scheme.id,
            cqKey: cq.cqKey,
            text: cq.text,
            attackKind: cq.attackType,
            status: "open",
            attackType: cq.attackType,
            targetScope: cq.targetScope,
          })) as any,
          skipDuplicates: true,
        });
        console.log(`   🔍 Created ${schemeData.cqs.length} CriticalQuestion records`);
      }

      console.log(`   ✅ Created scheme with ${schemeData.cqs.length} CQs (JSON + table records)`);
      console.log(`   📊 Taxonomy: ${schemeData.materialRelation} | ${schemeData.reasoningType}`);
      console.log(`   🏷️  Cluster: ${schemeData.clusterTag || "none"}`);
      console.log(`   📐 Structure: ${schemeData.premises.length} premises, ${schemeData.conclusion ? "1" : "0"} conclusion`);
      console.log("");
    } catch (error) {
      console.error(`❌ Error creating scheme ${schemeData.key}:`, error);
    }
  }

  console.log("✨ Seeding complete!\n");
  console.log("📈 Summary:");
  console.log(`   • Total schemes: ${schemes.length}`);
  console.log(`   • Root schemes: ${schemes.filter(s => !s.parentSchemeKey).length}`);
  console.log(`   • Child schemes: ${schemes.filter(s => s.parentSchemeKey).length}`);
  console.log(`   • Total CQs: ${schemes.reduce((sum, s) => sum + s.cqs.length, 0)}`);
  console.log("\n🎯 Next step: Visit /admin/schemes to see your comprehensive schemes!");
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
