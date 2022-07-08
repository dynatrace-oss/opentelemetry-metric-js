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

import { Dimension } from "@dynatrace/metric-utils";

export { Dimension } from "@dynatrace/metric-utils";

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
	 * @default 'http://localhost:14499/metrics/ingest'
	 */
	url?: string;

	/**
	 * Dynatrace API token.
	 * Can be omitted if the local OneAgent endpoint is used.
	 * @default ''
	 */
	apiToken?: string;

	/**
	 * @deprecated please use apiToken
	 */
	APIToken?: string;

	/**
	 * Set false to disable Dynatrace metadata enrichment
	 *
	 * @default true
	 */
	dynatraceMetadataEnrichment?: boolean;

	/**
	 * The number of times the exporter should retry before returning failure
	 *
	 * @default 3
	 */
	maxRetries?: number;

	/**
	 * The time in milliseconds to wait before retrying an export that failed due to a connection error
	 *
	 * @default 1000
	 */
	retryDelay?: number;
}

export interface ReaderConfig {
	/**
	 * The interval in which metrics are exported using the PeriodicExportingMetricReader
	 *
	 * @default 60000
	 */
	exportIntervalMillis?: number;

	/**
	 * The maximum timeout to wait for an export to finish
	 *
	 * @default 30000
	 */
	exportTimeoutMillis?: number;
}
