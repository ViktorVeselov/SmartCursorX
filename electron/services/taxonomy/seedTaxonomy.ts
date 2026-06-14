import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TaxonomyNode, ExpertFragment, OperationalContext } from './types';

// Absolute paths
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const treePath = path.join(currentDir, 'taxonomyTree.json');

// Define database lists and triggers programmatically
const RELATIONAL_DBS = [
  { id: 'postgresql', label: 'PostgreSQL', keywords: ['postgresql', 'postgres', 'pg', 'pgpool', 'pgbouncer'], symbols: ['Pool', 'Client', 'PgClient'], imports: ['pg', 'pg-pool', 'postgres'] },
  { id: 'mysql', label: 'MySQL', keywords: ['mysql', 'mariadb', 'myisam', 'innodb'], symbols: ['Connection', 'Pool', 'MysqlClient'], imports: ['mysql', 'mysql2', 'mysql2/promise'] },
  { id: 'sqlite', label: 'SQLite', keywords: ['sqlite', 'sqlite3', 'better-sqlite3', 'libsql'], symbols: ['Database', 'Statement'], imports: ['sqlite3', 'better-sqlite3', 'sqlite', 'libsql'] },
  { id: 'oracle', label: 'Oracle Database', keywords: ['oracle', 'oracledb', 'plsql'], symbols: ['Connection', 'OracleClient'], imports: ['oracledb'] },
  { id: 'mssql', label: 'Microsoft SQL Server', keywords: ['mssql', 'sqlserver', 'tsql'], symbols: ['ConnectionPool', 'Request'], imports: ['mssql', 'tedious'] },
  { id: 'mariadb', label: 'MariaDB', keywords: ['mariadb'], symbols: ['Pool', 'Connection'], imports: ['mariadb'] },
  { id: 'cockroachdb', label: 'CockroachDB', keywords: ['cockroach', 'cockroachdb', 'crdb'], symbols: ['Pool', 'Client'], imports: ['pg'] },
  { id: 'spanner', label: 'Google Cloud Spanner', keywords: ['spanner', 'cloudspanner'], symbols: ['Spanner', 'Database'], imports: ['@google-cloud/spanner'] },
  { id: 'yugabyte', label: 'YugabyteDB', keywords: ['yugabyte', 'yugabytedb', 'ycql', 'ysql'], symbols: ['Client', 'Cluster'], imports: ['pg', 'cassandra-driver'] },
  { id: 'tidb', label: 'TiDB', keywords: ['tidb'], symbols: ['Connection', 'Pool'], imports: ['mysql2'] },
  { id: 'singlestore', label: 'SingleStore (memsql)', keywords: ['singlestore', 'memsql'], symbols: ['Connection', 'Pool'], imports: ['mysql2'] },
  { id: 'db2', label: 'IBM DB2', keywords: ['db2', 'ibmdb2'], symbols: ['Database', 'Connection'], imports: ['ibm_db'] },
  { id: 'firebird', label: 'Firebird', keywords: ['firebird', 'firebirdsql'], symbols: ['Connection', 'Database'], imports: ['node-firebird'] },
  { id: 'h2', label: 'H2 Database', keywords: ['h2', 'h2database'], symbols: ['Connection', 'Jdbc'], imports: [] },
  { id: 'derby', label: 'Apache Derby', keywords: ['derby', 'apachederby'], symbols: [], imports: [] },
  { id: 'informix', label: 'Informix', keywords: ['informix'], symbols: [], imports: [] },
  { id: 'ingres', label: 'Ingres', keywords: ['ingres', 'actian'], symbols: [], imports: [] },
  { id: 'saphana', label: 'SAP HANA', keywords: ['saphana', 'hana'], symbols: ['Connection'], imports: ['@sap/hana-client'] },
  { id: 'aurora-pg', label: 'AWS Aurora PostgreSQL', keywords: ['aurora', 'rds', 'aws-sdk'], symbols: ['RDSDataService'], imports: ['@aws-sdk/client-rds-data'] },
  { id: 'aurora-mysql', label: 'AWS Aurora MySQL', keywords: ['aurora', 'rds', 'aws-sdk'], symbols: ['RDSDataService'], imports: ['@aws-sdk/client-rds-data'] },
  { id: 'cloudsql-pg', label: 'Google Cloud SQL PostgreSQL', keywords: ['cloudsql', 'gcp'], symbols: [], imports: [] },
  { id: 'cloudsql-mysql', label: 'Google Cloud SQL MySQL', keywords: ['cloudsql', 'gcp'], symbols: [], imports: [] },
  { id: 'cloudsql-mssql', label: 'Google Cloud SQL SQL Server', keywords: ['cloudsql', 'gcp'], symbols: [], imports: [] },
  { id: 'azuresql', label: 'Azure SQL Database', keywords: ['azuresql', 'azure'], symbols: [], imports: [] },
  { id: 'azure-pg', label: 'Azure Database for PostgreSQL', keywords: ['azure', 'postgres'], symbols: [], imports: [] },
  { id: 'azure-mysql', label: 'Azure Database for MySQL', keywords: ['azure', 'mysql'], symbols: [], imports: [] },
  { id: 'percona-mysql', label: 'Percona Server for MySQL', keywords: ['percona'], symbols: [], imports: [] },
  { id: 'percona-mongo', label: 'Percona Server for MongoDB', keywords: ['percona'], symbols: [], imports: [] },
  { id: 'teradata', label: 'Teradata', keywords: ['teradata'], symbols: [], imports: [] },
  { id: 'sybase', label: 'Sybase ASE', keywords: ['sybase', 'ase'], symbols: [], imports: [] },
  { id: 'virtuoso', label: 'Virtuoso', keywords: ['virtuoso'], symbols: [], imports: [] },
  { id: 'nuodb', label: 'NuoDB', keywords: ['nuodb'], symbols: [], imports: [] },
  { id: 'hive', label: 'Apache Hive', keywords: ['hive', 'hive2'], symbols: ['HiveClient'], imports: ['thrift-hive'] },
  { id: 'impala', label: 'Cloudera Impala', keywords: ['impala'], symbols: [], imports: [] },
  { id: 'greenplum', label: 'Greenplum', keywords: ['greenplum'], symbols: [], imports: [] },
  { id: 'hsqldb', label: 'HSQLDB', keywords: ['hsqldb'], symbols: [], imports: [] },
  { id: 'presto', label: 'Presto', keywords: ['presto', 'prestodb'], symbols: ['PrestoClient'], imports: ['presto-client'] },
  { id: 'trino', label: 'Trino', keywords: ['trino'], symbols: ['TrinoClient'], imports: ['trino-client-node'] },
  { id: 'vertica', label: 'Vertica', keywords: ['vertica'], symbols: ['VerticaClient'], imports: ['vertica'] },
  { id: 'sqlite-cloud', label: 'SQLite Cloud', keywords: ['sqlitecloud'], symbols: ['SQLiteCloud'], imports: ['@sqlitecloud/sdk'] },
  { id: 'libsql', label: 'Libsql (Turso)', keywords: ['libsql', 'turso'], symbols: ['LibsqlClient', 'createClient'], imports: ['@libsql/client'] },
  { id: 'duckdb', label: 'DuckDB', keywords: ['duckdb'], symbols: ['Database', 'Connection'], imports: ['duckdb'] },
  { id: 'oceanbase', label: 'OceanBase', keywords: ['oceanbase'], symbols: [], imports: [] },
  { id: 'voltdb', label: 'VoltDB', keywords: ['voltdb'], symbols: [], imports: [] }
];

const DOCUMENT_DBS = [
  { id: 'mongodb', label: 'MongoDB', keywords: ['mongodb', 'mongo', 'mongoose'], symbols: ['MongoClient', 'Schema', 'Model'], imports: ['mongodb', 'mongoose'] },
  { id: 'couchdb', label: 'Apache CouchDB', keywords: ['couchdb', 'nano'], symbols: ['Nano'], imports: ['nano'] },
  { id: 'documentdb', label: 'AWS DocumentDB', keywords: ['documentdb', 'mongodb'], symbols: ['MongoClient'], imports: ['mongodb'] },
  { id: 'cosmosdb', label: 'Azure Cosmos DB', keywords: ['cosmosdb', 'cosmos'], symbols: ['CosmosClient', 'Container'], imports: ['@azure/cosmos'] },
  { id: 'faunadb', label: 'FaunaDB', keywords: ['fauna', 'faunadb', 'fql'], symbols: ['FaunaClient', 'Client'], imports: ['faunadb'] },
  { id: 'firestore', label: 'Firebase Firestore', keywords: ['firestore', 'firebase'], symbols: ['Firestore', 'CollectionReference'], imports: ['firebase/firestore', '@google-cloud/firestore'] },
  { id: 'rethinkdb', label: 'RethinkDB', keywords: ['rethinkdb', 'rethink'], symbols: ['RethinkConnection'], imports: ['rethinkdb', 'rethinkdbdash'] },
  { id: 'arangodb', label: 'ArangoDB', keywords: ['arangodb', 'arangojs', 'aql'], symbols: ['Database', 'ArangoJS'], imports: ['arangojs'] },
  { id: 'orientdb', label: 'OrientDB', keywords: ['orientdb'], symbols: ['OrientDB'], imports: ['orientjs'] },
  { id: 'ravendb', label: 'RavenDB', keywords: ['ravendb'], symbols: ['DocumentStore'], imports: ['ravendb'] },
  { id: 'couchbase', label: 'Couchbase', keywords: ['couchbase', 'n1ql'], symbols: ['Cluster', 'Bucket'], imports: ['couchbase'] },
  { id: 'pouchdb', label: 'PouchDB', keywords: ['pouchdb'], symbols: ['PouchDB'], imports: ['pouchdb', 'pouchdb-node'] },
  { id: 'marklogic', label: 'MarkLogic', keywords: ['marklogic'], symbols: ['DatabaseClient'], imports: ['marklogic'] },
  { id: 'basex', label: 'BaseX', keywords: ['basex'], symbols: [], imports: [] },
  { id: 'existdb', label: 'eXist-db', keywords: ['existdb'], symbols: [], imports: [] },
  { id: 'jackrabbit', label: 'Apache Jackrabbit', keywords: ['jackrabbit'], symbols: [], imports: [] },
  { id: 'cloudant', label: 'IBM Cloudant', keywords: ['cloudant'], symbols: ['Cloudant'], imports: ['@ibm-cloud/cloudant'] },
  { id: 'supabase-jsonb', label: 'Supabase JSONB', keywords: ['supabase', 'postgrest'], symbols: [], imports: [] },
  { id: 'nedb', label: 'NeDB', keywords: ['nedb'], symbols: ['Datastore'], imports: ['nedb'] },
  { id: 'gundb', label: 'GunDB', keywords: ['gundb', 'gun'], symbols: ['Gun'], imports: ['gun'] },
  { id: 'rxdb', label: 'RxDB', keywords: ['rxdb'], symbols: ['RxDatabase'], imports: ['rxdb'] },
  { id: 'lovefield', label: 'Lovefield', keywords: ['lovefield'], symbols: [], imports: [] },
  { id: 'ejdb', label: 'EJDB', keywords: ['ejdb'], symbols: [], imports: [] },
  { id: 'lowdb', label: 'Lowdb', keywords: ['lowdb'], symbols: ['Low'], imports: ['lowdb'] },
  { id: 'minimongo', label: 'Minimongo', keywords: ['minimongo'], symbols: [], imports: [] }
];

