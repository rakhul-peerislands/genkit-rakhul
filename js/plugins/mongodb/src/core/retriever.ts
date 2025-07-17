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

import { Genkit } from 'genkit';
import { Document, retrieverRef } from 'genkit/retriever';
import { Collection, MongoClient, Document as MongoDocument } from 'mongodb';
import { getCollection } from '../common/connection';
import { retryWithDelay } from '../common/retry';
import {
  BaseDefinition,
  EmbedderOptions,
  HybridSearchOptions,
  RetrieverOptions,
  RetrieverOptionsSchema,
  RetryOptions,
  TextSearchOptions,
  VectorSearchOptions,
  validateRetrieverOptions,
} from '../common/types';

function appendPipeline(pipeline1?: Array<any>, pipeline2?: Array<any>) {
  const pipeline: Array<any> = [];
  if (pipeline1 && pipeline1.length > 0) {
    pipeline.push(...pipeline1);
  }
  if (pipeline2 && pipeline2.length > 0) {
    pipeline.push(...pipeline2);
  }
  return pipeline;
}

function createTextSearchStage(query: string, options: TextSearchOptions): any {
  return {
    $search: { index: options.index, text: { ...options.text, query } },
  };
}

function createVectorSearchStage(
  queryVector: number[],
  options: VectorSearchOptions
): any {
  return {
    $vectorSearch: {
      ...options,
      queryVector,
    },
  };
}

function createHybridSearchStage(
  document: Document,
  options: HybridSearchOptions
): any {
  return {};
}

async function executeSearchPipeline(
  collection: Collection,
  pipeline: Array<any>,
  retryOptions?: RetryOptions
): Promise<Array<MongoDocument>> {
  return retryWithDelay(async () => {
    return await collection.aggregate(pipeline).toArray();
  }, retryOptions);
}

async function convertResultsToDocuments(
  results: Array<MongoDocument>,
  options: RetrieverOptions
): Promise<Array<Document>> {
  const { dataField, dataTypeField, metadataField } = options;
  return results.map((result) => {
    let data = '';
    if (result[dataField]) {
      data = result[dataField];
    }
    return Document.fromData(
      data,
      result[dataTypeField],
      result[metadataField]
    );
  });
}

async function generateEmbeddings(
  ai: Genkit,
  document: Document,
  options: EmbedderOptions
): Promise<Array<number>> {
  const embeddings = await ai.embed({
    embedder: options.embedder,
    options: options.embedderOptions,
    content: document,
  });
  return embeddings[0].embedding;
}

async function createSearchPipeline(
  ai: Genkit,
  document: Document,
  options: RetrieverOptions
): Promise<Array<any>> {
  try {
    const pipeline: Array<any> = [];

    if ('search' in options) {
      pipeline.push(createTextSearchStage(document.data, options.search));
    } else if ('vectorSearch' in options) {
      const embedder: EmbedderOptions = {
        embedder: options.embedder,
        embedderOptions: options.embedderOptions,
      };
      const embedding: Array<number> = await generateEmbeddings(
        ai,
        document,
        embedder
      );
      pipeline.push(createVectorSearchStage(embedding, options.vectorSearch));
    } else if ('hybridSearch' in options) {
      pipeline.push(createHybridSearchStage(document, options.hybridSearch));
    } else {
      throw new Error(`Unknown retrieval options provided: ${options}`);
    }

    return appendPipeline(pipeline, options.pipelines);
  } catch (error) {
    throw new Error(
      `Failed to create search pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function retrieve(
  ai: Genkit,
  collection: Collection,
  document: Document,
  options: RetrieverOptions,
  retryOptions?: RetryOptions
) {
  try {
    const pipeline = await createSearchPipeline(ai, document, options);
    const results = await executeSearchPipeline(
      collection,
      pipeline,
      retryOptions
    );
    const documents = await convertResultsToDocuments(results, options);

    return { documents };
  } catch (error) {
    throw new Error(
      `Mongo retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function configureRetriever(
  ai: Genkit,
  client: MongoClient,
  definition: BaseDefinition
) {
  return ai.defineRetriever(
    {
      name: `mongodb/${definition.id}`,
      configSchema: RetrieverOptionsSchema,
    },
    async (document: Document, options: RetrieverOptions) => {
      try {
        const parsedOptions = validateRetrieverOptions(options);

        const collection = getCollection(
          client,
          parsedOptions.dbName,
          parsedOptions.collectionName,
          parsedOptions.dbOptions,
          parsedOptions.collectionOptions
        );
        return await retrieve(
          ai,
          collection,
          document,
          parsedOptions,
          definition.retry
        );
      } catch (error) {
        throw new Error(
          `Mongo retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

export function defineRetriever(
  ai: Genkit,
  client: MongoClient,
  definition?: BaseDefinition
) {
  if (!definition?.id) {
    return;
  }
  configureRetriever(ai, client, definition);
}

export function mongoRetrieverRef(id: string) {
  return retrieverRef({
    name: `mongodb/${id}`,
    info: {
      label: `Mongo Retriever - ${id}`,
    },
    configSchema: RetrieverOptionsSchema,
  });
}
