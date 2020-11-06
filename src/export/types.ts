/*
Copyright 2020 Dynatrace LLC

Licensed under the Apache License, Version 2.0(the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as api from '@opentelemetry/api';

/**
 * Configuration interface for Dynatrace metrics exporter
 */
export interface ExporterConfig {

  /**
   * App prefix for metrics, if needed
   *
   * @default ''
   * */
  prefix?: string;

  /**
   * Default tags to be appended
   *
   * @default []
  */
  tags?: Array<string>;

  /**
   * Url of the Dynatrace metrics ingest endpoint.
   * This defaults to a local endpoint provided by the Dynatrace OneAgent.
   * @default 'http://127.0.0.1:14499/metrics/ingest'
   */
  url?: string;

  /**
   * Dynatrace API token.
   * Can be ommitted if the local OneAgent endpoint is used.
   * @default ''
  */
  APIToken?: string;

  /** Standard logging interface */
  logger?: api.Logger;
}

export interface Metric