const KEYVALUE_DBS = [
  { id: 'redis', label: 'Redis', keywords: ['redis', 'ioredis'], symbols: ['Redis', 'RedisClient'], imports: ['redis', 'ioredis'] },
  { id: 'memcached', label: 'Memcached', keywords: ['memcached', 'memcache'], symbols: ['Memcached'], imports: ['memcached', 'memcache'] },
  { id: 'dynamodb', label: 'AWS DynamoDB', keywords: ['dynamodb', 'dynamo'], symbols: ['DynamoDB', 'DynamoDBClient'], imports: ['@aws-sdk/client-dynamodb', 'aws-sdk'] },
  { id: 'keydb', label: 'KeyDB', keywords: ['keydb'], symbols: [], imports: ['ioredis', 'redis'] },
  { id: 'dragonfly', label: 'Dragonfly', keywords: ['dragonfly'], symbols: [], imports: ['ioredis', 'redis'] },
  { id: 'aerospike', label: 'Aerospike', keywords: ['aerospike'], symbols: ['AerospikeClient'], imports: ['aerospike'] },
  { id: 'riak', label: 'Riak KV', keywords: ['riak'], symbols: ['RiakClient'], imports: ['basho-riak-client'] },
  { id: 'rocksdb', label: 'RocksDB', keywords: ['rocksdb'], symbols: ['RocksDB'], imports: ['rocksdb', 'leveldown'] },
  { id: 'leveldb', label: 'LevelDB', keywords: ['leveldb', 'levelup', 'leveldown'], symbols: ['LevelUP'], imports: ['levelup', 'leveldown', 'level'] },
  { id: 'boltdb', label: 'BoltDB', keywords: ['boltdb', 'bolt'], symbols: [], imports: [] },
  { id: 'badgerdb', label: 'BadgerDB', keywords: ['badger', 'badgerdb'], symbols: [], imports: [] },
  { id: 'lmdb', label: 'LMDB', keywords: ['lmdb', 'lightningdb'], symbols: ['Env', 'Database'], imports: ['lmdb', 'node-lmdb'] },
  { id: 'hazelcast', label: 'Hazelcast', keywords: ['hazelcast'], symbols: ['Client'], imports: ['hazelcast-client'] },
  { id: 'geode', label: 'Apache Geode', keywords: ['geode', 'gemfire'], symbols: [], imports: [] },
  { id: 'coherence', label: 'Oracle Coherence', keywords: ['coherence'], symbols: [], imports: [] },
  { id: 'ehcache', label: 'Ehcache', keywords: ['ehcache'], symbols: [], imports: [] },
  { id: 'infinispan', label: 'Infinispan', keywords: ['infinispan'], symbols: [], imports: [] },
  { id: 'couchbase-memcached', label: 'Couchbase Memcached', keywords: ['couchbase'], symbols: [], imports: [] },
  { id: 'tile38', label: 'Tile38', keywords: ['tile38'], symbols: ['Tile38'], imports: ['tile38'] },
  { id: 'tarantool', label: 'Tarantool', keywords: ['tarantool'], symbols: ['Tarantool'], imports: ['tarantool-driver'] },
  { id: 'tikv', label: 'TiKV', keywords: ['tikv'], symbols: ['TiKVClient'], imports: [] },
  { id: 'etcd', label: 'Etcd', keywords: ['etcd'], symbols: ['Etcd3', 'Etcd'], imports: ['etcd3'] },
  { id: 'consul-kv', label: 'Consul KV', keywords: ['consul'], symbols: ['Consul'], imports: ['consul'] },
  { id: 'voldemort', label: 'Voldemort', keywords: ['voldemort'], symbols: [], imports: [] },
  { id: 'berkeleydb', label: 'BerkeleyDB', keywords: ['berkeleydb', 'bdb'], symbols: [], imports: [] }
];

const WIDECOLUMN_DBS = [
  { id: 'cassandra', label: 'Apache Cassandra', keywords: ['cassandra', 'cql', 'cqlsh'], symbols: ['Client', 'DseClient'], imports: ['cassandra-driver'] },
  { id: 'scylladb', label: 'ScyllaDB', keywords: ['scylladb', 'scylla'], symbols: ['Client'], imports: ['cassandra-driver'] },
  { id: 'hbase', label: 'Apache HBase', keywords: ['hbase'], symbols: ['HBaseClient'], imports: ['hbase'] },
  { id: 'accumulo', label: 'Apache Accumulo', keywords: ['accumulo'], symbols: [], imports: [] },
  { id: 'bigtable', label: 'Google Cloud Bigtable', keywords: ['bigtable'], symbols: ['Bigtable'], imports: ['@google-cloud/bigtable'] },
  { id: 'keyspaces', label: 'AWS Keyspaces', keywords: ['keyspaces', 'cassandra'], symbols: ['Client'], imports: ['cassandra-driver'] },
  { id: 'cosmos-cassandra', label: 'Azure Cosmos DB Cassandra', keywords: ['cosmos', 'cassandra'], symbols: ['Client'], imports: ['cassandra-driver'] },
  { id: 'hypertable', label: 'Hypertable', keywords: ['hypertable'], symbols: [], imports: [] },
  { id: 'maprdb', label: 'MapR-DB', keywords: ['maprdb', 'mapr'], symbols: [], imports: [] },
  { id: 'scylladb-cloud', label: 'ScyllaDB Cloud', keywords: ['scylla', 'scylladb'], symbols: [], imports: [] },
  { id: 'cassandra-enterprise', label: 'Cassandra Enterprise (DSE)', keywords: ['dse'], symbols: ['DseClient'], imports: ['cassandra-driver'] },
  { id: 'elassandra', label: 'Elassandra', keywords: ['elassandra'], symbols: [], imports: [] },
  { id: 'yugabyte-ycql', label: 'YugabyteDB YCQL', keywords: ['yugabyte', 'ycql'], symbols: [], imports: ['cassandra-driver'] },
  { id: 'cockroach-widecolumn', label: 'CockroachDB Wide-column', keywords: ['cockroach'], symbols: [], imports: [] },
  { id: 'splicemachine', label: 'Splice Machine', keywords: ['splicemachine'], symbols: [], imports: [] }
];

const COLUMNAR_DBS = [
  { id: 'clickhouse', label: 'ClickHouse', keywords: ['clickhouse', 'ch'], symbols: ['ClickHouseClient', 'createClient'], imports: ['@clickhouse/client'] },
  { id: 'snowflake', label: 'Snowflake', keywords: ['snowflake', 'snowsql'], symbols: ['Connection'], imports: ['snowflake-sdk'] },
  { id: 'bigquery', label: 'Google BigQuery', keywords: ['bigquery', 'bq'], symbols: ['BigQuery'], imports: ['@google-cloud/bigquery'] },
  { id: 'redshift', label: 'AWS Redshift', keywords: ['redshift'], symbols: ['Redshift'], imports: ['pg'] },
  { id: 'athena', label: 'AWS Athena', keywords: ['athena'], symbols: ['AthenaExpress', 'AthenaClient'], imports: ['athena-express', '@aws-sdk/client-athena'] },
  { id: 'druid', label: 'Apache Druid', keywords: ['druid'], symbols: [], imports: ['druid-client'] },
  { id: 'pinot', label: 'Apache Pinot', keywords: ['pinot'], symbols: ['PinotClient'], imports: ['pinot-client'] },
  { id: 'duckdb-olap', label: 'DuckDB OLAP', keywords: ['duckdb'], symbols: ['Database'], imports: ['duckdb'] },
  { id: 'monetdb', label: 'MonetDB', keywords: ['monetdb'], symbols: [], imports: [] },
  { id: 'vertica-olap', label: 'Vertica OLAP', keywords: ['vertica'], symbols: [], imports: [] },
  { id: 'teradata-vantage', label: 'Teradata Vantage', keywords: ['teradata'], symbols: [], imports: [] },
  { id: 'greenplum-olap', label: 'Greenplum Database', keywords: ['greenplum'], symbols: [], imports: [] },
  { id: 'clickhouse-cloud', label: 'ClickHouse Cloud', keywords: ['clickhouse'], symbols: [], imports: [] },
  { id: 'databricks-sql', label: 'Databricks SQL', keywords: ['databricks'], symbols: ['DatabricksConnection'], imports: ['@databricks/databricks-sdk'] },
  { id: 'synapse', label: 'Azure Synapse Analytics', keywords: ['synapse', 'azure'], symbols: [], imports: [] },
  { id: 'starrocks', label: 'StarRocks', keywords: ['starrocks'], symbols: [], imports: [] },
  { id: 'doris', label: 'Apache Doris', keywords: ['doris'], symbols: [], imports: [] },
  { id: 'matrixone', label: 'MatrixOne', keywords: ['matrixone'], symbols: [], imports: [] },
  { id: 'clickhouse-keeper', label: 'ClickHouse Keeper', keywords: ['clickhouse'], symbols: [], imports: [] },
  { id: 'vectorwise', label: 'Vectorwise', keywords: ['vectorwise'], symbols: [], imports: [] }
];

