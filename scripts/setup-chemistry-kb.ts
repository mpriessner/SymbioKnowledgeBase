#!/usr/bin/env tsx
/**
 * Setup the Chemistry KB page hierarchy for a tenant.
 *
 * Usage:
 *   npx tsx scripts/setup-chemistry-kb.ts --tenant <id>
 *   TENANT_ID=<id> npx tsx scripts/setup-chemistry-kb.ts
 */

import { setupChemistryKbHierarchy } from "../src/lib/chemistryKb/setupHierarchy";

async function main() {
  const args = process.argv.slice(2);

  let tenantId = process.env.TENANT_ID || "";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--tenant":
        tenantId = args[++i] || "";
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!tenantId) {
    console.error("Error: tenantId is required.");
    console.error("Usage: npx tsx scripts/setup-chemistry-kb.ts --tenant <id>");
    console.error("   or: TENANT_ID=<id> npx tsx scripts/setup-chemistry-kb.ts");
    process.exit(1);
  }

  console.log(`Setting up Chemistry KB hierarchy for tenant: ${tenantId}`);

  const result = await setupChemistryKbHierarchy(tenantId);

  console.log("\nResults:");
  console.log(`  Root page:           ${result.rootId}`);
  console.log(`  Index page:          ${result.indexId}`);
  console.log(`  Experiments page:    ${result.experimentsId}`);
  console.log(`  Reaction Types page: ${result.reactionTypesId}`);
  console.log(`  Chemicals page:      ${result.chemicalsId}`);
  console.log(`  Researchers page:    ${result.researchersId}`);
  console.log(`  Substrate Classes:   ${result.substrateClassesId}`);
  console.log("\nDone.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
