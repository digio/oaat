const {
  pipe,
  addParamsToFetchConfig,
  readJsonFile,
  writeOutputFile,
  getAbsSpecFilePath,
  getFetchConfigForAPIEndpoints,
  getExampleObject,
  isSuccessStatusCode,
  validateSpecObj,
} = require('./utils');
const logger = require('winston');

async function lintCommand(specFile, server, config) {
  const specObj = readJsonFile(specFile);
  const absSpecFilePath = getAbsSpecFilePath(specFile);
  const serverUrl = server || specObj.servers[0].url;

  // Read the file, lint it, write it
  const pipeline = pipe(validateSpecObj, lintSpec, writeOutputFile, () => {
    logger.info('Linting complete.');
  });

  return pipeline({ specObj, serverUrl, specFile, absSpecFilePath, config });
}

function lintSpec(params) {
  const miniPipeline = pipe(sortPaths, sortComponents, syncExamples);
  return miniPipeline(params);
}

function sortPaths(params) {
  const { specObj, config } = params;
  if (specObj.paths && config.sortPathsAlphabetically) {
    logger.info('Sorting "paths"');
    specObj.paths = sortChildKeys(specObj, 'paths');
  }
  return params;
}

function sortComponents(params) {
  const { specObj, config } = params;
  if (specObj.paths && config.sortComponentsAlphabetically) {
    logger.info('Sorting "components"');
    specObj.components.schemas = sortChildKeys(specObj.components, 'schemas');
  }
  return params;
}

function sortChildKeys(obj, childProp) {
  return Object.keys(obj[childProp])
    .sort()
    .reduce((newDefs, key) => ({ ...newDefs, [key]: obj[childProp][key] }), {});
}

/**
 * Uses the x-examples object to generate an Open API Spec `examples` object
 * @param params
 * @return {Promise<*>}
 */
async function syncExamples(params) {
  const { specObj, config, fetchConfigs: existingFetchConfig } = params;
  let fetchConfigs = existingFetchConfig;

  if (!config.syncExamples) {
    return params;
  }

  // Get the fetchConfigs, if it does not exist
  if (!fetchConfigs) {
    const newParams = getFetchConfigForAPIEndpoints(params);
    logger.verbose('syncExamples - newParams', newParams);
    const { fetchConfigs: newFetchConfigs } = await addParamsToFetchConfig(newParams);
    fetchConfigs = newFetchConfigs;
  }

  // Iterate over the fetchConfig
  fetchConfigs.forEach((fc) => {
    const example = getExampleObject(fc.apiEndpoint.responses[fc.expectedStatusCode], fc.exampleName);

    // If there is no example, or the example is for a non-2xx response, ignore it
    if (!example || !isSuccessStatusCode(Number(fc.expectedStatusCode))) {
      return;
    }

    const specRef = specObj.paths[fc.path][fc.config.method];

    if (specRef.parameters && example.parameters) {
      // Iterate over the parameters
      specRef.parameters.forEach((param, i) => {
        param.examples = param.examples || {};
        param.examples[fc.exampleName] = param.examples[fc.exampleName] || {};
        param.examples[fc.exampleName].value = fc.resolvedParams[i];
      });
    }

    if (specRef.requestBody && example.requestBody) {
      // Note: Pointing directly to the application/json content!
      const isRequestRef = specRef.requestBody.$ref;

      // // It is risky to update a shared $ref, as each $ref-user could have examples with names that over-write the other!
      const specExamples = (isRequestRef ? getRequestBodyRefObject(specObj, isRequestRef) : specRef.requestBody)
        .content['application/json'];
      specExamples.examples = specExamples.examples || {};
      specExamples.examples[fc.exampleName] = specExamples.examples[fc.exampleName] || {};
      specExamples.examples[fc.exampleName].value = fc.resolvedRequestBody;
    }
  });

  return params;
}

// Resolve "#/components/requestBodies/BodyRequest" into the object
function getRequestBodyRefObject(specObj, strRef) {
  if (!strRef.startsWith('#')) {
    throw new Error('$ref does not begin with "#"');
  }
  const parts = strRef.split('/').slice(1); // ignore the first "#/"
  let ref = specObj;

  while (parts.length) {
    const path = parts.shift();
    ref = ref[path];
  }
  return ref;
}

module.exports = { lintCommand, lintSpec, sortPaths, sortComponents, syncExamples };
