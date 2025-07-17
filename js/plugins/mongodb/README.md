# MongoDB plugin for Genkit

A comprehensive MongoDB plugin for Genkit that provides vector search, text search, hybrid search, CRUD operations, and search index management capabilities.

## Installing the plugin

```bash
npm i --save genkitx-mongodb
```

## Features

- **Vector Search**: Semantic search using embeddings with MongoDB's vector search capabilities
- **Text Search**: Full-text search with fuzzy matching and synonyms support
- **Hybrid Search**: Combine vector and text search for enhanced results
- **CRUD Operations**: Create, read, update, and delete documents by ID
- **Search Index Management**: Create, list, and drop search indexes
- **Batch Indexing**: Efficient document indexing with configurable batch sizes
- **Retry Logic**: Built-in retry mechanisms for improved reliability
- **Flexible Field Configuration**: Customizable field names for data, metadata, and embeddings
- **Multiple Connection Support**: Configure multiple MongoDB connections with different settings

## Using the plugin

### Basic Setup

```ts
import { genkit } from 'genkit';
import { mongodb } from 'genkitx-mongodb';
import { googleAI } from '@genkit-ai/googleai';

const ai = genkit({
  plugins: [
    mongodb([
      {
        url: 'mongodb://localhost:27017',
        mongoClientOptions: {
          // Optional MongoDB client options
        },
        indexer: {
          id: 'indexer',
          retry: {
            retryAttempts: 3,
            baseDelay: 1000,
            jitterFactor: 0.1,
          },
        },
        retriever: {
          id: 'retriever',
          retry: {
            retryAttempts: 2,
            baseDelay: 500,
          },
        },
        crudTools: {
          id: 'crud',
        },
        searchIndexTools: {
          id: 'search-index',
        },
      },
    ]),
  ],
});
```

### Multiple Connections

You can configure multiple MongoDB connections with different settings:

```ts
mongodb([
  {
    url: 'mongodb://primary:27017',
    indexer: {
      id: 'primary-indexer',
      retry: {
        retryAttempts: 3,
        baseDelay: 1000,
      },
    },
    retriever: {
      id: 'primary-retriever',
      retry: {
        retryAttempts: 2,
        baseDelay: 500,
      },
    },
    crudTools: { id: 'primary-crud' },
    searchIndexTools: { id: 'primary-search' },
  },
  {
    url: 'mongodb://secondary:27017',
    indexer: {
      id: 'secondary-indexer',
      retry: {
        retryAttempts: 5,
        baseDelay: 2000,
        jitterFactor: 0.2,
      },
    },
    retriever: { id: 'secondary-retriever' },
    crudTools: { id: 'secondary-crud' },
    searchIndexTools: { id: 'secondary-search' },
  },
])
```

### Indexing Documents

```ts
import { Document } from 'genkit';
import { mongoIndexerRef } from 'genkitx-mongodb';

const documents = [
  Document.fromText('Sample document content', { id: '1', category: 'sample' }),
  Document.fromText('Another document', { id: '2', category: 'example' }),
];

await ai.index({
  indexer: mongoIndexerRef('indexer'),
  documents,
  options: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    embedder: googleAI.embedder('text-embedding-004'),
    embeddingField: 'embedding',
    batchSize: 100,
    skipData: false, // Optional: Set to true to exclude original data from storage
    dataField: 'data', // Optional: Custom field name for document data
    metadataField: 'metadata', // Optional: Custom field name for metadata
    dataTypeField: 'dataType', // Optional: Custom field name for data type
  },
});
```

### Vector Search

```ts
import { mongoRetrieverRef } from 'genkitx-mongodb';

const results = await ai.retrieve({
  retriever: mongoRetrieverRef('retriever'),
  query: 'search query',
  options: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    embedder: googleAI.embedder('text-embedding-004'),
    vectorSearch: {
      index: 'embedding_index',
      path: 'embedding',
      exact: false,
      numCandidates: 100,
      limit: 10,
      filter: { category: 'sample' },
    },
  },
});
```

