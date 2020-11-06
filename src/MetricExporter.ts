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

import { ExportResult, NoopLogger } from "@opentelemetry/core";
import * as api from '@opentelemetry/api';
import { MetricExporter, MetricRecord } from "@opentelemetry/metrics";
import { ExporterConfig } from "./export/types";

export class DynatraceMetricExporter implements MetricExporter {

  static readonly DEFAULT_OPTIONS = {

  }

  private readonly _logger: api.Logger;


  export(metrics: MetricRecord[], resultCallback: (result: ExportResult) => void): void {
    throw new Error("Method not implemented.");
  }

  shutdown(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  /**
   * Constructor
   * @param config Exporter configuration
   */
  constructor(config: ExporterConfig = {}) {
    this._logger = config.logger || new NoopLogger();
  }
}
