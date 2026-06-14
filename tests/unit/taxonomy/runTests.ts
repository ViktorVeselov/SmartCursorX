import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { taxonomyService } from '../../../electron/services/taxonomy/TaxonomyService';
import { TaxonomyClassifier } from '../../../electron/services/taxonomy/TaxonomyClassifier';
import { dbService } from '../../../electron/db';

// Simple assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function run() {
  console.log('--- STARTING TAXONOMY ENGINE TESTS ---');

  // Setup: Copy JSON files from source service folder to current folder if they don't exist
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const srcDir = path.resolve(currentDir, '../../../electron/services/taxonomy');
  for (const file of ['taxonomyTree.json', 'crossAxisRules.json']) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(currentDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
    } else {
      console.warn(`⚠️ Warning: Source taxonomy JSON file not found at ${srcFile}`);
    }
  }

  // Mock dbService to avoid hitting the actual database during local tests
  const runQueries: any[] = [];
  const dbMock = {
    prepare: (query: string) => {
      return {
        run: (...args: any[]) => {
          runQueries.push({ query, args });
          return { changes: 1 };
        }
      };
    }
  };
  (dbService as any).db = dbMock;

  // Test 1: Initialization & Tree Integrity
  try {
    taxonomyService.initialize();
    console.log('✅ Taxonomy tree successfully loaded and validated for integrity.');
  } catch (e) {
    console.error('❌ Failed to initialize taxonomy service:', e);
    process.exit(1);
  }

  // Test 2: Complexity Gate
  const trivialTask = { title: "Rename user", description: "simple rename" };
  const shouldActivateTrivial = TaxonomyClassifier.shouldActivateTaxonomy(trivialTask);
  assert(!shouldActivateTrivial, "Trivial task should not activate taxonomy");

  const longTrivialTask = { title: "Format the sql query with indentation", description: "make it look nice" };
  const shouldActivateLongTrivial = TaxonomyClassifier.shouldActivateTaxonomy(longTrivialTask);
  assert(!shouldActivateLongTrivial, "Long task with trivial keywords ('format') should not activate taxonomy");

  const complexTask = {
    title: "Implement robust postgres database connection pool with automatic retry and failover management for the backend API",
    description: "Create a pool that manages postgres database operations, handles transaction isolation, and optimizes high throughput under concurrent requests in the backend server API."
  };
  const shouldActivateComplex = TaxonomyClassifier.shouldActivateTaxonomy(complexTask);
  assert(shouldActivateComplex, "Complex task should activate taxonomy");

  // Test 3: Classification logic
  const mockPlan = {
    steps: ["Setup pool", "Handle concurrency", "Add metrics"],
    filesToModify: ["src/db/connection.ts", "package.json"]
  };

  const result = taxonomyService.classify(
    complexTask,
    'execution',
    mockPlan,
    'Analyzing db transaction load and pool size config.',
    { 'src/db/connection.ts': 'import pg from "pg"; const client = new pg.Client();' },
    ['pg', 'better-sqlite3']
  );

  assert(!result.skippedReason, "Complex task classification should not be skipped");
  assert(result.classification.activatedAxes > 0, "At least one axis should be activated");

  // Verify domain classification descended to SQL/database node
  const domainPath = result.classification.domain;
  assert(domainPath !== null, "Domain axis should be resolved");
  if (domainPath) {
    console.log(`Resolved Domain: ${domainPath.nodeIds.join(' -> ')} (Confidence: ${domainPath.confidence})`);
    assert(domainPath.nodeIds.includes('backend'), "Resolved domain should descend to backend");
    assert(domainPath.nodeIds.includes('backend.database.relational.postgresql'), "Resolved domain should descend to postgresql");
  }

  // Test 4: Hierarchical Fragment Inheritance
  const domainGuidanceSlot = result.resolvedSlots.get('domain_guidance');
  assert(!!domainGuidanceSlot, "domain_guidance slot should be resolved and populated");
  
  // Verify that the postgresql path inherited the relational-transactions fragment defined at the parent relational node level
  assert(result.activeFragmentIds.includes('relational-transactions'), "postgresql path should inherit relational-transactions from parent");
  assert(domainGuidanceSlot!.includes('Proper transactional bounds in RDBMS'), "domain_guidance slot should contain inherited parent transaction rules");
  console.log('✅ Hierarchical Fragment Inheritance validated successfully.');

  // Test 5: Soft-Threshold Cross-Referencing
  // Let's add a crossReference programmatically to relational-transactions to test soft cross-referencing
  // We will cross-reference 'backend.database.keyvalue.redis' from 'relational-transactions'
  const parentNode = (taxonomyService as any).taxonomyTree.domain.children[0].children[0].children[0]; // backend.database.relational
  const txFragment = parentNode.fragments['execution'][0]; // relational-transactions
  txFragment.crossReferences = ['backend.database.keyvalue.redis'];
  // Re-classify the task with triggers that will score redis around 0.4 (meeting soft-threshold 0.3, but not primary 0.6)
  // Let's inject redis keyword in agent thoughts
  const resultWithCrossRef = taxonomyService.classify(
    complexTask,
    'execution',
    mockPlan,
    'Analyzing db transaction load. Using Redis for caching transaction state.',
    { 'src/db/connection.ts': 'import pg from "pg";' },
    ['pg']
  );

  // Assert that redis is NOT the primary domain node (which is postgresql) but is injected as a supporting cross-reference
  const primaryDomain = resultWithCrossRef.classification.domain;
  console.log('primaryDomain resolved path:', primaryDomain ? primaryDomain.nodeIds.join(' -> ') : 'null');
  
  const rootNode = (taxonomyService as any).taxonomyTree.domain;
  const dbNode = rootNode.children[0].children[0]; // backend.database
  const signals = TaxonomyClassifier.gatherSignals(
    complexTask,
    mockPlan,
    'Analyzing db transaction load. Using Redis for caching transaction state.',
    { 'src/db/connection.ts': 'import pg from "pg";' },
    ['pg']
  );
  for (const child of dbNode.children) {
    const score = TaxonomyClassifier.scoreNode(child, signals, undefined, 3);
    console.log(`Node ${child.id} Score: ${score}`);
  }

  assert(primaryDomain !== null && primaryDomain.nodeIds.includes('backend.database.relational.postgresql'), "Primary domain should remain postgresql");
  assert(resultWithCrossRef.activeFragmentIds.includes('cache-ttl-stampede'), "Redis cache fragment should be resolved as a supporting cross-reference");
  
  const guidanceWithCrossRef = resultWithCrossRef.resolvedSlots.get('domain_guidance');
  assert(guidanceWithCrossRef!.includes('Supporting Cross-Domain Guidance'), "guidance should contain Supporting Cross-Domain Guidance section");
  assert(guidanceWithCrossRef!.includes('cache-ttl-stampede') || guidanceWithCrossRef!.includes('Provide cache key TTL and stampede protection'), "guidance should contain cache TTL guidelines");
  
  // Clean up the programmatically mutated cross-references to keep singleton tree pristine
  txFragment.crossReferences = null;
  console.log('✅ Soft-Threshold Cross-Referencing validated successfully.');

  // Test 5a: Language-sensitive Code Pattern Filtering (Python)
  const pythonTask = {
    title: "Implement user authentication with rest api in python",
    description: "Write auth handlers for fastapi web framework"
  };
  const pythonPlan = {
    steps: ["Setup FastAPI app", "Add routes"],
    filesToModify: ["main.py"]
  };
  const pythonResult = taxonomyService.classify(
    pythonTask,
    'execution',
    pythonPlan,
    'FastAPI app dev.',
    { 'main.py': 'from fastapi import FastAPI\napp = FastAPI()' }
  );
  console.log('Python classification domain path:', pythonResult.classification.domain ? pythonResult.classification.domain.nodeIds.join(' -> ') : 'null');
  console.log('Python classification confidence:', pythonResult.classification.domain ? pythonResult.classification.domain.confidence : 0);
  const pythonGuidance = pythonResult.resolvedSlots.get('domain_guidance');
  console.log('--- Python Guidance Start ---');
  console.log(pythonGuidance);
  console.log('--- Python Guidance End ---');
  assert(!!pythonGuidance, "domain_guidance slot should be populated for Python REST task");
  assert(pythonGuidance!.includes('def increment_item(item_id: str):') || pythonGuidance!.includes('def update_item(item_id: str, delta: int):'), "Guidance should include Python-specific code patterns");
  assert(!pythonGuidance!.includes('app.get("/users/:id/activate", async (req, res) =>'), "Guidance should NOT include TS/JS code patterns when Python is detected");
  console.log('✅ Language-sensitive code pattern filtering (Python) validated successfully.');

  // Test 5b: Language-sensitive Code Pattern Filtering (Rust)
  const rustTask = {
    title: "Setup websocket client connection in backend API using rust",
    description: "use tokio-tungstenite for websocket connection"
  };
  const rustPlan = {
    steps: ["Connect socket", "Listen"],
    filesToModify: ["src/main.rs"]
  };
  const rustResult = taxonomyService.classify(
    rustTask,
    'execution',
    rustPlan,
    'Rust socket dev.',
    { 'src/main.rs': 'use std::net::TcpStream;\nfn main() {}' }
  );
  const rustGuidance = rustResult.resolvedSlots.get('domain_guidance');
  assert(!!rustGuidance, "domain_guidance slot should be populated for Rust WS task");
  assert(rustGuidance!.includes('async fn handle_socket(mut socket: WebSocket)'), "Guidance should include Rust-specific code patterns");
  assert(!rustGuidance!.includes('wss.on("connection", (ws) =>'), "Guidance should NOT include TS/JS code patterns when Rust is detected");
  console.log('✅ Language-sensitive code pattern filtering (Rust) validated successfully.');

  // Test 5c: Dynamic Contextualization Header
  const contextualizedGuidance = pythonResult.resolvedSlots.get('domain_guidance');
  assert(contextualizedGuidance!.includes('This task touches file(s): **main.py**'), "Guidance should include dynamic contextual note with filenames");
  console.log('✅ Dynamic Contextualization Header validated successfully.');

  // Test 6: Database Logging & Tracking
  taxonomyService.trackResult(101, result, 'planning');
  assert(runQueries.length > 0, "Should run db insert query to track result");
  const trackQuery = runQueries.find(q => q.query.includes('INSERT INTO task_taxonomy_tracking'));
  assert(!!trackQuery, "Should insert tracking data into database");
  assert(trackQuery.args[0] === 101, "First argument should be taskId 101");
  assert(trackQuery.args[1] === 'domain', "Second argument should be the taxonomy axis");

  console.log('--- ALL TAXONOMY ENGINE TESTS PASSED SUCCESSFULLY! ---');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
