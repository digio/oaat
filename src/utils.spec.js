/* eslint-disable @getify/proper-arrows/where */
const {
  addParamsToFetchConfig,
  getAbsSpecFilePath,
  getExistingResponseFileData,
  getLogAndConfig,
  getFetchConfigForAPIEndpoints,
  validateSpecObj,
} = require('./utils');

describe('utils', () => {
  describe('getFetchConfigForAPIEndpoints()', () => {
    it('should return config for a GET endpoint with no params(just the config for the 200 response)', () => {
      const input = {
        paths: {
          '/api': {
            get: {
              responses: {
                200: {
                  description: 'Successful Operation',
                },
                400: {
                  description: 'The request is invalid',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([
        {
          path: '/api',
          query: {},
          url: '/api',
          config: { method: 'get' },
          apiEndpoint: input.paths['/api'].get,
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ]);
    });

    it('should NOT return config for a GET endpoint with a single path parameter when there are no examples', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            get: {
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              responses: {
                200: {
                  description: 'Successful Operation',
                },
                400: {
                  description: 'The request is invalid',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([]);
    });

    it('should return config for a GET endpoint with a single path parameter when there are MULTIPLE examples', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            get: {
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              responses: {
                200: {
                  description: 'Successful Operation',
                  'x-examples': {
                    myExample: {
                      parameters: [{ value: { js: 'object' } }],
                    },
                    example2: {
                      parameters: [{ value: { js: 'function' } }],
                    },
                  },
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      console.log(fetchConfigs);
      expect(fetchConfigs).toEqual([
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'get' },
          apiEndpoint: input.paths['/api/{p1}'].get,
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'myExample',
          exampleIndex: 0,
        },
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'get' },
          apiEndpoint: input.paths['/api/{p1}'].get,
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'example2',
          exampleIndex: 1,
        },
      ]);
    });

    it('should return config for a GET endpoint with a multiple query parameters when there is one example', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            get: {
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
                {
                  name: 'q1',
                  in: 'query',
                  description: 'Second param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
                {
                  name: 'q2',
                  in: 'query',
                  description: 'third param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              responses: {
                200: {
                  description: 'Successful Operation',
                  'x-examples': {
                    myExample: {
                      parameters: [{ value: { js: 'object' } }, { value: 'grace' }, { value: 'special' }],
                    },
                  },
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      console.log(fetchConfigs);
      expect(fetchConfigs).toEqual([
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'get' },
          apiEndpoint: input.paths['/api/{p1}'].get,
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'myExample',
          exampleIndex: 0,
        },
      ]);
    });

    it('should NOT return config for a POST endpoint with a requestBody parameter when there are no examples', () => {
      const input = {
        paths: {
          '/api': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Successful Operation',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([]);
    });

    it('should return config for a POST endpoint with a requestBody parameter when there are examples', () => {
      const input = {
        paths: {
          '/api': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Successful Operation',
                  'x-examples': {
                    myExample: {
                      requestBody: { script: { js: 'object' } },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      //console.log(fetchConfigs);
      expect(fetchConfigs).toEqual([
        {
          path: '/api',
          query: {},
          url: '/api',
          config: { method: 'post' },
          apiEndpoint: input.paths['/api'].post,
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'myExample',
          exampleIndex: 0,
        },
      ]);
    });

    it('should NOT return config for a POST endpoint with a requestBody parameter and a single parameter when there is not an example for the requestBody', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            post: {
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                  },
                },
              },
              responses: {
                200: {
                  'x-examples': {
                    myExample: {
                      parameters: [{ value: 'foo' }],
                    },
                  },
                  description: 'Successful Operation',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([]);
    });

    it('should NOT return config for a POST endpoint with a requestBody parameter and a single parameter when there is not an example for the parameter', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            post: {
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                  },
                },
              },
              responses: {
                200: {
                  'x-examples': {
                    myExample: {
                      requestBody: { value: 'foo' },
                    },
                  },
                  description: 'Successful Operation',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([]);
    });

    it('should return config for a POST endpoint with a requestBody parameter and a single parameter when there is an example for the parameter and requestBody', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            post: {
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                  },
                },
              },
              responses: {
                400: {
                  'x-examples': {
                    myExample: {
                      requestBody: { value: 'foo' },
                      parameters: [{ script: 'bar' }],
                    },
                  },
                  description: 'Error response',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'post' },
          apiEndpoint: input.paths['/api/{p1}'].post,
          expectedStatusCode: 400,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'myExample',
          exampleIndex: 0,
        },
      ]);
    });

    it('should ignore entire endpoints that have a truthy x-ignore property', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            post: {
              'x-ignore': true,
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                  },
                },
              },
              responses: {
                400: {
                  'x-examples': {
                    myExample: {
                      requestBody: { value: 'foo' },
                      parameters: [{ script: 'bar' }],
                    },
                  },
                  description: 'Error response',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([]);
    });

    it('should ignore endpoint responses that have a truthy x-ignore property', () => {
      const input = {
        paths: {
          '/api/{p1}': {
            post: {
              parameters: [
                {
                  name: 'p1',
                  in: 'path',
                  description: 'First param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                  },
                },
              },
              responses: {
                200: {
                  'x-ignore': true,
                  'x-examples': {
                    myExample: {
                      requestBody: { value: 'foo' },
                      parameters: [{ script: 'bar' }],
                    },
                  },
                  description: 'Success response',
                },
                400: {
                  'x-examples': {
                    myExample: {
                      requestBody: { value: 'foo' },
                      parameters: [{ script: 'bar' }],
                    },
                  },
                  description: 'Error response',
                },
              },
            },
          },
        },
      };

      const { fetchConfigs } = getFetchConfigForAPIEndpoints({ specObj: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'post' },
          apiEndpoint: input.paths['/api/{p1}'].post,
          expectedStatusCode: 400,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'myExample',
          exampleIndex: 0,
        },
      ]);
    });
  });

  describe('addParamsToFetchConfig()', () => {
    it('should handle a GET endpoint with no params (just the config for the 200 response)', async () => {
      const input = [
        {
          path: '/api',
          query: {},
          url: '/api',
          config: { method: 'get' },
          apiEndpoint: {
            responses: {
              200: {
                description: 'Successful Operation',
              },
            },
          },
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ];
      const config = { simultaneousRequests: 15 };

      const { fetchConfigs } = await addParamsToFetchConfig({
        fetchConfigs: input,
        serverUrl: 'https://example.com/',
        config,
        specObj: {},
      });
      expect(fetchConfigs).toEqual([
        {
          path: '/api',
          query: {},
          url: '/api',
          config: { method: 'get' },
          apiEndpoint: input[0].apiEndpoint,
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ]);
    });

    it('should add parameters for a GET endpoint with a single path parameter with an example that comes from a "value"', async () => {
      const input = [
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'get' },
          apiEndpoint: {
            parameters: [
              {
                name: 'p1',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              200: {
                description: 'Successful Operation',
                'x-examples': {
                  default: {
                    parameters: [{ value: 'foo' }],
                  },
                },
              },
            },
          },
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ];
      const config = { simultaneousRequests: 15 };

      const { fetchConfigs } = await addParamsToFetchConfig({
        fetchConfigs: input,
        serverUrl: 'https://example.com/',
        config,
        specObj: {},
      });
      expect(fetchConfigs).toEqual([
        expect.objectContaining({
          path: '/api/{p1}',
          query: {},
          url: '/api/foo',
          config: { method: 'get' },
        }),
      ]);
    });

    it('should add parameters for a GET endpoint with a single header parameter with an example that comes from a "value"', async () => {
      const input = [
        {
          path: '/api',
          query: {},
          url: '/api',
          config: { method: 'get' },
          apiEndpoint: {
            parameters: [
              {
                name: 'authorization',
                in: 'header',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              200: {
                description: 'Successful Operation',
                'x-examples': {
                  default: {
                    parameters: [{ value: 'Bearer codesdfslk' }],
                  },
                },
              },
            },
          },
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ];
      const config = { simultaneousRequests: 15 };

      const { fetchConfigs } = await addParamsToFetchConfig({
        fetchConfigs: input,
        serverUrl: 'https://example.com/',
        config,
        specObj: {},
      });
      expect(fetchConfigs).toEqual([
        expect.objectContaining({
          path: '/api',
          query: {},
          url: '/api',
          config: { method: 'get', headers: { authorization: 'Bearer codesdfslk' } },
        }),
      ]);
    });

    it('should add parameters for a GET endpoint with a single path parameter and query params with an example that comes from a "value"', async () => {
      const input = [
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'get' },
          apiEndpoint: {
            parameters: [
              {
                name: 'p1',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'q1',
                in: 'query',
                description: 'Second param',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'q2',
                in: 'query',
                description: 'third param',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              200: {
                description: 'Successful Operation',
                'x-examples': {
                  default: {
                    parameters: [{ value: 'foo' }, { value: 'grace' }, { value: 'special K' }],
                  },
                },
              },
            },
          },
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ];
      const config = { simultaneousRequests: 15 };

      const { fetchConfigs } = await addParamsToFetchConfig({
        fetchConfigs: input,
        serverUrl: 'https://example.com/',
        config,
        specObj: {},
      });
      expect(fetchConfigs).toEqual([
        expect.objectContaining({
          path: '/api/{p1}',
          query: {
            q1: 'grace',
            q2: 'special K',
          },
          url: '/api/foo?q1=grace&q2=special%20K',
          config: { method: 'get' },
        }),
      ]);
    });

    it('should add parameters for a POST endpoint with a single path parameter and requestBody with an example that comes from a "value"', async () => {
      const input = [
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'post' },
          apiEndpoint: {
            parameters: [
              {
                name: 'p1',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Info',
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Successful Operation',
                'x-examples': {
                  default: {
                    parameters: [{ value: 'foo' }],
                    requestBody: { value: { bar: 'car' } },
                  },
                },
              },
            },
          },
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ];
      const config = { simultaneousRequests: 15 };
      const { fetchConfigs } = await addParamsToFetchConfig({
        fetchConfigs: input,
        serverUrl: 'https://example.com/',
        config,
        specObj: {},
      });
      expect(fetchConfigs).toEqual([
        expect.objectContaining({
          path: '/api/{p1}',
          query: {},
          url: '/api/foo',
          config: { method: 'post', body: JSON.stringify({ bar: 'car' }) },
        }),
      ]);
    });

    it('should add parameters for a POST endpoint with a single path parameter and requestBody with an example that comes from a "script" property', async () => {
      const input = [
        {
          path: '/api/{p1}',
          query: {},
          url: '/api/{p1}',
          config: { method: 'post' },
          apiEndpoint: {
            parameters: [
              {
                name: 'p1',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'q1',
                in: 'query',
                description: 'Second param',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Info',
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Successful Operation',
                'x-examples': {
                  default: {
                    parameters: [{ value: 'foo' }, { script: '../fixtures/scriptValue1.js' }],
                    requestBody: { script: 'scriptValue2.js' },
                  },
                },
              },
            },
          },
          expectedStatusCode: 200,
          existingResponseFile: undefined,
          ignorePathsList: [],
          exampleName: 'default',
          exampleIndex: 0,
        },
      ];
      const absSpecFilePath = '../fixtures';
      const config = { simultaneousRequests: 15 };
      const { fetchConfigs } = await addParamsToFetchConfig({
        fetchConfigs: input,
        serverUrl: 'https://example.com/',
        absSpecFilePath,
        config,
        specObj: {},
      });
      expect(fetchConfigs).toEqual([
        expect.objectContaining({
          path: '/api/{p1}',
          query: {
            q1: 'async value 1',
          },
          url: '/api/foo?q1=async%20value%201',
          config: { method: 'post', body: JSON.stringify('async value 2') },
        }),
      ]);
    });

    describe('with security', () => {
      it('should add an Authorization header when the API has security with type http and scheme bearer', async () => {
        const input = [
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get' },
            apiEndpoint: {
              security: [{ scheme1: [] }],
              responses: {
                200: {
                  description: 'Successful Operation',
                },
              },
            },
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ];
        // The securitySchemes key contains the user-specified security values
        const config = { simultaneousRequests: 15, securitySchemes: { scheme1: { value: 'abc123' } } };
        const specObj = {
          components: {
            securitySchemes: {
              scheme1: {
                type: 'http',
                scheme: 'bearer',
              },
            },
          },
        };

        const { fetchConfigs } = await addParamsToFetchConfig({
          fetchConfigs: input,
          serverUrl: 'https://example.com/',
          config,
          specObj,
        });
        expect(fetchConfigs).toEqual([
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get', headers: { Authorization: 'Bearer abc123' } }, // <---
            apiEndpoint: input[0].apiEndpoint,
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ]);
      });

      it('should add an Authorization header when the API has security with type http and scheme basic', async () => {
        const input = [
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get' },
            apiEndpoint: {
              security: [{ scheme1: [] }],
              responses: {
                200: {
                  description: 'Successful Operation',
                },
              },
            },
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ];
        // The securitySchemes key contains the user-specified security values
        const config = { simultaneousRequests: 15, securitySchemes: { scheme1: { value: 'abc123' } } };
        const specObj = {
          components: {
            securitySchemes: {
              scheme1: {
                type: 'http',
                scheme: 'basic',
              },
            },
          },
        };

        const { fetchConfigs } = await addParamsToFetchConfig({
          fetchConfigs: input,
          serverUrl: 'https://example.com/',
          config,
          specObj,
        });
        expect(fetchConfigs).toEqual([
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get', headers: { Authorization: 'Basic abc123' } }, // <---
            apiEndpoint: input[0].apiEndpoint,
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ]);
      });

      it('should add an API key header when the API has global security with type apiKey and format "header", from a script', async () => {
        const input = [
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get' },
            apiEndpoint: {
              // Using global security
              responses: {
                200: {
                  description: 'Successful Operation',
                },
              },
            },
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ];
        // The securitySchemes key contains the user-specified security values
        const config = {
          simultaneousRequests: 15,
          securitySchemes: { scheme1: { script: '../fixtures/scriptValue1.js' } },
        };
        const specObj = {
          security: [{ scheme1: [] }],
          components: {
            securitySchemes: {
              scheme1: {
                type: 'apiKey',
                in: 'header',
                name: 'x-api-key',
              },
            },
          },
        };

        const { fetchConfigs } = await addParamsToFetchConfig({
          fetchConfigs: input,
          serverUrl: 'https://example.com/',
          config,
          specObj,
          absSpecFilePath: '../fixtures', // <---
        });
        expect(fetchConfigs).toEqual([
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get', headers: { 'x-api-key': 'async value 1' } }, // <---
            apiEndpoint: input[0].apiEndpoint,
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ]);
      });

      it('should add an API key query string when the API has global security with type apiKey and format "header", from a script', async () => {
        const input = [
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get' },
            apiEndpoint: {
              // Using global security
              responses: {
                200: {
                  description: 'Successful Operation',
                  'x-examples': {
                    default: {
                      parameters: [{ value: 'queryParamValue1' }],
                    },
                  },
                },
              },
              parameters: [
                {
                  name: 'q1',
                  in: 'query',
                  description: 'query param',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
            },
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ];
        // The securitySchemes key contains the user-specified security values
        const config = {
          simultaneousRequests: 15,
          securitySchemes: { scheme1: { script: '../fixtures/scriptValue1.js' } },
        };
        const specObj = {
          security: [{ scheme1: [] }],
          components: {
            securitySchemes: {
              scheme1: {
                type: 'apiKey',
                in: 'query',
                name: 'secret',
              },
            },
          },
        };

        const { fetchConfigs } = await addParamsToFetchConfig({
          fetchConfigs: input,
          serverUrl: 'https://example.com/',
          config,
          specObj,
          absSpecFilePath: '../fixtures',
        });
        expect(fetchConfigs).toEqual([
          {
            path: '/api',
            query: {
              q1: 'queryParamValue1',
              secret: 'async value 1',
            },
            resolvedParams: ['queryParamValue1'],
            url: '/api?q1=queryParamValue1&secret=async%20value%201', // <--- (not very secret ¯\_(ツ)_/¯ )
            config: { method: 'get' },
            apiEndpoint: input[0].apiEndpoint,
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ]);
      });

      it('should add multiple security schemes when they are specified', async () => {
        const input = [
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get' },
            apiEndpoint: {
              security: [{ scheme1: [], scheme2: [] }],
              responses: {
                200: {
                  description: 'Successful Operation',
                },
              },
            },
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ];
        // The securitySchemes key contains the user-specified security values
        const config = {
          simultaneousRequests: 15,
          securitySchemes: { scheme1: { value: 'abc123' }, scheme2: { value: 'xyz789' } },
        };
        const specObj = {
          components: {
            securitySchemes: {
              scheme1: {
                type: 'http',
                scheme: 'bearer',
              },
              scheme2: {
                type: 'apiKey',
                in: 'header',
                name: 'x-api-key',
              },
            },
          },
        };

        const { fetchConfigs } = await addParamsToFetchConfig({
          fetchConfigs: input,
          serverUrl: 'https://example.com/',
          config,
          specObj,
        });
        expect(fetchConfigs).toEqual([
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get', headers: { Authorization: 'Bearer abc123', 'x-api-key': 'xyz789' } }, // <---
            apiEndpoint: input[0].apiEndpoint,
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ]);
      });

      it('should throw an error when the target security scheme does not exist', async () => {
        const input = [
          {
            path: '/api',
            query: {},
            url: '/api',
            config: { method: 'get' },
            apiEndpoint: {
              security: [{ scheme1: [], scheme2: [] }],
              responses: {
                200: {
                  description: 'Successful Operation',
                },
              },
            },
            expectedStatusCode: 200,
            existingResponseFile: undefined,
            ignorePathsList: [],
            exampleName: 'default',
            exampleIndex: 0,
          },
        ];
        // The securitySchemes key contains the user-specified security values
        const config = {
          simultaneousRequests: 15,
          securitySchemes: { doesNotExist: { value: 'abc123' } },
        };
        const specObj = {
          components: {
            securitySchemes: {
              scheme1: {
                type: 'http',
                scheme: 'bearer',
              },
              scheme2: {
                type: 'apiKey',
                in: 'header',
                name: 'x-api-key',
              },
            },
          },
        };

        await expect(
          addParamsToFetchConfig({
            fetchConfigs: input,
            serverUrl: 'https://example.com/',
            config,
            specObj,
          }),
        ).rejects.toThrow('The security scheme "scheme1" is missing from the list of securitySchemes');
      });
    });
  });

  describe('getLogAndConfig()', () => {
    it('should return a log and config object for the lint command, using the defaults', () => {
      const commandData = {};
      const { log, config } = getLogAndConfig('lint', commandData);

      expect(typeof log.info).toEqual('function');
      expect(config).toEqual({
        dryRun: false,
        outputFile: undefined,
        securitySchemes: {},
        simultaneousRequests: 15,
        sortComponentsAlphabetically: true,
        sortPathsAlphabetically: true,
        syncExamples: true,
      });
    });

    it('should return a log and config object for the record command, using the defaults', () => {
      const commandData = {};
      const { log, config } = getLogAndConfig('record', commandData);

      expect(typeof log.info).toEqual('function');
      expect(config).toEqual({
        andLint: true,
        dryRun: false,
        responseBasePath: 'responses/',
        responseFilenameFn: expect.any(Function),
        outputFile: undefined,
        removeUnusedResponses: true,
        securitySchemes: {},
        simultaneousRequests: 15,
        updateResponseWhenInexactMatch: true,
        updateResponseWhenTypesMatch: true,
      });
    });

    it('should include the security tokens from the command line, if present', () => {
      const commandData = { secTokens: 'foo=bar,car=tar' };
      const { log, config } = getLogAndConfig('record', commandData);

      expect(typeof log.info).toEqual('function');
      expect(config).toEqual({
        andLint: true,
        dryRun: false,
        responseBasePath: 'responses/',
        responseFilenameFn: expect.any(Function),
        outputFile: undefined,
        removeUnusedResponses: true,
        securitySchemes: {
          foo: { value: 'bar' },
          car: { value: 'tar' },
        },
        simultaneousRequests: 15,
        updateResponseWhenInexactMatch: true,
        updateResponseWhenTypesMatch: true,
      });
    });

    it('should load a config file ane merge it over the defaultConfig, when it has been specified', () => {
      const commandData = {
        config: './fixtures/altConfig.js',
      };
      const { log, config } = getLogAndConfig('record', commandData);

      expect(typeof log.info).toEqual('function');
      expect(config).toEqual({
        andLint: false, // <-- from altConfig.js
        dryRun: false,
        responseBasePath: 'responses/',
        responseFilenameFn: expect.any(Function),
        outputFile: undefined,
        removeUnusedResponses: false, // <-- from altConfig.js
        securitySchemes: {},
        simultaneousRequests: 15,
        updateResponseWhenInexactMatch: true,
        updateResponseWhenTypesMatch: true,
      });
    });
  });

  describe('validateSpec()', () => {
    it('should return an openapi object when the spec is valid', async () => {
      const params = {
        specObj: require('../fixtures/threeExamples.json'),
      };
      const newParams = await validateSpecObj(params);

      expect(newParams.openapi).toBeDefined();
    });

    it('should throw an error if the specObj is not valid', async () => {
      const params = {
        specObj: { openapi: 'not-valid' },
      };

      expect.assertions(1);
      try {
        await validateSpecObj(params);
      } catch (err) {
        // eslint-disable-next-line jest/no-conditional-expect,jest/no-try-expect
        expect(err.toString()).toMatch('One or more errors exist in');
      }
    });
  });

  describe('getExistingResponseFileData()', () => {
    it('should return the response file data for the responseFile specified in the example, when the file exists', () => {
      const example = {
        responseFile: 'responses/mock1.json',
      };
      const destPath = getAbsSpecFilePath('./fixtures/sample1.json'); // path relative to cwd()

      expect(getExistingResponseFileData(example, destPath)).toEqual({
        mock: 'number 1',
      });
    });

    it('should return null when there is no responseFile property, or the propoerty is blank', () => {
      const destPath = getAbsSpecFilePath('./fixtures/sample1.json'); // path relative to cwd()

      expect(getExistingResponseFileData({}, destPath)).toEqual(null);
      expect(getExistingResponseFileData({ responseFile: '' }, destPath)).toEqual(null);
      expect(getExistingResponseFileData({ responseFile: 'non-existent.file' }, destPath)).toEqual(null);
    });
  });
});
