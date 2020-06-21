const {
  pipe,
  readJsonFile,
  writeOutputFile,
  getAbsSpecFilePath,
  getFetchConfigForAPIEndpoints,
  getExampleObject,
  addParamsToFetchConfig,
} = require('./utils');
const logger = require('winston');

function lintCommand(specFile, config) {
  const specObj = readJsonFile(specFile);
  const absSpecFilePath = getAbsSpecFilePath(specFile);

  // Read the file, lint it, write it
  const pipeline = pipe(lintSpec, writeOutputFile, () => {
    logger.info('Linting complete.');
  });

  pipeline({ specObj, specFile, absSpecFilePath, config });
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

    if (!example) {
      return;
    }

    const specRef = specObj.paths[fc.path][fc.config.method];

    if (specRef.parameters && example.parameters) {
      // Iterate over the parameters
      specRef.parameters.forEach((param, i) => {
        param.examples = param.examples || {};
        param.examples[fc.exampleName] = param.examples[fc.exampleName] || {};
        param.examples[fc.exampleName].value = example.parameters[i].value;
      });
    }

    if (specRef.requestBody && example.requestBody) {
      // Note: Pointing directly to the application/json content!
      const specExamples = specRef.requestBody.content['application/json'];

      specExamples.examples = specExamples.examples || {};
      specExamples.examples[fc.exampleName] = specExamples.examples[fc.exampleName] || {};
      specExamples.examples[fc.exampleName].value = JSON.parse(fc.config.body);
    }
  });

  return params;
}

module.exports = { lintCommand, lintSpec, sortPaths, sortComponents, syncExamples };
