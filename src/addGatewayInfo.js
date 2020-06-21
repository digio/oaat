const { join, relative } = require('upath');
const logger = require('winston');
const { pipe, getAbsSpecFilePath, getExampleObject, readJsonFile, traverse, writeOutputFile } = require('./utils');
const cloneDeep = require('lodash/cloneDeep');
const { readFileSync } = require('fs');

const AMAZON_INTEGRATION_PROP = 'x-amazon-apigateway-integration';
const WEB_PAGE_SPEC_FILE_TOKEN = '"$$_specFileUrl_$$"';
const WEB_PAGE_LOGO_TOKEN = '$$_logoUrl_$$';
const WEB_PAGE_TITLE = '$$_title_$$';
const WEB_PAGE_FAVICON_HREF = '$$_faviconHref_$$';

function addGatewayInfo(specFile, outputFile, server, config) {
  const specObj = readJsonFile(specFile);
  const absSpecFilePath = getAbsSpecFilePath(specFile);
  const destPath = getAbsSpecFilePath(outputFile);
  const serverUrl = server || specObj.servers[0].url;

  // Set the config.outputFile as that is what writeoOutputFile() uses
  config.outputFile = join(destPath, outputFile);

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
      logger.info(`Written ${outputFile}`);
    },
  );

  pipeline({ specObj, serverUrl, destPath, specFile, absSpecFilePath, config });
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
  specObj.paths = getAPIEndpoints(specObj);

  return params;
}

function getAPIEndpoints(specObj) {
  return Object.keys(specObj.paths)
    .filter((path) => path !== '/')
    .reduce((acc, path) => ({ ...acc, ...transformEndpoint(path, specObj.paths[path]) }), {});
}

// For each response in the endpoint, we need to produce a new endpoint with example data
// (except for the 200 response, which inherits the original endpointName
function transformEndpoint(path, data) {
  const newEndPoints = Object.keys(data).reduce((acc, method) => {
    // Attach the path-status (with child-method) configs to the accumulated config.
    // Effectively, we group the path-status keys together, with their method
    // config as a child property - just like in specFile
    const pathStatusConfig = transformEndpointMethod(path, method, data[method]);
    Object.keys(pathStatusConfig).forEach((pathStatus) => {
      acc[pathStatus] = { ...acc[pathStatus], ...pathStatusConfig[pathStatus] };
    });

    return acc;
  }, {});
  // console.log(newEndPoints);

  return newEndPoints;
}

// We need to iterate over the response codes as well
function transformEndpointMethod(path, method, data) {
  const newEndPoints = Object.keys(data.responses).reduce((acc, statusCode) => {
    const { newPath, config } = transformEndpointMethodStatus(path, method, statusCode, data);
    // console.log('config', newPath, config);
    acc[newPath] = { ...acc[newPath], ...config };
    return { ...acc };
  }, {});
  // console.log(newEndPoints);

  return newEndPoints;
}

function transformEndpointMethodStatus(path, method, statusCode, data) {
  const endpointName = statusCode === '200' ? path : `${path}/${statusCode}`;

  const exampleObj = getExampleObject(data.responses[statusCode]); // get the first example object, if it exists

  // TODO: Only mock if we've been asked to mock (config.mock)
  if (exampleObj && exampleObj.responseFile) {
    console.log(`Mocking '${method.toUpperCase()} ${endpointName}' with '${exampleObj.responseFile}'`);
  }
  const responseData = exampleObj && exampleObj.responseFile ? require(join(__dirname, exampleObj.responseFile)) : '';

  return {
    newPath: endpointName,
    config: {
      [method]: {
        tags: data.tags,
        summary: data.summary,
        parameters: data.parameters,
        responses: {
          [statusCode]: data.responses[statusCode],
        },
        ...getAWSIntegrationResponse(statusCode, { 'application/json': JSON.stringify(responseData) }),
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
      ...getAWSIntegrationResponse(
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

  // console.log('Website data', websiteData);

  specObj.paths[config.specUIEndpoint] = {
    get: {
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
      ...getAWSIntegrationResponse(200, { 'text/html': websiteData }),
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

function getAWSIntegrationResponse(statusCode, responseTemplates, responseParameters) {
  return {
    [AMAZON_INTEGRATION_PROP]: {
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
      type: 'mock',
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
      ...getAWSIntegrationResponse('200', undefined, {
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
