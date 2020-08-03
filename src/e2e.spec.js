/* eslint-disable @getify/proper-arrows/where */
const path = require('path');
const spawn = require('spawn-command');

describe('amuck CLI', () => {
  describe('top-level help', () => {
    it('should be displayed when not enough arguments are passed', async () => {
      const result = await runCommand();
      expect(result).toMatchInlineSnapshot(`
        "Usage: amuck <command>

        Options:
          -V, --version                                            output the version number
          -h, --help                                               display help for command

        Commands:
          lint [options] <jsonFile>                                Tidy the API Spec up a bit
          record [options] <jsonFile> [serverUrl]                  Record the responses of API spec file endpoint requests (optionally use a different server to make requests)
          build [options] <jsonFile> <outputJsonFile> [serverUrl]  Adds custom headers & Swagger UI endpoint to allow deployment of spec file to AWS API Gateway with documentation
          compare [options] <jsonFile> [serverUrl]                 Compares recorded responses (referenced by the spec file) to the latest responses
          help [command]                                           display help for command
        "
      `);
    });

    it('should be displayed when --help is passed', async () => {
      const result = await runCommand('--help');
      expect(result).toMatchInlineSnapshot(`
        "Usage: amuck <command>

        Options:
          -V, --version                                            output the version number
          -h, --help                                               display help for command

        Commands:
          lint [options] <jsonFile>                                Tidy the API Spec up a bit
          record [options] <jsonFile> [serverUrl]                  Record the responses of API spec file endpoint requests (optionally use a different server to make requests)
          build [options] <jsonFile> <outputJsonFile> [serverUrl]  Adds custom headers & Swagger UI endpoint to allow deployment of spec file to AWS API Gateway with documentation
          compare [options] <jsonFile> [serverUrl]                 Compares recorded responses (referenced by the spec file) to the latest responses
          help [command]                                           display help for command
        "
      `);
    });
  });

  describe('lint', () => {
    it('should lint the spec file using the default config', async () => {
      const outputFile = 'fixtures/output/lint1.json';
      await runCommand(`lint ./fixtures/noExamples.json -o ./${outputFile}`);

      const result = require(`../${outputFile}`);
      expect(Object.keys(result.paths)).toMatchInlineSnapshot(`
        Array [
          "/albums",
          "/albums/{id}",
          "/albums/{id}/photos",
          "/comments",
          "/comments/{id}",
          "/photos",
          "/photos/{id}",
          "/posts",
          "/posts/{id}",
          "/posts/{id}/comments",
          "/todos",
          "/todos/{id}",
          "/users",
          "/users/{id}",
        ]
      `);
      expect(Object.keys(result.components.schemas)).toMatchInlineSnapshot(`
        Array [
          "Album",
          "Comment",
          "NotFoundError",
          "Photo",
          "Post",
          "Todo",
          "User",
        ]
      `);
    });

    it('should update the x-examples into the parameters and requestBody, using the default config', async () => {
      const outputFile = 'fixtures/output/lint2.json';
      const output = await runCommand(`lint ./fixtures/lintExamples.json -o ./${outputFile}`);
      console.log(output);
      const result = require(`../${outputFile}`);
      expect(Object.keys(result.paths)).toMatchInlineSnapshot(`
        Array [
          "/posts",
          "/posts/{id}",
        ]
      `);
    });
  });

  describe('record', () => {
    it('should update the response files using the default config, using noExamples.json', async () => {
      const result = await runCommand(`record ./fixtures/noExamples.json -d`);
      expect(result).toMatchInlineSnapshot(`
        "[33mwarn[39m: Ignore (no x-examples parameters) - 200 get /posts
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /posts/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /posts/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /posts/{id}/comments
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /posts/{id}/comments
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /comments
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /comments/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /comments/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /albums
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /albums/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /albums/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /albums/{id}/photos
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /albums/{id}/photos
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /photos
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /photos/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /photos/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /todos
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /todos/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /todos/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /users
        [33mwarn[39m: Ignore (no x-examples parameters) - 200 get /users/{id}
        [33mwarn[39m: Ignore (no x-examples parameters) - 404 get /users/{id}
        "
      `);
    });

    it('should update the response files using the default config, using threeExamples.json', async () => {
      const result = await runCommand(`record ./fixtures/threeExamples.json -d`);
      expect(result).toMatchInlineSnapshot(`
        "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
        [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
        [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
        [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
        [34minfo[39m: Creating response file GET_posts-200_DEFAULT.json
        [34minfo[39m: Creating response file GET_posts_{id}-200_DEFAULT_id_1.json
        [34minfo[39m: Creating response file GET_posts_{id}-200_id_2.json
        [34minfo[39m: Creating response file GET_posts_{id}-404_DEFAULT_badParam.json
        "
      `);
    });
  });

  describe('build should create a spec file that is OpenAPI 3.x compliant', () => {
    it('and contains just the webUI and specFile endpoint', async () => {
      const outputFile = 'fixtures/output/build1.json';
      await runCommand(`build ./fixtures/threeExamples.json ./${outputFile}`);

      const result = require(`../${outputFile}`);
      expect(Object.keys(result.paths)).toMatchInlineSnapshot(`
        Array [
          "/open-api-spec.json",
          "/",
        ]
      `);
      expect(Object.keys(result.components.schemas)).toMatchInlineSnapshot(`
        Array [
          "Post",
          "Comment",
          "Album",
          "Photo",
          "Todo",
          "User",
          "NotFoundError",
          "Empty",
          "StringResponse",
        ]
      `);
    });

    it('and contains mock responses plus the website and spec', async () => {
      const outputFile = 'fixtures/output/buildMock1.json';
      await runCommand(`build ./fixtures/threeExamples.json ./${outputFile} -m`);

      const result = require(`../${outputFile}`);
      expect(Object.keys(result.paths)).toMatchInlineSnapshot(`
        Array [
          "/posts",
          "/posts/{id}",
          "/posts/{id}/404",
          "/open-api-spec.json",
          "/",
        ]
      `);
    });

    it('and ignores x-ignore endpoints', async () => {
      const outputFile = 'fixtures/output/buildMock2.json';
      await runCommand(`build ./fixtures/threeExamplesWithIgnore.json ./${outputFile} -m`);

      const result = require(`../${outputFile}`);
      expect(Object.keys(result.paths)).toMatchInlineSnapshot(`
        Array [
          "/posts/{id}",
          "/open-api-spec.json",
          "/",
        ]
      `);
    });
  });

  describe('compare', () => {
    it('should indicate there are no differences when there are no differences', async () => {
      const result = await runCommand(`compare ./fixtures/threeExamplesWithCorrectStatus.json`);
      expect(result).toMatchInlineSnapshot(`
        "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
        [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
        [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
        [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
        [32msuccess[39m: ✅ No differences detected
        "
      `);
    });

    it('should indicate there are differences when the status codes are different', async () => {
      const result = await runCommand(`compare ./fixtures/threeExamplesWithWrongStatus.json`);
      expect(result).toMatchInlineSnapshot(`
        "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
        [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
        [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
        [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
        [31merror[39m: Expected 400 but received 200: /posts/1
        [31merror[39m: Expected 400 but received 200: /posts/2
        [31merror[39m: ❌ Differences were detected
        "
      `);
    });

    it('should indicate there are differences when the response body is different', async () => {
      const result = await runCommand(`compare ./fixtures/threeExamplesWithDiffBody.json`);
      expect(result).toMatchInlineSnapshot(`
        "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
        [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
        [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
        [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
        [31merror[39m: /posts/2
        [32m- Expected[39m
        [31m+ Received[39m

        [2m  Object {[22m
        [2m    \\"body\\": \\"est rerum tempore vitae[22m
        [2m  sequi sint nihil reprehenderit dolor beatae ea dolores neque[22m
        [2m  fugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis[22m
        [2m  qui aperiam non debitis possimus qui neque nisi nulla\\",[22m
        [2m    \\"id\\": 2,[22m
        [32m-   \\"title\\": \\"Non matching title\\",[39m
        [31m+   \\"title\\": \\"qui est esse\\",[39m
        [2m    \\"userId\\": 1,[22m
        [2m  }[22m

        [31merror[39m: ❌ Differences were detected
        "
      `);
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
