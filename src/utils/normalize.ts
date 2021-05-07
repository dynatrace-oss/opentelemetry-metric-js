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

import { Dimension } from "./metric/metric";

const DIMENSION_KEY_MAX_LENGTH = 100;
const METRIC_KEY_MAX_LENGTH = 250;
const DIMENSION_VALUE_MAX_LENGTH = 250;

const RE_DK_SECTION_START = /^[^a-z_]+/;
const RE_DK_SECTION_END = /[^a-z0-9_:-]+$/;
const RE_DK_INVALID_CHARACTERS = /[^a-z0-9_:-]+/g;

const RE_DV_NON_CONTROL_CHARACTERS = /[\x00-\x1f]+/g;
const RE_DV_NON_CONTROL_CHARACTERS_START = /^[\x00-\x1f]+/;
const RE_DV_NON_CONTROL_CHARACTERS_END = /[\x00-\x1f]+$/;

const CHARS_TO_ESCAPE = new Set([
	"=",
	" ",
	",",
	"\\",
	'"'
]);

export function normalizeMetricKey(name: string): string | null {
	/*
	* identifier : first_identifier_section ( '.' identifier_section )*
	* first_identifier_section : ( [a-z] | [A-Z] ) ( [a-z] | [A-Z] | [0-9] | [_-] )*
	* identifier_section: ( [a-z] | [A-Z] | [0-9] ) ( [a-z] | [A-Z] | [0-9] | [_-] )*
	*/

	const sections = name.slice(0, METRIC_KEY_MAX_LENGTH).split(".");
	const first = normalizeMetricKeyFirstSection(sections.shift()!);
	if (!first) {
		return null;
	}

	return [
		first,
		...sections
			.map(normalizeMetricKeySection)
			.filter(Boolean)
	].join(".");

}

export function normalizeDimensionKey(key: string): string | null {
	const normalizedSections = key
		.substr(0, DIMENSION_KEY_MAX_LENGTH)
		.split(".")
		.map(normalizeDimensionKeySection)
		.filter(s => s.length);

	return normalizedSections.length > 0 ? normalizedSections.join(".") : null;
}

export function normalizeDimensionValue(value: string): string | null {
	// in JS, we could receive an unexpected type
	value = String(value);
	value = value.slice(0, DIMENSION_VALUE_MAX_LENGTH);
	value = removeControlCharacters(value);
	const escapedCharList = escapeCharacters(value);
	return joinAndTrimDimensionValue(escapedCharList);
}

export function normalizeDimensions(dimensions: Dimension[]): Dimension[] {
	return dimensions.map(normalizeDimension).filter((d): d is Dimension => Boolean(d));
}

function normalizeDimension(dim: Dimension): Dimension | null {
	const key = normalizeDimensionKey(dim.key);
	if (!key) {
		return null;
	}

	const value = normalizeDimensionValue(dim.value);
	if (!value) {
		return null;
	}

	return { key, value };
}

function removeControlCharacters(s: string): string {
	s = s.replace(RE_DV_NON_CONTROL_CHARACTERS_START, "");
	s = s.replace(RE_DV_NON_CONTROL_CHARACTERS_END, "");
	s = s.replace(RE_DV_NON_CONTROL_CHARACTERS, "_");
	return s;
}

function escapeCharacters(s: string): string[] {
	return s.split("").map(c => CHARS_TO_ESCAPE.has(c) ? `\\${c}` : c);
}

function joinAndTrimDimensionValue(value: string[]): string | null {
	let len = 0;

	return value
		.filter(c => {
			len += c.length;
			if (len > DIMENSION_VALUE_MAX_LENGTH) {
				return false;
			}
			return true;
		}).join("") || null;
}

function normalizeMetricKeyFirstSection(section: string): string {
	// First section must start with a letter or underscore
	return normalizeMetricKeySection(section.replace(/^[^a-zA-Z_]+/g, ""));
}

function normalizeMetricKeySection(section: string): string {
	return section
		// Remove this to allow underscores at the start
		.replace(/^[^a-zA-Z0-9_:-]+/, "")
		// Remove this to allow underscores at the end
		.replace(/[^a-zA-Z0-9_:-]+$/, "")
		.replace(/[^a-zA-Z0-9_:-]+/g, "_");
}

function normalizeDimensionKeySection(section: string): string {
	section = section.toLocaleLowerCase();
	section = section.replace(RE_DK_SECTION_START, "");
	section = section.replace(RE_DK_SECTION_END, "");
	section = section.replace(RE_DK_INVALID_CHARACTERS, "_");
	return section;
}

