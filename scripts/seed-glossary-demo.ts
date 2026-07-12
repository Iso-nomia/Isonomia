/**
 * Seed script for Glossary/DefinitionSheet demo
 * Creates sample terms, definitions, endorsements, and votes
 * 
 * Usage:
 *   tsx scripts/seed-glossary-demo.ts [deliberationId]
 * 
 * If no deliberationId provided, creates demo data in first available deliberation
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deliberationId = process.argv[2];

  // Find or use specified deliberation
  let targetDeliberation;
  if (deliberationId) {
    targetDeliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
    });
    if (!targetDeliberation) {
      throw new Error(`Deliberation ${deliberationId} not found`);
    }
  } else {
    targetDeliberation = await prisma.deliberation.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!targetDeliberation) {
      throw new Error("No deliberations found. Create a deliberation first.");
    }
  }

  console.log(`Seeding glossary for deliberation: ${targetDeliberation.id}`);

  // Get some users for demo (take first 5 users)
  const users = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  if (users.length < 2) {
    throw new Error("Need at least 2 users to create demo data");
  }

  console.log(`Using ${users.length} users for demo data`);

  // Sample terms with competing definitions
  const sampleTerms = [
    {
      name: "Justice",
      definitions: [
        {
          text: "The principle of fairness and equal treatment under law, ensuring that all individuals receive what they are due according to established rules and moral principles.",
          examples: "A fair trial, equal pay for equal work, redistributive taxation",
          author: users[0],
        },
        {
          text: "The recognition and protection of individual rights and liberties, with minimal interference from collective authority.",
          examples: "Free market transactions, voluntary associations, property rights protection",
          author: users[1],
        },
      ],
    },
    {
      name: "Freedom",
      definitions: [
        {
          text: "The ability to act according to one's will without external coercion or unjust restraint, constrained only by respect for others' equal freedom.",
          examples: "Freedom of speech, freedom of movement, freedom of association",
          author: users[0],
        },
        {
          text: "The absence of domination and arbitrary power, achieved through democratic participation and collective self-determination.",
          examples: "Worker cooperatives, participatory budgeting, democratic workplaces",
          author: users[2] || users[0],
        },
      ],
    },
    {
      name: "Equity",
      definitions: [
        {
          text: "Fairness achieved by providing different levels of support based on individual needs and circumstances to reach comparable outcomes.",
          examples: "Affirmative action, progressive taxation, targeted scholarships",
          author: users[1],
        },
      ],
    },
    {
      name: "Common Good",
      definitions: [
        {
          text: "The sum of conditions that allow individuals and groups to flourish and achieve their purposes within a just social order.",
          examples: "Public infrastructure, clean air and water, rule of law, public education",
          author: users[0],
        },
        {
          text: "The welfare of the collective that may require sacrifice of individual preferences for the benefit of the whole community.",
          examples: "Mandatory vaccination programs, eminent domain, progressive taxation",
          author: users[1],
        },
        {
          text: "The emergent outcome of free individuals pursuing their own interests in voluntary cooperation.",
          examples: "Market-driven innovation, voluntary charity, spontaneous order",
          author: users[2] || users[0],
        },
      ],
    },
    {
      name: "Autonomy",
      definitions: [
        {
          text: "The capacity for self-governance and independent decision-making, free from controlling interference by others.",
          examples: "Informed consent in medicine, freedom to choose one's career, personal lifestyle choices",
          author: users[0],
        },
      ],
    },
  ];

  // Create terms and definitions
  for (const termData of sampleTerms) {
    console.log(`Creating term: ${termData.name}`);

    const term = await prisma.glossaryTerm.create({
      data: {
        deliberationId: targetDeliberation.id,
        name: termData.name,
        proposedBy: termData.definitions[0].author.id,
        status: termData.definitions.length > 1 ? "CONTESTED" : "PROPOSED",
      },
    });

    // Create definitions
    for (let i = 0; i < termData.definitions.length; i++) {
      const defData = termData.definitions[i];
      
      const definition = await prisma.glossaryDefinition.create({
        data: {
          termId: term.id,
          text: defData.text,
          examples: defData.examples,
          authorId: defData.author.id,
          isCanonical: i === 0 && termData.definitions.length === 1, // First def is canonical if only one
        },
      });

      console.log(`  Created definition ${i + 1} by ${defData.author.id.slice(0, 8)}`);

      // Auto-endorse by author
      await prisma.glossaryEndorsement.create({
        data: {
          definitionId: definition.id,
          userId: defData.author.id,
        },
      });

      // Add endorsements from other users (simulate consensus building)
      const numEndorsements = Math.floor(Math.random() * (users.length - 1));
      for (let j = 0; j < numEndorsements; j++) {
        const randomUser = users[(j + 1) % users.length];
        if (randomUser.id !== defData.author.id) {
          try {
            await prisma.glossaryEndorsement.create({
              data: {
                definitionId: definition.id,
                userId: randomUser.id,
              },
            });
            console.log(`    Endorsement from ${randomUser.id.slice(0, 8)}`);
          } catch (e) {
            // Ignore duplicate endorsements
          }
        }
      }

      // Add some votes if there are competing definitions
      if (termData.definitions.length > 1) {
        for (const user of users.slice(0, 3)) {
          const voteValue = Math.random() > 0.5 ? 1 : -1;
          await prisma.glossaryDefinitionVote.upsert({
            where: {
              definitionId_userId: {
                definitionId: definition.id,
                userId: user.id,
              },
            },
            create: {
              definitionId: definition.id,
              userId: user.id,
              value: voteValue,
            },
            update: {
              value: voteValue,
            },
          });
          console.log(`    Vote (${voteValue > 0 ? "+" : ""}${voteValue}) from ${user.id.slice(0, 8)}`);
        }
      }
    }

    // Check if we should promote a definition to canonical based on endorsements
    const definitions = await prisma.glossaryDefinition.findMany({
      where: { termId: term.id },
      include: {
        _count: { select: { endorsements: true } },
      },
    });

    const totalParticipants = users.length;
    const threshold = Math.ceil(totalParticipants * 0.5);

    for (const def of definitions) {
      if (def._count.endorsements >= threshold && !def.isCanonical) {
        await prisma.glossaryDefinition.update({
          where: { id: def.id },
          data: { isCanonical: true },
        });

        await prisma.glossaryTerm.update({
          where: { id: term.id },
          data: { status: "CONSENSUS" },
        });

        console.log(`  Promoted definition to CONSENSUS (${def._count.endorsements}/${totalParticipants} endorsements)`);
        break;
      }
    }
  }

  console.log("\n✅ Glossary demo data seeded successfully!");
  console.log(`Deliberation ID: ${targetDeliberation.id}`);
  console.log(`Created ${sampleTerms.length} terms with competing definitions`);
  console.log("\nSample terms:");
  sampleTerms.forEach((t) => console.log(`  - ${t.name} (${t.definitions.length} definition${t.definitions.length > 1 ? "s" : ""})`));
}

main()
  .catch((e) => {
    console.error("Error seeding glossary data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
