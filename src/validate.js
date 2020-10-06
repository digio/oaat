const { pipe, readJsonFile, getAbsSpecFilePath, validateSpecObj } = require('./utils');
const logger = require('winston');

async function validateCommand(specFile, config) {
  const specObj = readJsonFile(specFile);
  const absSpecFilePath = getAbsSpecFilePath(specFile);

  // Read the file, lint it, write it
  const pipeline = pipe(validateSpecObj, () => {
    logger.info('Validation complete.');
  });

  return pipeline({ specObj, specFile, absSpecFilePath, config });
}

module.exports = { validateCommand };
