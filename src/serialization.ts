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
	Histogram,
	MetricRecord,
	Point
} from "@opentelemetry/metrics";

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
		.filter((k) => k.metricKey && k.valueLine)
		.map(
			({ metricKey, dimensions, valueLine }) =>
				joinLine(metricKey!, dimensions, valueLine!)
		)
		.join("\n");
}

function formatMetricKey(metric: MetricRecord, prefix: string) {
	return normalizeMetricName(
		prefix ? `${prefix}.${metric.descriptor.name}` : metric.descriptor.name
	);
}

function joinLine(metricKey: string, dimensions: string, valueLine: string): string {
	let out = metricKey;
	if (dimensions) {
		out += `,${dimensions}`;
	}
	out += ` ${valueLine}`;

	return out;
}

function formatDimensions(metric: MetricRecord, userTags: string) {
	const dimensions = Object
		.entries(metric.labels)
		.map(([k, v]) => [normalizeDimensionKey(k), v])
		.filter(([k]) => Boolean(k))
		.map(([k, v]) => `${k}=${v}`);

	if (userTags) {
		dimensions.unshift(userTags);
	}

	return dimensions.join(",");
}

export function normalizeDimensionKey(key: string): string {
	return key
		.slice(0, 100)
		.toLowerCase()
		.split(".")
		.map(normalizeDimensionKeySection)
		.filter(Boolean)
		.join(".");
}

function normalizeDimensionKeySection(section: string) {
	return section
		.replace(/^[^a-z]+/g, "")
		.replace(/[^a-z0-9_\-:]+/g, "_");
}

export function normalizeMetricName(name: string): string | null {
	/*
	* identifier : first_identifier_section ( '.' identifier_section )*
	* first_identifier_section : ( [a-z] | [A-Z] ) ( [a-z] | [A-Z] | [0-9] | [_-] )*
	* identifier_section: ( [a-z] | [A-Z] | [0-9] ) ( [a-z] | [A-Z] | [0-9] | [_-] )*
	*/

	const sections = name.slice(0, 250).split(".");
	const first = normalizeMetricNameFirstSection(sections.shift());
	if (!first) {
		return null;
	}

	return [
		first,
		...sections
			.map(normalizeMetricNameSection)
			.filter(Boolean)
	].join(".");

}

function normalizeMetricNameFirstSection(section = ""): string {
	// First section must start with a letter
	return normalizeMetricNameSection(section.replace(/^[^a-zA-Z]+/g, ""));
}

function normalizeMetricNameSection(section: string): string {
	return section
		.replace(/^[^a-zA-Z0-9]+/g, "")
		.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function formatValueLine(metric: MetricRecord): string | null {
	switch (metric.aggregator.kind) {
		case AggregatorKind.SUM: {
			const data = metric.aggregator.toPoint();
			return formatCount(data);
		}
		case AggregatorKind.HISTOGRAM: {
			const data = metric.aggregator.toPoint();
			return formatHistogram(data);
		}
		case AggregatorKind.LAST_VALUE: {
			const data = metric.aggregator.toPoint();
			return formatGauge(data);
		}
	}

}

function formatCount(point: Point<number>) {
	return `count,${point.value} ${hrTimeToMilliseconds(point.timestamp)}`;
}

function formatGauge(point: Point<number>) {
	return `gauge,${point.value} ${hrTimeToMilliseconds(point.timestamp)}`;
}

function formatHistogram(point: Point<Histogram>) {
	if (point.value.count === 0) {
		return null;
	}

	// TODO remove this hack which pretends all data points had the same value
	const avg = point.value.sum / point.value.count;
	return `gauge,min=${avg},max=${avg},sum=${point.value.sum},count=${point.value.count} ${hrTimeToMilliseconds(point.timestamp)}`;
}
