/* eslint-disable @getify/proper-arrows/where */
const { sortPaths, sortComponents, syncExamples } = require('./lint');

describe('Lint', () => {
  describe('sortPaths', () => {
    it('should sort the "paths" property within the spec file, when the config', () => {
      const specObj = {
        paths: {
          '/grace': 2,
          '/zoo': 3,
          '/azure': 1,
        },
      };
      const config = {
        sortPathsAlphabetically: true,
      };

      expect(sortPaths({ specObj, config }).specObj).toEqual({
        paths: {
          '/azure': 1,
          '/grace': 2,
          '/zoo': 3,
        },
      });
    });

    it('should NOT sort the "paths" property when the config indicates that it should not do so', () => {
      const specObj = {
        paths: {
          '/grace': 2,
          '/zoo': 3,
          '/azure': 1,
        },
      };
      const config = {
        sortPathsAlphabetically: false,
      };

      expect(sortPaths({ specObj, config }).specObj).toEqual({
        paths: {
          '/grace': 2,
          '/zoo': 3,
          '/azure': 1,
        },
      });
    });
  });

  describe('sortComponents', () => {
    it('should sort the "schemas" property within the spec file', () => {
      const specObj = {
        components: {
          schemas: {
            GraceMaker: 2,
            ZooKeeper: 3,
            AzureSea: 1,
          },
        },
      };
      const config = {
        sortComponentsAlphabetically: true,
      };

      expect(sortComponents({ specObj, config }).specObj).toEqual({
        components: {
          schemas: {
            AzureSea: 1,
            GraceMaker: 2,
            ZooKeeper: 3,
          },
        },
      });
    });

    it('should NOT sort the "schemas" property within the spec file, when the config indicates not to', () => {
      const specObj = {
        components: {
          schemas: {
            GraceMaker: 2,
            ZooKeeper: 3,
            AzureSea: 1,
          },
        },
      };
      const config = {
        sortComponentsAlphabetically: false,
      };

      expect(sortComponents({ specObj, config }).specObj).toEqual({
        components: {
          schemas: {
            GraceMaker: 2,
            ZooKeeper: 3,
            AzureSea: 1,
          },
        },
      });
    });
  });

  describe('syncExamples', () => {
    it('should use the x-examples information to add examples to the parameters when the parameter values are synchronous', async () => {
      const specObj = {
        paths: {
          '/posts': {
            get: {
              tags: ['posts'],
              operationId: 'getPosts',
              summary: 'Get all available posts',
              parameters: [
                {
                  name: 'id',
                  in: 'query',
                  description: 'Filter by post ID',
                  required: false,
                  schema: { type: 'integer' },
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Post',
                        },
                      },
                    },
                  },
                  'x-examples': {
                    post1234: {
                      parameters: [{ value: 1234 }],
                    },
                  },
                },
              },
            },
          },
        },
      };

      const config = {
        syncExamples: true,
      };
      const absSpecFilePath = '../fixtures';

      const { specObj: output } = await syncExamples({ specObj, absSpecFilePath, config });
      expect(output.paths['/posts'].get.parameters).toEqual([
        expect.objectContaining({
          examples: {
            post1234: {
              value: 1234,
            },
          },
        }),
      ]);
    });

    it('should use the x-examples information to add examples to the requestBody & parameters when the values are asynchronous', async () => {
      const specObj = {
        paths: {
          '/posts': {
            get: {
              tags: ['posts'],
              operationId: 'getPosts',
              summary: 'Get all available posts',
              parameters: [
                {
                  name: 'id',
                  in: 'query',
                  description: 'Filter by post ID',
                  required: false,
                  schema: { type: 'integer' },
                },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                    examples: {
                      default: {
                        value: { x: 'old value' },
                        description: 'Example request body',
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'successful operation',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Post',
                        },
                      },
                    },
                  },
                  'x-examples': {
                    default: {
                      parameters: [{ value: 1234 }],
                      requestBody: { script: 'scriptValue2.js' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const config = {
        syncExamples: true,
      };
      const absSpecFilePath = '../fixtures';

      const { specObj: output } = await syncExamples({ specObj, absSpecFilePath, config });
      expect(output.paths['/posts'].get.parameters).toEqual([
        expect.objectContaining({
          examples: {
            default: {
              value: 1234,
            },
          },
        }),
      ]);
      expect(output.paths['/posts'].get.requestBody.content['application/json']).toEqual(
        expect.objectContaining({
          examples: {
            default: {
              value: 'async value 2',
              description: 'Example request body',
            },
          },
        }),
      );
    });

    it('should resolve script-parameters relative to the absSpecFilePath', async () => {
      const specObj = {
        paths: {
          '/posts': {
            get: {
              tags: ['posts'],
              operationId: 'getPosts',
              summary: 'Get all available posts',
              parameters: [
                {
                  name: 'id',
                  in: 'query',
                  description: 'Filter by post ID',
                  required: false,
                  schema: { type: 'integer' },
                },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Info',
                    },
                    examples: {
                      default: {
                        value: { x: 'old value' },
                        description: 'Example request body',
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'successful operation',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Post',
                        },
                      },
                    },
                  },
                  'x-examples': {
                    default: {
                      parameters: [{ value: 1234 }],
                      requestBody: { script: 'scriptValueDeep.js' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const config = {
        syncExamples: true,
      };
      const absSpecFilePath = '../fixtures/deep/folder/path';

      const { specObj: output } = await syncExamples({ specObj, absSpecFilePath, config });
      expect(output.paths['/posts'].get.parameters).toEqual([
        expect.objectContaining({
          examples: {
            default: {
              value: 1234,
            },
          },
        }),
      ]);
      expect(output.paths['/posts'].get.requestBody.content['application/json']).toEqual(
        expect.objectContaining({
          examples: {
            default: {
              value: 'async value deep',
              description: 'Example request body',
            },
          },
        }),
      );
    });
  });
});
