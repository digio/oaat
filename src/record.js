const { join, relative } = require('upath');
const { readdirSync, lstatSync, unlinkSync } = require('fs');
const fetch = require('node-fetch');
const logger = require('winston');
const {
  pipe,
  concurrentFunctionProcessor,
  getAbsSpecFilePath,
  getExampleObject,
  updateExampleObject,
  getFetchConfigForAPIEndpoints,
  addParamsToFetchConfig,
  readJsonFile,
  validateSpecObj,
  writeJsonFile,
  writeOutputFile,
} = require('./utils');
const { lintSpec } = require('./lint');
const { compareResponseData } = require('./compare');

async function recordCommand(specFile, server, config) {
  // Read the spec file outside of the pipeline, so that we can inject it (and re-write it)
  // at the end. Not very functional, but easier than passing the data all the way down the pipe.
  const specObj = readJsonFile(specFile);
  await validateSpecObj({ specObj }); // We have to validate before we try to read the file cntents
  const absSpecFilePath = getAbsSpecFilePath(specFile);
  const destPath = getAbsSpecFilePath(config.outputFile ? config.outputFile : specFile);
  const serverUrl = server || specObj.servers[0].url;

  // define the data processing pipeline
  const pipeline = pipe(
    validateSpecObj,
    getFetchConfigForAPIEndpoints,
    addParamsToFetchConfig,
    fetchResponses,
    validateResponses,
    writeResponses,
    removeUnusedResponses,
    lintSpecFile,
    writeOutputFile,
  );

  return pipeline({ specObj, serverUrl, destPath, specFile, absSpecFilePath, config });
}

/**
 * To avoid overwhelming the fetch API, we need to make requests in batches.
 * @param params
 * @return {Promise<{responses: []}>}
 */
async function fetchResponses(params) {
  const { fetchConfigs, serverUrl, config, endpointRequestFn = callEndpoint } = params;
  const maxSimultaneousRequests = config.simultaneousRequests || 10;

  const responses = await concurrentFunctionProcessor(
    fetchConfigs.map((item) => (counter, total) => endpointRequestFn({ ...item, serverUrl, counter, total })),
    maxSimultaneousRequests,
  );

  return { ...params, responses };
}

function callEndpoint(params) {
  const {
    path,
    url,
    config,
    apiEndpoint,
    expectedStatusCode,
    exampleName,
    exampleIndex,
    serverUrl,
    counter,
    total,
    fetcher = fetch,
  } = params;
  const endPointUrl = `${serverUrl}${url}`;
  logger.info(`Fetching ${counter} of ${total}: ${endPointUrl} ${config.method}`);

  return fetcher(endPointUrl, config)
    .then(async (res) => {
      const json = await res.json();
      return { statusCode: res.status, json };
    })
    .then((res) => {
      logger.debug(endPointUrl, config.method, 'Responded', res.statusCode);
      return {
        path,
        url,
        config,
        expectedStatusCode,
        statusCode: res.statusCode,
        response: res.json,
        apiEndpoint,
        exampleName,
        exampleIndex,
      };
    })
    .catch((err) => {
      logger.error(endPointUrl, 'had an error', err);
      return { error: err, apiEndpoint };
    });
}

function validateResponses(params) {
  const { responses } = params;
  // Check that the response status-codes match what we were expecting
  const validResponses = responses.filter((res) => {
    if (res.expectedStatusCode !== res.statusCode) {
      logger.warn(`${res.url} returned ${res.statusCode}, expected ${res.expectedStatusCode}`);
      return false;
    }
    return true;
  });

  return {
    ...params,
    responses: validResponses,
  };
}

/**
 * Mutates the specObj object with the response file name,
 * @param {object} params.responses
 * @param {string} params.destPath  Absolute path to the output spec file's directory
 * @param {string} params.config.responseFilenameFn    Function which is used to determine the response file name.
 * @return {Array<String>}      Array of file names used.
 */
