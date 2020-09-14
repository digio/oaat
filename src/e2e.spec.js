/* eslint-disable @getify/proper-arrows/where */
const path = require('path');
const spawn = require('spawn-command');

describe('CLI', () => {
  describe('top-level help', () => {
    it('should be displayed when not enough arguments are passed', async () => {
      const result = await runCommand();
      expect(result).toMatchInlineSnapshot(`
        "Usage: oaat <command>

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
        "Usage: oaat <command>

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

    it('should display an error when the spec is not valid', async () => {
      const result = await runCommand(`lint ./fixtures/invalidSpecV2.json`);

      expect(result).toMatchInlineSnapshot(`
        "[31merror[39m: One or more errors exist in the OpenApi definition
          Property not allowed: swagger
          Missing required property: openapi
        "
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

    it('should display an error when the spec is not valid', async () => {
      const result = await runCommand(`record ./fixtures/invalidSpecV2.json`);

      expect(result).toMatchInlineSnapshot(`
        "[31merror[39m: One or more errors exist in the OpenApi definition
          Property not allowed: swagger
          Missing required property: openapi
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

    it('should display an error when the spec is not valid', async () => {
      const result = await runCommand(`build ./fixtures/invalidSpecV2.json foo.txt`);

      expect(result).toMatchInlineSnapshot(`
        "[31merror[39m: One or more errors exist in the OpenApi definition
          Property not allowed: swagger
          Missing required property: openapi
        "
      `);
    });
  });

  describe('compare', () => {
    it('should indicate there are differences when the status codes are different', async () => {
      const result = await runCommand(`compare ./fixtures/threeExamplesWithWrongStatus.json`);
      expect(result).toMatchInlineSnapshot(`
        "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
        [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
        [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
        [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
        [31merror[39m: Expected 400 but received 200: /posts/1
        [31merror[39m: Expected 400 but received 200: /posts/2
        [34minfo[39m: Comparing by VALUE
        [31merror[39m: ❌ Differences were detected
        "
      `);
    });

    it('should display an error when the spec is not valid', async () => {
      const result = await runCommand(`compare ./fixtures/invalidSpecV2.json foo.txt`);

      expect(result).toMatchInlineSnapshot(`
        "[31merror[39m: One or more errors exist in the OpenApi definition
          Property not allowed: swagger
          Missing required property: openapi
        "
      `);
    });

    describe('by value', () => {
      it('should indicate there are no differences when there are no differences', async () => {
        const result = await runCommand(`compare ./fixtures/threeExamplesWithCorrectStatus.json`);
        expect(result).toMatchInlineSnapshot(`
          "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
          [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
          [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
          [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/-2 get
          [34minfo[39m: Comparing by VALUE
          [32msuccess[39m: ✅ No differences detected
          "
        `);
      });

      it('should indicate there are differences when the response body is different and the comparison is by-value', async () => {
        const result = await runCommand(`compare ./fixtures/threeExamplesWithDiffBody.json`);
        expect(result).toMatchInlineSnapshot(`
          "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
          [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
          [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
          [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
          [34minfo[39m: Comparing by VALUE
          [31merror[39m: /posts/2
          - Expected
          + Received

            Object {
              \\"body\\": \\"est rerum tempore vitae
            sequi sint nihil reprehenderit dolor beatae ea dolores neque
            fugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis
            qui aperiam non debitis possimus qui neque nisi nulla\\",
              \\"id\\": 2,
          -   \\"title\\": \\"Non matching title\\",
          +   \\"title\\": \\"qui est esse\\",
              \\"userId\\": 1,
            }

          [31merror[39m: ❌ Differences were detected
          "
        `);
      });
    });

    describe('by type', () => {
      it('should indicate there are no differences when the body values differ but have the same type', async () => {
        const result = await runCommand(`compare ./fixtures/threeExamplesWithDiffBody.json -m type`);
        expect(result).toMatchInlineSnapshot(`
          "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
          [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
          [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
          [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
          [34minfo[39m: Comparing by TYPE
          [32msuccess[39m: ✅ No differences detected
          "
        `);
      });
    });

    describe('by schema', () => {
      it('should indicate there are no differences when the schema matches', async () => {
        const result = await runCommand(`compare ./fixtures/threeExamplesWithCorrectStatus.json -m schema`);
        expect(result).toMatchInlineSnapshot(`
          "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
          [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
          [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
          [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/-2 get
          [34minfo[39m: Comparing by SCHEMA
          [32msuccess[39m: ✅ No differences detected
          "
        `);
      });

      it('should indicate there are differences when the schema does not match', async () => {
        const result = await runCommand(`compare ./fixtures/threeExamplesWithDiffSchema.json -m schema`);
        expect(result).toMatchInlineSnapshot(`
          "[34minfo[39m: Fetching 1 of 4: https://jsonplaceholder.typicode.com/posts get
          [34minfo[39m: Fetching 2 of 4: https://jsonplaceholder.typicode.com/posts/1 get
          [34minfo[39m: Fetching 3 of 4: https://jsonplaceholder.typicode.com/posts/2 get
          [34minfo[39m: Fetching 4 of 4: https://jsonplaceholder.typicode.com/posts/wrong-param get
          [34minfo[39m: Comparing by SCHEMA
          [31merror[39m: Response invalid
            at: body
              at: 0
                at: id
                  Expected a string. Received: 1
                at: title
                  Expected an integer. Received: \\"sunt aut facere repellat provident occaecati excepturi optio reprehenderit\\"
              at: 1
                at: id
                  Expected a string. Received: 2
                at: title
                  Expected an integer. Received: \\"qui est esse\\"
              at: 2
                at: id
                  Expected a string. Received: 3
                at: title
                  Expected an integer. Received: \\"ea molestias quasi exercitationem repellat qui ipsa sit aut\\"
              at: 3
                at: id
                  Expected a string. Received: 4
                at: title
                  Expected an integer. Received: \\"eum et est occaecati\\"
              at: 4
                at: id
                  Expected a string. Received: 5
                at: title
                  Expected an integer. Received: \\"nesciunt quas odio\\"
              at: 5
                at: id
                  Expected a string. Received: 6
                at: title
                  Expected an integer. Received: \\"dolorem eum magni eos aperiam quia\\"
              at: 6
                at: id
                  Expected a string. Received: 7
                at: title
                  Expected an integer. Received: \\"magnam facilis autem\\"
              at: 7
                at: id
                  Expected a string. Received: 8
                at: title
                  Expected an integer. Received: \\"dolorem dolore est ipsam\\"
              at: 8
                at: id
                  Expected a string. Received: 9
                at: title
                  Expected an integer. Received: \\"nesciunt iure omnis dolorem tempora et accusantium\\"
              at: 9
                at: id
                  Expected a string. Received: 10
                at: title
                  Expected an integer. Received: \\"optio molestias id quia eum\\"
              at: 10
                at: id
                  Expected a string. Received: 11
                at: title
                  Expected an integer. Received: \\"et ea vero quia laudantium autem\\"
              at: 11
                at: id
                  Expected a string. Received: 12
                at: title
                  Expected an integer. Received: \\"in quibusdam tempore odit est dolorem\\"
              at: 12
                at: id
                  Expected a string. Received: 13
                at: title
                  Expected an integer. Received: \\"dolorum ut in voluptas mollitia et saepe quo animi\\"
              at: 13
                at: id
                  Expected a string. Received: 14
                at: title
                  Expected an integer. Received: \\"voluptatem eligendi optio\\"
              at: 14
                at: id
                  Expected a string. Received: 15
                at: title
                  Expected an integer. Received: \\"eveniet quod temporibus\\"
              at: 15
                at: id
                  Expected a string. Received: 16
                at: title
                  Expected an integer. Received: \\"sint suscipit perspiciatis velit dolorum rerum ipsa laboriosam odio\\"
              at: 16
                at: id
                  Expected a string. Received: 17
                at: title
                  Expected an integer. Received: \\"fugit voluptas sed molestias voluptatem provident\\"
              at: 17
                at: id
                  Expected a string. Received: 18
                at: title
                  Expected an integer. Received: \\"voluptate et itaque vero tempora molestiae\\"
              at: 18
                at: id
                  Expected a string. Received: 19
                at: title
                  Expected an integer. Received: \\"adipisci placeat illum aut reiciendis qui\\"
              at: 19
                at: id
                  Expected a string. Received: 20
                at: title
                  Expected an integer. Received: \\"doloribus ad provident suscipit at\\"
              at: 20
                at: id
                  Expected a string. Received: 21
                at: title
                  Expected an integer. Received: \\"asperiores ea ipsam voluptatibus modi minima quia sint\\"
              at: 21
                at: id
                  Expected a string. Received: 22
                at: title
                  Expected an integer. Received: \\"dolor sint quo a velit explicabo quia nam\\"
              at: 22
                at: id
                  Expected a string. Received: 23
                at: title
                  Expected an integer. Received: \\"maxime id vitae nihil numquam\\"
              at: 23
                at: id
                  Expected a string. Received: 24
                at: title
                  Expected an integer. Received: \\"autem hic labore sunt dolores incidunt\\"
              at: 24
                at: id
                  Expected a string. Received: 25
                at: title
                  Expected an integer. Received: \\"rem alias distinctio quo quis\\"
              at: 25
                at: id
                  Expected a string. Received: 26
                at: title
                  Expected an integer. Received: \\"est et quae odit qui non\\"
              at: 26
                at: id
                  Expected a string. Received: 27
                at: title
                  Expected an integer. Received: \\"quasi id et eos tenetur aut quo autem\\"
              at: 27
                at: id
                  Expected a string. Received: 28
                at: title
                  Expected an integer. Received: \\"delectus ullam et corporis nulla voluptas sequi\\"
              at: 28
                at: id
                  Expected a string. Received: 29
                at: title
                  Expected an integer. Received: \\"iusto eius quod necessitatibus culpa ea\\"
              at: 29
                at: id
                  Expected a string. Received: 30
                at: title
                  Expected an integer. Received: \\"a quo magni similique perferendis\\"
              at: 30
                at: id
                  Expected a string. Received: 31
                at: title
                  Expected an integer. Received: \\"ullam ut quidem id aut vel consequuntur\\"
              at: 31
                at: id
                  Expected a string. Received: 32
                at: title
                  Expected an integer. Received: \\"doloremque illum aliquid sunt\\"
              at: 32
                at: id
                  Expected a string. Received: 33
                at: title
                  Expected an integer. Received: \\"qui explicabo molestiae dolorem\\"
              at: 33
                at: id
                  Expected a string. Received: 34
                at: title
                  Expected an integer. Received: \\"magnam ut rerum iure\\"
              at: 34
                at: id
                  Expected a string. Received: 35
                at: title
                  Expected an integer. Received: \\"id nihil consequatur molestias animi provident\\"
              at: 35
                at: id
                  Expected a string. Received: 36
                at: title
                  Expected an integer. Received: \\"fuga nam accusamus voluptas reiciendis itaque\\"
              at: 36
                at: id
                  Expected a string. Received: 37
                at: title
                  Expected an integer. Received: \\"provident vel ut sit ratione est\\"
              at: 37
                at: id
                  Expected a string. Received: 38
                at: title
                  Expected an integer. Received: \\"explicabo et eos deleniti nostrum ab id repellendus\\"
              at: 38
                at: id
                  Expected a string. Received: 39
                at: title
                  Expected an integer. Received: \\"eos dolorem iste accusantium est eaque quam\\"
              at: 39
                at: id
                  Expected a string. Received: 40
                at: title
                  Expected an integer. Received: \\"enim quo cumque\\"
              at: 40
                at: id
                  Expected a string. Received: 41
                at: title
                  Expected an integer. Received: \\"non est facere\\"
              at: 41
                at: id
                  Expected a string. Received: 42
                at: title
                  Expected an integer. Received: \\"commodi ullam sint et excepturi error explicabo praesentium voluptas\\"
              at: 42
                at: id
                  Expected a string. Received: 43
                at: title
                  Expected an integer. Received: \\"eligendi iste nostrum consequuntur adipisci praesentium sit beatae perferendis\\"
              at: 43
                at: id
                  Expected a string. Received: 44
                at: title
                  Expected an integer. Received: \\"optio dolor molestias sit\\"
              at: 44
                at: id
                  Expected a string. Received: 45
                at: title
                  Expected an integer. Received: \\"ut numquam possimus omnis eius suscipit laudantium iure\\"
              at: 45
                at: id
                  Expected a string. Received: 46
                at: title
                  Expected an integer. Received: \\"aut quo modi neque nostrum ducimus\\"
              at: 46
                at: id
                  Expected a string. Received: 47
                at: title
                  Expected an integer. Received: \\"quibusdam cumque rem aut deserunt\\"
              at: 47
                at: id
                  Expected a string. Received: 48
                at: title
                  Expected an integer. Received: \\"ut voluptatem illum ea doloribus itaque eos\\"
              at: 48
                at: id
                  Expected a string. Received: 49
                at: title
                  Expected an integer. Received: \\"laborum non sunt aut ut assumenda perspiciatis voluptas\\"
              at: 49
                at: id
                  Expected a string. Received: 50
                at: title
                  Expected an integer. Received: \\"repellendus qui recusandae incidunt voluptates tenetur qui omnis exercitationem\\"
              at: 50
                at: id
                  Expected a string. Received: 51
                at: title
                  Expected an integer. Received: \\"so"
        `);
      });
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
