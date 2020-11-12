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
import { ExportResult, NoopLogger } from "@opentelemetry/core";
import { MetricExporter, MetricRecord } from "@opentelemetry/metrics";
import * as http from "http";
import * as https from "https";
import * as url from "url";
import { ExporterConfig } from "./export/types";
import { serializeMetrics } from "./serialization";

const cDefaultBaseUrl = "http://127.0.0.1:14499/metrics/ingest";

export class DynatraceMetricExporter implements MetricExporter {
	private readonly _logger: api.Logger;
	private readonly _prefix: string;
	private readonly _reqOpts: http.RequestOptions;
	private readonly _httpRequest: typeof http.request | typeof https.request;
	private readonly _userTags: string;
	private _isShutdown = false;

	/**
   * Constructor
   * @param config Exporter configuration
   */
	constructor(config: ExporterConfig = {}) {
		this._logger = config.logger || new NoopLogger();
		this._prefix = config.prefix || "";
		this._userTags = (config.tags || []).join(",");

		const urlObj = new url.URL(config.url ?? cDefaultBaseUrl);
		const proto = this._getHttpProto(urlObj);
		this._httpRequest = proto.request;

		const headers: Record<string, string> = {
			"Content-Type": "text/plain; charset=utf-8"
		};

		if (config.APIToken) {
			headers.Authorization = `Api-Token ${config.APIToken}`;
		}

		this._reqOpts = {
			method: "POST",
			hostname: urlObj.hostname,
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
			process.nextTick(resultCallback, ExportResult.SUCCESS);
			return;
		}

		if (this._isShutdown) {
			process.nextTick(resultCallback, ExportResult.FAILED_NOT_RETRYABLE);
			return;
		}

		const payload = serializeMetrics(metrics, this._userTags, this._prefix);

		if (!payload) {
			process.nextTick(resultCallback, ExportResult.SUCCESS);
			return;
		}

		const request = this._httpRequest(this._reqOpts);
		const self = this;

		function onResponse(res: http.IncomingMessage) {
			self._logger.debug(`request#onResponse: statusCode: ${res.statusCode}`);

			res.resume(); // discard any incoming data

			res.on("error", e => {
				// no need for handling a response error as a valid statusCode has
				// been received before which indicates message was received
				self._logger.debug(`response#error: ${e.message}`);
			});

			if (
				res.statusCode != null &&
				res.statusCode >= 200 &&
				res.statusCode < 300
			) {
				process.nextTick(resultCallback, ExportResult.SUCCESS);
			} else if (res.statusCode === 401 || res.statusCode === 403) {
				self._logger.warn("Not authorized to send spans to Dynatrace");
				// 401/403 is permanent
				self._isShutdown = true;
				process.nextTick(resultCallback, ExportResult.FAILED_NOT_RETRYABLE);
			} else {
				self._logger.warn(
					`Received status code ${res.statusCode} from Dynatrace`
				);
				process.nextTick(resultCallback, ExportResult.FAILED_RETRYABLE);
			}
		}

		function onError(err: Error) {
			// TODO
			self._logger.error(err.message);
			process.nextTick(resultCallback, ExportResult.FAILED_NOT_RETRYABLE);
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
}
