// tests/aif-import-assumptions.test.ts
import { importAifJSONLD } from "@/packages/aif-core/src/import";
import { prisma } from "@/lib/prismaclient";

// Mock Prisma
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    claim: {
      create: jest.fn(),
    },
    argument: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    argumentPremise: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    argumentEdge: {
      create: jest.fn(),
    },
    assumptionUse: {
      create: jest.fn(),
    },
  },
}));

describe("AIF Import - AssumptionUse (Gap 4 Fix)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock claim creation to return sequential IDs
    let claimIdCounter = 1;
    (prisma.claim.create as jest.Mock).mockImplementation(() =>
      Promise.resolve({ id: `claim-${claimIdCounter++}` })
    );
    
    // Mock argument creation
    let argIdCounter = 1;
    (prisma.argument.create as jest.Mock).mockImplementation(() =>
      Promise.resolve({ id: `arg-${argIdCounter++}` })
    );
    (prisma.argument.findFirst as jest.Mock).mockResolvedValue(null);
    
    // Mock createMany
    (prisma.argumentPremise.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it("should import HasPresumption edges as AssumptionUse records", async () => {
    const graph = {
      nodes: [
        { "@id": "I:1", "@type": "aif:InformationNode", text: "Birds fly" },
        { "@id": "I:2", "@type": "aif:InformationNode", text: "Tweety is a bird" },
        { "@id": "I:3", "@type": "aif:InformationNode", text: "Tweety flies" },
        { "@id": "S:1", "@type": "aif:RA" },
        { "@id": "I:4", "@type": "aif:InformationNode", text: "Flying is typical" },
      ],
      edges: [
        { from: "I:1", to: "S:1", role: "aif:Premise" },
        { from: "I:2", to: "S:1", role: "aif:Premise" },
        { from: "S:1", to: "I:3", role: "aif:Conclusion" },
        { from: "I:4", to: "S:1", role: "as:HasPresumption" }, // Presumption edge
      ],
    };

    await importAifJSONLD("delib-1", graph);

    // Verify AssumptionUse was created
    expect(prisma.assumptionUse.create).toHaveBeenCalledWith({
      data: {
        deliberationId: "delib-1",
        argumentId: "arg-1", // First RA argument
        assumptionClaimId: "claim-4", // I:4 claim
        role: "premise", // HasPresumption → premise role
      },
    });
  });

  it("should import HasException edges with exception role", async () => {
    const graph = {
      nodes: [
        { "@id": "I:1", "@type": "aif:InformationNode", text: "Tweety is a penguin" },
        { "@id": "I:2", "@type": "aif:InformationNode", text: "Tweety does not fly" },
        { "@id": "S:1", "@type": "aif:RA" },
        { "@id": "I:3", "@type": "aif:InformationNode", text: "Penguins are exceptions" },
      ],
      edges: [
        { from: "I:1", to: "S:1", role: "aif:Premise" },
        { from: "S:1", to: "I:2", role: "aif:Conclusion" },
        { from: "I:3", to: "S:1", role: "as:HasException" }, // Exception edge
      ],
    };

    await importAifJSONLD("delib-2", graph);

    expect(prisma.assumptionUse.create).toHaveBeenCalledWith({
      data: {
        deliberationId: "delib-2",
        argumentId: "arg-1",
        assumptionClaimId: "claim-3", // I:3 claim
        role: "exception", // HasException → exception role
      },
    });
  });

  it("should import multiple assumptions for the same argument", async () => {
    const graph = {
      nodes: [
        { "@id": "I:1", "@type": "aif:InformationNode", text: "Expert says X" },
        { "@id": "I:2", "@type": "aif:InformationNode", text: "X is true" },
        { "@id": "S:1", "@type": "aif:RA" },
        { "@id": "I:3", "@type": "aif:InformationNode", text: "Expert is reliable" },
        { "@id": "I:4", "@type": "aif:InformationNode", text: "Expert is unbiased" },
      ],
      edges: [
        { from: "I:1", to: "S:1", role: "aif:Premise" },
        { from: "S:1", to: "I:2", role: "aif:Conclusion" },
        { from: "I:3", to: "S:1", role: "as:HasPresumption" },
        { from: "I:4", to: "S:1", role: "as:HasPresumption" },
      ],
    };

    await importAifJSONLD("delib-3", graph);

    // Verify both assumptions were created
    expect(prisma.assumptionUse.create).toHaveBeenCalledTimes(2);
    expect(prisma.assumptionUse.create).toHaveBeenNthCalledWith(1, {
      data: {
        deliberationId: "delib-3",
        argumentId: "arg-1",
        assumptionClaimId: "claim-3",
        role: "premise",
      },
    });
    expect(prisma.assumptionUse.create).toHaveBeenNthCalledWith(2, {
      data: {
        deliberationId: "delib-3",
        argumentId: "arg-1",
        assumptionClaimId: "claim-4",
        role: "premise",
      },
    });
  });

  it("should skip presumption edges if RA or I-node not found", async () => {
    const graph = {
      nodes: [
        { "@id": "I:1", "@type": "aif:InformationNode", text: "Claim" },
      ],
      edges: [
        { from: "I:1", to: "S:99", role: "as:HasPresumption" }, // S:99 doesn't exist
      ],
    };

    await importAifJSONLD("delib-4", graph);

    // Should not create AssumptionUse for missing nodes
    expect(prisma.assumptionUse.create).not.toHaveBeenCalled();
  });

  it("should handle graphs with no presumption edges", async () => {
    const graph = {
      nodes: [
        { "@id": "I:1", "@type": "aif:InformationNode", text: "P" },
        { "@id": "I:2", "@type": "aif:InformationNode", text: "Q" },
        { "@id": "S:1", "@type": "aif:RA" },
      ],
      edges: [
        { from: "I:1", to: "S:1", role: "aif:Premise" },
        { from: "S:1", to: "I:2", role: "aif:Conclusion" },
      ],
    };

    await importAifJSONLD("delib-5", graph);

    // Should not attempt to create AssumptionUse
    expect(prisma.assumptionUse.create).not.toHaveBeenCalled();
  });
});
