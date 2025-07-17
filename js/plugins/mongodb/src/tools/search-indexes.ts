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
import { MongoClient } from 'mongodb';
import { getCollection } from '../common/connection';
import { SEARCH_INDEX_TOOL_ID, toolRef } from '../common/constants';
import { retryWithDelay } from '../common/retry';
import {
  BaseDefinition,
  InputSearchIndexCreateSchema,
  InputSearchIndexDropSchema,
  InputSearchIndexListSchema,
  OutputSearchIndexCreateSchema,
  OutputSearchIndexDropSchema,
  OutputSearchIndexListSchema,
  validateSearchIndexCreateOptions,
  validateSearchIndexDropOptions,
  validateSearchIndexListOptions,
} from '../common/types';

function configureCreateSearchIndexTool(
  ai: Genkit,
  client: MongoClient,
  options: BaseDefinition
) {
  ai.defineTool(
    {
      name: toolRef(options.id, SEARCH_INDEX_TOOL_ID.create),
      description: `Create a text search index on MongoDB`,
      inputSchema: InputSearchIndexCreateSchema,
      outputSchema: OutputSearchIndexCreateSchema,
    },
    async (input) => {
      try {
        const parsedInput = validateSearchIndexCreateOptions(input);

        const collection = getCollection(
          client,
          parsedInput.dbName,
          parsedInput.collectionName,
          parsedInput.dbOptions,
          parsedInput.collectionOptions
        );

        const result = await retryWithDelay(
          async () => await collection.createSearchIndex(parsedInput.schema),
          options.retry
        );

        return {
          indexName: result,
          success: true,
          message: `Search index creation operation started successfully: ${result}`,
        };
      } catch (error) {
        return {
          indexName: '',
          success: false,
          message: `Failed to create search index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
  );
}

function configureListSearchIndexesTool(
  ai: Genkit,
  client: MongoClient,
  options: BaseDefinition
) {
  ai.defineTool(
    {
      name: toolRef(options.id, SEARCH_INDEX_TOOL_ID.list),
      description: `List all indexes on MongoDB`,
      inputSchema: InputSearchIndexListSchema,
      outputSchema: OutputSearchIndexListSchema,
    },
    async (input) => {
      try {
        const parsedInput = validateSearchIndexListOptions(input);

        const collection = getCollection(
          client,
          parsedInput.dbName,
          parsedInput.collectionName,
          parsedInput.dbOptions,
          parsedInput.collectionOptions
        );

        const indexes = await retryWithDelay(
          async () => await collection.listSearchIndexes().toArray(),
          options.retry
        );

        return {
          indexes,
          success: true,
          message: `Found ${indexes.length} indexes on collection ${collection.collectionName}`,
        };
      } catch (error) {
        return {
          indexes: [],
          success: false,
          message: `Failed to list indexes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
  );
}

function configureDropSearchIndexTool(
  ai: Genkit,
  client: MongoClient,
  options: BaseDefinition
) {
  ai.defineTool(
    {
      name: toolRef(options.id, SEARCH_INDEX_TOOL_ID.drop),
      description: `Drop an index by name from MongoDB`,
      inputSchema: InputSearchIndexDropSchema,
      outputSchema: OutputSearchIndexDropSchema,
    },
    async (input) => {
      try {
        const parsedInput = validateSearchIndexDropOptions(input);

        const collection = getCollection(
          client,
          parsedInput.dbName,
          parsedInput.collectionName,
          parsedInput.dbOptions,
          parsedInput.collectionOptions
        );

        await retryWithDelay(
          async () => await collection.dropSearchIndex(parsedInput.indexName),
          options.retry
        );

        return {
          success: true,
          message: `Index ${parsedInput.indexName} drop operation started successfully`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to drop index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
  );
}

export function defineSearchIndexTools(
  ai: Genkit,
  client: MongoClient,
  definition?: BaseDefinition
) {
  if (!definition?.id) {
    return;
  }
  configureCreateSearchIndexTool(ai, client, definition);
  configureListSearchIndexesTool(ai, client, definition);
  configureDropSearchIndexTool(ai, client, definition);
}

export const mongoSearchIndexToolsRefArray = (id: string) =>
  Object.values(SEARCH_INDEX_TOOL_ID).map((toolId) => toolRef(id, toolId));
