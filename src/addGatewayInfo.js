const { join } = require('upath');
const logger = require('winston');
const {
  IGNORE_ENDPOINT_NAME,
  pipe,
  getAbsSpecFilePath,
  getExampleObject,
  readJsonFile,
  traverse,
  writeOutputFile,
} = require('./utils');
const cloneDeep = require('lodash/cloneDeep');
const { readFileSync } = require('fs');

const AMAZON_INTEGRATION_PROP = 'x-amazon-apigateway-integration';
const WEB_PAGE_SPEC_FILE_TOKEN = '"$$_specFileUrl_$$"';
const WEB_PAGE_LOGO_TOKEN = '$$_logoUrl_$$';
const WEB_PAGE_TITLE = '$$_title_$$';
const WEB_PAGE_FAVICON_HREF = '$$_faviconHref_$$';

function addGatewayInfo(specFile, server, config) {
  const specObj = readJsonFile(specFile);
  const absSpecFilePath = getAbsSpecFilePath(specFile);
  const serverUrl = server || specObj.servers[0].url;

  // define the data processing pipeline
  const pipeline = pipe(
    setServerUrl,
    decorateExistingEndpoints,
    addRequiredSchemas,
    addSpecFileEndpoint,
    addWebsiteEndpoint,
    filterSchemas,
    writeOutputFile,
    () => {
      if (config.mock) {
        logger.info(`Written ${config.outputFile} with mock responses`);
      } else if (config.proxy) {
        logger.info(`Written ${config.outputFile}, proxying responses to ${serverUrl}`);
      } else {
        logger.info(`Written ${config.outputFile}`);
      }
    },
  );

  pipeline({ specObj, serverUrl, specFile, absSpecFilePath, config });
}

function setServerUrl(params) {
  const { specObj, serverUrl } = params;

  if (serverUrl) {
    specObj.servers = [{ url: serverUrl }];
  }

  return params;
}

function decorateExistingEndpoints(params) {
  const { specObj } = params;

  specObj.paths = mockAPIEndpoints(params);

  return params;
}

function mockAPIEndpoints(params) {
  const { specObj, config, serverUrl } = params;
  const newConfig = { isMock: config.mock, isProxy: config.proxy, serverUrl };
  return Object.keys(specObj.paths).reduce(
    (acc, path) => ({ ...acc, ...transformEndpoint(newConfig, path, specObj.paths[path]) }),
    {},
  );
}

// For each response in the endpoint, we need to produce a new endpoint with example data
// (except for the 200 response, which inherits the original endpointName
function transformEndpoint(config, path, data) {
  const newEndPoints = Object.keys(data).reduce((acc, method) => {
    // If this path-method should be ignored, ignore it
    if (data[method][IGNORE_ENDPOINT_NAME]) {
      return acc;
    }

    // Attach the path-status (with child-method) configs to the accumulated config.
    // Effectively, we group the path-status keys together, with their method
    // config as a child property - just like in specFile
    const pathStatusConfig = transformEndpointMethod(config, path, method, data[method]);
    Object.keys(pathStatusConfig).forEach((pathStatus) => {
      acc[pathStatus] = { ...acc[pathStatus], ...pathStatusConfig[pathStatus] };
    });

    return acc;
  }, {});

  return newEndPoints;
}

// We need to iterate over the response codes as well
function transformEndpointMethod(config, path, method, data) {
  if (config.isMock) {
    const newEndPoints = Object.keys(data.responses).reduce((acc, statusCode) => {
      const mockConfig = mockEndpointMethodStatus(path, method, statusCode, data);
      // logger.debug('config', newPath, config);
      if (!mockConfig) {
        return acc;
      }
      const { newPath, apiConfig } = mockConfig;
      acc[newPath] = { ...acc[newPath], ...apiConfig };
      return { ...acc };
    }, {});
    // logger.debug(newEndPoints);
    return newEndPoints;
  }

  if (config.isProxy) {
    const newEndPoints = proxyEndpointMethod(path, method, config.serverUrl, data);
    logger.debug('newEndpoints', newEndPoints);
    return newEndPoints;
  }

  // Else, the only thing we wand to do is have the web and swagger endpoints (not expose the sepcObj endpoints)
  return {};
}

function mockEndpointMethodStatus(path, method, statusCode, data) {
  // If the response should be ignored, ignore it.
  if (data.responses[statusCode][IGNORE_ENDPOINT_NAME]) {
    return;
  }

  const endpointName = statusCode === '200' ? path : `${path}/${statusCode}`;
  const exampleObj = getExampleObject(data.responses[statusCode]); // get the first example object, if it exists

  if (exampleObj && exampleObj.responseFile) {
    logger.info(`Mocking '${method.toUpperCase()} ${endpointName}' with '${exampleObj.responseFile}'`);
  }
  const responseData = exampleObj && exampleObj.responseFile ? require(join(__dirname, exampleObj.responseFile)) : '';

  return {
    newPath: endpointName,
    apiConfig: {
      [method]: {
        ...data,
        responses: {
          [statusCode]: data.responses[statusCode],
        },
        ...getAWSMockIntegrationResponse(statusCode, { 'application/json': JSON.stringify(responseData) }),
      },
    },
  };
}

