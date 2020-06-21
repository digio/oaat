/* eslint-disable @getify/proper-arrows/where */
const path = require('path');
const spawn = require('spawn-command');

describe('amuck CLI', () => {
  describe('top-level help', () => {
    it('should be displayed when not enough arguments are passed', async () => {
      const result = await runCommand();
      expect(result).toMatchSnapshot();
    });

    it('should be displayed when --help is passed', async () => {
      const result = await runCommand('--help');
      expect(result).toMatchSnapshot();
    });
  });

  describe('lint', () => {
    it('should lint the spec file using the default config', async () => {
      const outputFile = 'fixtures/output/lint1.json';
      await runCommand(`lint ./fixtures/noExamples.json -o ./${outputFile}`);

      const result = require(`../${outputFile}`);
      expect(Object.keys(result.paths)).toMatchSnapshot('paths');
      expect(Object.keys(result.components.schemas)).toMatchSnapshot('schemas');
    });

    it('should update the x-examples into the parameters and requestBody, using the default config', async () => {
      const outputFile = 'fixtures/output/lint2.json';
      const output = await runCommand(`lint ./fixtures/lintExamples.json -o ./${outputFile}`);
      console.log(output);
      const result = require(`../${outputFile}`);
      expect(Object.keys(result.paths)).toMatchSnapshot('paths');
    });
  });

  describe('record', () => {
    it('should update the response files using the default config, using noExamples.json', async () => {
      const result = await runCommand(`record ./fixtures/noExamples.json -d`);
      expect(result).toMatchSnapshot();
    });

    it('should update the response files using the default config, using threeExamples.json', async () => {
      const result = await runCommand(`record ./fixtures/threeExamples.json -d`);
      expect(result).toMatchSnapshot();
    });
  });

  describe('build', () => {
    it('should create a spec file that is OpenAPI 3.x compliant', async () => {
      const result = await runCommand(`record ./fixtures/noExamples.json -d`);
      expect(result).toMatchSnapshot();
    });
  });
});

function runCommand(args = '', cwd = process.cwd()) {
  const CLI_PATH = require.resolve('./cli');
  const isRelative = cwd[0] !== '/';

  if (isRelative) {
    cwd = path.resolve(__dirname, cwd);
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const command = `${CLI_PATH} ${args}`;
    const child = spawn(command, { cwd });

    child.on('error', (error) => {
      reject(error);
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', () => {
      if (stderr) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}
