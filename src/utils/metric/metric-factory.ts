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

import { normalizeDimensions, normalizeMetricKey } from "../normalize";
import { Dimension, TotalCounter, DeltaCounter, Gauge, Summary, SummaryValue } from "./metric";

export interface Metric {
	serialize(): string;
}

export interface MetricFactoryOptions {
	prefix?: string;
	defaultDimensions?: Dimension[];
}

export class MetricFactory {
	private _prefix?: string;
	private _defaultDimensions: Dimension[];

	/**
	 * Return a new Metric Factory. If default dimensions are provided, they will be normalized.
	 */
	constructor(options?: MetricFactoryOptions) {
		this._prefix = options?.prefix;
		this._defaultDimensions = this._deduplicateDimensions(
			normalizeDimensions(
				options?.defaultDimensions ?? []
			)
		);
	}

	/**
	 * Create a total counter with a prefixed and normalized key and normalized dimensions.
	 * Use a total counter when a value represents the total value of a count.
	 * Returns null if key normalization fails to produce a valid metric key.
	 */
	public createTotalCounter(name: string, dimensions: Dimension[], value: number, ts?: number): Metric | null {
		const key = normalizeMetricKey(this._getKey(name));
		if (!key) {
			return null;
		}
		if (typeof value !== "number") {
			return null;
		}
		return new TotalCounter(key, this._getDimensions(dimensions), value, ts);
	}

	/**
	 * Create a delta counter with a prefixed and normalized key and normalized dimensions.
	 * Use a delta counter when a value represents only the change from the previous count.
	 * Returns null if key normalization fails to produce a valid metric key.
	 */
	public createDeltaCounter(name: string, dimensions: Dimension[], value: number, ts?: number): Metric | null {
		const key = normalizeMetricKey(this._getKey(name));
		if (!key) {
			return null;
		}
		if (typeof value !== "number") {
			return null;
		}
		return new DeltaCounter(key, this._getDimensions(dimensions), value, ts);
	}

	/**
	 * Create a gauge with a prefixed and normalized key and normalized dimensions.
	 * Use a gauge when a value represents a measurement.
	 * Returns null if key normalization fails to produce a valid metric key.
	 */
	public createGauge(name: string, dimensions: Dimension[], value: number, ts?: number): Metric | null {
		const key = normalizeMetricKey(this._getKey(name));
		if (!key) {
			return null;
		}
		if (typeof value !== "number") {
			return null;
		}
		return new Gauge(key, this._getDimensions(dimensions), value, ts);
	}

	/**
	 * Create a summary with a prefixed and normalized key and normalized dimensions.
	 * Use a summary when individual data points and exact values are not needed.
	 * Returns null if key normalization fails to produce a valid metric key.
	 */
	public createSummary(name: string, dimensions: Dimension[], value: SummaryValue, ts?: number): Metric | null {
		const key = normalizeMetricKey(this._getKey(name));
		if (!key) {
			return null;
		}

		const min = value.min;
		const max = value.max;
		const count = value.count;
		const sum = value.sum;

		if (
			typeof min !== "number" ||
			typeof max !== "number" ||
			typeof count !== "number" ||
			typeof sum !== "number"
		) {
			return null;
		}
		return new Summary(key, this._getDimensions(dimensions), { min, max, count, sum }, ts);
	}

	/**
	 * Get the metric key with prefix if applicable
	 */
	private _getKey(name: string): string {
		if (this._prefix != null) {
			return `${this._prefix}.${name}`;
		}
		return name;
	}

	/**
	 * Get dimension list including default dimensions
	 */
	private _getDimensions(dimensions: Dimension[]): Dimension[] {
		return this._deduplicateDimensions([...this._defaultDimensions, ...normalizeDimensions(dimensions)]);
	}

	private _deduplicateDimensions(dimensions: Dimension[]): Dimension[] {
		const found = new Set<string>();
		return dimensions.filter(d => {
			if (found.has(d.key)) {
				return false;
			}
			found.add(d.key);
			return true;
		});
	}
}