function writeResponses(params) {
  const { responses, destPath, config } = params;

  // Need to save the response to a json now that we know they are valid
  // console.log(responses);
  const responseFiles = responses.map((res) => {
    // Generate the filename for the response, based on the response object
    logger.debug(`Response ${res}`);

    // logger.debug('writeRes', res);
    const example = getExampleObject(res.apiEndpoint.responses[res.statusCode], res.exampleName);
    const previousResponseFileData = getExistingResponseFileData(example, destPath);

    const { create, update, responseFileName, absResponseFileName, relResponseFileName } = compareResponses({
      config,
      destPath,
      previousResponseFileData,
      res,
    });

    if (create) {
      logger.info(`Creating response file ${responseFileName}`);
      writeResponseFileAndSpecRef(absResponseFileName, res.response, res, config);
    } else if (update) {
      logger.info(`Updating response file ${responseFileName}`);
      writeResponseFileAndSpecRef(absResponseFileName, res.response, res, config);
    } else {
      logger.info(`Response file unchanged: ${responseFileName}`);
    }
    return relResponseFileName;
  });

  return {
    ...params,
    responseFiles,
  };
}

function getExistingResponseFileData(example, destPath) {
  const responseFileName = example && example.responseFile;

  if (!responseFileName) {
    return null;
  }

  const absResponseFilePath = join(destPath, responseFileName);

  // Attempt to load the previous response file for comparison, but it may not exist.
  try {
    return require(absResponseFilePath);
  } catch (e) {
    logger.debug(`Response file "${absResponseFilePath}" could not be loaded.`);
    return null;
  }
}

/**
 * Compare responses to the existing responses, and return a list of files
 * the should be updated.
 * @param params
 */
function compareResponses(params) {
  const { config, destPath, previousResponseFileData, res } = params;
  const responseFileName = config.responseFilenameFn(res);
  const relResponseFileName = join(config.responseBasePath, responseFileName);
  const absResponseFileName = join(destPath, relResponseFileName);

  const response = {
    responseFileName,
    absResponseFileName,
    relResponseFileName,
    create: false,
    update: false,
  };

  // If there was no previous responseFile property, create the response
  if (!previousResponseFileData) {
    return { ...response, create: true };
  }

  const matchType = compareResponseData(previousResponseFileData, res);
  if (matchType === 'exact') {
    return response;
  }

  if (matchType === 'inexact') {
    logger.debug(`Response has not changed (except ignored paths): ${responseFileName}`);
    return { ...response, update: config.updateResponseWhenInexactMatch };
  }

  if (matchType === 'type') {
    logger.debug(`Response types match, but values have changed: ${responseFileName}`);
    return { ...response, update: config.updateResponseWhenTypesMatch };
  }

  // Response has changed, so update it
  return { ...response, update: true };
}

function writeResponseFileAndSpecRef(filePath, data, specRef, config) {
  writeJsonFile(filePath, data, config);

  const ref = specRef.apiEndpoint.responses[specRef.statusCode];
  // The responseFile path should be relative to the API Spec path (not to this script)
  updateExampleObject(ref, specRef.exampleName, 'responseFile', relative(__dirname, filePath));
}

function removeUnusedResponses(params) {
  const { responseFiles, destPath, config } = params;
  logger.verbose(`responseFiles ${responseFiles}`);

  // If there is no responseBasePath or config.removeUnusedResponses is falsey, bail.
  if (!config.responseBasePath || !config.removeUnusedResponses) {
    return;
  }

  // Iterate over the files in the destPath + responseBasePath directory, which are not in fileList
  const absFileList = responseFiles.map((relFileName) => join(destPath, relFileName));
  const responseDir = join(destPath, config.responseBasePath);
  logger.verbose(`removeUnusedResponses ${JSON.stringify(absFileList, null, 2)}`);
  logger.debug(`Searching ${responseDir} for unused responses...`);
  const filesToDelete = findInDir(responseDir, (filename) => !absFileList.includes(filename));

  if (filesToDelete.length > 0) {
    logger.debug('Files to delete\n', filesToDelete);
    if (!config.dryRun) {
      filesToDelete.forEach((filename) => unlinkSync(filename));
    }
  }
  return {
    ...params,
    deletedResponseFiles: filesToDelete,
  };
}

function findInDir(dir, filterFn, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const fileStat = lstatSync(filePath);

    if (!fileStat.isDirectory() && filterFn(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function lintSpecFile(params) {
  if (params.config.andLint) {
    params = lintSpec(params);
  }
  return params;
}

module.exports = {
  fetchResponses,
  getExistingResponseFileData,
  recordCommand,
  validateResponses,
  writeResponses,
  writeResponseFileAndSpecRef,
};
