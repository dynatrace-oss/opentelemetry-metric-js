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

import { hrTimeToMilliseconds } from "@opentelemetry/core";
import {
	AggregatorKind,
	MetricKind,
	MetricRecord,
	Point
} from "@opentelemetry/metrics";

/**
 * Metric keys must start with a lowercase letter
 * and contain letters, numbers, hyphens, and underscores.
 */
const cKeyValidationRegex = /^[a-z][a-zA-Z0-9_-]+/;
const cInvalidKeyCharacters = /[^a-zA-Z0-9_-]/g;

export function serializeMetrics(
	metrics: MetricRecord[],
	userTags: string,
	prefix: string
): string {
	return metrics
		.map((metric) => ({
			metricKey: formatMetricKey(metric, prefix),
			dimensions: formatDimensions(metric, userTags),
			valueLine: formatValueLine(metric)
		}))
		.filter((k) => k.valueLine)
		.map(
			({ metricKey, dimensions, valueLine }) =>
				`${metricKey},${dimensions} ${valueLine}`
		)
		.join("\n");
}

function formatMetricKey(metric: MetricRecord, prefix: string) {
	return sanitizeMetricKey(
		prefix ? `${prefix}.${metric.descriptor.name}` : metric.descriptor.name
	);
}

// Todo add tags
function formatDimensions(metric: MetricRecord, userTags: string) {
	const dimensions = Object.entries(metric.labels).map(([k, v]) => `${k}=${v}`);

	if (userTags) {
		dimensions.unshift(userTags);
	}

	return dimensions.join(",");
}

function formatValueLine(metric: MetricRecord): string | null {
	switch (metric.aggregator.kind) {
		case AggregatorKind.SUM: {
			const data = metric.aggregator.toPoint();
			return formatCount(data);
		}
		case AggregatorKind.HISTOGRAM: {
			// this._logger.debug('HISTOGRAM is not implemented');
			break;
		}
		case AggregatorKind.LAST_VALUE: {
			const data = metric.aggregator.toPoint();
			return formatGauge(data);
		}
	}

	return null;
}

function sanitizeMetricKey(key: string): string {
	if (cKeyValidationRegex.test(key)) {
		// key is already valid
		return key;
	}

	// Allowed characters are lowercase and uppercase letters, numbers,
	// hyphens (-), and underscores (_). Special letters (like ö) are not allowed.

	// Replace invalid characters with underscores
	key = key.replace(cInvalidKeyCharacters, "_");

	// Must start with a lowercase letter
	const first = key.charAt(0);
	if (/[a-z]/.test(first)) {
		return key;
	}

	if (/[A-Z]/.test(first)) {
		return first.toLowerCase() + key.slice(1);
	}

	return `a${key}`;
}

function formatCount(point: Point<number>) {
	return `count,delta=${point.value} ${hrTimeToMilliseconds(point.timestamp)}`;
}

function formatGauge(point: Point<number>) {
	return `gauge,${point.value} ${hrTimeToMilliseconds(point.timestamp)}`;
}
