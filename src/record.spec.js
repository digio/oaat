/* eslint-disable @getify/proper-arrows/where */
const { fetchResponses, validateResponses, writeResponses, writeResponseFileAndSpecRef } = require('./record');
const { getAbsSpecFilePath } = require('./utils');

describe('record', () => {
  describe('fetchResponses()', () => {
    it('should send up to 15 concurrent requests', async () => {
      const mockEndpointRequestFn = jest.fn();
      const params = {
        fetchConfigs: [...'x'.repeat(31)], // Pretend there are 31 endpoints to call
        config: {
          simultaneousRequests: 15,
        },
        endpointRequestFn: mockEndpointRequestFn,
      };

      await fetchResponses(params);
      expect(mockEndpointRequestFn).toHaveBeenCalledTimes(31);
      expect(mockEndpointRequestFn).nthCalledWith(1, expect.objectContaining({ counter: 1, total: 31 }));
      expect(mockEndpointRequestFn).nthCalledWith(15, expect.objectContaining({ counter: 15 }));
      expect(mockEndpointRequestFn).nthCalledWith(16, expect.objectContaining({ counter: 16 }));
      expect(mockEndpointRequestFn).nthCalledWith(30, expect.objectContaining({ counter: 30 }));
      expect(mockEndpointRequestFn).nthCalledWith(31, expect.objectContaining({ counter: 31 }));
      // In the previous version of this algorithm, requests were sent in batches, so
      // it was easier to verify that the test worked as per the description.
      // Now that there is a concurrency limit, we cannot tell when we've hit the limit
    });
  });

  describe('validateResponses()', () => {
    it('should discard responses where the expected status code does not match the actual status code', () => {
      const responses = [
        { url: '/1', statusCode: 200, expectedStatusCode: 200, config: { method: 'get' } },
        { url: '/2', statusCode: 400, expectedStatusCode: 400, config: { method: 'post' } },
        { url: '/3', statusCode: 200, expectedStatusCode: 400, config: { method: 'post' } },
      ];

      expect(validateResponses({ responses }).responses).toEqual([
        { url: '/1', statusCode: 200, expectedStatusCode: 200, config: { method: 'get' } },
        { url: '/2', statusCode: 400, expectedStatusCode: 400, config: { method: 'post' } },
      ]);
    });
  });

  describe('writeResponses(dryRun = true)', () => {
    const config = Object.freeze({
      dryRun: true,
      responseBasePath: 'mocks/',
      responseFilenameFn: require('./defaultConfig').record.responseFilenameFn,
    });
    const destPath = getAbsSpecFilePath('some/path/file.json');

    it('should return an array of filenames for the response files that it has generated, using the default config.responseFilenamFn function', () => {
      const responses = [
        {
          exampleIndex: 0,
          exampleName: 'default',
          config: { method: 'get' },
          path: '/api/{p1}',
          statusCode: 200,
          apiEndpoint: { responses: { 200: { 'x-examples': {} } } },
        },
        {
          exampleIndex: 0,
          exampleName: 'myExample',
          config: { method: 'post' },
          path: '/api2',
          statusCode: 200,
          apiEndpoint: { responses: { 200: { 'x-examples': {} } } },
        },
      ];

      const { responseFiles } = writeResponses({ responses, destPath, config });
      expect(responseFiles).toEqual([
        'mocks/GET_api_{p1}-200_DEFAULT.json',
        'mocks/POST_api2-200_DEFAULT_myExample.json',
      ]);
    });

    it('should return an array of filenames for the response files that it has generated, using a provided config.responseFilenamFn function', () => {
      const responses = [
        {
          exampleIndex: 0,
          exampleName: 'default',
          config: { method: 'get' },
          path: '/api/{p1}',
          statusCode: 200,
          apiEndpoint: { tags: ['/tag1', 'tag2'], responses: { 200: { 'x-examples': {} } } },
        },
        {
          exampleIndex: 0,
          exampleName: 'myExample',
          config: { method: 'get' },
          path: '/api/{p1}',
          statusCode: 200,
          apiEndpoint: { tags: ['demo tag'], responses: { 200: { 'x-examples': {} } } },
        },
        {
          exampleIndex: 0,
          exampleName: 'third',
          config: { method: 'get' },
          path: '/api3',
          statusCode: 200,
          apiEndpoint: { /* no tags */ responses: { 200: { 'x-examples': {} } } },
        },
      ];

      // The responseFilenameFn function - which uses the tags[] field for the sub directory name.
      const responseFilenameFn = (data) => {
        const subFolder =
          (data.apiEndpoint.tags && data.apiEndpoint.tags.length && data.apiEndpoint.tags[0].replace(/\//g, '')) || '';
        return `${subFolder}/${data.config.method.toUpperCase()}_${data.path.slice(1).replace(/\//g, '_')}-${
          data.statusCode
        }_${data.exampleName}.json`;
      };

      const { responseFiles } = writeResponses({ responses, destPath, config: { ...config, responseFilenameFn } });
      expect(responseFiles).toEqual([
        'mocks/tag1/GET_api_{p1}-200_default.json',
        'mocks/demo tag/GET_api_{p1}-200_myExample.json',
        'mocks/GET_api3-200_third.json',
      ]);
    });
  });

  describe('writeResponseFileAndSpecRef(dryRun = true)', () => {
    it('should modify the API data with the responseFile name', () => {
      const filePath = '../mocks/GET_api_{p1}-200_DEFAULT.json';
      const relPath = filePath;
      const data = 'not used for dry run';
      const specRef = {
        statusCode: 200,
        exampleName: 'default',
        apiEndpoint: {
          responses: {
            200: {
              'x-examples': {},
            },
          },
        },
      };
      const config = {
        dryRun: true,
      };

      writeResponseFileAndSpecRef(filePath, relPath, data, specRef, config);
      expect(specRef.apiEndpoint.responses['200']['x-examples']).toEqual({
        default: { responseFile: '../mocks/GET_api_{p1}-200_DEFAULT.json' },
      });
    });
  });
});
