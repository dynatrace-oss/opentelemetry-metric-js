/*
	Copyright 2022 Dynatrace LLC

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

import { ExporterConfig, ReaderConfig } from "./types";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { DynatraceMetricExporter } from "./DynatraceMetricExporter";

/**
 * Configure a {@link PeriodicExportingMetricReader} to export to Dynatrace.
 * @param exporterConfig configuration properties for the export to Dynatrace.
 * @param readerConfig configuration for the {@link PeriodicExportingMetricReader metric reader}.
 */
export function configureDynatraceMetricExport(exporterConfig: ExporterConfig = {}, readerConfig: ReaderConfig = {}): PeriodicExportingMetricReader {
	return new PeriodicExportingMetricReader(
		{
			exporter: new DynatraceMetricExporter(exporterConfig),
			...readerConfig
		}
	);
}
