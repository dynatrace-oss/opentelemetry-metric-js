/*
	Copyright 2020 Dynatrace LLC

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

import { Dimension } from "./utils/metric/metric";
// re-export type because it is used in the config
export { Dimension } from "./utils/metric/metric";

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
	 * Default dimensions to be included on every metric
	 */
	defaultDimensions?: Array<Dimension>;

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

	/**
	 * Set false to disable OneAgent metadata enrichment
	 *
	 * @default true
	 */
	oneAgentMetadataEnrichment?: boolean;
}
