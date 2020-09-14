const qs = require('querystring');
const { join, dirname } = require('upath');
const { writeFileSync } = require('fs');
const logger = require('winston');
const mkdirp = require('mkdirp');
const pipe = require('p-pipe');
const Enforcer = require('openapi-enforcer');

const EXAMPLE_PROP_NAME = 'x-examples';
const IGNORE_PROPERTY_PROP_NAME = 'x-test-ignore-paths';
const IGNORE_ENDPOINT_NAME = 'x-ignore';

// Returns fetch config for calling all the endpoints
function getFetchConfigForAPIEndpoints(params) {
  const { specObj } = params;
  const fetchConfigs = Object.keys(specObj.paths)
    .map((path) => transformEndpointPath(path, specObj.paths[path]))
    .reduce((acc, val) => acc.concat(val), []); // Flatten one level

  logger.verbose('FetchConfigs:', fetchConfigs);

  return {
    ...params,
    fetchConfigs,
  };
}

function concurrentFunctionProcessor(fnArray, maxConcurrent = 15) {
  return new Promise((resolve) => {
    // https://nodesource.com/blog/understanding-streams-in-nodejs/
    // Create a stream from an array of functions, that execute those functions
    // until we reach the maxConcurrent limit. When a function has resolved,
    // we can resume the stream and process the next function.
    const { Readable } = require('stream');
    const readableStream = Readable.from(fnArray); // In Node 10.17.0 upwards
    const total = fnArray.length;
    let inFlight = 0;
    let counter = 0;
    const reachedLimit = () => inFlight >= maxConcurrent;
    const promises = [];

    readableStream.on('data', (data) => {
      counter++;
      inFlight++;
      promises.push(
        Promise.resolve(data(counter, total)).finally(() => {
          inFlight--;
          logger.debug(`Promise resolved, ${inFlight}, ${readableStream.readableLength}`);
          readableStream.resume();
        }),
      );

      // If we've reached the limit, pause the stream
      if (reachedLimit()) {
        readableStream.pause();
      }
    });

    readableStream.on('end', () => {
      logger.debug('concurrentFunctionProcessor stream END');
      // Return the resolved promises
      Promise.all(promises).then((results) => resolve(results));
    });
  });
}

// For each response in the endpoint, we need to produce a new endpoint with example data
function transformEndpointPath(path, data) {
  const newEndPoints = Object.keys(data)
    .map((method) => {
      return data[method][IGNORE_ENDPOINT_NAME] ? [] : transformEndpointMethod(path, method, data[method]);
    })
    .reduce((acc, val) => acc.concat(val), []); // Flatten one level

  // console.log('A', newEndPoints);

  return newEndPoints;
}

// We need to iterate over the response codes as well
function transformEndpointMethod(path, method, data) {
  const newEndPoints = Object.keys(data.responses)
    .map((statusCode) => {
      return data.responses[statusCode][IGNORE_ENDPOINT_NAME]
        ? []
        : transformEndpointMethodResponse(path, method, Number(statusCode), data);
    })
    .reduce((acc, val) => acc.concat(val), []); // Flatten one level
  // console.log(newEndPoints);

  return newEndPoints;
}

// Iterate over the EXAMPLE_PROP_NAME, to allow multiple examples for each path-method-response
function transformEndpointMethodResponse(path, method, statusCode, data) {
  const newEndPoints = Object.keys(data.responses[statusCode][EXAMPLE_PROP_NAME] || { default: {} })
    .map((exampleName, exampleIndex) =>
      buildFetchConfigWithoutParameters(path, method, Number(statusCode), exampleName, exampleIndex, data),
    )
    .filter((config) => Boolean(config));

  // console.log('NewEndpoint', newEndPoints);

  return newEndPoints;
}

// We build Fetch config based on the parameter examples.
// If there parameters but no EXAMPLE_PROP_NAME in the response[statusCode], then we don't build it.
function buildFetchConfigWithoutParameters(path, method, statusCode, exampleName, exampleIndex, data) {
  updateExampleObject(data.responses[statusCode], exampleName); // Make sure we have an examples object
  const examples = data.responses[statusCode][EXAMPLE_PROP_NAME];

  // Define config base-object, which we will change as needed
  const config = {
    path,
    query: {}, // Needed so that we can build query parameters
    url: path,
    config: { method },
    apiEndpoint: data,
    expectedStatusCode: Number(statusCode),
    existingResponseFile: examples[exampleName].responseFile, // This is useful for the integration tests
    ignorePathsList: data.responses[statusCode][IGNORE_PROPERTY_PROP_NAME] || [], // Used by integration tests
    exampleName,
    exampleIndex,
  };

  const hasParams = data.parameters && data.parameters.length;
  const hasRequestBody = Boolean(data.requestBody);

  // If there are no parameters and no requestBody, we can only call the API and get a single response - the 200 response.
  if (!hasParams && !hasRequestBody) {
    // if this is not the 200-response,
    if (statusCode !== 200) {
      logger.debug('Ignore (no params) -', statusCode, method, path);
      return null;
    }
    // Else this is the 200 response, so we don't need x-examples and can proceed
    return config;
  }

  if (hasParams && !examples[exampleName].parameters) {
    logger.warn(`Ignore (no ${EXAMPLE_PROP_NAME} parameters) - ${statusCode} ${method} ${path}`);
    return null;
  }

  if (hasRequestBody && !examples[exampleName].requestBody) {
    logger.warn(`Ignore (no ${EXAMPLE_PROP_NAME} requestBody) - ${statusCode} ${method} ${path}`);
    return null;
  }

  return config;
}