function proxyEndpointMethod(path, method, serverUrl, data) {
  const requestParameters = {};
  // Must be in the format: "integration.request.{path|querystring|header}.{paramName}" : "method.request.{path|querystring|header}.{paramName}"

  return {
    [path]: {
      [method]: {
        ...data,
        ...getAWSHttpProxyIntegrationResponse(method, `${serverUrl}${path}`),
      },
    },
  };
}

function getAWSSupportedDefinitions(data) {
  return traverse(data, filterNonAWSSupportedNodes);
}

function filterNonAWSSupportedNodes(obj, key) {
  if (key === 'example') {
    return { ...obj, [key]: undefined };
  }
  return obj;
}

function addRequiredSchemas(params) {
  const { specObj } = params;
  // Add the Empty type for API Gateway CORS responses
  specObj.components.schemas.Empty = {
    type: 'object',
    title: 'Empty response model for AWS + CORS use',
  };

  // Add the StringResponse type too
  specObj.components.schemas.StringResponse = {
    type: 'string',
    title: 'String-type workaround for API Gateway',
  };

  return params;
}

function addSpecFileEndpoint(params) {
  const { specObj, config } = params;
  // We can filter out the AMAZON_INTEGRATION_PROP properties, as they are quite large
  const filteredSwagger = getSmallerSwaggerForWebsite(cloneDeep(specObj));

  specObj.paths[config.specFileEndpoint] = {
    get: {
      'x-ignore': true,
      tags: ['meta'],
      summary: 'Open API Spec schema',
      parameters: [],
      responses: {
        '200': {
          description: 'Successful Operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StringResponse', // Just need *something* for this to work
              },
            },
          },
          headers: {
            'Access-Control-Allow-Origin': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Methods': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Headers': {
              schema: {
                type: 'string',
              },
            },
          },
        },
      },
      ...getAWSMockIntegrationResponse(
        '200',
        { 'application/json': JSON.stringify(filteredSwagger).replace(/"\$ref"/g, '"\\$ref"') }, // We need to escape "$ref", as AWS treats any property starting with "$" as a Velocity template variable!
        {
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers':
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      ),
    },
    ...getCORSOptionsResponse(),
  };

  return params;
}

function addWebsiteEndpoint(params) {
  const { specObj, config } = params;
  // Read the template
  const websiteTemplate = readFileSync(join(__dirname, 'web/index.html')).toString();

  // Inject the specFile document into the template, replacing the template varible $$_swaggerObj_$$
  const websiteData = websiteTemplate
    .replace(WEB_PAGE_SPEC_FILE_TOKEN, `'${config.specFileEndpoint}'`)
    .replace(WEB_PAGE_LOGO_TOKEN, config.webLogoUrl)
    .replace(WEB_PAGE_TITLE, config.webTitle)
    .replace(WEB_PAGE_FAVICON_HREF, config.webFaviconHref);

  logger.debug('Website data', websiteData);

  specObj.paths[config.specUIEndpoint] = {
    get: {
      'x-ignore': true,
      tags: ['meta'],
      responses: {
        '200': {
          description: '200 response',
          content: {
            'text/html': {
              schema: { $ref: '#/components/schemas/StringResponse' },
              example: {
                value: '<html><body>Your HTML text</body></html>',
              },
            },
          },
        },
      },
      ...getAWSMockIntegrationResponse(200, { 'text/html': websiteData }),
    },
  };

  return params;
}

function filterSchemas(params) {
  const { specObj } = params;
  // Filter the schemas AFTER we have built the website, so that the schemas have examples
  specObj.components.schemas = getAWSSupportedDefinitions(specObj.components.schemas);

  return params;
}

/**
 * Remove data from the swagger.json that doesn't need to be rendered.
 * @param data
 * @return {*}
 */
function getSmallerSwaggerForWebsite(data) {
  return traverse(data, filterNonWebsiteRequiredNodes);
}

function filterNonWebsiteRequiredNodes(obj, key) {
  if (key === AMAZON_INTEGRATION_PROP) {
    return { ...obj, [key]: undefined };
  }
  return obj;
}

function getAWSMockIntegrationResponse(statusCode, responseTemplates, responseParameters) {
  return {
    [AMAZON_INTEGRATION_PROP]: {
      type: 'MOCK',
      responses: {
        default: {
          statusCode: String(statusCode),
          responseTemplates,
          responseParameters,
        },
      },
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
      passthroughBehavior: 'when_no_match',
    },
  };
}

function getAWSHttpProxyIntegrationResponse(httpMethod, uri, requestParameters) {
  return {
    [AMAZON_INTEGRATION_PROP]: {
      type: 'HTTP_PROXY',
      httpMethod,
      uri,
      requestParameters,
    },
  };
}

function getCORSOptionsResponse() {
  return {
    options: {
      responses: {
        '200': {
          description: '200 response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Empty',
              },
            },
          },
          headers: {
            'Access-Control-Allow-Origin': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Methods': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Headers': {
              schema: {
                type: 'string',
              },
            },
          },
        },
      },
      ...getAWSMockIntegrationResponse('200', undefined, {
        'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
        'method.response.header.Access-Control-Allow-Headers':
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      }),
    },
  };
}

module.exports = {
  addGatewayInfo,
};
