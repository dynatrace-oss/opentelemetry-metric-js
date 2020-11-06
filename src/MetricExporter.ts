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

import { ExportResult, hrTimeToMilliseconds, NoopLogger } from "@opentelemetry/core";
import * as api from '@opentelemetry/api';
import { AggregatorKind, MetricExporter, MetricKind, MetricRecord, Point } from "@opentelemetry/metrics";
import { ExporterConfig } from "./export/types";
import axios from 'axios';

export class DynatraceMetricExporter implements MetricExporter {

  private readonly DEFAULT_OPTIONS = {
    url: 'http://127.0.0.1:14499/metrics/ingest',
  }

  private readonly _logger: api.Logger;
  private readonly _url: string;
  private readonly _APIToken: string;
  private readonly _prefix: string;

  /**
   * Constructor
   * @param config Exporter configuration
  */
  constructor(config: ExporterConfig = {}) {
    this._logger = config.logger || new NoopLogger();
    this._url = config.url || this.DEFAULT_OPTIONS.url;
    this._APIToken = config.APIToken || '';
    this._prefix = config.prefix || '';
  }

  export(metrics: MetricRecord[], resultCallback: (result: ExportResult) => void): void {
    const linestrings: Array<string> = [];
    metrics.forEach((metric) => {
      const metricLine: Array<string> = [];
      metricLine.push(this.formatMetricKey(metric));
      metricLine.push(this.formatDimensions(metric));
      switch (metric.aggregator.kind) {
        case AggregatorKind.SUM: {
          const data = metric.aggregator.toPoint();

          if (metric.descriptor.metricKind === MetricKind.COUNTER || metric.descriptor.metricKind === MetricKind.SUM_OBSERVER) {
            metricLine.push(this.formatCount(data.value));
          } else {
            metricLine.push(this.formatGauge(data.value));
          }
          break;
        }
        case AggregatorKind.HISTOGRAM: {
          this._logger.debug('HISTOGRAM is not implemented');
          break;
        }
        case AggregatorKind.LAST_VALUE: {
          this._logger.debug('LAST_VALUE is not implemented');
          break;
        }
      }

      const ts = this.formatTimestamp(metric.aggregator.toPoint().timestamp);

      const lineString = `${metricLine.join('')} ${ts}`;
      linestrings.push(lineString);
      // Todo use raw HTTP
      axios({
        method: 'post',
        url: this._url,
        headers: {
          'Authorization': `Api-Token ${this._APIToken}`,
          'Content-Type': 'text/plain; charset=utf-8',
        },
        data: linestrings.join("\n"),
      }).then((res) => {
        console.log(res);
      }).catch((err) => {
        console.error(err.response.data.error);
      });

      // Todo: return exporter result

    });
  }

  // Todo: add sanitization
  private formatMetricKey(metric: MetricRecord) {
    return this._prefix ? `${this._prefix}.${metric.descriptor.name}` : metric.descriptor.name;
  }

  // Todo add tags
  private formatDimensions(metric: MetricRecord) {
    const labels = Object.keys(metric.labels)
      .map(k => `${k}=${metric.labels[k]}`)
      .join(',');
    return `,${labels}`;
  }

  private formatTimestamp(ts: api.HrTime) {
    return hrTimeToMilliseconds(ts);
  }

  private formatCount(value: number) {
    return ` count,delta=${value}`;
  }

  private formatGauge(value: number) {
    return ` gauge,${value}`;
  }

  // Todo: Flush?
  shutdown(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