### Text Search

```ts
const results = await ai.retrieve({
  retriever: mongoRetrieverRef('retriever'),
  query: 'search query',
  options: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    search: {
      index: 'text_index',
      text: {
        path: 'content',
        matchCriteria: 'any',
        fuzzy: {
          maxEdits: 2,
          prefixLength: 0,
          maxExpansions: 50,
        },
      },
    },
    pipelines: [
      { $limit: 10 },
      { $sort: { score: -1 } },
    ],
  },
});
```

### CRUD Operations by Document ID

The plugin provides tools for basic CRUD operations by document ID:

```ts
// Create a document
await ai.runTool({
  name: 'mongodb/crud/create',
  input: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    document: { name: 'John', age: 30 },
  },
});

// Read a document by ID
const result = await ai.runTool({
  name: 'mongodb/crud/read',
  input: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    id: '507f1f77bcf86cd799439011',
  },
});

// Update a document by ID
await ai.runTool({
  name: 'mongodb/crud/update',
  input: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    id: '507f1f77bcf86cd799439011',
    document: { age: 31 },
  },
});

// Delete a document by ID
await ai.runTool({
  name: 'mongodb/crud/delete',
  input: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    id: '507f1f77bcf86cd799439011',
  },
});
```

### Search Index Management

```ts
// Create a search index
await ai.runTool({
  name: 'mongodb/search-index/create',
  input: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    indexName: 'text_index',
    definition: {
      mappings: {
        dynamic: true,
        fields: {
          content: {
            type: 'string',
            analyzer: 'lucene.english',
          },
        },
      },
    },
  },
});

// List search indexes
const indexes = await ai.runTool({
  name: 'mongodb/search-index/list',
  input: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
  },
});

// Drop a search index
await ai.runTool({
  name: 'mongodb/search-index/drop',
  input: {
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    indexName: 'text_index',
  },
});
```

### Multimodal Document Processing

The plugin supports multimodal embeddings for processing images and documents:

```ts
import { multimodalEmbedding001 } from '@genkit-ai/vertexai';

// Index images with multimodal embeddings
await ai.index({
  indexer: mongoIndexerRef('indexer'),
  documents: imageDocuments,
  options: {
    dbName: 'myDatabase',
    collectionName: 'imageCollection',
    embedder: multimodalEmbedding001,
    embeddingField: 'imageEmbedding',
    dataField: 'imageData',
    metadataField: 'imageMetadata',
    dataTypeField: 'imageType',
  },
});

// Retrieve similar images
const results = await ai.retrieve({
  retriever: mongoRetrieverRef('retriever'),
  query: 'find images similar to a cat',
  options: {
    dbName: 'myDatabase',
    collectionName: 'imageCollection',
    embedder: multimodalEmbedding001,
    vectorSearch: {
      index: 'image_embedding_index',
      path: 'imageEmbedding',
      numCandidates: 50,
      limit: 5,
    },
  },
});
```

## Configuration Options

### Connection Configuration

```ts
{
  url: string;                   // MongoDB connection string
  mongoClientOptions?: object;   // MongoDB client options
  indexer?: BaseDefinition;      // Indexer configuration
  retriever?: BaseDefinition;    // Retriever configuration
  crudTools?: BaseDefinition;    // CRUD tools configuration
  searchIndexTools?: BaseDefinition; // Search index tools configuration
}
```

### Base Definition Configuration

Each component (indexer, retriever, crudTools, searchIndexTools) uses a base definition:

```ts
{
  id: string;                    // Unique identifier for the component
  retry?: RetryOptions;          // Optional retry options for this component
}
```

### Indexer Options

```ts
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  embedder: EmbedderArgument;    // Embedder for generating vectors
  embedderOptions?: object;      // Optional embedder-specific options
  embeddingField?: string;       // Field name for embeddings (default: 'embedding')
  batchSize?: number;            // Batch size for indexing (default: 100)
  skipData?: boolean;            // Optional: Skip storing original data (default: false)
  dataField?: string;            // Field name for data (default: 'data')
  metadataField?: string;        // Field name for metadata (default: 'metadata')
  dataTypeField?: string;        // Field name for data type (default: 'dataType')
}
```

