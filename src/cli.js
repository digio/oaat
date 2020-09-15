#!/usr/bin/env node

const program = require('commander');
const { version } = require('../package.json');
const { getLogAndConfig } = require('./utils');

program.name('oaat').version(version).usage('<command>');

program
  .command('lint <jsonFile>')
  .description('Tidy the API Spec up a bit')
  .option('-o, --output <file>', 'Output file (if different to jsonFile)')
  .option('-c, --config <file>', 'Config file to override default config')
  .option('-q, --quiet', 'no logging')
  .option('-v, --verbose', 'verbose logging')
  // eslint-disable-next-line @getify/proper-arrows/where
  .action(async (jsonFile, cmd) => {
    const { log, config } = getLogAndConfig('lint', cmd);

    const { lintCommand } = require('./lint');
    try {
      await lintCommand(jsonFile, config);
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
  .action(async (jsonFile, serverUrl, cmd) => {
    const { log, config } = getLogAndConfig('record', cmd);
    log.debug(`command args: ${jsonFile}`);

    const { recordCommand } = require('./record');
    try {
      await recordCommand(jsonFile, serverUrl, config);
    } catch (err) {
      // console.error(err);
      log.error(err);
    }
  });

program
  .command('build <jsonFile> <outputJsonFile> [serverUrl]')
  .description(
    'Adds custom headers & Swagger UI endpoint to allow deployment of spec file to AWS API Gateway with documentation',
  )
  .option('-c, --config <file>', 'Config file to override default config')
  .option('-m, --mock', 'Uses the recorded responses as mock responses')
  // .option('-p, --proxy', 'Proxies the endpoints through API Gateway') // To be implmented later
  .option('-q, --quiet', 'No logging')
  .option('-v, --verbose', 'Verbose logging')
  .option('-d, --dry-run', 'Dry run (no changes made)')
  // eslint-disable-next-line @getify/proper-arrows/where
  .action(async (jsonFile, outputJsonFile, serverUrl, cmd) => {
    // Merge the outputJsonFile into the config.outputFile property,
    // so we can reuse the pathing logic there
    const { log, config } = getLogAndConfig('build', { ...cmd, output: outputJsonFile });
    log.debug(`command args: ${jsonFile}, ${config.outputFile}`);

    // Add additional flags
    config.mock = cmd.mock;
    config.proxy = cmd.proxy;

    const { addGatewayInfo } = require('./build');
    try {
      await addGatewayInfo(jsonFile, serverUrl, config);
    } catch (err) {
      log.error(err);
    }
  });

program
  .command('compare <jsonFile> [serverUrl]')
  .description('Compares recorded responses (referenced by the spec file) to the latest responses')
  .option('-c, --config <file>', 'Config file to override default config')
  .option('-m --compare-mode <mode>', 'Comparison mode: "value" (default), "type", "schema"')
  .option('-q, --quiet', 'no logging')
  .option('-v, --verbose', 'verbose logging')
  // eslint-disable-next-line @getify/proper-arrows/where
  .action(async (jsonFile, serverUrl, cmd) => {
    const { log, config } = getLogAndConfig('compare', cmd);

    config.compareMode = cmd.compareMode;

    const { compareCommand } = require('./compare');
    try {
      // We deliberately want to return a non-zero error code for this command,
      // allow CI tools to fail on-error
      const errorCode = await compareCommand(jsonFile, serverUrl, config);
      // eslint-disable-next-line no-process-exit
      return process.exit(errorCode);
    } catch (err) {
      log.error(err);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
