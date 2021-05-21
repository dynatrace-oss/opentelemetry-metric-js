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

import * as api from "@opentelemetry/api";
import { ExportResult, ExportResultCode, hrTimeToMilliseconds } from "@opentelemetry/core";
import { AggregatorKind, MetricExporter, MetricRecord } from "@opentelemetry/metrics";
import * as http from "http";
import * as https from "https";
import * as url from "url";
import { ExporterConfig } from "./types";
import { getDefaultBaseUrl, getPayloadLinesLimit } from "./utils/constants";
import { getOneAgentMetadata } from "./utils/enrichment";
import { Metric, SummaryValue } from "./utils/metric/metric";
import { MetricFactory } from "./utils/metric/metric-factory";


export class DynatraceMetricExporter implements MetricExporter {
	private readonly _reqOpts: http.RequestOptions;
	private readonly _httpRequest: typeof http.request | typeof https.request;
	private _isShutdown = false;
	private _dtMetricFactory: MetricFactory;

	private _failedNormalizations = 0;

	/**
   * Constructor
   * @param config Exporter configuration
   */
	constructor(config: ExporterConfig = {}) {
		const defaultDimensions = config.defaultDimensions?.slice() ?? [];
		const oneAgentMetadata = getOneAgentMetadata();

		defaultDimensions.unshift({ key: "dt.metrics.source", value: "opentelemetry" });

		this._dtMetricFactory = new MetricFactory({
			prefix: config.prefix,
			defaultDimensions: [...oneAgentMetadata, ...defaultDimensions]
		});

		const urlObj = new url.URL(config.url ?? getDefaultBaseUrl());
		const proto = this._getHttpProto(urlObj);
		this._httpRequest = proto.request;

		const headers: Record<string, string> = {
			"Content-Type": "text/plain; charset=utf-8",
			"User-Agent": "opentelemetry-metric-js"
		};

		if (config.APIToken) {
			headers.Authorization = `Api-Token ${config.APIToken}`;
		}

		this._reqOpts = {
			method: "POST",
			hostname: urlObj.hostname,
			protocol: urlObj.protocol,
			port: urlObj.port,
			path: urlObj.pathname,
			agent: new proto.Agent({
				keepAlive: true,
				maxSockets: 1
			}),
			headers
		};
	}

	export(
		metrics: MetricRecord[],
		resultCallback: (result: ExportResult) => void
	): void {
		if (metrics.length === 0) {
			process.nextTick(resultCallback, { code: ExportResultCode.SUCCESS });
			return;
		}

		if (this._isShutdown) {
			process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
			return;
		}

		// If the batch has more than 1000 metrics, export them in multiple
		// batches serially. There is no advantage of parallelizing since
		// the CPU work is single threaded anyway and there is only a single
		// connection to the server.
		//
		// If a single batch fails, the entire batch will be considered a failure.
		if (metrics.length > getPayloadLinesLimit()) {
			return this.export(metrics.slice(0, getPayloadLinesLimit()), (result) => {
				if (result.code !== ExportResultCode.SUCCESS) {
					resultCallback(result);
					return;
				}

				this.export(metrics.slice(getPayloadLinesLimit()), resultCallback);
			});
		}

		const dtMetrics = metrics.map((metric) => {
			const dimensions = Object.entries(metric.labels).map(([key, value]) => ({ key, value }));
			switch (metric.aggregator.kind) {
				case AggregatorKind.SUM: {
					const data = metric.aggregator.toPoint();
					const normalizedMetric = this._dtMetricFactory
						.createTotalCounter(
							metric.descriptor.name,
							dimensions,
							data.value,
							hrTimeToMilliseconds(data.timestamp)
						);
					if (normalizedMetric == null) {
						this._warnNormalizationFailure(metric.descriptor.name);
					}
					return normalizedMetric;
				}
				case AggregatorKind.HISTOGRAM: {
					const data = metric.aggregator.toPoint();
					const { sum, count } = data.value;

					// TODO remove this hack which pretends all data points had the same value
					const avg = sum / count;

					const value: SummaryValue = {
						min: avg,
						max: avg,
						sum,
						count
					};
					const normalizedMetric = this._dtMetricFactory
						.createSummary(
							metric.descriptor.name,
							dimensions,
							value,
							hrTimeToMilliseconds(data.timestamp)
						);
					if (normalizedMetric == null) {
						this._warnNormalizationFailure(metric.descriptor.name);
					}
					return normalizedMetric;
				}
				case AggregatorKind.LAST_VALUE: {
					const data = metric.aggregator.toPoint();
					const normalizedMetric = this._dtMetricFactory
						.createGauge(
							metric.descriptor.name,
							dimensions,
							data.value,
							hrTimeToMilliseconds(data.timestamp)
						);
					if (normalizedMetric == null) {
						this._warnNormalizationFailure(metric.descriptor.name);
					}
					return normalizedMetric;
				}
			}
		});

		const lines = dtMetrics
			.filter((m): m is Metric => m != null)
			.map(m => m.serialize());

		if (lines.length === 0) {
			process.nextTick(resultCallback, { code: ExportResultCode.SUCCESS });
			return;
		}

		const payload = lines.join("\n");

		const request = this._httpRequest(this._reqOpts);
		const self = this;

		function onResponse(res: http.IncomingMessage) {
			api.diag.debug(`request#onResponse: statusCode: ${res.statusCode}`);


			res.on("error", e => {
				// no need for handling a response error as a valid statusCode has
				// been received before which indicates message was received
				api.diag.debug(`response#error: ${e.message}`);
			});

			if (
				res.statusCode != null &&
				res.statusCode >= 200 &&
				res.statusCode < 300
			) {
				res.resume(); // discard any incoming data
				process.nextTick(resultCallback, { code: ExportResultCode.SUCCESS });
			} else if (res.statusCode === 401 || res.statusCode === 403) {
				res.resume(); // discard any incoming data
				api.diag.warn("Not authorized to send spans to Dynatrace");
				// 401/403 is permanent
				self._isShutdown = true;
				process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
			} else {
				api.diag.warn(
					`Received status code ${res.statusCode} from Dynatrace`
				);
				res.on("data", (chunk: Buffer) => {
					api.diag.debug("response#data:", chunk.toString("utf8"));
				});
				process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
			}
		}

		function onError(err: Error) {
			api.diag.error(err.message);
			process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
			return;
		}

		request.on("response", onResponse);
		request.on("error", onError);

		request.end(payload);
	}

	private _getHttpProto(urlObj: url.URL) {
		let proto: typeof https | typeof http;
		switch (urlObj.protocol) {
			case "http:":
				proto = http;
				break;
			case "https:":
				proto = https;
				break;
			default:
				throw new RangeError(
					"DynatraceMetricExporter: options.url protocol unsupported"
				);
		}
		return proto;
	}

	shutdown(): Promise<void> {
		// no buffer to flush;
		this._isShutdown = true;
		return Promise.resolve();
	}

	private _warnNormalizationFailure(name: string) {
		if (this._failedNormalizations === 0) {
			api.diag.warn(`DynatraceMetricExporter: Failed to normalize ${name}. Skipping exporting this metric.`);
		}
		this._failedNormalizations = ++this._failedNormalizations % 1000;
	}
}