/* eslint-disable @getify/proper-arrows/where */
const paramTypeMapping = {
  body: (fc, paramValue) => {
    fc.config.body = JSON.stringify(paramValue);
    return fc;
  },
  query: (fc, paramValue, queryParam) => {
    // If we get a null value, it means there is no value for the query string param
    if (paramValue !== null) {
      fc.query[queryParam] = paramValue;
    }
    return fc;
  },
  path: (fc, paramValue, pathParam) => {
    fc.url = fc.url.replace(`{${pathParam}}`, paramValue);
    return fc;
  },
  header: (fc, paramValue, paramKey) => {
    if (!fc.config.headers) {
      fc.config.headers = { [paramKey]: paramValue };
      return fc;
    }
    Object.assign(fc.config.headers, { [paramKey]: paramValue });
    return fc;
  },
};
/* eslint-enable @getify/proper-arrows/where */

/**
 * This method adds the parameters to each fetchConfig, and must be async
 * to allow for { x-examples: { default: { script: '' }}} parameters
 * @param {Array} params.fetchConfigs
 * @param {String} params.serverUrl
 * @param {String} params.serverUrl
 * @return {Promise<{fetchConfigs}>}
 */
async function addParamsToFetchConfig(params) {
  // console.log('add', fetchConfigs );
  const { fetchConfigs, config, serverUrl, absSpecFilePath } = params;

  const newConfigs = await concurrentFunctionProcessor(
    fetchConfigs.map((fconfig) => () => resolveFetchConfigParams({ fconfig, serverUrl, absSpecFilePath })),
    config.simultaneousRequests,
  );

  logger.debug('addParamsToFetchConfig Params', newConfigs);

  return { ...params, fetchConfigs: newConfigs };
}

async function resolveFetchConfigParams(params) {
  let { fconfig, serverUrl, absSpecFilePath } = params;
  // console.log('CONFIG', absSpecFilePath);

  // Need to loop over the parameters array
  await Promise.all(
    (fconfig.apiEndpoint.parameters || []).map(async (param, index) => {
      const paramType = param.in;
      const pathParam = param.name;
      const paramValue = await getParamValue(
        serverUrl,
        fconfig.apiEndpoint.responses[fconfig.expectedStatusCode][EXAMPLE_PROP_NAME][fconfig.exampleName].parameters[
          index
        ],
        absSpecFilePath,
      );
      fconfig = paramTypeMapping[paramType](fconfig, paramValue, pathParam);
    }),
  );

  // If the API has a requestBody, then there must be a requestBody example too
  if (fconfig.apiEndpoint.requestBody) {
    const paramValue = await getParamValue(
      serverUrl,
      fconfig.apiEndpoint.responses[fconfig.expectedStatusCode][EXAMPLE_PROP_NAME][fconfig.exampleName].requestBody,
      absSpecFilePath,
    );
    fconfig = paramTypeMapping.body(fconfig, paramValue);
  }

  // In the case where we have query parameters, append them to the url
  if (Object.keys(fconfig.query).length) {
    fconfig.url += `?${qs.stringify(fconfig.query)}`;
  }

  return fconfig;
}

function getParamValue(serverUrl, inputObj, absSpecFilePath) {
  if (inputObj.script !== undefined) {
    // TODO: The script MUST be relative to the spec file!
    const fn = require(join(absSpecFilePath, inputObj.script));
    return fn({ serverUrl });
  }
  if (inputObj.value !== undefined) {
    return inputObj.value;
  }
  throw new Error(
    `${EXAMPLE_PROP_NAME}.example.parameters object must contain a \`script\` OR \`value\` property. Received: ${JSON.stringify(
      inputObj,
    )}`,
  );
}

/**
 * Gets the example from the object, or returns undefined.
 * @param obj           The api-spec response-status object (path.method.responses.status)
 * @param exampleName   The name of the example
 * @return {any}        The example object, or undefined
 */