### Retriever Options

```ts
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  // For vector search:
  embedder?: EmbedderArgument;   // Embedder for query vectorization
  embedderOptions?: object;      // Optional embedder-specific options
  vectorSearch?: {
    index: string;               // Vector search index name
    path: string;                // Field path for vectors
    exact?: boolean;             // Use exact search
    numCandidates?: number;      // Number of candidates (max: 10000)
    limit?: number;              // Result limit
    filter?: object;             // MongoDB filter
  };
  // For text search:
  search?: {
    index: string;               // Text search index name
    text: {
      path: string;              // Field path for text
      matchCriteria?: 'any' | 'all';
      fuzzy?: {
        maxEdits?: number;       // Maximum edit distance (1-2)
        prefixLength?: number;   // Prefix length
        maxExpansions?: number;  // Maximum expansions
      };
      score?: object;            // Score configuration
      synonyms?: string;         // Synonyms collection
    };
  };
  // For hybrid search:
  hybridSearch?: {
    embedder: EmbedderArgument;  // Embedder for hybrid search
    embedderOptions?: object;    // Optional embedder-specific options
  };
  pipelines?: array;             // Aggregation pipeline stages
}
```

### CRUD Tool Options

```ts
// Create
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  document: object;              // Document to create
}

// Read
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  id: string;                    // Document ID (24-character hex string)
}

// Update
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  id: string;                    // Document ID (24-character hex string)
  document: object;              // Update document (use MongoDB operators like $set)
}

// Delete
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  id: string;                    // Document ID (24-character hex string)
}
```

### Search Index Tool Options

```ts
// Create
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  indexName: string;             // Index name
  definition: object;            // Index definition
}

// List
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
}

// Drop
{
  dbName: string;                // Database name
  dbOptions?: object;            // Database options
  collectionName: string;        // Collection name
  collectionOptions?: object;    // Collection options
  indexName: string;             // Index name to drop
}
```

### Retry Options

Retry options can be configured for individual components (indexer, retriever, crudTools, searchIndexTools):

```ts
{
  retryAttempts?: number;        // Number of retry attempts (default: 0)
  baseDelay?: number;            // Base delay in milliseconds (default: 1000)
  jitterFactor?: number;         // Jitter factor for exponential backoff (default: 0.1)
}
```

Each component can have its own retry configuration, allowing fine-grained control over retry behavior for different operations.

## Tool References

The plugin provides helper functions to generate tool references:

```ts
import { mongoCrudToolsRefArray, mongoSearchIndexToolsRefArray } from 'genkitx-mongodb';

// Get all CRUD tool references for a connection
const crudTools = mongoCrudToolsRefArray('my-connection-id');
// Returns: ['mongodb/my-connection-id/create', 'mongodb/my-connection-id/read', ...]

// Get all search index tool references for a connection
const searchIndexTools = mongoSearchIndexToolsRefArray('my-connection-id');
// Returns: ['mongodb/my-connection-id/create', 'mongodb/my-connection-id/list', ...]
```

## Examples

See the [test application](https://github.com/firebase/genkit/tree/main/js/testapps/mongodb) for complete examples including:

- Menu item indexing and retrieval with vector and text search
- Image document processing with multimodal embeddings
- CRUD operations by document ID
- Search index management
- Document processing with chunking and image extraction
- Multiple connection configurations
- Hybrid search workflows

## Requirements

- MongoDB 6.0+ with Atlas Search or local search indexes
- Node.js 18+
- Genkit framework

## License

Apache 2.0

The sources for this package are in the main [Genkit](https://github.com/firebase/genkit) repo. Please file issues and pull requests against that repo.

Usage information and reference details can be found in [Genkit documentation](https://genkit.dev/docs/get-started).