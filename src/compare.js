const isEqual = require('lodash/isEqual'); // I'm not a fan of Lodash, but this will save a lot of time compared to re-implementing omit()
const omit = require('lodash/omit'); // I'm not a fan of Lodash, but this will save a lot of time compared to re-implementing omit()

const { getPathsToIgnore, traverse } = require('./utils');

function convertToType(obj, key) {
  const type = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
  // console.log('obj:', obj, ', key:', key, ', type', type);
  if (type !== 'array' && type !== 'object') {
    obj[key] = type;
  }

  return obj;
}

function compareByType(objA, objB) {
  const newA = traverse(objA, convertToType);
  const newB = traverse(objB, convertToType);

  // console.log('newA', newA);
  // console.log('newB', newB);

  return isEqual(newA, newB);
}

function compareResponseData(oldRes, apiRes) {
  const exactMatch = isEqual(oldRes, apiRes.response);

  if (exactMatch) {
    return 'exact';
  }

  const pathsToIgnore = getPathsToIgnore(apiRes.apiEndpoint.responses, apiRes.statusCode);
  const filteredPrevResponse = JSON.parse(JSON.stringify(omit(oldRes, pathsToIgnore))); // deep clone hack
  const filteredResponse = JSON.parse(JSON.stringify(omit(apiRes.response, pathsToIgnore)));
  const inexactMatch = isEqual(filteredPrevResponse, filteredResponse);

  if (inexactMatch) {
    return 'inexact';
  }

  const typesMatch = compareByType(filteredPrevResponse, filteredResponse);

  if (typesMatch) {
    return 'type';
  }

  return 'nomatch';
}

module.exports = {
  compareByType,
  compareResponseData,
};
