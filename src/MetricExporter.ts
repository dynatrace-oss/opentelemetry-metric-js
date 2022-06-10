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

import { Dimension, getDefaultOneAgentEndpoint, getDynatraceMetadata, MetricFactory } from "@dynatrace/metric-utils";
import { diag } from "@opentelemetry/api";
import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { AggregationTemporality, DataPoint, DataPointType, InstrumentType, MetricData, PushMetricExporter, ResourceMetrics } from "@opentelemetry/sdk-metrics-base";
import * as http from "http";
import * as https from "https";
import * as url from "url";
import { estimateHistogram } from "./histogram";
import { ExporterConfig } from "./types";

export class DynatraceMetricExporter implements PushMetricExporter {
	private readonly _reqOpts: http.RequestOptions;
	private readonly _httpRequest: typeof http.request | typeof https.request;
	private readonly _maxRetries: number;
	private readonly _retryDelay: number;
	private _isShutdown = false;
	private _dtMetricFactory: MetricFactory;

	/**
	 * Constructor
	 * @param config Exporter configuration
	 */
	constructor(config: ExporterConfig = {}) {
		const defaultDimensions = config.defaultDimensions?.slice() ?? [];

		const dynatraceMetadata = config.dynatraceMetadataEnrichment === false
			? undefined
			: getDynatraceMetadata();

		if (config.maxRetries != null && config.maxRetries < 0) {
			throw new Error("Cannot use retry value < 0");
		}

		if (config.retryDelay != null && config.retryDelay < 0) {
			throw new Error("Cannot use retry delay < 0");
		}

		this._maxRetries = config.maxRetries ?? 3;
		this._retryDelay = config.retryDelay ?? 1000;

		this._dtMetricFactory = new MetricFactory({
			prefix: config.prefix,
			defaultDimensions: defaultDimensions,
			staticDimensions: dynatraceMetadata
		});

		const urlObj = new URL(config.url ?? getDefaultOneAgentEndpoint());
		const proto = this._getHttpProto(urlObj);
		this._httpRequest = proto.request;

		const headers: Record<string, string> = {
			"Content-Type": "text/plain; charset=utf-8",
			"User-Agent": "opentelemetry-metric-js"
		};

		// eslint-disable-next-line deprecation/deprecation
		const apiToken = config.apiToken ?? config.APIToken;
		if (apiToken) {
			headers.Authorization = `Api-Token ${apiToken}`;
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

	selectAggregationTemporality(instrumentType: InstrumentType): AggregationTemporality {
		switch (instrumentType) {
			case InstrumentType.OBSERVABLE_GAUGE:
			case InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
			case InstrumentType.UP_DOWN_COUNTER:
				return AggregationTemporality.CUMULATIVE;
			default:
				return AggregationTemporality.DELTA;
		}
	}

	// nothing is buffered so there is no need to flush
	forceFlush(): Promise<void> { return Promise.resolve(); }

	export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
		if (this._isShutdown) {
			process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
			return;
		}

		if (metrics.scopeMetrics.length === 0) {
			process.nextTick(resultCallback, { code: ExportResultCode.SUCCESS });
			return;
		}

		let lines: string[] = [];
		for (const scopeMetric of metrics.scopeMetrics) {
			for (const metric of scopeMetric.metrics) {
				switch (metric.descriptor.type) {
					case InstrumentType.COUNTER:
					case InstrumentType.OBSERVABLE_COUNTER:
						lines = lines.concat(this.serializeCounter(metric));
						break;
					case InstrumentType.OBSERVABLE_GAUGE:
					case InstrumentType.UP_DOWN_COUNTER:
						lines.push(...this.serializeGauge(metric));
						break;
					case InstrumentType.HISTOGRAM:
						lines.push(...this.serializeHistogram(metric));
						break;
					default:
				}
			}
		}

		this._sendLines(lines, resultCallback);
	}

	private _sendLines(lines: string[], resultCallback: (result: ExportResult) => void) {
		// If the batch has more than 1000 metrics, export them in multiple batches.
		const batch = lines.slice(0, 1000);
		const remaining = lines.slice(1000);
		if (batch.length === 0) {
			process.nextTick(resultCallback, { code: ExportResultCode.SUCCESS });
			return;
		}

		const payload = batch.join("\n");

		this._sendRequest(payload, (result: ExportResult) => {
			// if a batch fails, do not send the rest
			if (result.code === ExportResultCode.FAILED || remaining.length === 0) {
				return resultCallback(result);
			}

			this._sendLines(remaining, resultCallback);
		}, this._maxRetries);
	}

	private _sendRequest(payload: string, resultCallback: (result: ExportResult) => void, remainingRetries: number) {
		const request = this._httpRequest(this._reqOpts);
		const self = this;

		function onResponse(res: http.IncomingMessage) {
			diag.debug(`request#onResponse: statusCode: ${res.statusCode}`);

			res.on("error", e => {
				// no need for handling a response error as a valid statusCode has
				// been received before which indicates message was received
				diag.debug(`response#error: ${e.message}`);
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
				diag.warn("Not authorized to send spans to Dynatrace");
				// 401/403 is permanent
				self._isShutdown = true;
				process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
			} else {
				// If some lines were invalid, a 400 status code will end up here
				diag.warn(
					`Received status code ${res.statusCode} from Dynatrace`
				);
				res.on("data", (chunk: Buffer) => {
					diag.debug("response#data:", chunk.toString("utf8"));
				});
				process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
			}
		}

		function onError(err: Error) {
			diag.error(err.message);

			if (remainingRetries > 0) {
				// retry after the configured time.
				setTimeout(() => self._sendRequest(payload, resultCallback, remainingRetries - 1), self._retryDelay);
				return;
			}

			process.nextTick(resultCallback, { code: ExportResultCode.FAILED });
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

	private serializeCounter(metric: MetricData): string[] {
		const out: string[] = [];
		if (metric.dataPointType !== DataPointType.SINGULAR) {
			return out;
		}

		for (const point of metric.dataPoints) {
			const counter = this._dtMetricFactory.createCounterDelta(metric.descriptor.name, dimensionsFromPoint(point), point.value);
			if (counter) {
				out.push(counter.serialize());
			}
		}

		return out;
	}

	private serializeHistogram(metric: MetricData): string[] {
		const out: string[] = [];
		if (metric.dataPointType !== DataPointType.HISTOGRAM) {
			return out;
		}

		for (const point of metric.dataPoints) {
			const summaryValue = estimateHistogram(point);

			if (summaryValue == null) {
				continue;
			}

			const summary = this._dtMetricFactory.createSummary(
				metric.descriptor.name,
				dimensionsFromPoint(point),
				summaryValue
			);

			if (summary) {
				out.push(summary.serialize());
			}
		}
		return out;
	}

	private serializeGauge(metric: MetricData): string[] {
		const out: string[] = [];
		if (metric.dataPointType !== DataPointType.SINGULAR) {
			return out;
		}

		for (const point of metric.dataPoints) {
			const gauge = this._dtMetricFactory.createGauge(metric.descriptor.name, dimensionsFromPoint(point), point.value);
			if (gauge) {
				out.push(gauge.serialize());
			}
		}

		return out;
	}
}

function dimensionsFromPoint(point: DataPoint<unknown>): Dimension[] {
	return Object.entries(point.attributes).map(([key, value]) => ({ key, value }));
}
