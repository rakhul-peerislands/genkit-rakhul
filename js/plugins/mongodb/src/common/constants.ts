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

export const DEFAULT_EMBEDDING_FIELD_NAME = 'embedding';
export const DEFAULT_DATA_FIELD_NAME = 'data';
export const DEFAULT_METADATA_FIELD_NAME = 'metadata';
export const DEFAULT_DATA_TYPE_FIELD_NAME = 'dataType';

export const DEFAULT_BATCH_SIZE = 100;

export const RETRY_ATTEMPTS = 0;
export const BASE_RETRY_DELAY_MS = 1000;
export const JITTER_FACTOR = 0.1;

export const MAX_NUM_CANDIDATES = 10000;

export const CRUD_TOOL_ID = {
  create: 'create',
  read: 'read',
  update: 'update',
  delete: 'delete',
};

export const SEARCH_INDEX_TOOL_ID = {
  create: 'create',
  list: 'list',
  drop: 'drop',
};

export const toolRef = (id: string, toolId: string) =>
  `mongodb/${id}/${toolId}`;