const TIMESERIES_DBS = [
  { id: 'timescaledb', label: 'TimescaleDB', keywords: ['timescaledb', 'timescale', 'hypertable'], symbols: [], imports: ['pg'] },
  { id: 'influxdb', label: 'InfluxDB', keywords: ['influxdb', 'influx', 'flux'], symbols: ['InfluxDB', 'Point'], imports: ['@influxdata/influxdb-client'] },
  { id: 'questdb', label: 'QuestDB', keywords: ['questdb'], symbols: ['Sender'], imports: ['@questdb/nodejs-client'] },
  { id: 'victoriametrics', label: 'VictoriaMetrics', keywords: ['victoriametrics'], symbols: [], imports: [] },
  { id: 'prometheus', label: 'Prometheus', keywords: ['prometheus', 'promql'], symbols: ['Registry', 'Counter', 'Gauge'], imports: ['prom-client'] },
  { id: 'graphite', label: 'Graphite', keywords: ['graphite'], symbols: [], imports: [] },
  { id: 'opentsdb', label: 'OpenTSDB', keywords: ['opentsdb'], symbols: [], imports: [] },
  { id: 'kdbplus', label: 'KDB+', keywords: ['kdb', 'q-language'], symbols: [], imports: [] },
  { id: 'tdengine', label: 'TDengine', keywords: ['tdengine'], symbols: ['Connection'], imports: ['@tdengine/client'] },
  { id: 'iotdb', label: 'Apache IoTDB', keywords: ['iotdb'], symbols: ['Session'], imports: [] },
  { id: 'timestream', label: 'AWS Timestream', keywords: ['timestream'], symbols: ['TimestreamWriteClient'], imports: ['@aws-sdk/client-timestream-write'] },
  { id: 'timeseries-insights', label: 'Azure Time Series Insights', keywords: ['timeseries', 'azure'], symbols: [], imports: [] },
  { id: 'influxdb-iox', label: 'InfluxDB IOx', keywords: ['iox', 'influxdb'], symbols: [], imports: [] },
  { id: 'druid-ts', label: 'Druid Time-Series', keywords: ['druid'], symbols: [], imports: [] },
  { id: 'timescale-cloud', label: 'Timescale Cloud', keywords: ['timescale'], symbols: [], imports: [] }
];

const SEARCH_DBS = [
  { id: 'opensearch', label: 'OpenSearch', keywords: ['opensearch'], symbols: ['Client'], imports: ['@opensearch-project/opensearch'] },
  { id: 'elasticsearch', label: 'Elasticsearch', keywords: ['elasticsearch', 'es'], symbols: ['Client'], imports: ['@elastic/elasticsearch'] },
  { id: 'solr', label: 'Apache Solr', keywords: ['solr'], symbols: ['Client'], imports: ['solr-client'] },
  { id: 'algolia', label: 'Algolia', keywords: ['algolia', 'algoliasearch'], symbols: ['SearchClient'], imports: ['algoliasearch'] },
  { id: 'meilisearch', label: 'Meilisearch', keywords: ['meilisearch'], symbols: ['MeiliSearch', 'MeiliSearchClient'], imports: ['meilisearch'] },
  { id: 'typesense', label: 'Typesense', keywords: ['typesense'], symbols: ['Client'], imports: ['typesense'] },
  { id: 'vespa', label: 'Vespa', keywords: ['vespa'], symbols: [], imports: [] },
  { id: 'sphinx', label: 'Sphinx Search', keywords: ['sphinx'], symbols: [], imports: ['limestone'] },
  { id: 'bleve', label: 'Bleve', keywords: ['bleve'], symbols: [], imports: [] },
  { id: 'manticore', label: 'Manticore Search', keywords: ['manticore'], symbols: [], imports: ['manticoresearch'] },
  { id: 'cloudsearch', label: 'AWS CloudSearch', keywords: ['cloudsearch'], symbols: ['CloudSearchDomainClient'], imports: ['@aws-sdk/client-cloudsearch-domain'] },
  { id: 'azure-search', label: 'Azure Cognitive Search', keywords: ['azure', 'search'], symbols: ['SearchClient'], imports: ['@azure/search-documents'] },
  { id: 'sonic', label: 'Sonic', keywords: ['sonic'], symbols: ['SonicChannel'], imports: ['sonic-channel'] },
  { id: 'whoosh', label: 'Whoosh', keywords: ['whoosh'], symbols: [], imports: [] },
  { id: 'quickwit', label: 'Quickwit', keywords: ['quickwit'], symbols: [], imports: [] }
];

const VECTOR_DBS = [
  { id: 'pinecone', label: 'Pinecone', keywords: ['pinecone'], symbols: ['Pinecone', 'PineconeClient'], imports: ['@pinecone-database/pinecone'] },
  { id: 'milvus', label: 'Milvus', keywords: ['milvus'], symbols: ['MilvusClient'], imports: ['@zilliz/milvus2-sdk-node'] },
  { id: 'qdrant', label: 'Qdrant', keywords: ['qdrant'], symbols: ['QdrantClient'], imports: ['@qdrant/js-client-rest'] },
  { id: 'weaviate', label: 'Weaviate', keywords: ['weaviate'], symbols: ['WeaviateClient'], imports: ['weaviate-ts-client', 'weaviate-client'] },
  { id: 'chroma', label: 'Chroma', keywords: ['chroma', 'chromadb'], symbols: ['ChromaClient'], imports: ['chromadb'] },
  { id: 'pgvector', label: 'pgvector', keywords: ['pgvector', 'vector'], symbols: [], imports: ['pgvector'] },
  { id: 'faiss', label: 'FAISS', keywords: ['faiss'], symbols: [], imports: [] },
  { id: 'vald', label: 'Vald', keywords: ['vald'], symbols: [], imports: [] },
  { id: 'lancedb', label: 'LanceDB', keywords: ['lancedb'], symbols: ['connect'], imports: ['vectordb'] },
  { id: 'milvus-lite', label: 'Milvus Lite', keywords: ['milvus'], symbols: [], imports: [] },
  { id: 'marqo', label: 'Marqo', keywords: ['marqo'], symbols: ['Client'], imports: ['marqo'] },
  { id: 'vespa-vector', label: 'Vespa Vector', keywords: ['vespa'], symbols: [], imports: [] },
  { id: 'opensearch-vector', label: 'AWS OpenSearch Vector', keywords: ['opensearch'], symbols: [], imports: [] },
  { id: 'elasticsearch-vector', label: 'Elasticsearch Vector', keywords: ['elasticsearch'], symbols: [], imports: [] },
  { id: 'redisvl', label: 'RedisVL', keywords: ['redisvl'], symbols: ['SearchIndex'], imports: [] }
];

