/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Embedding, Genkit } from 'genkit';
import { Document, indexerRef } from 'genkit/retriever';
import {
  Collection,
  InsertManyResult,
  MongoClient,
  Document as MongoDocument,
} from 'mongodb';
import { getCollection } from '../common/connection';
import { retryWithDelay } from '../common/retry';
import {
  BaseDefinition,
  IndexerOptions,
  IndexerOptionsSchema,
  RetryOptions,
  validateIndexerOptions,
} from '../common/types';

async function generateEmbeddings(
  ai: Genkit,
  documents: Array<Document>,
  options: IndexerOptions
): Promise<Array<Array<Embedding>>> {
  return await Promise.all(
    documents.map((document) =>
      ai.embed({
        embedder: options.embedder,
        options: options.embedderOptions,
        content: document,
      })
    )
  );
}

function createMongoDocuments(
  documents: Array<Document>,
  embeddings: Array<Array<Embedding>>,
  options: IndexerOptions
): Array<MongoDocument> {
  const { embeddingField, dataField, dataTypeField, metadataField, skipData } =
    options;
  return documents.flatMap((document, documentIndex) => {
    const embeddingDocuments: Array<Document> = document.getEmbeddingDocuments(
      embeddings[documentIndex]
    );
    return embeddingDocuments.map(
      (embeddingDocument: Document, embeddingDocumentIndex: number) => {
        const embedding =
          embeddings[documentIndex][embeddingDocumentIndex]?.embedding;
        if (!embedding) {
          throw new Error(
            `Missing embedding for document ${documentIndex}, chunk ${embeddingDocumentIndex}`
          );
        }
        const mongoDocument: MongoDocument = {
          [embeddingField]: embedding,
          [dataTypeField]: embeddingDocument.dataType,
          [metadataField]: embeddingDocument.metadata,
          createdAt: new Date(),
        };
        if (!skipData) {
          mongoDocument[dataField] = embeddingDocument.data;
        }

        return mongoDocument;
      }
    );
  });
}

async function processDocumentBatch(
  ai: Genkit,
  collection: Collection,
  documents: Array<Document>,
  options: IndexerOptions,
  retryOptions?: RetryOptions
): Promise<InsertManyResult<MongoDocument>> {
  return retryWithDelay(async () => {
    const embeddings = await generateEmbeddings(ai, documents, options);
    const mongoDocuments = createMongoDocuments(documents, embeddings, options);
    return await collection.insertMany(mongoDocuments as Array<MongoDocument>, {
      ordered: false,
    });
  }, retryOptions);
}

async function index(
  ai: Genkit,
  collection: Collection,
  documents: Array<Document>,
  options: IndexerOptions,
  retryOptions?: RetryOptions
) {
  const batchSize = options.batchSize;
  const batchPromises: Array<Promise<InsertManyResult<MongoDocument>>> = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    batchPromises.push(
      processDocumentBatch(ai, collection, batch, options, retryOptions)
    );
  }

  await Promise.all(batchPromises);
}

function configureIndexer(
  ai: Genkit,
  client: MongoClient,
  definition: BaseDefinition
) {
  return ai.defineIndexer(
    {
      name: `mongodb/${definition.id}`,
      configSchema: IndexerOptionsSchema,
    },
    async (documents: Array<Document>, options: IndexerOptions) => {
      try {
        const parsedOptions = validateIndexerOptions(options);

        const collection = getCollection(
          client,
          parsedOptions.dbName,
          parsedOptions.collectionName,
          parsedOptions.dbOptions,
          parsedOptions.collectionOptions
        );

        await index(ai, collection, documents, parsedOptions, definition.retry);
      } catch (error) {
        throw new Error(
          `Mongo indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

export function defineIndexer(
  ai: Genkit,
  client: MongoClient,
  definition?: BaseDefinition
) {
  if (!definition?.id) {
    return;
  }
  configureIndexer(ai, client, definition);
}

export function mongoIndexerRef(id: string) {
  return indexerRef({
    name: `mongodb/${id}`,
    info: {
      label: `Mongo Indexer - ${id}`,
    },
    configSchema: IndexerOptionsSchema,
  });
}
