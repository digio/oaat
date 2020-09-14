# oaat
> Open API AWS Tool

[![npm package][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![Downloads][downloads-image]][npm-url]

Open API Spec tool for recording, linting & comparing API responses; building and deploying a spec to AWS API Gateway.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Recording](#recording)
- [Linting](#linting)
- [Building](#building)
- [Comparing](#comparing)
- Deploying (Coming soon)
- [Config file](#config-file)

## Installation

```
npm install -g openapi-mock-aws

# Display help 
oaat --help
```

**Note**: Node 10.x or higher runtime required.

## Usage

This tool does 4 things:
- `oaat record` records API responses to requests specified in `x-examples` fields in an OpenAPI 3.x spec file.
- `oaat lint` lints an OpenAPI 3.x spec file (basic formatting; tools like [speccy](https://www.npmjs.com/package/speccy) provide more capability, but don't do formatting).
- `oaat compare` compares the earlier-recorded responses to the last responses for endpoints in an OpenAPI 3.x spec file.
- `oaat build` creates an OpenAPI 3.x spec file with [API Gateway][api-gateway-url] headers, optionally with mock responses for the APIs.
- (Coming soon) `oaat deploy` deploys an OpenAPI 3.x spec file that has the API Gateway headers to API Gateway.

## Recording

This tool provides the capability to record responses by making requests to the real API endpoints (`oaat record`),
and optionally use them as mock responses later (`oaat deploy`),
by reading an Open API spec file (v3.x) in _JSON_ format. 

### Command

```shell script
$ oaat record --help
Usage: oaat record [options] <jsonFile> [serverUrl]

Record the responses of API spec file endpoint requests (optionally use a different server to make requests)

Options:
  -o, --output <file>  Output file (if different to jsonFile)
  -c, --config <file>  Config file to override default config
  -q, --quiet          No logging
  -v, --verbose        Verbose logging
  -d, --dry-run        Dry run (no changes made)
  -h, --help           display help for command
```

To get valid example responses - to use for mocking & as documentation - we need to add some custom
properties to the OpenAPI spec file.

### `path.method.responses.statusCode["x-examples"]`

The `x-examples` object is a custom field that allows for the description of multiple examples
of inputs, and stores the corresponding response (for use in mocks and testing).

`x-examples` is object, with each child-property being the name of an example. There must be at-least one
child-property example-name for `x-examples`.

Each example-object can have the following properties:

- `parameters` - optional
- `requestBody` - optional
- `responseFile` - generated when recording a response

#### `x-examples[exampleName].parameters`

This property is required whenever an API has a non-empty `path.method.parameters` array.
The elements in `x-examples[example-name].parameters` correspond to the elements in `parameters`.
The order of each `parameters` object is significant.

Each `parameters` object has either a `value` or `script` property:

- `value` can be any data type (string, number, array, object or null)
- `script` is a reference to a JavaScript file. The JavaScript file must export a function
  which returns a value which can be used in the corresponding `parameters` argument.
  The function can be asynchronous. This is useful for situations where an endpoint relies
  on the result of another endpoint.
  
#### `x-examples[exampleName].requestBody`

This property is required whenever an API has a non-empty `path.method.requestBody` property.
The `requestBody` object has either a `value` or `script` property - same as the `x-examples[exampleName].parameters` (above).

#### `x-examples[exampleName].responseFile`

The `responseFile` property points to a mock-response file.

When an API has no parameters, the `responseFile` property is generated for the 200 response automatically.
**For all other response codes, the `responseFile` property will need to be added
manually, along with the mock file for that response.**

#### Example

```json
"paths": {
  "/posts/{id}": {
    "post": {
      "tags": ["posts"],
      "summary": "Get specific post",
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "description": "The ID of the post to retrieve",
          "required": true,
          "schema": {
            "type": "integer"
          }
        }
      ],
      "requestBody": {
        "description": "Optional description in *Markdown*",
        "required": true
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Pet" 
            }
          }
        }
      },
      "responses": {
        "200": {
          "description": "successful operation",
          "content": {
            "*/*": {
              "schema": {
                "$ref": "#/components/schemas/Post"
              }
            }
          },
          "x-examples": {
            "id_1": {
              "parameters": [{ "value": "1" }],
              "requestBody": { "script": "scripts/getIdFromDatabase.js" }
            }
          }
        }
      }
    }
  }
}
```

In the above example, the `POST /posts/{id}` endpoint requires two parameters - a
`path` parameter (`{id}`) and a `requestBody` parameter. The corresponding
`x-examples[exampleName]` object has two properties: `parameters`, which uses the `value`
property to specify the `id` parameter; the `requestBody` property uses the `script` property to specify
a JS file which will produce the value for the `requestBody` parameter.

JS script example:

```javascript
const queueWrapper = require('../src/queueWrapper');

/**
 * Returns the post data
 * @param {string} serverUrl
 * @param {string} path        E.g. "/post/{id}"
 * @return {Promise<*>}
 */
function doAsyncThing({ serverUrl }) {
  return new Promise(resolve => {
    setTimeout(() => resolve('async value 1'), 100);
  });
}

module.exports = queueWrapper(doAsyncThing);

```

The above JavaScript module exports an async function which returns an object asynchronously.
The `queueWrapper()` function is there to combine multiple requests into a single request, in scenarios where
multiple endpoint-examples require the same async-value. 

### Disabling endpoint recording

Sometimes it may be necessary to disable the recording of certain endpoints, while keeping the endpoint in the spec.

#### Disable entire endpoint (all responses)

Add the field `paths[path][method].x-ignore` with a value of `true` to disable the recording (and comparing) of this endpoint. 

#### Disable a single endpoint response

Add the field `paths[path][method].responses[status].x-ignore` with a value of `true` to disable the recording (and comparing) of this endpoint response.

### Ignoring changes to certain fields - `path.method.responses.statusCode["x-test-ignore-paths"]`

The `x-test-ignore-paths` property is an array of paths (in Lodash path format ([see example](https://lodash.com/docs/4.17.15#zipObjectDeep))) to be **ignored**.

For example, the `foo.correlationId` property may change in every request. When comparing a new request
against the mock-file, the objects will never match. To overcome this, we can use the `x-test-ignore-paths`
property to ignore this field when comparing the response to the mock-file:

```json
"paths": {
  "/foo/bar": {
    "get": {
      "summary": "Get foo's bars",
      "produces": ["application/json"],
      "parameters": [],
      "responses": {
        "200": {
          "schema": {
            "$ref": "#/definitions/Cart"
          },
          "x-test-ignore-paths": [
            "foo.correlationId"
          ]
        }
      }
    }
  }
}
```

## Linting

There are lots of good tools that can check the syntax and style of Open API Sepc 3.x files:

- [Speccy][speccy-url]
- [OpenAPI Tools][openapi-tools-url]

`oaat` compliments these tools, as it lints things that the others don't:

- sort `paths` alphabetically (true)
- sort `components.schemas` alphabetically (true)
- copy `x-examples` examples into `parameter.examples` and `requestBody.examples`

### Command

```shell script
$ oaat lint --help
Usage: oaat lint [options] <jsonFile>

Tidy the API Spec up a bit

Options:
  -o, --output <file>  Output file (if different to jsonFile)
  -c, --config <file>  Config file to override default config
  -q, --quiet          no logging
  -v, --verbose        verbose logging
  -h, --help           display help for command
```

See the [configuration file](config-file) for further options.

## Building

Creates an OpenAPI 3.x spec file with [API Gateway][api-gateway-url] headers, optionally with mock responses for the APIs.

### Command

```shell script
$ oaat lint --help
Usage: oaat build [options] <jsonFile> <outputJsonFile> [serverUrl]

Adds custom headers & Swagger UI endpoint to allow deployment of spec file to AWS API Gateway with documentation

Options:
  -c, --config <file>  Config file to override default config
  -m, --mock           Uses the recorded responses as mock responses
  -q, --quiet          No logging
  -v, --verbose        Verbose logging
  -d, --dry-run        Dry run (no changes made)
  -h, --help           display help for command
```

## Comparing

Compares the earlier-recorded responses to the last responses for endpoints in an OpenAPI 3.x spec file.
This command can be used to do integration testing, by treating the recorded responses as
snapshots, and comparing those to the latest responses.

### Command

```shell script
$ oaat lint --help
Usage: oaat compare [options] <jsonFile> <outputJsonFile> [serverUrl]

Adds custom headers & Swagger UI endpoint to allow deployment of spec file to AWS API Gateway with documentation

Options:
  -c, --config <file>        Config file to override default config
  -m, --compare-mode <mode>  Compares by "value" (default), "type", "schema"
  -q, --quiet                No logging
  -v, --verbose              Verbose logging
  -h, --help                 display help for command
```

## Config file

oaat has a default configuration which can be overridden using a config file.
The config file can be JSON or a CommonJS module which exports an object.

Example:
``` js
module.exports = {
  // Shared configuration for all commands
  global: {
    // The number of simultaneous requests HTTP requests to make. Increasing this value
    // can lead to inconsistent results.
    simultaneousRequests: 15,
  },

  // Configuration for the `oaat record` command:
  record: {

    // Path to a subdirectory (relative to the spec file) that contains the response files
    // If you do not wish to put mock files into a subdirectory, removeUnsedResponses is
    // automatically set to false to avoid deleting files from your specfile folder!
    responseBasePath: 'responses/',

    // After renaming examples and generating new response files, old response files may no longer
    // be being used. Set this to true to remove the unused (un-referenced by the spec file) response files. 
    removeUnusedResponses: true,

    // A function to generate the name for each mock file.
    // This is the default naming function:
    responseFilenameFn(apiData) {
      // console.log(apiData);  // Print the apiData structure to see what is available
      const exampleName =
        apiData.exampleIndex === 0
          ? `DEFAULT${apiData.exampleName === 'default' ? '' : `_${apiData.exampleName}`}`
          : apiData.exampleName;
      return `${apiData.config.method.toUpperCase()}_${apiData.path.slice(1).replace(/\//g, '_')}-${
        apiData.statusCode
      }_${exampleName}.json`;
    },

    // Whether to update the response file when the new response is an inexact match.
    // For example, if a date field in the response is being ignored (because it always changes)
    // but everything else in the response matches the previous response, should the response
    // file be updated?
    updateResponseWhenInexactMatch: true,

    // Whether to update the response file when the new response's data-types match the
    // old response's data types, but the values are different.
    updateResponseWhenTypesMatch: true,

    // Lint the spec file as well (true)
    andLint: true,
  },

  // Configuration for the `lint` command
  lint: {

    // Sort the spec file's paths alphabetically (true)
    sortPathsAlphabetically: true,

    // Sort the spec file's component.schemas alphabetically (true)
    sortComponentsAlphabetically: true,

    // Updates the parameter and requestBody examples using the x-examples from the 200 response
    syncExamples: true
  },

  // Configuration for the `apig` command
  apig: {

    // The path that will server the Swagger UI
    specUIEndpoint: '/',

    // The path that will serve the spec itself
    specFileEndpoint: '/open-api-spec.json',
  },
};
```


---

[npm-image]: https://img.shields.io/npm/v/oaat.svg
[npm-url]: http://npmjs.org/package/oaat
[travis-image]: https://travis-ci.org/digio/oaat.svg?branch=master
[travis-url]: https://travis-ci.org/digio/oaat
[coveralls-image]: https://coveralls.io/repos/github/digio/oaat/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/digio/oaat?branch=master
[downloads-image]: https://img.shields.io/npm/dm/oaat.svg
[api-gateway-url]: https://docs.aws.amazon.com/apigateway/index.html
[speccy-url]: http://speccy.io/
[openapi-tools-url]: https://openapi.tools/