// Helper to format generic database triggers programmatically
// Helper to deduplicate words triggers
const deduplicateWords = (words: { word: string; weight: number }[]) => {
  const seen = new Set<string>();
  return words.filter(w => {
    const lower = w.word.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
};

const deduplicateStrings = (arr: string[]) => {
  return [...new Set(arr.map(s => s.toLowerCase()))];
};

// Helper to format generic database triggers programmatically
function makeDbNode(db: typeof RELATIONAL_DBS[0], parentId: string): TaxonomyNode {
  return makeLeafNode(
    db.id,
    db.label,
    parentId,
    db.keywords,
    [`${db.label.toLowerCase()} database`, `${db.label.toLowerCase()} db`],
    db.imports,
    db.symbols,
    {
      chat: null,
      planning: null,
      taskCreation: null,
      investigation: null,
      execution: null,
      verification: null
    }
  );
}

function makeLeafNode(
  id: string,
  label: string,
  parentId: string,
  keywords: string[],
  phrases: string[],
  imports: string[],
  symbols: string[],
  fragments: Record<OperationalContext, ExpertFragment[] | null>
): TaxonomyNode {
  const words = deduplicateWords(keywords.map(kw => ({ word: kw, weight: 0.85 })));

  return {
    id: `${parentId}.${id}`,
    label,
    children: [],
    triggers: {
      words,
      phrases: phrases.map(p => ({ phrase: p, weight: 0.95 })),
      antiWords: [],
      importPatterns: [...new Set(imports.flatMap(imp => [`from '${imp}'`, `require('${imp}')`]))].map(s => s.toLowerCase()),
      filePatterns: [`**/${id}*`, `**/*${id}*`],
      symbolPatterns: [...new Set(symbols)].map(s => s.toLowerCase())
    },
    fragments,
    toolOverrides: []
  };
}

function buildDatabaseCategoryNode(
  id: string,
  label: string,
  dbs: Array<{ id: string; label: string; keywords: string[]; symbols: string[]; imports: string[] }>,
  categoryWords: Array<{ word: string; weight: number }>,
  executionFragments: ExpertFragment[]
): TaxonomyNode {
  return {
    id,
    label,
    children: dbs.map(db => makeDbNode(db, id)),
    triggers: {
      words: deduplicateWords([
        ...categoryWords,
        ...dbs.flatMap(db => db.keywords.map(kw => ({ word: kw, weight: 0.3 })))
      ]),
      phrases: [],
      antiWords: [],
      importPatterns: deduplicateStrings(dbs.flatMap(db => db.imports.flatMap(imp => [`from '${imp}'`, `require('${imp}')`]))),
      filePatterns: deduplicateStrings(dbs.flatMap(db => [`**/${db.id}*`, `**/*${db.id}*`])),
      symbolPatterns: deduplicateStrings(dbs.flatMap(db => db.symbols))
    },
    fragments: {
      chat: null,
      planning: null,
      taskCreation: null,
      investigation: null,
      execution: executionFragments.length > 0 ? executionFragments : null,
      verification: null
    },
    toolOverrides: []
  };
}

function createFragment(
  id: string,
  summary: string,
  coreGuidance: string,
  weight: 'critical' | 'principle' | 'awareness' = 'principle'
): ExpertFragment {
  return {
    id,
    summary,
    weight,
    trigger: 'always',
    defersToCodebase: true,
    coreGuidance,
    decisionTree: null,
    codePatterns: null,
    commonMistakes: null,
    selfVerification: null,
    outputConstraints: null,
    guardrails: null,
    scaffolding: null,
    crossReferences: null
  };
}

function createRichFragment(
  id: string,
  summary: string,
  coreGuidance: string,
  weight: 'critical' | 'principle' | 'awareness' = 'principle',
  opts?: {
    codePatterns?: any[];
    commonMistakes?: any[];
    selfVerification?: any[];
    guardrails?: any[];
    crossReferences?: string[];
  }
): ExpertFragment {
  return {
    id,
    summary,
    weight,
    trigger: 'always',
    defersToCodebase: true,
    coreGuidance,
    decisionTree: null,
    codePatterns: opts?.codePatterns || null,
    commonMistakes: opts?.commonMistakes || null,
    selfVerification: opts?.selfVerification || null,
    outputConstraints: null,
    guardrails: opts?.guardrails || null,
    scaffolding: null,
    crossReferences: opts?.crossReferences || null
  };
}

// -------------------------------------------------------------
// Phase 3 Extensions Node definitions
// -------------------------------------------------------------

// API
const apiNode: TaxonomyNode = {
  id: 'backend.api',
  label: 'API Design & Protocols',
  children: [
    makeLeafNode('rest', 'RESTful API', 'backend.api', ['rest', 'restful', 'http', 'endpoint', 'json'], ['rest api', 'http endpoint'], ['express', 'koa', 'fastify'], ['Router', 'Controller', 'get', 'post'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createRichFragment(
          'rest-semantics',
          'RESTful Semantics',
          'Enforce strict HTTP method semantics: GET (safe/idempotent), POST (non-idempotent), PUT (idempotent replace), PATCH (idempotent partial update), DELETE (idempotent). Ensure proper status codes (e.g., 201 Created, 400 Bad Request, 404 Not Found).',
          'critical',
          {
            codePatterns: [
              {
                concern: 'Idempotency and Safety of GET requests',
                wrong: {
                  language: 'typescript',
                  code: 'app.get("/users/:id/activate", async (req, res) => {\n  await db.updateUserStatus(req.params.id, "active");\n  res.json({ success: true });\n});',
                  explanation: 'GET requests must be safe and not cause state mutations.'
                },
                correct: {
                  language: 'typescript',
                  code: 'app.post("/users/:id/activate", async (req, res) => {\n  await db.updateUserStatus(req.params.id, "active");\n  res.status(200).json({ success: true });\n});',
                  explanation: 'State modification is mapped to a POST request.'
                },
                detectionHint: 'Database write or state update inside a GET controller'
              },
              {
                concern: 'Idempotent HTTP methods in Python',
                wrong: {
                  language: 'python',
                  code: '@app.get("/items/{item_id}/increment")\ndef increment_item(item_id: str):\n    db.increment(item_id)\n    return {"status": "ok"}',
                  explanation: 'Modifying data via a HTTP GET endpoint violates REST safety guidelines.'
                },
                correct: {
                  language: 'python',
                  code: '@app.patch("/items/{item_id}")\ndef update_item(item_id: str, delta: int):\n    db.update_item_qty(item_id, delta)\n    return {"status": "updated"}',
                  explanation: 'Use PATCH or POST for actions that update/modify resource state.'
                },
                detectionHint: 'GET method modifying database rows'
              },
              {
                concern: 'Restful status codes in Go',
                wrong: {
                  language: 'go',
                  code: 'func CreateUser(w http.ResponseWriter, r *http.Request) {\n    user := saveUser(r.Body)\n    w.WriteHeader(http.StatusOK)\n    json.NewEncoder(w).Encode(user)\n}',
                  explanation: 'Returning 200 OK for resource creation instead of 201 Created.'
                },
                correct: {
                  language: 'go',
                  code: 'func CreateUser(w http.ResponseWriter, r *http.Request) {\n    user := saveUser(r.Body)\n    w.WriteHeader(http.StatusCreated)\n    json.NewEncoder(w).Encode(user)\n}',
                  explanation: 'Use StatusCreated (201) when a resource is successfully created.'
                },
                detectionHint: 'Status OK (200) returned on create handlers'
              }
            ],
            commonMistakes: [
              {
                mistake: 'Using GET requests to delete resources',
                whyItHappens: 'Quick implementation without writing frontend forms or AJAX POST calls.',
                correction: 'Map deletion to HTTP DELETE or POST with a payload.',
                severity: 'security'
              }
            ],
            selfVerification: [
              {
                check: 'All GET requests are read-only',
                howToVerify: 'Verify that GET routes do not trigger save, update, or delete commands.',
                failureIndicator: 'GET route containing database write methods',
                remediation: 'Change the route method to POST, PUT, or PATCH.'
              }
            ],
            guardrails: [
              {
                rule: 'Never allow GET routes to modify database or file state.',
                rationale: 'Web crawlers, pre-fetching browsers, and caching proxies trigger GET requests automatically.',
                alternative: 'Use POST for general operations, and PATCH/PUT for specific resource updates.'
              }
            ]
          }
        ),
        createFragment('rest-pagination', 'Pagination Strategy', 'Prefer cursor-based pagination for large datasets to avoid offset drift and performance issues. Always include `next_cursor` in the response payload.')
      ]
    }),
    makeLeafNode('graphql', 'GraphQL', 'backend.api', ['graphql', 'gql', 'resolver', 'mutation', 'subscription'], ['graphql schema', 'apollo server'], ['graphql', 'apollo-server', '@nestjs/graphql'], ['Resolver', 'Query', 'Mutation'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createRichFragment(
          'graphql-n1',
          'N+1 Mitigation',
          'Always use Dataloaders for batching and caching field resolutions. Never perform inline database queries inside scalar field resolvers.',
          'critical',
          {
            codePatterns: [
              {
                concern: 'Inline queries causing N+1',
                wrong: {
                  language: 'typescript',
                  code: 'const resolvers = {\n  User: {\n    posts: async (user) => {\n      return await db.getPostsForUser(user.id);\n    }\n  }\n};',
                  explanation: 'Resolves posts individually for every user, issuing N queries for N users.'
                },
                correct: {
                  language: 'typescript',
                  code: 'const resolvers = {\n  User: {\n    posts: (user, args, context) => {\n      return context.loaders.postsLoader.load(user.id);\n    }\n  }\n};',
                  explanation: 'Batches and caches the post resolutions in a single database query.'
                },
                detectionHint: 'Database queries invoked inside type-specific sub-resolvers'
              },
              {
                concern: 'Python GraphQL batching',
                wrong: {
                  language: 'python',
                  code: 'class UserNode(DjangoObjectType):\n    def resolve_posts(self, info):\n        return Post.objects.filter(author=self)',
                  explanation: 'Triggers a separate SQL query for each author resolved in the list.'
                },
                correct: {
                  language: 'python',
                  code: 'class UserNode(DjangoObjectType):\n    def resolve_posts(self, info):\n        return info.context.loaders.posts_by_author.load(self.id)',
                  explanation: 'Loads author posts using a dataloader to batch relational queries.'
                },
                detectionHint: 'Django ORM query inside field resolver'
              }
            ],
            commonMistakes: [
              {
                mistake: 'Failing to instantiate DataLoader per-request',
                whyItHappens: 'Creating the DataLoader as a global singleton, causing users to see cached data of other users.',
                correction: 'Instantiate all DataLoaders inside the context builder function for every request.',
                severity: 'security'
              }
            ],
            selfVerification: [
              {
                check: 'DataLoader instance is request-scoped',
                howToVerify: 'Verify that loaders are created within the request context function, not in global module scope.',
                failureIndicator: 'new DataLoader() found in root module levels',
                remediation: 'Move DataLoader instantiation inside the express/apollo context callback.'
              }
            ]
          }
        ),
        createFragment('graphql-security', 'GraphQL Security', 'Enforce query depth limiting and complexity cost analysis to prevent malicious nested queries from causing DoS.')
      ]
    }),
    makeLeafNode('grpc', 'gRPC', 'backend.api', ['grpc', 'protobuf', 'rpc'], ['grpc channel', 'protocol buffers'], ['@grpc/grpc-js', 'google-protobuf'], ['ServerCredentials', 'loadPackageDefinition'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('grpc-versioning', 'Protobuf Versioning', 'Never rename or change the type of existing fields in Protobuf. Only add new fields with new tag numbers.')]
    }),
    makeLeafNode('websocket', 'WebSocket', 'backend.api', ['websocket', 'ws', 'socket.io', 'socketio'], ['web socket'], ['ws', 'socket.io'], ['Server', 'WebSocketServer', 'on', 'emit'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createRichFragment(
          'ws-lifecycle',
          'WebSocket Lifecycle',
          'Implement ping/pong heartbeats to detect stale connections. Handle disconnections gracefully with exponential backoff reconnections.',
          'critical',
          {
            codePatterns: [
              {
                concern: 'Stale connection leaks',
                wrong: {
                  language: 'typescript',
                  code: 'wss.on("connection", (ws) => {\n  console.log("connected");\n});',
                  explanation: 'Fails to detect silent disconnections, leading to socket leaks and dead subscriptions.'
                },
                correct: {
                  language: 'typescript',
                  code: 'wss.on("connection", (ws) => {\n  ws.isAlive = true;\n  ws.on("pong", () => { ws.isAlive = true; });\n});\nsetInterval(() => {\n  wss.clients.forEach((ws) => {\n    if (!ws.isAlive) return ws.terminate();\n    ws.isAlive = false;\n    ws.ping();\n  });\n}, 30000);',
                  explanation: 'Regularly pings clients and terminates dead sockets that fail to reply.'
                },
                detectionHint: 'WebSocket server connection without ping interval'
              },
              {
                concern: 'Rust connection management in Axum',
                wrong: {
                  language: 'rust',
                  code: 'async fn handle_socket(mut socket: WebSocket) {\n    while let Some(msg) = socket.recv().await {\n        // Process incoming\n    }\n}',
                  explanation: 'Infinite wait loop that fails to handle dead connection cleanups.'
                },
                correct: {
                  language: 'rust',
                  code: 'async fn handle_socket(mut socket: WebSocket) {\n    let mut interval = tokio::time::interval(Duration::from_secs(30));\n    loop {\n        tokio::select! {\n            Some(msg) = socket.recv() => { /* handle msg */ }\n            _ = interval.tick() => { socket.send(Message::Ping(vec![])).await.ok(); }\n        }\n    }\n}',
                  explanation: 'Sends standard WebSocket pings on interval ticks to maintain socket activity.'
                },
                detectionHint: 'Axum WebSocket handler missing Ping interval select loop'
              }
            ]
          }
        ),
        createFragment('ws-state', 'WebSocket State', 'Do not rely on the WebSocket connection for single source of truth state. Hydrate initial state via REST before opening the socket for deltas.')
      ]
    }),
    makeLeafNode('webhook', 'Webhook', 'backend.api', ['webhook', 'signature', 'hmac', 'callback'], ['webhook endpoint'], [], ['verifySignature'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('webhook-idempotency', 'Webhook Idempotency', 'Store webhook event IDs and verify idempotency before processing to handle duplicate deliveries safely.', 'critical')]
    })
  ],
  triggers: {
    words: [{ word: 'api', weight: 0.8 }, { word: 'endpoint', weight: 0.6 }],
    phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: []
  },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Architecture