function getExampleObject(responseStatusObj, exampleName) {
  if (!responseStatusObj[EXAMPLE_PROP_NAME]) {
    return undefined;
  }
  if (!exampleName) {
    const examples = Object.keys(responseStatusObj[EXAMPLE_PROP_NAME]);
    return examples.length ? responseStatusObj[EXAMPLE_PROP_NAME][examples[0]] : undefined;
  }
  return responseStatusObj[EXAMPLE_PROP_NAME][exampleName];
}

/**
 * Mutates the api-spec response-status object (path.method.responses.status),
 * creating the example object if necessary, along with a key and value if provided
 * @param {object} responseStatusObj  path.method.responses.status object
 * @param {string} exampleName        Name of the example
 * @param {string} key                Optional key
 * @param {object} value              Optional value
 */
function updateExampleObject(responseStatusObj, exampleName, key, value) {
  if (!responseStatusObj[EXAMPLE_PROP_NAME]) {
    responseStatusObj[EXAMPLE_PROP_NAME] = {};
  }

  if (!responseStatusObj[EXAMPLE_PROP_NAME][exampleName]) {
    responseStatusObj[EXAMPLE_PROP_NAME][exampleName] = {};
  }

  if (key) {
    responseStatusObj[EXAMPLE_PROP_NAME][exampleName][key] = value;
  }
}

function getResponsePropertyPathsToIgnore(apiResponses, statusCode) {
  return apiResponses[statusCode] && apiResponses[statusCode][IGNORE_PROPERTY_PROP_NAME];
}

function returnExitCode(params) {
  const { hasErrors } = params;
  return hasErrors ? 1 : 0;
}

function readJsonFile(fileName) {
  return require(join(process.cwd(), fileName));
}

function writeJsonFile(fileName, data, config) {
  if (!config.dryRun) {
    mkdirp.sync(dirname(fileName)); // Create any missing directories in the file name
    writeFileSync(fileName, JSON.stringify(data, null, 2));
  }
  logger.debug(`Written ${fileName} successfully`);
}

function getLogAndConfig(commandName, cmd) {
  const { configureLogger } = require('./logger');
  const log = configureLogger({ logLevel: cmd.verbose ? 'verbose' : 'info', silent: Boolean(cmd.quiet) });
  log.debug('command args', cmd);

  // Read the default config file
  const defaultConfig = require('./defaultConfig');
  const config = { ...defaultConfig[commandName], ...defaultConfig.global };

  // If a config file has been specified, try to merge it into the defaultConfig
  if (cmd.config) {
    try {
      const merge = require('lodash/merge');
      const externalConfig = require(join(process.cwd(), cmd.config));
      merge(config, { ...externalConfig[commandName], ...externalConfig.global });
    } catch (err) {
      log.error('Could not load specified config file', err);
    }
  }

  config.dryRun = Boolean(cmd.dryRun);
  config.outputFile = cmd.output;

  log.debug('config', config);

  return {
    log,
    config,
  };
}

/**
 * If the config has specified a different output file, write to that file instead of the input file
 * @param {object} params.specObj
 * @param {string} params.specFile
 * @param {object} params.config
 */
function writeOutputFile(params) {
  const { specObj, specFile, config } = params;
  const destFile = config.outputFile ? config.outputFile : specFile;

  writeJsonFile(destFile, specObj, config);

  return params;
}

/**
 * Traverses an object, applying a function to each object, key
 * @param {object} obj
 * @param {Function} func   Function to apply to each key of the object
 * @return {*}
 */
function traverse(obj, func) {
  Object.keys(obj).forEach((key) => {
    obj = Reflect.apply(func, this, [obj, key]);
    if (obj[key] !== null && typeof obj[key] === 'object') {
      // going one step down in the object tree!!
      obj[key] = traverse(obj[key], func);
    }
  });
  return obj;
}

function getAbsSpecFilePath(specFile) {
  return join(process.cwd(), dirname(specFile));
}

// Hacky way to clone JSON data
function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function validateSpecObj(params) {
  const { specObj } = params;
  const [openapi, error] = Enforcer.v3_0.OpenApi(await Enforcer.dereference(specObj));

  if (error) {
    throw error;
  }

  return { ...params, openapi };
}

module.exports = {
  addParamsToFetchConfig,
  concurrentFunctionProcessor,
  cloneDeep,
  getAbsSpecFilePath,
  getExampleObject,
  getFetchConfigForAPIEndpoints,
  getLogAndConfig,
  getPathsToIgnore: getResponsePropertyPathsToIgnore,
  pipe,
  readJsonFile,
  returnExitCode,
  traverse,
  updateExampleObject,
  validateSpecObj,
  writeJsonFile,
  writeOutputFile,
  IGNORE_ENDPOINT_NAME,
};
