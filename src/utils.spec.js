/* eslint-disable @getify/proper-arrows/where */
const {
  addParamsToFetchConfig,
  getAbsSpecFilePath,
  getLogAndConfig,
  getFetchConfigForAPIEndpoints,
} = require('./utils');

describe('utils', () => {
  describe('getFetchConfigForAPIEndpoints()', () => {
    it('should return config for a GET endpoint with no params(just the config for the 200 response)', () => {
      const input = {
        paths: {
          '/api': {
            get: {
              responses: {
                '200': {
                  description: 'Successful Operation',
                },
                '400': {
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
                '200': {
                  description: 'Successful Operation',
                },
                '400': {
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
                '200': {
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
                '200': {
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
                '200': {
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
                '200': {
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
                '200': {
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
                '200': {
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
                '400': {
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
              '200': {
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

      const { fetchConfigs } = await addParamsToFetchConfig({ fetchConfigs: input, serverUrl: 'https://example.com/' });
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
              '200': {
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

      const { fetchConfigs } = await addParamsToFetchConfig({ fetchConfigs: input, serverUrl: 'https://example.com/' });
      expect(fetchConfigs).toEqual([
        expect.objectContaining({
          path: '/api/{p1}',
          query: {},
          url: '/api/foo',
          config: { method: 'get' },
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
              '200': {
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

      const { fetchConfigs } = await addParamsToFetchConfig({ fetchConfigs: input, serverUrl: 'https://example.com/' });
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
              '200': {
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

      const { fetchConfigs } = await addParamsToFetchConfig({ fetchConfigs: input, serverUrl: 'https://example.com/' });
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
              '200': {
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
      const { fetchConfigs } = await addParamsToFetchConfig({
        fetchConfigs: input,
        serverUrl: 'https://example.com/',
        absSpecFilePath,
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
  });

  describe('getLogAndConfig()', () => {
    it('should return a log and config object for the lint command, using the defaults', () => {
      const commandData = {};
      const { log, config } = getLogAndConfig('lint', commandData);

      expect(typeof log.info).toEqual('function');
      expect(config).toEqual({
        dryRun: false,
        outputFile: undefined,
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
        updateResponseWhenInexactMatch: true,
        updateResponseWhenTypesMatch: true,
      });
    });
  });
});