const archNode: TaxonomyNode = {
  id: 'backend.architecture',
  label: 'Code Architecture',
  children: [
    makeLeafNode('dependency-injection', 'Dependency Injection', 'backend.architecture', ['di', 'ioc', 'inject', 'singleton', 'transient'], ['dependency injection', 'inversion of control'], ['inversify', 'tsyringe', '@nestjs/common'], ['Injectable', 'Container'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('di-lifecycle', 'DI Lifecycle', 'Be extremely careful with Singletons holding state. Prefer Transient or Request-scoped lifecycles for stateful dependencies.')]
    }),
    makeLeafNode('microservices', 'Microservices', 'backend.architecture', ['microservice', 'distributed', 'tracing'], ['distributed system'], ['@opentelemetry/api'], ['Tracer'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('ms-tracing', 'Distributed Tracing', 'Ensure trace context (e.g. W3C traceparent headers) is passed down via context when calling downstream microservices.')]
    }),
    makeLeafNode('cqrs', 'CQRS', 'backend.architecture', ['cqrs', 'command', 'query', 'projection'], ['command query'], ['@nestjs/cqrs'], ['CommandHandler', 'QueryHandler'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('cqrs-consistency', 'Eventual Consistency', 'Queries in CQRS may return stale data. Design UI to handle eventual consistency (e.g. optimistic updates).')]
    }),
    makeLeafNode('saga', 'Saga Pattern', 'backend.architecture', ['saga', 'choreography', 'orchestration', 'compensating'], ['saga pattern'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('saga-compensation', 'Compensating Transactions', 'Every step in a Saga must have a reverse compensating action defined to revert partial state on failure.', 'critical')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Error Handling
const errorHandlingNode: TaxonomyNode = {
  id: 'backend.error-handling',
  label: 'Error Handling & Resiliency',
  children: [
    makeLeafNode('retry-patterns', 'Retry Patterns', 'backend.error-handling', ['retry', 'backoff', 'jitter'], ['exponential backoff'], ['async-retry'], ['retry'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createRichFragment(
          'retry-logic',
          'Safe Retries',
          'Only retry idempotent operations (GET, PUT, DELETE). Use exponential backoff with full jitter to avoid thundering herd problems.',
          'critical',
          {
            codePatterns: [
              {
                concern: 'Linear or raw retries without backoff/jitter',
                wrong: {
                  language: 'typescript',
                  code: 'async function fetchWithRetry(url) {\n  for (let i = 0; i < 3; i++) {\n    try { return await fetch(url); }\n    catch (e) { /* retry immediately */ }\n  }\n}',
                  explanation: 'Retries instantly without delay, overwhelming a struggling downstream service.'
                },
                correct: {
                  language: 'typescript',
                  code: 'async function fetchWithRetry(url, retries = 3, delay = 1000) {\n  try {\n    return await fetch(url);\n  } catch (e) {\n    if (retries <= 0) throw e;\n    const jitter = Math.random() * delay;\n    await new Promise(r => setTimeout(r, delay + jitter));\n    return fetchWithRetry(url, retries - 1, delay * 2);\n  }\n}',
                  explanation: 'Applies exponential backoff (delay * 2) combined with random jitter to distribute retries.'
                },
                detectionHint: 'Retry loops without delay or setTimeout'
              },
              {
                concern: 'Python backoff implementation',
                wrong: {
                  language: 'python',
                  code: 'def call_service():\n    for _ in range(3):\n        try: return requests.get(url)\n        except: pass',
                  explanation: 'Performs immediate retries upon failure, contributing to stampedes.'
                },
                correct: {
                  language: 'python',
                  code: 'import time, random\ndef call_service(retries=3, delay=1.0):\n    try:\n        return requests.get(url)\n    except Exception as e:\n        if retries <= 0: raise e\n        time.sleep(delay + random.uniform(0, delay))\n        return call_service(retries - 1, delay * 2)',
                  explanation: 'Uses random.uniform for jitter and multiplies delay to exponentially scale backoff.'
                },
                detectionHint: 'time.sleep called in exception blocks without dynamic delay'
              }
            ],
            commonMistakes: [
              {
                mistake: 'Retrying non-idempotent operations (POST)',
                whyItHappens: 'Treating all network errors identically.',
                correction: 'Only retry GET, PUT, or DELETE. If POST fails, return error and let caller decide.',
                severity: 'data-loss'
              }
            ],
            selfVerification: [
              {
                check: 'Only idempotent calls are retried',
                howToVerify: 'Verify that retry wrappers are not wrapped around POST or non-idempotent requests.',
                failureIndicator: 'POST requests wrapped with retry logic',
                remediation: 'Remove retry logic wrapper from the POST request caller.'
              }
            ]
          }
        )
      ]
    }),
    makeLeafNode('circuit-breaker', 'Circuit Breaker', 'backend.error-handling', ['circuit', 'breaker', 'opossum'], ['circuit breaker'], ['opossum'], ['CircuitBreaker'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('circuit-breaker', 'Circuit Breaker', 'Wrap external network calls in a circuit breaker to fail fast when downstream is degraded.')]
    }),
    makeLeafNode('error-boundaries', 'Error Boundaries', 'backend.error-handling', ['error', 'exception', 'catch', 'throw'], ['error handler'], [], ['ErrorHandler', 'catch'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('structured-errors', 'Structured Logging', 'Log errors as structured JSON. Never expose raw stack traces in HTTP responses to prevent information leakage.', 'critical')]
    })
  ],
  triggers: {
    words: [{ word: 'error', weight: 0.6 }, { word: 'exception', weight: 0.6 }],
    phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: []
  },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Messaging
