const { join } = require('upath');
const logger = require('winston');
const {
  EXAMPLE_PROP_NAME,
  IGNORE_PROPERTY_PROP_NAME,
  IGNORE_ENDPOINT_NAME,
  MOCK_FILE_PROP,
  pipe,
  getAbsSpecFilePath,
  readJsonFile,
  traverse,
  validateSpecObj,
  writeOutputFile,
} = require('./utils');
const cloneDeep = require('lodash/cloneDeep');
const { readFileSync } = require('fs');

const AMAZON_INTEGRATION_PROP = 'x-amazon-apigateway-integration';
const WEB_PAGE_SPEC_FILE_TOKEN = '"$$_specFileUrl_$$"';
const WEB_PAGE_LOGO_TOKEN = '$$_logoUrl_$$';
const WEB_PAGE_TITLE = '$$_title_$$';
const WEB_PAGE_FAVICON_HREF = '$$_faviconHref_$$';
const APPLICATION_JSON = 'application/json';

async function addGatewayInfo(specFile, server, config) {
  const specObj = readJsonFile(specFile);
  await validateSpecObj({ specObj }); // We have to validate before we try to read the file cntents
  const absSpecFilePath = getAbsSpecFilePath(specFile);
  const destPath = getAbsSpecFilePath(config.outputFile ? config.outputFile : specFile);
  const serverUrl = server || specObj.servers[0].url;

  // define the data processing pipeline
  const pipeline = pipe(
    setServerUrl,
    decorateExistingEndpoints,
    removeSchemasIfMock,
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

  return pipeline({
    specObj,
    serverUrl,
    destPath,
    specFile,
    originalSpecObj: cloneDeep(specObj),
    absSpecFilePath,
    config,
  });
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
  const { specObj, config, destPath, serverUrl } = params;
  const newConfig = { isMock: config.mock, isProxy: config.proxy, destPath, serverUrl };
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
      // We get back an array of configs, which could be empty
      const mockConfigs = mockEndpointMethodStatus({ path, method, statusCode, data, destPath: config.destPath });

      // logger.debug('config', newPath, config);

      mockConfigs.forEach(({ newPath, apiConfig }) => {
        acc[newPath] = { ...acc[newPath], ...apiConfig };
      });

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

  // Else, the only thing we wand to do is have the web and swagger endpoints (not expose the specObj endpoints)
  return {};
}

function mockEndpointMethodStatus(mockMethodParams) {
  const { path, method, statusCode, data, destPath } = mockMethodParams;

  // If the response should be ignored, ignore it.
  if (data.responses[statusCode][IGNORE_ENDPOINT_NAME]) {
    logger.info(`Ignoring ${method.toUpperCase()} ${path}`);
    return [];
  }
  const endpointName = statusCode === '200' ? path : `${path}/${statusCode}`;

  // Use the x-mock-file prop instead of the x-examples
  const mockFileObj = data.responses[statusCode][MOCK_FILE_PROP];

  // the list of configs to create
  let configs = [];

  // If it is a string, great
  if (typeof mockFileObj === 'string') {
    logger.info(`Mocking '${method.toUpperCase()} ${endpointName}' with '${mockFileObj}'`);
    configs.push({
      pathName: endpointName,
      responseData: readResponseFile(destPath, mockFileObj),
      parameters: data.parameters,
    });
  }

  // if it is an object, we need to build an array of responses.
  // Object looks like this: { "endpointName": "responseFile", "endPoint2": ... }
  if (typeof mockFileObj === 'object') {
    const mockFiles = Object.entries(mockFileObj);

    // This approach only makes sense for path-parameters. Anything else - body, query or header params - won't work.

    configs = mockFiles.map(([pathName, responseFilePath]) => {
      logger.info(`Mocking '${method.toUpperCase()} ${pathName}' with ${responseFilePath}`);
      return {
        pathName,
        responseData: readResponseFile(destPath, responseFilePath),
        parameters: [], // Set this to blank, as by using multiple mock responses, we are indicating that we have pre-filled the parameters.
      };
    });

    // Also add the default config as an endpoint
    logger.info(`Mocking '${method.toUpperCase()} ${endpointName}' with ${mockFiles[0][1]}`);
    configs.push({ pathName: endpointName, responseData: mockFiles[0][1], parameters: data.parameters });
  }

  return configs.map(({ pathName, responseData }) => ({
    newPath: pathName,
    apiConfig: {
      [method]: {
        ...data,
        // Remove these so we can remove the existing components/schemas block and so APIG doesn't complain
        parameters: undefined,
        requestBody: undefined,
        security: undefined,
        responses: {
          [statusCode]: {
            ...data.responses[statusCode],
            // Remove the examples and custom headers
            [MOCK_FILE_PROP]: undefined,
            [EXAMPLE_PROP_NAME]: undefined,
            [IGNORE_PROPERTY_PROP_NAME]: undefined,
            // Replace the application/json schema (because it doesn't matter at all for the mock API, and the schema isn't needed by APIG)
            // Doing this also avoids a bunch of APIG errors that can occur due schema-features that it does not support
            content: {
              [APPLICATION_JSON]: {
                schema: { $ref: '#/components/schemas/Empty' },
              },
            },
          },
        },
        ...getAWSMockIntegrationResponse(statusCode, { [APPLICATION_JSON]: JSON.stringify(responseData) }),
      },
    },
  }));
}

function readResponseFile(destPath, relResponseFilePath) {
  try {
    return require(join(destPath, relResponseFilePath));
  } catch {
    logger.debug(`Could not read ${destPath}${relResponseFilePath}`);
    return '';
  }
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

function removeSchemasIfMock(params) {
  // If we are using a Mock integration, the schemas aren't needed at all (other than the ones we add next)
  const { config, specObj } = params;

  if (config.mock) {
    specObj.components.schemas = undefined;
    specObj.components.securitySchemes = undefined;
    specObj.components.requestBodies = undefined;
  }

  return params;
}

function addRequiredSchemas(params) {
  const { specObj } = params;

  specObj.components.schemas = specObj.components.schemas || {};

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
  const { originalSpecObj, specObj, config } = params;

  // We can filter out the AMAZON_INTEGRATION_PROP properties, as they are quite large
  const filteredSwagger = getSmallerSwaggerForWebsite(originalSpecObj);

  specObj.paths[config.specFileEndpoint] = {
    get: {
      'x-ignore': true,
      tags: ['meta'],
      summary: 'Open API Spec schema',
      parameters: [],
      responses: {
        200: {
          description: 'Successful Operation',
          content: {
            [APPLICATION_JSON]: {
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
        { [APPLICATION_JSON]: JSON.stringify(filteredSwagger).replace(/"\$ref"/g, '"\\$ref"') }, // We need to escape "$ref", as AWS treats any property starting with "$" as a Velocity template variable!
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

  // Inject the specFile document into the template, replacing the template variable $$_swaggerObj_$$
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
        200: {
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
        [APPLICATION_JSON]: '{"statusCode": 200}',
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
        200: {
          description: '200 response',
          content: {
            [APPLICATION_JSON]: {
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
