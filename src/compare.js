const diffDefault = require('jest-diff').default;
const isEqual = require('lodash/isEqual'); // I'm not a fan of Lodash, but this will save a lot of time compared to re-implementing omit()
const omit = require('lodash/omit'); // I'm not a fan of Lodash, but this will save a lot of time compared to re-implementing omit()
const { fetchResponses, getExistingResponseFileData } = require('./record');
const logger = require('winston');
const {
  pipe,
  addParamsToFetchConfig,
  cloneDeep,
  getAbsSpecFilePath,
  getExampleObject,
  getFetchConfigForAPIEndpoints,
  getPathsToIgnore,
  readJsonFile,
  returnExitCode,
  traverse,
} = require('./utils');

function compareCommand(specFile, server, config) {
  // Read the spec file outside of the pipeline, so that we can inject it (and re-write it)
  // at the end. Not very functional, but easier than passing the data all the way down the pipe.
  const specObj = readJsonFile(specFile);
  const absSpecFilePath = getAbsSpecFilePath(specFile);
  const destPath = getAbsSpecFilePath(config.outputFile ? config.outputFile : specFile);
  const serverUrl = server || specObj.servers[0].url;

  // define the data processing pipeline
  const pipeline = pipe(
    getFetchConfigForAPIEndpoints,
    addParamsToFetchConfig,
    fetchResponses,
    compareResponseCodes,
    compareResponsePayloads,
    checkHasErrors,
    returnExitCode,
  );

  return pipeline({ specObj, serverUrl, destPath, specFile, absSpecFilePath, config });
}

/**
 * Compare the response codes to what we were expecting. If they differ, print a message
 * @param params
 * @return {{responses: *}}
 */
function compareResponseCodes(params) {
  const { responses } = params;
  let hasErrors = false;

  // Check that the response status-codes match what we were expecting
  responses.forEach((res) => {
    if (res.expectedStatusCode !== res.statusCode) {
      hasErrors = true;
      logger.error(`Expected ${res.expectedStatusCode} but received ${res.statusCode}: ${res.url}`);
    }
  });

  return { ...params, hasErrors };
}

const comparisonMap = {
  value: compareByValueIgnoringPaths,
};

function compareResponsePayloads(params) {
  const { responses, destPath, config } = params;
  let { hasErrors } = params; // read the existing value as our initial value
  const showDiff = true;
  const compareFn = comparisonMap[config.compareMode] || comparisonMap.value;

  // For each response compare the data according to the compare mode
  responses.forEach((res) => {
    // Generate the filename for the response, based on the response object
    logger.debug(`compareResponsePayloads`, res);

    const diffLabel = res.url;
    const example = getExampleObject(res.apiEndpoint.responses[res.expectedStatusCode], res.exampleName);
    const previousResponseFileData = getExistingResponseFileData(example, destPath);
    logger.verbose('previousResponseFileData', previousResponseFileData);
    const pathsToIgnore = getPathsToIgnore(res.apiEndpoint.responses, res.statusCode);

    const result = compareFn({
      objA: previousResponseFileData,
      objB: res.response,
      pathsToIgnore,
      showDiff,
      diffLabel,
    });

    if (!result) {
      hasErrors = true;
    }
  });

  return { ...params, hasErrors };
}

function checkHasErrors(params) {
  const { hasErrors } = params;

  if (hasErrors === false) {
    logger.success('✅ No differences detected');
  } else {
    logger.error('❌ Differences were detected');
  }
  return params;
}

function compareByValue({ objA, objB, showDiff = true, diffLabel = '' }) {
  const result = isEqual(objA, objB);

  if (!result && showDiff) {
    logger.verbose('objA', objA);
    logger.verbose('objB', objB);
    // Use jest-diff to display differences
    logger.error(`${diffLabel}\n${diffDefault(objA, objB)}\n`);
  }
  return result;
}

function compareByValueIgnoringPaths({ objA, objB, pathsToIgnore, showDiff, diffLabel }) {
  const filteredPrevResponse = cloneDeep(omit(objA, pathsToIgnore));
  const filteredResponse = cloneDeep(omit(objB, pathsToIgnore));
  return compareByValue({ objA: filteredPrevResponse, objB: filteredResponse, showDiff, diffLabel });
}

function compareByType({ objA, objB, pathsToIgnore, showDiff }) {
  const clonedA = cloneDeep(omit(objA, pathsToIgnore));
  const clonedB = cloneDeep(omit(objB, pathsToIgnore));
  const newA = traverse(clonedA, convertToType);
  const newB = traverse(clonedB, convertToType);

  return compareByValue({ objA: newA, objB: newB, showDiff });
}

/**
 * This function is used when recording to decide what to do with the API response
 * We do not show diffs between the old and new response in this mode.
 * @param oldRes
 * @param apiRes
 * @return {string}
 */
function compareResponseData(oldRes, apiRes) {
  const showDiff = false;
  const exactMatch = compareByValue({ objA: oldRes, objB: apiRes.response, showDiff });

  if (exactMatch) {
    return 'exact';
  }

  const pathsToIgnore = getPathsToIgnore(apiRes.apiEndpoint.responses, apiRes.statusCode);
  const inexactMatch = compareByValueIgnoringPaths({ objA: oldRes, objB: apiRes.response, pathsToIgnore, showDiff });

  if (inexactMatch) {
    return 'inexact';
  }

  const typesMatch = compareByType({ objA: oldRes, objB: apiRes.response, pathsToIgnore, showDiff });

  if (typesMatch) {
    return 'type';
  }

  return 'nomatch';
}

function convertToType(obj, key) {
  const type = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
  // console.log('obj:', obj, ', key:', key, ', type', type);
  if (type !== 'array' && type !== 'object') {
    obj[key] = type;
  }
  return obj;
}

module.exports = {
  compareCommand,
  compareByType,
  compareResponseData,
};
