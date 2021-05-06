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

import { getOneAgentMetadata } from "../../src/utils/enrichment";
import * as mock from "mock-fs";

describe("Enrichment", () => {
	beforeAll(() => {
		mock({
			"empty_indirection.json": "",

			"indirection_to_missing.json": "missing.json",
			"indirection_to_invalid.json": "invalid.json",
			"indirection_to_valid.json": "valid.json",

			"empty.json": "",
			"invalid.json": "this is not valid json",
			"valid.json": JSON.stringify({ property1: "value1" })
		});
	});

	afterAll(() => {
		mock.restore();
	});

	it("should not crash if the indirection file does not exist", () => {
		//@ts-expect-error shouldn't be allowed to pass a file name 🤫
		expect(getOneAgentMetadata("file_not_exist")).toStrictEqual([]);
	});

	it("should not crash if the indirection file is empty", () => {
		//@ts-expect-error shouldn't be allowed to pass a file name 🤫
		expect(getOneAgentMetadata("empty_indirection.json")).toStrictEqual([]);
	});

	it("should not crash if the indirection file points to missing file", () => {
		//@ts-expect-error shouldn't be allowed to pass a file name 🤫
		expect(getOneAgentMetadata("indirection_to_missing.json")).toStrictEqual([]);
	});

	it("should not crash if the indirection file points to invalid file", () => {
		//@ts-expect-error shouldn't be allowed to pass a file name 🤫
		expect(getOneAgentMetadata("indirection_to_invalid.json")).toStrictEqual([]);
	});

	it("should read json properties from the file", () => {
		//@ts-expect-error shouldn't be allowed to pass a file name 🤫
		expect(getOneAgentMetadata("indirection_to_valid.json")).toStrictEqual([{ key: "property1", value: "value1" }]);
	});
});