const messagingNode: TaxonomyNode = {
  id: 'backend.messaging',
  label: 'Messaging & Queues',
  children: [
    makeLeafNode('kafka', 'Kafka', 'backend.messaging', ['kafka', 'producer', 'consumer', 'partition'], ['apache kafka'], ['kafkajs'], ['Kafka', 'Producer', 'Consumer'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('kafka-offsets', 'Offset Management', 'Handle manual offset commits carefully. Do not commit an offset until the message is fully processed and persisted to your DB.')]
    }),
    makeLeafNode('rabbitmq', 'RabbitMQ', 'backend.messaging', ['rabbitmq', 'amqp', 'exchange', 'queue', 'routing-key'], ['rabbit mq'], ['amqplib'], ['connect', 'Channel'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('rabbitmq-prefetch', 'Prefetch Limits', 'Set a strict prefetch limit on consumers to prevent overwhelming the worker node.')]
    }),
    makeLeafNode('sqs', 'AWS SQS', 'backend.messaging', ['sqs', 'fifo', 'dlq'], ['aws sqs'], ['@aws-sdk/client-sqs'], ['SQSClient'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('sqs-visibility', 'Visibility Timeout', 'If a message takes longer to process than the visibility timeout, it will be delivered again. Use heartbeat extensions if necessary.')]
    })
  ],
  triggers: { words: [{ word: 'queue', weight: 0.8 }], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Frontend
const stateManagementNode: TaxonomyNode = {
  id: 'frontend.state-management',
  label: 'State Management',
  children: [
    makeLeafNode('redux', 'Redux', 'frontend.state-management', ['redux', 'thunk', 'saga', 'slice'], ['redux toolkit'], ['@reduxjs/toolkit', 'react-redux'], ['useSelector', 'useDispatch'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('redux-immutability', 'Immutability', 'Never mutate state directly in reducers. Use RTK/Immer properly or spread operators.')]
    }),
    makeLeafNode('zustand', 'Zustand', 'frontend.state-management', ['zustand', 'slice', 'store'], [], ['zustand'], ['create'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('zustand-selectors', 'Selectors', 'Always use granular selectors when subscribing to Zustand stores to prevent unnecessary component re-renders.')]
    }),
    makeLeafNode('signals', 'Signals', 'frontend.state-management', ['signal', 'computed', 'effect'], ['preact signals'], ['@preact/signals', '@preact/signals-react'], ['signal', 'computed'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('signals-derived', 'Derived State', 'Do not sync derived state into independent signals. Use `computed` for any state that can be derived from other signals.')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Security
const injectionNode: TaxonomyNode = {
  id: 'security.injection',
  label: 'Injection Prevention',
  children: [
    makeLeafNode('sql-injection', 'SQL Injection', 'security.injection', ['sql', 'query', 'raw'], ['raw query'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('prevent-sqli', 'Parameterized Queries', 'NEVER interpolate string variables directly into SQL. Always use parameterized queries or the ORMs strict binding mechanisms.', 'critical')]
    }),
    makeLeafNode('xss', 'XSS', 'security.injection', ['xss', 'dangerouslySetInnerHTML', 'sanitize'], ['cross site scripting'], ['dompurify'], ['sanitize'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('prevent-xss', 'DOM Purify', 'Never use `dangerouslySetInnerHTML` with untrusted user input without running it through DOMPurify first.', 'critical')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

const secretsNode: TaxonomyNode = {
  id: 'security.secrets-management',
  label: 'Secrets Management',
  children: [
    makeLeafNode('env-vars', 'Environment Variables', 'security.secrets-management', ['env', 'dotenv', 'process.env'], ['environment variable'], ['dotenv'], ['config'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('no-hardcoded-secrets', 'No Hardcoded Secrets', 'NEVER hardcode API keys, passwords, or tokens in source code. Ensure `.env` is in `.gitignore`.', 'critical')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

const cryptoNode: TaxonomyNode = {
  id: 'security.cryptography',
  label: 'Cryptography',
  children: [
    makeLeafNode('password-hashing', 'Password Hashing', 'security.cryptography', ['hash', 'bcrypt', 'argon2'], ['hash password'], ['bcrypt', 'argon2'], ['hash', 'compare'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('strong-hashing', 'Strong Hashing', 'Use Argon2id or bcrypt with appropriate work factors for passwords. Never use MD5 or SHA-1 for passwords.', 'critical')]
    }),
    makeLeafNode('constant-time', 'Constant Time Compares', 'security.cryptography', ['compare', 'hmac', 'signature'], ['timing attack'], ['crypto'], ['timingSafeEqual'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('timing-attacks', 'Timing Attacks', 'Always use `crypto.timingSafeEqual` when comparing HMAC signatures or tokens to prevent timing attacks.', 'critical')]
    })
  ],
  triggers: { words: [{ word: 'crypto', weight: 0.8 }], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Testing
const testingNode: TaxonomyNode = {
  id: 'testing',
  label: 'Testing Methodologies',
  children: [
    makeLeafNode('unit', 'Unit Testing', 'testing', ['jest', 'mocha', 'vitest', 'unit', 'mock', 'spy'], ['unit test'], ['jest', 'vitest'], ['describe', 'it', 'expect'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createFragment('unit-aaa', 'AAA Pattern', 'Format unit tests using Arrange, Act, Assert blocks. Mock I/O boundaries aggressively.'),
        createFragment('pure-functions', 'Pure Function Testing', 'For pure functions, use table-driven tests or parameterized inputs to cover edge cases exhaustively.')
      ]
    }),
    makeLeafNode('integration', 'Integration Testing', 'testing', ['integration', 'testcontainers', 'supertest'], ['integration test'], ['testcontainers', 'supertest'], ['GenericContainer'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('integration-db', 'Database Isolation', 'Run integration tests against ephemeral databases (e.g. Testcontainers) and rollback transactions after each test suite.')]
    }),
    makeLeafNode('e2e', 'E2E Testing', 'testing', ['cypress', 'playwright', 'puppeteer', 'e2e'], ['e2e test', 'end to end'], ['cypress', '@playwright/test'], ['page', 'browser'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('e2e-flakiness', 'E2E Flakiness', 'Avoid setting state via UI clicks. Seed database state via direct API calls before running UI assertions to reduce test flakiness.')]
    })
  ],
  triggers: {
    words: [{ word: 'test', weight: 0.8 }, { word: 'spec', weight: 0.6 }],
    phrases: [], antiWords: [], importPatterns: [], filePatterns: ['**/*.spec.*', '**/*.test.*'], symbolPatterns: []
  },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// DevOps
const devopsNode: TaxonomyNode = {
  id: 'devops',
  label: 'DevOps & Infrastructure',
  children: [
    makeLeafNode('ci-cd', 'CI/CD Pipelines', 'devops', ['github-actions', 'gitlab-ci', 'jenkins', 'pipeline'], ['continuous integration'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('ci-caching', 'Build Caching', 'Implement proper dependency caching in CI to speed up build times.')]
    }),
    makeLeafNode('docker', 'Docker', 'devops', ['docker', 'dockerfile', 'container'], ['docker image'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('docker-multi-stage', 'Multi-stage Builds', 'Use multi-stage builds to keep final image sizes small. Never run the node process as `root` user in production.', 'critical')]
    }),
    makeLeafNode('terraform', 'Terraform', 'devops', ['terraform', 'tf', 'hcl', 'provider'], ['infrastructure as code'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('tf-state', 'State Management', 'Always configure a remote backend for state (e.g. S3 + DynamoDB locking). Never commit `terraform.tfstate` to source control.', 'critical')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: ['**/*.tf', '**/Dockerfile', '**/.github/workflows/*'], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Performance
const perfNode: TaxonomyNode = {
  id: 'performance',
  label: 'Performance Optimization',
  children: [
    makeLeafNode('caching-strategy', 'Caching Strategy', 'performance', ['cache', 'redis', 'memcached', 'ttl'], ['cache aside', 'write through'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('cache-stampede', 'Cache Stampede', 'Implement probabilistic early expiration or mutex locks to prevent cache stampedes on hot keys.')]
    }),
    makeLeafNode('memory-management', 'Memory Management', 'performance', ['memory', 'leak', 'stream', 'buffer'], ['memory leak', 'garbage collection'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('stream-vs-buffer', 'Streams vs Buffers', 'Always use Streams (`fs.createReadStream`, `.pipe()`) for handling large files or payloads. Never buffer large files entirely in RAM.', 'critical')]
    }),
    makeLeafNode('query-optimization', 'Query Optimization', 'performance', ['explain', 'index', 'n+1', 'slow-query'], ['query optimization'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('n-plus-1', 'N+1 Query Prevention', 'Check loops fetching relations. Batch them using `IN` clauses or join eagerly to prevent N+1 queries.')]
    })
  ],
  triggers: { words: [{ word: 'performance', weight: 0.8 }], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Paradigm (Non-Domain Axis)
const paradigmAxis: TaxonomyNode = {
  id: 'paradigm',
  label: 'Paradigm Axis Root',
  children: [
    makeLeafNode('functional', 'Functional Programming', 'paradigm', ['fp', 'pure', 'immutable', 'map', 'reduce', 'filter'], ['pure function'], ['ramda', 'lodash/fp'], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createRichFragment(
          'functional-pure',
          'Pure Functions',
          'Avoid mutations and side effects. Return new copies of objects/arrays rather than modifying arguments in place.',
          'principle',
          {
            codePatterns: [
              {
                concern: 'In-place argument mutation',
                wrong: {
                  language: 'typescript',
                  code: 'function addActiveUser(users: User[], newUser: User): User[] {\n  users.push(newUser);\n  return users;\n}',
                  explanation: 'Mutates the input array argument directly, which can cause unexpected reactivity bugs.'
                },
                correct: {
                  language: 'typescript',
                  code: 'function addActiveUser(users: User[], newUser: User): User[] {\n  return [...users, newUser];\n}',
                  explanation: 'Returns a brand new array, preserving the original array argument immutable.'
                },
                detectionHint: 'push, splice, shift, pop, or object property assignments on arguments'
              },
              {
                concern: 'Python list mutability pitfalls',
                wrong: {
                  language: 'python',
                  code: 'def append_to(element, target=[]):\n    target.append(element)\n    return target',
                  explanation: 'Mutable default arguments are shared across all function calls, leading to cross-call leaks.'
                },
                correct: {
                  language: 'python',
                  code: 'def append_to(element, target=None):\n    if target is None:\n        target = []\n    new_target = list(target)\n    new_target.append(element)\n    return new_target',
                  explanation: 'Uses None as a default placeholder and constructs a copy of the list before mutating.'
                },
                detectionHint: 'Mutable default arguments in python method definitions'
              }
            ]
          }
        )
      ]
    }),
    makeLeafNode('object-oriented', 'Object-Oriented Programming', 'paradigm', ['oop', 'class', 'interface', 'extends', 'implements'], ['object oriented'], [], ['class', 'interface'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('oop-solid', 'SOLID Principles', 'Favor composition over inheritance. Ensure subclasses can be substituted for base classes without breaking behavior (Liskov Substitution).')]
    }),
    makeLeafNode('event-driven', 'Event-Driven', 'paradigm', ['event', 'emit', 'subscriber', 'publisher'], ['event driven'], ['events'], ['EventEmitter'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('ed-idempotency', 'Idempotent Handlers', 'Event handlers must be idempotent. They may be called multiple times for the same event payload.')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Lifecycle (Non-Domain Axis)
const lifecycleAxis: TaxonomyNode = {
  id: 'lifecycle',
  label: 'Lifecycle Stage Axis Root',
  children: [
    makeLeafNode('bug-fix', 'Bug Fixing', 'lifecycle', ['bug', 'fix', 'issue', 'patch', 'hotfix'], ['fix bug', 'resolve issue'], [], [], {
      chat: null, taskCreation: null, investigation: null, verification: null,
      planning: [createFragment('bug-rca', 'Root Cause Analysis', 'Identify the root cause, not just the symptom. Write a regression test BEFORE applying the fix to ensure it remains fixed.')],
      execution: [createFragment('bug-blast-radius', 'Minimal Blast Radius', 'Keep code changes strictly isolated to the bug. Do not mix refactoring with bug fixes to minimize risk.')]
    }),
    makeLeafNode('feature-addition', 'Feature Addition', 'lifecycle', ['feature', 'feat', 'add', 'implement'], ['new feature'], [], [], {
      chat: null, taskCreation: null, investigation: null, verification: null,
      planning: [createFragment('feat-compat', 'Backwards Compatibility', 'Ensure new features do not break existing API contracts or require immediate client upgrades. Use feature flags if rolling out incrementally.')],
      execution: null
    }),
    makeLeafNode('refactoring', 'Refactoring', 'lifecycle', ['refactor', 'cleanup', 'technical-debt'], ['refactor code'], [], [], {
      chat: null, taskCreation: null, investigation: null, verification: null,
      planning: [createFragment('refactor-test', 'Test-First Refactoring', 'Ensure a solid test harness exists covering the current behavior before changing internal structures.')],
      execution: [createFragment('refactor-behavior', 'Preserve Behavior', 'Do not alter the public API or observable behavior of the module being refactored.')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Scale (Non-Domain Axis)
const scaleAxis: TaxonomyNode = {
  id: 'scale',
  label: 'Scale Axis Root',
  children: [
    makeLeafNode('single-user', 'Single User', 'scale', ['desktop', 'local', 'cli', 'electron'], ['single user'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('scale-single', 'Local Scale', 'Favor local files or SQLite over distributed networks. Avoid heavy connection pooling.')]
    }),
    makeLeafNode('production', 'Production', 'scale', ['production', 'cluster', 'ha', 'lb'], ['high availability'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createRichFragment(
          'scale-ha',
          'High Availability',
          'Assume servers can die at any time. Keep node processes strictly stateless. Offload all session state to Redis/DB.',
          'critical',
          {
            codePatterns: [
              {
                concern: 'In-memory stateful sessions',
                wrong: {
                  language: 'typescript',
                  code: 'const activeSessions = new Map();\napp.post("/login", (req, res) => {\n  activeSessions.set(req.body.userId, req.session);\n  res.send("logged in");\n});',
                  explanation: 'Sessions stored in local maps are lost when the instance restarts or scales horizontally.'
                },
                correct: {
                  language: 'typescript',
                  code: 'app.post("/login", async (req, res) => {\n  await redis.set(`session:${req.body.userId}`, JSON.stringify(req.session), "EX", 3600);\n  res.send("logged in");\n});',
                  explanation: 'Offloads session state to a shared Redis cluster, keeping the web process completely stateless.'
                },
                detectionHint: 'In-memory Maps or arrays storing session or user state'
              },
              {
                concern: 'Stateless Python handlers',
                wrong: {
                  language: 'python',
                  code: 'logged_in_users = {}\n@app.post("/session")\ndef create_session(user_id: str):\n    logged_in_users[user_id] = True',
                  explanation: 'Global dictionary storage prevents horizontal scaling across multiple Gunicorn/Uvicorn workers.'
                },
                correct: {
                  language: 'python',
                  code: '@app.post("/session")\ndef create_session(user_id: str, redis_client=Depends(get_redis)):\n    redis_client.setex(f"session:{user_id}", 3600, "active")',
                  explanation: 'Stores login/session details externally in Redis for multi-instance stateless coordination.'
                },
                detectionHint: 'Global module variables modified in request routes'
              }
            ],
            commonMistakes: [
              {
                mistake: 'Using local filesystem storage for user uploads',
                whyItHappens: 'Simpler setup than configuring cloud object storage.',
                correction: 'Stream uploads directly to cloud storage (S3, GCS) rather than saving to local disk.',
                severity: 'data-loss'
              }
            ],
            selfVerification: [
              {
                check: 'Process contains zero local stateful dependencies',
                howToVerify: 'Verify that node restarts or parallel execution does not impact session or transaction completeness.',
                failureIndicator: 'Local filesystem storage or global arrays used to tracks active user transaction states',
                remediation: 'Migrate global state variables to shared cache (Redis) or database tables.'
              }
            ]
          }
        )
      ]
    }),
    makeLeafNode('serverless', 'Serverless', 'scale', ['lambda', 'serverless', 'cold-start'], ['aws lambda'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('scale-serverless', 'Cold Starts', 'Minimize dependencies and avoid heavy initialization code in the global scope to reduce cold start times.')]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

// Concurrency (Non-Domain Axis)
const concurrencyAxis: TaxonomyNode = {
  id: 'concurrency',
  label: 'Concurrency Axis Root',
  children: [
    makeLeafNode('async-await', 'Async/Await', 'concurrency', ['async', 'await', 'promise'], ['promise all'], [], [], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [createFragment('async-errors', 'Unhandled Rejections', 'Always wrap `await` calls in try/catch or use `.catch()` on promises. Never leave unhandled rejections.')]
    }),
    makeLeafNode('multi-threaded', 'Multi-threaded', 'concurrency', ['worker', 'thread', 'pool', 'mutex', 'lock'], ['worker thread'], ['worker_threads'], ['Worker', 'SharedArrayBuffer'], {
      chat: null, planning: null, taskCreation: null, investigation: null, verification: null,
      execution: [
        createRichFragment(
          'thread-safety',
          'Thread Safety',
          'Use `Atomics` when interacting with `SharedArrayBuffer` to prevent race conditions across worker threads.',
          'critical',
          {
            codePatterns: [
              {
                concern: 'Non-atomic shared array mutations',
                wrong: {
                  language: 'typescript',
                  code: 'const sharedArray = new Int32Array(sharedBuffer);\nsharedArray[0]++;',
                  explanation: 'Increments shared memory non-atomically, leading to lost updates under multi-threaded races.'
                },
                correct: {
                  language: 'typescript',
                  code: 'const sharedArray = new Int32Array(sharedBuffer);\nAtomics.add(sharedArray, 0, 1);',
                  explanation: 'Uses Atomics.add to perform thread-safe, atomic updates in shared memory.'
                },
                detectionHint: 'Direct array index assignments on SharedArrayBuffer views'
              },
              {
                concern: 'Java multi-threaded synchronization',
                wrong: {
                  language: 'java',
                  code: 'public class Counter {\n    private int count = 0;\n    public void increment() { count++; }\n}',
                  explanation: 'The count++ operation is not atomic and causes race conditions across threads.'
                },
                correct: {
                  language: 'java',
                  code: 'import java.util.concurrent.atomic.AtomicInteger;\npublic class Counter {\n    private final AtomicInteger count = new AtomicInteger(0);\n    public void increment() { count.incrementAndGet(); }\n}',
                  explanation: 'AtomicInteger uses lock-free hardware instructions (CAS) to perform thread-safe increments.'
                },
                detectionHint: 'Non-synchronized variables modified across threads'
              },
              {
                concern: 'C++ thread synchronization',
                wrong: {
                  language: 'cpp',
                  code: 'int counter = 0;\nvoid worker() {\n    for (int i = 0; i < 1000; ++i) {\n        counter++;\n    }\n}',
                  explanation: 'Unsynchronized concurrent modifications on a global variable trigger undefined behavior.'
                },
                correct: {
                  language: 'cpp',
                  code: '#include <atomic>\nstd::atomic<int> counter(0);\nvoid worker() {\n    for (int i = 0; i < 1000; ++i) {\n        counter++;\n    }\n}',
                  explanation: 'std::atomic wrappers execute safe atomic operations that compile to hardware lock instructions.'
                },
                detectionHint: 'Global variable updates in thread loops without mutex or std::atomic'
              }
            ]
          }
        )
      ]
    })
  ],
  triggers: { words: [], phrases: [], antiWords: [], importPatterns: [], filePatterns: [], symbolPatterns: [] },
  fragments: { chat: null, planning: null, taskCreation: null, investigation: null, execution: null, verification: null },
  toolOverrides: []
};

function run() {
  console.log('[TaxonomyGenerator] Starting tree generation (databases + expansions)...');

  if (!fs.existsSync(treePath)) {
    console.error(`Error: base taxonomy tree not found at ${treePath}`);
    process.exit(1);
  }

  const baseTree = JSON.parse(fs.readFileSync(treePath, 'utf8'));

  // Define Category Nodes with Professional Parent Fragments
  const relationalNode = buildDatabaseCategoryNode(
    'backend.database.relational',
    'Relational Database Engine',
    RELATIONAL_DBS,
    [
      { word: 'relational', weight: 0.6 },
      { word: 'sql', weight: 0.4 },
      { word: 'rdbms', weight: 0.8 }
    ],
    [
      {
        id: 'relational-transactions',
        summary: 'Proper transactional bounds in RDBMS',
        weight: 'critical',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'When executing multiple writes in a relational database, wrap them in a TRANSACTION (BEGIN/COMMIT) to preserve atomicity.',
        decisionTree: null,
        codePatterns: [
          {
            concern: 'Atomic database updates',
            wrong: {
              code: 'await db.query("INSERT INTO users ...");\nawait db.query("INSERT INTO profiles ...");',
              language: 'javascript',
              explanation: 'If the second query fails, the user is left in an inconsistent state.'
            },
            correct: {
              code: 'await db.query("BEGIN");\ntry {\n  await db.query("INSERT INTO users ...");\n  await db.query("INSERT INTO profiles ...");\n  await db.query("COMMIT");\n} catch (e) {\n  await db.query("ROLLBACK");\n  throw e;\n}',
              language: 'javascript',
              explanation: 'Ensures that either both writes succeed or neither does.'
            },
            detectionHint: 'Multiple sequential write queries without BEGIN/COMMIT'
          }
        ],
        commonMistakes: [
          {
            mistake: 'Leaving database transactions uncommitted or un-rolled back in catch branches',
            whyItHappens: 'Forgetting rollback statement inside the catch block.',
            correction: 'Always include ROLLBACK in the catch block and ensure connection is released.',
            severity: 'data-loss'
          }
        ],
        selfVerification: [
          {
            check: 'Every BEGIN block has a corresponding COMMIT and ROLLBACK path',
            howToVerify: 'Verify query lines and make sure error handler calls ROLLBACK.',
            failureIndicator: 'BEGIN query found without ROLLBACK inside catch block',
            remediation: 'Add a ROLLBACK statement to the database catch wrapper.'
          }
        ],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  const documentNode = buildDatabaseCategoryNode(
    'backend.database.document',
    'Document Datastore',
    DOCUMENT_DBS,
    [
      { word: 'document', weight: 0.5 },
      { word: 'nosql', weight: 0.6 },
      { word: 'json', weight: 0.3 }
    ],
    [
      {
        id: 'document-connection-cache',
        summary: 'Reuse MongoClient / Database connection handles',
        weight: 'critical',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'In document stores, always cache and reuse database client instances. Avoid calling connect() on every request handler.',
        decisionTree: null,
        codePatterns: [
          {
            concern: 'MongoClient connection caching',
            wrong: {
              code: 'app.get("/data", async (req, res) => {\n  const client = await MongoClient.connect(url);\n  res.json(await client.db().collection("data").find().toArray());\n});',
              language: 'javascript',
              explanation: 'Re-connects on every request, exhausting connection limits instantly.'
            },
            correct: {
              code: 'let cachedClient = null;\nasync function getClient() {\n  if (!cachedClient) cachedClient = await MongoClient.connect(url);\n  return cachedClient;\n}\napp.get("/data", async (req, res) => {\n  const client = await getClient();\n  res.json(await client.db().collection("data").find().toArray());\n});',
              language: 'javascript',
              explanation: 'Caches the client instance globally and reuses it across requests.'
            },
            detectionHint: 'MongoClient.connect inside requests or route handlers'
          }
        ],
        commonMistakes: [],
        selfVerification: [],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  const keyvalueNode = buildDatabaseCategoryNode(
    'backend.database.keyvalue',
    'Key-Value & Cache Store',
    KEYVALUE_DBS,
    [
      { word: 'cache', weight: 0.4 },
      { word: 'keyvalue', weight: 0.6 },
      { word: 'redis', weight: 0.4 }
    ],
    [
      {
        id: 'cache-ttl-stampede',
        summary: 'Provide cache key TTL and stampede protection',
        weight: 'principle',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'When caching keys, always define a TTL (Time To Live). Consider cache stampede mitigation for hot keys.',
        decisionTree: null,
        codePatterns: [],
        commonMistakes: [
          {
            mistake: 'Caching sensitive or dynamic user data indefinitely without TTL',
            whyItHappens: 'Forgetting to set expire parameters in cache client calls.',
            correction: 'Ensure all SET commands include an EX option.',
            severity: 'functional'
          }
        ],
        selfVerification: [],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  const widecolumnNode = buildDatabaseCategoryNode(
    'backend.database.widecolumn',
    'Wide-Column Family Database',
    WIDECOLUMN_DBS,
    [
      { word: 'widecolumn', weight: 0.7 },
      { word: 'cassandra', weight: 0.4 },
      { word: 'hbase', weight: 0.4 }
    ],
    [
      {
        id: 'widecolumn-queries',
        summary: 'Query-driven design in Cassandra/ScyllaDB',
        weight: 'principle',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'In wide-column stores, design tables strictly around queries. Avoid joins and perform denormalization to match target read shapes.',
        decisionTree: null,
        codePatterns: [],
        commonMistakes: [],
        selfVerification: [],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  const columnarNode = buildDatabaseCategoryNode(
    'backend.database.columnar',
    'Columnar Warehouse & OLAP Engine',
    COLUMNAR_DBS,
    [
      { word: 'columnar', weight: 0.7 },
      { word: 'olap', weight: 0.7 },
      { word: 'warehouse', weight: 0.6 }
    ],
    [
      {
        id: 'columnar-batch-writes',
        summary: 'Batch writes in columnar engines',
        weight: 'critical',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'Columnar engines (e.g. ClickHouse, Snowflake) are built for large batches. NEVER write single rows concurrently; instead, buffer inserts.',
        decisionTree: null,
        codePatterns: [],
        commonMistakes: [
          {
            mistake: 'Direct single-row inserts from real-time events',
            whyItHappens: 'Treating ClickHouse like OLTP PostgreSQL database.',
            correction: 'Buffer writes in memory or use a queue (Kafka/Redis) to write 1000+ rows in batch.',
            severity: 'functional'
          }
        ],
        selfVerification: [],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  const timeseriesNode = buildDatabaseCategoryNode(
    'backend.database.timeseries',
    'Time-Series Engine',
    TIMESERIES_DBS,
    [
      { word: 'timeseries', weight: 0.7 },
      { word: 'influx', weight: 0.4 },
      { word: 'questdb', weight: 0.4 }
    ],
    [
      {
        id: 'timeseries-indexing',
        summary: 'Time index sorting requirements',
        weight: 'principle',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'Always ensure timeseries inserts are strictly timestamped and queried using time boundaries to utilize indexing partitions.',
        decisionTree: null,
        codePatterns: [],
        commonMistakes: [],
        selfVerification: [],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  const searchNode = buildDatabaseCategoryNode(
    'backend.database.search',
    'Search Engine Store',
    SEARCH_DBS,
    [
      { word: 'opensearch', weight: 0.4 },
      { word: 'elasticsearch', weight: 0.4 },
      { word: 'meilisearch', weight: 0.4 }
    ],
    [
      {
        id: 'search-bulk-indexing',
        summary: 'Bulk operations for indexing documents',
        weight: 'principle',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'When indexing multiple search documents in OpenSearch/Elasticsearch, use bulk APIs (_bulk) rather than single index updates.',
        decisionTree: null,
        codePatterns: [],
        commonMistakes: [],
        selfVerification: [],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  const vectorNode = buildDatabaseCategoryNode(
    'backend.database.vector',
    'Vector Database',
    VECTOR_DBS,
    [
      { word: 'vector', weight: 0.5 },
      { word: 'pinecone', weight: 0.4 },
      { word: 'weaviate', weight: 0.4 }
    ],
    [
      {
        id: 'vector-similarity-metrics',
        summary: 'Vector distance metric alignment',
        weight: 'critical',
        trigger: 'always',
        defersToCodebase: true,
        coreGuidance: 'Ensure cosine similarity or L2 euclidean metrics are correctly configured to match the embedding model outputs.',
        decisionTree: null,
        codePatterns: [],
        commonMistakes: [],
        selfVerification: [],
        outputConstraints: null,
        guardrails: null,
        scaffolding: null,
        crossReferences: null
      }
    ]
  );

  // Find backend.database in the baseTree
  const domainTree = baseTree.domain;
  if (!domainTree) {
    console.error('Error: domain axis root not found in baseTree');
    process.exit(1);
  }

  // Traverse to find 'backend' node
  const backendNode = domainTree.children.find((c: any) => c.id === 'backend');
  if (!backendNode) {
    console.error('Error: backend node not found under domain root');
    process.exit(1);
  }

  // Find 'backend.database' under backend
  const databaseNode = backendNode.children.find((c: any) => c.id === 'backend.database');
  if (!databaseNode) {
    console.error('Error: backend.database node not found');
    process.exit(1);
  }

  // Inherit keywords from all database engines for parent-branch dominance
  const allDbKeywords = [
    ...RELATIONAL_DBS,
    ...DOCUMENT_DBS,
    ...KEYVALUE_DBS,
    ...WIDECOLUMN_DBS,
    ...COLUMNAR_DBS,
    ...TIMESERIES_DBS,
    ...SEARCH_DBS,
    ...VECTOR_DBS
  ].flatMap(db => db.keywords);

  const existingWords = databaseNode.triggers.words || [];
  const inheritedWords = allDbKeywords.map(kw => ({ word: kw, weight: 0.3 }));
  databaseNode.triggers.words = deduplicateWords([...existingWords, ...inheritedWords]);

  // Replace database children with our 8 model subtrees
  databaseNode.children = [
    relationalNode,
    documentNode,
    keyvalueNode,
    widecolumnNode,
    columnarNode,
    timeseriesNode,
    searchNode,
    vectorNode
  ];

  // -------------------------------------------------------------
  // Inject/Replace Phase 3 Extensions
  // -------------------------------------------------------------

  // Inject/Replace backend nodes
  const apiIndex = backendNode.children.findIndex((c: any) => c.id === 'backend.api');
  if (apiIndex !== -1) {
    backendNode.children[apiIndex] = apiNode;
  } else {
    backendNode.children.push(apiNode);
  }

  const archIndex = backendNode.children.findIndex((c: any) => c.id === 'backend.architecture');
  if (archIndex !== -1) {
    backendNode.children[archIndex] = archNode;
  } else {
    backendNode.children.push(archNode);
  }

  const errIndex = backendNode.children.findIndex((c: any) => c.id === 'backend.error-handling');
  if (errIndex !== -1) {
    backendNode.children[errIndex] = errorHandlingNode;
  } else {
    backendNode.children.push(errorHandlingNode);
  }

  const msgIndex = backendNode.children.findIndex((c: any) => c.id === 'backend.messaging');
  if (msgIndex !== -1) {
    backendNode.children[msgIndex] = messagingNode;
  } else {
    backendNode.children.push(messagingNode);
  }

  // Inject/Replace top-level Domain nodes
  const testIndex = domainTree.children.findIndex((c: any) => c.id === 'testing');
  if (testIndex !== -1) {
    domainTree.children[testIndex] = testingNode;
  } else {
    domainTree.children.push(testingNode);
  }

  const devopsIndex = domainTree.children.findIndex((c: any) => c.id === 'devops');
  if (devopsIndex !== -1) {
    domainTree.children[devopsIndex] = devopsNode;
  } else {
    domainTree.children.push(devopsNode);
  }

  const perfIndex = domainTree.children.findIndex((c: any) => c.id === 'performance');
  if (perfIndex !== -1) {
    domainTree.children[perfIndex] = perfNode;
  } else {
    domainTree.children.push(perfNode);
  }

  // Frontend custom sub-branches (Redux, Zustand, Signals)
  const frontendNode = domainTree.children.find((c: any) => c.id === 'frontend');
  if (frontendNode) {
    const smIndex = frontendNode.children.findIndex((c: any) => c.id === 'frontend.state-management');
    if (smIndex !== -1) {
      frontendNode.children[smIndex] = stateManagementNode;
    } else {
      frontendNode.children.push(stateManagementNode);
    }
  }

  // Security sub-branches (SQL injection, DOM XSS, Env vars, Hashing)
  const securityNode = domainTree.children.find((c: any) => c.id === 'security');
  if (securityNode) {
    const injIndex = securityNode.children.findIndex((c: any) => c.id === 'security.injection');
    if (injIndex !== -1) {
      securityNode.children[injIndex] = injectionNode;
    } else {
      securityNode.children.push(injectionNode);
    }

    const secIndex = securityNode.children.findIndex((c: any) => c.id === 'security.secrets-management');
    if (secIndex !== -1) {
      securityNode.children[secIndex] = secretsNode;
    } else {
      securityNode.children.push(secretsNode);
    }

    const cryIndex = securityNode.children.findIndex((c: any) => c.id === 'security.cryptography');
    if (cryIndex !== -1) {
      securityNode.children[cryIndex] = cryptoNode;
    } else {
      securityNode.children.push(cryptoNode);
    }
  }

  // Inject Non-Domain Axes
  baseTree.paradigm = paradigmAxis;
  baseTree.lifecycle = lifecycleAxis;
  baseTree.scale = scaleAxis;
  baseTree.concurrency = concurrencyAxis;

  // Write compiled tree back to taxonomyTree.json
  fs.writeFileSync(treePath, JSON.stringify(baseTree, null, 2), 'utf8');
  console.log('[TaxonomyGenerator] Tree successfully generated (databases + Phase 3 expansions) and saved to taxonomyTree.json!');
}

run();

