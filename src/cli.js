#!/usr/bin/env node

const program = require('commander');
const { version } = require('../package.json');
const { getLogAndConfig } = require('./utils');

program.name('amuck').version(version).usage('<command>');

program
  .command('lint <jsonFile>')
  .description('Tidy the API Spec up a bit')
  .option('-o, --output <file>', 'Output file (if different to jsonFile)')
  .option('-c, --config <file>', 'Config file to override default config')
  .option('-q, --quiet', 'no logging')
  .option('-v, --verbose', 'verbose logging')
  // eslint-disable-next-line @getify/proper-arrows/where
  .action((jsonFile, cmd) => {
    const { log, config } = getLogAndConfig('lint', cmd);

    const { lintCommand } = require('./lint');
    try {
      lintCommand(jsonFile, config);
    } catch (err) {
      log.error(err);
    }
  });

program
  .command('record <jsonFile> [serverUrl]')
  .description(
    'Record the responses of API spec file endpoint requests (optionally use a different server to make requests)',
  )
  .option('-o, --output <file>', 'Output file (if different to jsonFile)')
  .option('-c, --config <file>', 'Config file to override default config')
  .option('-q, --quiet', 'No logging')
  .option('-v, --verbose', 'Verbose logging')
  .option('-d, --dry-run', 'Dry run (no changes made)')
  // eslint-disable-next-line @getify/proper-arrows/where
  .action((jsonFile, serverUrl, cmd) => {
    const { log, config } = getLogAndConfig('record', cmd);
    log.debug(`command args: ${jsonFile}`);

    const { recordCommand } = require('./record');
    try {
      recordCommand(jsonFile, serverUrl, config);
    } catch (err) {
      log.error(err);
    }
  });

program
  .command('build <jsonFile> <outputJsonFile> [serverUrl]')
  .description('Adds custom headers & Swagger UI endpoint to allow deployment of spec file to AWS API Gateway')
  .option('-c, --config <file>', 'Config file to override default config')
  .option('-m, --mock', 'Uses the responses as mock responses')
  .option('-q, --quiet', 'No logging')
  .option('-v, --verbose', 'Verbose logging')
  .option('-d, --dry-run', 'Dry run (no changes made)')
  // eslint-disable-next-line @getify/proper-arrows/where
  .action((jsonFile, outputJsonFile, serverUrl, cmd) => {
    const { log, config } = getLogAndConfig('build', cmd);
    log.debug(`command args: ${jsonFile}`);

    const { addGatewayInfo } = require('./addGatewayInfo');
    try {
      addGatewayInfo(jsonFile, outputJsonFile, serverUrl, config);
    } catch (err) {
      log.error(err);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
